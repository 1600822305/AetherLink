import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Box,
  useTheme,
  IconButton,
  Tooltip
} from '@mui/material';
import { Wrench } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../shared/store';
import { getGlassmorphismToolbarStyles, getTransparentToolbarStyles } from '../../../shared/styles/toolbarStyles';
import MCPServerQuickPanel from './MCPServerQuickPanel';
import { getStorageItem } from '../../../shared/utils/storage';

// 稳定的选择器函数，避免每次渲染创建新引用
const selectToolbarDisplayStyle = (state: RootState) => 
  state.settings?.toolbarDisplayStyle || 'both';
const selectToolbarStyle = (state: RootState) => 
  state.settings?.toolbarStyle || 'glassmorphism';

interface MCPToolsButtonProps {
  toolsEnabled?: boolean;
  onToolsEnabledChange?: (enabled: boolean) => void;
  variant?: 'toolbar' | 'icon-button-compact' | 'icon-button-integrated';
}

const MCPToolsButtonInner: React.FC<MCPToolsButtonProps> = ({
  toolsEnabled = false,
  onToolsEnabledChange,
  variant = 'toolbar'
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [open, setOpen] = useState(false);

  // 使用稳定的选择器
  const toolbarDisplayStyle = useSelector(selectToolbarDisplayStyle) as 'icon' | 'text' | 'both';
  const toolbarStyle = useSelector(selectToolbarStyle) as 'glassmorphism' | 'transparent';


  // 根据设置选择样式
  const currentStyles = useMemo(() =>
    toolbarStyle === 'glassmorphism'
      ? getGlassmorphismToolbarStyles(isDarkMode)
      : getTransparentToolbarStyles(isDarkMode),
    [toolbarStyle, isDarkMode]
  );


  const handleOpen = useCallback(() => {
    setOpen(true);
    // 移除这里的 loadServers() 调用
    // MCPToolsDialog 在 open 变为 true 时会自动加载
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // 键盘导航处理
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  }, [handleOpen]);



  // 技能状态（独立开关 + 有绑定技能，统一使用 Dexie 存储）
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);
  const [skillsEnabled, setSkillsEnabled] = useState(false);
  const loadSkillsEnabled = useCallback(() => {
    getStorageItem<boolean>('skills-enabled').then(val => setSkillsEnabled(val ?? false));
  }, []);
  useEffect(() => {
    loadSkillsEnabled();
    const handler = () => loadSkillsEnabled();
    window.addEventListener('skills-enabled-changed', handler);
    return () => window.removeEventListener('skills-enabled-changed', handler);
  }, [loadSkillsEnabled]);
  // 刷新：面板关闭时同步
  useEffect(() => {
    if (!open) loadSkillsEnabled();
  }, [open, loadSkillsEnabled]);
  const hasSkills = skillsEnabled && !!(currentAssistant?.skillIds?.length);

  // MCP 激活状态：总开关开启即为激活
  const hasMcp = !!toolsEnabled;
  // 任一激活
  const isActive = hasMcp || hasSkills;

  // 颜色常量
  const mcpColor = 'rgba(16, 185, 129'; // 绿色
  const skillColor = 'rgba(245, 158, 11'; // 琥珀色
  const mcpHex = '#10b981';
  const skillHex = '#f59e0b';

  // 变色图标：纯绿(MCP) / 纯琥珀(技能) / 拼色(都开)
  const renderSplitIcon = (size: number, defaultColor: string) => {
    if (hasMcp && hasSkills) {
      // 都开 → 拼色
      return (
        <Box sx={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
          <Wrench size={size} color={mcpHex} style={{ position: 'absolute', top: 0, left: 0, clipPath: 'inset(0 50% 0 0)' }} />
          <Wrench size={size} color={skillHex} style={{ position: 'absolute', top: 0, left: 0, clipPath: 'inset(0 0 0 50%)' }} />
        </Box>
      );
    }
    if (hasMcp) return <Wrench size={size} color={mcpHex} />;
    if (hasSkills) return <Wrench size={size} color={skillHex} />;
    return <Wrench size={size} color={defaultColor} />;
  };

  // 根据 variant 渲染不同的按钮样式
  const renderButton = () => {
    if (variant === 'icon-button-compact') {
      const baseColor = isDarkMode ? '#B0B0B0' : '#555';
      
      return (
        <Tooltip title="MCP工具">
          <IconButton
            size="small"
            onClick={handleOpen}
            sx={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              backgroundColor: isActive ? `${hasMcp ? mcpHex : skillHex}15` : 'transparent',
              border: isActive ? `1px solid ${hasMcp ? mcpHex : skillHex}30` : '1px solid transparent',
              '&:hover': {
                transform: 'translateY(-1px)',
                backgroundColor: isActive ? `${hasMcp ? mcpHex : skillHex}20` : undefined,
              }
            }}
          >
            {renderSplitIcon(20, baseColor)}
          </IconButton>
        </Tooltip>
      );
    }

    if (variant === 'icon-button-integrated') {
      const baseColor = isDarkMode ? '#ffffff' : '#000000';
      
      return (
        <Tooltip title="MCP工具">
          <span>
            <IconButton
              size="medium"
              onClick={handleOpen}
              disabled={false}
              sx={{
                padding: '6px',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {renderSplitIcon(20, baseColor)}
            </IconButton>
          </span>
        </Tooltip>
      );
    }

    // toolbar 样式 — 主色取决于激活状态
    const activeColor = hasMcp && hasSkills
      ? mcpColor  // 两者都有时用绿色为主
      : hasMcp ? mcpColor : skillColor;

    return (
      <Box
        role="button"
        tabIndex={0}
        aria-label="打开 MCP 工具管理"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        sx={{
          ...currentStyles.button,
          position: 'relative',
          overflow: 'visible',
          ...(isActive && toolbarStyle === 'glassmorphism' && {
            background: isDarkMode
              ? `${activeColor}, 0.15)`
              : `${activeColor}, 0.2)`,
            border: isDarkMode
              ? `1px solid ${activeColor}, 0.25)`
              : `1px solid ${activeColor}, 0.35)`,
            boxShadow: isDarkMode
              ? `0 4px 16px ${activeColor}, 0.1), 0 1px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 ${activeColor}, 0.2)`
              : `0 4px 16px ${activeColor}, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04), inset 0 1px 0 ${activeColor}, 0.3)`
          }),
          ...(isActive && toolbarStyle === 'transparent' && {
            background: isDarkMode ? `${activeColor}, 0.08)` : `${activeColor}, 0.05)`
          }),
          margin: toolbarStyle === 'glassmorphism' ? '0 4px' : '0 2px',
          '&:hover': {
            ...currentStyles.buttonHover,
            ...(isActive && toolbarStyle === 'glassmorphism' && {
              background: isDarkMode
                ? `${activeColor}, 0.2)`
                : `${activeColor}, 0.25)`,
              border: isDarkMode
                ? `1px solid ${activeColor}, 0.3)`
                : `1px solid ${activeColor}, 0.4)`,
              boxShadow: isDarkMode
                ? `0 6px 24px ${activeColor}, 0.15), 0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 ${activeColor}, 0.25)`
                : `0 6px 24px ${activeColor}, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 ${activeColor}, 0.4)`
            }),
            ...(isActive && toolbarStyle === 'transparent' && {
              background: isDarkMode ? `${activeColor}, 0.12)` : `${activeColor}, 0.08)`
            })
          },
          '&:active': {
            ...currentStyles.buttonActive
          },
          '&:focus': {
            outline: `2px solid ${isDarkMode ? `${activeColor}, 0.8)` : `${activeColor}, 0.6)`}`,
            outlineOffset: '2px',
          }
        }}
        title="MCP 工具"
      >
        {toolbarDisplayStyle !== 'text' && (
          renderSplitIcon(16, isDarkMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)')
        )}
        {toolbarDisplayStyle !== 'icon' && (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: isActive
                ? (isDarkMode ? `${activeColor}, 0.95)` : `${activeColor}, 0.9)`)
                : (isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'),
              textShadow: isDarkMode
                ? '0 1px 2px rgba(0, 0, 0, 0.3)'
                : '0 1px 2px rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.01em',
              ml: toolbarDisplayStyle === 'both' ? 0.5 : 0
            }}
          >
            工具
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <>
      {renderButton()}

      <MCPServerQuickPanel
        open={open}
        onClose={handleClose}
        toolsEnabled={toolsEnabled}
        onToolsEnabledChange={onToolsEnabledChange}
      />
    </>
  );
};

// 使用 React.memo 避免父组件重渲染时的不必要更新
const MCPToolsButton = React.memo(MCPToolsButtonInner);

export default MCPToolsButton;
