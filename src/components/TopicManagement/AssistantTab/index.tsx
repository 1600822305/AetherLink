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
} from '@mui/material';
import {
  Plus,
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
} from 'lucide-react';
import type { Assistant } from '../../../shared/types/Assistant';
import VirtualizedAssistantGroups from './VirtualizedAssistantGroups';
import VirtualizedAssistantList from './VirtualizedAssistantList';

import React from 'react';
import { useTranslation } from 'react-i18next';
import PresetAssistantItem from './PresetAssistantItem';
import GroupDialog from '../GroupDialog';
import AssistantIconPicker from './AssistantIconPicker';
import { useAssistantTabLogic } from './useAssistantTabLogic';
import type { Group } from '../../../shared/types';
import AgentPromptSelector from '../../AgentPromptSelector';
import AvatarUploader from '../../settings/AvatarUploader';
import EditAssistantDialog from './EditAssistantDialog';



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
  const { t } = useTranslation();
  
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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和按钮区域 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, minHeight: '32px' }}>
        {showSearch ? (
          <TextField
            fullWidth
            size="small"
            placeholder={t('sidebar.assistants.searchPlaceholder')}
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
            <Typography variant="subtitle1" fontWeight="medium" sx={{ flexShrink: 0 }}>{t('sidebar.assistants.title')}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
              <IconButton size="small" onClick={handleSearchClick} sx={{ mr: 0.5 }}>
                <Search size={18} />
              </IconButton>
              <Tooltip title={t('sidebar.assistants.createGroup')}>
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
                  {t('sidebar.assistants.createGroup')}
                </Button>
              </Tooltip>
              <Tooltip title={t('sidebar.assistants.addAssistant')}>
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
                  {t('sidebar.assistants.addAssistant')}
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
        title={t('sidebar.assistants.ungroupedTitle')}
        height="calc(100vh - 400px)" // 动态计算高度
        emptyMessage={t('sidebar.assistants.emptyUngrouped')}
        itemHeight={72}
      />

      {/* 助手选择对话框 */}
      <Dialog open={assistantDialogOpen} onClose={handleCloseAssistantDialog}>
        <DialogTitle>选择助手</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('sidebar.assistants.selectPresetAssistant', 'Select a preset assistant to add to your assistant list')}
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
          <Button onClick={handleCloseAssistantDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleAddAssistant} color="primary">
            {t('common.add')}
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
            {t('sidebar.assistants.menu.addToGroup')}
          </MenuItem>,
          <MenuItem key="edit-assistant" onClick={handleOpenEditDialog}>
            <Edit3 size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.editAssistant')}
          </MenuItem>,
          <MenuItem key="change-icon" onClick={handleOpenIconPicker}>
            <Image size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.changeIcon')}
          </MenuItem>,
          <MenuItem key="copy-assistant" onClick={handleCopyAssistant}>
            <Copy size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.copyAssistant')}
          </MenuItem>,
          <MenuItem key="clear-topics" onClick={handleClearTopics}>
            <Trash2 size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.clearTopics')}
          </MenuItem>,
          <Divider key="divider-1" />,
          <MenuItem key="sort-pinyin-asc" onClick={handleSortByPinyinAsc}>
            <ArrowUpAZ size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.sortPinyinAsc')}
          </MenuItem>,
          <MenuItem key="sort-pinyin-desc" onClick={handleSortByPinyinDesc}>
            <ArrowDownAZ size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.sortPinyinDesc')}
          </MenuItem>,
          <Divider key="divider-2" />,
          <MenuItem key="delete-assistant" onClick={() => {
            if (selectedMenuAssistant) handleDeleteAssistantAction(selectedMenuAssistant.id);
          }}>
            <Trash size={18} style={{ marginRight: 8 }} />
            {t('sidebar.assistants.menu.deleteAssistant')}
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
          <MenuItem key="create-new-group" onClick={handleAddToNewGroup}>{t('sidebar.assistants.menu.createNewGroup')}</MenuItem>
        ].filter(Boolean)}
      </Menu>

      {/* 编辑助手对话框 */}
      <EditAssistantDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        onSave={handleSaveAssistant}
        assistantName={editAssistantName}
        assistantPrompt={editAssistantPrompt}
        assistantAvatar={editAssistantAvatar}
        onNameChange={handleEditNameChange}
        onPromptChange={handleEditPromptChange}
        onAvatarClick={handleOpenAvatarUploader}
        onPromptSelectorClick={handleOpenPromptSelector}
      />

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