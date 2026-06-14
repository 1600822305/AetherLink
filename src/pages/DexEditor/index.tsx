import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Filter,
  Clock,
  Hammer
} from 'lucide-react';
import { DexEditorPlugin } from 'capacitor-dex-editor';
import {
  SafeAreaContainer,
  HeaderBar
} from '../../components/settings/SettingComponents';
import { useBackButton } from '../../shared/hooks/useBackButton';
import NativeSmaliEditor from '../../components/SmaliEditor/NativeSmaliEditor';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('DexEditor');

interface DexClassItem {
  name: string;
  fullName: string;
  isPackage: boolean;
  children?: DexClassItem[];
}

interface DexString {
  index: number;
  value: string;
}

interface SearchResult {
  className: string;
  methodName?: string;
  line?: number;
  content: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ 
        flex: 1, 
        overflow: 'auto', 
        display: value === index ? 'flex' : 'none', 
        flexDirection: 'column',
        pb: 'var(--content-bottom-padding)'
      }}
    >
      {value === index && children}
    </Box>
  );
};

const DexEditor: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const apkPath = searchParams.get('apkPath') || '';
  const dexPath = searchParams.get('dexPath') || '';
  const dexName = searchParams.get('name') || 'classes.dex';

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  
  // 浏览标签页状态
  const [classTree, setClassTree] = useState<DexClassItem[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 搜索标签页状态
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPath, setSearchPath] = useState('/');
  const [searchType, setSearchType] = useState('code');
  const [searchSubDir, setSearchSubDir] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 常量标签页状态
  const [strings, setStrings] = useState<DexString[]>([]);
  const [stringsLoading, setStringsLoading] = useState(false);
  const [stringFilter, setStringFilter] = useState('');

  // 最近访问
  const [recentClasses, setRecentClasses] = useState<string[]>([]);

  // Smali 编辑器状态
  const [smaliEditorOpen, setSmaliEditorOpen] = useState(false);
  const [smaliContent, setSmaliContent] = useState('');
  const [smaliClassName, setSmaliClassName] = useState('');
  const [smaliLoading, setSmaliLoading] = useState(false);
  
  // 内存编辑：存储已修改的类 { className: smaliContent }
  const [modifiedClasses, setModifiedClasses] = useState<Record<string, string>>({});
  const hasModifications = Object.keys(modifiedClasses).length > 0;
  
  // 自动签名选项
  const [autoSign, setAutoSign] = useState(true);
  
  // 编译进度状态
  const [compileProgress, setCompileProgress] = useState({
    open: false,
    title: '',
    message: '',
    percent: 0
  });

  useEffect(() => {
    if (apkPath && dexPath) {
      loadDexClasses();
    }
  }, [apkPath, dexPath]);
  
  // 监听编译进度
  useEffect(() => {
    const listener = DexEditorPlugin.addListener('compileProgress', (event) => {
      if (event.type === 'title') {
        setCompileProgress(prev => ({ ...prev, title: event.title || '' }));
      } else if (event.type === 'message') {
        setCompileProgress(prev => ({ ...prev, message: event.message || '' }));
      } else if (event.type === 'progress') {
        setCompileProgress(prev => ({ ...prev, percent: event.percent || 0 }));
      }
    });
    
    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  const loadDexClasses = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (DexEditorPlugin as any).execute({
        action: 'listDexClasses',
        params: { apkPath, dexPath }
      });

      if (result.success && result.data) {
        // 构建树形结构
        const tree = buildClassTree(result.data.classes || []);
        setClassTree(tree);
      }
    } catch (err) {
      logger.error('Failed to load DEX classes:', err);
    } finally {
      setLoading(false);
    }
  };

  // 将类列表转换为树形结构
  const buildClassTree = (classes: string[]): DexClassItem[] => {
    interface TreeNode {
      name: string;
      fullName: string;
      isPackage: boolean;
      children: Map<string, TreeNode>;
    }
    
    const root = new Map<string, TreeNode>();
    
    classes.forEach(className => {
      const parts = className.split('.');
      let currentMap = root;
      let fullPath = '';
      
      parts.forEach((part, index) => {
        fullPath = fullPath ? `${fullPath}.${part}` : part;
        const isLast = index === parts.length - 1;
        
        if (!currentMap.has(part)) {
          currentMap.set(part, {
            name: part,
            fullName: fullPath,
            isPackage: !isLast,
            children: new Map()
          });
        }
        
        const node = currentMap.get(part)!;
        if (!isLast) {
          currentMap = node.children;
        }
      });
    });

    // 转换 Map 为数组
    const convertToArray = (map: Map<string, TreeNode>): DexClassItem[] => {
      return Array.from(map.values())
        .map(node => ({
          name: node.name,
          fullName: node.fullName,
          isPackage: node.isPackage,
          children: node.children.size > 0 ? convertToArray(node.children) : undefined
        }))
        .sort((a, b) => {
          if (a.isPackage && !b.isPackage) return -1;
          if (!a.isPackage && b.isPackage) return 1;
          return a.name.localeCompare(b.name);
        });
    };

    return convertToArray(root);
  };

  const handleToggleNode = (fullName: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  };

  const handleClassClick = async (item: DexClassItem) => {
    if (!item.isPackage) {
      // 添加到最近访问
      setRecentClasses(prev => {
        const filtered = prev.filter(c => c !== item.fullName);
        return [item.fullName, ...filtered].slice(0, 20);
      });
      
      // 打开 Smali 编辑器
      setSmaliClassName(item.fullName);
      setSmaliLoading(true);
      setSmaliEditorOpen(true);
      
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (DexEditorPlugin as any).execute({
          action: 'getClassSmali',
          params: { apkPath, dexPath, className: item.fullName }
        });
        
        if (result.success && result.data) {
          setSmaliContent(result.data.smali || '');
        } else {
          setSmaliContent(`# 无法加载类 ${item.fullName} 的 Smali 代码\n# 错误: ${result.error || '未知错误'}`);
        }
      } catch (err) {
        logger.error('Failed to load smali:', err);
        setSmaliContent(`# 加载失败\n# ${err}`);
      } finally {
        setSmaliLoading(false);
      }
    }
  };

  // 编译修改到 APK
  const handleCompile = async () => {
    if (!hasModifications) {
      alert('没有修改需要编译');
      return;
    }
    
    const classCount = Object.keys(modifiedClasses).length;
    const signOption = autoSign ? '（将自动签名）' : '（不签名）';
    if (!confirm(`确定要编译 ${classCount} 个已修改的类吗？${signOption}`)) {
      return;
    }
    
    // 显示进度对话框
    setCompileProgress({ open: true, title: '准备编译...', message: '', percent: 0 });
    
    try {
      for (const [className, smaliContent] of Object.entries(modifiedClasses)) {
        logger.debug('Compiling:', className);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (DexEditorPlugin as any).execute({
          action: 'saveClassSmali',
          params: { apkPath, dexPath, className, smaliContent }
        });
        
        if (!result.success) {
          setCompileProgress(prev => ({ ...prev, open: false }));
          alert(`编译 ${className} 失败: ${result.error || '未知错误'}`);
          return;
        }
      }
      
      // 清空已修改列表
      setModifiedClasses({});
      
      // 如果启用自动签名，执行签名
      if (autoSign) {
        setCompileProgress(prev => ({ ...prev, title: '签名 APK', message: '正在签名...', percent: 0 }));
        try {
          const signedPath = apkPath.replace('.apk', '_signed.apk');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const signResult = await (DexEditorPlugin as any).execute({
            action: 'signApkWithTestKey',
            params: { apkPath, outputPath: signedPath }
          });
          
          setCompileProgress(prev => ({ ...prev, open: false }));
          if (signResult.success) {
            alert(`编译成功！\n\nAPK 已签名并保存到:\n${signedPath}`);
          } else {
            alert(`编译成功！APK 已更新\n\n签名失败: ${signResult.error || '未知错误'}\n请手动签名后安装`);
          }
        } catch (signErr) {
          setCompileProgress(prev => ({ ...prev, open: false }));
          logger.error('Sign error:', signErr);
          alert('编译成功！APK 已更新\n\n自动签名出错，请手动签名');
        }
      } else {
        setCompileProgress(prev => ({ ...prev, open: false }));
        alert('编译成功！APK 内的 DEX 已更新\n\n注意：修改后的 APK 需要重新签名才能安装');
      }
    } catch (err) {
      setCompileProgress(prev => ({ ...prev, open: false }));
      logger.error('Compile error:', err);
      alert('编译出错: ' + err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      logger.debug('Search params:', { apkPath, dexPath, query: searchQuery, searchType });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (DexEditorPlugin as any).execute({
        action: 'searchInDex',
        params: { 
          apkPath, 
          dexPath, 
          query: searchQuery,
          searchType,
          caseSensitive,
          useRegex
        }
      });

      logger.debug('Search result:', result);
      if (result.success && result.data) {
        setSearchResults(result.data.results || []);
      } else {
        logger.error('Search failed:', result.error);
      }
    } catch (err) {
      logger.error('Search exception:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const loadStrings = async () => {
    setStringsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (DexEditorPlugin as any).execute({
        action: 'getDexStrings',
        params: { apkPath, dexPath }
      });

      if (result.success && result.data) {
        setStrings(result.data.strings || []);
      }
    } catch (err) {
      logger.error('Failed to load strings:', err);
    } finally {
      setStringsLoading(false);
    }
  };

  // 切换到常量标签页时加载字符串
  useEffect(() => {
    if (tabValue === 3 && strings.length === 0 && !stringsLoading) {
      loadStrings();
    }
  }, [tabValue]);

  const handleBack = useCallback(() => {
    navigate(-1);
    return true;
  }, [navigate]);

  useBackButton(handleBack, [handleBack]);

  const filteredStrings = stringFilter
    ? strings.filter(s => s.value.toLowerCase().includes(stringFilter.toLowerCase()))
    : strings;

  // 渲染树节点
  const renderTreeNode = (item: DexClassItem, depth: number = 0) => {
    const isExpanded = expandedNodes.has(item.fullName);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.fullName}>
        <ListItem
          onClick={() => item.isPackage ? handleToggleNode(item.fullName) : handleClassClick(item)}
          sx={{
            pl: 2 + depth * 2,
            py: 0.75,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {item.isPackage ? (
              hasChildren ? (
                isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />
              ) : <Folder size={18} color="#FFA726" />
            ) : (
              <Box sx={{ 
                width: 20, 
                height: 20, 
                bgcolor: '#4CAF50', 
                borderRadius: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>
                  C
                </Typography>
              </Box>
            )}
          </ListItemIcon>
          {item.isPackage && hasChildren && (
            <ListItemIcon sx={{ minWidth: 24 }}>
              {isExpanded ? <FolderOpen size={18} color="#FFA726" /> : <Folder size={18} color="#FFA726" />}
            </ListItemIcon>
          )}
          <ListItemText
            primary={item.name}
            primaryTypographyProps={{ 
              variant: 'body2',
              noWrap: true,
              sx: { fontFamily: item.isPackage ? 'inherit' : 'monospace' }
            }}
          />
        </ListItem>
        {item.isPackage && hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {item.children!.map(child => renderTreeNode(child, depth + 1))}
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={`Dex 编辑器`}
        onBackPress={handleBack}
        rightButton={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {hasModifications && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={autoSign}
                      onChange={(e) => setAutoSign(e.target.checked)}
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={<Typography variant="caption">签名</Typography>}
                  sx={{ m: 0, mr: 0.5 }}
                />
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  startIcon={<Hammer size={16} />}
                  onClick={handleCompile}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  编译({Object.keys(modifiedClasses).length})
                </Button>
              </>
            )}
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {dexName}
            </Typography>
          </Box>
        }
      />

      {/* 标签页 */}
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => setTabValue(newValue)}
        variant="fullWidth"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 44,
          '& .MuiTab-root': { minHeight: 44, py: 1 }
        }}
      >
        <Tab label="浏览" />
        <Tab label="最近" />
        <Tab label="搜索" />
        <Tab label="常量" />
      </Tabs>

      {/* 浏览标签页 */}
      <TabPanel value={tabValue} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto' }}>
            {classTree.map(item => renderTreeNode(item))}
          </List>
        )}
      </TabPanel>

      {/* 最近标签页 */}
      <TabPanel value={tabValue} index={1}>
        {recentClasses.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'text.secondary' }}>
            <Clock size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Typography>暂无最近访问记录</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {recentClasses.map((className, index) => (
              <ListItem
                key={index}
                onClick={() => handleClassClick({ name: className.split('.').pop()!, fullName: className, isPackage: false })}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Box sx={{ 
                    width: 20, 
                    height: 20, 
                    bgcolor: '#4CAF50', 
                    borderRadius: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>
                      C
                    </Typography>
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={className.split('.').pop()}
                  secondary={className}
                  primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* 搜索标签页 */}
      <TabPanel value={tabValue} index={2}>
        {/* 功能区 */}
        <Box sx={{ bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}>
            功能
          </Typography>
          <List disablePadding dense>
            <ListItem 
              onClick={() => setSearchDialogOpen(true)}
              sx={{ py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'action.selected' } }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}><Search size={18} /></ListItemIcon>
              <ListItemText primary="发起新搜索" primaryTypographyProps={{ variant: 'body2' }} />
            </ListItem>
          </List>
        </Box>

        {/* 搜索结果 */}
        {searchResults.length > 0 ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                搜索结果({searchResults.length}) - {searchQuery}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ cursor: 'pointer', color: 'primary.main' }}
                onClick={() => setSearchResults([])}
              >
                清除
              </Typography>
            </Box>
            <List disablePadding sx={{ overflow: 'auto', flex: 1 }}>
              {(() => {
                // 按包名分组
                const grouped: Record<string, typeof searchResults> = {};
                searchResults.forEach(result => {
                  const parts = result.className.split('.');
                  const packageName = parts.slice(0, -1).join('.') || '(default)';
                  if (!grouped[packageName]) grouped[packageName] = [];
                  grouped[packageName].push(result);
                });
                
                // 高亮关键字函数
                const highlightText = (text: string, query: string) => {
                  if (!query) return text;
                  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                  const parts = text.split(regex);
                  return parts.map((part, i) => 
                    regex.test(part) ? (
                      <span key={i} style={{ backgroundColor: '#2196F3', color: 'white', padding: '0 2px', borderRadius: 2 }}>{part}</span>
                    ) : part
                  );
                };
                
                return Object.entries(grouped).map(([pkg, items]) => (
                  <React.Fragment key={pkg}>
                    {/* 包名分组标题 */}
                    <ListItem sx={{ py: 0.5, bgcolor: 'action.hover' }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <Folder size={16} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={pkg} 
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 'medium' }} 
                      />
                    </ListItem>
                    {/* 该包下的类 */}
                    {items.map((result, idx) => {
                      const simpleClassName = result.className.split('.').pop() || result.className;
                      return (
                        <ListItem 
                          key={idx} 
                          onClick={() => handleClassClick({ name: simpleClassName, fullName: result.className, isPackage: false })}
                          sx={{ 
                            flexDirection: 'column', 
                            alignItems: 'flex-start', 
                            borderBottom: 1, 
                            borderColor: 'divider',
                            pl: 4,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.selected' }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                            <Box sx={{ 
                              width: 20, 
                              height: 20, 
                              bgcolor: '#4CAF50', 
                              borderRadius: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>
                                C
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {highlightText(simpleClassName, searchQuery)}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ pl: 3.5, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                            {highlightText(result.content, searchQuery)}
                          </Typography>
                        </ListItem>
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
            </List>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'text.secondary' }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Typography>点击"发起新搜索"开始搜索</Typography>
          </Box>
        )}

        {/* 搜索对话框 */}
        <Dialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>搜索</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="查找内容"
                fullWidth
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <TextField
                label="路径"
                fullWidth
                size="small"
                value={searchPath}
                onChange={(e) => setSearchPath(e.target.value)}
              />
              <FormControl fullWidth size="small">
                <InputLabel>搜索类型</InputLabel>
                <Select
                  value={searchType}
                  label="搜索类型"
                  onChange={(e) => setSearchType(e.target.value)}
                >
                  <MenuItem value="code">代码</MenuItem>
                  <MenuItem value="class">类名</MenuItem>
                  <MenuItem value="field">字段名</MenuItem>
                  <MenuItem value="method">方法名</MenuItem>
                  <MenuItem value="string">字符串</MenuItem>
                  <MenuItem value="integer">整数</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Checkbox checked={searchSubDir} onChange={(e) => setSearchSubDir(e.target.checked)} />}
                label="搜索子目录"
              />
              <FormControlLabel
                control={<Checkbox checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />}
                label="区分大小写"
              />
              <FormControlLabel
                control={<Checkbox checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />}
                label="正则表达式"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSearchDialogOpen(false)}>取消</Button>
            <Button 
              onClick={() => {
                setSearchDialogOpen(false);
                handleSearch();
              }}
              variant="contained"
              disabled={!searchQuery.trim() || isSearching}
            >
              {isSearching ? '搜索中...' : '确定'}
            </Button>
          </DialogActions>
        </Dialog>
      </TabPanel>

      {/* 常量标签页 */}
      <TabPanel value={tabValue} index={3}>
        {/* 工具栏 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          px: 2, 
          py: 1, 
          borderBottom: 1, 
          borderColor: 'divider',
          bgcolor: 'action.hover'
        }}>
          <Box 
            onClick={loadStrings} 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              cursor: 'pointer',
              color: 'primary.main',
              '&:hover': { opacity: 0.8 }
            }}
          >
            <RefreshCw size={16} />
            <Typography variant="caption">刷新</Typography>
          </Box>
        </Box>

        {/* 字符串过滤 */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="过滤字符串..."
            value={stringFilter}
            onChange={(e) => setStringFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Filter size={18} />
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* 字符串常量池标题 */}
        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', bgcolor: 'action.hover', color: 'text.secondary' }}>
          字符常量池 ({filteredStrings.length})
        </Typography>

        {/* 字符串列表 */}
        {stringsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', flex: 1 }}>
            {filteredStrings.map((str, index) => (
              <ListItem
                key={index}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  py: 1.5
                }}
              >
                <ListItemText
                  primary={str.value || '(empty)'}
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    sx: { 
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      color: str.value ? 'text.primary' : 'text.secondary'
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </TabPanel>

      {/* 原生 Smali 编辑器 */}
      <NativeSmaliEditor
        open={smaliEditorOpen && !smaliLoading}
        onClose={() => setSmaliEditorOpen(false)}
        initialContent={smaliContent}
        title={smaliClassName.split('.').pop() || 'Smali'}
        className={smaliClassName}
        readOnly={false}
        onSave={(newContent: string) => {
          // MT 风格：只保存到内存，不立即编译
          setSmaliContent(newContent);
          setModifiedClasses(prev => ({
            ...prev,
            [smaliClassName]: newContent
          }));
          logger.debug('Smali saved to memory:', smaliClassName);
        }}
      />

      {/* 编译进度对话框 */}
      <Dialog open={compileProgress.open} maxWidth="xs" fullWidth>
        <DialogTitle>{compileProgress.title || '编译中...'}</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress variant="determinate" value={compileProgress.percent} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {compileProgress.message || '请稍候...'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {compileProgress.percent}%
          </Typography>
        </DialogContent>
      </Dialog>
    </SafeAreaContainer>
  );
};

export default DexEditor;
