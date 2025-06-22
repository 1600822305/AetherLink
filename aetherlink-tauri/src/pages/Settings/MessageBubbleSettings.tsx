import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  Divider,
  alpha,
  FormControlLabel,
  Button,
  Slider,
  FormGroup
} from '@mui/material';
import { ArrowLeft, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import CustomSwitch from '../../components/CustomSwitch';
import { updateSettings } from '../../shared/store/settingsSlice';
import MessageBubblePreview from '../../components/preview/MessageBubblePreview';
import ColorPicker from '../../components/common/ColorPicker';

const MessageBubbleSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 获取版本切换样式设置，默认为'popup'
  const versionSwitchStyle = (settings as any).versionSwitchStyle || 'popup';
  
  // 获取小功能气泡显示设置，默认为true
  const showMicroBubbles = (settings as any).showMicroBubbles !== false;

  // 获取消息操作显示模式设置，默认为'bubbles'
  const messageActionMode = (settings as any).messageActionMode || 'bubbles';

  // 获取自定义气泡颜色设置
  const customBubbleColors = (settings as any).customBubbleColors || {
    userBubbleColor: '',
    userTextColor: '',
    aiBubbleColor: '',
    aiTextColor: ''
  };

  // 获取消息气泡宽度设置
  const messageBubbleMinWidth = settings.messageBubbleMinWidth || 50;
  const messageBubbleMaxWidth = settings.messageBubbleMaxWidth || 99;
  const userMessageMaxWidth = settings.userMessageMaxWidth || 80;

  // 获取头像和名称显示设置
  const showUserAvatar = settings.showUserAvatar !== false;
  const showUserName = settings.showUserName !== false;
  const showModelAvatar = settings.showModelAvatar !== false;
  const showModelName = settings.showModelName !== false;

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 版本切换样式变更事件处理函数
  const handleVersionSwitchStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      versionSwitchStyle: event.target.value
    }));
  };
  
  // 小功能气泡显示设置变更处理函数
  const handleMicroBubblesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showMicroBubbles: event.target.checked
    }));
  };

  // 消息操作显示模式变更处理函数
  const handleMessageActionModeChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      messageActionMode: event.target.value
    }));
  };

  // 自定义颜色变更处理函数
  const handleColorChange = (colorType: string, color: string) => {
    dispatch(updateSettings({
      customBubbleColors: {
        ...customBubbleColors,
        [colorType]: color
      }
    }));
  };

  // 重置颜色为默认值
  const handleResetColors = () => {
    dispatch(updateSettings({
      customBubbleColors: {
        userBubbleColor: '',
        userTextColor: '',
        aiBubbleColor: '',
        aiTextColor: ''
      }
    }));
  };

  // 消息气泡宽度设置处理函数
  const handleMessageBubbleMinWidthChange = (_event: Event, newValue: number | number[]) => {
    dispatch(updateSettings({
      messageBubbleMinWidth: newValue as number
    }));
  };

  const handleMessageBubbleMaxWidthChange = (_event: Event, newValue: number | number[]) => {
    dispatch(updateSettings({
      messageBubbleMaxWidth: newValue as number
    }));
  };

  const handleUserMessageMaxWidthChange = (_event: Event, newValue: number | number[]) => {
    dispatch(updateSettings({
      userMessageMaxWidth: newValue as number
    }));
  };

  // 头像和名称显示设置的事件处理函数
  const handleShowUserAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showUserAvatar: event.target.checked
    }));
  };

  const handleShowUserNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showUserName: event.target.checked
    }));
  };

  const handleShowModelAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showModelAvatar: event.target.checked
    }));
  };

  const handleShowModelNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showModelName: event.target.checked
    }));
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
            <ArrowLeft />
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
            信息气泡管理
          </Typography>
        </Toolbar>
      </AppBar>

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
        {/* 版本切换样式设置和小功能气泡显示设置 */}
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                气泡功能设置
              </Typography>
              <Tooltip title="设置信息气泡的功能和显示方式">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              自定义消息版本历史和功能气泡的显示方式
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            {/* 消息操作显示模式设置 */}
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>消息操作显示模式</InputLabel>
              <Select
                value={messageActionMode}
                onChange={handleMessageActionModeChange}
                label="消息操作显示模式"
              >
                <MenuItem value="bubbles">功能气泡模式（默认）</MenuItem>
                <MenuItem value="toolbar">底部工具栏模式</MenuItem>
              </Select>
            </FormControl>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 3,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                lineHeight: 1.5
              }}
            >
              选择消息操作功能的显示方式：
              <br />• 功能气泡模式：在消息气泡上方显示小功能气泡和右上角三点菜单（默认方式）
              <br />• 底部工具栏模式：在消息气泡底部显示完整的操作工具栏，包含所有功能按钮
            </Typography>

            {/* 分隔线 */}
            <Divider sx={{ my: 2 }} />

            {/* 小功能气泡显示设置 - 仅在气泡模式下显示 */}
            {messageActionMode === 'bubbles' && (
              <>
                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={showMicroBubbles}
                      onChange={handleMicroBubblesChange}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        显示功能气泡
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        在消息气泡上方显示播放和版本切换的小功能气泡
                      </Typography>
                    </Box>
                  }
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    mb: 2,
                    mt: 1
                  }}
                />

                {/* 分隔线 */}
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {/* 版本切换样式设置 - 仅在气泡模式且显示功能气泡时显示 */}
            {messageActionMode === 'bubbles' && showMicroBubbles && (
              <>
                <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                  <InputLabel>版本切换样式</InputLabel>
                  <Select
                    value={versionSwitchStyle}
                    onChange={handleVersionSwitchStyleChange}
                    label="版本切换样式"
                  >
                    <MenuItem value="popup">弹出列表（默认）</MenuItem>
                    <MenuItem value="arrows">箭头式切换 &lt; 2 &gt;</MenuItem>
                  </Select>
                </FormControl>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                    lineHeight: 1.5
                  }}
                >
                  设置版本历史的显示和切换方式：
                  <br />• 弹出列表：点击版本历史按钮，弹出所有版本列表（默认方式）
                  <br />• 箭头式切换：使用左右箭头在版本间切换，类似 &lt; 2 &gt; 的形式
                </Typography>
              </>
            )}
          </Box>
        </Paper>

        {/* 消息气泡宽度设置 */}
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                消息气泡宽度设置
              </Typography>
              <Tooltip title="自定义聊天界面中消息气泡的宽度范围，适配不同设备屏幕">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              调整消息气泡的宽度范围以适配不同设备屏幕
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            {/* AI消息最大宽度 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                AI消息最大宽度: {messageBubbleMaxWidth}%
              </Typography>
              <Slider
                value={messageBubbleMaxWidth}
                onChange={handleMessageBubbleMaxWidthChange}
                min={50}
                max={100}
                step={5}
                marks={[
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                sx={{
                  '& .MuiSlider-thumb': {
                    bgcolor: 'primary.main',
                  },
                  '& .MuiSlider-track': {
                    bgcolor: 'primary.main',
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'divider',
                  }
                }}
              />
            </Box>

            {/* 用户消息最大宽度 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                用户消息最大宽度: {userMessageMaxWidth}%
              </Typography>
              <Slider
                value={userMessageMaxWidth}
                onChange={handleUserMessageMaxWidthChange}
                min={50}
                max={100}
                step={5}
                marks={[
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                sx={{
                  '& .MuiSlider-thumb': {
                    bgcolor: 'secondary.main',
                  },
                  '& .MuiSlider-track': {
                    bgcolor: 'secondary.main',
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'divider',
                  }
                }}
              />
            </Box>

            {/* 消息最小宽度 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                消息最小宽度: {messageBubbleMinWidth}%
              </Typography>
              <Slider
                value={messageBubbleMinWidth}
                onChange={handleMessageBubbleMinWidthChange}
                min={10}
                max={90}
                step={5}
                marks={[
                  { value: 10, label: '10%' },
                  { value: 30, label: '30%' },
                  { value: 50, label: '50%' },
                  { value: 70, label: '70%' },
                  { value: 90, label: '90%' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                sx={{
                  '& .MuiSlider-thumb': {
                    bgcolor: 'success.main',
                  },
                  '& .MuiSlider-track': {
                    bgcolor: 'success.main',
                  },
                  '& .MuiSlider-rail': {
                    bgcolor: 'divider',
                  }
                }}
              />
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 2,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                lineHeight: 1.5,
                p: 2,
                bgcolor: 'rgba(0,0,0,0.02)',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <strong>宽度设置说明：</strong>
              <br />• <strong>AI消息最大宽度</strong>：控制AI回复的最大显示宽度
              <br />• <strong>用户消息最大宽度</strong>：控制用户消息的最大显示宽度
              <br />• <strong>消息最小宽度</strong>：所有消息的最小显示宽度，避免过窄影响阅读
              <br />• 较小的宽度适合手机等窄屏设备，较大的宽度适合平板和电脑
            </Typography>
          </Box>
        </Paper>

        {/* 头像和名称显示设置 */}
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                头像和名称显示
              </Typography>
              <Tooltip title="自定义聊天界面中用户和模型的头像及名称显示">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              控制消息气泡中用户和AI模型的头像及名称显示
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <FormGroup>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={showUserAvatar}
                    onChange={handleShowUserAvatarChange}
                  />
                }
                label="显示用户头像"
              />
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={showUserName}
                    onChange={handleShowUserNameChange}
                  />
                }
                label="显示用户名称"
              />
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={showModelAvatar}
                    onChange={handleShowModelAvatarChange}
                  />
                }
                label="显示模型头像"
              />
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={showModelName}
                    onChange={handleShowModelNameChange}
                  />
                }
                label="显示模型名称"
              />
            </FormGroup>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              控制聊天界面中用户和AI模型的头像及名称显示。可以根据个人喜好选择性隐藏这些元素，获得更简洁的聊天体验。
            </Typography>
          </Box>
        </Paper>

        {/* 自定义气泡颜色设置 */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  自定义气泡颜色
                </Typography>
                <Tooltip title="自定义用户和AI消息气泡的背景色和字体颜色">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Info />
                  </IconButton>
                </Tooltip>
              </Box>
              <Button
                size="small"
                onClick={handleResetColors}
                variant="outlined"
                sx={{ fontSize: '0.8rem' }}
              >
                重置默认
              </Button>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              自定义消息气泡的背景色和字体颜色，留空则使用系统默认颜色
            </Typography>
          </Box>

          <Divider />

          <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
              {/* 左侧：颜色设置 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* 表头 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Typography variant="body2" sx={{ minWidth: '80px' }}>
                    {/* 空白占位 */}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', minWidth: '80px', textAlign: 'center', fontWeight: 500 }}>
                    背景色
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', minWidth: '80px', textAlign: 'center', fontWeight: 500 }}>
                    字体色
                  </Typography>
                </Box>

                {/* 用户消息颜色设置 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, minWidth: '80px' }}>
                    用户消息
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: '80px' }}>
                    <ColorPicker
                      value={customBubbleColors.userBubbleColor || '#1976d2'}
                      onChange={(color) => handleColorChange('userBubbleColor', color)}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: '80px' }}>
                    <ColorPicker
                      value={customBubbleColors.userTextColor || '#ffffff'}
                      onChange={(color) => handleColorChange('userTextColor', color)}
                      size="small"
                    />
                  </Box>
                </Box>

                {/* AI消息颜色设置 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, minWidth: '80px' }}>
                    AI回复
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: '80px' }}>
                    <ColorPicker
                      value={customBubbleColors.aiBubbleColor || '#f5f5f5'}
                      onChange={(color) => handleColorChange('aiBubbleColor', color)}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'center', minWidth: '80px' }}>
                    <ColorPicker
                      value={customBubbleColors.aiTextColor || '#333333'}
                      onChange={(color) => handleColorChange('aiTextColor', color)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1,
                    fontSize: '0.8rem',
                    lineHeight: 1.4
                  }}
                >
                  提示：字体颜色同时控制气泡内文字和工具栏按钮的颜色
                </Typography>
              </Box>

              {/* 右侧：实时预览 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <MessageBubblePreview
                  customBubbleColors={customBubbleColors}
                  messageActionMode={messageActionMode}
                  showMicroBubbles={showMicroBubbles}
                  messageBubbleMinWidth={messageBubbleMinWidth}
                  messageBubbleMaxWidth={messageBubbleMaxWidth}
                  userMessageMaxWidth={userMessageMaxWidth}
                  showUserAvatar={showUserAvatar}
                  showUserName={showUserName}
                  showModelAvatar={showModelAvatar}
                  showModelName={showModelName}
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Box>
    </Box>
  );
};

export default MessageBubbleSettings; 