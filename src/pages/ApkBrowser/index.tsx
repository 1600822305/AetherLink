import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  FolderOpen,
  File,
  Code,
  Image as ImageIcon,
  FileCode,
  Database,
  FileText,
  Home,
  ChevronRight
} from 'lucide-react';
import { DexEditorPlugin } from 'capacitor-dex-editor';
import {
  SafeAreaContainer,
  HeaderBar
} from '../../components/settings/SettingComponents';
import { useBackButton } from '../../shared/hooks/useBackButton';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ApkBrowser');

interface ApkFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  compressedSize?: number;
  lastModified?: number;
  type: string;
}

const ApkBrowser: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const apkPath = searchParams.get('path') || '';
  const fileName = searchParams.get('name') || 'APK';

  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [fileItems, setFileItems] = useState<ApkFileItem[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (apkPath) {
      loadDirectory('');
    }
  }, [apkPath]);

  const loadDirectory = async (directory: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (DexEditorPlugin as any).execute({
        action: 'listApkDirectory',
        params: { apkPath, directory }
      });

      if (result.success && result.data) {
        setCurrentPath(result.data.currentPath || '/');
        const items = (result.data.items || []).sort((a: ApkFileItem, b: ApkFileItem) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setFileItems(items);
        setFolderCount(result.data.folderCount || 0);
        setFileCount(result.data.fileCount || 0);
      }
    } catch (err) {
      logger.error('Failed to load APK directory:', err);
    } finally {
      setLoading(false);
    }
  };

  // 返回上级目录或关闭页面
  const handleBack = useCallback(() => {
    if (currentPath === '/') {
      // 已经在根目录，返回上一个页面
      navigate(-1);
      return true;
    } else {
      // 在子目录，返回上级目录
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';
      loadDirectory(parentPath);
      return true;
    }
  }, [currentPath, navigate]);

  // 注册返回键处理
  useBackButton(handleBack, [handleBack]);

  const handleEnterDirectory = (path: string) => {
    loadDirectory(path);
  };

  // 处理文件点击
  const handleFileClick = async (item: ApkFileItem) => {
    const lowerName = item.name.toLowerCase();
    
    // 点击 DEX 文件，跳转到 DEX 编辑器
    if (lowerName.endsWith('.dex')) {
      navigate(`/dex-editor?apkPath=${encodeURIComponent(apkPath)}&dexPath=${encodeURIComponent(item.path)}&name=${encodeURIComponent(item.name)}`);
      return;
    }
    
    // 点击 XML 文件，调用原生 XML 编辑器
    if (lowerName.endsWith('.xml')) {
      try {
        setLoading(true);
        // 读取 XML 内容
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readResult = await (DexEditorPlugin as any).execute({
          action: 'readApkFile',
          params: { apkPath, filePath: item.path }
        });
        
        if (readResult.success && readResult.data?.content) {
          // 打开原生 XML 编辑器
          const editorResult = await DexEditorPlugin.openXmlEditor({
            content: readResult.data.content,
            title: item.name,
            filePath: item.path,
            readOnly: false
          });
          
          // 如果有修改，保存回 APK
          if (editorResult.success && editorResult.modified && editorResult.content) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const saveResult = await (DexEditorPlugin as any).execute({
              action: 'writeApkFile',
              params: { 
                apkPath, 
                filePath: item.path,
                content: editorResult.content
              }
            });
            
            if (saveResult.success) {
              logger.debug('XML saved successfully:', item.path);
            } else {
              logger.error('Failed to save XML:', saveResult.error);
            }
          }
        } else {
          logger.error('Failed to read XML:', readResult.error);
        }
      } catch (err) {
        logger.error('Error opening XML editor:', err);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // 其他文件类型暂不处理
    logger.debug('File clicked:', item.name);
  };

  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes < 0) return '';
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}M`;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  const getFileIcon = (type: string, name: string) => {
    const lowerName = name.toLowerCase();
    
    if (type === 'folder') return <FolderOpen size={24} color="#FFA726" />;
    if (lowerName.endsWith('.dex')) return <Code size={24} color="#4CAF50" />;
    if (lowerName === 'androidmanifest.xml') return <FileCode size={24} color="#2196F3" />;
    if (lowerName.endsWith('.xml')) return <FileCode size={24} color="#03A9F4" />;
    if (lowerName.endsWith('.arsc')) return <Database size={24} color="#9C27B0" />;
    if (lowerName.endsWith('.so')) return <FileCode size={24} color="#F44336" />;
    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || 
        lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') ||
        lowerName.endsWith('.gif')) return <ImageIcon size={24} color="#E91E63" />;
    if (lowerName.endsWith('.smali')) return <FileText size={24} color="#8BC34A" />;
    if (lowerName.endsWith('.bin') || lowerName.endsWith('.dat')) return <File size={24} color="#607D8B" />;
    
    return <File size={24} color="#757575" />;
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <SafeAreaContainer>
      {/* 顶部导航栏 - 使用项目统一的 HeaderBar */}
      <HeaderBar
        title={fileName}
        onBackPress={handleBack}
      />

      {/* 面包屑导航 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        px: 2, 
        py: 1,
        bgcolor: 'action.hover',
        borderBottom: 1,
        borderColor: 'divider',
        overflow: 'auto',
        flexShrink: 0
      }}>
        <IconButton 
          size="small" 
          onClick={() => loadDirectory('')}
          sx={{ mr: 0.5 }}
        >
          <Home size={16} />
        </IconButton>
        <Typography 
          variant="body2" 
          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          onClick={() => loadDirectory('')}
        >
          {fileName}
        </Typography>
        {pathParts.map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={16} style={{ margin: '0 4px', opacity: 0.5 }} />
            <Typography 
              variant="body2"
              sx={{ 
                cursor: 'pointer', 
                '&:hover': { textDecoration: 'underline' },
                whiteSpace: 'nowrap'
              }}
              onClick={() => {
                const targetPath = pathParts.slice(0, index + 1).join('/') + '/';
                loadDirectory(targetPath);
              }}
            >
              {part}
            </Typography>
          </React.Fragment>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {folderCount}文件夹 {fileCount}文件
        </Typography>
      </Box>

      {/* 文件列表 */}
      <Box sx={{ flex: 1, overflow: 'auto', pb: 'var(--content-bottom-padding)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} />
          </Box>
        ) : fileItems.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">空目录</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {fileItems.map((item, index) => (
              <ListItem
                key={index}
                onClick={() => item.isDirectory ? handleEnterDirectory(item.path) : handleFileClick(item)}
                sx={{
                  cursor: 'pointer',
                  borderBottom: 1,
                  borderColor: 'divider',
                  py: 1.5,
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:active': { bgcolor: 'action.selected' }
                }}
              >
                <ListItemIcon sx={{ minWidth: 44 }}>
                  {getFileIcon(item.type, item.name)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body1" noWrap>
                      {item.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(item.lastModified)} {formatFileSize(item.size)}
                    </Typography>
                  }
                />
                {item.isDirectory && (
                  <ChevronRight size={20} color="#999" />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </SafeAreaContainer>
  );
};

export default ApkBrowser;
