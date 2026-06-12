import { dexieStorage } from '../storage/DexieStorageService';
import { v4 as uuid } from 'uuid';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import {
  updateOneBlock,
  removeManyBlocks,
  upsertOneBlock,
  upsertManyBlocks
} from '../../store/slices/messageBlocksSlice';
import type {
  Message,
  MessageVersion,
  MessageBlock,
  MessageBlockStatus
} from '../../types/newMessage';

/**
 * 优化的版本管理服务
 * 核心功能增强：
 * 1. 多入口版本创建 - 支持多种场景下创建版本
 * 2. 可靠版本切换 - 增强版本切换的可靠性和容错性
 * 3. 版本容量管理 - 自动限制版本数量，避免无限增长
 * 4. 版本元数据增强 - 记录更多版本上下文信息
 */
class VersionService {
  // 最大版本数量限制，超过此数量将自动清理最旧的版本
  private MAX_VERSIONS_PER_MESSAGE = 20;

  /**
   * 保存当前消息内容为新版本
   * @param messageId 消息ID
   * @param content 要保存的内容（如果不提供，则从消息块中获取）
   * @param model 模型信息
   * @param source 版本来源，如'regenerate'、'manual'等
   */
  async saveCurrentAsVersion(
    messageId: string,
    content?: string,
    model?: any,
    source: string = 'regenerate'
  ): Promise<string> {
    try {
      console.log(`[VersionService] 保存当前内容为版本 - 消息ID: ${messageId}`);

      // 获取消息
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }

      const messageBlocks = await dexieStorage.getMessageBlocksByMessageId(messageId);

      // 如果没有提供内容，从消息块中获取
      let versionContent = content;
      if (!versionContent) {
        const mainBlock = messageBlocks.find(block => block.type === 'main_text');
        versionContent = (mainBlock as any)?.content || '';
      }

      if (!versionContent?.trim()) {
        console.log(`[VersionService] 内容为空，跳过版本保存`);
        return '';
      }

      const thinkingBlock = messageBlocks.find(block => block.type === 'thinking');
      const thinkingSnapshot = thinkingBlock
        ? {
            content: (thinkingBlock as any).content ?? '',
            metadata: thinkingBlock.metadata ?? null,
            thinking_millsec: (thinkingBlock as any).thinking_millsec ?? null,
            status: thinkingBlock.status ?? 'success'
          }
        : null;

      // 创建版本ID
      const versionId = uuid();
      const now = new Date().toISOString();

      // 克隆所有当前块，生成独立的块副本供版本持有
      // 使用 version_ 前缀的 messageId 隔离版本块，防止 getMessageBlocksByMessageId 误删
      const clonedBlockIds: string[] = [];
      if (messageBlocks.length > 0) {
        const clonedBlocks: MessageBlock[] = messageBlocks.map(block => {
          const newBlockId = uuid();
          clonedBlockIds.push(newBlockId);
          return {
            ...block,
            id: newBlockId,
            messageId: `version_${versionId}`,
            createdAt: now,
            updatedAt: now
          };
        });
        await dexieStorage.bulkSaveMessageBlocks(clonedBlocks);
      }

      // 增强版本元数据，记录更多上下文信息
      const newVersion: MessageVersion = {
        id: versionId,
        messageId: messageId,
        blocks: clonedBlockIds, // 使用克隆的块ID，与当前块完全独立
        createdAt: now,
        modelId: model?.id || message.modelId,
        model: model || message.model,
        isActive: false,
        metadata: {
          contentSnapshot: String(versionContent), // 强制创建新字符串，避免引用
          originalContent: String(versionContent), // 备份内容
          source: source, // 记录版本来源
          previousVersionId: message.currentVersionId, // 记录切换前的版本ID，方便回溯
          tokenCount: message.metrics && 'tokenCount' in message.metrics ? message.metrics.tokenCount : undefined, // 记录token数量
          timestamp: Date.now(), // 记录时间戳，便于排序和清理
          hasThinkingBlock: Boolean(thinkingSnapshot),
          thinkingSnapshot: thinkingSnapshot
        }
      };

      // 获取现有版本，如果不存在则创建空数组
      const versions: MessageVersion[] = [...(message.versions || [])];
      
      // 添加新版本
      versions.push(newVersion);
      
      // 如果版本数量超过限制，清理最旧的版本及其克隆块
      if (versions.length > this.MAX_VERSIONS_PER_MESSAGE) {
        const sorted = [...versions].sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        const versionsToKeep = sorted.slice(0, this.MAX_VERSIONS_PER_MESSAGE);
        const versionsToRemove = sorted.slice(this.MAX_VERSIONS_PER_MESSAGE);

        // 删除被淘汰版本持有的克隆块
        const blockIdsToDelete = versionsToRemove.flatMap(v => v.blocks || []);
        if (blockIdsToDelete.length > 0) {
          await dexieStorage.deleteMessageBlocksByIds(blockIdsToDelete);
        }
        
        console.log(`[VersionService] 清理旧版本，从 ${versions.length} 减少到 ${versionsToKeep.length}`);
        versions.length = 0;
        versions.push(...versionsToKeep);
      }

      // 更新消息
      await dexieStorage.updateMessage(messageId, {
        versions: versions
      });

      // 同步更新 Redux 状态
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          versions: versions
        }
      }));

      console.log(`[VersionService] 版本保存成功 - 版本ID: ${versionId}, 总版本数: ${versions.length}`);
      return versionId;
    } catch (error) {
      console.error(`[VersionService] 保存版本失败:`, error);
      throw error;
    }
  }

  /**
   * 手动创建版本 - 用于用户主动保存当前内容
   * @param messageId 消息ID
   */
  async createManualVersion(messageId: string): Promise<string> {
    try {
      const content = await this.getMessageContent(messageId);
      const message = await dexieStorage.getMessage(messageId);
      
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }
      
      return this.saveCurrentAsVersion(messageId, content, message.model, 'manual');
    } catch (error) {
      console.error(`[VersionService] 手动创建版本失败:`, error);
      throw error;
    }
  }

  /**
   * 切换到指定版本
   * @param versionId 要切换到的版本ID
   * @returns 切换结果，成功返回true，失败返回false
   */
  async switchToVersion(versionId: string): Promise<boolean> {
    try {
      console.log(`[VersionService] 切换到版本 - 版本ID: ${versionId}`);
      
      // 查找包含该版本的消息
      const allMessages = await dexieStorage.getAllMessages();
      let targetMessage: Message | undefined;
      let targetVersion: MessageVersion | undefined;

      for (const message of allMessages) {
        if (message.versions) {
          const version = message.versions.find(v => v.id === versionId);
          if (version) {
            targetMessage = message;
            targetVersion = version;
            break;
          }
        }
      }

      if (!targetMessage || !targetVersion) {
        console.error(`[VersionService] 找不到版本 ${versionId}`);
        return false;
      }

      const messageId = targetMessage.id;
      const originalContentKey = `original_content_${messageId}`;
      const originalModelKey = `original_model_${messageId}`;
      const originalThinkingKey = `original_thinking_blocks_${messageId}`;
      const originalBlockOrderKey = `original_block_order_${messageId}`;
      const currentBlocks = await dexieStorage.getMessageBlocksByIds(targetMessage.blocks || []);
      const thinkingBlocks = currentBlocks.filter(block => block.type === 'thinking');
      
      // 获取版本内容
      const contentSnapshot = targetVersion.metadata?.contentSnapshot;
      if (!contentSnapshot) {
        console.error(`[VersionService] 版本 ${versionId} 没有内容快照`);
        return false;
      }

      // 在切换之前，如果是从最新版本切换到历史版本，保存当前最新内容和模型信息
      if (!targetMessage.currentVersionId) {
        // 当前是最新状态，需要保存原始内容
        const currentContent = await this.getMessageContent(messageId);
        if (currentContent) {
          await dexieStorage.saveSetting(originalContentKey, currentContent);
          console.log(`[VersionService] 已保存原始内容，长度: ${currentContent.length}`);
        }

        // 记录原始模型信息以便返回时恢复
        await dexieStorage.saveSetting(
          originalModelKey,
          JSON.stringify({
            model: targetMessage.model || null,
            modelId: targetMessage.modelId || null
          })
        );

        if (thinkingBlocks.length > 0) {
          await dexieStorage.saveSetting(originalThinkingKey, thinkingBlocks);
        } else {
          await dexieStorage.deleteSetting(originalThinkingKey);
        }

        if (targetMessage.blocks?.length) {
          await dexieStorage.saveSetting(originalBlockOrderKey, targetMessage.blocks);
        } else {
          await dexieStorage.deleteSetting(originalBlockOrderKey);
        }
      }

      // 尝试从版本的克隆块恢复完整内容（包括工具块、图片块等）
      const versionBlockIds = targetVersion.blocks || [];
      let versionBlocks: MessageBlock[] = [];
      if (versionBlockIds.length > 0) {
        const results = await dexieStorage.message_blocks.bulkGet(versionBlockIds);
        versionBlocks = results.filter((b): b is MessageBlock => b !== undefined);
      }

      if (versionBlocks.length > 0) {
        // 版本有独立的块副本：删除当前块，用版本块替换
        if (currentBlocks.length > 0) {
          const currentBlockIds = currentBlocks.map(b => b.id);
          await dexieStorage.deleteMessageBlocksByIds(currentBlockIds);
          store.dispatch(removeManyBlocks(currentBlockIds));
        }

        // 克隆版本块为新的当前块（保留版本块不动，供再次切换）
        const newCurrentBlocks: MessageBlock[] = [];
        const newCurrentBlockIds: string[] = [];
        for (const block of versionBlocks) {
          const newId = uuid();
          newCurrentBlockIds.push(newId);
          newCurrentBlocks.push({ ...block, id: newId, messageId, updatedAt: new Date().toISOString() });
        }
        await dexieStorage.bulkSaveMessageBlocks(newCurrentBlocks);
        store.dispatch(upsertManyBlocks(newCurrentBlocks));

        // 更新消息的 blocks 列表
        await dexieStorage.updateMessage(messageId, { blocks: newCurrentBlockIds });
        store.dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: { blocks: newCurrentBlockIds }
        }));
      } else {
        // 兜底：版本没有块副本（旧版本数据），用 contentSnapshot 恢复 main_text
        const mainTextBlock = currentBlocks.find(block => block.type === 'main_text');
        if (mainTextBlock) {
          const updatedBlock = {
            ...mainTextBlock,
            content: contentSnapshot as string,
            updatedAt: new Date().toISOString()
          };
          await dexieStorage.updateMessageBlock(mainTextBlock.id, updatedBlock);
          store.dispatch(updateOneBlock({
            id: mainTextBlock.id,
            changes: { content: contentSnapshot, updatedAt: new Date().toISOString() }
          }));
        } else {
          console.error(`[VersionService] 找不到消息 ${messageId} 的主文本块`);
          return false;
        }

        const thinkingSnapshot = (targetVersion.metadata as any)?.thinkingSnapshot;
        await this.applyThinkingSnapshot({
          messageId,
          targetMessage,
          thinkingBlocks,
          thinkingSnapshot
        });
      }

      const versionModel = targetVersion.model || null;
      const resolvedModelId = targetVersion.modelId
        || versionModel?.id
        || targetMessage.modelId;

      // 更新消息的当前版本标记与模型
      await dexieStorage.updateMessage(messageId, {
        currentVersionId: versionId,
        model: versionModel || targetMessage.model,
        modelId: resolvedModelId
      });

      // 同步更新 Redux 状态
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          currentVersionId: versionId,
          model: versionModel || targetMessage.model,
          modelId: resolvedModelId
        }
      }));

      console.log(`[VersionService] 版本切换成功 - 版本ID: ${versionId}`);
      return true;
    } catch (error) {
      console.error(`[VersionService] 切换版本失败:`, error);
      return false;
    }
  }

  /**
   * 切换到最新版本（当前编辑状态）
   * @param messageId 消息ID
   */
  async switchToLatest(messageId: string): Promise<boolean> {
    try {
      console.log(`[VersionService] 切换到最新版本 - 消息ID: ${messageId}`);
      
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }
      
      // 如果已经是最新版本，无需切换
      if (!message.currentVersionId) {
        return true;
      }
      
      const originalContentKey = `original_content_${messageId}`;
      const originalModelKey = `original_model_${messageId}`;
      const originalThinkingKey = `original_thinking_blocks_${messageId}`;
      const originalBlockOrderKey = `original_block_order_${messageId}`;

      // 获取保存的原始内容（切换到历史版本前的内容）
      const originalContent = await dexieStorage.getSetting(originalContentKey);
      const originalModelInfo = await dexieStorage.getSetting(originalModelKey);
      const originalThinkingBlocks = await dexieStorage.getSetting(originalThinkingKey) as MessageBlock[] | null;
      const originalBlockOrder = await dexieStorage.getSetting(originalBlockOrderKey) as string[] | null;
      let originalModelData: { model?: Message['model']; modelId?: string | null } | null = null;

      if (originalModelInfo) {
        try {
          originalModelData = JSON.parse(originalModelInfo);
        } catch (error) {
          console.warn('[VersionService] 原始模型信息解析失败:', error);
        }
      }
      
      if (!originalContent) {
        console.warn(`[VersionService] 找不到消息 ${messageId} 的原始内容备份`);
        // 如果找不到原始内容，尝试使用默认策略
        return this.fallbackToLatestContent(messageId);
      }
      
      console.log(`[VersionService] 已找到原始内容备份，长度: ${originalContent.length}`);
      
      // 更新消息块内容（只获取消息自身引用的块，避免误取版本克隆块）
      const blocks = await dexieStorage.getMessageBlocksByIds(message.blocks || []);
      const mainTextBlock = blocks.find(block => block.type === 'main_text');
      
      if (mainTextBlock) {
        // 创建一个新块而不是修改现有块，确保完全隔离
        const updatedBlock = {
          ...mainTextBlock,
          content: originalContent,
          updatedAt: new Date().toISOString()
        };
        
        // 更新块内容
        await dexieStorage.updateMessageBlock(mainTextBlock.id, updatedBlock);
        
        // 同步更新Redux中的块
        store.dispatch(updateOneBlock({
          id: mainTextBlock.id,
          changes: {
            content: originalContent,
            updatedAt: new Date().toISOString()
          }
        }));
        
        const existingThinkingBlocks = blocks.filter(block => block.type === 'thinking');

        if (originalThinkingBlocks && originalThinkingBlocks.length > 0) {
        if (existingThinkingBlocks.length > 0) {
          const removeIds = existingThinkingBlocks.map(block => block.id);
          await dexieStorage.deleteMessageBlocksByIds(removeIds);
          store.dispatch(removeManyBlocks(removeIds));
        }

          await dexieStorage.message_blocks.bulkPut(originalThinkingBlocks);
          store.dispatch(upsertManyBlocks(originalThinkingBlocks));
        } else if (existingThinkingBlocks.length > 0) {
          const removeIds = existingThinkingBlocks.map(block => block.id);
          await dexieStorage.deleteMessageBlocksByIds(removeIds);
          store.dispatch(removeManyBlocks(removeIds));
        }

        const restoredModel = originalModelData?.model ?? message.model;
        const restoredModelId = originalModelData?.modelId ?? message.modelId;
        const restoredBlockOrder = Array.isArray(originalBlockOrder) ? originalBlockOrder : (message.blocks || []);

        await dexieStorage.updateMessage(messageId, {
          currentVersionId: undefined,
          model: restoredModel,
          modelId: restoredModelId,
          blocks: restoredBlockOrder
        });

        // 同步更新Redux状态
        store.dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: {
            currentVersionId: undefined,
            model: restoredModel,
            modelId: restoredModelId,
            blocks: restoredBlockOrder
          }
        }));

        // 清理缓存
        await dexieStorage.deleteSetting(originalContentKey);
        await dexieStorage.deleteSetting(originalModelKey);
        await dexieStorage.deleteSetting(originalThinkingKey);
        await dexieStorage.deleteSetting(originalBlockOrderKey);

        console.log(`[VersionService] 已切换到最新版本，使用原始内容`);
        return true;
      } else {
        console.error(`[VersionService] 找不到消息 ${messageId} 的主文本块`);
        return false;
      }
    } catch (error) {
      console.error(`[VersionService] 切换到最新版本失败:`, error);
      return this.fallbackToLatestContent(messageId);
    }
  }
  
  /**
   * 当找不到原始内容备份时的后备策略
   * @param messageId 消息ID
   * @private
   */
  private async fallbackToLatestContent(messageId: string): Promise<boolean> {
    try {
      console.log(`[VersionService] 使用后备策略恢复最新内容 - 消息ID: ${messageId}`);
      
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }
      
      // 尝试多种方法获取可能的最新内容
      let latestContent = '';
      
      // 1. 尝试使用未被选择版本中最新的一个版本的原始内容
      if (message.versions && message.versions.length > 0) {
        // 排除当前选中的版本
        const otherVersions = message.versions.filter(v => v.id !== message.currentVersionId);
        
        if (otherVersions.length > 0) {
          // 按创建时间降序排序
          const sortedVersions = [...otherVersions].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // 使用最新版本的原始内容
          for (const version of sortedVersions) {
            if (version.metadata?.originalContent) {
              latestContent = version.metadata.originalContent as string;
              console.log(`[VersionService] 使用最新版本(ID: ${version.id})的原始内容，长度: ${latestContent.length}`);
              break;
            }
          }
        }
      }
      
      // 2. 如果还没找到，尝试使用当前显示版本的原始内容
      if (!latestContent && message.currentVersionId && message.versions) {
        const currentVersion = message.versions.find(v => v.id === message.currentVersionId);
        if (currentVersion?.metadata?.originalContent) {
          latestContent = currentVersion.metadata.originalContent as string;
          console.log(`[VersionService] 使用当前版本的原始内容，长度: ${latestContent.length}`);
        }
      }
      
      // 3. 如果还是没找到，使用当前块内容
      if (!latestContent) {
        latestContent = await this.getMessageContent(messageId);
        console.log(`[VersionService] 使用当前块内容，长度: ${latestContent.length}`);
      }
      
      // 没有找到任何可用内容，返回失败
      if (!latestContent) {
        console.error(`[VersionService] 找不到任何可用内容`);
        return false;
      }
      
      // 更新消息块内容（只获取消息自身引用的块）
      const msg = await dexieStorage.getMessage(messageId);
      const blocks = await dexieStorage.getMessageBlocksByIds(msg?.blocks || []);
      const mainTextBlock = blocks.find(block => block.type === 'main_text');
      
      if (mainTextBlock) {
        // 更新块内容
        await dexieStorage.updateMessageBlock(mainTextBlock.id, {
          content: latestContent,
          updatedAt: new Date().toISOString()
        });
        
        // 同步更新Redux中的块
        store.dispatch(updateOneBlock({
          id: mainTextBlock.id,
          changes: {
            content: latestContent,
            updatedAt: new Date().toISOString()
          }
        }));
        
        // 清除currentVersionId标记
        await dexieStorage.updateMessage(messageId, {
          currentVersionId: undefined
        });

        // 同步更新Redux状态
        store.dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: {
            currentVersionId: undefined
          }
        }));

        // 保存当前内容作为原始内容备份
        await dexieStorage.saveSetting(`original_content_${messageId}`, latestContent);
        
        console.log(`[VersionService] 后备策略恢复成功`);
        return true;
      } else {
        console.error(`[VersionService] 找不到消息 ${messageId} 的主文本块`);
        return false;
      }
    } catch (error) {
      console.error(`[VersionService] 后备策略恢复失败:`, error);
      return false;
    }
  }

  private async applyThinkingSnapshot(params: {
    messageId: string;
    targetMessage: Message;
    thinkingBlocks: MessageBlock[];
    thinkingSnapshot?: {
      content?: string;
      metadata?: Record<string, any> | null;
      thinking_millsec?: number | null;
      status?: MessageBlockStatus;
    };
  }): Promise<void> {
    const { messageId, targetMessage, thinkingBlocks, thinkingSnapshot } = params;
    const currentOrder = Array.isArray(targetMessage.blocks) ? [...targetMessage.blocks] : [];

    if (thinkingSnapshot && typeof thinkingSnapshot.content === 'string') {
      const existingBlock = thinkingBlocks[0];
      const extraBlocks = thinkingBlocks.slice(1);
      const now = new Date().toISOString();
      const newContent = thinkingSnapshot.content ?? '';

      if (existingBlock) {
        const newStatus: MessageBlockStatus | undefined =
          thinkingSnapshot.status ?? (existingBlock.status as MessageBlockStatus | undefined);

        const changes: Partial<MessageBlock> = {
          type: 'thinking',
          content: newContent,
          metadata: thinkingSnapshot.metadata ?? existingBlock.metadata,
          updatedAt: now,
          status: newStatus,
          thinking_millsec:
            thinkingSnapshot.thinking_millsec ?? (existingBlock as any)?.thinking_millsec ?? null
        };

        await dexieStorage.updateMessageBlock(existingBlock.id, changes);

        store.dispatch(updateOneBlock({
          id: existingBlock.id,
          changes
        }));

        if (extraBlocks.length > 0) {
          const extraIds = extraBlocks.map(block => block.id);
          await dexieStorage.deleteMessageBlocksByIds(extraIds);
          store.dispatch(removeManyBlocks(extraIds));
        }
      } else {
        const newBlock: MessageBlock = {
          id: uuid(),
          messageId,
          type: 'thinking',
          content: newContent,
          metadata: thinkingSnapshot.metadata ?? {},
          createdAt: now,
          updatedAt: now,
          status: thinkingSnapshot.status || 'success',
          thinking_millsec: thinkingSnapshot.thinking_millsec ?? null
        } as MessageBlock;

        await dexieStorage.message_blocks.put(newBlock);
        store.dispatch(upsertOneBlock(newBlock));

        const updatedOrder = [...currentOrder, newBlock.id];
        await dexieStorage.updateMessage(messageId, { blocks: updatedOrder });
        store.dispatch(newMessagesActions.updateMessage({
          id: messageId,
          changes: { blocks: updatedOrder }
        }));
      }

      return;
    }

    if (thinkingBlocks.length > 0) {
      const thinkingIds = thinkingBlocks.map(block => block.id);
      await dexieStorage.deleteMessageBlocksByIds(thinkingIds);
      store.dispatch(removeManyBlocks(thinkingIds));

      const updatedOrder = currentOrder.filter(id => !thinkingIds.includes(id));
      await dexieStorage.updateMessage(messageId, { blocks: updatedOrder });
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: { blocks: updatedOrder }
      }));
    }
  }

  /**
   * 获取消息的主文本内容
   * @param messageId 消息ID
   */
  async getMessageContent(messageId: string): Promise<string> {
    try {
      const message = await dexieStorage.getMessage(messageId);
      if (!message) return '';
      const blocks = await dexieStorage.getMessageBlocksByIds(message.blocks || []);
      const mainTextBlock = blocks.find(block => block.type === 'main_text');
      return (mainTextBlock as any)?.content || '';
    } catch (error) {
      console.error(`[VersionService] 获取消息内容失败:`, error);
      return '';
    }
  }
  
  /**
   * 获取消息的所有版本信息
   * @param messageId 消息ID
   */
  async getMessageVersions(messageId: string): Promise<{
    versions: MessageVersion[];
    currentVersionId?: string;
  }> {
    try {
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }
      
      return {
        versions: message.versions || [],
        currentVersionId: message.currentVersionId
      };
    } catch (error) {
      console.error(`[VersionService] 获取消息版本信息失败:`, error);
      return { versions: [] };
    }
  }
  
  /**
   * 删除指定的版本
   * @param versionId 要删除的版本ID
   */
  async deleteVersion(versionId: string): Promise<boolean> {
    try {
      // 查找包含该版本的消息
      const allMessages = await dexieStorage.getAllMessages();
      let targetMessage: Message | undefined;
      
      for (const message of allMessages) {
        if (message.versions?.some(v => v.id === versionId)) {
          targetMessage = message;
          break;
        }
      }
      
      if (!targetMessage) {
        console.error(`[VersionService] 找不到包含版本 ${versionId} 的消息`);
        return false;
      }
      
      // 如果正在显示要删除的版本，先切换到最新版本
      if (targetMessage.currentVersionId === versionId) {
        await this.switchToLatest(targetMessage.id);
      }
      
      // 删除版本持有的克隆块
      const versionToDelete = targetMessage.versions?.find(v => v.id === versionId);
      if (versionToDelete?.blocks && versionToDelete.blocks.length > 0) {
        await dexieStorage.deleteMessageBlocksByIds(versionToDelete.blocks);
      }

      // 更新版本列表，移除指定版本
      const updatedVersions = (targetMessage.versions || []).filter(v => v.id !== versionId);
      
      // 更新消息
      await dexieStorage.updateMessage(targetMessage.id, {
        versions: updatedVersions
      });
      
      // 同步更新Redux状态
      store.dispatch(newMessagesActions.updateMessage({
        id: targetMessage.id,
        changes: {
          versions: updatedVersions
        }
      }));
      
      console.log(`[VersionService] 成功删除版本 ${versionId}`);
      return true;
    } catch (error) {
      console.error(`[VersionService] 删除版本失败:`, error);
      return false;
    }
  }
}

export const versionService = new VersionService();
