/**
 * 思考过程配置
 *
 * 说明：推理 / 思考强度的能力表与编码逻辑已统一收敛到：
 *   - 能力表（每个模型支持的 effort 档位）：`src/config/models/reasoning.ts`
 *   - 请求参数编码（effort -> reasoning_effort / thinking 等）：`src/shared/api/parameters/reasoning/encodeReasoning.ts`
 *
 * 本文件仅保留仍被设置项 UI 使用的 `ThinkingOption` 类型，避免重复的「第三套」实现。
 */

/**
 * 思考选项类型（侧边栏 / 助手设置中使用）
 */
export type ThinkingOption = 'off' | 'low' | 'medium' | 'high' | 'auto';
