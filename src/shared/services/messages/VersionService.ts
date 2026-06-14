import { dexieStorage } from '../storage/DexieStorageService';
import { v4 as uuid } from 'uuid';
import store from '../../store';
import { newMessagesActions } from '../../store/slices/newMessagesSlice';
import {
  updateOneBlock,
  removeManyBlocks,
  upsertManyBlocks
} from '../../store/slices/messageBlocksSlice';
import type {
  Message,
  MessageVersion,
  MessageBlock
} from '../../types/newMessage';
import { createLogger } from '../infra/logger';
const logger = createLogger('VersionService');

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
      logger.debug(`保存当前内容为版本 - 消息ID: ${messageId}`);

      // 获取消息
      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }

      // 按 message.blocks 顺序获取块，保证版本克隆后显示顺序一致
      const messageBlocks = await dexieStorage.getMessageBlocksByIds(message.blocks || []);

      // 如果没有提供内容，从消息块中获取
      let versionContent = content;
      if (!versionContent) {
        const mainBlock = messageBlocks.find(block => block.type === 'main_text');
        versionContent = (mainBlock as any)?.content || '';
      }

      if (!versionContent?.trim()) {
        logger.debug(`内容为空，跳过版本保存`);
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

      // 克隆所有当前块，使用 version_ 前缀隔离
      const { blockIds: clonedBlockIds } = messageBlocks.length > 0
        ? await this.cloneBlocks(messageBlocks, `version_${versionId}`)
        : { blockIds: [] as string[] };

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
        
        logger.debug(`清理旧版本，从 ${versions.length} 减少到 ${versionsToKeep.length}`);
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

      logger.debug(`版本保存成功 - 版本ID: ${versionId}, 总版本数: ${versions.length}`);
      return versionId;
    } catch (error) {
      logger.error(`保存版本失败:`, error);
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
      logger.error(`手动创建版本失败:`, error);
      throw error;
    }
  }

  /**
   * 内部工具：克隆一组块并保存到 Dexie，返回新块 ID 列表。
   * clonedMessageId 用于隔离克隆块（版本块用 `version_${id}`，latest 快照用 `latest_${id}`）。
   */
  private async cloneBlocks(
    sourceBlocks: MessageBlock[],
    clonedMessageId: string
  ): Promise<{ blockIds: string[]; blocks: MessageBlock[] }> {
    const now = new Date().toISOString();
    const newBlocks: MessageBlock[] = [];
    const newIds: string[] = [];
    for (const block of sourceBlocks) {
      const newId = uuid();
      newIds.push(newId);
      newBlocks.push({ ...block, id: newId, messageId: clonedMessageId, createdAt: now, updatedAt: now });
    }
    if (newBlocks.length > 0) {
      await dexieStorage.bulkSaveMessageBlocks(newBlocks);
    }
    return { blockIds: newIds, blocks: newBlocks };
  }

  /**
   * 内部工具：删除当前块，用 sourceBlocks 的克隆替换，更新 Dexie + Redux。
   * 返回新当前块 ID 列表。
   */
  private async replaceCurrentBlocks(
    messageId: string,
    currentBlockIds: string[],
    sourceBlocks: MessageBlock[]
  ): Promise<string[]> {
    // Dexie: 删旧 + 写新（顺序无所谓，不影响 UI）
    if (currentBlockIds.length > 0) {
      await dexieStorage.deleteMessageBlocksByIds(currentBlockIds);
    }
    const { blockIds, blocks } = await this.cloneBlocks(sourceBlocks, messageId);

    // Redux: 先插入新块，再原子切换 message.blocks，最后清理旧块。
    // 这样 selector 在任何中间帧都能映射到有效块，不会出现空帧导致布局跳动。
    if (blocks.length > 0) {
      store.dispatch(upsertManyBlocks(blocks));
    }
    await dexieStorage.updateMessage(messageId, { blocks: blockIds });
    store.dispatch(newMessagesActions.updateMessage({ id: messageId, changes: { blocks: blockIds } }));
    if (currentBlockIds.length > 0) {
      store.dispatch(removeManyBlocks(currentBlockIds));
    }
    return blockIds;
  }

  // ── settings keys for latest snapshot ──
  private latestBlocksKey(messageId: string) { return `latest_blocks_${messageId}`; }
  private latestModelKey(messageId: string) { return `latest_model_${messageId}`; }

  /**
   * 重新生成前的版本处理。
   * - 正在查看最新版本：把当前内容保存为新版本（原有行为）。
   * - 正在查看历史版本：当前显示内容已存在于版本列表，不重复保存；
   *   把 latest snapshot 转正为版本（保住旧最新内容），并清除 currentVersionId，
   *   让新生成的内容成为新的最新版本。
   */
  async prepareForRegenerate(messageId: string, model?: any): Promise<void> {
    const message = await dexieStorage.getMessage(messageId);
    if (!message) return;

    if (!message.currentVersionId) {
      await this.saveCurrentAsVersion(messageId, undefined, model || message.model, 'regenerate');
      return;
    }

    // ── 正在查看历史版本 ──
    const latestBlockIds = await dexieStorage.getSetting(this.latestBlocksKey(messageId)) as string[] | null;
    let versions: MessageVersion[] = [...(message.versions || [])];

    if (latestBlockIds && latestBlockIds.length > 0) {
      const results = await dexieStorage.message_blocks.bulkGet(latestBlockIds);
      const snapshotBlocks = results.filter((b): b is MessageBlock => b !== undefined);
      const mainText = (snapshotBlocks.find(b => b.type === 'main_text') as any)?.content || '';

      if (mainText.trim()) {
        // 把 snapshot 块直接转正为版本块（改 messageId 标记，无需再克隆）
        const versionId = uuid();
        const retagged = snapshotBlocks.map(b => ({ ...b, messageId: `version_${versionId}` }));
        await dexieStorage.bulkSaveMessageBlocks(retagged);

        let snapshotModel = message.model;
        let snapshotModelId = message.modelId;
        const modelInfo = await dexieStorage.getSetting(this.latestModelKey(messageId));
        if (modelInfo) {
          try {
            const parsed = JSON.parse(modelInfo);
            snapshotModel = parsed.model ?? snapshotModel;
            snapshotModelId = parsed.modelId ?? snapshotModelId;
          } catch { /* ignore */ }
        }

        versions.push({
          id: versionId,
          messageId,
          blocks: retagged.map(b => b.id),
          createdAt: new Date().toISOString(),
          modelId: snapshotModelId,
          model: snapshotModel,
          isActive: false,
          metadata: {
            contentSnapshot: String(mainText),
            source: 'regenerate',
            timestamp: Date.now()
          }
        });
        logger.debug(`latest snapshot 已转正为版本 ${versionId}`);
      } else {
        // snapshot 没有有效内容，直接丢弃
        await dexieStorage.deleteMessageBlocksByIds(latestBlockIds);
      }
    }

    await dexieStorage.deleteSetting(this.latestBlocksKey(messageId));
    await dexieStorage.deleteSetting(this.latestModelKey(messageId));

    // 清除 currentVersionId，新生成内容将成为新的 latest
    await dexieStorage.updateMessage(messageId, {
      versions,
      currentVersionId: undefined
    });
    store.dispatch(newMessagesActions.updateMessage({
      id: messageId,
      changes: { versions, currentVersionId: undefined }
    }));
  }

  /**
   * 切换到指定版本
   */
  async switchToVersion(versionId: string): Promise<boolean> {
    try {
      logger.debug(`切换到版本 - 版本ID: ${versionId}`);

      // 查找包含该版本的消息
      const allMessages = await dexieStorage.getAllMessages();
      let targetMessage: Message | undefined;
      let targetVersion: MessageVersion | undefined;
      for (const msg of allMessages) {
        if (msg.versions) {
          const v = msg.versions.find(ver => ver.id === versionId);
          if (v) { targetMessage = msg; targetVersion = v; break; }
        }
      }
      if (!targetMessage || !targetVersion) {
        logger.error(`找不到版本 ${versionId}`);
        return false;
      }

      const messageId = targetMessage.id;

      // ── 1. 如果当前是最新版本，先保存"latest snapshot" ──
      if (!targetMessage.currentVersionId) {
        const currentBlocks = await dexieStorage.getMessageBlocksByIds(targetMessage.blocks || []);
        if (currentBlocks.length > 0) {
          const { blockIds } = await this.cloneBlocks(currentBlocks, `latest_${messageId}`);
          await dexieStorage.saveSetting(this.latestBlocksKey(messageId), blockIds);
        }
        await dexieStorage.saveSetting(this.latestModelKey(messageId), JSON.stringify({
          model: targetMessage.model || null,
          modelId: targetMessage.modelId || null
        }));
        logger.debug(`已保存 latest snapshot`);
      }

      // ── 2. 获取目标版本的块 ──
      const versionBlockIds = targetVersion.blocks || [];
      let versionBlocks: MessageBlock[] = [];
      if (versionBlockIds.length > 0) {
        const results = await dexieStorage.message_blocks.bulkGet(versionBlockIds);
        versionBlocks = results.filter((b): b is MessageBlock => b !== undefined);
      }

      // ── 3. 替换当前块 ──
      if (versionBlocks.length > 0) {
        await this.replaceCurrentBlocks(messageId, targetMessage.blocks || [], versionBlocks);
      } else {
        // 兜底：版本没有块副本（旧版本数据），用 contentSnapshot 恢复 main_text
        const contentSnapshot = targetVersion.metadata?.contentSnapshot;
        if (!contentSnapshot) {
          logger.error(`版本 ${versionId} 没有内容快照`);
          return false;
        }
        const currentBlocks = await dexieStorage.getMessageBlocksByIds(targetMessage.blocks || []);
        const mainTextBlock = currentBlocks.find(block => block.type === 'main_text');
        if (mainTextBlock) {
          await dexieStorage.updateMessageBlock(mainTextBlock.id, { content: contentSnapshot, updatedAt: new Date().toISOString() });
          store.dispatch(updateOneBlock({ id: mainTextBlock.id, changes: { content: contentSnapshot, updatedAt: new Date().toISOString() } }));
        } else {
          logger.error(`找不到消息 ${messageId} 的主文本块`);
          return false;
        }
      }

      // ── 4. 更新 currentVersionId 和模型 ──
      const versionModel = targetVersion.model || null;
      const resolvedModelId = targetVersion.modelId || versionModel?.id || targetMessage.modelId;

      await dexieStorage.updateMessage(messageId, {
        currentVersionId: versionId,
        model: versionModel || targetMessage.model,
        modelId: resolvedModelId
      });
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          currentVersionId: versionId,
          model: versionModel || targetMessage.model,
          modelId: resolvedModelId
        }
      }));

      logger.debug(`版本切换成功 - 版本ID: ${versionId}`);
      return true;
    } catch (error) {
      logger.error(`切换版本失败:`, error);
      return false;
    }
  }

  /**
   * 切换到最新版本（当前编辑状态）
   */
  async switchToLatest(messageId: string): Promise<boolean> {
    try {
      logger.debug(`切换到最新版本 - 消息ID: ${messageId}`);

      const message = await dexieStorage.getMessage(messageId);
      if (!message) {
        throw new Error(`消息 ${messageId} 不存在`);
      }
      if (!message.currentVersionId) {
        return true; // 已经是最新
      }

      // ── 1. 获取 latest snapshot 块 ──
      const latestBlockIds = await dexieStorage.getSetting(this.latestBlocksKey(messageId)) as string[] | null;
      let latestBlocks: MessageBlock[] = [];
      if (latestBlockIds && latestBlockIds.length > 0) {
        const results = await dexieStorage.message_blocks.bulkGet(latestBlockIds);
        latestBlocks = results.filter((b): b is MessageBlock => b !== undefined);
      }

      if (latestBlocks.length > 0) {
        // ── 2. 用 latest snapshot 替换当前块 ──
        await this.replaceCurrentBlocks(messageId, message.blocks || [], latestBlocks);
      } else {
        logger.warn(`没有 latest snapshot 块，保留当前块`);
        // 没有 snapshot（可能旧数据），不改块，只清 currentVersionId
      }

      // ── 3. 恢复模型 ──
      let restoredModel = message.model;
      let restoredModelId = message.modelId;
      const modelInfo = await dexieStorage.getSetting(this.latestModelKey(messageId));
      if (modelInfo) {
        try {
          const parsed = JSON.parse(modelInfo);
          restoredModel = parsed.model ?? message.model;
          restoredModelId = parsed.modelId ?? message.modelId;
        } catch { /* ignore */ }
      }

      // ── 4. 清除 currentVersionId ──
      await dexieStorage.updateMessage(messageId, {
        currentVersionId: undefined,
        model: restoredModel,
        modelId: restoredModelId
      });
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          currentVersionId: undefined,
          model: restoredModel,
          modelId: restoredModelId
        }
      }));

      // ── 5. 清理 snapshot 数据 ──
      if (latestBlockIds && latestBlockIds.length > 0) {
        await dexieStorage.deleteMessageBlocksByIds(latestBlockIds);
      }
      await dexieStorage.deleteSetting(this.latestBlocksKey(messageId));
      await dexieStorage.deleteSetting(this.latestModelKey(messageId));

      logger.debug(`已切换到最新版本`);
      return true;
    } catch (error) {
      logger.error(`切换到最新版本失败:`, error);
      return false;
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
      logger.error(`获取消息内容失败:`, error);
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
      logger.error(`获取消息版本信息失败:`, error);
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
        logger.error(`找不到包含版本 ${versionId} 的消息`);
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
      
      logger.debug(`成功删除版本 ${versionId}`);
      return true;
    } catch (error) {
      logger.error(`删除版本失败:`, error);
      return false;
    }
  }
}

export const versionService = new VersionService();
