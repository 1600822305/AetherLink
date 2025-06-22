import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  FormGroup,
  FormControlLabel,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  alpha,
  Button,
  Slider,
  Alert,
  Card,
  CardMedia,
  CardActions
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { ArrowLeft, Info, Upload, X, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import {
  validateImageFile,
  compressImage,
  cleanupBackgroundImage,
  getBackgroundPresets,
  getBackgroundPositions,
  getBackgroundRepeats
} from '../../shared/utils/backgroundUtils';
import useScrollPosition from '../../hooks/useScrollPosition';


const ChatInterfaceSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-chat-interface', {
    autoRestore: true,
    restoreDelay: 100
  });

  // 本地状态
  const [uploadError, setUploadError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取所有设置项
  const multiModelDisplayStyle = (settings as any).multiModelDisplayStyle || 'horizontal';
  const showToolDetails = (settings as any).showToolDetails !== false;
  const showCitationDetails = (settings as any).showCitationDetails !== false;

  const showSystemPromptBubble = settings.showSystemPromptBubble !== false;

  // 背景设置
  const chatBackground = settings.chatBackground || {
    enabled: false,
    imageUrl: '',
    opacity: 0.3,
    size: 'cover',
    position: 'center',
    repeat: 'no-repeat'
  };


  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleMultiModelDisplayStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      multiModelDisplayStyle: event.target.value
    }));
  };

  const handleShowToolDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showToolDetails: event.target.checked
    }));
  };

  const handleShowCitationDetailsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      showCitationDetails: event.target.checked
    }));
  };





  const handleSystemPromptBubbleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      showSystemPromptBubble: event.target.value === 'show'
    }));
  };




  // 背景设置事件处理函数
  const handleBackgroundEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        enabled: event.target.checked
      }
    }));
  };

  const handleBackgroundOpacityChange = (_event: Event, newValue: number | number[]) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        opacity: newValue as number
      }
    }));
  };

  const handleBackgroundSizeChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        size: event.target.value
      }
    }));
  };

  const handleBackgroundPositionChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        position: event.target.value
      }
    }));
  };

  const handleBackgroundRepeatChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        repeat: event.target.value
      }
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsUploading(true);

    try {
      // 验证文件
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setUploadError(validation.error || '文件验证失败');
        return;
      }

      // 压缩并转换为数据URL
      const dataUrl = await compressImage(file);

      // 清理旧的背景图片
      if (chatBackground.imageUrl) {
        cleanupBackgroundImage(chatBackground.imageUrl);
      }

      // 更新设置
      dispatch(updateSettings({
        chatBackground: {
          ...chatBackground,
          imageUrl: dataUrl,
          enabled: true // 上传后自动启用
        }
      }));

    } catch (error) {
      setUploadError('图片上传失败，请重试');
      console.error('Background upload error:', error);
    } finally {
      setIsUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBackground = () => {
    if (chatBackground.imageUrl) {
      cleanupBackgroundImage(chatBackground.imageUrl);
    }

    dispatch(updateSettings({
      chatBackground: {
        ...chatBackground,
        imageUrl: '',
        enabled: false
      }
    }));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
            聊天界面设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        ref={containerRef}
        onScroll={handleScroll}
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


        {/* 多模型对比显示设置 */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">多模型对比显示</Typography>
            <Tooltip title="配置多模型对比时的布局方式">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
            <InputLabel>布局方式</InputLabel>
            <Select
              value={multiModelDisplayStyle}
              onChange={handleMultiModelDisplayStyleChange}
              label="布局方式"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="horizontal">水平布局（默认）</MenuItem>
              <MenuItem value="vertical">垂直布局（并排显示）</MenuItem>
              <MenuItem value="single">单独布局（堆叠显示）</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            设置多模型对比时的布局方式。水平布局将模型响应并排显示，垂直布局将模型响应上下排列，单独布局将模型响应堆叠显示。
          </Typography>
        </Paper>





        {/* 工具调用设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">工具调用设置</Typography>
            <Tooltip title="配置工具调用的显示详情">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <FormGroup>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={showToolDetails}
                  onChange={handleShowToolDetailsChange}
                />
              }
              label="显示工具调用详情"
            />
          </FormGroup>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            控制是否显示工具调用的详细信息，包括调用参数和返回结果。
          </Typography>
        </Paper>

        {/* 引用设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">引用设置</Typography>
            <Tooltip title="配置引用的显示详情">
              <IconButton size="small" sx={{ ml: 1 }}>
                <Info size={16} />
              </IconButton>
            </Tooltip>
          </Box>

          <FormGroup>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={showCitationDetails}
                  onChange={handleShowCitationDetailsChange}
                />
              }
              label="显示引用详情"
            />
          </FormGroup>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            控制是否显示引用的详细信息，包括引用来源和相关内容。
          </Typography>
        </Paper>



        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            系统提示词气泡设置
          </Typography>

          <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
            <InputLabel id="prompt-bubble-style-label">系统提示词气泡显示</InputLabel>
            <Select
              labelId="prompt-bubble-style-label"
              value={showSystemPromptBubble ? 'show' : 'hide'}
              onChange={handleSystemPromptBubbleChange}
              label="系统提示词气泡显示"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="show">显示</MenuItem>
              <MenuItem value="hide">隐藏</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            控制是否在聊天界面顶部显示系统提示词气泡。系统提示词气泡可以帮助您查看和编辑当前会话的系统提示词。
          </Typography>
        </Paper>

        {/* 聊天背景设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            聊天背景设置
          </Typography>

          {/* 启用背景开关 */}
          <FormGroup sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <CustomSwitch
                  checked={chatBackground.enabled}
                  onChange={handleBackgroundEnabledChange}
                />
              }
              label="启用自定义聊天背景"
            />
          </FormGroup>

          {/* 背景图片上传 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              背景图片
            </Typography>

            {chatBackground.imageUrl ? (
              <Card sx={{ maxWidth: 200, mb: 2 }}>
                <CardMedia
                  component="img"
                  height="120"
                  image={chatBackground.imageUrl}
                  alt="聊天背景预览"
                  sx={{ objectFit: 'cover' }}
                />
                <CardActions sx={{ p: 1 }}>
                  <Button
                    size="small"
                    startIcon={<X size={16} />}
                    onClick={handleRemoveBackground}
                    color="error"
                  >
                    移除
                  </Button>
                </CardActions>
              </Card>
            ) : (
              <Box
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: 1,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={handleUploadClick}
              >
                <ImageIcon size={32} style={{ color: '#ccc', marginBottom: 8 }} />
                <Typography variant="body2" color="text.secondary">
                  点击上传背景图片
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  支持 JPG、PNG、GIF、WebP 格式，最大 5MB
                </Typography>
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {!chatBackground.imageUrl && (
              <Button
                variant="outlined"
                startIcon={<Upload size={16} />}
                onClick={handleUploadClick}
                disabled={isUploading}
                sx={{ mt: 1 }}
              >
                {isUploading ? '上传中...' : '选择图片'}
              </Button>
            )}

            {uploadError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {uploadError}
              </Alert>
            )}
          </Box>

          {/* 背景设置选项 */}
          {chatBackground.enabled && (
            <>
              {/* 透明度设置 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  背景透明度: {Math.round(chatBackground.opacity * 100)}%
                </Typography>
                <Slider
                  value={chatBackground.opacity}
                  onChange={handleBackgroundOpacityChange}
                  min={0.1}
                  max={1}
                  step={0.1}
                  marks={[
                    { value: 0.1, label: '10%' },
                    { value: 0.5, label: '50%' },
                    { value: 1, label: '100%' }
                  ]}
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* 背景尺寸 */}
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>背景尺寸</InputLabel>
                <Select
                  value={chatBackground.size}
                  onChange={handleBackgroundSizeChange}
                  label="背景尺寸"
                  MenuProps={{
                    disableAutoFocus: true,
                    disableRestoreFocus: true
                  }}
                >
                  {getBackgroundPresets().map((preset) => (
                    <MenuItem key={preset.value} value={preset.value}>
                      <Box>
                        <Typography variant="body2">{preset.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {preset.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 背景位置 */}
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>背景位置</InputLabel>
                <Select
                  value={chatBackground.position}
                  onChange={handleBackgroundPositionChange}
                  label="背景位置"
                  MenuProps={{
                    disableAutoFocus: true,
                    disableRestoreFocus: true
                  }}
                >
                  {getBackgroundPositions().map((position) => (
                    <MenuItem key={position.value} value={position.value}>
                      {position.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 背景重复 */}
              <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>背景重复</InputLabel>
                <Select
                  value={chatBackground.repeat}
                  onChange={handleBackgroundRepeatChange}
                  label="背景重复"
                  MenuProps={{
                    disableAutoFocus: true,
                    disableRestoreFocus: true
                  }}
                >
                  {getBackgroundRepeats().map((repeat) => (
                    <MenuItem key={repeat.value} value={repeat.value}>
                      {repeat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            自定义聊天界面背景图片。背景只会显示在聊天消息区域，不会影响顶部工具栏和侧边栏。消息气泡和其他界面元素会显示在背景之上。
          </Typography>
        </Paper>

        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Box>
    </Box>
  );
};

export default ChatInterfaceSettings;