import { dexieStorage } from './storage/DexieStorageService';
import { v4 as uuid } from 'uuid';
import store from '../store';
import { newMessagesActions } from '../store/slices/newMessagesSlice';
import { updateOneBlock } from '../store/slices/messageBlocksSlice';
import type { Message, MessageVersion } from '../types/newMessage';

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

      // 如果没有提供内容，从消息块中获取
      let versionContent = content;
      if (!versionContent) {
        versionContent = await this.getMessageContent(messageId);
      }

      if (!versionContent?.trim()) {
        console.log(`[VersionService] 内容为空，跳过版本保存`);
        return '';
      }

      // 创建版本ID
      const versionId = uuid();
      const now = new Date().toISOString();

      // 增强版本元数据，记录更多上下文信息
      const newVersion: MessageVersion = {
        id: versionId,
        messageId: messageId,
        blocks: message.blocks ? [...message.blocks] : [], // 复制块ID列表，避免引用污染
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
          timestamp: Date.now() // 记录时间戳，便于排序和清理
        }
      };

      // 获取现有版本，如果不存在则创建空数组
      const versions: MessageVersion[] = [...(message.versions || [])];
      
      // 添加新版本
      versions.push(newVersion);
      
      // 如果版本数量超过限制，清理最旧的版本
      if (versions.length > this.MAX_VERSIONS_PER_MESSAGE) {
        const versionsToKeep = versions
          .sort((a, b) => {
            // 排序规则：按创建时间降序
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeB - timeA;
          })
          .slice(0, this.MAX_VERSIONS_PER_MESSAGE);
        
        console.log(`[VersionService] 清理旧版本，从 ${versions.length} 减少到 ${versionsToKeep.length}`);
        versions.length = 0; // 清空数组
        versions.push(...versionsToKeep); // 添加要保留的版本
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
      
      // 获取版本内容
      const contentSnapshot = targetVersion.metadata?.contentSnapshot;
      if (!contentSnapshot) {
        console.error(`[VersionService] 版本 ${versionId} 没有内容快照`);
        return false;
      }

      // 在切换之前，如果是从最新版本切换到历史版本，保存当前最新内容
      if (!targetMessage.currentVersionId) {
        // 当前是最新状态，需要保存原始内容
        const currentContent = await this.getMessageContent(messageId);
        if (currentContent) {
          // 使用消息ID作为键存储原始内容
          await dexieStorage.saveSetting(`original_content_${messageId}`, currentContent);
          console.log(`[VersionService] 已保存原始内容，长度: ${currentContent.length}`);
        }
      }

      // 更新消息块内容
      const currentBlocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
      const mainTextBlock = currentBlocks.find(block => block.type === 'main_text');

      if (mainTextBlock) {
        // 创建一个新块而不是修改现有块，确保完全隔离
        const updatedBlock = {
          ...mainTextBlock,
          content: contentSnapshot as string,
          updatedAt: new Date().toISOString()
        };

        // 更新块内容
        await dexieStorage.updateMessageBlock(mainTextBlock.id, updatedBlock);

        // 同步更新 Redux 中的块
        store.dispatch(updateOneBlock({
          id: mainTextBlock.id,
          changes: {
            content: contentSnapshot,
            updatedAt: new Date().toISOString()
          }
        }));
      } else {
        console.error(`[VersionService] 找不到消息 ${messageId} 的主文本块`);
        return false;
      }

      // 更新消息的当前版本标记
      await dexieStorage.updateMessage(messageId, {
        currentVersionId: versionId
      });

      // 同步更新 Redux 状态
      store.dispatch(newMessagesActions.updateMessage({
        id: messageId,
        changes: {
          currentVersionId: versionId
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
      
      // 获取保存的原始内容（切换到历史版本前的内容）
      const originalContent = await dexieStorage.getSetting(`original_content_${messageId}`);
      
      if (!originalContent) {
        console.warn(`[VersionService] 找不到消息 ${messageId} 的原始内容备份`);
        // 如果找不到原始内容，尝试使用默认策略
        return this.fallbackToLatestContent(messageId);
      }
      
      console.log(`[VersionService] 已找到原始内容备份，长度: ${originalContent.length}`);
      
      // 更新消息块内容
      const blocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
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
        
        // 清除currentVersionId标记，表示使用当前最新内容
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
      
      // 更新消息块内容
      const blocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
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

  /**
   * 获取消息的主文本内容
   * @param messageId 消息ID
   */
  async getMessageContent(messageId: string): Promise<string> {
    try {
      const blocks = await dexieStorage.getMessageBlocksByMessageId(messageId);
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
