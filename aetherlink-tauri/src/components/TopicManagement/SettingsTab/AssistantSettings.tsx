import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Divider,
  Avatar,
  Chip,
  Paper,
  alpha
} from '@mui/material';
import { ArrowLeft as ArrowBackIcon, Sliders as TuneIcon, User as PersonIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import type { Assistant } from '../../../shared/types/Assistant';

/**
 * 助手设置主页面
 */
const AssistantSettings: React.FC = () => {
  const navigate = useNavigate();
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);

  // 从Redux获取当前助手和助手列表
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);
  const allAssistants = useSelector((state: RootState) => state.assistants.assistants);

  useEffect(() => {
    // 默认选择当前助手
    if (currentAssistant) {
      setSelectedAssistant(currentAssistant);
    } else if (allAssistants.length > 0) {
      setSelectedAssistant(allAssistants[0]);
    }
  }, [currentAssistant, allAssistants]);

  const handleBack = () => {
    navigate('/settings');
  };

  const handleSelectAssistant = (assistant: Assistant) => {
    setSelectedAssistant(assistant);
  };

  const handleOpenModelSettings = () => {
    if (selectedAssistant) {
      navigate('/settings/assistant-model-settings', {
        state: { assistant: selectedAssistant }
      });
    }
  };

  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowBackIcon size={24} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            助手设置
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 内容区域 */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1, sm: 2 },
          mt: 8,
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 当前选中的助手信息 */}
        {selectedAssistant && (
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                当前选中助手
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                查看和配置选中助手的详细信息
              </Typography>
            </Box>

            <Divider />

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  bgcolor: alpha('#9333EA', 0.12),
                  color: '#9333EA',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}>
                  {selectedAssistant.emoji || selectedAssistant.name.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      fontSize: { xs: '1rem', sm: '1.1rem' }
                    }}
                  >
                    {selectedAssistant.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                  >
                    {selectedAssistant.description || '暂无描述'}
                  </Typography>
                  {selectedAssistant.isSystem && (
                    <Chip
                      label="系统助手"
                      size="small"
                      sx={{
                        mt: 0.5,
                        bgcolor: alpha('#9333EA', 0.1),
                        color: '#9333EA',
                        fontWeight: 500,
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 }
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          </Paper>
        )}

        {/* 助手列表 */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              选择助手
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              选择要配置的助手
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            {allAssistants.map((assistant, index) => (
              <React.Fragment key={assistant.id}>
                <ListItemButton
                  selected={selectedAssistant?.id === assistant.id}
                  onClick={() => handleSelectAssistant(assistant)}
                  sx={{
                    transition: 'all 0.2s',
                    '&.Mui-selected': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                      },
                    },
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{
                      width: { xs: 32, sm: 36 },
                      height: { xs: 32, sm: 36 },
                      bgcolor: alpha('#9333EA', 0.12),
                      color: '#9333EA',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                    }}>
                      {assistant.emoji || <PersonIcon size={20} />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        fontSize: { xs: '0.9rem', sm: '1rem' }
                      }}>
                        {assistant.name}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        color: 'text.secondary'
                      }}>
                        {assistant.description || '暂无描述'}
                      </Typography>
                    }
                  />
                  {assistant.isSystem && (
                    <Chip
                      label="系统"
                      size="small"
                      sx={{
                        mr: 1,
                        bgcolor: alpha('#8b5cf6', 0.1),
                        color: '#8b5cf6',
                        fontWeight: 500,
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 }
                      }}
                    />
                  )}
                </ListItemButton>
                {index < allAssistants.length - 1 && <Divider variant="inset" component="li" sx={{ ml: 0 }} />}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        {/* 设置选项 */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '1rem', sm: '1.1rem' }
              }}
            >
              设置选项
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              配置选中助手的各项参数和功能
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            <ListItemButton
              onClick={handleOpenModelSettings}
              disabled={!selectedAssistant}
              sx={{
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                }
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{
                  bgcolor: alpha('#06b6d4', 0.12),
                  color: '#06b6d4',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}>
                  <TuneIcon size={20} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    模型设置
                  </Typography>
                }
                secondary={
                  <Typography sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    color: 'text.secondary'
                  }}>
                    配置助手的模型参数和行为
                  </Typography>
                }
              />
              <ChevronRightIcon size={20} color="var(--mui-palette-text-secondary)" />
            </ListItemButton>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            {/* 预留其他设置选项 */}
            <ListItemButton disabled>
              <ListItemAvatar>
                <Avatar sx={{
                  bgcolor: 'rgba(0,0,0,0.05)',
                  color: 'text.disabled'
                }}>
                  <TuneIcon size={20} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography sx={{
                    fontWeight: 600,
                    color: 'text.disabled',
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    提示词设置
                  </Typography>
                }
                secondary={
                  <Typography sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    color: 'text.disabled'
                  }}>
                    即将推出
                  </Typography>
                }
              />
              <ChevronRightIcon size={20} color="var(--mui-palette-text-disabled)" />
            </ListItemButton>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItemButton disabled>
              <ListItemAvatar>
                <Avatar sx={{
                  bgcolor: 'rgba(0,0,0,0.05)',
                  color: 'text.disabled'
                }}>
                  <TuneIcon size={20} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography sx={{
                    fontWeight: 600,
                    color: 'text.disabled',
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    知识库设置
                  </Typography>
                }
                secondary={
                  <Typography sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    color: 'text.disabled'
                  }}>
                    即将推出
                  </Typography>
                }
              />
              <ChevronRightIcon size={20} color="var(--mui-palette-text-disabled)" />
            </ListItemButton>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItemButton disabled>
              <ListItemAvatar>
                <Avatar sx={{
                  bgcolor: 'rgba(0,0,0,0.05)',
                  color: 'text.disabled'
                }}>
                  <TuneIcon size={20} />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography sx={{
                    fontWeight: 600,
                    color: 'text.disabled',
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}>
                    MCP设置
                  </Typography>
                }
                secondary={
                  <Typography sx={{
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    color: 'text.disabled'
                  }}>
                    即将推出
                  </Typography>
                }
              />
              <ChevronRightIcon size={20} color="var(--mui-palette-text-disabled)" />
            </ListItemButton>
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

export default AssistantSettings;
