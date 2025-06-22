/**
 * 思考过程工具函数
 * 提供处理思考过程的通用工具函数
 */

/**
 * 检查思考过程是否正在进行中
 * @param reasoning 思考过程内容
 * @returns 是否正在进行中
 */
export function isReasoningInProgress(reasoning: string): boolean {
  return (
    (reasoning.includes('<reasoning>') && !reasoning.includes('</reasoning>')) ||
    (reasoning.includes('<thinking>') && !reasoning.includes('</thinking>')) ||
    (reasoning.includes('<think>') && !reasoning.includes('</think>')) ||
    (reasoning.includes('###Thinking') && !reasoning.includes('###Response'))
  );
}

/**
 * 清理思考过程内容，去除标签
 * @param reasoning 思考过程内容
 * @returns 清理后的内容
 */
export function cleanReasoningContent(reasoning: string): string {
  return reasoning
    .replace(/<reasoning>/g, '')
    .replace(/<\/reasoning>/g, '')
    .replace(/<thinking>/g, '')
    .replace(/<\/thinking>/g, '')
    .replace(/<think>/g, '')
    .replace(/<\/think>/g, '')
    .replace(/###Thinking/g, '')
    .replace(/###Response/g, '');
}

/**
 * 格式化思考时间为秒
 * @param timeMs 思考时间（毫秒）
 * @returns 格式化后的时间（秒，保留一位小数）
 */
export function formatThinkingTimeSeconds(timeMs?: number): number {
  if (!timeMs || timeMs <= 0) {
    return 0; // 修复：如果未提供或为0，返回0而不是随机值
  }
  return Math.round(timeMs / 100) / 10;
}

/**
 * 格式化思考时间为易读格式
 * @param timeMs 思考时间（毫秒）
 * @returns 格式化后的时间字符串
 */
export function formatThinkingTime(timeMs?: number): string {
  if (!timeMs) return '未知时间';

  if (timeMs < 1000) {
    return `${timeMs}毫秒`;
  }

  const seconds = formatThinkingTimeSeconds(timeMs);
  return `${seconds}秒`;
}
