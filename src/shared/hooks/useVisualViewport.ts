import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '../services/infra/logger';

const logger = createLogger('useVisualViewport');

/**
 * ============================================================================
 * Visual Viewport Hook - 解决移动端固定定位元素跟随滚动的问题
 * ============================================================================
 * 
 * 问题背景：
 * 在移动端（尤其是 iOS Safari），当虚拟键盘弹出时：
 * - Layout Viewport 保持不变
 * - Visual Viewport 缩小
 * - position: fixed 元素锚定到 Layout Viewport
 * - 滚动时，Visual Viewport 偏移，导致 fixed 元素看起来在移动
 * 
 * 解决方案：
 * 使用 visualViewport API 监听 resize 和 scroll 事件，
 * 动态计算偏移量来补偿这个问题。
 * 
 * 参考：
 * - https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios
 * - https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/
 */

interface UseVisualViewportResult {
  /** 输入框容器应使用的 top 值 */
  fixedTop: number | null;
  /** 是否应该使用 visualViewport 定位（键盘弹出时） */
  shouldUseVisualViewport: boolean;
  /** Visual Viewport 高度 */
  viewportHeight: number;
  /** Visual Viewport 偏移量 */
  offsetTop: number;
}

export const useVisualViewport = (): UseVisualViewportResult => {
  const [fixedTop, setFixedTop] = useState<number | null>(null);
  const [shouldUseVisualViewport, setShouldUseVisualViewport] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [offsetTop, setOffsetTop] = useState(0);
  
  // 使用 ref 来避免闭包问题
  const pendingUpdateRef = useRef(false);

  const updatePosition = useCallback(() => {
    if (pendingUpdateRef.current) return;
    pendingUpdateRef.current = true;

    requestAnimationFrame(() => {
      pendingUpdateRef.current = false;

      if (!window.visualViewport) {
        setFixedTop(null);
        setShouldUseVisualViewport(false);
        return;
      }

      const vv = window.visualViewport;
      const vvHeight = vv.height;
      const vvOffsetTop = vv.offsetTop;
      
      setViewportHeight(vvHeight);
      setOffsetTop(vvOffsetTop);

      // 检测键盘是否弹出（Visual Viewport 高度小于窗口高度）
      const keyboardVisible = vvHeight < window.innerHeight - 50; // 50px 容差
      
      if (keyboardVisible) {
        // 键盘弹出时，计算输入框应该固定的位置
        // 使用 top 定位 + transform: translateY(-100%) 的方式
        // top = visualViewport.height + visualViewport.offsetTop
        const newTop = vvHeight + vvOffsetTop;
        setFixedTop(newTop);
        setShouldUseVisualViewport(true);
      } else {
        // 键盘隐藏时，使用正常的 bottom: 0 定位
        setFixedTop(null);
        setShouldUseVisualViewport(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.visualViewport) {
      logger.debug('visualViewport API 不可用');
      return;
    }

    const vv = window.visualViewport;

    // 监听 resize 事件（键盘弹出/隐藏）
    vv.addEventListener('resize', updatePosition);
    // 监听 scroll 事件（用户滚动时 Visual Viewport 偏移）
    vv.addEventListener('scroll', updatePosition);

    // 初始化
    updatePosition();

    return () => {
      vv.removeEventListener('resize', updatePosition);
      vv.removeEventListener('scroll', updatePosition);
    };
  }, [updatePosition]);

  return {
    fixedTop,
    shouldUseVisualViewport,
    viewportHeight,
    offsetTop,
  };
};

export default useVisualViewport;
