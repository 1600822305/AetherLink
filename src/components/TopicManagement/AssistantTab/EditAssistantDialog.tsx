import React, { useState } from 'react';
import {
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  type Theme
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { ChevronLeft, Settings, FileText, Settings2, Wand2, Brain, Zap } from 'lucide-react';
import { useKeyboard } from '../../../shared/hooks/useKeyboard';
import { ParameterEditor } from '../../ParameterEditor';
import { detectProviderFromModel } from '../../../shared/config/parameterMetadata';
import { RegexTab } from './RegexTab';
import { BasicSettingsTab } from './BasicSettingsTab';
import type { AssistantChatBackground } from './BasicSettingsTab';
import { PromptTab } from './PromptTab';
import { MemoryTab } from './MemoryTab';
import { SkillsTab } from './SkillsTab';
import type { AssistantRegex } from '../../../shared/types/Assistant';

// 样式常量
const styles = {
  glassomorphism: (theme: Theme) => ({
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(0, 0, 0, 0.2)'}`
  }),

  dialogPaper: (theme: Theme) => ({
    height: '80vh',
    borderRadius: '16px',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(18, 18, 18, 0.85)'
      : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    border: theme.palette.mode === 'dark'
      ? '1px solid rgba(255, 255, 255, 0.1)'
      : '1px solid rgba(0, 0, 0, 0.1)',
    color: theme.palette.text.primary,
    boxShadow: theme.palette.mode === 'dark'
      ? '0 8px 32px rgba(0, 0, 0, 0.4)'
      : '0 8px 32px rgba(0, 0, 0, 0.15)'
  }),

  dialogBackdrop: {
    backdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)'
  },

  inputField: (theme: Theme) => ({
    '& .MuiOutlinedInput-root': {
      ...styles.glassomorphism(theme),
      borderRadius: '8px',
      color: theme.palette.text.primary,
      '& fieldset': {
        borderColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.2)'
          : 'rgba(0, 0, 0, 0.2)',
      },
      '&:hover fieldset': {
        borderColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.3)'
          : 'rgba(0, 0, 0, 0.3)',
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
      }
    },
    '& .MuiInputBase-input': {
      color: theme.palette.text.primary,
      fontSize: '0.875rem'
    }
  }),

  avatarContainer: (theme: Theme) => ({
    position: 'relative' as const,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
      : 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 100%)',
    boxShadow: theme.palette.mode === 'dark'
      ? `0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.2)`
      : `0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`,
  }),

  primaryButton: (theme: Theme) => ({
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    fontSize: '0.75rem',
    textTransform: 'none' as const,
    backdropFilter: 'blur(10px)',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(0, 0, 0, 0.02)',
    '&:hover': {
      borderColor: theme.palette.primary.light,
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.05)'
    }
  })
};

// 组件属性接口
export interface EditAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  assistantName: string;
  assistantPrompt: string;
  assistantAvatar: string;
  /** 当前使用的模型 ID */
  modelId?: string;
  /** 参数值 */
  parameterValues?: Record<string, any>;
  /** 已启用的参数 */
  enabledParams?: Record<string, boolean>;
  onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPromptChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarClick: () => void;
  onPromptSelectorClick: () => void;
  /** 参数变化回调 */
  onParameterChange?: (key: string, value: any) => void;
  /** 参数启用状态变化 */
  onParameterToggle?: (key: string, enabled: boolean) => void;
  /** 正则替换规则 */
  regexRules?: AssistantRegex[];
  /** 正则替换规则变化回调 */
  onRegexRulesChange?: (rules: AssistantRegex[]) => void;
  /** 聊天壁纸 */
  chatBackground?: AssistantChatBackground;
  /** 聊天壁纸变化回调 */
  onChatBackgroundChange?: (background: AssistantChatBackground) => void;
  /** 助手 ID */
  assistantId?: string;
  /** 助手是否启用记忆 */
  memoryEnabled?: boolean;
  /** 记忆开关变化回调 */
  onMemoryEnabledChange?: (enabled: boolean) => void;
  /** 绑定的技能 ID 列表 */
  skillIds?: string[];
  /** 技能绑定变化回调 */
  onSkillIdsChange?: (skillIds: string[]) => void;
}

/**
 * 编辑助手对话框组件 - 纯UI组件
 */
const EditAssistantDialog: React.FC<EditAssistantDialogProps> = ({
  open,
  onClose,
  onSave,
  assistantName,
  assistantPrompt,
  assistantAvatar,
  modelId,
  parameterValues: externalParamValues = {},
  enabledParams: externalEnabledParams = {},
  onNameChange,
  onPromptChange,
  onAvatarClick,
  onPromptSelectorClick,
  onParameterChange,
  onParameterToggle,
  regexRules = [],
  onRegexRulesChange,
  chatBackground,
  onChatBackgroundChange,
  assistantId = '',
  memoryEnabled = false,
  onMemoryEnabledChange,
  skillIds = [],
  onSkillIdsChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 键盘适配 - 在移动端锁定键盘，避免其他组件响应
  useKeyboard({ lock: isMobile && open });
  
  const [tabValue, setTabValue] = useState(0);
  
  // 内部状态管理参数（当外部没有提供时使用）
  const [localParamValues, setLocalParamValues] = useState<Record<string, any>>(externalParamValues);
  const [localEnabledParams, setLocalEnabledParams] = useState<Record<string, boolean>>(externalEnabledParams);
  
  // 参数变化处理
  const handleParamChange = (key: string, value: any) => {
    setLocalParamValues(prev => ({ ...prev, [key]: value }));
    onParameterChange?.(key, value);
  };
  
  const handleParamToggle = (key: string, enabled: boolean) => {
    setLocalEnabledParams(prev => ({ ...prev, [key]: enabled }));
    onParameterToggle?.(key, enabled);
  };
  
  // 检测供应商类型
  const providerType = detectProviderFromModel(modelId);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <BackButtonDialog 
      open={open} 
      onClose={onClose} 
      maxWidth={isMobile ? false : "md"}
      fullWidth
      fullScreen={isMobile}
      slotProps={{
        paper: {
          sx: {
            ...styles.dialogPaper(theme),
            // 移动端全屏适配
            ...(isMobile && {
              margin: 0,
              maxHeight: '100vh',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column'
            })
          }
        },
        backdrop: {
          sx: styles.dialogBackdrop
        }
      }}
    >
      {/* 自定义标题栏 */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        p: 2, 
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'transparent',
        ...(isMobile && {
          paddingTop: 'calc(16px + var(--safe-area-top, 0px))',
          minHeight: '64px'
        })
      }}>
        <IconButton 
          onClick={onClose}
          sx={{ 
            color: (theme) => theme.palette.text.primary, 
            mr: 2,
            '&:hover': { 
              backgroundColor: (theme) => 
                theme.palette.mode === 'dark' 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'rgba(0,0,0,0.1)' 
            }
          }}
        >
          <ChevronLeft size={isMobile ? 28 : 24} />
        </IconButton>
        <Typography variant={isMobile ? "h6" : "subtitle1"} sx={{ 
          color: (theme) => theme.palette.text.primary, 
          fontWeight: 600,
          fontSize: isMobile ? '1.25rem' : '1.125rem'
        }}>
          编辑助手
        </Typography>
      </Box>

      {/* 标签页导航 */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        px: isMobile ? 2 : 2,
        pb: 1
      }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            width: '100%',
            minHeight: isMobile ? 40 : 36,
            '& .MuiTabs-flexContainer': {
              gap: isMobile ? 0.5 : 1,
            },
            '& .MuiTab-root': {
              color: (theme) => theme.palette.text.secondary,
              fontSize: isMobile ? '0.8rem' : '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              minWidth: isMobile ? 64 : 80,
              minHeight: isMobile ? 40 : 36,
              py: 1,
              px: isMobile ? 1.5 : 2,
              whiteSpace: 'nowrap',
              '&.Mui-selected': {
                color: (theme) => theme.palette.primary.main
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: (theme) => theme.palette.primary.main,
              height: 2,
              borderRadius: '1px'
            }
          }}
        >
          <Tab 
            label="基础" 
            icon={<Settings size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
          <Tab 
            label="提示词" 
            icon={<FileText size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
          <Tab 
            label="参数" 
            icon={<Settings2 size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
          <Tab 
            label="正则" 
            icon={<Wand2 size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
          <Tab 
            label="记忆" 
            icon={<Brain size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
          <Tab 
            label="技能" 
            icon={<Zap size={16} />} 
            iconPosition="start"
            sx={{ minHeight: isMobile ? 40 : 36 }}
          />
        </Tabs>
      </Box>

      {/* 内容区域 - 优化空间利用 */}
      <DialogContent sx={{
        flex: 1,
        backgroundColor: 'transparent',
        p: 2,
        pt: 1,
        color: (theme) => theme.palette.text.primary,
        overflow: 'auto',
        // 移动端内容区域适配 - 使用 flex: 1 自动填充剩余空间
        ...(isMobile && {
          px: 2,
          flex: 1, // 自动填充可用空间，避免硬编码高度
          overflow: 'auto'
        })
      }}>
        {/* 基础设置 Tab */}
        {tabValue === 0 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <BasicSettingsTab
              assistantName={assistantName}
              assistantAvatar={assistantAvatar}
              onNameChange={onNameChange}
              onAvatarClick={onAvatarClick}
              chatBackground={chatBackground}
              onChatBackgroundChange={onChatBackgroundChange}
            />
          </Box>
        )}

        {/* 提示词 Tab */}
        {tabValue === 1 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <PromptTab
              assistantPrompt={assistantPrompt}
              onPromptChange={onPromptChange}
              onPromptSelectorClick={onPromptSelectorClick}
            />
          </Box>
        )}

        {/* 参数 Tab 内容 */}
        {tabValue === 2 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <ParameterEditor
              providerType={providerType}
              modelId={modelId}
              values={localParamValues}
              enabledParams={localEnabledParams}
              onChange={handleParamChange}
              onToggle={handleParamToggle}
            />
          </Box>
        )}

        {/* 正则替换 Tab 内容 */}
        {tabValue === 3 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <RegexTab
              rules={regexRules}
              onChange={(rules) => onRegexRulesChange?.(rules)}
            />
          </Box>
        )}

        {/* 记忆 Tab 内容 */}
        {tabValue === 4 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <MemoryTab
              assistantId={assistantId}
              memoryEnabled={memoryEnabled}
              onMemoryEnabledChange={onMemoryEnabledChange}
            />
          </Box>
        )}

        {/* 技能 Tab 内容 */}
        {tabValue === 5 && (
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <SkillsTab
              assistantId={assistantId}
              skillIds={skillIds}
              onSkillIdsChange={onSkillIdsChange}
            />
          </Box>
        )}
      </DialogContent>

      {/* 底部操作按钮 - 优化空间占用 */}
      <DialogActions sx={{
        p: isMobile ? 3 : 2,
        backgroundColor: 'transparent',
        borderTop: (theme) =>
          `1px solid ${theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.1)'}`,
        ...(isMobile && {
          minHeight: '60px'
        })
      }}>
        <Button
          onClick={onClose}
          size={isMobile ? "large" : "medium"}
          sx={{
            color: (theme) => theme.palette.text.secondary,
            backdropFilter: 'blur(10px)',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.02)',
            fontSize: isMobile ? '16px' : '14px',
            px: isMobile ? 3 : 2,
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(0, 0, 0, 0.05)'
            }
          }}
        >
          取消
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          size={isMobile ? "large" : "medium"}
          sx={{
            backgroundColor: (theme) => theme.palette.primary.main,
            color: (theme) => theme.palette.primary.contrastText,
            backdropFilter: 'blur(10px)',
            fontSize: isMobile ? '16px' : '14px',
            px: isMobile ? 3 : 2,
            '&:hover': {
              backgroundColor: (theme) => theme.palette.primary.dark
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

export default EditAssistantDialog;
