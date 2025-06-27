export interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  type: string;
  modifiedTime: number;
  extension?: string;
}

export interface MobileFileViewerProps {
  open: boolean;
  file: WorkspaceFile | null;
  onClose: () => void;
  onSave?: (content: string) => Promise<void>;
  customFileReader?: {
    readFile: (options: { path: string; encoding: string }) => Promise<{ content: string; encoding: string }>;
  };
}

export interface DesktopFileViewerProps {
  open: boolean;
  file: WorkspaceFile | null;
  onClose: () => void;
  onSave?: (content: string) => Promise<void>;
  customFileReader?: {
    readFile: (options: { path: string; encoding: string }) => Promise<{ content: string; encoding: string }>;
  };
  // 桌面端特有的props
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
}

export interface EditorSettings {
  fontSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  theme: 'light' | 'dark';
  minimap: boolean;
  folding: boolean;
}

export type FileType = 'text' | 'image' | 'pdf' | 'code' | 'unknown';

export interface ZoomState {
  scale: number;
  minScale: number;
  maxScale: number;
}
