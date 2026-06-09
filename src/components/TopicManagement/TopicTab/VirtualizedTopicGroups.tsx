import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
  MenuItem,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { ChevronDown, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { updateGroup, deleteGroup } from '../../../shared/store/slices/groupsSlice';
import VirtualList from '../../common/VirtualList';
import TopicItem from './TopicItem';
import type { ChatTopic } from '../../../shared/types';
import type { Group } from '../../../shared/types';

interface VirtualizedTopicGroupsProps {
  topicGroups: Group[];
  topics: ChatTopic[];
  topicGroupMap: Record<string, string>;
  // 🚀 优化：移除 currentTopic prop，TopicItem 已经内部订阅 Redux 状态
  currentTopic?: ChatTopic | null; // 保留兼容性，但不再使用
  onSelectTopic: (topic: ChatTopic) => void;
  onOpenMenu: (event: React.MouseEvent, topic: ChatTopic) => void;
  onDeleteTopic: (topicId: string, event: React.MouseEvent) => void;
  onAddItem?: () => void;
}

/**
 * 虚拟化话题分组组件
 * 对于大量话题的分组使用虚拟化渲染
 */
const VirtualizedTopicGroups = memo(function VirtualizedTopicGroups({
  topicGroups,
  topics,
  topicGroupMap,
  currentTopic: _currentTopic, // 保留兼容性，但不再使用 (TopicItem 内部订阅 Redux)
  onSelectTopic,
  onOpenMenu,
  onDeleteTopic
}: VirtualizedTopicGroupsProps) {

  // 使用 useMemo 缓存分组话题的计算结果
  const groupedTopics = useMemo(() => {
    return topicGroups.map((group) => {
      const groupTopics = topics.filter(
        topic => topic && topic.id && topicGroupMap[topic.id] === group.id
      );
      return {
        group,
        topics: groupTopics,
        shouldVirtualize: groupTopics.length > 15 // 超过15个话题时启用虚拟化
      };
    });
  }, [topicGroups, topics, topicGroupMap]);

  // 🚀 优化：移除 currentTopicId 依赖，TopicItem 内部订阅 Redux 状态
  // 这样切换话题时 renderTopicItem 不会重建，只有选中/取消选中的两个 TopicItem 会重渲染
  const renderTopicItem = useCallback((topic: ChatTopic, _index: number) => {
    return (
      <TopicItem
        topic={topic}
        onSelectTopic={onSelectTopic}
        onOpenMenu={onOpenMenu}
        onDeleteTopic={onDeleteTopic}
      />
    );
  }, [onSelectTopic, onOpenMenu, onDeleteTopic]); // 不再依赖 currentTopicId

  // 缓存话题键值函数
  const getTopicKey = useCallback((topic: ChatTopic, _index: number) => {
    return topic.id;
  }, []);

  // 渲染单个分组
  const renderGroup = useCallback(({ group, topics: groupTopics, shouldVirtualize }: {
    group: Group;
    topics: ChatTopic[];
    shouldVirtualize: boolean;
  }) => {
    return (
      <TopicGroupAccordion
        key={group.id}
        group={group}
        topicCount={groupTopics.length}
        shouldVirtualize={shouldVirtualize}
      >
        {groupTopics.length > 0 ? (
          shouldVirtualize ? (
            // 使用虚拟化渲染大量话题（TanStack 动态测高）
            <VirtualList<ChatTopic>
              items={groupTopics}
              estimateItemHeight={64}
              renderItem={renderTopicItem}
              itemKey={getTopicKey}
              height={300} // 限制分组内容的最大高度
              overscan={3}
              style={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '4px',
                backgroundColor: 'background.default',
              }}
            />
          ) : (
            // 话题数量较少时直接渲染
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {groupTopics.map((topic) => (
                <Box key={topic.id} sx={{ mb: 1 }}>
                  {renderTopicItem(topic, 0)}
                </Box>
              ))}
            </Box>
          )
        ) : (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{
              py: 1,
              px: 1,
              textAlign: 'center',
              fontStyle: 'italic',
              fontSize: '0.85rem'
            }}
          >
            此分组暂无话题，请从未分组话题中添加
          </Typography>
        )}
      </TopicGroupAccordion>
    );
  }, [renderTopicItem, getTopicKey]);

  if (groupedTopics.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: 'center' }}>
        没有话题分组
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {groupedTopics.map(renderGroup)}
    </Box>
  );
});

// 话题分组手风琴组件，包含三点菜单功能
interface TopicGroupAccordionProps {
  group: Group;
  topicCount: number;
  shouldVirtualize: boolean;
  children: React.ReactNode;
}

const TopicGroupAccordion = memo(function TopicGroupAccordion({
  group,
  topicCount,
  shouldVirtualize,
  children
}: TopicGroupAccordionProps) {
  const dispatch = useDispatch();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleEditClick = () => {
    setEditName(group.name);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleEditSave = () => {
    if (editName.trim() && editName.trim() !== group.name) {
      dispatch(updateGroup({ 
        id: group.id, 
        changes: { name: editName.trim() } 
      }));
    }
    setEditDialogOpen(false);
  };

  const handleEditCancel = () => {
    setEditName(group.name);
    setEditDialogOpen(false);
  };

  const handleDeleteConfirm = () => {
    dispatch(deleteGroup(group.id));
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Accordion
        defaultExpanded={Boolean(group.expanded)}
        disableGutters
        sx={{
          mb: 1,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          '&:before': {
            display: 'none',
          },
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={20} />}
          sx={{
            minHeight: '48px',
            '& .MuiAccordionSummary-content': {
              margin: '8px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }
          }}
        >
          <Typography variant="body2">
            {group.name} ({topicCount})
            {shouldVirtualize && ' 🚀'}
          </Typography>
          
          {/* 修复：使用div包装图标，避免button嵌套button的HTML错误 */}
          <Box
            component="div"
            onClick={(e) => {
              e.stopPropagation(); // 阻止事件冒泡到AccordionSummary
              handleMenuOpen(e);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              padding: '4px',
              ml: 1,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }
            }}
          >
            <MoreVertical size={16} />
          </Box>
        </AccordionSummary>
        
        <AccordionDetails sx={{ p: 1 }}>
          {children}
        </AccordionDetails>
      </Accordion>

      {/* 三点菜单 */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditClick}>
          <Edit size={16} style={{ marginRight: 8 }} />
          编辑分组名称
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <Trash2 size={16} style={{ marginRight: 8 }} />
          删除分组
        </MenuItem>
      </Menu>

      {/* 编辑分组名称对话框 */}
      <BackButtonDialog open={editDialogOpen} onClose={handleEditCancel} maxWidth="xs" fullWidth>
        <DialogTitle>编辑分组名称</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="分组名称"
            type="text"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleEditSave();
              } else if (e.key === 'Escape') {
                handleEditCancel();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCancel}>取消</Button>
          <Button onClick={handleEditSave} variant="contained">保存</Button>
        </DialogActions>
      </BackButtonDialog>

      {/* 删除确认对话框 */}
      <BackButtonDialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除分组 "{group.name}" 吗？分组内的话题将移至未分组。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">删除</Button>
        </DialogActions>
      </BackButtonDialog>
    </>
  );
});

export default VirtualizedTopicGroups;
