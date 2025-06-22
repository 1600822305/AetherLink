/**
 * 获取潜在的起始索引
 * 用于在文本中查找可能的标签起始位置
 */

/**
 * 获取潜在的起始索引
 * @param text 要搜索的文本
 * @param tag 要查找的标签
 * @returns 找到的索引或null
 */
export function getPotentialStartIndex(text: string, tag: string): number | null {
  // 如果文本为空，返回null
  if (!text) return null;

  // 如果标签为空，返回null
  if (!tag) return null;

  // 查找完整标签
  const index = text.indexOf(tag);
  if (index !== -1) return index;

  // 查找部分匹配
  for (let i = 1; i < tag.length; i++) {
    const partialTag = tag.slice(0, i);
    if (text.endsWith(partialTag)) {
      return text.length - partialTag.length;
    }
  }

  return null;
}
