/**
 * 工具标签格式规范提示词
 * 用于指导 AI 正确输出工具调用标签，避免标签被意外分割
 */

export const TOOL_TAG_FORMAT_PROMPT = `
## 🚨 工具调用格式要求 - 严格遵守

当你需要调用工具时，必须严格按照以下格式输出，**绝对不允许**在标签中间换行或添加空格：

### ✅ 正确格式：
\`\`\`xml
<tool_use>
<name>工具名称</name>
<arguments>{"参数": "值"}</arguments>
</tool_use>
\`\`\`

### ❌ 错误格式（会导致解析失败）：
- 标签被分割：\`<tool\n_use>\` 
- 标签内有空格：\`<tool _use>\`
- 标签换行：\`<name\n>\`

###  重要警告：
如果你的工具标签格式不正确，会导致：
1. 工具调用完全失败
2. 用户无法看到工具执行结果  
3. 整个对话流程中断
4. 系统报错和用户体验极差

### 📋 检查清单：
- [ ] \`<tool_use>\` 标签完整，无换行无空格
- [ ] \`<name>\` 标签完整，无换行无空格  
- [ ] \`<arguments>\` 标签完整，无换行无空格
- [ ] 所有结束标签 \`</xxx>\` 格式正确
- [ ] JSON 参数格式正确

**请务必严格遵守此格式，这是系统正常运行的基础要求！**
`;

/**
 * 获取工具格式提示词
 * @param includeWarning 是否包含警告信息
 * @returns 格式化的提示词
 */
export function getToolFormatPrompt(includeWarning: boolean = true): string {
  if (!includeWarning) {
    return `
使用工具时请严格按照以下格式：

<tool_use>
<name>工具名称</name>
<arguments>{"参数": "值"}</arguments>
</tool_use>

确保标签完整，不要在标签中间换行或添加空格。
`;
  }
  
  return TOOL_TAG_FORMAT_PROMPT;
}

/**
 * 简化版工具格式提示（用于系统消息）
 */
export const SIMPLE_TOOL_FORMAT_PROMPT = `
重要：使用工具时标签必须完整，格式：<tool_use><name>工具名</name><arguments>参数</arguments></tool_use>
不要在标签中间换行或添加空格，否则工具调用会失败。
`;

export default {
  TOOL_TAG_FORMAT_PROMPT,
  getToolFormatPrompt,
  SIMPLE_TOOL_FORMAT_PROMPT
};
