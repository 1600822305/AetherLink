import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  alpha,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { ArrowLeft, Trash2, Camera, Video, BookOpen, Search, Plus, Wrench, Image, FileText, ArrowLeftRight, Send, Mic } from 'lucide-react';
import { CustomIcon } from '../../components/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import DraggableButtonConfig from '../../components/DraggableButtonConfig';
import { ChatInput, CompactChatInput, IntegratedChatInput, ChatToolbar } from '../../components/input';

// 可用的自定义按钮配置
const AVAILABLE_BUTTONS = [
  {
    id: 'tools',
    label: '扩展',
    icon: () => <CustomIcon name="settingsPanel" size={20} />,
    description: '启用/禁用扩展功能',
    color: '#4CAF50'
  },
  {
    id: 'mcp-tools',
    label: '工具',
    icon: Wrench,
    description: '启用/禁用MCP工具功能',
    color: '#4CAF50'
  },
  {
    id: 'clear',
    label: '清空内容',
    icon: Trash2,
    description: '清空当前话题内容',
    color: 'currentColor' // 使用主题适配的颜色
  },
  {
    id: 'image',
    label: '生成图片',
    icon: Camera,
    description: '切换图片生成模式',
    color: '#9C27B0'
  },
  {
    id: 'video',
    label: '生成视频',
    icon: Video,
    description: '切换视频生成模式',
    color: '#E91E63'
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: BookOpen,
    description: '访问知识库功能',
    color: '#059669'
  },
  {
    id: 'search',
    label: '网络搜索',
    icon: Search,
    description: '启用网络搜索功能',
    color: '#3B82F6'
  },
  {
    id: 'upload',
    label: '添加内容',
    icon: Plus,
    description: '添加图片、文件或使用其他功能',
    color: '#F59E0B'
  },
  {
    id: 'camera',
    label: '拍摄照片',
    icon: Camera,
    description: '使用相机拍摄照片',
    color: '#9C27B0'
  },
  {
    id: 'photo-select',
    label: '选择图片',
    icon: Image,
    description: '从相册选择图片',
    color: '#1976D2'
  },
  {
    id: 'file-upload',
    label: '上传文件',
    icon: FileText,
    description: '上传文档或其他文件',
    color: '#4CAF50'
  },
  {
    id: 'ai-debate',
    label: 'AI辩论',
    icon: () => <CustomIcon name="aiDebate" size={20} />,
    description: '开始多AI角色辩论',
    color: '#2196F3'
  },
  {
    id: 'quick-phrase',
    label: '快捷短语',
    icon: () => <CustomIcon name="quickPhrase" size={20} />,
    description: '插入预设的文本短语',
    color: '#9C27B0'
  },
  {
    id: 'multi-model',
    label: '多模型发送',
    icon: ArrowLeftRight,
    description: '同时向多个AI模型发送消息',
    color: 'currentColor' // 使用主题适配的颜色
  },
  {
    id: 'send',
    label: '发送按钮',
    icon: Send,
    description: '发送消息按钮',
    color: 'currentColor'
  },
  {
    id: 'voice',
    label: '语音按钮',
    icon: Mic,
    description: '语音输入按钮',
    color: 'currentColor'
  }
];

// 输入框预览组件
const InputBoxPreview: React.FC<{
  inputBoxStyle: string;
  inputLayoutStyle: string;
}> = ({ inputLayoutStyle }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 预览用的空函数
  const previewProps = {
    onSendMessage: () => {},
    onSendImagePrompt: () => {},
    isLoading: false,
    allowConsecutiveMessages: true,
    imageGenerationMode: false,
    videoGenerationMode: false,
    webSearchActive: false,
    onStopResponse: () => {},
    isStreaming: false,
    isDebating: false,
    toolsEnabled: true,
    availableModels: [],
    onClearTopic: () => {},
    onNewTopic: () => {},
    toggleImageGenerationMode: () => {},
    toggleVideoGenerationMode: () => {},
    toggleWebSearch: () => {},
    toggleToolsEnabled: () => {},
    onToolsEnabledChange: () => {},
  };

  // 根据布局样式选择对应的输入框组件
  const renderInputComponent = () => {
    switch (inputLayoutStyle) {
      case 'compact':
        return (
          <CompactChatInput
            {...previewProps}
          />
        );
      case 'integrated':
        return (
          <IntegratedChatInput
            {...previewProps}
          />
        );
      default:
        return (
          <Box>
            <ChatInput {...previewProps} />
            <Box sx={{ mt: 1 }}>
              <ChatToolbar
                onClearTopic={previewProps.onClearTopic}
                toggleImageGenerationMode={previewProps.toggleImageGenerationMode}
                toggleWebSearch={previewProps.toggleWebSearch}
                onToolsEnabledChange={previewProps.onToolsEnabledChange}
                imageGenerationMode={false}
                webSearchActive={false}
                toolsEnabled={true}
              />
            </Box>
          </Box>
        );
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 3,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        borderRadius: 2,
        minHeight: '120px',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        实时预览效果
      </Typography>
      <Box
        sx={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '600px',
          transform: isMobile ? 'scale(1)' : 'scale(1)',
          transformOrigin: 'center',
        }}
      >
        {renderInputComponent()}
      </Box>
    </Box>
  );
};

const InputBoxSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 获取输入框相关设置
  const inputBoxStyle = settings.inputBoxStyle || 'default';
  const inputLayoutStyle = (settings as any).inputLayoutStyle || 'default';

  // 新的左右布局配置
  const leftButtons = (settings as any).integratedInputLeftButtons || ['tools', 'clear', 'search'];
  const rightButtons = (settings as any).integratedInputRightButtons || ['voice', 'send'];

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleInputBoxStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      inputBoxStyle: event.target.value
    }));
  };

  const handleInputLayoutStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      inputLayoutStyle: event.target.value
    }));
  };



  // 处理左右布局更新
  const handleLayoutUpdate = (newLeftButtons: string[], newRightButtons: string[]) => {
    dispatch(updateSettings({
      integratedInputLeftButtons: newLeftButtons,
      integratedInputRightButtons: newRightButtons,
      // 同时更新旧的配置以保持兼容性
      integratedInputButtons: [...newLeftButtons, ...newRightButtons]
    } as any));
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
            输入框管理设置
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
        {/* 实时预览区域 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            实时预览
          </Typography>
          <InputBoxPreview
            inputBoxStyle={inputBoxStyle}
            inputLayoutStyle={inputLayoutStyle}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            当前配置：{inputBoxStyle === 'default' ? '默认风格' : inputBoxStyle === 'modern' ? '现代风格' : '简约风格'} + {inputLayoutStyle === 'default' ? '默认样式' : inputLayoutStyle === 'compact' ? '聚合样式' : '集成样式'}
          </Typography>

          {/* 集成样式自定义按钮配置 - 新的拖拽式配置 */}
          {inputLayoutStyle === 'integrated' && (
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #eee' }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                自定义输入框按钮布局
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                拖拽按钮来自定义左右布局，点击眼睛图标来显示/隐藏按钮。配置后可在上方预览中查看效果：
              </Typography>

              <DraggableButtonConfig
                availableButtons={AVAILABLE_BUTTONS}
                leftButtons={leftButtons}
                rightButtons={rightButtons}
                onUpdateLayout={handleLayoutUpdate}
              />

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                左侧 {leftButtons.length} 个按钮，右侧 {rightButtons.length} 个按钮。
                按钮将按配置的左右布局显示在输入框底部。
              </Typography>
            </Box>
          )}
        </Paper>

        <Divider sx={{ mb: 3 }} />

        {/* 输入框风格设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            输入框风格
          </Typography>

          <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
            <InputLabel>输入框风格</InputLabel>
            <Select
              value={inputBoxStyle}
              onChange={handleInputBoxStyleChange}
              label="输入框风格"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="default">默认风格</MenuItem>
              <MenuItem value="modern">现代风格</MenuItem>
              <MenuItem value="minimal">简约风格</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            选择聊天输入框和工具栏的视觉风格：
            <br />• <strong>默认风格</strong>：标准圆角，适中阴影，经典外观
            <br />• <strong>现代风格</strong>：更圆润的边角，立体阴影，毛玻璃背景效果
            <br />• <strong>简约风格</strong>：尖锐边角，无阴影，清爽简洁
          </Typography>
        </Paper>

        {/* 输入框布局样式设置 */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #eee' }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            输入框布局样式
          </Typography>

          <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
            <InputLabel>布局样式</InputLabel>
            <Select
              value={inputLayoutStyle}
              onChange={handleInputLayoutStyleChange}
              label="布局样式"
              MenuProps={{
                disableAutoFocus: true,
                disableRestoreFocus: true
              }}
            >
              <MenuItem value="default">默认样式（工具栏+输入框分离）</MenuItem>
              <MenuItem value="compact">聚合样式（输入框+功能图标集成）</MenuItem>
              <MenuItem value="integrated">集成样式（工具菜单+垂直布局）</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            选择聊天输入区域的布局方式：
            <br />• 默认样式：工具栏和输入框分别显示，功能清晰分离
            <br />• 聚合样式：输入框上方，下方为功能图标行，点击+号可展开更多功能
            <br />• 集成样式：工具菜单集成到输入框，采用垂直布局和现代化设计
          </Typography>
        </Paper>



        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Box>
    </Box>
  );
};

export default InputBoxSettings;
