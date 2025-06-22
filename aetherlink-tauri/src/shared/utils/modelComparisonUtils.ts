import { v4 as uuidv4 } from 'uuid';
import type { ModelComparisonMessageBlock } from '../types/newMessage';
import type { ModelComboResult } from '../types/ModelCombo';
import { MessageBlockType, MessageBlockStatus, AssistantMessageStatus } from '../types/newMessage';
import store from '../store';
import { updateOneBlock, addOneBlock, messageBlocksSelectors } from '../store/slices/messageBlocksSlice';
import { newMessagesActions } from '../store/slices/newMessagesSlice';
import { dexieStorage } from '../services/storage/DexieStorageService';

/**
 * 创建模型对比消息块
 */
export function createModelComparisonBlock(
  comboResult: ModelComboResult,
  messageId: string
): ModelComparisonMessageBlock {
  return {
    id: uuidv4(),
    messageId,
    type: MessageBlockType.MULTI_MODEL,
    subType: 'comparison',
    status: MessageBlockStatus.SUCCESS,
    comboResult,
    isSelectionPending: true, // 初始状态等待用户选择
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 检查内容是否是对比结果标记
 */
export function isComparisonResult(content: string): boolean {
  return content === '__COMPARISON_RESULT__';
}

/**
 * 从推理内容中解析对比结果
 */
export function parseComparisonResult(reasoning: string): ModelComboResult | null {
  try {
    return JSON.parse(reasoning);
  } catch (error) {
    console.error('[modelComparisonUtils] 解析对比结果失败:', error);
    return null;
  }
}

/**
 * 创建选中结果的主文本块
 */
export function createSelectedResultBlock(
  selectedContent: string,
  messageId: string
): any {
  return {
    id: uuidv4(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    status: MessageBlockStatus.SUCCESS,
    content: selectedContent,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 处理用户选择结果
 * 这个函数会被调用来更新消息历史，将选中的内容作为正式回答
 */
export async function handleUserSelection(
  messageId: string,
  selectedModelId: string,
  selectedContent: string
): Promise<void> {
  try {
    // 使用静态导入的模块

    const state = store.getState();
    const allBlocks = messageBlocksSelectors.selectAll(state);

    // 找到对应的对比块
    const comparisonBlock = allBlocks.find(
      block => block.messageId === messageId &&
               'subType' in block &&
               (block as any).subType === 'comparison'
    ) as ModelComparisonMessageBlock | undefined;

    if (!comparisonBlock) {
      console.error('[modelComparisonUtils] 找不到对比块');
      return;
    }

    // 更新对比块状态
    const updatedComparisonBlock: ModelComparisonMessageBlock = {
      ...comparisonBlock,
      selectedModelId,
      selectedContent,
      isSelectionPending: false
    };

    // 更新 Redux 状态
    store.dispatch(updateOneBlock({ id: comparisonBlock.id, changes: updatedComparisonBlock }));

    // 保存对比块到数据库
    await dexieStorage.updateMessageBlock(comparisonBlock.id, updatedComparisonBlock);

    // 创建新的主文本块来显示选中的内容
    const selectedBlock = createSelectedResultBlock(selectedContent, messageId);

    // 添加到 Redux 状态
    store.dispatch(addOneBlock(selectedBlock));

    // 保存主文本块到数据库
    await dexieStorage.saveMessageBlock(selectedBlock);

    // 将新块添加到消息的blocks数组（使用最常用的方式）
    const currentMessage = store.getState().messages.entities[messageId];
    if (currentMessage) {
      const updatedBlocks = [...(currentMessage.blocks || []), selectedBlock.id];

      // 🔧 修复：同时更新 Redux 和数据库
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          blocks: updatedBlocks
        }
      }));

      // 🔧 关键修复：同步更新数据库中的消息blocks数组
      await dexieStorage.updateMessage(messageId, {
        blocks: updatedBlocks
      });

      console.log(`[modelComparisonUtils] 已更新消息 ${messageId} 的blocks数组: [${updatedBlocks.join(', ')}]`);
    } else {
      console.error(`[modelComparisonUtils] 找不到消息: ${messageId}`);
    }

    //  关键修复：更新消息本身的内容，确保消息历史正确
    // 这是其他消息块都会做的操作，确保消息内容被持久化

    //  关键：清理占位符块，停止显示"正在生成回复"
    // 查找并更新所有 UNKNOWN 类型的占位符块状态
    const placeholderBlocks = allBlocks.filter(
      block => block.messageId === messageId &&
               block.type === MessageBlockType.UNKNOWN &&
               block.status === MessageBlockStatus.PROCESSING
    );

    // 更新占位符块状态为成功，停止显示加载状态
    for (const placeholderBlock of placeholderBlocks) {
      store.dispatch(updateOneBlock({
        id: placeholderBlock.id,
        changes: {
          status: MessageBlockStatus.SUCCESS,
          updatedAt: new Date().toISOString()
        }
      }));

      // 同时更新数据库中的占位符块
      await dexieStorage.updateMessageBlock(placeholderBlock.id, {
        status: MessageBlockStatus.SUCCESS,
        updatedAt: new Date().toISOString()
      });

      console.log(`[modelComparisonUtils] 已更新占位符块状态: ${placeholderBlock.id}`);
    }

    // 更新消息状态（不包含content，因为Message类型没有content属性）
    store.dispatch(newMessagesActions.updateMessage({
      id: messageId,
      changes: {
        status: AssistantMessageStatus.SUCCESS,
        updatedAt: new Date().toISOString()
      }
    }));

    //  关键修复：重置流式状态和加载状态
    const message = await dexieStorage.getMessage(messageId);
    if (message) {
      const topicId = message.topicId;

      // 重置流式响应状态
      store.dispatch(newMessagesActions.setTopicStreaming({
        topicId,
        streaming: false
      }));

      // 重置加载状态
      store.dispatch(newMessagesActions.setTopicLoading({
        topicId,
        loading: false
      }));

      console.log(`[modelComparisonUtils] 已重置话题 ${topicId} 的流式状态和加载状态`);
    }

    //  关键：同时更新数据库中的消息状态、对话历史和版本信息
    // 使用事务确保消息和话题都被正确更新
    await dexieStorage.transaction('rw', [
      dexieStorage.messages,
      dexieStorage.topics
    ], async () => {
      // 获取消息对象
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        console.error(`[modelComparisonUtils] 找不到消息: ${messageId}`);
        return;
      }

      //  关键修复：更新消息版本的metadata，确保选中内容被保存到版本中
      let updatedVersions = message.versions || [];

      // 如果有版本信息，更新活跃版本的metadata
      if (updatedVersions.length > 0) {
        updatedVersions = updatedVersions.map(version => {
          if (version.isActive) {
            return {
              ...version,
              metadata: {
                ...version.metadata,
                content: selectedContent, // 保存选中内容到版本metadata
                selectedFromComparison: true // 标记这是从对比中选择的内容
              }
            };
          }
          return version;
        });

        console.log(`[modelComparisonUtils] 已更新活跃版本的metadata，内容长度: ${selectedContent.length}`);
      }

      // 更新 messages 表
      await dexieStorage.updateMessage(messageId, {
        status: AssistantMessageStatus.SUCCESS,
        updatedAt: new Date().toISOString(),
        versions: updatedVersions // 更新版本信息
      });

      //  关键修复：更新 topics 表中的 messages 数组，包含选中的内容
      const topic = await dexieStorage.topics.get(message.topicId);
      if (topic && topic.messages) {
        const messageIndex = topic.messages.findIndex(m => m.id === messageId);
        if (messageIndex >= 0) {
          //  关键：将选中的内容保存到对话历史中
          // 使用类型断言来处理兼容性问题，因为topics.messages可能包含旧格式的消息
          const currentMessage = topic.messages[messageIndex] as any;

          // 🔧 关键修复：获取最新的blocks数组
          const latestMessage = store.getState().messages.entities[messageId];
          const latestBlocks = latestMessage?.blocks || [];

          // 创建更新后的消息对象
          const updatedMessage = {
            ...currentMessage,
            status: AssistantMessageStatus.SUCCESS,
            updatedAt: new Date().toISOString(),
            content: selectedContent, // 添加content字段（用于对话历史）
            versions: updatedVersions, // 同步更新版本信息
            blocks: latestBlocks // 🔧 关键：同步最新的blocks数组
          };

          topic.messages[messageIndex] = updatedMessage;
          await dexieStorage.topics.put(topic);
          console.log(`[modelComparisonUtils] 已更新话题中的消息状态和内容，内容长度: ${selectedContent.length}，blocks: [${latestBlocks.join(', ')}]`);
        }
      }
    });

    console.log(`[modelComparisonUtils] 用户选择了模型 ${selectedModelId} 的回答，已完整保存到数据库和消息历史`);

  } catch (error) {
    console.error('[modelComparisonUtils] 处理用户选择失败:', error);
  }
}

/**
 * 获取对比结果的统计信息
 */
export function getComparisonStats(comboResult: ModelComboResult): {
  totalModels: number;
  successModels: number;
  errorModels: number;
  averageLatency: number;
  totalCost: number;
} {
  const totalModels = comboResult.modelResults.length;
  const successModels = comboResult.modelResults.filter(r => r.status === 'success').length;
  const errorModels = comboResult.modelResults.filter(r => r.status === 'error').length;

  const validLatencies = comboResult.modelResults
    .filter(r => r.latency && r.latency > 0)
    .map(r => r.latency!);

  const averageLatency = validLatencies.length > 0
    ? validLatencies.reduce((sum, lat) => sum + lat, 0) / validLatencies.length
    : 0;

  const totalCost = comboResult.stats.totalCost;

  return {
    totalModels,
    successModels,
    errorModels,
    averageLatency,
    totalCost
  };
}

/**
 * 格式化延迟时间
 */
export function formatLatency(latency?: number): string {
  if (!latency) return 'N/A';
  return latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`;
}

/**
 * 格式化成本
 */
export function formatCost(cost?: number): string {
  if (!cost) return 'Free';
  return `$${cost.toFixed(4)}`;
}

/**
 * 获取模型信息
 */
export function getModelInfo(modelId: string): {
  name: string;
  providerName: string;
  avatar: string;
  color: string;
} {
  try {
    // 使用静态导入的store
    const state = store.getState();
    const providers = state.settings.providers;

    for (const provider of providers) {
      const model = provider.models.find(m => m.id === modelId);
      if (model) {
        return {
          name: model.name,
          providerName: provider.name,
          avatar: provider.avatar || '',
          color: provider.color || '#1976d2'
        };
      }
    }

    return {
      name: modelId,
      providerName: 'Unknown',
      avatar: '',
      color: '#1976d2'
    };
  } catch (error) {
    console.error('[modelComparisonUtils] 获取模型信息失败:', error);
    return {
      name: modelId,
      providerName: 'Unknown',
      avatar: '',
      color: '#1976d2'
    };
  }
}
