/**
 * 工具调用回调模块
 * 完全参考 Cherry Studio toolCallbacks.ts 实现
 */

import type { ToolMessageBlock } from '../../../types/newMessage';
import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import { createToolBlock, createCitationBlock } from '../../../utils/messageUtils/blockFactory';
import type { BlockManager } from '../BlockManager';
import type { AppDispatch } from '../../../store';

// 使用宽松的工具响应类型，兼容不同来源的数据
interface ToolResponseInput {
  id: string;
  tool: {
    name: string;
    serverName?: string;
    serverId?: string;
    [key: string]: any;
  };
  arguments?: Record<string, any>;
  status: string;
  response?: any;
  [key: string]: any;
}

/**
 * 工具回调依赖
 * 完全参考 Cherry Studio ToolCallbacksDependencies
 */
interface ToolCallbacksDependencies {
  blockManager: BlockManager;
  assistantMsgId: string;
  dispatch: AppDispatch;
}

/**
 * 创建工具调用回调
 * 完全参考 Cherry Studio 实现
 */
export const createToolCallbacks = (deps: ToolCallbacksDependencies) => {
  const { blockManager, assistantMsgId } = deps;

  // 内部维护的状态
  const toolCallIdToBlockIdMap = new Map<string, string>();
  let toolBlockId: string | null = null;
  let citationBlockId: string | null = null;

  return {
    onToolCallPending: (toolResponse: ToolResponseInput) => {
      console.log('[ToolCallbacks] onToolCallPending', toolResponse);

      if (blockManager.hasInitialPlaceholder) {
        const changes = {
          type: MessageBlockType.TOOL,
          status: MessageBlockStatus.PENDING,
          toolName: toolResponse.tool.name,
          metadata: { rawMcpToolResponse: toolResponse as any }
        };
        toolBlockId = blockManager.initialPlaceholderBlockId!;
        blockManager.smartBlockUpdate(toolBlockId, changes as any, MessageBlockType.TOOL);
        toolCallIdToBlockIdMap.set(toolResponse.id, toolBlockId);
      } else if (toolResponse.status === 'pending') {
        const toolBlock = createToolBlock(assistantMsgId, toolResponse.id, {
          toolName: toolResponse.tool.name,
          status: MessageBlockStatus.PENDING,
          metadata: { rawMcpToolResponse: toolResponse as any }
        });
        toolBlockId = toolBlock.id;
        blockManager.handleBlockTransition(toolBlock, MessageBlockType.TOOL);
        toolCallIdToBlockIdMap.set(toolResponse.id, toolBlock.id);
      } else {
        console.warn(
          `[onToolCallPending] Received unhandled tool status: ${toolResponse.status} for ID: ${toolResponse.id}`
        );
      }
    },

    onToolCallInProgress: (toolResponse: ToolResponseInput) => {
      console.log('[ToolCallbacks] onToolCallInProgress', toolResponse);
      
      const existingBlockId = toolCallIdToBlockIdMap.get(toolResponse.id);
      
      if (existingBlockId) {
        // 更新工具块状态为 PROCESSING（调用中）
        const changes = {
          status: MessageBlockStatus.PROCESSING,
          metadata: { rawMcpToolResponse: toolResponse as any }
        };
        blockManager.smartBlockUpdate(existingBlockId, changes as any, MessageBlockType.TOOL);
      } else {
        console.warn(
          `[onToolCallInProgress] No existing block found for tool ID: ${toolResponse.id}. The PENDING event may have been missed.`
        );
      }
    },

    onToolCallComplete: (toolResponse: ToolResponseInput) => {
      const existingBlockId = toolCallIdToBlockIdMap.get(toolResponse.id);
      toolCallIdToBlockIdMap.delete(toolResponse.id);

      if (toolResponse.status === 'done' || toolResponse.status === 'error' || toolResponse.status === 'cancelled') {
        if (!existingBlockId) {
          console.error(
            `[onToolCallComplete] No existing block found for completed/error tool call ID: ${toolResponse.id}. Cannot update.`
          );
          return;
        }

        const finalStatus =
          toolResponse.status === 'done' || toolResponse.status === 'cancelled'
            ? MessageBlockStatus.SUCCESS
            : MessageBlockStatus.ERROR;

        const changes: Partial<ToolMessageBlock> = {
          content: toolResponse.response,
          status: finalStatus,
          metadata: { rawMcpToolResponse: toolResponse as any }
        };

        if (finalStatus === MessageBlockStatus.ERROR) {
          (changes as any).error = {
            message: `Tool execution failed/error`,
            details: toolResponse.response,
            name: null,
            stack: null
          };
        }
        blockManager.smartBlockUpdate(existingBlockId, changes as any, MessageBlockType.TOOL, true);
        
        // Handle citation block creation for web search results
        if (toolResponse.tool.name === 'builtin_web_search' && toolResponse.response) {
          const citationBlock = createCitationBlock(
            assistantMsgId,
            {
              content: '',
              response: { results: toolResponse.response, source: 'websearch' }
            } as any,
            {
              status: MessageBlockStatus.SUCCESS
            }
          );
          citationBlockId = citationBlock.id;
          blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION);
        }
        if (toolResponse.tool.name === 'builtin_knowledge_search' && toolResponse.response) {
          const citationBlock = createCitationBlock(
            assistantMsgId,
            { 
              content: '',
              knowledge: toolResponse.response 
            } as any,
            {
              status: MessageBlockStatus.SUCCESS
            }
          );
          citationBlockId = citationBlock.id;
          blockManager.handleBlockTransition(citationBlock, MessageBlockType.CITATION);
        }
      } else {
        console.warn(
          `[onToolCallComplete] Received unhandled tool status: ${toolResponse.status} for ID: ${toolResponse.id}`
        );
      }

      toolBlockId = null;
    },

    // 暴露给 textCallbacks 使用的方法
    getCitationBlockId: () => citationBlockId
  };
};
