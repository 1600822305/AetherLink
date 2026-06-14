/**
 * 工作区管理服务
 * 提供工作区的创建、管理和文件访问功能
 */

import { v4 as uuidv4 } from 'uuid';
import { dexieStorage } from '../storage/DexieStorageService';
import { unifiedFileManager } from './UnifiedFileManagerService';
import type {
  Workspace,
  WorkspaceFile,
  WorkspaceCreateRequest,
  WorkspaceListResponse,
  WorkspaceFilesResponse,
  WorkspaceActionResult
} from '../../types/workspace';
import { createLogger } from '../infra/logger';
const logger = createLogger('WorkspaceService');

const WORKSPACE_STORAGE_KEY = 'workspaces';
export const ENABLE_WORKSPACE_SIDEBAR_KEY = 'ENABLE_WORKSPACE_SIDEBAR';

class WorkspaceService {

  /**
   * 验证文件夹路径是否有效（简化版，主要用于手动输入的路径）
   */
  async validateFolderPath(path: string): Promise<WorkspaceActionResult> {
    try {
      if (!path.trim()) {
        return { success: false, error: '路径不能为空' };
      }

      // 对于系统文件选择器返回的路径，直接认为有效
      return { success: true };
    } catch (error) {
      logger.error('验证文件夹路径失败:', error);
      return {
        success: false,
        error: `路径验证失败`
      };
    }
  }

  /**
   * 创建新工作区
   */
  async createWorkspace(request: WorkspaceCreateRequest): Promise<WorkspaceActionResult> {
    try {
      // 基本验证
      if (!request.name.trim()) {
        return { success: false, error: '工作区名称不能为空' };
      }

      if (!request.path.trim()) {
        return { success: false, error: '文件夹路径不能为空' };
      }

      // 检查工作区名称是否已存在
      const existingWorkspaces = await this.getWorkspaces();
      const nameExists = existingWorkspaces.workspaces.some(
        ws => ws.name.toLowerCase() === request.name.toLowerCase()
      );

      if (nameExists) {
        return { success: false, error: '工作区名称已存在' };
      }

      // 创建工作区对象
      const workspace: Workspace = {
        id: uuidv4(),
        name: request.name,
        path: request.path,
        description: request.description,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      };

      // 保存到存储
      const workspaces = await this.getWorkspaces();
      workspaces.workspaces.push(workspace);

      await dexieStorage.saveSetting(WORKSPACE_STORAGE_KEY, workspaces.workspaces);

      return { success: true, data: workspace };
    } catch (error) {
      logger.error('创建工作区失败:', error);
      return { success: false, error: '创建工作区失败，请重试' };
    }
  }

  /**
   * 获取所有工作区
   */
  async getWorkspaces(): Promise<WorkspaceListResponse> {
    try {
      const workspaces = await dexieStorage.getSetting(WORKSPACE_STORAGE_KEY) || [];
      return {
        workspaces: workspaces.sort((a: Workspace, b: Workspace) =>
          new Date(b.lastAccessedAt || b.createdAt).getTime() -
          new Date(a.lastAccessedAt || a.createdAt).getTime()
        ),
        total: workspaces.length
      };
    } catch (error) {
      logger.error('获取工作区列表失败:', error);
      return { workspaces: [], total: 0 };
    }
  }

  /**
   * 获取工作区详情
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    try {
      const workspaces = await this.getWorkspaces();
      return workspaces.workspaces.find(ws => ws.id === id) || null;
    } catch (error) {
      logger.error('获取工作区详情失败:', error);
      return null;
    }
  }

  /**
   * 删除工作区
   */
  async deleteWorkspace(id: string): Promise<WorkspaceActionResult> {
    try {
      const workspaces = await this.getWorkspaces();
      const filteredWorkspaces = workspaces.workspaces.filter(ws => ws.id !== id);
      
      if (filteredWorkspaces.length === workspaces.workspaces.length) {
        return { success: false, error: '工作区不存在' };
      }

      await dexieStorage.saveSetting(WORKSPACE_STORAGE_KEY, filteredWorkspaces);
      return { success: true };
    } catch (error) {
      logger.error('删除工作区失败:', error);
      return { success: false, error: '删除工作区失败，请重试' };
    }
  }

  /**
   * 更新工作区最后访问时间
   */
  async updateLastAccessed(id: string): Promise<void> {
    try {
      const workspaces = await this.getWorkspaces();
      const workspace = workspaces.workspaces.find(ws => ws.id === id);
      
      if (workspace) {
        workspace.lastAccessedAt = new Date().toISOString();
        await dexieStorage.saveSetting(WORKSPACE_STORAGE_KEY, workspaces.workspaces);
      }
    } catch (error) {
      logger.error('更新访问时间失败:', error);
    }
  }

  /**
   * 获取工作区文件列表 - 使用高级文件管理器
   */
  async getWorkspaceFilesAdvanced(workspaceId: string, subPath: string = ''): Promise<WorkspaceFilesResponse> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        throw new Error('工作区不存在');
      }

      // 更新最后访问时间
      await this.updateLastAccessed(workspaceId);

      // 构建完整路径
      const fullPath = subPath ? `${workspace.path}/${subPath}` : workspace.path;

      // 使用高级文件管理器读取目录内容
      const result = await unifiedFileManager.listDirectory({
        path: fullPath,
        showHidden: false,
        sortBy: 'name',
        sortOrder: 'asc'
      });

      // 转换文件信息格式
      const files: WorkspaceFile[] = result.files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        isDirectory: file.type === 'directory',
        type: file.type,
        modifiedTime: file.mtime,
        extension: (file.name && file.name.includes('.')) ? file.name.split('.').pop() : undefined
      }));

      // 排序：目录在前，然后按名称排序
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        files,
        currentPath: fullPath,
        parentPath: (subPath && subPath.includes('/')) ? subPath.split('/').slice(0, -1).join('/') : undefined
      };
    } catch (error) {
      logger.error('获取工作区文件失败:', error);
      // 如果高级文件管理器失败，回退到原始方法
      return this.getWorkspaceFiles(workspaceId, subPath);
    }
  }

  /**
   * 获取工作区文件列表 - 原始方法（作为备用）
   */
  async getWorkspaceFiles(workspaceId: string, subPath: string = ''): Promise<WorkspaceFilesResponse> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        throw new Error('工作区不存在');
      }

      // 更新最后访问时间
      await this.updateLastAccessed(workspaceId);

      // 构建完整路径
      const fullPath = subPath ? `${workspace.path}/${subPath}` : workspace.path;

      // 使用统一文件管理器读取目录内容（支持 Tauri 和 Capacitor）
      const result = await unifiedFileManager.listDirectory({
        path: fullPath,
        showHidden: false,
        sortBy: 'name',
        sortOrder: 'asc'
      });

      if (!result.files || result.files.length === 0) {
        return {
          files: [],
          currentPath: fullPath,
          parentPath: subPath ? workspace.path : undefined
        };
      }

      // 转换文件信息
      const files: WorkspaceFile[] = result.files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size || 0,
        isDirectory: file.type === 'directory',
        type: file.type || 'file',
        modifiedTime: file.mtime || Date.now(),
        extension: (file.name && file.name.includes('.')) ? file.name.split('.').pop() : undefined
      }));

      // 排序：目录在前，然后按名称排序
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return {
        files,
        currentPath: fullPath,
        parentPath: (subPath && subPath.includes('/')) ? subPath.split('/').slice(0, -1).join('/') : undefined
      };
    } catch (error) {
      logger.error('获取工作区文件失败:', error);
      throw new Error('无法读取工作区文件，请检查路径是否存在或权限是否足够');
    }
  }

  /**
   * 创建文件夹
   */
  async createFolder(workspaceId: string, folderPath: string, folderName: string): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      const fullPath = `${folderPath}/${folderName}`;

      await unifiedFileManager.createDirectory({
        path: fullPath,
        recursive: false
      });

      return { success: true };
    } catch (error) {
      logger.error('创建文件夹失败:', error);
      return {
        success: false,
        error: '创建文件夹失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 创建文件
   */
  async createFile(workspaceId: string, folderPath: string, fileName: string, content: string = ''): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      await unifiedFileManager.createTextFile(folderPath, fileName, content);

      return { success: true };
    } catch (error) {
      logger.error('创建文件失败:', error);
      return {
        success: false,
        error: '创建文件失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 删除文件或文件夹
   */
  async deleteItem(workspaceId: string, itemPath: string, isDirectory: boolean): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      if (isDirectory) {
        await unifiedFileManager.deleteDirectory({ path: itemPath });
      } else {
        await unifiedFileManager.deleteFile({ path: itemPath });
      }

      return { success: true };
    } catch (error) {
      logger.error('删除项目失败:', error);
      return {
        success: false,
        error: '删除失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 重命名文件或文件夹
   */
  async renameItem(workspaceId: string, itemPath: string, newName: string): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      await unifiedFileManager.renameFile({
        path: itemPath,
        newName: newName
      });

      return { success: true };
    } catch (error) {
      logger.error('重命名失败:', error);
      return {
        success: false,
        error: '重命名失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 复制文件或文件夹
   */
  async copyItem(workspaceId: string, sourcePath: string, destinationPath: string): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      await unifiedFileManager.copyFile({
        sourcePath: sourcePath,
        destinationPath: destinationPath,
        overwrite: false
      });

      return { success: true };
    } catch (error) {
      logger.error('复制失败:', error);
      return {
        success: false,
        error: '复制失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 移动文件或文件夹
   */
  async moveItem(workspaceId: string, sourcePath: string, destinationPath: string): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      await unifiedFileManager.moveFile({
        sourcePath: sourcePath,
        destinationPath: destinationPath
      });

      return { success: true };
    } catch (error) {
      logger.error('移动失败:', error);
      return {
        success: false,
        error: '移动失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 读取文件内容
   */
  async readFileContent(workspaceId: string, filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      const result = await unifiedFileManager.readFile({
        path: filePath,
        encoding: 'utf8'
      });

      return { success: true, content: result.content };
    } catch (error) {
      logger.error('读取文件失败:', error);
      return {
        success: false,
        error: '读取文件失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 写入文件内容
   */
  async writeFileContent(workspaceId: string, filePath: string, content: string): Promise<WorkspaceActionResult> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      await unifiedFileManager.writeFile({
        path: filePath,
        content: content,
        encoding: 'utf8',
        append: false
      });

      return { success: true };
    } catch (error) {
      logger.error('写入文件失败:', error);
      return {
        success: false,
        error: '写入文件失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(workspaceId: string, query: string, searchType: 'name' | 'content' | 'both' = 'name'): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace) {
        return { success: false, error: '工作区不存在' };
      }

      const result = await unifiedFileManager.searchFiles({
        directory: workspace.path,
        query: query,
        searchType: searchType,
        fileTypes: [],
        maxResults: 100,
        recursive: true
      });

      // 转换文件信息格式
      const files = result.files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        isDirectory: file.type === 'directory',
        type: file.type,
        modifiedTime: file.mtime,
        extension: file.name.includes('.') ? file.name.split('.').pop() : undefined
      }));

      return { success: true, files };
    } catch (error) {
      logger.error('搜索文件失败:', error);
      return {
        success: false,
        error: '搜索文件失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 获取是否启用侧边栏
   */
  async isSidebarEnabled(): Promise<boolean> {
    const enabled = await dexieStorage.getSetting(ENABLE_WORKSPACE_SIDEBAR_KEY);
    return enabled === true;
  }

  /**
   * 设置是否启用侧边栏
   */
  async setSidebarEnabled(enabled: boolean): Promise<void> {
    await dexieStorage.saveSetting(ENABLE_WORKSPACE_SIDEBAR_KEY, enabled);
  }
}

export const workspaceService = new WorkspaceService();
