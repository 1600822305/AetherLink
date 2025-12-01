import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  alpha,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,

  IconButton
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch'; // 导入 CustomSwitch 组件
import {
  ChevronDown, ChevronUp, Settings, Database, Globe, Brain, Code
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MCPServer, MCPServerType } from '../../../shared/types';
import { mcpService } from '../../../shared/services/mcp';
import {
  createOptimizedClickHandler,
  createOptimizedSwitchHandler,
  listItemOptimization,
} from './scrollOptimization';
import { useMCPServerStateManager } from '../../../hooks/useMCPServerStateManager';
import OptimizedCollapse from './OptimizedCollapse';

interface MCPSidebarControlsProps {
  onMCPModeChange?: (mode: 'prompt' | 'function') => void;
  mcpMode?: 'prompt' | 'function';
  onToolsToggle?: (enabled: boolean) => void;
  toolsEnabled?: boolean;
}

const MCPSidebarControls: React.FC<MCPSidebarControlsProps> = ({
  onMCPModeChange,
  mcpMode = 'function',
  onToolsToggle,
  toolsEnabled = false
}) => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [activeServers, setActiveServers] = useState<MCPServer[]>([]);
  const [expanded, setExpanded] = useState(false);

  // 使用共享的MCP状态管理Hook
  const { createMCPToggleHandler } = useMCPServerStateManager();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = () => {
    const allServers = mcpService.getServers();
    const active = mcpService.getActiveServers();
    setServers(allServers);
    setActiveServers(active);
  };

  const handleToggleServer = async (serverId: string, isActive: boolean) => {
    try {
      await mcpService.toggleServer(serverId, isActive);
      loadServers();
    } catch (error) {
      console.error('切换服务器状态失败:', error);
    }
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const mode = event.target.value as 'prompt' | 'function';
    // 🔧 直接保存到 localStorage，确保生效
    localStorage.setItem('mcp_mode', mode);
    console.log(`[MCPSidebarControls] 保存 MCP 模式到 localStorage: ${mode}`);
    onMCPModeChange?.(mode);
  };

  const handleNavigateToSettings = () => {
    navigate('/settings/mcp-server');
  };

  // 使用共享的MCP状态管理逻辑
  const handleToolsToggle = createMCPToggleHandler(loadServers, onToolsToggle);

  const getServerTypeIcon = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return <Globe size={16} />;
      case 'inMemory':
        return <Database size={16} />;
      default:
        return <Settings size={16} />;
    }
  };

  const getServerTypeColor = (type: MCPServerType) => {
    switch (type) {
      case 'httpStream':
        return '#9c27b0';
      case 'inMemory':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  const hasActiveServers = activeServers.length > 0;

  return (
    <Box>
      {/* 可折叠的MCP标题栏 */}
      <ListItem
        component="div"
        onClick={createOptimizedClickHandler(() => setExpanded(!expanded))}
        sx={{
          px: 2,
          py: 0.75,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          // 优化触摸响应
          touchAction: 'manipulation', // 防止双击缩放，优化触摸响应
          userSelect: 'none', // 防止文本选择
          // 移动端优化
          '@media (hover: none)': {
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              transform: 'scale(0.98)', // 轻微缩放反馈
              transition: 'all 0.1s ease-out'
            }
          },
          // 桌面端优化
          '@media (hover: hover)': {
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.02)',
              transform: 'none !important',
              boxShadow: 'none !important'
            },
            '&:focus': {
              backgroundColor: 'transparent !important'
            },
            '&:active': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)'
            }
          },
          '& *': {
            pointerEvents: 'none', // 防止子元素干扰点击
            '&:hover': {
              backgroundColor: 'transparent !important',
              transform: 'none !important'
            }
          }
        }}
      >
        <ListItemText
          primary="MCP 工具"
          secondary={
            hasActiveServers
              ? `${activeServers.length} 个服务器运行中 | 模式: ${mcpMode === 'function' ? '函数调用' : '提示词注入'}`
              : `模式: ${mcpMode === 'function' ? '函数调用' : '提示词注入'}`
          }
          primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2 }}
          secondaryTypographyProps={{
            fontSize: '0.75rem',
            lineHeight: 1.2,
            // 确保长文本能够正确换行且不与右侧按钮重叠
            sx: {
              wordBreak: 'break-word',
              whiteSpace: 'normal'
            }
          }}
          sx={{
            // 为右侧按钮预留足够空间
            pr: 6,
            // 确保文本区域不会延伸到右侧控件
            overflow: 'hidden'
          }}
        />
        <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasActiveServers && (
            <Chip
              label={activeServers.length}
              size="small"
              color="success"
              variant="outlined"
              sx={{ mr: 1 }}
            />
          )}
          <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>

      {/* 可折叠的内容区域 */}
      <OptimizedCollapse
        in={expanded}
        timeout={150}
        unmountOnExit
      >
        <Box sx={{ px: 2, pb: 2 }}>
          {/* MCP 工具总开关 */}
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                m: 0,
                // 确保开关不会与文本重叠
                '& .MuiFormControlLabel-label': {
                  flex: 1,
                  pr: 2 // 为右侧开关预留空间
                }
              }}
              labelPlacement="start"
              control={
                <CustomSwitch
                  checked={toolsEnabled}
                  onChange={(e) => handleToolsToggle(e.target.checked)}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    启用 MCP 工具
                  </Typography>
                  {hasActiveServers && (
                    <Chip
                      label={activeServers.length}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Box>
              }
            />
          </Box>

          <>
            <Divider sx={{ mb: 2 }} />

            {/* 工具调用模式选择 */}
            <Box sx={{ mb: 2, opacity: toolsEnabled ? 1 : 0.6 }}>
              <FormControl component="fieldset" disabled={!toolsEnabled}>
                <FormLabel component="legend" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                  工具调用模式
                </FormLabel>
                <RadioGroup
                  value={mcpMode}
                  onChange={handleModeChange}
                  sx={{ gap: 0.5 }}
                >
                  <FormControlLabel
                    value="function"
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Code size={16} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            函数调用
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{
                              // 确保长文本能够正确换行
                              wordBreak: 'break-word',
                              whiteSpace: 'normal',
                              display: 'block',
                              lineHeight: 1.2
                            }}
                          >
                            模型自动调用工具（推荐）
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{
                      m: 0,
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: mcpMode === 'function' ? 'primary.main' : 'divider',
                      bgcolor: mcpMode === 'function' ? alpha('#1976d2', 0.05) : 'transparent',
                      // 确保单选按钮项占据全部宽度
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      '& .MuiFormControlLabel-label': {
                        flex: 1
                      }
                    }}
                  />
                  <FormControlLabel
                    value="prompt"
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Brain size={16} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            提示词注入
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{
                              // 确保长文本能够正确换行
                              wordBreak: 'break-word',
                              whiteSpace: 'normal',
                              display: 'block',
                              lineHeight: 1.2
                            }}
                          >
                            通过提示词指导 AI 使用工具
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{
                      m: 0,
                      p: 1,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: mcpMode === 'prompt' ? 'primary.main' : 'divider',
                      bgcolor: mcpMode === 'prompt' ? alpha('#1976d2', 0.05) : 'transparent',
                      // 确保单选按钮项占据全部宽度
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      '& .MuiFormControlLabel-label': {
                        flex: 1
                      }
                    }}
                  />
                </RadioGroup>
              </FormControl>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* MCP 服务器列表 */}
            <Box sx={{ opacity: toolsEnabled ? 1 : 0.6 }}>
              <Accordion
                defaultExpanded
                sx={{
                  // 优化Accordion性能
                  '& .MuiAccordion-root': {
                    boxShadow: 'none',
                    '&:before': {
                      display: 'none',
                    }
                  },
                  '& .MuiAccordionSummary-root': {
                    minHeight: 'auto',
                    padding: '8px 0',
                    touchAction: 'manipulation', // 优化触摸响应
                    userSelect: 'none',
                  },
                  '& .MuiAccordionDetails-root': {
                    padding: 0,
                    contain: 'layout style paint', // 优化渲染性能
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={<ChevronDown size={16} />}
                  onClick={(e) => e.stopPropagation()} // 防止事件冒泡
                >
                  <Typography variant="subtitle2" fontWeight={600}>
                    MCP 服务器 ({servers.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  {servers.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        还没有配置 MCP 服务器
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleNavigateToSettings}
                        startIcon={<Settings size={16} />}
                      >
                        添加服务器
                      </Button>
                    </Box>
                  ) : (
                    <List dense sx={{ py: 0 }}>
                      {servers.map((server) => (
                        <ListItem
                          key={server.id}
                          sx={{
                            px: 1,
                            py: 0.5,
                            ...listItemOptimization,
                            // 确保列表项能够正确处理右侧控件
                            alignItems: 'flex-start'
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Avatar
                              sx={{
                                bgcolor: alpha(getServerTypeColor(server.type), 0.1),
                                color: getServerTypeColor(server.type),
                                width: 24,
                                height: 24
                              }}
                            >
                              {getServerTypeIcon(server.type)}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight={500}>
                                {server.name}
                              </Typography>
                            }
                            secondary={
                              server.description && (
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{
                                    // 重要：确保长描述文本能够正确换行且不与右侧按钮重叠
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                    display: 'block',
                                    lineHeight: 1.2
                                  }}
                                >
                                  {server.description}
                                </Typography>
                              )
                            }
                            sx={{
                              // 关键修复：为右侧开关预留足够空间
                              pr: 6, // 为开关预留空间
                              // 确保文本区域不会延伸到右侧控件
                              overflow: 'hidden'
                            }}
                          />
                          <ListItemSecondaryAction
                            sx={{
                              // 确保右侧控件有足够的空间
                              right: 8,
                              // 垂直居中对齐
                              top: '50%',
                              transform: 'translateY(-50%)',
                              // 确保控件不会被文本覆盖
                              zIndex: 1
                            }}
                          >
                            <CustomSwitch
                              checked={server.isActive}
                              onChange={createOptimizedSwitchHandler((checked) =>
                                handleToggleServer(server.id, checked)
                              )}
                              disabled={!toolsEnabled}
                            />
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {servers.length > 0 && (
                    <Box sx={{ p: 1 }}>
                      <Button
                        fullWidth
                        size="small"
                        variant="text"
                        onClick={handleNavigateToSettings}
                        startIcon={<Settings size={16} />}
                      >
                        管理服务器
                      </Button>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        </Box>
      </OptimizedCollapse>
    </Box>
  );
};

export default MCPSidebarControls;
