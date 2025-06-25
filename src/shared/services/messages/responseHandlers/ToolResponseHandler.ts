import store from '../../../store';
import { dexieStorage } from '../../storage/DexieStorageService';
import { MessageBlockStatus } from '../../../types/newMessage';
import type { ToolMessageBlock } from '../../../types/newMessage';
import { newMessagesActions } from '../../../store/slices/newMessagesSlice';
import { updateOneBlock, addOneBlock } from '../../../store/slices/messageBlocksSlice';
import { ChunkType } from '../../../types/chunk';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { createToolBlock } from '../../../utils/messageUtils';

/**
 * 工具响应处理器 - 处理工具调用相关的逻辑
 */
export class ToolResponseHandler {
  private messageId: string;
  private toolCallIdToBlockIdMap = new Map<string, string>();

  constructor(messageId: string) {
    this.messageId = messageId;
  }

  /**
   * 原子性工具块操作
   */
  async atomicToolBlockOperation(toolId: string, toolBlock: any, operation: 'create' | 'update') {
    try {
      // 参考 Cline：使用事务确保原子性
      await dexieStorage.transaction('rw', [
        dexieStorage.message_blocks,
        dexieStorage.messages
      ], async () => {
        if (operation === 'create') {
          // 1. 更新映射
          this.toolCallIdToBlockIdMap.set(toolId, toolBlock.id);

          // 2. 添加到 Redux 状态
          store.dispatch(addOneBlock(toolBlock));

          // 3. 保存到数据库
          await dexieStorage.saveMessageBlock(toolBlock);

          // 4. 更新消息的 blocks 数组
          store.dispatch(newMessagesActions.upsertBlockReference({
            messageId: this.messageId,
            blockId: toolBlock.id,
            status: toolBlock.status
          }));
        }
      });

      console.log(`[ToolResponseHandler] 原子性工具块操作完成: ${operation} - toolId: ${toolId}, blockId: ${toolBlock.id}`);
    } catch (error) {
      console.error(`[ToolResponseHandler] 原子性工具块操作失败: ${operation} - toolId: ${toolId}:`, error);
      throw error;
    }
  }

  /**
   * 处理单个工具错误 - 参考 Cline 的错误处理机制
   */
  async handleSingleToolError(toolId: string, error: any) {
    try {
      const existingBlockId = this.toolCallIdToBlockIdMap.get(toolId);
      if (existingBlockId) {
        // 更新工具块状态为错误
        const errorChanges = {
          status: MessageBlockStatus.ERROR,
          error: {
            message: error.message || '工具执行失败',
            details: error.stack || error.toString()
          },
          updatedAt: new Date().toISOString()
        };

        store.dispatch(updateOneBlock({
          id: existingBlockId,
          changes: errorChanges
        }));

        await dexieStorage.updateMessageBlock(existingBlockId, errorChanges);
      }
    } catch (updateError) {
      console.error(`[ToolResponseHandler] 更新工具错误状态失败:`, updateError);
    }
  }

  /**
   * 处理工具调用进行中事件 - 参考 Cline 的稳定性机制
   */
  async handleToolProgress(chunk: { type: 'mcp_tool_in_progress'; responses: any[] }) {
    try {
      console.log(`[ToolResponseHandler] 处理工具进行中，工具数量: ${chunk.responses?.length || 0}`);

      if (!chunk.responses || chunk.responses.length === 0) {
        return;
      }

      // 参考 Cline 的顺序处理机制：逐个处理工具响应，确保稳定性
      for (const toolResponse of chunk.responses) {
        try {
          console.log(`[ToolResponseHandler] 处理工具响应: toolResponse.id=${toolResponse.id}, tool.name=${toolResponse.tool.name}, tool.id=${toolResponse.tool.id}`);

          // 参考 Cline：如果是 invoking 状态，创建新的工具块
          if (toolResponse.status === 'invoking') {
            // 检查是否已存在该工具的块（防止重复创建）
            const existingBlockId = this.toolCallIdToBlockIdMap.get(toolResponse.id);
            if (existingBlockId) {
              console.log(`[ToolResponseHandler] 工具块已存在: ${existingBlockId} (toolId: ${toolResponse.id})`);
              continue;
            }

            // 参考 Cline：标记工具开始执行
            globalToolTracker.startTool(toolResponse.id);

            const toolBlock = createToolBlock(this.messageId, toolResponse.id, {
              toolName: toolResponse.tool.name,
              arguments: toolResponse.arguments,
              status: MessageBlockStatus.PROCESSING,
              metadata: {
                rawMcpToolResponse: toolResponse,
                // 参考 Cline 添加更多元数据
                toolUseId: toolResponse.id,
                startTime: new Date().toISOString(),
                serverName: toolResponse.tool.serverName || 'unknown'
              }
            });

            console.log(`[ToolResponseHandler] 创建工具块: ${toolBlock.id} (${(toolBlock as ToolMessageBlock).toolName})`);

            // 修复：简化操作，避免复杂事务
            // 1. 更新映射
            this.toolCallIdToBlockIdMap.set(toolResponse.id, toolBlock.id);

            // 2. 添加到 Redux 状态
            store.dispatch(addOneBlock(toolBlock));

            // 3. 保存到数据库
            await dexieStorage.saveMessageBlock(toolBlock);

            // 4. 更新消息的 blocks 数组
            store.dispatch(newMessagesActions.upsertBlockReference({
              messageId: this.messageId,
              blockId: toolBlock.id,
              status: toolBlock.status
            }));

          } else {
            console.warn(`[ToolResponseHandler] 收到未处理的工具状态: ${toolResponse.status} for ID: ${toolResponse.id}`);
          }
        } catch (toolError) {
          // 参考 Cline 的错误处理：单个工具失败不影响其他工具
          console.error(`[ToolResponseHandler] 处理单个工具失败 (toolId: ${toolResponse.id}):`, toolError);
          await this.handleSingleToolError(toolResponse.id, toolError);
        }
      }
    } catch (error) {
      console.error(`[ToolResponseHandler] 处理工具进行中事件失败:`, error);
    }
  }

  /**
   * 原子性工具块更新
   */
  async atomicToolBlockUpdate(blockId: string, changes: any) {
    try {
      await dexieStorage.transaction('rw', [
        dexieStorage.message_blocks
      ], async () => {
        // 1. 更新 Redux 状态
        store.dispatch(updateOneBlock({
          id: blockId,
          changes
        }));

        // 2. 更新数据库
        await dexieStorage.updateMessageBlock(blockId, changes);
      });

      console.log(`[ToolResponseHandler] 原子性工具块更新完成: blockId: ${blockId}`);
    } catch (error) {
      console.error(`[ToolResponseHandler] 原子性工具块更新失败: blockId: ${blockId}:`, error);
      throw error;
    }
  }

  /**
   * 计算工具执行时长 - 参考 Cline 的时间跟踪
   */
  calculateToolDuration(toolId: string): number | undefined {
    try {
      const blockId = this.toolCallIdToBlockIdMap.get(toolId);
      if (!blockId) return undefined;

      const block = store.getState().messageBlocks.entities[blockId];
      if (!block?.metadata || typeof block.metadata !== 'object') return undefined;

      // 添加类型断言
      const metadata = block.metadata as Record<string, any>;
      if (!metadata.startTime) return undefined;

      const startTime = new Date(metadata.startTime).getTime();
      const endTime = new Date().getTime();
      return endTime - startTime;
    } catch (error) {
      console.error(`[ToolResponseHandler] 计算工具执行时长失败:`, error);
      return undefined;
    }
  }

  /**
   * 清理工具执行 - 参考 Cline 的清理机制
   */
  async cleanupToolExecution(toolId: string) {
    try {
      // 可以在这里添加工具执行完成后的清理逻辑
      // 例如：清理临时文件、释放资源等
      console.log(`[ToolResponseHandler] 清理工具执行: toolId: ${toolId}`);
    } catch (error) {
      console.error(`[ToolResponseHandler] 清理工具执行失败:`, error);
    }
  }

  /**
   * 处理工具调用完成事件 - 参考 Cline 的稳定性机制
   */
  async handleToolComplete(chunk: { type: 'mcp_tool_complete'; responses: any[] }) {
    try {
      console.log(`[ToolResponseHandler] 处理工具完成，工具数量: ${chunk.responses?.length || 0}`);

      if (!chunk.responses || chunk.responses.length === 0) {
        return;
      }

      // 参考 Cline 的顺序处理机制：逐个处理工具完成，确保稳定性
      for (const toolResponse of chunk.responses) {
        try {
          // 参考 Cline：直接使用 toolResponse.id 查找对应的工具块ID
          const existingBlockId = this.toolCallIdToBlockIdMap.get(toolResponse.id);

          if (toolResponse.status === 'done' || toolResponse.status === 'error') {
            if (!existingBlockId) {
              console.error(`[ToolResponseHandler] 未找到工具调用 ${toolResponse.id} 对应的工具块ID`);
              continue;
            }

            const finalStatus = toolResponse.status === 'done' ? MessageBlockStatus.SUCCESS : MessageBlockStatus.ERROR;
            const changes: any = {
              content: toolResponse.response,
              status: finalStatus,
              metadata: {
                rawMcpToolResponse: toolResponse,
                // 参考 Cline 添加完成时间
                endTime: new Date().toISOString(),
                duration: this.calculateToolDuration(toolResponse.id)
              },
              updatedAt: new Date().toISOString()
            };

            if (finalStatus === MessageBlockStatus.ERROR) {
              changes.error = {
                message: `Tool execution failed/error`,
                details: toolResponse.response
              };
            }

            console.log(`[ToolResponseHandler] 更新工具块 ${existingBlockId} (toolId: ${toolResponse.id}) 状态为 ${finalStatus}`);

            // 修复：简化更新操作，避免复杂事务

            // 1. 更新 Redux 状态
            store.dispatch(updateOneBlock({
              id: existingBlockId,
              changes
            }));

            // 2. 更新数据库
            await dexieStorage.updateMessageBlock(existingBlockId, changes);

            // 参考 Cline：标记工具执行完成
            globalToolTracker.completeTool(toolResponse.id, finalStatus === MessageBlockStatus.SUCCESS);

            // 参考 Cline：工具完成后的清理工作
            await this.cleanupToolExecution(toolResponse.id);

          } else {
            console.warn(`[ToolResponseHandler] 收到未处理的工具状态: ${toolResponse.status} for ID: ${toolResponse.id}`);
          }
        } catch (toolError) {
          // 参考 Cline 的错误处理：单个工具失败不影响其他工具
          console.error(`[ToolResponseHandler] 处理单个工具完成失败 (toolId: ${toolResponse.id}):`, toolError);

          // 修复：即使处理失败也要标记工具完成，避免无限等待
          globalToolTracker.completeTool(toolResponse.id, false);

          await this.handleSingleToolError(toolResponse.id, toolError);
        }
      }
    } catch (error) {
      console.error(`[ToolResponseHandler] 处理工具完成事件失败:`, error);
    }
  }

  /**
   * 处理基于 Chunk 事件的工具调用
   */
  async handleChunk(chunk: any) {
    try {
      switch (chunk.type) {
        case ChunkType.MCP_TOOL_IN_PROGRESS:
          console.log(`[ToolResponseHandler] 处理工具调用进行中事件`);
          await this.handleToolProgress(chunk);
          break;

        case ChunkType.MCP_TOOL_COMPLETE:
          console.log(`[ToolResponseHandler] 处理工具调用完成事件`);
          await this.handleToolComplete(chunk);
          break;

        default:
          // 其他类型的chunk由其他处理器处理
          break;
      }
    } catch (error) {
      console.error(`[ToolResponseHandler] 处理 chunk 事件失败:`, error);
      throw error;
    }
  }



  // Getter 方法
  get toolMapping() { return this.toolCallIdToBlockIdMap; }
}
