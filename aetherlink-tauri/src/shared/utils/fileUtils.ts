/**
 * 文件处理工具
 * 提供文件处理相关的工具函数
 */
import { mobileFileStorage } from '../services/MobileFileStorageService';

/**
 * 文件类型接口
 */
export interface FileType {
  id: string;
  name?: string;
  origin_name?: string;
  ext?: string;
  mimeType?: string;
  size?: number;
  type?: string;
  path?: string;
  url?: string;
  content?: string;
  base64?: string;
  base64Data?: string;
}

/**
 * 文件类型枚举
 */
export const FileTypes = {
  IMAGE: 'image',
  TEXT: 'text',
  CODE: 'code',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
  ARCHIVE: 'archive',
  BINARY: 'binary',
  UNKNOWN: 'unknown'
}

/**
 * 根据文件扩展名判断文件类型
 * @param filename 文件名
 * @returns 文件类型
 */
export function getFileTypeByExtension(filename: string): string {
  if (!filename) return FileTypes.UNKNOWN;

  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // 图片文件
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'].includes(ext)) {
    return FileTypes.IMAGE;
  }

  // 代码文件 - 扩展支持更多编程语言
  if ([
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'sh', 'bat', 'ps1', 'sql', 'r', 'matlab', 'm', 'pl', 'lua', 'dart', 'vue', 'svelte',
    // 添加更多编程语言支持
    'hpp', 'cc', 'cxx', 'cppm', 'ipp', 'ixx', 'f90', 'f', 'f03', 'ahk', 'tcl', 'do', 'v', 'sv', 'vhd', 'vhdl',
    'asm', 'groovy', 'hs', 'clj', 'cljs', 'elm', 'erl', 'ex', 'exs', 'coffee', 'ino', 'gradle', 'kts',
    'mm', 'proto', 'thrift', 'graphql', 'gql'
  ].includes(ext)) {
    return FileTypes.CODE;
  }

  // 文本文件 - 大幅扩展支持的文本格式
  if ([
    'txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'mdx', 'yaml', 'yml', 'tsv', 'ini', 'log', 'rtf', 'org', 'wiki', 'tex', 'bib', 'srt', 'xhtml', 'nfo', 'conf', 'config', 'env', 'rst',
    // 模板文件
    'pug', 'haml', 'slim', 'tpl', 'ejs', 'hbs', 'mustache', 'jade', 'twig', 'blade',
    // 样式文件
    'less', 'scss', 'sass', 'styl',
    // 配置文件
    'toml', 'edn', 'cake', 'ctp', 'cfm', 'cfc',
    // Jupyter笔记本
    'ipynb'
  ].includes(ext)) {
    return FileTypes.TEXT;
  }

  // 文档文件 - 扩展支持更多文档格式
  if ([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
    // 添加电子书格式
    'epub',
    // 添加特殊应用格式
    'draftsexport'
  ].includes(ext)) {
    return FileTypes.DOCUMENT;
  }

  // 音频文件 - 扩展支持更多音频格式
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'].includes(ext)) {
    return FileTypes.AUDIO;
  }

  // 视频文件 - 扩展支持更多视频格式
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'ogv', '3gp', 'mp2', 'mpg', 'mpeg'].includes(ext)) {
    return FileTypes.VIDEO;
  }

  // 压缩文件 - 扩展支持更多压缩格式
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lzma', 'cab', 'iso'].includes(ext)) {
    return FileTypes.ARCHIVE;
  }

  // 二进制文件
  if (['exe', 'dll', 'so', 'bin', 'dat'].includes(ext)) {
    return FileTypes.BINARY;
  }

  return FileTypes.UNKNOWN;
}

/**
 * 根据MIME类型判断文件类型
 * @param mimeType MIME类型
 * @returns 文件类型
 */
export function getFileTypeByMimeType(mimeType: string): string {
  if (!mimeType || typeof mimeType !== 'string') return FileTypes.UNKNOWN;

  const parts = mimeType.split('/');
  const type = parts[0] || '';
  const subtype = parts[1] || '';

  switch (type) {
    case 'image':
      return FileTypes.IMAGE;
    case 'text':
      return FileTypes.TEXT;
    case 'audio':
      return FileTypes.AUDIO;
    case 'video':
      return FileTypes.VIDEO;
    case 'application':
      if (['pdf', 'msword', 'vnd.openxmlformats-officedocument.wordprocessingml.document',
           'vnd.ms-excel', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'vnd.ms-powerpoint', 'vnd.openxmlformats-officedocument.presentationml.presentation',
           'rtf', 'vnd.oasis.opendocument.text', 'vnd.oasis.opendocument.spreadsheet',
           'vnd.oasis.opendocument.presentation'].includes(subtype)) {
        return FileTypes.DOCUMENT;
      }
      if (['zip', 'x-rar-compressed', 'x-7z-compressed', 'x-tar', 'x-gzip', 'x-bzip2'].includes(subtype)) {
        return FileTypes.ARCHIVE;
      }
      if (['json', 'xml'].includes(subtype)) {
        return FileTypes.TEXT;
      }
      if (['octet-stream', 'x-msdownload', 'x-executable'].includes(subtype)) {
        return FileTypes.BINARY;
      }
      break;
    default:
      break;
  }

  return FileTypes.UNKNOWN;
}

/**
 * 获取文件的MIME类型
 * @param file 文件对象
 * @returns MIME类型
 */
export function getFileMimeType(file: FileType): string {
  if (file.mimeType) return file.mimeType;

  const ext = file.ext?.toLowerCase() || '';

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain';
    case '.md':
    case '.markdown':
      return 'text/markdown';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.xml':
      return 'application/xml';
    case '.csv':
      return 'text/csv';
    case '.py':
      return 'text/x-python';
    case '.java':
      return 'text/x-java-source';
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'text/x-c++src';
    case '.c':
      return 'text/x-csrc';
    case '.h':
    case '.hpp':
      return 'text/x-chdr';
    case '.cs':
      return 'text/x-csharp';
    case '.php':
      return 'application/x-httpd-php';
    case '.rb':
      return 'application/x-ruby';
    case '.go':
      return 'text/x-go';
    case '.rs':
      return 'text/x-rust';
    case '.swift':
      return 'text/x-swift';
    case '.kt':
      return 'text/x-kotlin';
    case '.scala':
      return 'text/x-scala';
    case '.sh':
      return 'application/x-sh';
    case '.bat':
      return 'application/x-bat';
    case '.sql':
      return 'application/sql';
    case '.yaml':
    case '.yml':
      return 'application/x-yaml';
    case '.toml':
      return 'application/toml';
    case '.ini':
      return 'text/plain';
    case '.log':
      return 'text/plain';
    case '.rtf':
      return 'application/rtf';
    case '.epub':
      return 'application/epub+zip';
    case '.ipynb':
      return 'application/x-ipynb+json';
    // 视频文件MIME类型
    case '.mp4':
      return 'video/mp4';
    case '.avi':
      return 'video/x-msvideo';
    case '.mov':
      return 'video/quicktime';
    case '.wmv':
      return 'video/x-ms-wmv';
    case '.flv':
      return 'video/x-flv';
    case '.mkv':
      return 'video/x-matroska';
    case '.webm':
      return 'video/webm';
    case '.ogv':
      return 'video/ogg';
    case '.3gp':
      return 'video/3gpp';
    case '.mpg':
    case '.mpeg':
      return 'video/mpeg';
    default:
      return 'application/octet-stream';
  }
}

/**
 * 读取文件内容
 * @param file 文件对象
 * @returns 文件内容
 */
export async function readFileContent(file: FileType): Promise<string> {
  try {
    // 使用静态导入的文件存储服务

    // 使用文件存储服务读取文件内容
    return await mobileFileStorage.readFile(file.id);
  } catch (error) {
    console.error('[fileUtils.readFileContent] 读取文件内容失败:', error);

    // 降级处理：返回文件基本信息
    return `文件: ${file.origin_name || file.name || '未知文件'}\n类型: ${file.type || '未知'}\n大小: ${file.size || 0} bytes`;
  }
}

/**
 * 将文件转换为Base64
 * @param file 文件对象
 * @returns Base64编码的文件内容
 */
export async function fileToBase64(file: FileType): Promise<string> {
  try {
    // 使用静态导入的文件存储服务

    // 使用文件存储服务获取base64数据
    const result = await mobileFileStorage.getFileBase64(file.id);
    return result.data;
  } catch (error) {
    console.error('[fileUtils.fileToBase64] 转换文件为Base64失败:', error);

    // 降级处理：返回占位符
    return `data:${getFileMimeType(file)};base64,`;
  }
}


