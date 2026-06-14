/**
 * 统一文件管理服务
 * 为 Tauri 和 Capacitor 双架构提供统一的文件管理 API
 * 自动根据运行平台选择对应的后端实现
 */

import { isTauri, isCapacitor } from '../../utils/platformDetection';
import { agenticFileTracker } from '../ai/AgenticFileTracker';
import type {
  PermissionResult,
  FileInfo,
  ListDirectoryOptions,
  ListDirectoryResult,
  CreateDirectoryOptions,
  FileOperationOptions,
  CreateFileOptions,
  ReadFileOptions,
  ReadFileResult,
  WriteFileOptions,
  MoveFileOptions,
  CopyFileOptions,
  RenameFileOptions,
  SearchFilesOptions,
  SearchFilesResult,
  SystemFilePickerOptions,
  SystemFilePickerResult,
  SelectedFileInfo,
  // AI 编辑相关
  ReadFileRangeOptions,
  ReadFileRangeResult,
  InsertContentOptions,
  ReplaceInFileOptions,
  ReplaceInFileResult,
  ApplyDiffOptions,
  ApplyDiffResult,
  GetFileHashOptions,
  GetFileHashResult,
  GetLineCountResult
} from '../../types/fileManager';
import { createLogger } from '../infra/logger';
const logger = createLogger('UnifiedFileManager');

// ============================================
// Tauri 实现
// ============================================

class TauriFileManagerImpl {
  private shellModule: typeof import('@tauri-apps/plugin-shell') | null = null;
  private dialogModule: typeof import('@tauri-apps/plugin-dialog') | null = null;
  private fsModule: typeof import('@tauri-apps/plugin-fs') | null = null;

  private async loadModules() {
    if (!this.shellModule) {
      this.shellModule = await import('@tauri-apps/plugin-shell');
    }
    if (!this.dialogModule) {
      this.dialogModule = await import('@tauri-apps/plugin-dialog');
    }
    if (!this.fsModule) {
      this.fsModule = await import('@tauri-apps/plugin-fs');
    }
  }

  async requestPermissions(): Promise<PermissionResult> {
    // Tauri 桌面端不需要权限请求
    return { granted: true, message: '桌面端无需权限' };
  }

  async checkPermissions(): Promise<PermissionResult> {
    return { granted: true, message: '桌面端无需权限' };
  }

  async openSystemFilePicker(options: SystemFilePickerOptions): Promise<SystemFilePickerResult> {
    await this.loadModules();
    const dialog = this.dialogModule!;

    try {
      let result: string | string[] | null = null;

      if (options.type === 'directory') {
        // 选择文件夹
        result = await dialog.open({
          title: options.title || '选择文件夹',
          directory: true,
          multiple: options.multiple,
          defaultPath: options.startDirectory
        });
      } else {
        // 选择文件
        result = await dialog.open({
          title: options.title || '选择文件',
          directory: false,
          multiple: options.multiple,
          filters: options.accept?.length ? [{
            name: '文件',
            extensions: options.accept.map(ext => ext.replace('.', ''))
          }] : undefined,
          defaultPath: options.startDirectory
        });
      }

      if (!result) {
        return { files: [], directories: [], cancelled: true };
      }

      const paths = Array.isArray(result) ? result : [result];
      const fs = this.fsModule!;

      const items: SelectedFileInfo[] = await Promise.all(
        paths.map(async (path) => {
          try {
            const stat = await fs.stat(path);
            const name = path.split(/[/\\]/).pop() || '';
            return {
              name,
              path,
              uri: path,
              size: stat.size,
              type: stat.isDirectory ? 'directory' : 'file',
              mimeType: stat.isDirectory ? 'inode/directory' : this.getMimeType(name),
              mtime: stat.mtime ? new Date(stat.mtime).getTime() : Date.now(),
              ctime: stat.mtime ? new Date(stat.mtime).getTime() : Date.now()
            } as SelectedFileInfo;
          } catch {
            return {
              name: path.split(/[/\\]/).pop() || '',
              path,
              uri: path,
              size: 0,
              type: 'file' as const,
              mimeType: 'application/octet-stream',
              mtime: Date.now(),
              ctime: Date.now()
            };
          }
        })
      );

      const files = items.filter(i => i.type === 'file');
      const directories = items.filter(i => i.type === 'directory');

      return { files, directories, cancelled: false };
    } catch (error) {
      logger.error('Tauri 文件选择器错误:', error);
      return { files: [], directories: [], cancelled: true };
    }
  }

  async openSystemFileManager(path?: string): Promise<void> {
    await this.loadModules();
    const shell = this.shellModule!;

    try {
      if (path) {
        await shell.open(path);
      }
    } catch (error) {
      logger.error('打开文件管理器失败:', error);
      throw new Error('打开文件管理器失败');
    }
  }

  async openFileWithSystemApp(filePath: string, _mimeType?: string): Promise<void> {
    await this.loadModules();
    const shell = this.shellModule!;

    try {
      await shell.open(filePath);
    } catch (error) {
      logger.error('打开文件失败:', error);
      throw new Error('打开文件失败');
    }
  }

  async listDirectory(options: ListDirectoryOptions): Promise<ListDirectoryResult> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      const entries = await fs.readDir(options.path);
      const files: FileInfo[] = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = `${options.path}/${entry.name}`;
          try {
            const stat = await fs.stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              size: stat.size,
              type: stat.isDirectory ? 'directory' : 'file',
              mtime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
              ctime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
              permissions: '',
              isHidden: entry.name.startsWith('.')
            } as FileInfo;
          } catch {
            return {
              name: entry.name,
              path: fullPath,
              size: 0,
              type: entry.isDirectory ? 'directory' : 'file',
              mtime: 0,
              ctime: 0,
              permissions: '',
              isHidden: entry.name.startsWith('.')
            };
          }
        })
      );

      // 过滤隐藏文件
      let filteredFiles = options.showHidden ? files : files.filter(f => !f.isHidden);

      // 排序
      filteredFiles.sort((a, b) => {
        let comparison = 0;
        switch (options.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = a.size - b.size;
            break;
          case 'mtime':
            comparison = a.mtime - b.mtime;
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
        }
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });

      return { files: filteredFiles, totalCount: filteredFiles.length };
    } catch (error) {
      logger.error('列出目录失败:', error);
      throw new Error('列出目录失败');
    }
  }

  async createDirectory(options: CreateDirectoryOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      await fs.mkdir(options.path, { recursive: options.recursive });
    } catch (error) {
      logger.error('创建目录失败:', error);
      throw new Error('创建目录失败');
    }
  }

  async deleteDirectory(options: FileOperationOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      await fs.remove(options.path, { recursive: true });
    } catch (error) {
      logger.error('删除目录失败:', error);
      throw new Error('删除目录失败');
    }
  }

  async createFile(options: CreateFileOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      if (options.encoding === 'base64') {
        const bytes = Uint8Array.from(atob(options.content), c => c.charCodeAt(0));
        await fs.writeFile(options.path, bytes);
      } else {
        await fs.writeTextFile(options.path, options.content);
      }
    } catch (error) {
      logger.error('创建文件失败:', error);
      throw new Error('创建文件失败');
    }
  }

  async readFile(options: ReadFileOptions): Promise<ReadFileResult> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      if (options.encoding === 'base64') {
        // 使用官方 fs 插件读取二进制文件
        const bytes = await fs.readFile(options.path);
        const base64 = btoa(String.fromCharCode(...bytes));
        return { content: base64, encoding: 'base64' };
      } else {
        // 使用官方 fs 插件读取文本文件
        const content = await fs.readTextFile(options.path);
        // 确保返回的是字符串
        if (typeof content !== 'string') {
          logger.warn('readTextFile 返回非字符串类型:', typeof content, content);
          return { content: String(content), encoding: 'utf8' };
        }
        return { content, encoding: 'utf8' };
      }
    } catch (error) {
      logger.error('读取文件失败:', error);
      throw new Error('读取文件失败');
    }
  }

  async writeFile(options: WriteFileOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      if (options.encoding === 'base64') {
        const bytes = Uint8Array.from(atob(options.content), c => c.charCodeAt(0));
        await fs.writeFile(options.path, bytes, { append: options.append });
      } else {
        await fs.writeTextFile(options.path, options.content, { append: options.append });
      }
    } catch (error) {
      logger.error('写入文件失败:', error);
      throw new Error('写入文件失败');
    }
  }

  async deleteFile(options: FileOperationOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      await fs.remove(options.path);
    } catch (error) {
      logger.error('删除文件失败:', error);
      throw new Error('删除文件失败');
    }
  }

  async moveFile(options: MoveFileOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      await fs.rename(options.sourcePath, options.destinationPath);
    } catch (error) {
      logger.error('移动文件失败:', error);
      throw new Error('移动文件失败');
    }
  }

  async copyFile(options: CopyFileOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      await fs.copyFile(options.sourcePath, options.destinationPath);
    } catch (error) {
      logger.error('复制文件失败:', error);
      throw new Error('复制文件失败');
    }
  }

  async renameFile(options: RenameFileOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      const dir = options.path.substring(0, options.path.lastIndexOf('/'));
      const newPath = `${dir}/${options.newName}`;
      await fs.rename(options.path, newPath);
    } catch (error) {
      logger.error('重命名文件失败:', error);
      throw new Error('重命名文件失败');
    }
  }

  async getFileInfo(options: FileOperationOptions): Promise<FileInfo> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      const stat = await fs.stat(options.path);
      const name = options.path.split(/[/\\]/).pop() || '';
      return {
        name,
        path: options.path,
        size: stat.size,
        type: stat.isDirectory ? 'directory' : 'file',
        mtime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
        ctime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
        permissions: '',
        isHidden: name.startsWith('.')
      };
    } catch (error) {
      logger.error('获取文件信息失败:', error);
      throw new Error('获取文件信息失败');
    }
  }

  async exists(options: FileOperationOptions): Promise<{ exists: boolean }> {
    await this.loadModules();
    const fs = this.fsModule!;

    try {
      const result = await fs.exists(options.path);
      return { exists: Boolean(result) };
    } catch {
      return { exists: false };
    }
  }

  // ========== AI 编辑相关（Tauri 使用官方 fs 插件）==========

  async readFileRange(options: ReadFileRangeOptions): Promise<ReadFileRangeResult> {
    await this.loadModules();
    const fs = this.fsModule!;
    const content = await fs.readTextFile(options.path);
    const lines = content.split('\n');
    const totalLines = lines.length;
    const start = Math.max(1, options.startLine);
    const end = Math.min(totalLines, options.endLine);
    const rangeLines = lines.slice(start - 1, end);
    const rangeContent = rangeLines.join('\n');
    const rangeHash = await this.simpleHash(rangeContent);
    return { content: rangeContent, totalLines, startLine: start, endLine: end, rangeHash };
  }

  async insertContent(options: InsertContentOptions): Promise<void> {
    await this.loadModules();
    const fs = this.fsModule!;
    const content = await fs.readTextFile(options.path);
    const lines = content.split('\n');
    const insertIndex = Math.max(0, Math.min(lines.length, options.line - 1));
    const newLines = options.content.split('\n');
    lines.splice(insertIndex, 0, ...newLines);
    await fs.writeTextFile(options.path, lines.join('\n'));
  }

  async replaceInFile(options: ReplaceInFileOptions): Promise<ReplaceInFileResult> {
    await this.loadModules();
    const fs = this.fsModule!;
    let content = await fs.readTextFile(options.path);
    let replacements = 0;
    const flags = options.caseSensitive ? 'g' : 'gi';
    
    if (options.isRegex) {
      const regex = new RegExp(options.search, options.replaceAll ? flags : flags.replace('g', ''));
      const matches = content.match(new RegExp(options.search, flags));
      replacements = matches ? matches.length : 0;
      content = content.replace(regex, options.replace);
    } else {
      if (options.replaceAll) {
        const parts = content.split(options.search);
        replacements = parts.length - 1;
        content = parts.join(options.replace);
      } else {
        const idx = content.indexOf(options.search);
        if (idx !== -1) {
          content = content.slice(0, idx) + options.replace + content.slice(idx + options.search.length);
          replacements = 1;
        }
      }
    }
    
    if (replacements > 0) {
      await fs.writeTextFile(options.path, content);
    }
    return { replacements, modified: replacements > 0 };
  }

  async applyDiff(_options: ApplyDiffOptions): Promise<ApplyDiffResult> {
    // Tauri 暂不支持 diff，返回失败
    throw new Error('Tauri 桌面端暂不支持 applyDiff，请使用 replaceInFile');
  }

  async getFileHash(options: GetFileHashOptions): Promise<GetFileHashResult> {
    await this.loadModules();
    const fs = this.fsModule!;
    const content = await fs.readTextFile(options.path);
    const hash = await this.simpleHash(content, options.algorithm);
    return { hash, algorithm: options.algorithm || 'md5' };
  }

  async getLineCount(options: FileOperationOptions): Promise<GetLineCountResult> {
    await this.loadModules();
    const fs = this.fsModule!;
    const content = await fs.readTextFile(options.path);
    return { lines: content.split('\n').length };
  }

  private async simpleHash(content: string, algorithm: string = 'md5'): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest(algorithm === 'sha256' ? 'SHA-256' : 'SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    await this.loadModules();
    const fs = this.fsModule!;

    const results: FileInfo[] = [];
    const maxResults = options.maxResults || 100;

    const searchInDir = async (dir: string, depth: number = 0) => {
      if (results.length >= maxResults) return;
      if (!options.recursive && depth > 0) return;

      try {
        const entries = await fs.readDir(dir);
        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const fullPath = `${dir}/${entry.name}`;
          const matchesName = options.searchType !== 'content' &&
            entry.name.toLowerCase().includes(options.query.toLowerCase());

          const matchesType = options.fileTypes.length === 0 ||
            options.fileTypes.some(t => entry.name.endsWith(t));

          if (matchesName && matchesType) {
            try {
              const stat = await fs.stat(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                size: stat.size,
                type: stat.isDirectory ? 'directory' : 'file',
                mtime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
                ctime: stat.mtime ? new Date(stat.mtime).getTime() : 0,
                permissions: '',
                isHidden: entry.name.startsWith('.')
              });
            } catch {
              // 忽略无法访问的文件
            }
          }

          if (entry.isDirectory && options.recursive) {
            await searchInDir(fullPath, depth + 1);
          }
        }
      } catch {
        // 忽略无法访问的目录
      }
    };

    await searchInDir(options.directory);
    return { files: results, totalFound: results.length };
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'md': 'text/markdown'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// ============================================
// Capacitor 实现 (使用现有的 AdvancedFileManagerService)
// ============================================

class CapacitorFileManagerImpl {
  private service: typeof import('./AdvancedFileManagerService').advancedFileManagerService | null = null;

  private async loadService() {
    if (!this.service) {
      const module = await import('./AdvancedFileManagerService');
      this.service = module.advancedFileManagerService;
    }
    return this.service;
  }

  async requestPermissions(): Promise<PermissionResult> {
    const service = await this.loadService();
    return service.requestPermissions();
  }

  async checkPermissions(): Promise<PermissionResult> {
    const service = await this.loadService();
    return service.checkPermissions();
  }

  async openSystemFilePicker(options: SystemFilePickerOptions): Promise<SystemFilePickerResult> {
    const service = await this.loadService();
    return service.openSystemFilePicker(options);
  }

  async openSystemFileManager(path?: string): Promise<void> {
    const service = await this.loadService();
    return service.openSystemFileManager(path);
  }

  async openFileWithSystemApp(filePath: string, mimeType?: string): Promise<void> {
    const service = await this.loadService();
    return service.openFileWithSystemApp(filePath, mimeType);
  }

  async listDirectory(options: ListDirectoryOptions): Promise<ListDirectoryResult> {
    const service = await this.loadService();
    return service.listDirectory(options);
  }

  async createDirectory(options: CreateDirectoryOptions): Promise<void> {
    const service = await this.loadService();
    return service.createDirectory(options);
  }

  async deleteDirectory(options: FileOperationOptions): Promise<void> {
    const service = await this.loadService();
    return service.deleteDirectory(options);
  }

  async createFile(options: CreateFileOptions): Promise<void> {
    const service = await this.loadService();
    return service.createFile(options);
  }

  async readFile(options: ReadFileOptions): Promise<ReadFileResult> {
    const service = await this.loadService();
    return service.readFile(options);
  }

  async writeFile(options: WriteFileOptions): Promise<void> {
    const service = await this.loadService();
    return service.writeFile(options);
  }

  async deleteFile(options: FileOperationOptions): Promise<void> {
    const service = await this.loadService();
    return service.deleteFile(options);
  }

  async moveFile(options: MoveFileOptions): Promise<void> {
    const service = await this.loadService();
    return service.moveFile(options);
  }

  async copyFile(options: CopyFileOptions): Promise<void> {
    const service = await this.loadService();
    return service.copyFile(options);
  }

  async renameFile(options: RenameFileOptions): Promise<void> {
    const service = await this.loadService();
    return service.renameFile(options);
  }

  async getFileInfo(options: FileOperationOptions): Promise<FileInfo> {
    const service = await this.loadService();
    return service.getFileInfo(options);
  }

  async exists(options: FileOperationOptions): Promise<{ exists: boolean }> {
    const service = await this.loadService();
    const result = await service.exists(options);
    return { exists: result };
  }

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    const service = await this.loadService();
    return service.searchFiles(options);
  }

  // ========== AI 编辑相关 ==========

  async readFileRange(options: ReadFileRangeOptions): Promise<ReadFileRangeResult> {
    const service = await this.loadService();
    return service.readFileRange(options);
  }

  async insertContent(options: InsertContentOptions): Promise<void> {
    const service = await this.loadService();
    return service.insertContent(options);
  }

  async replaceInFile(options: ReplaceInFileOptions): Promise<ReplaceInFileResult> {
    const service = await this.loadService();
    return service.replaceInFile(options);
  }

  async applyDiff(options: ApplyDiffOptions): Promise<ApplyDiffResult> {
    const service = await this.loadService();
    return service.applyDiff(options);
  }

  async getFileHash(options: GetFileHashOptions): Promise<GetFileHashResult> {
    const service = await this.loadService();
    return service.getFileHash(options);
  }

  async getLineCount(options: FileOperationOptions): Promise<GetLineCountResult> {
    const service = await this.loadService();
    return service.getLineCount(options);
  }
}

// ============================================
// Web 降级实现
// ============================================

class WebFileManagerImpl {
  async requestPermissions(): Promise<PermissionResult> {
    return { granted: false, message: '文件管理功能仅在原生应用中可用' };
  }

  async checkPermissions(): Promise<PermissionResult> {
    return { granted: false, message: '文件管理功能仅在原生应用中可用' };
  }

  async openSystemFilePicker(_options: SystemFilePickerOptions): Promise<SystemFilePickerResult> {
    throw new Error('文件选择器仅在原生应用中可用');
  }

  async openSystemFileManager(_path?: string): Promise<void> {
    throw new Error('文件管理器仅在原生应用中可用');
  }

  async openFileWithSystemApp(_filePath: string, _mimeType?: string): Promise<void> {
    throw new Error('打开文件功能仅在原生应用中可用');
  }

  async listDirectory(_options: ListDirectoryOptions): Promise<ListDirectoryResult> {
    throw new Error('目录列表功能仅在原生应用中可用');
  }

  async createDirectory(_options: CreateDirectoryOptions): Promise<void> {
    throw new Error('创建目录功能仅在原生应用中可用');
  }

  async deleteDirectory(_options: FileOperationOptions): Promise<void> {
    throw new Error('删除目录功能仅在原生应用中可用');
  }

  async createFile(_options: CreateFileOptions): Promise<void> {
    throw new Error('创建文件功能仅在原生应用中可用');
  }

  async readFile(_options: ReadFileOptions): Promise<ReadFileResult> {
    throw new Error('读取文件功能仅在原生应用中可用');
  }

  async writeFile(_options: WriteFileOptions): Promise<void> {
    throw new Error('写入文件功能仅在原生应用中可用');
  }

  async deleteFile(_options: FileOperationOptions): Promise<void> {
    throw new Error('删除文件功能仅在原生应用中可用');
  }

  async moveFile(_options: MoveFileOptions): Promise<void> {
    throw new Error('移动文件功能仅在原生应用中可用');
  }

  async copyFile(_options: CopyFileOptions): Promise<void> {
    throw new Error('复制文件功能仅在原生应用中可用');
  }

  async renameFile(_options: RenameFileOptions): Promise<void> {
    throw new Error('重命名文件功能仅在原生应用中可用');
  }

  async getFileInfo(_options: FileOperationOptions): Promise<FileInfo> {
    throw new Error('获取文件信息功能仅在原生应用中可用');
  }

  async exists(_options: FileOperationOptions): Promise<{ exists: boolean }> {
    return { exists: false };
  }

  async searchFiles(_options: SearchFilesOptions): Promise<SearchFilesResult> {
    throw new Error('搜索文件功能仅在原生应用中可用');
  }

  // ========== AI 编辑相关 ==========

  async readFileRange(_options: ReadFileRangeOptions): Promise<ReadFileRangeResult> {
    throw new Error('读取文件范围功能仅在原生应用中可用');
  }

  async insertContent(_options: InsertContentOptions): Promise<void> {
    throw new Error('插入内容功能仅在原生应用中可用');
  }

  async replaceInFile(_options: ReplaceInFileOptions): Promise<ReplaceInFileResult> {
    throw new Error('替换内容功能仅在原生应用中可用');
  }

  async applyDiff(_options: ApplyDiffOptions): Promise<ApplyDiffResult> {
    throw new Error('应用 diff 功能仅在原生应用中可用');
  }

  async getFileHash(_options: GetFileHashOptions): Promise<GetFileHashResult> {
    throw new Error('获取文件哈希功能仅在原生应用中可用');
  }

  async getLineCount(_options: FileOperationOptions): Promise<GetLineCountResult> {
    throw new Error('获取行数功能仅在原生应用中可用');
  }
}

// TauriAndroidFileManagerImpl 已移除 - Tauri 移动端不再维护

// ============================================
// 统一服务类
// ============================================

type FileManagerImpl = TauriFileManagerImpl | CapacitorFileManagerImpl | WebFileManagerImpl;

class UnifiedFileManagerService {
  private impl: FileManagerImpl | null = null;

  private getImpl(): FileManagerImpl {
    if (!this.impl) {
      // Tauri 桌面端
      if (isTauri()) {
        logger.debug('使用 Tauri 桌面实现');
        this.impl = new TauriFileManagerImpl();
      } 
      // Capacitor (包括 Android/iOS)
      else if (isCapacitor()) {
        logger.debug('使用 Capacitor 实现');
        this.impl = new CapacitorFileManagerImpl();
      } 
      // Web 降级
      else {
        logger.debug('使用 Web 降级实现');
        this.impl = new WebFileManagerImpl();
      }
    }
    return this.impl!;
  }

  /**
   * 检查当前平台是否支持文件管理功能
   */
  isSupported(): boolean {
    return isTauri() || isCapacitor();
  }

  /**
   * 获取当前使用的平台类型
   */
  getPlatformType(): 'tauri' | 'capacitor' | 'web' {
    if (isTauri()) return 'tauri';
    if (isCapacitor()) return 'capacitor';
    return 'web';
  }

  // ========== 权限相关 ==========

  async requestPermissions(): Promise<PermissionResult> {
    return this.getImpl().requestPermissions();
  }

  async checkPermissions(): Promise<PermissionResult> {
    return this.getImpl().checkPermissions();
  }

  // ========== 文件选择器 ==========

  async openSystemFilePicker(options: SystemFilePickerOptions): Promise<SystemFilePickerResult> {
    return this.getImpl().openSystemFilePicker(options);
  }

  async openSystemFileManager(path?: string): Promise<void> {
    return this.getImpl().openSystemFileManager(path);
  }

  async openFileWithSystemApp(filePath: string, mimeType?: string): Promise<void> {
    return this.getImpl().openFileWithSystemApp(filePath, mimeType);
  }

  // ========== 目录操作 ==========

  async listDirectory(options: ListDirectoryOptions): Promise<ListDirectoryResult> {
    return this.getImpl().listDirectory(options);
  }

  async createDirectory(options: CreateDirectoryOptions): Promise<void> {
    return this.getImpl().createDirectory(options);
  }

  async deleteDirectory(options: FileOperationOptions): Promise<void> {
    return this.getImpl().deleteDirectory(options);
  }

  // ========== 文件操作 (带自动跟踪) ==========

  async createFile(options: CreateFileOptions): Promise<void> {
    await this.getImpl().createFile(options);
    // 自动跟踪文件创建
    agenticFileTracker.trackFileCreate(options.path, options.content || '');
  }

  async readFile(options: ReadFileOptions): Promise<ReadFileResult> {
    return this.getImpl().readFile(options);
  }

  async writeFile(options: WriteFileOptions): Promise<void> {
    // 先读取原始内容
    let originalContent = '';
    let isNewFile = false;
    try {
      const existing = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      originalContent = existing.content;
    } catch {
      isNewFile = true;
    }

    await this.getImpl().writeFile(options);

    // 自动跟踪文件修改
    if (isNewFile) {
      agenticFileTracker.trackFileCreate(options.path, options.content);
    } else {
      agenticFileTracker.trackFileModify(options.path, originalContent, options.content);
    }
  }

  async deleteFile(options: FileOperationOptions): Promise<void> {
    // 先读取原始内容
    let originalContent: string | undefined;
    try {
      const existing = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      originalContent = existing.content;
    } catch {
      // 文件不存在或无法读取
    }

    await this.getImpl().deleteFile(options);
    
    // 自动跟踪文件删除
    agenticFileTracker.trackFileDelete(options.path, originalContent);
  }

  async moveFile(options: MoveFileOptions): Promise<void> {
    await this.getImpl().moveFile(options);
    // 自动跟踪文件移动
    agenticFileTracker.trackFileMove(options.sourcePath, options.destinationPath);
  }

  async copyFile(options: CopyFileOptions): Promise<void> {
    await this.getImpl().copyFile(options);
    // 复制不需要跟踪，因为原文件没有变化
  }

  async renameFile(options: RenameFileOptions): Promise<void> {
    // 计算新路径
    const pathParts = options.path.split(/[/\\]/);
    pathParts[pathParts.length - 1] = options.newName;
    const newPath = pathParts.join('/');

    await this.getImpl().renameFile(options);
    // 自动跟踪文件重命名
    agenticFileTracker.trackFileRename(options.path, newPath);
  }

  // ========== 文件信息 ==========

  async getFileInfo(options: FileOperationOptions): Promise<FileInfo> {
    return this.getImpl().getFileInfo(options);
  }

  async exists(options: FileOperationOptions): Promise<{ exists: boolean }> {
    return this.getImpl().exists(options);
  }

  // ========== 搜索 ==========

  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    return this.getImpl().searchFiles(options);
  }

  // ========== AI 编辑相关 (带自动跟踪) ==========

  async readFileRange(options: ReadFileRangeOptions): Promise<ReadFileRangeResult> {
    return this.getImpl().readFileRange(options);
  }

  async insertContent(options: InsertContentOptions): Promise<void> {
    // 先读取原始内容
    let originalContent = '';
    try {
      const existing = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      originalContent = existing.content;
    } catch {
      // 文件不存在
    }

    await this.getImpl().insertContent(options);

    // 读取修改后的内容
    let newContent = '';
    try {
      const updated = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      newContent = updated.content;
    } catch {
      // 读取失败
    }

    // 自动跟踪
    agenticFileTracker.trackFileModify(options.path, originalContent, newContent);
  }

  async replaceInFile(options: ReplaceInFileOptions): Promise<ReplaceInFileResult> {
    // 先读取原始内容
    let originalContent = '';
    try {
      const existing = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      originalContent = existing.content;
    } catch {
      // 文件不存在
    }

    const result = await this.getImpl().replaceInFile(options);

    // 读取修改后的内容
    let newContent = '';
    try {
      const updated = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      newContent = updated.content;
    } catch {
      // 读取失败
    }

    // 自动跟踪
    if (result.modified) {
      agenticFileTracker.trackFileModify(options.path, originalContent, newContent);
    }

    return result;
  }

  async applyDiff(options: ApplyDiffOptions): Promise<ApplyDiffResult> {
    // 先读取原始内容
    let originalContent = '';
    try {
      const existing = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      originalContent = existing.content;
    } catch {
      // 文件不存在
    }

    const result = await this.getImpl().applyDiff(options);

    // 读取修改后的内容
    let newContent = '';
    try {
      const updated = await this.getImpl().readFile({ path: options.path, encoding: 'utf8' });
      newContent = updated.content;
    } catch {
      // 读取失败
    }

    // 自动跟踪
    if (result.success) {
      agenticFileTracker.trackFileModify(options.path, originalContent, newContent);
    }

    return result;
  }

  async getFileHash(options: GetFileHashOptions): Promise<GetFileHashResult> {
    return this.getImpl().getFileHash(options);
  }

  async getLineCount(options: FileOperationOptions): Promise<GetLineCountResult> {
    return this.getImpl().getLineCount(options);
  }

  // ========== 便捷方法 ==========

  /**
   * 创建空文件
   */
  async createEmptyFile(filePath: string, fileName: string): Promise<void> {
    const fullPath = `${filePath}/${fileName}`;
    return this.createFile({
      path: fullPath,
      content: '',
      encoding: 'utf8'
    });
  }

  /**
   * 创建文本文件
   */
  async createTextFile(filePath: string, fileName: string, content: string = ''): Promise<void> {
    const fullPath = `${filePath}/${fileName}`;
    return this.createFile({
      path: fullPath,
      content,
      encoding: 'utf8'
    });
  }

  /**
   * 读取文本文件内容
   */
  async readTextFile(filePath: string): Promise<string> {
    const result = await this.readFile({ path: filePath, encoding: 'utf8' });
    return result.content;
  }

  /**
   * 写入文本文件
   */
  async writeTextFile(filePath: string, content: string, append: boolean = false): Promise<void> {
    return this.writeFile({
      path: filePath,
      content,
      encoding: 'utf8',
      append
    });
  }
}

// 创建单例实例
export const unifiedFileManager = new UnifiedFileManagerService();

// 默认导出
export default unifiedFileManager;
