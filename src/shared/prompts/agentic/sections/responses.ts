/**
 * Agentic 模式运行时消息
 * 用于在对话中插入系统级提醒，不属于系统提示词的一部分
 */

/**
 * AI 未使用工具时的提醒
 */
export function getNoToolsUsedReminder(): string {
  return `[ERROR] No tool call detected in your previous response.

Every response in Agentic mode must include exactly one tool call.

- Task complete → call \`attempt_completion\`
- Task incomplete → call the next appropriate tool

(Automated message — do not respond conversationally.)`;
}

/**
 * 连续错误过多
 */
export function getTooManyMistakesMessage(feedback?: string): string {
  const fb = feedback ? `\n\nUser feedback:\n<feedback>\n${feedback}\n</feedback>` : '';
  return `Multiple consecutive errors detected.${fb}\n\nReassess your approach: review progress, identify the blocker, and try an alternative. If the task is done, call \`attempt_completion\`.`;
}

/**
 * 工具执行失败
 */
export function getToolErrorMessage(toolName: string, error?: string): string {
  const detail = error ? `\n<error>${error}</error>` : '';
  return `Tool "${toolName}" failed.${detail}\n\nFix the parameters and retry, or use an alternative tool.`;
}

/**
 * 达到最大迭代次数
 */
export function getMaxIterationsReachedMessage(iterations: number): string {
  return `[NOTICE] Iteration limit (${iterations}) reached. Call \`attempt_completion\` to summarize progress and any remaining work.`;
}
