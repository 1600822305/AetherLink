import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../../EventService';
import { createStreamProcessor } from '../../StreamProcessingService';
import { MessageBlockStatus, AssistantMessageStatus, MessageBlockType } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import type { ErrorInfo } from '../../../store/slices/newMessagesSlice';
import { formatErrorMessage, getErrorType } from '../../../utils/error';
import { updateOneBlock } from '../../../store/slices/messageBlocksSlice';
import type { Chunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { checkAndHandleApiKeyError } from '../../../utils/apiKeyErrorHandler';

// 在文件开头添加错误记录类型定义
type ErrorRecord = Record<string, any>;

/**
 * 响应错误处理器 - 处理错误相关的逻辑
 */
export class ResponseErrorHandler {
  private messageId: string;
  private blockId: string;
  private topicId: string;

  constructor(messageId: string, blockId: string, topicId: string) {
    this.messageId = messageId;
    this.blockId = blockId;
    this.topicId = topicId;
  }

  /**
   * 响应失败处理
   * @param error 错误对象
   */
  async fail(error: Error) {
    console.error(`[ResponseErrorHandler] 响应失败 - 消息ID: ${this.messageId}, 错误: ${error.message}`);

    // 新增：检测 API Key 问题并提供重试机制
    // 注意：现在 checkAndHandleApiKeyError 返回 false，让我们继续创建错误块
    await checkAndHandleApiKeyError(error, this.messageId, this.topicId);

    // 获取错误消息
    const errorMessage = error.message || '响应处理失败';

    // 获取错误类型
    const errorType = getErrorType(error);

    // 获取错误详情
    const errorDetails = formatErrorMessage(error);

    // 创建错误记录对象
    const errorRecord: ErrorRecord = {
      message: errorMessage,
      timestamp: new Date().toISOString(),
      code: error.name || 'ERROR',
      type: errorType
    };

    // 创建更详细的错误信息对象用于Redux状态
    const errorInfo: ErrorInfo = {
      message: errorMessage,
      code: error.name || 'ERROR',
      type: errorType,
      timestamp: new Date().toISOString(),
      details: errorDetails,
      context: {
        messageId: this.messageId,
        blockId: this.blockId,
        topicId: this.topicId
      }
    };

    // 创建错误数据块
    const errorChunk: Chunk = {
      type: ChunkType.ERROR,
      error: {
        message: errorMessage,
        details: errorDetails,
        type: errorType
      }
    };

    // 使用流处理器处理错误数据块
    const streamProcessor = createStreamProcessor({
      onError: (_err) => {
        // 使用新的 action 更新消息状态
        store.dispatch(newMessagesActions.updateMessage({
          id: this.messageId,
          changes: {
            status: AssistantMessageStatus.ERROR
          }
        }));

        // 设置主题为非流式响应状态
        store.dispatch(newMessagesActions.setTopicStreaming({
          topicId: this.topicId,
          streaming: false
        }));

        // 设置主题为非加载状态
        store.dispatch(newMessagesActions.setTopicLoading({
          topicId: this.topicId,
          loading: false
        }));

        // 记录错误到Redux状态
        store.dispatch(newMessagesActions.setError({
          error: errorInfo,
          topicId: this.topicId
        }));

        // 更新Redux状态中的消息块，确保错误信息完整传递
        store.dispatch(updateOneBlock({
          id: this.blockId,
          changes: {
            type: MessageBlockType.ERROR,
            status: MessageBlockStatus.ERROR,
            content: errorMessage,
            error: errorRecord,
            message: errorMessage,
            details: errorDetails
          }
        }));
      }
    });

    // 处理错误数据块
    streamProcessor(errorChunk);

    // 发送错误事件通知
    EventEmitter.emit(EVENT_NAMES.STREAM_ERROR, {
      error: errorInfo,
      messageId: this.messageId,
      blockId: this.blockId,
      topicId: this.topicId
    });

    // 保存错误状态到数据库，确保错误信息完整保存
    await Promise.all([
      dexieStorage.updateMessageBlock(this.blockId, {
        type: MessageBlockType.ERROR,
        status: MessageBlockStatus.ERROR,
        content: errorMessage,
        error: errorRecord,
        message: errorMessage,
        details: errorDetails
      }),
      dexieStorage.updateMessage(this.messageId, {
        status: AssistantMessageStatus.ERROR
      })
    ]);

    // 发送消息完成事件（错误状态）
    EventEmitter.emit(EVENT_NAMES.MESSAGE_COMPLETE, {
      id: this.messageId,
      topicId: this.topicId,
      status: 'error',
      error: errorMessage
    });

    // 参考 Cline：清理工具跟踪器（错误情况）
    try {
      globalToolTracker.reset(); // 错误时重置所有状态
      console.log(`[ResponseErrorHandler] 工具跟踪器重置完成（错误处理）`);
    } catch (cleanupError) {
      console.error(`[ResponseErrorHandler] 工具跟踪器重置失败:`, cleanupError);
    }

    throw error;
  }
}
