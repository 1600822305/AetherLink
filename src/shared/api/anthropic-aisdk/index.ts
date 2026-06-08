/**
 * 兼容垫片（re-export shim）—— Phase 4b
 *
 * Anthropic AI SDK 适配器已收敛到 `src/shared/ai/adapters/anthropic`（README §4.2
 * 的目标结构）。此处保留旧路径 `api/anthropic-aisdk` 作为透明转发，使下游 import
 * 无需改动（绞杀者模式）。后续阶段下游迁到新路径后可移除本垫片。
 */
export * from '../../ai/adapters/anthropic';
