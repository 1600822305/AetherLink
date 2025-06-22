/**
 * 高级文件管理服务
 * 封装capacitor-advanced-file-manager插件的功能
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import type {
  AdvancedFileManagerPlugin,
  PermissionResult,
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
  FileInfo,
  SelectedFileInfo,
  SystemFilePickerOptions,
  SystemFilePickerResult
} from '../types/fileManager';

const AdvancedFileManager = registerPlugin<AdvancedFileManagerPlugin>('AdvancedFileManager');

class AdvancedFileManagerService {
  private permissionsGranted = false;

  /**
   * 检查是否在支持的平台上
   */
  private isSupportedPlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * 请求文件访问权限
   */
  async requestPermissions(): Promise<PermissionResult> {
    // 在 Web 环境下直接返回不支持
    if (!this.isSupportedPlatform()) {
      return {
        granted: false,
        message: '文件管理功能仅在移动端应用中可用'
      };
    }

    try {
      const result = await AdvancedFileManager.requestPermissions();
      this.permissionsGranted = result.granted;
      return result;
    } catch (error) {
      console.error('请求权限失败:', error);
      return {
        granted: false,
        message: '请求权限失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 检查文件访问权限
   */
  async checkPermissions(): Promise<PermissionResult> {
    // 在 Web 环境下直接返回不支持
    if (!this.isSupportedPlatform()) {
      return {
        granted: false,
        message: '文件管理功能仅在移动端应用中可用'
      };
    }

    try {
      const result = await AdvancedFileManager.checkPermissions();
      this.permissionsGranted = result.granted;
      return result;
    } catch (error) {
      console.error('检查权限失败:', error);
      return {
        granted: false,
        message: '检查权限失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 确保有权限，如果没有则抛出友好的错误信息
   */
  private async ensurePermissions(): Promise<boolean> {
    // 在 Web 环境下直接抛出错误
    if (!this.isSupportedPlatform()) {
      throw new Error('文件管理功能仅在移动端应用中可用。在浏览器中，请使用浏览器的文件选择功能。');
    }

    if (!this.permissionsGranted) {
      const result = await this.checkPermissions();
      if (!result.granted) {
        throw new Error('需要文件访问权限才能使用此功能。请在工作区设置中授权文件访问权限。');
      }
    }
    return true;
  }

  /**
   * 打开系统文件选择器
   */
  async openSystemFilePicker(options: SystemFilePickerOptions): Promise<SystemFilePickerResult> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      const result = await AdvancedFileManager.openSystemFilePicker(options);

      // 处理返回的目录信息，增强显示效果
      if (result.directories && result.directories.length > 0) {
        const processedDirectories = result.directories.map(dir => {
          const processedDir = { ...dir } as SelectedFileInfo & { displayPath?: string };

          // 如果名称不够友好，尝试从URI中提取更好的名称
          if (!processedDir.name || processedDir.name === 'unknown' || processedDir.name.length === 0) {
            processedDir.name = this.extractFriendlyNameFromUri(processedDir.path || processedDir.uri);
          }

          // 为显示目的添加转换后的路径
          if (processedDir.path && processedDir.path.startsWith('content://')) {
            processedDir.displayPath = this.convertContentUriToDisplayPath(processedDir.path);
          }

          return processedDir;
        });

        result.directories = processedDirectories;
      }

      return result;
    } catch (error) {
      console.error('打开系统文件选择器失败:', error);
      throw new Error('打开系统文件选择器失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 从URI中提取友好的名称
   */
  private extractFriendlyNameFromUri(uri: string): string {
    try {
      if (!uri) return '新工作区';

      // 解码URI
      const decodedUri = decodeURIComponent(uri);

      // 处理不同类型的URI
      if (decodedUri.includes('primary:')) {
        const parts = decodedUri.split('primary:');
        const pathPart = parts.length > 1 ? parts[1] : '';
        if (pathPart) {
          // 获取最后一个路径段作为名称
          const segments = (pathPart || '').split('/').filter(s => s.length > 0);
          if (segments.length > 0) {
            return segments[segments.length - 1];
          }
          return pathPart || 'Documents';
        }
      }

      // 处理downloads URI
      if (decodedUri.includes('downloads')) {
        return 'Downloads';
      }

      // 处理其他常见路径
      if (decodedUri.includes('Documents')) {
        return 'Documents';
      }

      if (decodedUri.includes('Pictures')) {
        return 'Pictures';
      }

      if (decodedUri.includes('Music')) {
        return 'Music';
      }

      if (decodedUri.includes('Movies')) {
        return 'Movies';
      }

      // 从普通路径中提取
      const pathSegments = (uri || '').split('/').filter(s => s.length > 0);
      if (pathSegments.length > 0) {
        return pathSegments[pathSegments.length - 1];
      }

      return '选择的文件夹';
    } catch (error) {
      console.error('提取友好名称失败:', error);
      return '新工作区';
    }
  }

  /**
   * 转换content URI为显示路径
   */
  private convertContentUriToDisplayPath(contentUri: string): string {
    try {
      const decodedUri = decodeURIComponent(contentUri);

      // 提取路径部分
      if (decodedUri.includes('primary:')) {
        const pathPart = decodedUri.split('primary:')[1];
        if (pathPart) {
          return `/storage/emulated/0/${pathPart}`;
        }
      }

      // 处理downloads
      if (decodedUri.includes('downloads')) {
        return '/storage/emulated/0/Download';
      }

      // 返回原始URI作为备用
      return contentUri;
    } catch (error) {
      console.error('转换显示路径失败:', error);
      return contentUri;
    }
  }

  /**
   * 打开系统文件管理器
   */
  async openSystemFileManager(path?: string): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.openSystemFileManager(path);
    } catch (error) {
      console.error('打开系统文件管理器失败:', error);
      throw new Error('打开系统文件管理器失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 用系统应用打开文件
   */
  async openFileWithSystemApp(filePath: string, mimeType?: string): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.openFileWithSystemApp(filePath, mimeType);
    } catch (error) {
      console.error('用系统应用打开文件失败:', error);
      throw new Error('用系统应用打开文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(options: ListDirectoryOptions): Promise<ListDirectoryResult> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      return await AdvancedFileManager.listDirectory(options);
    } catch (error) {
      console.error('列出目录失败:', error);
      throw new Error('列出目录失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 创建目录
   */
  async createDirectory(options: CreateDirectoryOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.createDirectory(options);
    } catch (error) {
      console.error('创建目录失败:', error);
      throw new Error('创建目录失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 删除目录
   */
  async deleteDirectory(options: FileOperationOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.deleteDirectory(options);
    } catch (error) {
      console.error('删除目录失败:', error);
      throw new Error('删除目录失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 创建文件
   */
  async createFile(options: CreateFileOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.createFile(options);
    } catch (error) {
      console.error('创建文件失败:', error);
      throw new Error('创建文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 创建空文件（简化版本）
   */
  async createEmptyFile(filePath: string, fileName: string): Promise<void> {
    const fullPath = `${filePath}/${fileName}`;

    try {
      await this.createFile({
        path: fullPath,
        content: '',
        encoding: 'utf8'
      });
    } catch (error) {
      console.error('创建空文件失败:', error);
      throw new Error('创建空文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 创建文本文件
   */
  async createTextFile(filePath: string, fileName: string, content: string = ''): Promise<void> {
    const fullPath = `${filePath}/${fileName}`;

    try {
      await this.createFile({
        path: fullPath,
        content: content,
        encoding: 'utf8'
      });
    } catch (error) {
      console.error('创建文本文件失败:', error);
      throw new Error('创建文本文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 读取文件内容
   */
  async readFile(options: ReadFileOptions): Promise<ReadFileResult> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      return await AdvancedFileManager.readFile(options);
    } catch (error) {
      console.error('读取文件失败:', error);
      throw new Error('读取文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 写入文件内容
   */
  async writeFile(options: WriteFileOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.writeFile(options);
    } catch (error) {
      console.error('写入文件失败:', error);
      throw new Error('写入文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(options: FileOperationOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.deleteFile(options);
    } catch (error) {
      console.error('删除文件失败:', error);
      throw new Error('删除文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 移动文件
   */
  async moveFile(options: MoveFileOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.moveFile(options);
    } catch (error) {
      console.error('移动文件失败:', error);
      throw new Error('移动文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 复制文件
   */
  async copyFile(options: CopyFileOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.copyFile(options);
    } catch (error) {
      console.error('复制文件失败:', error);
      throw new Error('复制文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 重命名文件
   */
  async renameFile(options: RenameFileOptions): Promise<void> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      await AdvancedFileManager.renameFile(options);
    } catch (error) {
      console.error('重命名文件失败:', error);
      throw new Error('重命名文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(options: FileOperationOptions): Promise<FileInfo> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      return await AdvancedFileManager.getFileInfo(options);
    } catch (error) {
      console.error('获取文件信息失败:', error);
      throw new Error('获取文件信息失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * 检查文件或目录是否存在
   */
  async exists(options: FileOperationOptions): Promise<boolean> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      const result = await AdvancedFileManager.exists(options);
      return result.exists;
    } catch (error) {
      console.error('检查文件存在性失败:', error);
      return false;
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(options: SearchFilesOptions): Promise<SearchFilesResult> {
    if (!(await this.ensurePermissions())) {
      throw new Error('没有文件访问权限');
    }

    try {
      return await AdvancedFileManager.searchFiles(options);
    } catch (error) {
      console.error('搜索文件失败:', error);
      throw new Error('搜索文件失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }



  /**
   * 测试插件连接
   */
  async testConnection(): Promise<boolean> {
    // 在 Web 环境下直接返回 false
    if (!this.isSupportedPlatform()) {
      return false;
    }

    try {
      const result = await AdvancedFileManager.echo({ value: 'test' });
      return result.value === 'test';
    } catch (error) {
      console.error('测试插件连接失败:', error);
      return false;
    }
  }
}

// 创建单例实例
export const advancedFileManagerService = new AdvancedFileManagerService();
