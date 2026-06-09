/**
 * 消息列表虚拟化核心导出
 *
 * 当前仅包含框架无关的几何核心 VirtualizerCore（PR1 地基，零 UI 行为变化）。
 * 后续 PR2 将由 Solid 外壳 / React 内容层消费它实现带回收的真窗口化。
 */
export { VirtualizerCore } from './VirtualizerCore';
export type {
  VirtualRange,
  ScrollAnchor,
  VirtualizerOptions,
} from './VirtualizerCore';
