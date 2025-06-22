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
  Tooltip
} from '@mui/material';
import { User, Sliders, Cog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingGroups from './SettingGroups';
import AvatarUploader from '../../settings/AvatarUploader';
import MCPSidebarControls from './MCPSidebarControls';
import ThrottleLevelSelector from './ThrottleLevelSelector';
import ContextSettings from './ContextSettings';
import CodeBlockSettings from './CodeBlockSettings';
import InputSettings from './InputSettings';
import { useSettingsStorage, syncAssistantMaxTokens } from './hooks/useSettingsStorage';


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
    <List sx={{ p: 0 }}>
      <ListItemButton
        onClick={() => navigate('/settings')}
        sx={{
          px: 2,
          py: 0.75,
          '&:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.04)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: '40px' }}>
          <Cog size={20} color="#1976d2" />
        </ListItemIcon>
        <ListItemText
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
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="模型设置">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/settings/assistant-settings');
              }}
              sx={{
                bgcolor: 'rgba(255, 193, 7, 0.1)',
                border: '2px solid #ffc107',
                borderRadius: '50%',
                '&:hover': {
                  bgcolor: 'rgba(255, 193, 7, 0.2)',
                }
              }}
            >
              <Sliders size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </ListItemButton>

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

      {/* 输入设置 */}
      <InputSettings />
      <Divider sx={{ my: 0.5 }} />

      {/* 节流强度选择器 */}
      <ThrottleLevelSelector />
      <Divider sx={{ my: 0.5 }} />

      {/* 代码块设置 */}
      <CodeBlockSettings onSettingChange={handleSettingChange} />
      <Divider sx={{ my: 0.5 }} />

      {/* 可折叠的上下文设置 */}
      <ContextSettings
        contextLength={getSetting('contextLength', 16000)}
        contextCount={getSetting('contextCount', 5)}
        maxOutputTokens={getSetting('maxOutputTokens', 8192)}
        enableMaxOutputTokens={getSetting('enableMaxOutputTokens', true)}
        mathRenderer={getSetting('mathRenderer', 'KaTeX')}
        thinkingEffort={getSetting('defaultThinkingEffort', 'medium')}
        thinkingBudget={getSetting('thinkingBudget', 1024)}
        onContextLengthChange={(value) => updateSetting('contextLength', value)}
        onContextCountChange={(value) => updateSetting('contextCount', value)}
        onMaxOutputTokensChange={async (value) => {
          updateSetting('maxOutputTokens', value);
          // 同步更新所有助手的maxTokens
          await syncAssistantMaxTokens(value);
        }}
        onEnableMaxOutputTokensChange={(value) => updateSetting('enableMaxOutputTokens', value)}
        onMathRendererChange={(value) => updateSetting('mathRenderer', value)}
        onThinkingEffortChange={(value) => updateSetting('defaultThinkingEffort', value)}
        onThinkingBudgetChange={(value) => updateSetting('thinkingBudget', value)}
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