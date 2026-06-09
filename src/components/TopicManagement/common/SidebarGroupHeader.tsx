import React, { memo, useState } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import { ChevronDown, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import BackButtonDialog from '../../common/BackButtonDialog';
import { updateGroup, deleteGroup } from '../../../shared/store/slices/groupsSlice';
import type { Group } from '../../../shared/types';

interface SidebarGroupHeaderProps {
  group: Group;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** 删除确认文案中的名词："话题" / "助手" */
  itemNoun: string;
}

/**
 * 侧边栏分组头（扁平化单容器列表中的吸顶行）。
 *
 * 取代过去基于 MUI Accordion 的分组头：自行管理折叠态(由父组件传入 collapsed +
 * onToggle，便于扁平化行模型按需展开/收起子项)，并保留三点菜单(编辑名称 / 删除分组)
 * 及其对话框。
 */
const SidebarGroupHeader = memo(function SidebarGroupHeader({
  group,
  count,
  collapsed,
  onToggle,
  itemNoun
}: SidebarGroupHeaderProps) {
  const dispatch = useDispatch();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setMenuAnchorEl(null);

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
      dispatch(updateGroup({ id: group.id, changes: { name: editName.trim() } }));
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

  const handleDeleteCancel = () => setDeleteDialogOpen(false);

  return (
    <>
      <Box
        onClick={onToggle}
        sx={{
          mb: 1,
          minHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          boxShadow: 'none',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '8px',
          backgroundColor: 'background.paper',
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <ChevronDown
            size={20}
            style={{
              flexShrink: 0,
              transition: 'transform 0.2s',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
            }}
          />
          <Typography
            variant="body2"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {group.name} ({count})
          </Typography>
        </Box>

        {/* 三点菜单触发：用 div 包装避免 button 嵌套 button */}
        <Box
          component="div"
          onClick={(e) => {
            e.stopPropagation();
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
            flexShrink: 0,
            cursor: 'pointer',
            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
          }}
        >
          <MoreVertical size={16} />
        </Box>
      </Box>

      {/* 三点菜单 */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
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
            确定要删除分组 "{group.name}" 吗？分组内的{itemNoun}将移至未分组。
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

export default SidebarGroupHeader;
