/**
 * 工具调用格式说明
 */

export function getToolUseSection(): string {
  return `# Tool Calling Protocol

Exactly **one tool call per response**. Use this XML format:

<tool_use>
<name>TOOL_NAME</name>
<arguments>{"param": "value"}</arguments>
</tool_use>

Results are returned as:

<tool_use_result>
<name>TOOL_NAME</name>
<result>RESULT</result>
</tool_use_result>

Format requirements:
- Tags must be intact — no whitespace or line breaks inside tag names.
- Arguments must be valid JSON.
- Malformed tags will cause execution failure.`;
}
