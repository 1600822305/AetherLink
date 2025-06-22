/**
 * 工作区相关类型定义
 */

export interface Workspace {
  /** 工作区唯一标识符 */
  id: string;
  /** 工作区名称 */
  name: string;
  /** 文件夹路径 */
  path: string;
  /** 创建时间 */
  createdAt: string;
  /** 工作区描述 */
  description?: string;
  /** 最后访问时间 */
  lastAccessedAt?: string;
}

export interface WorkspaceFile {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 文件大小（字节） */
  size: number;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 文件类型 */
  type: string;
  /** 修改时间 */
  modifiedTime: number;
  /** 文件扩展名 */
  extension?: string;
}

export interface WorkspaceCreateRequest {
  /** 工作区名称 */
  name: string;
  /** 文件夹路径 */
  path: string;
  /** 工作区描述 */
  description?: string;
}

export interface WorkspaceListResponse {
  /** 工作区列表 */
  workspaces: Workspace[];
  /** 总数 */
  total: number;
}

export interface WorkspaceFilesResponse {
  /** 文件列表 */
  files: WorkspaceFile[];
  /** 当前路径 */
  currentPath: string;
  /** 父级路径 */
  parentPath?: string;
}

/** 预设的常用文件夹选项 */
export interface PresetFolder {
  /** 显示名称 */
  label: string;
  /** 文件夹路径 */
  path: string;
  /** 描述 */
  description: string;
  /** 图标名称 */
  icon: string;
}

/** 工作区操作类型 */
export enum WorkspaceActionType {
  CREATE = 'create',
  DELETE = 'delete',
  UPDATE = 'update',
  ACCESS = 'access'
}

/** 工作区操作结果 */
export interface WorkspaceActionResult {
  /** 是否成功 */
  success: boolean;
  /** 错误消息 */
  error?: string;
  /** 返回数据 */
  data?: any;
}
