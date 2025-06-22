import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * 转换数学公式格式：
 * - 将 LaTeX 格式的 '\\[' 和 '\\]' 转换为 '$$$$'。
 * - 将 LaTeX 格式的 '\\(' 和 '\\)' 转换为 '$$'。
 * @param input 输入字符串
 * @returns string 转换后的字符串
 */
export function convertMathFormula(input: string | undefined): string | undefined {
  if (!input) return input;

  let result = input;
  result = result.replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$');
  result = result.replace(/\\\(/g, '$$').replace(/\\\)/g, '$$');
  return result;
}

/**
 * 移除 Markdown 文本中每行末尾的两个空格。
 * @param markdown 输入的 Markdown 文本
 * @returns string 处理后的文本
 */
export function removeTrailingDoubleSpaces(markdown: string): string {
  // 使用正则表达式匹配末尾的两个空格，并替换为空字符串
  return markdown.replace(/ {2}$/gm, '');
}

/**
 * 根据代码块节点的起始位置生成 ID
 * @param start 代码块节点的起始位置
 * @returns 代码块在 Markdown 字符串中的 ID
 */
export function getCodeBlockId(start: any): string | null {
  return start ? `${start.line}:${start.column}:${start.offset}` : null;
}

/**
 * HTML实体编码辅助函数
 * @param str 输入字符串
 * @returns string 编码后的字符串
 */
export const encodeHTML = (str: string): string => {
  return str.replace(/[&<>"']/g, (match) => {
    const entities: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    };
    return entities[match];
  });
};

/**
 * 更新Markdown字符串中的代码块内容。
 *
 * 由于使用了remark-stringify，所以会有一些默认格式化操作，例如：
 * - 代码块前后会补充换行符。
 * - 有些空格会被trimmed。
 * - 文档末尾会补充一个换行符。
 *
 * @param raw 原始Markdown字符串
 * @param id 代码块ID，按位置生成
 * @param newContent 修改后的代码内容
 * @returns 替换后的Markdown字符串
 */
export function updateCodeBlock(raw: string, id: string, newContent: string): string {
  const tree = unified().use(remarkParse).parse(raw);
  visit(tree, 'code', (node) => {
    const startIndex = getCodeBlockId(node.position?.start);
    if (startIndex && id && startIndex === id) {
      node.value = newContent;
    }
  });

  return unified().use(remarkStringify).stringify(tree);
}

/**
 * 从Markdown文本中提取所有代码块及其位置信息
 * @param markdown Markdown文本
 * @returns 代码块信息数组，包括ID、内容和语言
 */
export function extractCodeBlocks(markdown: string): { id: string; content: string; language: string | null }[] {
  const results: { id: string; content: string; language: string | null }[] = [];
  
  const tree = unified().use(remarkParse).parse(markdown);
  visit(tree, 'code', (node) => {
    const id = getCodeBlockId(node.position?.start);
    if (id) {
      results.push({
        id,
        content: node.value as string,
        language: node.lang as string | null
      });
    }
  });
  
  return results;
}

/**
 * 检查是否为有效的 PlantUML 图表
 * @param code 输入的 PlantUML 图表字符串
 * @returns 有效 true，无效 false
 */
export function isValidPlantUML(code: string | null): boolean {
  if (!code || !code.trim().startsWith('@start')) {
    return false;
  }
  const diagramType = code.match(/@start(\w+)/)?.[1];

  return diagramType !== undefined && code.search(`@end${diagramType}`) !== -1;
}

/**
 * 移除SVG空行 - 参考实现
 */
export function removeSvgEmptyLines(text: string): string {
  const svgPattern = /(<svg[\s\S]*?<\/svg>)/g;
  return text.replace(svgPattern, (svgMatch) => {
    return svgMatch
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n');
  });
} 