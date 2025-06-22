/**
 * 思考按钮组件
 * 用于控制思考过程的显示和配置
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import {
  Lightbulb,
  Sun,
  Zap,
  Sparkles
} from 'lucide-react';
import type { Model } from '../../shared/types';
import type { ThinkingOption } from '../../shared/config/reasoningConfig';
import {
  getSupportedOptions,
  OPTION_FALLBACK
} from '../../shared/config/reasoningConfig';

// 组件属性接口
interface ThinkingButtonProps {
  model: Model;
  currentEffort?: ThinkingOption;
  onChange: (option?: ThinkingOption) => void;
}

/**
 * 思考按钮组件
 */
const ThinkingButton: React.FC<ThinkingButtonProps> = ({
  model,
  currentEffort,
  onChange
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // 内存泄漏防护：组件卸载时清理DOM引用
  useEffect(() => {
    return () => {
      setAnchorEl(null);
    };
  }, []);

  // 获取支持的选项
  const supportedOptions = useMemo(() => {
    return getSupportedOptions(model);
  }, [model]);

  // 处理菜单打开
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // 处理菜单关闭
  const handleClose = () => {
    setAnchorEl(null);
  };

  // 处理选项选择
  const handleSelect = (option?: ThinkingOption) => {
    onChange(option);
    handleClose();
  };

  // 创建思考图标
  const createThinkingIcon = useCallback((option?: ThinkingOption) => {
    switch (option) {
      case 'low':
        return <Sun size={20} />;
      case 'medium':
        return <Lightbulb size={20} />;
      case 'high':
        return <Zap size={20} />;
      case 'auto':
        return <Sparkles size={20} />;
      case 'off':
      default:
        return <Lightbulb size={20} />;
    }
  }, []);

  // 获取当前显示的图标
  const currentIcon = useMemo(() => {
    // 如果当前选项不支持，显示回退选项的图标
    if (currentEffort && !supportedOptions.includes(currentEffort)) {
      const fallbackOption = OPTION_FALLBACK[currentEffort];
      return createThinkingIcon(fallbackOption);
    }
    return createThinkingIcon(currentEffort);
  }, [createThinkingIcon, currentEffort, supportedOptions]);

  // 获取选项标签
  const getOptionLabel = (option: ThinkingOption): string => {
    switch (option) {
      case 'low':
        return '低强度思考';
      case 'medium':
        return '中强度思考';
      case 'high':
        return '高强度思考';
      case 'auto':
        return '自动思考';
      case 'off':
        return '关闭思考';
      default:
        return '未知选项';
    }
  };

  return (
    <>
      <Tooltip title="思考过程设置">
        <span>
          <IconButton
            onClick={handleClick}
            color={currentEffort && currentEffort !== 'off' ? 'primary' : 'default'}
          >
            {currentIcon}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        disableAutoFocus={true}
        disableRestoreFocus={true}
      >
        {/* 关闭选项始终显示 */}
        <MenuItem
          onClick={() => handleSelect('off')}
          selected={currentEffort === 'off' || !currentEffort}
        >
          <ListItemIcon>
            <Lightbulb size={20} />
          </ListItemIcon>
          <ListItemText>关闭思考</ListItemText>
        </MenuItem>

        {/* 根据支持的选项显示菜单项 */}
        {supportedOptions.filter(option => option !== 'off').map((option) => (
          <MenuItem
            key={option}
            onClick={() => handleSelect(option)}
            selected={currentEffort === option}
          >
            <ListItemIcon>
              {createThinkingIcon(option)}
            </ListItemIcon>
            <ListItemText>{getOptionLabel(option)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ThinkingButton;
