import React, { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tooltip
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { debounce } from 'lodash';
import {
  Plus,
  Search,
  X,
  Edit3,
  Pin,
  Trash2,
  FolderPlus,
  Trash,
  Sparkles,
  ArrowRight,
  Download,
  FileText,
  Copy,
  Database,
  Loader2
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addItemToGroup } from '../../../shared/store/slices/groupsSlice';
import { removeTopic, addTopic } from '../../../shared/store/slices/assistantsSlice';
import GroupDialog from '../GroupDialog';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { EventEmitter, EVENT_NAMES } from '../../../shared/services/infra/EventService';
import type { ChatTopic } from '../../../shared/types';
import type { Assistant } from '../../../shared/types/Assistant';
import { useTopicGroups } from './hooks/useTopicGroups';
import VirtualizedTopicGroups from './VirtualizedTopicGroups';
import VirtualizedTopicList from './VirtualizedTopicList';
import type { RootState } from '../../../shared/store';
import store from '../../../shared/store';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { TopicNamingService } from '../../../shared/services/topics/TopicNamingService';
import { TopicManager } from '../../../shared/services/assistant/TopicManager';
import { exportTopicAsMarkdown, exportTopicAsDocx, copyTopicAsMarkdown } from '../../../utils/exportUtils';
import { exportTopicToNotion } from '../../../utils/notionExport';
import { toastManager } from '../../EnhancedToast';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('TopicTab');

interface TopicTabProps {
  currentAssistant: ({
    id: string;
    name: string;
    systemPrompt?: string;
    topics: ChatTopic[];
    topicIds?: string[];
  }) | null;
  currentTopic: ChatTopic | null;
  onSelectTopic: (topic: ChatTopic) => void;
  onCreateTopic: () => void;
  onDeleteTopic: (topicId: string, event: React.MouseEvent) => void;
  onUpdateTopic?: (topic: ChatTopic) => void;
}

/**
 * 话题选项卡主组件
 */
export default function TopicTab({
  currentAssistant,
  currentTopic,
  onSelectTopic,
  onCreateTopic,
  onDeleteTopic,
  onUpdateTopic
}: TopicTabProps) {
  const dispatch = useDispatch();

  // 简化的状态管理
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState(false);

  // 菜单状态 - 合并相关状态
  const [menuState, setMenuState] = useState<{
    main: { anchorEl: HTMLElement | null; topic: ChatTopic | null };
    addToGroup: { anchorEl: HTMLElement | null; topic: ChatTopic | null };
    moveTo: { anchorEl: HTMLElement | null };
  }>({
    main: { anchorEl: null, topic: null },
    addToGroup: { anchorEl: null, topic: null },
    moveTo: { anchorEl: null }
  });

  // 对话框状态 - 合并相关状态
  const [dialogState, setDialogState] = useState<{
    group: { isOpen: boolean };
    edit: { isOpen: boolean; topic: ChatTopic | null; name: string; prompt: string };
    confirm: { isOpen: boolean; title: string; content: string; onConfirm: () => void };
  }>({
    group: { isOpen: false },
    edit: { isOpen: false, topic: null, name: '', prompt: '' },
    confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
  });

  // 创建防抖搜索函数 - 优化响应速度
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setDebouncedSearchQuery(query);
    }, 150), // 从300ms优化到150ms，提升搜索响应速度
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // 获取所有助手列表（用于移动功能）
  const allAssistants = useSelector((state: RootState) => state.assistants.assistants);

  // 直接从Redux获取当前助手数据，确保立即响应删除操作
  const reduxCurrentAssistant = useSelector((state: RootState) =>
    state.assistants.assistants.find(a => a.id === currentAssistant?.id)
  );

  const assistantWithTopics = reduxCurrentAssistant || currentAssistant;

  // 简化的话题排序逻辑 - 使用Redux数据而不是props数据
  const sortedTopics = useMemo(() => {
    const topicsSource = assistantWithTopics?.topics;
    if (!topicsSource || topicsSource.length === 0) return [];

    return [...topicsSource].sort((a, b) => {
      // 固定话题优先
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      // 按最后消息时间降序排序
      const timeA = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [assistantWithTopics?.topics]); // 依赖Redux数据

  // 简化的自动选择逻辑 - 只处理初始化场景，避免创建话题时的循环
  useEffect(() => {
    if (sortedTopics.length === 0) return;

    const currentTopicExists = currentTopic
      ? sortedTopics.some(topic => topic.id === currentTopic.id)
      : false;

    if (!currentTopicExists) {
      logger.debug('自动选择话题:', sortedTopics[0].name || sortedTopics[0].id);
      startTransition(() => {
        onSelectTopic(sortedTopics[0]);
      });
    }
  }, [sortedTopics, currentTopic?.id, onSelectTopic]);

  // 筛选话题 - 按标题与持久化的最近消息预览匹配（话题对象不含完整 messages，
  // 内容检索改用持久化的 lastMessagePreview 字段）
  const filteredTopics = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) return sortedTopics;
    return sortedTopics.filter(topic => {
      const name = topic.name?.toLowerCase() ?? '';
      const title = topic.title?.toLowerCase() ?? '';
      const preview = topic.lastMessagePreview?.toLowerCase() ?? '';
      return name.includes(query) || title.includes(query) || preview.includes(query);
    });
  }, [debouncedSearchQuery, sortedTopics]);

  // 使用话题分组钩子
  const { topicGroups, topicGroupMap, ungroupedTopics } = useTopicGroups(filteredTopics, currentAssistant?.id);

  // 优化的话题选择函数 - 使用React 18的startTransition
  const handleSelectTopic = useCallback((topic: ChatTopic) => {
    startTransition(() => {
      onSelectTopic(topic);
    });
  }, [onSelectTopic]);

  // 搜索相关处理函数
  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    debouncedSearch.cancel();
  }, [debouncedSearch]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // 菜单处理函数
  const handleOpenMenu = (event: React.MouseEvent, topic: ChatTopic) => {
    event.stopPropagation();
    setMenuState(prev => ({
      ...prev,
      main: { anchorEl: event.currentTarget as HTMLElement, topic }
    }));
  };

  const handleCloseMenu = () => {
    setMenuState(prev => ({
      ...prev,
      main: { anchorEl: null, topic: null }
    }));
  };

  const handleAddToGroupMenu = (event: React.MouseEvent, topic: ChatTopic) => {
    event.stopPropagation();
    setMenuState(prev => ({
      ...prev,
      addToGroup: { anchorEl: event.currentTarget as HTMLElement, topic }
    }));
  };

  const handleCloseAddToGroupMenu = () => {
    setMenuState(prev => ({
      ...prev,
      addToGroup: { anchorEl: null, topic: null }
    }));
  };

  const handleAddToGroup = (groupId: string) => {
    if (!menuState.addToGroup.topic) return;

    dispatch(addItemToGroup({
      groupId,
      itemId: menuState.addToGroup.topic.id
    }));

    handleCloseAddToGroupMenu();
  };

  const handleAddToNewGroup = () => {
    handleCloseAddToGroupMenu();
    setDialogState(prev => ({
      ...prev,
      group: { isOpen: true }
    }));
  };

  // 话题删除处理函数 - 简化版本，避免重复逻辑
  const handleTopicDelete = useCallback((topicId: string, e: React.MouseEvent) => {
      logger.debug('话题删除图标被点击:', topicId);

    // 直接调用父组件的删除函数，让SidebarTabs处理所有逻辑
    startTransition(() => {
      onDeleteTopic(topicId, e);
    });
  }, [onDeleteTopic]);



  // 编辑话题对话框处理
  const handleEditTopic = () => {
    const topic = menuState.main.topic;
    if (!topic) return;

    setDialogState(prev => ({
      ...prev,
      edit: {
        isOpen: true,
        topic,
        name: topic.name || topic.title || '',
        prompt: topic.prompt || ''
      }
    }));
    handleCloseMenu();
  };

  const handleCloseEditDialog = () => {
    setDialogState(prev => ({
      ...prev,
      edit: { isOpen: false, topic: null, name: '', prompt: '' }
    }));
  };

  // 简化的话题更新逻辑 - 添加加载状态
  // 🔥 修复：确保 Redux 状态和数据库同步更新，避免锁死问题
  const updateTopic = async (updatedTopic: ChatTopic) => {
    setLoading(true);
    try {
      // 确保话题有正确的 assistantId
      const assistantId = updatedTopic.assistantId || currentAssistant?.id;
      
      if (!assistantId) {
        logger.error('更新话题失败：缺少 assistantId');
        return false;
      }

      const topicToSave: ChatTopic = {
        ...updatedTopic,
        assistantId
      };

      // 1. 保存到数据库
      await dexieStorage.saveTopic(topicToSave);
      logger.debug(`话题 ${topicToSave.id} 已保存到数据库`);

      // 2. 直接更新 Redux 状态（避免通过回调导致的竞态条件）
      dispatch({
        type: 'assistants/updateTopic',
        payload: { assistantId: topicToSave.assistantId, topic: topicToSave }
      });
      logger.debug(`话题 ${topicToSave.id} 的 Redux 状态已更新`);

      // 3. 发送事件通知（用于其他组件监听）
      EventEmitter.emit(EVENT_NAMES.TOPIC_UPDATED, topicToSave);
      
      return true;
    } catch (error) {
      logger.error('更新话题失败:', error);
      // 刷新话题列表以恢复一致状态
      if (onUpdateTopic && currentAssistant) {
        try {
          const freshTopic = await dexieStorage.getTopic(updatedTopic.id);
          if (freshTopic) {
            onUpdateTopic(freshTopic);
          }
        } catch (refreshError) {
          logger.error('刷新话题失败:', refreshError);
        }
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 保存编辑后的话题
  const handleSaveEdit = async () => {
    const editState = dialogState.edit;
    if (!editState.topic) return;

    const updatedTopic = {
      ...editState.topic,
      name: editState.name,
      prompt: editState.prompt,
      isNameManuallyEdited: true,
      updatedAt: new Date().toISOString()
    };

    const success = await updateTopic(updatedTopic);
    if (success) {
      handleCloseEditDialog();
    }
  };

  // 固定/取消固定话题
  const handleTogglePin = async () => {
    const topic = menuState.main.topic;
    if (!topic) return;

    const updatedTopic = {
      ...topic,
      pinned: !topic.pinned,
      updatedAt: new Date().toISOString()
    };

    const success = await updateTopic(updatedTopic);
    if (success) {
      handleCloseMenu();
    }
  };

  // 自动命名话题
  const handleAutoRenameTopic = async () => {
    const topic = menuState.main.topic;
    if (!topic) return;

    try {
      const newName = await TopicNamingService.generateTopicName(topic, undefined, true);

      if (newName && newName !== topic.name) {
        const updatedTopic = {
          ...topic,
          name: newName,
          isNameManuallyEdited: false,
          updatedAt: new Date().toISOString()
        };

        await updateTopic(updatedTopic);
      }
    } catch (error) {
      logger.error('自动命名话题失败:', error);
    }

    handleCloseMenu();
  };

  // 清空消息
  const handleClearMessages = () => {
    const topic = menuState.main.topic;
    if (!topic) return;

    setDialogState(prev => ({
      ...prev,
      confirm: {
        isOpen: true,
        title: '清空消息',
        content: '确定要清空此话题的所有消息吗？此操作不可撤销。',
        onConfirm: async () => {
          try {
            const success = await TopicService.clearTopicContent(topic.id);

            if (success && onUpdateTopic) {
              const updatedTopic = {
                ...topic,
                messageIds: [],
                messages: [],
                updatedAt: new Date().toISOString()
              };
              onUpdateTopic(updatedTopic);
            }

            setDialogState(prev => ({
              ...prev,
              confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
            }));
          } catch (error) {
            logger.error('清空话题消息失败:', error);
            setDialogState(prev => ({
              ...prev,
              confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
            }));
          }
        }
      }
    }));

    handleCloseMenu();
  };

  // 移动到助手菜单处理
  const handleOpenMoveToMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    setMenuState(prev => ({
      ...prev,
      moveTo: { anchorEl: event.currentTarget as HTMLElement }
    }));
  };

  const handleCloseMoveToMenu = () => {
    setMenuState(prev => ({
      ...prev,
      moveTo: { anchorEl: null }
    }));
  };

  // 移动话题到其他助手
  const handleMoveTo = async (targetAssistant: Assistant) => {
    const topic = menuState.main.topic;
    if (!topic || !currentAssistant) return;

    try {
      const topicFromDb = await dexieStorage.getTopic(topic.id);
      let updatedTopic = {
        ...topicFromDb,
        ...topic,
        assistantId: targetAssistant.id,
        updatedAt: new Date().toISOString()
      } as ChatTopic;

      if (!updatedTopic.messageIds || updatedTopic.messageIds.length === 0) {
        try {
          const messages = await dexieStorage.getTopicMessages(topic.id);
          if (messages && messages.length > 0) {
            updatedTopic = {
              ...updatedTopic,
              messageIds: messages.map(message => message.id)
            };
          }
        } catch (messageError) {
          logger.warn('获取话题消息失败，保持原有messageIds:', messageError);
        }
      }

      await dexieStorage.saveTopic(updatedTopic);

      await Promise.all([
        TopicManager.removeTopicFromAssistant(currentAssistant.id, topic.id),
        TopicManager.addTopicToAssistant(targetAssistant.id, topic.id)
      ]);

      dispatch(removeTopic({
        assistantId: currentAssistant.id,
        topicId: topic.id
      }));
      dispatch(addTopic({
        assistantId: targetAssistant.id,
        topic: updatedTopic
      }));

      EventEmitter.emit(EVENT_NAMES.TOPIC_MOVED, {
        topic: updatedTopic,
        assistantId: targetAssistant.id,
        type: 'move'
      });

      handleCloseMoveToMenu();
      handleCloseMenu();
    } catch (error) {
      logger.error('移动话题失败:', error);
    }
  };

  // 简化的导出函数
  const handleExportTopicAsMarkdown = async (includeReasoning = false) => {
    const topic = menuState.main.topic;
    if (!topic) return;

    try {
      await exportTopicAsMarkdown(topic, includeReasoning);
    } catch (error) {
      logger.error('导出话题Markdown失败:', error);
    }
    handleCloseMenu();
  };

  const handleExportTopicAsDocx = async (includeReasoning = false) => {
    const topic = menuState.main.topic;
    if (!topic) return;

    try {
      await exportTopicAsDocx(topic, includeReasoning);
    } catch (error) {
      logger.error('导出话题DOCX失败:', error);
    }
    handleCloseMenu();
  };

  const handleCopyTopicAsMarkdown = async (includeReasoning = false) => {
    const topic = menuState.main.topic;
    if (!topic) return;

    try {
      await copyTopicAsMarkdown(topic, includeReasoning);
    } catch (error) {
      logger.error('复制话题Markdown失败:', error);
    }
    handleCloseMenu();
  };

  const handleExportTopicToNotion = async (includeReasoning = false) => {
    const topic = menuState.main.topic;
    if (!topic) return;

    const notionSettings = store.getState().settings.notion;

    if (!notionSettings?.enabled) {
      toastManager.warning('请先在设置页面启用并配置Notion集成', '配置提醒');
      return;
    }

    if (!notionSettings.apiKey || !notionSettings.databaseId) {
      toastManager.warning('请先在设置页面配置Notion API密钥和数据库ID', '配置提醒');
      return;
    }

    try {
      await exportTopicToNotion(topic, {
        apiKey: notionSettings.apiKey,
        databaseId: notionSettings.databaseId,
        pageTitleField: notionSettings.pageTitleField || 'Name',
        dateField: notionSettings.dateField
      }, includeReasoning);
    } catch (error) {
      logger.error('导出话题到Notion失败:', error);
    }
    handleCloseMenu();
  };

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      // 整体容器性能优化
      contain: 'layout style paint',
      transform: 'translateZ(0)',
      // 防止不必要的重绘
      isolation: 'isolate',
    }}>
      {/* 标题和按钮区域 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        {showSearch ? (
          <TextField
            fullWidth
            size="small"
            placeholder="搜索话题..."
            value={searchQuery}
            onChange={handleSearchChange}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleCloseSearch} aria-label="关闭搜索">
                    <X size={18} />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {currentAssistant?.name || '所有话题'}
              </Typography>
              {loading && (
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <IconButton size="small" onClick={() => setShowSearch(true)} aria-label="搜索话题" sx={{ mr: 0.5 }}>
                <Search size={18} />
              </IconButton>
              <Tooltip title="创建话题分组">
                <IconButton
                  size="small"
                  onClick={() => setDialogState(prev => ({ ...prev, group: { isOpen: true } }))}
                  aria-label="创建话题分组"
                  sx={{
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: 'text.secondary',
                    borderRadius: '6px',
                    '&:hover': {
                      borderColor: 'text.primary',
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <FolderPlus size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="创建新话题">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={onCreateTopic}
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
                  新建话题
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
      </Box>

      {/* 没有话题时的提示 */}
      {sortedTopics.length === 0 && (
        <Box sx={{ py: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            此助手没有话题，点击上方的"+"按钮创建一个新话题。
          </Typography>
        </Box>
      )}

      {/* 分组区域 */}
      <VirtualizedTopicGroups
        topicGroups={topicGroups}
        topics={filteredTopics}
        topicGroupMap={topicGroupMap}
        currentTopic={currentTopic}
        onSelectTopic={handleSelectTopic}
        onOpenMenu={handleOpenMenu}
        onDeleteTopic={handleTopicDelete}
      />

      {/* 未分组话题列表 - 使用虚拟化组件 */}
      <VirtualizedTopicList
        topics={ungroupedTopics}
        currentTopic={currentTopic}
        onSelectTopic={handleSelectTopic}
        onOpenMenu={handleOpenMenu}
        onDeleteTopic={handleTopicDelete}
        title="未分组话题"
        height="calc(100vh - 400px)" // 动态计算高度
        emptyMessage={debouncedSearchQuery ? `没有找到包含 "${debouncedSearchQuery}" 的话题` : '暂无未分组话题'}
        itemHeight={64} // 更新为64px以包含margin-bottom空间
      />

      {/* 分组对话框 */}
      <GroupDialog
        open={dialogState.group.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, group: { isOpen: false } }))}
        type="topic"
        assistantId={currentAssistant?.id}
      />

      {/* 话题菜单 */}
      <Menu
        anchorEl={menuState.main.anchorEl}
        open={Boolean(menuState.main.anchorEl)}
        onClose={handleCloseMenu}
      >
        {[
          <MenuItem key="add-to-group" onClick={(e) => {
            if (menuState.main.topic) handleAddToGroupMenu(e, menuState.main.topic);
            handleCloseMenu();
          }}>
            <FolderPlus size={18} style={{ marginRight: 8 }} />
            添加到分组...
          </MenuItem>,
          <MenuItem key="edit-topic" onClick={handleEditTopic}>
            <Edit3 size={18} style={{ marginRight: 8 }} />
            编辑话题
          </MenuItem>,
          <MenuItem key="auto-rename" onClick={handleAutoRenameTopic}>
            <Sparkles size={18} style={{ marginRight: 8 }} />
            自动命名话题
          </MenuItem>,
          <MenuItem key="toggle-pin" onClick={handleTogglePin}>
            <Pin size={18} style={{ marginRight: 8 }} />
            {menuState.main.topic?.pinned ? '取消固定' : '固定话题'}
          </MenuItem>,
          <MenuItem key="clear-messages" onClick={handleClearMessages}>
            <Trash2 size={18} style={{ marginRight: 8 }} />
            清空消息
          </MenuItem>,
          allAssistants.length > 1 && currentAssistant && (
            <MenuItem key="move-to" onClick={handleOpenMoveToMenu}>
              <ArrowRight size={18} style={{ marginRight: 8 }} />
              移动到...
            </MenuItem>
          ),
          <Divider key="divider-export" />,
          <MenuItem key="copy-markdown" onClick={() => handleCopyTopicAsMarkdown(false)}>
            <Copy size={18} style={{ marginRight: 8 }} />
            复制为Markdown
          </MenuItem>,
          <MenuItem key="export-markdown" onClick={() => handleExportTopicAsMarkdown(false)}>
            <Download size={18} style={{ marginRight: 8 }} />
            导出为Markdown
          </MenuItem>,
          <MenuItem key="export-docx" onClick={() => handleExportTopicAsDocx(false)}>
            <FileText size={18} style={{ marginRight: 8 }} />
            导出为DOCX
          </MenuItem>,
          <MenuItem key="export-notion" onClick={() => handleExportTopicToNotion(false)}>
            <Database size={18} style={{ marginRight: 8 }} />
            导出到Notion
          </MenuItem>,
          <Divider key="divider-1" />,
          <MenuItem key="delete-topic" onClick={() => {
            const topic = menuState.main.topic;
            if (topic) {
              setDialogState(prev => ({
                ...prev,
                confirm: {
                  isOpen: true,
                  title: '删除话题',
                  content: '确定要删除此话题吗？此操作不可撤销。',
                  onConfirm: async () => {
                    // 立即关闭对话框，提升用户体验
                    setDialogState(prev => ({
                      ...prev,
                      confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
                    }));

                    logger.debug('菜单删除话题:', topic.id, topic.name);

                    // 直接调用父组件的删除函数，让SidebarTabs处理所有逻辑
                    const mockEvent = {
                      stopPropagation: () => {},
                      preventDefault: () => {},
                      currentTarget: null,
                      target: null
                    } as unknown as React.MouseEvent;

                    startTransition(() => {
                      onDeleteTopic(topic.id, mockEvent);
                    });
                  }
                }
              }));
            }
            handleCloseMenu();
          }}>
            <Trash size={18} style={{ marginRight: 8 }} />
            删除话题
          </MenuItem>
        ].filter(Boolean)}
      </Menu>

      {/* 添加到分组菜单 */}
      <Menu
        anchorEl={menuState.addToGroup.anchorEl}
        open={Boolean(menuState.addToGroup.anchorEl)}
        onClose={handleCloseAddToGroupMenu}
      >
        {[
          ...topicGroups.map((group) => (
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

      {/* 移动到助手菜单 */}
      <Menu
        anchorEl={menuState.moveTo.anchorEl}
        open={Boolean(menuState.moveTo.anchorEl)}
        onClose={handleCloseMoveToMenu}
      >
        {allAssistants
          .filter(assistant => assistant.id !== currentAssistant?.id)
          .map((assistant) => (
            <MenuItem
              key={assistant.id}
              onClick={() => handleMoveTo(assistant)}
            >
              {assistant.emoji && <span style={{ marginRight: 8 }}>{assistant.emoji}</span>}
              {assistant.name}
            </MenuItem>
          )).filter(Boolean)}
      </Menu>

      {/* 编辑话题对话框 */}
      <BackButtonDialog open={dialogState.edit.isOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>编辑话题</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="话题名称"
            type="text"
            fullWidth
            variant="outlined"
            value={dialogState.edit.name}
            onChange={(e) => setDialogState(prev => ({
              ...prev,
              edit: { ...prev.edit, name: e.target.value }
            }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="追加提示词"
            multiline
            rows={6}
            fullWidth
            variant="outlined"
            value={dialogState.edit.prompt}
            onChange={(e) => setDialogState(prev => ({
              ...prev,
              edit: { ...prev.edit, prompt: e.target.value }
            }))}
            helperText="此提示词将追加到助手的系统提示词之后。如果助手没有系统提示词，则单独使用此提示词。"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>取消</Button>
          <Button onClick={handleSaveEdit} color="primary">保存</Button>
        </DialogActions>
      </BackButtonDialog>

      {/* 确认对话框 */}
      <BackButtonDialog
        open={dialogState.confirm.isOpen}
        onClose={() => setDialogState(prev => ({
          ...prev,
          confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
        }))}
      >
        <DialogTitle>{dialogState.confirm.title}</DialogTitle>
        <DialogContent>
          <Typography>{dialogState.confirm.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogState(prev => ({
            ...prev,
            confirm: { isOpen: false, title: '', content: '', onConfirm: () => {} }
          }))}>
            取消
          </Button>
          <Button onClick={dialogState.confirm.onConfirm} variant="contained" color="error">
            确认
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </Box>
  );
}
