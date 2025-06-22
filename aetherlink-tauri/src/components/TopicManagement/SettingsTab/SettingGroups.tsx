import { useState } from 'react';
import {
  Box,

  IconButton,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SettingItem from './SettingItem';
import { createOptimizedClickHandler } from './scrollOptimization';
import OptimizedCollapse from './OptimizedCollapse';

interface Setting {
  id: string;
  name: string;
  description: string;
  defaultValue: boolean | string;
  type?: 'switch' | 'select';
  options?: Array<{ value: string; label: string }>;
}

interface SettingGroup {
  id: string;
  title: string;
  settings: Setting[];
}

interface SettingGroupsProps {
  groups: SettingGroup[];
  onSettingChange: (settingId: string, value: boolean | string) => void;
}

/**
 * 可折叠的设置分组组件
 */
export default function SettingGroups({ groups, onSettingChange }: SettingGroupsProps) {
  // 每个分组的展开状态
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    general: false,  // 常规设置默认收起
    context: false   // 上下文设置默认收起
  });

  // 切换分组展开状态
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // 获取分组图标

  // 获取分组描述
  const getGroupDescription = (group: SettingGroup) => {
    const enabledCount = group.settings.length;
    switch (group.id) {
      case 'general':
        return `${enabledCount} 个基础功能设置`;
      case 'context':
        return '上下文长度和消息数量';
      default:
        return `${enabledCount} 个设置项`;
    }
  };

  return (
    <Box>
      {groups.map((group, index) => (
        <Box key={group.id}>
          {/* 可折叠的分组标题栏 */}
          <ListItem
            component="div"
            onClick={createOptimizedClickHandler(() => toggleGroup(group.id))}
            sx={{
              px: 2,
              py: 0.5,
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
              // 优化触摸响应
              touchAction: 'manipulation',
              userSelect: 'none',
              // 移动端优化
              '@media (hover: none)': {
                '&:active': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  transform: 'scale(0.98)',
                  transition: 'all 0.1s ease-out'
                }
              },
              // 桌面端优化
              '@media (hover: hover)': {
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  transform: 'none !important',
                  boxShadow: 'none !important'
                },
                '&:focus': {
                  backgroundColor: 'transparent !important'
                },
                '&:active': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              },
              '& *': {
                pointerEvents: 'none', // 防止子元素干扰点击
                '&:hover': {
                  backgroundColor: 'transparent !important',
                  transform: 'none !important'
                }
              }
            }}
          >
            <ListItemText
              primary={group.title}
              secondary={getGroupDescription(group)}
              primaryTypographyProps={{ fontWeight: 'medium', fontSize: '0.95rem', lineHeight: 1.2 }}
              secondaryTypographyProps={{ fontSize: '0.75rem', lineHeight: 1.2 }}
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" size="small" sx={{ padding: '2px' }}>
                {expandedGroups[group.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>

          {/* 可折叠的设置项内容 */}
          <OptimizedCollapse
            in={expandedGroups[group.id]}
            timeout={150}
            unmountOnExit
          >
            <Box sx={{
              pb: 0.5,
              // 优化内容渲染
              contain: 'layout style paint',
            }}>
              {/* 分组内的设置项 */}
              {group.settings.map(setting => (
                <SettingItem
                  key={setting.id}
                  setting={setting}
                  onChange={onSettingChange}
                />
              ))}
            </Box>
          </OptimizedCollapse>

          {/* 最后一个分组不需要底部外边距 */}
          {index < groups.length - 1 && <Box sx={{ height: 4 }} />}
        </Box>
      ))}
    </Box>
  );
}