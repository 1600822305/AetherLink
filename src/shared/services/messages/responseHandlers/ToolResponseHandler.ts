import store from '../../../store';
import { MessageBlockStatus } from '../../../types/newMessage';
import type { ToolMessageBlock, WebSearchReferenceItem } from '../../../types/newMessage';
import { ChunkType } from '../../../types/chunk';
import { globalToolTracker } from '../../../utils/toolExecutionSync';
import { createToolBlock, createCitationBlock } from '../../../utils/messageUtils';
// callMCPTool 不再需要 - 工具执行由 Provider 层统一处理
import type { MCPTool } from '../../../types';
import { messageBlockRepository } from '../MessageBlockRepository';
import { createLogger } from '../../infra/logger';
const logger = createLogger('ToolResponseHandler');

/**
 * 检查是否是 attempt_completion 工具（支持带前缀的名称）
 */
function isAttemptCompletionTool(toolName: string): boolean {
  return toolName === 'attempt_completion' || toolName.endsWith('-attempt_completion');
}

/**
 * 解析 attempt_completion 的结果
 */
function parseAttemptCompletionResult(response: any): { result: string; command?: string } | null {
  try {
    let content: any = response;
    
    // 如果是字符串，尝试解析 JSON
    if (typeof response === 'string') {
      try {
        content = JSON.parse(response);
      } catch {
        return { result: response };
      }
    }
    
    // 检查是否有 __agentic_completion__ 标记
    if (content?.__agentic_completion__) {
      return {
        result: content.result || '任务已完成',
        command: content.command
      };
    }
    
    // 直接返回 result 字段
    if (content?.result) {
      return {
        result: content.result,
        command: content.command
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 工具响应处理器
 * 
 * 参考项目设计：统一处理工具调用事件
 * - MCP_TOOL_IN_PROGRESS: 工具开始执行，创建 UI 块
 * - MCP_TOOL_COMPLETE: 工具执行完成，更新 UI 块状态
 * 
 * 工具执行统一由 Provider 层的 parseAndCallTools 处理
 */
export class ToolResponseHandler {
  private messageId: string;
  private toolCallIdToBlockIdMap = new Map<string, string>();

  constructor(messageId: string, _mcpTools: MCPTool[] = []) {
    this.messageId = messageId;
    // mcpTools 参数保留以保持接口兼容，但不再使用
  }

  /**
   * 原子性工具块操作
   */
  async atomicToolBlockOperation(toolId: string, toolBlock: any, operation: 'create' | 'update') {
    try {
      if (operation === 'create') {
        this.toolCallIdToBlockIdMap.set(toolId, toolBlock.id);
        await messageBlockRepository.createBlockAndAttach(toolBlock);
      }

      logger.debug(`原子性工具块操作完成: ${operation} - toolId: ${toolId}, blockId: ${toolBlock.id}`);
    } catch (error) {
      logger.error(`原子性工具块操作失败: ${operation} - toolId: ${toolId}:`, error);
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

        await messageBlockRepository.updateBlock(existingBlockId, errorChanges);
      }
    } catch (updateError) {
      logger.error(`更新工具错误状态失败:`, updateError);
    }
  }

  /**
   * 处理工具调用进行中事件 - 参考 Cline 的稳定性机制
   */
  async handleToolProgress(chunk: { type: 'mcp_tool_in_progress'; responses: any[] }) {
    try {
      logger.debug(`处理工具进行中，工具数量: ${chunk.responses?.length || 0}`);

      if (!chunk.responses || chunk.responses.length === 0) {
        return;
      }

      // 参考 Cline 的顺序处理机制：逐个处理工具响应，确保稳定性
      for (const toolResponse of chunk.responses) {
        try {
          logger.debug(`处理工具响应: toolResponse.id=${toolResponse.id}, tool.name=${toolResponse.tool.name}, tool.id=${toolResponse.tool.id}`);

          // 参考 Cline：如果是 invoking 状态，创建新的工具块
          if (toolResponse.status === 'invoking') {
            // 检查是否已存在该工具的块（防止重复创建）
            const existingBlockId = this.toolCallIdToBlockIdMap.get(toolResponse.id);
            if (existingBlockId) {
              logger.debug(`工具块已存在: ${existingBlockId} (toolId: ${toolResponse.id})`);
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

            logger.debug(`创建工具块: ${toolBlock.id} (${(toolBlock as ToolMessageBlock).toolName})`);

            // 修复：简化操作，避免复杂事务
            // 1. 更新映射
            this.toolCallIdToBlockIdMap.set(toolResponse.id, toolBlock.id);

            // 2. 统一创建块并关联到消息
            await messageBlockRepository.createBlockAndAttach(toolBlock);

          } else {
            logger.warn(`收到未处理的工具状态: ${toolResponse.status} for ID: ${toolResponse.id}`);
          }
        } catch (toolError) {
          // 参考 Cline 的错误处理：单个工具失败不影响其他工具
          logger.error(`处理单个工具失败 (toolId: ${toolResponse.id}):`, toolError);
          await this.handleSingleToolError(toolResponse.id, toolError);
        }
      }
    } catch (error) {
      logger.error(`处理工具进行中事件失败:`, error);
    }
  }

  /**
   * 原子性工具块更新
   */
  async atomicToolBlockUpdate(blockId: string, changes: any) {
    try {
      await messageBlockRepository.updateBlock(blockId, changes);

      logger.debug(`原子性工具块更新完成: blockId: ${blockId}`);
    } catch (error) {
      logger.error(`原子性工具块更新失败: blockId: ${blockId}:`, error);
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
      logger.error(`计算工具执行时长失败:`, error);
      return undefined;
    }
  }

  /**
   * 检查工具是否为 Web 搜索，若是则创建统一引用块
   */
  private async maybeCreateWebSearchCitationBlock(toolResponse: any, _toolBlockId: string) {
    try {
      const toolName = (toolResponse.tool?.name || '').toLowerCase();
      const isWebSearch =
        toolName.includes('web_search') ||
        toolName.includes('websearch') ||
        toolName === 'builtin_web_search';

      if (!isWebSearch) return;

      // 从 toolResponse 中提取搜索结果
      const rawResponse = toolResponse.response;
      let webSearchResults: any[] = [];

      if (rawResponse?.webSearchResult?.results) {
        webSearchResults = rawResponse.webSearchResult.results;
      } else if (rawResponse?.results && Array.isArray(rawResponse.results)) {
        webSearchResults = rawResponse.results;
      }

      if (webSearchResults.length === 0) {
        logger.debug(`Web 搜索无结果，跳过引用块创建`);
        return;
      }

      // 转换为 WebSearchReferenceItem 格式
      const webSearchItems: WebSearchReferenceItem[] = webSearchResults.map((r: any, i: number) => ({
        index: i + 1,
        title: r.title || '未知标题',
        url: r.url || '',
        snippet: r.snippet || '',
        content: r.content || r.snippet || '',
        provider: r.provider,
      }));

      // 创建统一引用块
      const citationBlock = createCitationBlock(this.messageId, {
        webSearch: webSearchItems,
        webSearchProvider: webSearchItems[0]?.provider,
      });

      logger.debug(`创建 Web 搜索引用块: ${citationBlock.id}，包含 ${webSearchItems.length} 条结果`);

      await messageBlockRepository.createBlockAndAttach(citationBlock, {
        position: { type: 'after', anchorBlockId: _toolBlockId }
      });
      logger.debug(`Web 搜索引用块已添加到消息: ${citationBlock.id}`);
    } catch (error) {
      logger.error(`创建 Web 搜索引用块失败:`, error);
    }
  }

  /**
   * 清理工具执行 - 参考 Cline 的清理机制
   */
  async cleanupToolExecution(toolId: string) {
    try {
      // 可以在这里添加工具执行完成后的清理逻辑
      // 例如：清理临时文件、释放资源等
      logger.debug(`清理工具执行: toolId: ${toolId}`);
    } catch (error) {
      logger.error(`清理工具执行失败:`, error);
    }
  }

  /**
   * 处理工具调用完成事件 - 参考 Cline 的稳定性机制
   */
  async handleToolComplete(chunk: { type: 'mcp_tool_complete'; responses: any[] }) {
    try {
      logger.debug(`处理工具完成，工具数量: ${chunk.responses?.length || 0}`);

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
              logger.error(`未找到工具调用 ${toolResponse.id} 对应的工具块ID`);
              continue;
            }

            const finalStatus = toolResponse.status === 'done' ? MessageBlockStatus.SUCCESS : MessageBlockStatus.ERROR;
            
            // 🎯 特殊处理 attempt_completion 工具
            const toolName = toolResponse.tool?.name || '';
            const isCompletion = isAttemptCompletionTool(toolName);
            
            // 保存完整的工具响应（UI 组件会自行解析需要的数据）
            let displayContent: any = toolResponse.response;
            
            if (isCompletion && finalStatus === MessageBlockStatus.SUCCESS) {
              // 解析 attempt_completion 的结果，格式化显示
              const completionInfo = parseAttemptCompletionResult(toolResponse.response);
              if (completionInfo) {
                // 创建格式化的完成内容
                displayContent = `✅ **任务完成**\n\n${completionInfo.result}`;
                if (completionInfo.command) {
                  displayContent += `\n\n📋 **建议执行命令:**\n\`\`\`\n${completionInfo.command}\n\`\`\``;
                }
                logger.debug(`attempt_completion 结果已格式化`);
              }
            }
            
            const changes: any = {
              content: displayContent,
              status: finalStatus,
              metadata: {
                rawMcpToolResponse: toolResponse,
                // 参考 Cline 添加完成时间
                endTime: new Date().toISOString(),
                duration: this.calculateToolDuration(toolResponse.id),
                // 标记是否是完成工具
                isCompletionTool: isCompletion
              },
              updatedAt: new Date().toISOString()
            };

            if (finalStatus === MessageBlockStatus.ERROR) {
              changes.error = {
                message: `Tool execution failed/error`,
                details: toolResponse.response
              };
            }

            logger.debug(`更新工具块 ${existingBlockId} (toolId: ${toolResponse.id}) 状态为 ${finalStatus}${isCompletion ? ' [attempt_completion]' : ''}`);

            // 修复：简化更新操作，避免复杂事务

            await messageBlockRepository.updateBlock(existingBlockId, changes);

            // 参考 Cline：标记工具执行完成
            globalToolTracker.completeTool(toolResponse.id, finalStatus === MessageBlockStatus.SUCCESS);

            // 🔍 Web 搜索完成后，创建统一引用块
            if (finalStatus === MessageBlockStatus.SUCCESS) {
              await this.maybeCreateWebSearchCitationBlock(toolResponse, existingBlockId);
            }

            // 参考 Cline：工具完成后的清理工作
            await this.cleanupToolExecution(toolResponse.id);

          } else {
            logger.warn(`收到未处理的工具状态: ${toolResponse.status} for ID: ${toolResponse.id}`);
          }
        } catch (toolError) {
          // 参考 Cline 的错误处理：单个工具失败不影响其他工具
          logger.error(`处理单个工具完成失败 (toolId: ${toolResponse.id}):`, toolError);

          // 修复：即使处理失败也要标记工具完成，避免无限等待
          globalToolTracker.completeTool(toolResponse.id, false);

          await this.handleSingleToolError(toolResponse.id, toolError);
        }
      }
    } catch (error) {
      logger.error(`处理工具完成事件失败:`, error);
    }
  }

  /**
   * 处理基于 Chunk 事件的工具调用
   * 
   * 参考项目设计：只处理 Provider 层发送的事件
   * - MCP_TOOL_IN_PROGRESS: 创建工具 UI 块
   * - MCP_TOOL_COMPLETE: 更新工具 UI 块状态
   */
  async handleChunk(chunk: any) {
    try {
      switch (chunk.type) {
        case ChunkType.MCP_TOOL_IN_PROGRESS:
          await this.handleToolProgress(chunk);
          break;

        case ChunkType.MCP_TOOL_COMPLETE:
          await this.handleToolComplete(chunk);
          break;

        default:
          // 其他类型的 chunk 由其他处理器处理
          break;
      }
    } catch (error) {
      logger.error(`处理 chunk 事件失败:`, error);
      throw error;
    }
  }



  // Getter 方法
  get toolMapping() { return this.toolCallIdToBlockIdMap; }
}
