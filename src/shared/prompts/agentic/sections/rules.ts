/**
 * 规则约束
 */

/** 工作区信息 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
}

export interface RulesConfig {
  cwd: string;
  osType: string;
  hasFileEditorTools: boolean;
  supportsBrowserUse: boolean;
  workspaces?: WorkspaceInfo[];
}

export function getRulesSection(config: RulesConfig): string {
  const { cwd, hasFileEditorTools, workspaces = [] } = config;

  const parts: string[] = [
    `# Rules

## Execution
- Working directory: \`${cwd}\`
- One tool call per response. Wait for the result before proceeding.
- Never assume a tool's outcome — always verify from the returned result.
- Prefer tool use over asking the user. Be goal-oriented; minimize back-and-forth.

## Communication
- Be direct and technical. No filler phrases ("Great", "Sure", "Certainly").
- The \`attempt_completion\` result is final — no follow-up questions.`
  ];

  if (hasFileEditorTools) {
    // 工作区信息
    if (workspaces.length > 0) {
      const list = workspaces.map((ws, i) => `${i + 1}. **${ws.name}** — \`${ws.path}\``).join('\n');
      parts.push(`## Workspaces\n${list}`);
    }

    parts.push(`## File Editing
- Always \`read_file\` before editing to get current content.
- \`write_to_file\` must include \`line_count\` and the **complete** file content — no placeholders or ellipsis.
- \`apply_diff\` requires sufficient surrounding context for unique matching.`);
  }

  return parts.join('\n\n');
}
