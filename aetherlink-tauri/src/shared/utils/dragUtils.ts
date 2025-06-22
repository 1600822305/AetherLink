/**
 * 用于拖拽排序的工具函数
 */

/**
 * 重新排序数组元素
 * @param list 要重新排序的数组
 * @param sourceIndex 源索引
 * @param destinationIndex 目标索引
 * @returns 重新排序后的数组
 */
export function reorderArray<T>(list: T[], sourceIndex: number, destinationIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(sourceIndex, 1);
  result.splice(destinationIndex, 0, removed);
  return result;
}
