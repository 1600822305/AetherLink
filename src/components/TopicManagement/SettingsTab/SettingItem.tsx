import React, { useState, useEffect } from 'react';
import {
  ListItem,
  ListItemText,
  FormControl,
  Select,
  MenuItem,
  Divider,
  Box
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
          py: 1, // 增加垂直内边距以改善观感
          display: 'flex', // *** 核心修复：使用Flexbox ***
          alignItems: 'center', // 垂直居中对齐
          gap: 2, // 在文本和控件之间增加间距
        }}
      >
        <ListItemText
          primary={setting.name}
          secondary={setting.description}
          primaryTypographyProps={{ fontSize: '0.9rem', lineHeight: 1.4, fontWeight: 'medium' }}
          secondaryTypographyProps={{
            fontSize: '0.75rem',
            lineHeight: 1.4,
            mt: 0.2,
            sx: { whiteSpace: 'normal', wordBreak: 'break-word' } 
          }}
          sx={{ flex: 1, minWidth: 0 }} // *** 核心修复：让文本区域可伸缩 ***
        />
        <Box>
          {renderControl()}
        </Box>
      </ListItem>
      <Divider sx={{ opacity: 0.4 }} />
    </>
  );
}