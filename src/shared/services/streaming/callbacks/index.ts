/**
 * 回调系统模块
 * 完全参考 Cherry Studio callbacks/index.ts 实现
 */

import type { BlockManager } from '../BlockManager';
import { createBaseCallbacks } from './baseCallbacks';
import { createCitationCallbacks } from './citationCallbacks';
import { createImageCallbacks } from './imageCallbacks';
import { createTextCallbacks } from './textCallbacks';
import { createThinkingCallbacks } from './thinkingCallbacks';
import { createToolCallbacks } from './toolCallbacks';
import { createVideoCallbacks } from './videoCallbacks';
import type { Assistant } from './types';

// 导出所有类型和函数
export * from './types';
export { createBaseCallbacks } from './baseCallbacks';
export { createTextCallbacks } from './textCallbacks';
export { createThinkingCallbacks } from './thinkingCallbacks';
export { createToolCallbacks } from './toolCallbacks';
export { createImageCallbacks } from './imageCallbacks';
export { createCitationCallbacks } from './citationCallbacks';
export { createVideoCallbacks } from './videoCallbacks';

/**
 * 回调依赖接口
 * 完全参考 Cherry Studio CallbacksDependencies
 */
interface CallbacksDependencies {
  blockManager: BlockManager;
  dispatch: any;
  getState: any;
  topicId: string;
  assistantMsgId: string;
  saveUpdatesToDB: any;
  assistant: Assistant;
}

/**
 * 创建完整的回调集合
 * 完全参考 Cherry Studio 实现
 */
export const createCallbacks = (deps: CallbacksDependencies) => {
  const { blockManager, dispatch, getState, topicId, assistantMsgId, saveUpdatesToDB, assistant } = deps;

  // 创建基础回调
  const baseCallbacks = createBaseCallbacks({
    blockManager,
    dispatch,
    getState,
    topicId,
    assistantMsgId,
    saveUpdatesToDB,
    assistant
  });

  // 创建各类回调
  const thinkingCallbacks = createThinkingCallbacks({
    blockManager,
    assistantMsgId
  });

  const toolCallbacks = createToolCallbacks({
    blockManager,
    assistantMsgId,
    dispatch
  });

  const imageCallbacks = createImageCallbacks({
    blockManager,
    assistantMsgId
  });

  const citationCallbacks = createCitationCallbacks({
    blockManager,
    assistantMsgId,
    getState
  });

  const videoCallbacks = createVideoCallbacks({ blockManager, assistantMsgId });

  // 创建textCallbacks时传入citationCallbacks的getCitationBlockId方法
  const textCallbacks = createTextCallbacks({
    blockManager,
    getState,
    assistantMsgId,
    getCitationBlockId: citationCallbacks.getCitationBlockId,
    getCitationBlockIdFromTool: toolCallbacks.getCitationBlockId
  });

  // 组合所有回调
  return {
    ...baseCallbacks,
    ...textCallbacks,
    ...thinkingCallbacks,
    ...toolCallbacks,
    ...imageCallbacks,
    ...citationCallbacks,
    ...videoCallbacks,
    // 清理资源的方法
    cleanup: () => {
      // 清理由外部的节流函数管理
    }
  };
};
