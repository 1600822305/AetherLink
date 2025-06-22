import React, { memo, useMemo, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import { ChevronDown, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { updateGroup, deleteGroup } from '../../../shared/store/slices/groupsSlice';
import VirtualScroller from '../../common/VirtualScroller';
import AssistantItem from './AssistantItem';
import type { Assistant } from '../../../shared/types/Assistant';
import type { Group } from '../../../shared/types';

interface VirtualizedAssistantGroupsProps {
  assistantGroups: Group[];
  userAssistants: Assistant[];
  assistantGroupMap: Record<string, string>;
  currentAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
  onOpenMenu: (event: React.MouseEvent, assistant: Assistant) => void;
  onDeleteAssistant: (assistantId: string, event: React.MouseEvent) => void;
  isGroupEditMode: boolean;
  onAddItem?: () => void;
}

/**
 * 虚拟化助手分组组件
 * 对于大量助手的分组使用虚拟化渲染
 */
const VirtualizedAssistantGroups = memo(function VirtualizedAssistantGroups({
  assistantGroups,
  userAssistants,
  assistantGroupMap,
  currentAssistant,
  onSelectAssistant,
  onOpenMenu,
  onDeleteAssistant
}: VirtualizedAssistantGroupsProps) {
  
  // 使用 useMemo 缓存分组助手的计算结果
  const groupedAssistants = useMemo(() => {
    return assistantGroups.map((group) => {
      const groupAssistants = userAssistants.filter(
        assistant => assistant && assistant.id && assistantGroupMap[assistant.id] === group.id
      );
      return {
        group,
        assistants: groupAssistants,
        shouldVirtualize: groupAssistants.length > 15 // 超过15个助手时启用虚拟化
      };
    });
  }, [assistantGroups, userAssistants, assistantGroupMap]);

  // 缓存助手项渲染函数
  const renderAssistantItem = useCallback((assistant: Assistant, _index: number) => {
    return (
      <AssistantItem
        assistant={assistant}
        isSelected={currentAssistant?.id === assistant.id}
        onSelectAssistant={onSelectAssistant}
        onOpenMenu={onOpenMenu}
        onDeleteAssistant={onDeleteAssistant}
      />
    );
  }, [currentAssistant?.id, onSelectAssistant, onOpenMenu, onDeleteAssistant]);

  // 缓存助手键值函数
  const getAssistantKey = useCallback((assistant: Assistant, _index: number) => {
    return assistant.id;
  }, []);

  // 渲染单个分组
  const renderGroup = useCallback(({ group, assistants: groupAssistants, shouldVirtualize }: {
    group: Group;
    assistants: Assistant[];
    shouldVirtualize: boolean;
  }) => {
    return (
      <AssistantGroupAccordion
        key={group.id}
        group={group}
        assistantCount={groupAssistants.length}
        shouldVirtualize={shouldVirtualize}
      >
        {groupAssistants.length > 0 ? (
          shouldVirtualize ? (
            // 使用虚拟化渲染大量助手
            <VirtualScroller
              items={groupAssistants}
              itemHeight={72}
              renderItem={renderAssistantItem}
              itemKey={getAssistantKey}
              height={300} // 限制分组内容的最大高度
              overscanCount={3}
              style={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '4px',
                backgroundColor: 'background.default',
              }}
            />
          ) : (
            // 助手数量较少时直接渲染
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {groupAssistants.map((assistant) => (
                <Box key={assistant.id} sx={{ mb: 1 }}>
                  {renderAssistantItem(assistant, 0)}
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
            此分组暂无助手，请从未分组助手中添加
          </Typography>
        )}
      </AssistantGroupAccordion>
    );
  }, [renderAssistantItem, getAssistantKey]);


  if (groupedAssistants.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary" sx={{ py: 2, textAlign: 'center' }}>
        没有助手分组
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      {groupedAssistants.map(renderGroup)}
    </Box>
  );
});

// 助手分组手风琴组件，包含三点菜单功能
interface AssistantGroupAccordionProps {
  group: Group;
  assistantCount: number;
  shouldVirtualize: boolean;
  children: React.ReactNode;
}

const AssistantGroupAccordion = memo(function AssistantGroupAccordion({
  group,
  assistantCount,
  shouldVirtualize,
  children
}: AssistantGroupAccordionProps) {
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
            {group.name} ({assistantCount})
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
      <Dialog open={editDialogOpen} onClose={handleEditCancel} maxWidth="xs" fullWidth>
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
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除分组 "{group.name}" 吗？分组内的助手将移至未分组。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">删除</Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default VirtualizedAssistantGroups;
