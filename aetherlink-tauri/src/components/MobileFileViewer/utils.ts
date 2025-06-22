import type { FileType } from './types';

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 获取文件类型
export const getFileType = (fileName: string): FileType => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';

  const textExts = ['txt', 'md', 'json', 'xml', 'csv', 'log'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'py', 'java', 'cpp', 'c', 'h'];
  const pdfExts = ['pdf'];

  if (textExts.includes(ext)) return 'text';
  if (imageExts.includes(ext)) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (pdfExts.includes(ext)) return 'pdf';

  return 'unknown';
};

// 获取编程语言
export const getLanguage = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return 'text';

  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'scss': 'css',
    'json': 'json',
    'md': 'markdown',
    'xml': 'xml',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c'
  };

  return langMap[ext] || 'text';
};


