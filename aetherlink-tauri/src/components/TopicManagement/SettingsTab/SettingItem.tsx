import React, { useState, useEffect } from 'react';
import {
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import CustomSwitch from '../../CustomSwitch'; // 导入 CustomSwitch 组件
import { getAppSettings } from '../../../shared/utils/settingsUtils';
import { useAppSelector } from '../../../shared/store';

interface Setting {
  id: string;
  name: string;
  description: string;
  defaultValue: boolean | string;
  type?: 'switch' | 'select';
  options?: Array<{ value: string; label: string }>;
}

interface SettingItemProps {
  setting: Setting;
  onChange: (settingId: string, value: boolean | string) => void;
}

/**
 * 单个设置项组件
 */
export default function SettingItem({ setting, onChange }: SettingItemProps) {
  // 获取Redux中的消息样式状态
  const messageStyle = useAppSelector(state => state.settings.messageStyle);
  //  新增：获取Redux中的自动滚动状态
  const autoScrollToBottom = useAppSelector(state => state.settings.autoScrollToBottom);

  // 初始化时就从localStorage读取值，避免undefined到boolean的变化
  const getInitialValue = React.useCallback(() => {
    try {
      // 特殊处理消息样式
      if (setting.id === 'messageStyle') {
        return messageStyle || 'bubble';
      }

      //  新增：特殊处理自动滚动设置
      if (setting.id === 'autoScrollToBottom') {
        return autoScrollToBottom !== undefined ? autoScrollToBottom : true;
      }

      const appSettings = getAppSettings();
      const currentValue = appSettings[setting.id];
      return currentValue !== undefined ? currentValue : setting.defaultValue;
    } catch (error) {
      console.error('加载设置失败:', error);
      return setting.defaultValue;
    }
  }, [setting.id, setting.defaultValue, messageStyle, autoScrollToBottom]);

  // 使用受控状态，初始值从localStorage读取
  const [value, setValue] = useState<boolean | string>(() => getInitialValue());

  // 监听设置变化时重新加载
  useEffect(() => {
    const newValue = getInitialValue();
    setValue(newValue);
  }, [getInitialValue]);

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setValue(newValue);
    onChange(setting.id, newValue);
  };

  const handleSelectChange = (event: any) => {
    const newValue = event.target.value;
    setValue(newValue);
    onChange(setting.id, newValue);
  };

  // 根据设置类型渲染不同的控件
  const renderControl = () => {
    if (setting.type === 'select' && setting.options) {
      return (
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={value as string}
            onChange={handleSelectChange}
            variant="outlined"
            MenuProps={{
              disableAutoFocus: true,
              disableRestoreFocus: true
            }}
            sx={{
              fontSize: '0.875rem',
              '& .MuiSelect-select': {
                py: 0.5,
                px: 1
              }
            }}
          >
            {setting.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    // 使用自定义开关
    return (
      <CustomSwitch
        checked={value as boolean}
        onChange={handleSwitchChange}
      />
    );
  };

  return (
    <>
      <ListItem 
        sx={{ 
          px: 2, 
          py: 0.5,
          // 确保列表项能够正确处理右侧控件
          alignItems: 'flex-start'
        }}
      >
        <ListItemText
          primary={setting.name}
          secondary={setting.description}
          primaryTypographyProps={{ 
            fontSize: '0.9rem', 
            lineHeight: 1.2 
          }}
          secondaryTypographyProps={{
            fontSize: '0.75rem',
            lineHeight: 1.2,
            mt: 0.2,
            // 重要：确保长文本能够正确换行且不与右侧按钮重叠
            whiteSpace: 'normal',
            sx: {
              wordBreak: 'break-word'
            }
          }}
          sx={{
            // 关键修复：为右侧控件预留足够空间
            pr: setting.type === 'select' ? 12 : 8, // 为选择框预留更多空间，为开关预留适中空间
            // 确保文本区域不会延伸到右侧控件
            overflow: 'hidden'
          }}
        />
        <ListItemSecondaryAction
          sx={{
            // 确保右侧控件有足够的空间
            right: 16,
            // 垂直居中对齐
            top: '50%',
            transform: 'translateY(-50%)',
            // 确保控件不会被文本覆盖
            zIndex: 1
          }}
        >
          {renderControl()}
        </ListItemSecondaryAction>
      </ListItem>
      <Divider sx={{ opacity: 0.4 }} />
    </>
  );
}