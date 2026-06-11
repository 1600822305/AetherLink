/**
 * 记忆工具调用处理器
 * 处理 AI 通过工具调用创建/编辑/删除记忆
 */

import { memoryService } from './MemoryService';
import { MEMORY_TOOL_NAMES } from './memoryTools';
import store from '../../store';

/**
 * 处理记忆工具调用
 * @param toolName 工具名称
 * @param args 工具参数
 * @returns 工具调用结果
 */
export async function handleMemoryToolCall(
  toolName: string,
  args: Record<string, any>
): Promise<{ success: boolean; message: string; data?: any }> {
  // 获取当前助手 ID
  const state = store.getState();
  const assistantId = state.memory?.currentAssistantId || 'default';

  try {
    switch (toolName) {
      case MEMORY_TOOL_NAMES.CREATE: {
        const content = args.content as string;
        if (!content) {
          return { success: false, message: '缺少 content 参数' };
        }
        
        const memory = await memoryService.add(content, {
          assistantId,
          metadata: {
            source: 'auto',
            category: 'fact',
          }
        });
        
        console.log('[MemoryTool] 创建记忆:', memory?.id);
        return { 
          success: true, 
          message: `已记住: "${content}"`,
          data: { id: memory?.id }
        };
      }
      
      case MEMORY_TOOL_NAMES.EDIT: {
        const id = args.id as string;
        const content = args.content as string;
        if (!id || !content) {
          return { success: false, message: '缺少 id 或 content 参数' };
        }
        
        const updated = await memoryService.update(id, content);
        if (!updated) {
          return { success: false, message: `未找到 ID 为 ${id} 的记忆` };
        }
        
        console.log('[MemoryTool] 更新记忆:', id);
        return { 
          success: true, 
          message: `已更新记忆: "${content}"`,
          data: { id }
        };
      }
      
      case MEMORY_TOOL_NAMES.DELETE: {
        const id = args.id as string;
        if (!id) {
          return { success: false, message: '缺少 id 参数' };
        }
        
        const deleted = await memoryService.delete(id);
        if (!deleted) {
          return { success: false, message: `未找到 ID 为 ${id} 的记忆` };
        }
        
        console.log('[MemoryTool] 删除记忆:', id);
        return { 
          success: true, 
          message: '已删除记忆',
          data: { id }
        };
      }
      
      default:
        return { success: false, message: `未知的记忆工具: ${toolName}` };
    }
  } catch (error) {
    console.error('[MemoryTool] 工具调用失败:', error);
    return { 
      success: false, 
      message: `操作失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
