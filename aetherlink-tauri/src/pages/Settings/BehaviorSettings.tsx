import React from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Switch,
  AppBar,
  Toolbar,
  IconButton,
  Divider,
  alpha,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar
} from '@mui/material';
import { ArrowLeft, Send, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { setSendWithEnter, setEnableNotifications } from '../../shared/store/settingsSlice';
import useScrollPosition from '../../hooks/useScrollPosition';

const BehaviorSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-behavior', {
    autoRestore: true,
    restoreDelay: 100
  });

  const handleBack = () => {
    navigate('/settings');
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
            <ArrowLeft size={20} />
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
            行为设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 2,
          mt: 8,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        {/* 行为设置 */}
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
          <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              交互行为
            </Typography>
            <Typography variant="body2" color="text.secondary">
              自定义应用的交互方式和通知设置
            </Typography>
          </Box>

          <Divider />

          <List disablePadding>
            <ListItem disablePadding>
              <Box sx={{ width: '100%', p: 2 }}>
                <FormControlLabel
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    m: 0,
                    '& .MuiFormControlLabel-label': {
                      flex: 1
                    }
                  }}
                  labelPlacement="start"
                  control={
                    <Switch
                      checked={settings.sendWithEnter}
                      onChange={(e) => dispatch(setSendWithEnter(e.target.checked))}
                      color="primary"
                      sx={{ ml: 2 }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ListItemAvatar sx={{ minWidth: 'auto', mr: 2 }}>
                        <Avatar sx={{
                          bgcolor: alpha('#06b6d4', 0.12),
                          color: '#06b6d4',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          width: 40,
                          height: 40
                        }}>
                          <Send size={20} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>使用Enter键发送消息</Typography>}
                        secondary="按Enter键快速发送消息，使用Shift+Enter添加换行"
                      />
                    </Box>
                  }
                />
              </Box>
            </ListItem>

            <Divider variant="inset" component="li" sx={{ ml: 0 }} />

            <ListItem disablePadding>
              <Box sx={{ width: '100%', p: 2 }}>
                <FormControlLabel
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    m: 0,
                    '& .MuiFormControlLabel-label': {
                      flex: 1
                    }
                  }}
                  labelPlacement="start"
                  control={
                    <Switch
                      checked={settings.enableNotifications}
                      onChange={(e) => dispatch(setEnableNotifications(e.target.checked))}
                      color="primary"
                      sx={{ ml: 2 }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ListItemAvatar sx={{ minWidth: 'auto', mr: 2 }}>
                        <Avatar sx={{
                          bgcolor: alpha('#8b5cf6', 0.12),
                          color: '#8b5cf6',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          width: 40,
                          height: 40
                        }}>
                          <Bell size={20} />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography sx={{ fontWeight: 600, color: 'text.primary' }}>启用通知</Typography>}
                        secondary="当AI助手回复完成时，显示系统通知"
                      />
                    </Box>
                  }
                />
              </Box>
            </ListItem>
          </List>
        </Paper>
      </Box>
    </Box>
  );
};

export default BehaviorSettings;