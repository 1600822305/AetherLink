/**
 * 向量计算工具函数
 * 提供统一的向量操作方法，避免代码重复
 */
import { createLogger } from '../services/infra/logger';
const logger = createLogger('VectorUtils');

/**
 * 计算两个向量的余弦相似度
 * @param vecA 向量A
 * @param vecB 向量B
 * @returns 相似度值 (0-1)
 * @throws 如果向量维度不匹配
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
    logger.warn(`向量维度不匹配: ${vecA.length} vs ${vecB.length}`);
    return 0;
  }

  if (vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * 计算两个文本的词汇相似度 (Jaccard相似度)
 * @param text1 文本1
 * @param text2 文本2
 * @returns 相似度值 (0-1)
 */
export function textSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) {
    return 0;
  }

  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 0));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * 向量归一化
 * @param vec 输入向量
 * @returns 归一化后的向量
 */
export function normalizeVector(vec: number[]): number[] {
  if (!vec || vec.length === 0) {
    return [];
  }

  let magnitude = 0;
  for (const val of vec) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vec.map(() => 0);
  }

  return vec.map(val => val / magnitude);
}

/**
 * 计算向量的欧几里得距离
 * @param vecA 向量A
 * @param vecB 向量B
 * @returns 距离值
 */
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 验证向量是否有效
 * @param vec 向量
 * @param expectedDimensions 期望的维度（可选）
 * @returns 是否有效
 */
export function isValidVector(vec: number[], expectedDimensions?: number): boolean {
  if (!vec || !Array.isArray(vec) || vec.length === 0) {
    return false;
  }

  // 检查所有元素是否为有效数字
  for (const val of vec) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
      return false;
    }
  }

  // 检查维度
  if (expectedDimensions !== undefined && vec.length !== expectedDimensions) {
    return false;
  }

  return true;
}
