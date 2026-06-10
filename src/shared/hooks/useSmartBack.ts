/**
 * 智能返回导航
 *
 * 跨上下文跳转（如从聊天页弹窗跳到某个设置页）时，入口处通过路由 state 携带
 * `backTo` 来源路径；目标页面用 useSmartBack 返回时优先回到来源页，
 * 没有来源信息时回退到固定的上级路径。
 *
 * 移动端硬件返回键（BackButtonHandler）通过 getBackToFromHistory 读取同一份
 * 路由 state，保持两种返回方式行为一致。
 */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface BackAwareLocationState {
  /** 返回时优先导航到的来源路径 */
  backTo?: string;
}

/** 从路由 state 中读取 backTo 来源路径 */
export const getBackTo = (state: unknown): string | undefined => {
  const backTo = (state as BackAwareLocationState | null)?.backTo;
  return typeof backTo === 'string' && backTo ? backTo : undefined;
};

/**
 * 供非组件环境（如硬件返回键处理器）读取当前路由 state 中的 backTo。
 * react-router 将路由 state 存放在 history.state.usr 中。
 */
export const getBackToFromHistory = (): string | undefined => {
  const historyState = window.history.state as { usr?: unknown } | null;
  return getBackTo(historyState?.usr);
};

/**
 * 返回一个智能返回函数：优先回到路由 state 中的 backTo 来源页，
 * 否则回退到 fallbackPath。
 */
export function useSmartBack(fallbackPath: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    navigate(getBackTo(location.state) || fallbackPath);
  }, [navigate, location.state, fallbackPath]);
}
