/**
 * 工具目录
 */

import type { MCPTool } from '../../../types/index';

export function getToolsCatalogSection(tools: MCPTool[]): string {
  if (!tools || tools.length === 0) {
    return '';
  }

  const toolsXml = tools
    .map((tool) => {
      const toolName = tool.id || tool.name;
      const description = tool.description || 'No description';
      const schema = tool.inputSchema;

      let paramsBlock = '';
      if (schema?.properties) {
        const required = new Set(schema.required || []);
        const params = Object.entries(schema.properties).map(([key, val]: [string, any]) => {
          const req = required.has(key) ? 'required' : 'optional';
          const desc = val.description || val.type || 'any';
          return `    <param name="${escapeXml(key)}" ${req}>${escapeXml(desc)}</param>`;
        });
        paramsBlock = `\n  <parameters>\n${params.join('\n')}\n  </parameters>`;
      }

      return `<tool>\n  <name>${escapeXml(toolName)}</name>\n  <description>${escapeXml(description)}</description>${paramsBlock}\n</tool>`;
    })
    .join('\n');

  return `# Available Tools

Only call tools listed here. Never invent tool names.

<tools>
${toolsXml}
</tools>`;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
