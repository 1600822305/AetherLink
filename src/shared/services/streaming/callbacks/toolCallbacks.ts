/**
 * 工具调用回调模块
 * 处理 MCP 工具调用
 * 
 * 参考 Cherry Studio toolCallbacks 设计
 */

import { MessageBlockStatus, MessageBlockType } from '../../../types/newMessage';
import type { MessageBlock } from '../../../types/newMessage';
import { v4 as uuid } from 'uuid';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

/**
 * 工具调用状态缓存
 */
interface ToolCallCache {
  blockId: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: any;
}

/**
 * 创建工具调用回调
 */
export function createToolCallbacks(deps: CallbackDependencies): Partial<StreamProcessorCallbacks> {
  const { messageId, blockManager, mcpTools = [] } = deps;
  
  // 工具调用状态缓存
  const toolCallsMap = new Map<string, ToolCallCache>();

  /**
   * 创建工具块
   */
  const createToolBlock = async (toolResponse: any): Promise<string> => {
    const newBlockId = uuid();
    const newBlock: MessageBlock = {
      id: newBlockId,
      messageId,
      type: MessageBlockType.TOOL,
      content: JSON.stringify({
        name: toolResponse.name,
        arguments: toolResponse.arguments
      }),
      createdAt: new Date().toISOString(),
      status: MessageBlockStatus.PROCESSING,
      toolName: toolResponse.name,
      toolId: toolResponse.id,
      toolCallId: toolResponse.toolCallId || toolResponse.id
    } as MessageBlock;
    
    await blockManager.handleBlockTransition(newBlock, MessageBlockType.TOOL);
    return newBlockId;
  };

  return {
    /**
     * 工具调用等待（可选）
     */
    onToolCallPending: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具等待:', toolResponse.name);
      
      const blockId = await createToolBlock(toolResponse);
      
      toolCallsMap.set(toolResponse.id, {
        blockId,
        status: 'pending'
      });
    },

    /**
     * 工具调用进行中
     */
    onToolCallInProgress: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具执行中:', toolResponse.name);
      
      let cached = toolCallsMap.get(toolResponse.id);
      
      if (!cached) {
        // 如果没有等待状态，直接创建块
        const blockId = await createToolBlock(toolResponse);
        cached = { blockId, status: 'running' };
        toolCallsMap.set(toolResponse.id, cached);
      } else {
        // 更新状态为运行中
        blockManager.smartBlockUpdate(
          cached.blockId,
          { status: MessageBlockStatus.PROCESSING },
          MessageBlockType.TOOL,
          false
        );
        cached.status = 'running';
      }
    },

    /**
     * 工具调用完成
     */
    onToolCallComplete: async (toolResponse: any) => {
      console.log('[ToolCallbacks] 工具完成:', toolResponse.name);
      
      const cached = toolCallsMap.get(toolResponse.id);
      
      if (cached) {
        blockManager.smartBlockUpdate(
          cached.blockId,
          {
            status: MessageBlockStatus.SUCCESS,
            content: JSON.stringify({
              name: toolResponse.name,
              arguments: toolResponse.arguments,
              result: toolResponse.result
            })
          },
          MessageBlockType.TOOL,
          true
        );
        
        cached.status = 'done';
        cached.result = toolResponse.result;
      } else {
        // 没有缓存，创建新块并标记为完成
        const blockId = await createToolBlock(toolResponse);
        blockManager.smartBlockUpdate(
          blockId,
          { 
            status: MessageBlockStatus.SUCCESS,
            content: JSON.stringify({
              name: toolResponse.name,
              arguments: toolResponse.arguments,
              result: toolResponse.result
            })
          },
          MessageBlockType.TOOL,
          true
        );
      }
    },

    // 清理
    cleanup: () => {
      toolCallsMap.clear();
    }
  };
}
