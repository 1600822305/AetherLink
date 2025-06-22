import {
  Box,
  List,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  TextField,
  Divider,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Tabs,
  Tab,
  Paper,
  useTheme,
  type Theme,
} from '@mui/material';
import {
  Plus,
  Sparkles,
  FolderPlus,
  Edit3,
  Image,
  Copy,
  Trash2,
  ArrowUpAZ,
  ArrowDownAZ,
  Trash,
  Search,
  X,
  User,
  ChevronLeft
} from 'lucide-react';
import type { Assistant } from '../../../shared/types/Assistant';
import VirtualizedAssistantGroups from './VirtualizedAssistantGroups';
import VirtualizedAssistantList from './VirtualizedAssistantList';

import React, { useState } from 'react';
import PresetAssistantItem from './PresetAssistantItem';
import GroupDialog from '../GroupDialog';
import AssistantIconPicker from './AssistantIconPicker';
import { useAssistantTabLogic } from './useAssistantTabLogic';
import type { Group } from '../../../shared/types';
import AgentPromptSelector from '../../AgentPromptSelector';
import AvatarUploader from '../../settings/AvatarUploader';

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
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
      : 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 100%)',
    boxShadow: theme.palette.mode === 'dark'
      ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.2)`
      : `0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`,
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
  }),

  secondaryButton: (theme: Theme) => ({
    borderColor: theme.palette.text.secondary,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    textTransform: 'none' as const,
    backdropFilter: 'blur(10px)',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(0, 0, 0, 0.02)',
    '&:hover': {
      borderColor: theme.palette.text.primary,
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.05)'
    }
  })
};

// 组件属性定义
interface AssistantTabProps {
  userAssistants: Assistant[];
  currentAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
  onAddAssistant: (assistant: Assistant) => void;
  onUpdateAssistant?: (assistant: Assistant) => void;
  onDeleteAssistant?: (assistantId: string) => void;
}

/**
 * 助手选项卡组件 - 只负责渲染UI
 */
const AssistantTab = React.memo(function AssistantTab({
  userAssistants,
  currentAssistant,
  onSelectAssistant,
  onAddAssistant,
  onUpdateAssistant,
  onDeleteAssistant
}: AssistantTabProps) {
  const theme = useTheme();

  // 使用自定义hook获取所有逻辑和状态
  const {
    // 状态
    assistantDialogOpen,
    selectedAssistantId,
    assistantGroups,
    assistantGroupMap,
    ungroupedAssistants,
    filteredUserAssistants,
    notification,
    assistantMenuAnchorEl,
    selectedMenuAssistant,
    addToGroupMenuAnchorEl,
    groupDialogOpen,
    editDialogOpen,
    editAssistantName,
    editAssistantPrompt,
    editAssistantAvatar,
    promptSelectorOpen,
    iconPickerOpen,
    avatarUploaderOpen,
    // 搜索相关状态
    searchQuery,
    showSearch,

    // 处理函数
    handleCloseNotification,
    handleOpenAssistantDialog,
    handleCloseAssistantDialog,
    handleSelectAssistant,
    handleSelectAssistantFromList,
    handleAddAssistant,
    handleOpenGroupDialog,
    handleCloseGroupDialog,
    handleOpenMenu,
    handleCloseAssistantMenu,
    handleOpenAddToGroupMenu,
    handleCloseAddToGroupMenu,
    handleAddToNewGroup,
    handleDeleteAssistantAction,
    handleOpenEditDialog,
    handleCloseEditDialog,
    handleSaveAssistant,
    handleCopyAssistant,
    handleClearTopics,
    handleSelectEmoji,
    handleSortByPinyinAsc,
    handleSortByPinyinDesc,
    handleAddToGroup,
    handleEditNameChange,
    handleEditPromptChange,
    handleOpenPromptSelector,
    handleClosePromptSelector,
    handleSelectPrompt,
    handleOpenIconPicker,
    handleCloseIconPicker,
    handleOpenAvatarUploader,
    handleCloseAvatarUploader,
    handleSaveAvatar,
    handleRemoveAvatar: _handleRemoveAvatar,
    // 搜索相关处理函数
    handleSearchClick,
    handleCloseSearch,
    handleSearchChange,

    // 数据
    predefinedAssistantsData
  } = useAssistantTabLogic(
    userAssistants,
    currentAssistant,
    onSelectAssistant,
    onAddAssistant,
    onUpdateAssistant,
    onDeleteAssistant
  );

  // 编辑弹窗标签页状态 - 只显示提示词标签页
  const [editTabValue, setEditTabValue] = useState(0);

  const handleEditTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setEditTabValue(newValue);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和按钮区域 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, minHeight: '32px' }}>
        {showSearch ? (
          <TextField
            fullWidth
            size="small"
            placeholder="搜索助手..."
            value={searchQuery}
            onChange={handleSearchChange}
            autoFocus
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleCloseSearch}>
                      <X size={18} />
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
          />
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight="medium" sx={{ flexShrink: 0 }}>所有助手</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
              <IconButton size="small" onClick={handleSearchClick} sx={{ mr: 0.5 }}>
                <Search size={18} />
              </IconButton>
              <Tooltip title="创建分组">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FolderPlus size={16} />}
                  onClick={handleOpenGroupDialog}
                  sx={{
                    color: 'text.primary',
                    borderColor: 'text.secondary',
                    minWidth: 'auto',
                    px: 1,
                    fontSize: '0.75rem',
                    '&:hover': {
                      borderColor: 'text.primary',
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  创建分组
                </Button>
              </Tooltip>
              <Tooltip title="创建新助手">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={handleOpenAssistantDialog}
                  sx={{
                    color: 'text.primary',
                    borderColor: 'text.secondary',
                    minWidth: 'auto',
                    px: 1,
                    fontSize: '0.75rem',
                    '&:hover': {
                      borderColor: 'text.primary',
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  添加助手
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
      </Box>

      {/* 分组区域 - 使用虚拟化组件 */}
      <VirtualizedAssistantGroups
        assistantGroups={assistantGroups || []}
        userAssistants={filteredUserAssistants} // 使用过滤后的助手列表
        assistantGroupMap={assistantGroupMap || {}}
        currentAssistant={currentAssistant}
        onSelectAssistant={handleSelectAssistantFromList}
        onOpenMenu={handleOpenMenu}
        onDeleteAssistant={handleDeleteAssistantAction}
        isGroupEditMode={false}
        onAddItem={handleOpenGroupDialog}
      />

      {/* 未分组助手列表 - 使用虚拟化组件 */}
      <VirtualizedAssistantList
        assistants={ungroupedAssistants || []}
        currentAssistant={currentAssistant}
        onSelectAssistant={handleSelectAssistantFromList}
        onOpenMenu={handleOpenMenu}
        onDeleteAssistant={handleDeleteAssistantAction}
        title="未分组助手"
        height="calc(100vh - 400px)" // 动态计算高度
        emptyMessage="暂无未分组助手"
        itemHeight={72}
      />

      {/* 助手选择对话框 */}
      <Dialog open={assistantDialogOpen} onClose={handleCloseAssistantDialog}>
        <DialogTitle>选择助手</DialogTitle>
        <DialogContent>
          <DialogContentText>
            选择一个预设助手来添加到你的助手列表中
          </DialogContentText>
          <List sx={{ pt: 1 }}>
            {predefinedAssistantsData.map((assistant: Assistant) => (
              <PresetAssistantItem
                key={assistant.id}
                assistant={assistant}
                isSelected={selectedAssistantId === assistant.id}
                onSelect={handleSelectAssistant}
              />
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssistantDialog}>取消</Button>
          <Button onClick={handleAddAssistant} color="primary">
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 分组对话框 */}
      <GroupDialog
        open={groupDialogOpen}
        onClose={handleCloseGroupDialog}
        type="assistant"
      />

      {/* 助手菜单 */}
      <Menu
        anchorEl={assistantMenuAnchorEl}
        open={Boolean(assistantMenuAnchorEl)}
        onClose={handleCloseAssistantMenu}
      >
        {[
          <MenuItem key="add-to-group" onClick={handleOpenAddToGroupMenu}>
            <FolderPlus size={18} style={{ marginRight: 8 }} />
            添加到分组...
          </MenuItem>,
          <MenuItem key="edit-assistant" onClick={handleOpenEditDialog}>
            <Edit3 size={18} style={{ marginRight: 8 }} />
            编辑助手
          </MenuItem>,
          <MenuItem key="change-icon" onClick={handleOpenIconPicker}>
            <Image size={18} style={{ marginRight: 8 }} />
            修改图标
          </MenuItem>,
          <MenuItem key="copy-assistant" onClick={handleCopyAssistant}>
            <Copy size={18} style={{ marginRight: 8 }} />
            复制助手
          </MenuItem>,
          <MenuItem key="clear-topics" onClick={handleClearTopics}>
            <Trash2 size={18} style={{ marginRight: 8 }} />
            清空话题
          </MenuItem>,
          <Divider key="divider-1" />,
          <MenuItem key="sort-pinyin-asc" onClick={handleSortByPinyinAsc}>
            <ArrowUpAZ size={18} style={{ marginRight: 8 }} />
            按拼音升序排列
          </MenuItem>,
          <MenuItem key="sort-pinyin-desc" onClick={handleSortByPinyinDesc}>
            <ArrowDownAZ size={18} style={{ marginRight: 8 }} />
            按拼音降序排列
          </MenuItem>,
          <Divider key="divider-2" />,
          <MenuItem key="delete-assistant" onClick={() => {
            if (selectedMenuAssistant) handleDeleteAssistantAction(selectedMenuAssistant.id);
          }}>
            <Trash size={18} style={{ marginRight: 8 }} />
            删除助手
          </MenuItem>
        ].filter(Boolean)}
      </Menu>

      {/* 添加到分组菜单 */}
      <Menu
        anchorEl={addToGroupMenuAnchorEl}
        open={Boolean(addToGroupMenuAnchorEl)}
        onClose={handleCloseAddToGroupMenu}
      >
        {[
          ...(assistantGroups || []).map((group: Group) => (
            <MenuItem
              key={group.id}
              onClick={() => handleAddToGroup(group.id)}
            >
              {group.name}
            </MenuItem>
          )),
          <MenuItem key="create-new-group" onClick={handleAddToNewGroup}>创建新分组...</MenuItem>
        ].filter(Boolean)}
      </Menu>

      {/* 编辑助手对话框 */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleCloseEditDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: styles.dialogPaper(theme)
        }}
        BackdropProps={{
          sx: styles.dialogBackdrop
        }}
      >
        {/* 自定义标题栏 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          p: 2, 
          borderBottom: (theme) => 
            `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          backgroundColor: 'transparent',
        }}>
          <IconButton 
            onClick={handleCloseEditDialog}
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
            <ChevronLeft size={24} />
          </IconButton>
          <Typography variant="h6" sx={{ 
            color: (theme) => theme.palette.text.primary, 
            fontWeight: 600 
          }}>
            编辑助手
          </Typography>
        </Box>

        {/* 助手头像区域 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          py: 4,
          backgroundColor: 'transparent'
        }}>
          <Box sx={styles.avatarContainer(theme)}>
            <Avatar
              src={editAssistantAvatar}
              sx={{
                width: 100,
                height: 100,
                bgcolor: editAssistantAvatar ? 'transparent' : 'primary.main',
                fontSize: '2rem',
                color: (theme) => theme.palette.primary.contrastText,
                boxShadow: (theme) => 
                  theme.palette.mode === 'dark'
                    ? '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7)',
                border: (theme) => 
                  `2px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'}`,
                background: editAssistantAvatar ? 'transparent' : (theme) => 
                  theme.palette.mode === 'dark'
                    ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                    : `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`
              }}
            >
              {!editAssistantAvatar && (editAssistantName.charAt(0) || '助')}
            </Avatar>
            <IconButton
              onClick={handleOpenAvatarUploader}
              sx={{
                position: 'absolute',
                bottom: 5,
                right: 5,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                border: (theme) =>
                  `2px solid ${theme.palette.mode === 'dark' ? 'rgba(18, 18, 18, 0.85)' : 'rgba(255, 255, 255, 0.9)'}`,
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: (theme) =>
                    theme.palette.mode === 'dark'
                      ? '0 6px 16px rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.3)'
                      : '0 6px 16px rgba(0,0,0,0.2), 0 3px 6px rgba(0,0,0,0.15)',
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <User size={16} color="white" />
            </IconButton>
          </Box>
        </Box>

        {/* 标签页导航 - 只显示提示词标签页 */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          px: 2
        }}>
          <Tabs
            value={editTabValue}
            onChange={handleEditTabChange}
            variant="standard"
            sx={{
              '& .MuiTab-root': {
                color: (theme) => theme.palette.text.secondary,
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none',
                minWidth: 80,
                '&.Mui-selected': {
                  color: (theme) => theme.palette.primary.main
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: (theme) => theme.palette.primary.main,
                height: 3,
                borderRadius: '2px'
              }
            }}
          >
            <Tab label="提示词" />
          </Tabs>
        </Box>

        {/* 内容区域 */}
        <DialogContent sx={{
          flex: 1,
          backgroundColor: 'transparent',
          p: 3,
          color: (theme) => theme.palette.text.primary
        }}>
          {editTabValue === 0 && (
            <Box>
            {/* Name 字段 */}
            <Typography variant="subtitle2" sx={{
              mb: 1,
              color: (theme) => theme.palette.text.secondary,
              fontSize: '0.875rem'
            }}>
              名称
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              value={editAssistantName}
              onChange={handleEditNameChange}
              placeholder="请输入助手名称，例如：法律咨询助手"
              sx={{
                mb: 3,
                ...styles.inputField(theme)
              }}
            />

            {/* Prompt 字段 */}
            <Typography variant="subtitle2" sx={{
              mb: 1,
              color: (theme) => theme.palette.text.secondary,
              fontSize: '0.875rem'
            }}>
              提示词
            </Typography>
            <Paper sx={{
              ...styles.glassomorphism(theme),
              borderRadius: '8px',
              p: 2
            }}>
              <TextField
                multiline
                rows={8}
                fullWidth
                variant="standard"
                value={editAssistantPrompt}
                onChange={handleEditPromptChange}
                placeholder="请输入系统提示词，定义助手的角色和行为特征...

示例：
你是一个友好、专业、乐于助人的AI助手。你会以客观、准确的态度回答用户的问题，并在不确定的情况下坦诚表明。你可以协助用户完成各种任务，提供信息，或进行有意义的对话。"
                sx={{
                  '& .MuiInput-root': {
                    color: (theme) => theme.palette.text.primary,
                    fontSize: '0.875rem',
                    '&:before': {
                      display: 'none'
                    },
                    '&:after': {
                      display: 'none'
                    }
                  },
                  '& .MuiInputBase-input': {
                    color: (theme) => theme.palette.text.primary,
                    '&::placeholder': {
                      color: (theme) => theme.palette.text.secondary,
                      opacity: 1
                    }
                  }
                }}
              />

              {/* 功能按钮 */}
              <Box sx={{
                display: 'flex',
                gap: 1,
                mt: 2,
                pt: 2,
                borderTop: (theme) =>
                  `1px solid ${theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.1)'}`
              }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Sparkles size={16} />}
                  onClick={handleOpenPromptSelector}
                  sx={styles.primaryButton(theme)}
                >
                  选择预设提示词
                </Button>

              </Box>
            </Paper>
          </Box>
          )}
        </DialogContent>

        {/* 底部操作按钮 */}
        <DialogActions sx={{ 
          p: 3, 
          backgroundColor: 'transparent',
          borderTop: (theme) => 
            `1px solid ${theme.palette.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.1)'}`
        }}>
          <Button 
            onClick={handleCloseEditDialog}
            sx={{ 
              color: (theme) => theme.palette.text.secondary,
              backdropFilter: 'blur(10px)',
              backgroundColor: (theme) => 
                theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : 'rgba(0, 0, 0, 0.02)',
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
            onClick={handleSaveAssistant} 
            variant="contained"
            sx={{
              backgroundColor: (theme) => theme.palette.primary.main,
              color: (theme) => theme.palette.primary.contrastText,
              backdropFilter: 'blur(10px)',
              '&:hover': { 
                backgroundColor: (theme) => theme.palette.primary.dark 
              }
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 智能体提示词选择器 */}
      <AgentPromptSelector
        open={promptSelectorOpen}
        onClose={handleClosePromptSelector}
        onSelect={handleSelectPrompt}
        currentPrompt={editAssistantPrompt}
      />

      {/* 助手图标选择器 */}
      <AssistantIconPicker
        open={iconPickerOpen}
        onClose={handleCloseIconPicker}
        onSelectEmoji={handleSelectEmoji}
        currentEmoji={selectedMenuAssistant?.emoji}
      />

      {/* 助手头像上传器 */}
      <AvatarUploader
        open={avatarUploaderOpen}
        onClose={handleCloseAvatarUploader}
        onSave={handleSaveAvatar}
        currentAvatar={editAssistantAvatar}
        title="设置助手头像"
      />

      {/* 通知提示 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={3000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
});

export default AssistantTab;

// 错误边界组件
export class AssistantTabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AssistantTab error:', error, errorInfo);
    // 这里可以添加错误上报逻辑
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 3
        }}>
          <Typography variant="h6" color="error" gutterBottom>
            助手页面出现错误
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.state.error?.message || '未知错误'}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            重试
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}