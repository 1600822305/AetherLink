import { unifiedFileManager } from '../files/UnifiedFileManagerService';
import { dexieStorage } from '../../services/storage/DexieStorageService';
import type { NoteFile } from '../../types/note';
import { createLogger } from '../infra/logger';
const logger = createLogger('SimpleNote');

export const NOTE_STORAGE_PATH_KEY = 'NOTE_STORAGE_PATH';
export const ENABLE_NOTE_SIDEBAR_KEY = 'ENABLE_NOTE_SIDEBAR';

class SimpleNoteService {
  private static instance: SimpleNoteService;

  private constructor() {}

  public static getInstance(): SimpleNoteService {
    if (!SimpleNoteService.instance) {
      SimpleNoteService.instance = new SimpleNoteService();
    }
    return SimpleNoteService.instance;
  }

  /**
   * 获取笔记存储根目录
   */
  async getStoragePath(): Promise<string | null> {
    return await dexieStorage.getSetting(NOTE_STORAGE_PATH_KEY);
  }

  /**
   * 设置笔记存储根目录
   */
  async setStoragePath(path: string): Promise<void> {
    await dexieStorage.saveSetting(NOTE_STORAGE_PATH_KEY, path);
  }

  /**
   * 获取是否启用侧边栏
   */
  async isSidebarEnabled(): Promise<boolean> {
    const enabled = await dexieStorage.getSetting(ENABLE_NOTE_SIDEBAR_KEY);
    return enabled === true;
  }

  /**
   * 设置是否启用侧边栏
   */
  async setSidebarEnabled(enabled: boolean): Promise<void> {
    await dexieStorage.saveSetting(ENABLE_NOTE_SIDEBAR_KEY, enabled);
  }

  /**
   * 获取完整的存储路径
   */
  private async getFullPath(subPath: string = ''): Promise<string> {
    const rootPath = await this.getStoragePath();
    if (!rootPath) {
      throw new Error('未设置笔记存储目录');
    }
    // 处理路径分隔符，确保没有双斜杠
    const normalizedRoot = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
    const normalizedSub = subPath.startsWith('/') ? subPath.slice(1) : subPath;
    return normalizedSub ? `${normalizedRoot}/${normalizedSub}` : normalizedRoot;
  }

  /**
   * 列出笔记文件
   */
  async listNotes(subPath: string = ''): Promise<NoteFile[]> {
    const fullPath = await this.getFullPath(subPath);
    
    try {
      const result = await unifiedFileManager.listDirectory({
        path: fullPath,
        showHidden: false,
        sortBy: 'name',
        sortOrder: 'asc'
      });

      return result.files.map(file => ({
        id: subPath ? `${subPath}/${file.name}` : file.name, // 使用路径作为稳定ID
        name: file.name,
        path: subPath ? `${subPath}/${file.name}` : file.name,
        isDirectory: file.type === 'directory',
        lastModified: new Date(file.mtime || Date.now()).toISOString(),
        size: file.size,
        extension: file.name.split('.').pop()
      })).sort((a, b) => {
        // 文件夹优先
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      logger.error('获取笔记列表失败:', error);
      throw error;
    }
  }

  /**
   * 创建笔记文件
   */
  async createNote(subPath: string, name: string, content: string = ''): Promise<void> {
    const fullPath = await this.getFullPath(subPath);
    
    // 确保文件名以 .md 结尾（如果没有扩展名）
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    
    await unifiedFileManager.createTextFile(fullPath, fileName, content);
  }

  /**
   * 创建文件夹
   */
  async createFolder(subPath: string, name: string): Promise<void> {
    const fullPath = await this.getFullPath(subPath);
    const newFolderPath = `${fullPath}/${name}`;
    
    await unifiedFileManager.createDirectory({
      path: newFolderPath,
      recursive: false
    });
  }

  /**
   * 读取笔记内容
   */
  async readNote(relativePath: string): Promise<string> {
    const fullPath = await this.getFullPath(relativePath);
    
    const result = await unifiedFileManager.readFile({
      path: fullPath,
      encoding: 'utf8'
    });

    return result.content;
  }

  /**
   * 保存笔记内容
   */
  async saveNote(relativePath: string, content: string): Promise<void> {
    const fullPath = await this.getFullPath(relativePath);
    
    await unifiedFileManager.writeFile({
      path: fullPath,
      content: content,
      encoding: 'utf8',
      append: false
    });
  }

  /**
   * 删除文件或文件夹
   */
  async deleteItem(relativePath: string, isDirectory: boolean): Promise<void> {
    const fullPath = await this.getFullPath(relativePath);
    
    if (isDirectory) {
      await unifiedFileManager.deleteDirectory({
        path: fullPath
      });
    } else {
      await unifiedFileManager.deleteFile({
        path: fullPath
      });
    }
  }

  /**
   * 重命名文件或文件夹
   * 直接使用原生 renameFile API，支持文件和文件夹
   */
  async renameItem(relativePath: string, newName: string): Promise<void> {
    const fullPath = await this.getFullPath(relativePath);
    await unifiedFileManager.renameFile({
      path: fullPath,
      newName: newName
    });
  }
  
  /**
   * 检查是否配置了有效路径
   */
  async hasValidConfig(): Promise<boolean> {
    const path = await this.getStoragePath();
    if (!path) return false;
    
    // 学习工作区的做法：对于系统文件选择器返回的路径，直接认为有效
    return true;
  }
}

export const simpleNoteService = SimpleNoteService.getInstance();