/**
 * 回调系统模块
 * 组合所有回调模块
 * 
 * 参考 Cherry Studio callbacks 设计
 */

import { createBaseCallbacks } from './baseCallbacks';
import { createTextCallbacks } from './textCallbacks';
import { createThinkingCallbacks } from './thinkingCallbacks';
import { createToolCallbacks } from './toolCallbacks';
import { createImageCallbacks } from './imageCallbacks';
import { createCitationCallbacks } from './citationCallbacks';
import { createVideoCallbacks } from './videoCallbacks';
import type { CallbackDependencies, StreamProcessorCallbacks } from './types';

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
 * 创建完整的回调集合
 * 组合所有功能模块的回调
 * 
 * @param deps 依赖注入
 * @returns 完整的回调集合
 */
export function createCallbacks(deps: CallbackDependencies): StreamProcessorCallbacks {
  // 创建各模块回调
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);
  const thinkingCallbacks = createThinkingCallbacks(deps);
  const toolCallbacks = createToolCallbacks(deps);
  const imageCallbacks = createImageCallbacks(deps);
  const citationCallbacks = createCitationCallbacks(deps);
  const videoCallbacks = createVideoCallbacks(deps);

  // 组合所有回调
  const callbacks: StreamProcessorCallbacks = {
    // 基础回调
    ...baseCallbacks,
    // 文本回调
    ...textCallbacks,
    // 思考链回调
    ...thinkingCallbacks,
    // 工具回调
    ...toolCallbacks,
    // 图像回调
    ...imageCallbacks,
    // 引用回调
    ...citationCallbacks,
    // 视频回调
    ...videoCallbacks,

    // 清理方法
    cleanup: () => {
      toolCallbacks.cleanup?.();
    }
  };

  return callbacks;
}

/**
 * 创建精简的回调集合
 * 仅包含基础和文本回调，用于简单场景
 * 
 * @param deps 依赖注入
 * @returns 精简的回调集合
 */
export function createMinimalCallbacks(deps: CallbackDependencies): StreamProcessorCallbacks {
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);

  return {
    ...baseCallbacks,
    ...textCallbacks,
    cleanup: () => {}
  };
}

/**
 * 创建带思考链的回调集合
 * 用于支持深度思考的模型
 * 
 * @param deps 依赖注入
 * @returns 带思考链的回调集合
 */
export function createThinkingCallbacksSet(deps: CallbackDependencies): StreamProcessorCallbacks {
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);
  const thinkingCallbacks = createThinkingCallbacks(deps);

  return {
    ...baseCallbacks,
    ...textCallbacks,
    ...thinkingCallbacks,
    cleanup: () => {}
  };
}

/**
 * 创建带引用和搜索的回调集合
 * 用于支持网络搜索和知识库的场景
 * 
 * @param deps 依赖注入
 * @returns 带引用的回调集合
 */
export function createSearchCallbacksSet(deps: CallbackDependencies): StreamProcessorCallbacks {
  const baseCallbacks = createBaseCallbacks(deps);
  const textCallbacks = createTextCallbacks(deps);
  const citationCallbacks = createCitationCallbacks(deps);
  const imageCallbacks = createImageCallbacks(deps);
  const videoCallbacks = createVideoCallbacks(deps);

  return {
    ...baseCallbacks,
    ...textCallbacks,
    ...citationCallbacks,
    ...imageCallbacks,
    ...videoCallbacks,
    cleanup: () => {}
  };
}
