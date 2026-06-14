import { simpleNoteService, NOTE_STORAGE_PATH_KEY } from './SimpleNoteService';
import { isCapacitor } from '../../utils/platformDetection';
import type { NoteFile } from '../../types/note';
import { dexieStorage } from '../storage/DexieStorageService';
import { AdvancedFileManager } from 'capacitor-advanced-file-manager';
import { createLogger } from '../infra/logger';
const logger = createLogger('NotesSearch');

/**
 * 搜索匹配结果
 */
export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
  context: string;
}

/**
 * 搜索结果
 */
export interface SearchResult extends NoteFile {
  matchType: 'filename' | 'content' | 'both';
  matches?: SearchMatch[];
  score: number;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  caseSensitive?: boolean;
  maxMatchesPerFile?: number;
  contextLength?: number;
  searchContent?: boolean; // 是否搜索文件内容
  maxFiles?: number; // 最大搜索文件数
  maxFileSize?: number; // 最大文件大小 (bytes)
  maxDepth?: number; // 最大递归深度
}

/**
 * 转义正则特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 计算相关性评分
 */
function calculateScore(node: NoteFile, keyword: string, matches: SearchMatch[]): number {
  let score = 0;
  const lowerName = node.name.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // 完全匹配文件名（最高权重）
  if (lowerName === lowerKeyword || lowerName === `${lowerKeyword}.md`) {
    score += 200;
  }
  // 文件名包含关键词（高权重）
  else if (lowerName.includes(lowerKeyword)) {
    score += 100;
  }

  // 内容匹配数量
  score += Math.min(matches.length * 2, 50);

  // 文件夹优先级稍低
  if (node.isDirectory) {
    score -= 10;
  }

  return score;
}

/**
 * 检查文件名是否匹配
 */
function matchFileName(node: NoteFile, keyword: string, caseSensitive = false): boolean {
  const name = caseSensitive ? node.name : node.name.toLowerCase();
  const key = caseSensitive ? keyword : keyword.toLowerCase();
  return name.includes(key);
}

/**
 * 搜索文件内容
 */
async function searchFileContent(
  node: NoteFile,
  keyword: string,
  options: SearchOptions = {}
): Promise<SearchMatch[]> {
  const {
    caseSensitive = false,
    maxMatchesPerFile = 10,
    contextLength = 40,
    maxFileSize = 5 * 1024 * 1024 // 5MB
  } = options;

  if (node.isDirectory) {
    return [];
  }

  // 检查文件大小，跳过大文件
  if (node.size && node.size > maxFileSize) {
    logger.debug(`跳过大文件: ${node.path} (${(node.size / 1024).toFixed(1)} KB)`);
    return [];
  }

  try {
    const content = await simpleNoteService.readNote(node.path);
    
    if (!content) {
      return [];
    }
    
    // 再次检查内容大小（以防 size 字段不准确）
    if (content.length > maxFileSize) {
      logger.debug(`跳过大文件内容: ${node.path} (${(content.length / 1024).toFixed(1)} KB)`);
      return [];
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(escapeRegex(keyword), flags);

    const lines = content.split('\n');
    const matches: SearchMatch[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;

        // 上下文：匹配前2字符，匹配后更多
        const beforeMatch = Math.min(2, matchStart);
        const contextStart = matchStart - beforeMatch;
        const contextEnd = Math.min(line.length, matchEnd + contextLength);

        const prefix = contextStart > 0 ? '...' : '';
        const contextText = prefix + line.substring(contextStart, contextEnd);

        matches.push({
          lineNumber: i + 1,
          lineContent: line,
          matchStart: beforeMatch + prefix.length,
          matchEnd: matchEnd - matchStart + beforeMatch + prefix.length,
          context: contextText
        });

        if (matches.length >= maxMatchesPerFile) {
          break;
        }
      }

      if (matches.length >= maxMatchesPerFile) {
        break;
      }
    }

    return matches;
  } catch (error) {
    logger.error(`搜索文件内容失败: ${node.path}`, error);
    return [];
  }
}

/**
 * 递归获取所有文件（扁平化）
 * @param subPath 子路径
 * @param maxFiles 最大文件数
 * @param maxDepth 最大递归深度
 * @param currentDepth 当前深度
 */
async function getAllFilesRecursive(
  subPath: string = '',
  maxFiles: number = 100,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<NoteFile[]> {
  const result: NoteFile[] = [];
  
  // 超过最大深度，停止递归
  if (currentDepth >= maxDepth) {
    return result;
  }
  
  try {
    const items = await simpleNoteService.listNotes(subPath);
    
    for (const item of items) {
      // 超过最大文件数，停止
      if (result.length >= maxFiles) {
        break;
      }
      
      result.push(item);
      
      if (item.isDirectory && result.length < maxFiles) {
        const children = await getAllFilesRecursive(
          item.path, 
          maxFiles - result.length,
          maxDepth,
          currentDepth + 1
        );
        result.push(...children);
      }
    }
  } catch (error) {
    logger.error(`获取文件列表失败: ${subPath}`, error);
  }
  
  return result;
}

/**
 * 获取笔记存储根目录
 */
async function getNotesRootPath(): Promise<string> {
  const storagePath = await dexieStorage.getSetting(NOTE_STORAGE_PATH_KEY);
  return storagePath || '';
}

/**
 * 使用原生 API 搜索（Android/iOS）
 */
async function searchNotesNative(
  keyword: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { 
    caseSensitive = false,
    maxMatchesPerFile = 10,
    contextLength = 40,
    maxFiles = 100,
    maxFileSize = 5 * 1024 * 1024, // 5MB - 原生搜索内存占用低，可以支持更大文件
    maxDepth = 5
  } = options;

  try {
    const rootPath = await getNotesRootPath();
    if (!rootPath) {
      logger.warn('笔记存储路径未配置');
      return [];
    }

    logger.debug(`原生搜索 目录: ${rootPath}, 关键词: ${keyword}`);

    const result = await AdvancedFileManager.searchContent({
      directory: rootPath,
      keyword: keyword,
      caseSensitive,
      fileExtensions: ['.md', '.txt', '.json'],
      maxFiles,
      maxFileSize,
      maxMatchesPerFile,
      contextLength,
      maxDepth,
      recursive: true
    });

    logger.debug(`原生搜索 完成: ${result.totalFiles} 文件, ${result.totalMatches} 匹配, ${result.duration}ms`);

    // 转换原生结果为 SearchResult
    return result.results.map((r: {
      path: string;
      name: string;
      matchType: string;
      matches: Array<{
        lineNumber: number;
        lineContent: string;
        matchStart: number;
        matchEnd: number;
        context: string;
      }>;
      score: number;
    }) => ({
      id: r.path,
      name: r.name,
      path: r.path.replace(rootPath + '/', '').replace(rootPath, ''),
      isDirectory: false,
      lastModified: new Date().toISOString(),
      extension: r.name.split('.').pop() || '',
      matchType: r.matchType as 'filename' | 'content' | 'both',
      matches: r.matches.map((m) => ({
        lineNumber: m.lineNumber,
        lineContent: m.lineContent,
        matchStart: m.matchStart,
        matchEnd: m.matchEnd,
        context: m.context
      })),
      score: r.score
    }));
  } catch (error) {
    logger.error('原生搜索 失败:', error);
    // 回退到 JS 搜索
    return searchNotesJS(keyword, options);
  }
}

/**
 * 使用 JS 搜索（Web 回退）
 */
async function searchNotesJS(
  keyword: string,
  options: SearchOptions = {},
  signal?: AbortSignal
): Promise<SearchResult[]> {
  const { 
    searchContent = true, 
    maxFiles = 100,
    maxDepth = 5,
    ...restOptions 
  } = options;
  const results: SearchResult[] = [];

  try {
    const allFiles = await getAllFilesRecursive('', maxFiles, maxDepth);
    logger.debug(`JS搜索 范围: ${allFiles.length} 个文件/文件夹`);

    for (const file of allFiles) {
      if (signal?.aborted) {
        break;
      }

      const nameMatch = matchFileName(file, keyword, options.caseSensitive);
      let contentMatches: SearchMatch[] = [];

      if (searchContent && !file.isDirectory) {
        contentMatches = await searchFileContent(file, keyword, restOptions);
      }

      if (nameMatch && contentMatches.length > 0) {
        results.push({
          ...file,
          matchType: 'both',
          matches: contentMatches,
          score: calculateScore(file, keyword, contentMatches) + 100
        });
      } else if (nameMatch) {
        results.push({
          ...file,
          matchType: 'filename',
          matches: [],
          score: calculateScore(file, keyword, [])
        });
      } else if (contentMatches.length > 0) {
        results.push({
          ...file,
          matchType: 'content',
          matches: contentMatches,
          score: calculateScore(file, keyword, contentMatches)
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  } catch (error) {
    logger.error('JS搜索 失败:', error);
    return [];
  }
}

/**
 * 搜索笔记（自动选择原生或JS实现）
 */
export async function searchNotes(
  keyword: string,
  options: SearchOptions = {},
  signal?: AbortSignal
): Promise<SearchResult[]> {
  if (!keyword.trim()) {
    return [];
  }

  // 原生平台使用原生搜索 API
  if (isCapacitor()) {
    return searchNotesNative(keyword, options);
  }
  
  // Web 平台使用 JS 搜索
  return searchNotesJS(keyword, options, signal);
}

/**
 * 仅搜索文件名（快速过滤，用于当前目录）
 */
export function filterByName(
  files: NoteFile[],
  keyword: string,
  caseSensitive = false
): NoteFile[] {
  if (!keyword.trim()) {
    return files;
  }

  return files.filter(file => matchFileName(file, keyword, caseSensitive));
}
