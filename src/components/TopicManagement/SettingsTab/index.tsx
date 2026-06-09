import { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import { User, Cog, PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingGroups from './SettingGroups';
import AvatarUploader from '../../settings/AvatarUploader';
import MCPSidebarControls from './MCPSidebarControls';
import ThrottleLevelSelector from './ThrottleLevelSelector';
import DynamicContextSettings from './DynamicContextSettings';
import CodeBlockSettings from './CodeBlockSettings';
import InputSettings from './InputSettings';
import MathSettings from './MathSettings';
import { useSettingsStorage, syncAssistantMaxTokens } from './hooks/useSettingsStorage';
import SidebarWidthDialog from './SidebarWidthDialog';


interface Setting {
  id: string;
  name: string;
  description: string;
  defaultValue: boolean | string;
  type?: 'switch' | 'select';
  options?: Array<{ value: string; label: string }>;
}

interface SettingsTabProps {
  /** 设置项配置数组，由 useSettingsManagement Hook 提供 */
  settings: Setting[];
  /** 设置变更回调函数 */
  onSettingChange: (settingId: string, value: boolean | string) => void;
  /** 当前模型 ID (用于动态参数显示) */
  modelId?: string;
  /** 初始上下文长度 */
  initialContextLength?: number;
  /** 上下文长度变更回调 */
  onContextLengthChange?: (value: number) => void;
  /** 初始上下文计数 */
  initialContextCount?: number;
  /** 上下文计数变更回调 */
  onContextCountChange?: (value: number) => void;
  /** 初始数学渲染器 */
  initialMathRenderer?: string;
  /** 数学渲染器变更回调 */
  onMathRendererChange?: (value: string) => void;
  /** 初始思考努力程度 */
  initialThinkingEffort?: string;
  /** 思考努力程度变更回调 */
  onThinkingEffortChange?: (value: string) => void;
  /** MCP 模式 */
  mcpMode?: 'prompt' | 'function';
  /** MCP 工具是否启用 */
  toolsEnabled?: boolean;
  /** MCP 模式变更回调 */
  onMCPModeChange?: (mode: 'prompt' | 'function') => void;
  /** MCP 工具开关回调 */
  onToolsToggle?: (enabled: boolean) => void;
}

/**
 * 设置选项卡主组件
 */
export default function SettingsTab({
  settings,
  onSettingChange,
  modelId,
  mcpMode = 'function',
  toolsEnabled = true,
  onMCPModeChange,
  onToolsToggle
}: SettingsTabProps) {
  const navigate = useNavigate();

  // 使用统一的设置管理 Hook
  const {
    userAvatar,
    updateSetting,
    updateUserAvatar,
    getSetting
  } = useSettingsStorage();

  // 头像对话框状态
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);

  // 侧边栏宽度控制
  const [widthDialogOpen, setWidthDialogOpen] = useState(false);
  const currentWidth = getSetting('sidebarWidth', 350);

  // 使用统一的设置配置（由 useSettingsManagement Hook 提供）

  // 处理头像上传
  const handleAvatarDialogOpen = () => setIsAvatarDialogOpen(true);
  const handleAvatarDialogClose = () => setIsAvatarDialogOpen(false);
  const handleSaveAvatar = (avatarDataUrl: string) => updateUserAvatar(avatarDataUrl);

  // 统一的设置变更处理
  const handleSettingChange = (settingId: string, value: boolean | string) => {
    updateSetting(settingId, value);
    // 如果有外部传入的回调，也调用它
    if (onSettingChange) {
      onSettingChange(settingId, value);
    }
  };

  // 设置分组
  const settingGroups = [
    {
      id: 'general',
      title: '常规设置',
      settings: settings
    }
  ];

  return (
    <List sx={{ 
      p: 0,
      // 启用滚动 - 使用隐藏滚动条
      height: '100%',
      maxHeight: 'calc(100vh - 160px)', // 预留顶部Tab栏和底部安全区域
      overflowY: 'auto',
      overflowX: 'hidden',
      // 隐藏滚动条样式
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none', // IE/Edge
      '&::-webkit-scrollbar': {
        display: 'none', // Chrome/Safari/Opera
      },
      // 全局禁用所有可点击元素的蓝色高亮
      '& .MuiListItem-root': {
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      },
    }}>
      <ListItem
        sx={{
          px: 2,
          pt: 0,
          pb: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
        disablePadding
      >
        <ListItemButton
          onClick={() => navigate('/settings')}
          sx={{
            flex: 1,
            px: 0,
            py: 0,
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.04)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: '40px' }}>
            <Cog size={20} color="#1976d2" />
          </ListItemIcon>
          <ListItemText
            sx={{ my: 0 }}
            primary={
              <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
                设置
              </Typography>
            }
            secondary={
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                进入完整设置页面
              </Typography>
            }
          />
        </ListItemButton>
        
        {/* 分割线 */}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: 'center' }} />
        
        {/* 侧边栏宽度控制按钮 */}
        <Tooltip title={`侧边栏宽度: ${currentWidth}px`}>
          <IconButton
            size="small"
            onClick={() => setWidthDialogOpen(true)}
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.04)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
            }}
          >
            <PanelLeft size={18} />
          </IconButton>
        </Tooltip>
      </ListItem>

      {/* 侧边栏宽度调整对话框 */}
      <SidebarWidthDialog
        open={widthDialogOpen}
        onClose={() => setWidthDialogOpen(false)}
        currentWidth={currentWidth}
        onWidthChange={(width) => updateSetting('sidebarWidth', width)}
      />

      <Divider sx={{ my: 0.5 }} />

      {/* 用户头像设置区域 */}
      <ListItem sx={{
        px: 2,
        py: 1,
        display: 'flex',
        justifyContent: 'space-between',
        bgcolor: 'rgba(255, 193, 7, 0.1)', // 黄色背景提示区域
        borderLeft: '3px solid #ffc107' // 左侧黄色线条
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            src={userAvatar}
            sx={{
              width: 36,
              height: 36,
              mr: 1.5,
              bgcolor: userAvatar ? 'transparent' : '#87d068',
              borderRadius: '25%' // 方圆形头像
            }}
          >
            {!userAvatar && "我"}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.9rem', lineHeight: 1.2 }}>
              用户头像
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
              设置您的个人头像
            </Typography>
          </Box>
        </Box>
        <Tooltip title="设置头像">
          <IconButton
            size="small"
            color="primary"
            onClick={handleAvatarDialogOpen}
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.04)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' }
            }}
          >
            <User size={16} />
          </IconButton>
        </Tooltip>
      </ListItem>

      <Divider sx={{ my: 0.5 }} />

      {/* 使用SettingGroups渲染设置分组 */}
      <SettingGroups groups={settingGroups} onSettingChange={handleSettingChange} />
      <Divider sx={{ my: 0.5 }} />

      {/* 动态上下文设置（放在常规设置下面） */}
      <DynamicContextSettings
        modelId={modelId}
        contextWindowSize={getSetting('contextWindowSize', 0)}
        contextCount={getSetting('contextCount', 20)}
        maxOutputTokens={getSetting('maxOutputTokens', 8192)}
        enableMaxOutputTokens={getSetting('enableMaxOutputTokens', true)}
        thinkingBudget={getSetting('thinkingBudget', 1024)}
        onContextWindowSizeChange={(value: number) => updateSetting('contextWindowSize', value)}
        onContextCountChange={(value: number) => updateSetting('contextCount', value)}
        onMaxOutputTokensChange={async (value: number) => {
          updateSetting('maxOutputTokens', value);
          await syncAssistantMaxTokens(value);
        }}
        onEnableMaxOutputTokensChange={(value: boolean) => updateSetting('enableMaxOutputTokens', value)}
        onThinkingBudgetChange={(value: number) => updateSetting('thinkingBudget', value)}
      />
      <Divider sx={{ my: 0.5 }} />

      {/* 输入设置 */}
      <InputSettings />
      <Divider sx={{ my: 0.5 }} />

      {/* 节流强度选择器 */}
      <ThrottleLevelSelector />
      <Divider sx={{ my: 0.5 }} />

      {/* 代码块设置 */}
      <CodeBlockSettings onSettingChange={handleSettingChange} />
      <Divider sx={{ my: 0.5 }} />

      {/* 数学公式设置 */}
      <MathSettings
        mathRenderer={getSetting('mathRenderer', 'KaTeX')}
        mathEnableSingleDollar={getSetting('mathEnableSingleDollar', true)}
        onMathRendererChange={(value) => updateSetting('mathRenderer', value)}
        onMathEnableSingleDollarChange={(value) => updateSetting('mathEnableSingleDollar', value)}
      />
      <Divider sx={{ my: 0.5 }} />

      {/* MCP 工具控制 */}
      <MCPSidebarControls
        mcpMode={mcpMode}
        toolsEnabled={toolsEnabled}
        onMCPModeChange={onMCPModeChange}
        onToolsToggle={onToolsToggle}
      />

      {/* 头像上传对话框 */}
      <AvatarUploader
        open={isAvatarDialogOpen}
        onClose={handleAvatarDialogClose}
        onSave={handleSaveAvatar}
      />
    </List>
  );
}