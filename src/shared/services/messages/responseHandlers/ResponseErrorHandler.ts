import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../../infra/EventService';
import { createStreamProcessor } from '../StreamProcessingService';
import { MessageBlockStatus, AssistantMessageStatus, MessageBlockType } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import type { ErrorInfo } from '../../../store/slices/newMessagesSlice';
import { formatErrorMessage, getErrorType, serializeError, getErrorDetails } from '../../../utils/error';
import { updateOneBlock } from '../../../store/slices/messageBlocksSlice';
import type { Chunk } from '../../../types/chunk';
import { ChunkType } from '../../../types/chunk';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { checkAndHandleApiKeyError } from '../../../utils/apiKeyErrorHandler';
import { finalizeNonTerminalBlocks } from './blockFinalization';
import { messageBlockRepository } from '../MessageBlockRepository';
import { AISDKError } from 'ai';
import type { AiSdkErrorUnion } from '../../../types/error';

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
    console.error(`[ResponseErrorHandler] 响应失败 - 消息ID: ${this.messageId}, 错误:`, error);

    // 新增：检测 API Key 问题并提供重试机制
    // 注意：现在 checkAndHandleApiKeyError 返回 false，让我们继续创建错误块
    await checkAndHandleApiKeyError(error, this.messageId, this.topicId);

    // 获取错误消息
    let errorMessage = error.message || '响应处理失败';
    
    // 检测 reasoningEffort 参数不支持的错误，提供友好提示
    if (errorMessage.includes('does not support parameter reasoningEffort') || 
        errorMessage.includes('does not support parameter reasoning_effort')) {
      errorMessage = `${errorMessage}\n\n💡 解决方案：此模型不支持思考功能，请在设置中将「思维链长度」设置为「关闭思考」，或选择支持推理的模型。`;
    }

    // 获取错误类型
    const errorType = getErrorType(error);

    // 获取错误详情
    const errorDetails = formatErrorMessage(error);

    // 创建错误记录对象 - 序列化 AI SDK 错误
    let errorRecord: Record<string, any>;
    
    // 检查是否为 AI SDK 错误并序列化
    if (AISDKError.isInstance(error)) {
      console.log('[ResponseErrorHandler] 检测到 AI SDK 错误，进行序列化');
      errorRecord = serializeError(error as AiSdkErrorUnion);
    } else {
      // 普通错误，获取详细信息
      errorRecord = getErrorDetails(error);
    }

    // 确保基本字段存在
    errorRecord.message = errorMessage;
    errorRecord.timestamp = new Date().toISOString();
    errorRecord.code = error.name || 'ERROR';
    errorRecord.type = errorType;

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
      messageBlockRepository.updateBlock(this.blockId, {
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

    // 收尾不变量：错误时错误块已置 ERROR，其余非终态块（如思考块）一并结掉，
    // 避免出错后思考计时仍在跑
    await finalizeNonTerminalBlocks(this.messageId, {
      now: new Date().toISOString(),
      skipBlockIds: [this.blockId]
    });

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
