/**
 * 能力说明
 */

export interface CapabilitiesConfig {
  supportsBrowserUse: boolean;
  hasFileEditorTools: boolean;
}

export function getCapabilitiesSection(config: CapabilitiesConfig): string {
  const { supportsBrowserUse, hasFileEditorTools } = config;

  const parts: string[] = ['# Capabilities'];

  if (hasFileEditorTools) {
    parts.push(`## File Operations

Workflow: \`list_workspaces\` → \`get_workspace_files\` → \`read_file\` → edit → \`attempt_completion\`

Editing priority (prefer the first applicable option):
1. **apply_diff** — SEARCH/REPLACE blocks for precise edits
2. **insert_content** — append or insert at a specific line
3. **write_to_file** — full rewrite (must include \`line_count\` and complete content)
4. **create_file** — new files only (fails if file exists)`);
  }

  if (supportsBrowserUse) {
    parts.push(`## Browser

Interact with websites and local dev servers when needed.`);
  }

  return parts.join('\n\n');
}
