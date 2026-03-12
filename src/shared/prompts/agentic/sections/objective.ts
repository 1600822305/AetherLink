/**
 * 目标与完成协议
 */

export interface ObjectiveConfig {
  maxToolCalls: number;
  maxConsecutiveErrors: number;
}

export function getObjectiveSection(config: ObjectiveConfig): string {
  const { maxToolCalls, maxConsecutiveErrors } = config;

  return `# Task Completion

## Process
1. Analyze the request → break into ordered steps.
2. Execute one tool per response → verify result → next step.
3. **End with \`attempt_completion\`** — every task must conclude with this call.

## attempt_completion

A task is **incomplete** until \`attempt_completion\` is called. Call it when:
- All requested work is done and verified.

Do **not** call it when:
- A tool error just occurred (fix it first).
- You are mid-way through a multi-step task.
- You need more information from the user.

## Limits
- Maximum **${maxToolCalls}** tool calls per task.
- Maximum **${maxConsecutiveErrors}** consecutive errors before reassessing approach.`;
}
