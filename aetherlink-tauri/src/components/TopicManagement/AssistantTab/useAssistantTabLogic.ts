import { useState, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import * as tinyPinyin from 'tiny-pinyin';
import { debounce } from 'lodash';
import type { Assistant } from '../../../shared/types/Assistant';

import { AssistantService } from '../../../shared/services';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { addItemToGroup } from '../../../shared/store/slices/groupsSlice';
import { useAssistantGroups } from './hooks/useAssistantGroups';
import { getAllAgentSources } from '../../../shared/services/assistant/PredefinedAssistants';

// 预设助手数据 - 从服务中获取
const predefinedAssistantsData = getAllAgentSources();

/**
 * 助手标签页逻辑Hook
 */
export function useAssistantTabLogic(
  userAssistants: Assistant[],
  currentAssistant: Assistant | null,
  onSelectAssistant: (assistant: Assistant) => void,
  onAddAssistant: (assistant: Assistant) => void,
  onUpdateAssistant?: (assistant: Assistant) => void,
  onDeleteAssistant?: (assistantId: string) => void
) {
  const dispatch = useDispatch();
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);



  // 创建防抖搜索函数
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setDebouncedSearchQuery(query);
    }, 300), // 300ms 防抖延迟
    []
  );

  // 过滤助手列表 - 使用防抖搜索查询
  const filteredUserAssistants = useMemo(() => {
    if (!debouncedSearchQuery) return userAssistants;
    return userAssistants.filter(assistant => {
      // 检查助手名称
      if (assistant.name && assistant.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) {
        return true;
      }
      // 检查系统提示词
      if (assistant.systemPrompt && assistant.systemPrompt.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) {
        return true;
      }
      return false;
    });
  }, [debouncedSearchQuery, userAssistants]);

  // 使用助手分组钩子 - 传入过滤后的助手列表
  const {
    assistantGroups,
    assistantGroupMap,
    ungroupedAssistants
  } = useAssistantGroups(filteredUserAssistants);

  // 通知提示状态
  const [notification, setNotification] = useState<{message: string, open: boolean, severity: 'success' | 'error' | 'info' | 'warning'}>({
    message: '',
    open: false,
    severity: 'success'
  });

  // 助手操作菜单状态
  const [assistantMenuAnchorEl, setAssistantMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMenuAssistant, setSelectedMenuAssistant] = useState<Assistant | null>(null);

  // 添加助手到分组对话框状态
  const [addToGroupMenuAnchorEl, setAddToGroupMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [assistantToGroup, setAssistantToGroup] = useState<Assistant | null>(null);

  // 分组对话框状态
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  // 编辑助手对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAssistantName, setEditAssistantName] = useState('');
  const [editAssistantPrompt, setEditAssistantPrompt] = useState('');
  const [editAssistantAvatar, setEditAssistantAvatar] = useState('');
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null); //  新增：保存正在编辑的助手

  // 提示词选择器状态
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);

  // 图标选择器状态
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // 头像上传器状态
  const [avatarUploaderOpen, setAvatarUploaderOpen] = useState(false);



  // 显示通知
  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setNotification({
      message,
      open: true,
      severity
    });
  };

  // 关闭通知
  const handleCloseNotification = () => {
    setNotification({...notification, open: false});
  };

  // 打开助手选择对话框
  const handleOpenAssistantDialog = () => {
    setAssistantDialogOpen(true);
    setSelectedAssistantId(null);
  };

  // 关闭助手选择对话框
  const handleCloseAssistantDialog = () => {
    setAssistantDialogOpen(false);
    setSelectedAssistantId(null);
  };

  // 选择助手
  const handleSelectAssistant = (assistantId: string) => {
    setSelectedAssistantId(assistantId);
  };

  // 选择助手（从列表中）
  const handleSelectAssistantFromList = (assistant: Assistant) => {
    // 调用父组件传入的onSelectAssistant函数
    onSelectAssistant(assistant);
  };

  // 添加选中的预设助手
  const handleAddAssistant = () => {
    const selectedAssistant = predefinedAssistantsData.find(a => a.id === selectedAssistantId);
    if (selectedAssistant && onAddAssistant) {
      const newAssistant = {
        ...selectedAssistant,
        id: uuidv4(), // 使用uuidv4代替nanoid
        isSystem: false, // 设置为非系统助手
        topicIds: [], // 清空话题列表
        topics: [] // 清空话题对象列表
      };
      onAddAssistant(newAssistant);
      handleCloseAssistantDialog();
    }
  };

  // 打开分组对话框
  const handleOpenGroupDialog = () => {
    setGroupDialogOpen(true);
  };

  // 关闭分组对话框
  const handleCloseGroupDialog = () => {
    setGroupDialogOpen(false);
  };

  // 打开助手菜单
  const handleOpenMenu = (event: React.MouseEvent, assistant: Assistant) => {
    event.stopPropagation();
    setAssistantMenuAnchorEl(event.currentTarget as HTMLElement);
    setSelectedMenuAssistant(assistant);
  };

  // 关闭助手菜单
  const handleCloseAssistantMenu = () => {
    setAssistantMenuAnchorEl(null);
    setSelectedMenuAssistant(null);
  };

  // 打开添加到分组菜单
  const handleOpenAddToGroupMenu = () => {
    if (!selectedMenuAssistant) return;

    setAssistantToGroup(selectedMenuAssistant);
    setAddToGroupMenuAnchorEl(assistantMenuAnchorEl);
    setAssistantMenuAnchorEl(null);
  };

  // 关闭添加到分组菜单
  const handleCloseAddToGroupMenu = () => {
    setAddToGroupMenuAnchorEl(null);
    setAssistantToGroup(null);
  };

  // 添加到新分组
  const handleAddToNewGroup = () => {
    handleCloseAddToGroupMenu();
    handleOpenGroupDialog();
  };

  // 处理删除助手
  const handleDeleteAssistantAction = (assistantId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (onDeleteAssistant) onDeleteAssistant(assistantId);
    handleCloseAssistantMenu();
  };

  // 打开编辑助手对话框
  const handleOpenEditDialog = () => {
    if (!selectedMenuAssistant) return;

    setEditingAssistant(selectedMenuAssistant);
    setEditAssistantName(selectedMenuAssistant.name);
    setEditAssistantPrompt(selectedMenuAssistant.systemPrompt || '');
    setEditAssistantAvatar(selectedMenuAssistant.avatar || '');
    setEditDialogOpen(true);
    handleCloseAssistantMenu();
  };

  // 关闭编辑助手对话框
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingAssistant(null); // 清理编辑状态
    setEditAssistantAvatar(''); // 清理头像状态
  };

  // 保存编辑后的助手
  const handleSaveAssistant = async () => {
    if (!editingAssistant) return;

    try {
      const updatedAssistant = {
        ...editingAssistant,
        name: editAssistantName,
        systemPrompt: editAssistantPrompt,
        avatar: editAssistantAvatar,
        // 如果设置了头像，清空emoji字段，避免冲突
        emoji: editAssistantAvatar ? undefined : editingAssistant.emoji
      };

      // 直接保存到数据库，确保数据持久化
      await dexieStorage.saveAssistant(updatedAssistant);
      console.log('[useAssistantTabLogic] 已保存助手到数据库');

      // 更新Redux状态
      if (onUpdateAssistant) {
        onUpdateAssistant(updatedAssistant);
        console.log('[useAssistantTabLogic] 已通过回调更新助手');
      }

      //  添加：派发事件通知其他组件更新，确保提示词气泡同步
      window.dispatchEvent(new CustomEvent('assistantUpdated', {
        detail: { assistant: updatedAssistant }
      }));
      console.log('[useAssistantTabLogic] 已派发助手更新事件');

      // 显示成功通知
      showNotification('助手已更新');

      // 添加提示，说明系统提示词更改不会影响现有话题
      console.log('[useAssistantTabLogic] 注意：系统提示词更改不会影响现有话题，只会应用于新创建的话题');

      handleCloseEditDialog();
    } catch (error) {
      console.error('[useAssistantTabLogic] 保存助手失败:', error);
      showNotification('保存助手失败', 'error');
    }
  };

  // 复制助手
  const handleCopyAssistant = () => {
    if (!selectedMenuAssistant) return;

    const newAssistant = {
      ...selectedMenuAssistant,
      id: uuidv4(),
      name: `${selectedMenuAssistant.name} (复制)`,
      topicIds: [],
      topics: []
    };

    onAddAssistant(newAssistant);
    handleCloseAssistantMenu();
  };

  // 清空话题
  const handleClearTopics = async () => {
    if (!selectedMenuAssistant) return;

    try {
      await AssistantService.clearAssistantTopics(selectedMenuAssistant.id);

      // 创建更新后的助手对象
      const updatedAssistant = {
        ...selectedMenuAssistant,
        topicIds: [],
        topics: []
      };

      // 总是更新Redux状态，不管是否是当前助手
      if (onUpdateAssistant) {
        onUpdateAssistant(updatedAssistant);
        console.log(`[useAssistantTabLogic] 已更新助手 ${selectedMenuAssistant.name} 的Redux状态`);
      }

      // 如果是当前助手，也要更新当前助手状态
      if (currentAssistant && currentAssistant.id === selectedMenuAssistant.id) {
        // 这里会通过onUpdateAssistant回调更新当前助手
        console.log(`[useAssistantTabLogic] 清空的是当前助手，已同步更新`);
      }

      console.log(`[useAssistantTabLogic] 成功清空助手 ${selectedMenuAssistant.name} 的话题`);
    } catch (error) {
      console.error('清空话题失败:', error);
    }

    handleCloseAssistantMenu();
  };

  // 选择新的图标
  const handleSelectEmoji = async (emoji: string) => {
    if (!selectedMenuAssistant) {
      console.warn('[useAssistantTabLogic] 没有选中的助手，无法更新图标');
      return;
    }

    try {
      console.log('[useAssistantTabLogic] 开始更新助手图标:', {
        id: selectedMenuAssistant.id,
        name: selectedMenuAssistant.name,
        oldEmoji: selectedMenuAssistant.emoji,
        newEmoji: emoji
      });

      const updatedAssistant = {
        ...selectedMenuAssistant,
        emoji: emoji,
        updatedAt: new Date().toISOString() // 添加更新时间戳
      };

      // 保存到数据库，确保图标持久化
      await dexieStorage.saveAssistant(updatedAssistant);
      console.log('[useAssistantTabLogic] 已保存助手图标到数据库');

      // 验证保存结果 - 立即从数据库读取验证
      const verifyAssistant = await dexieStorage.getAssistant(selectedMenuAssistant.id);
      console.log('[useAssistantTabLogic] 验证保存结果:', {
        savedEmoji: verifyAssistant?.emoji,
        expectedEmoji: emoji,
        isCorrect: verifyAssistant?.emoji === emoji
      });

      // 更新Redux状态
      if (onUpdateAssistant) {
        onUpdateAssistant(updatedAssistant);
        console.log('[useAssistantTabLogic] 已通过回调更新助手图标');
      } else {
        console.warn('[useAssistantTabLogic] onUpdateAssistant回调不存在');
      }

      // 派发自定义事件，确保其他组件也能收到更新
      window.dispatchEvent(new CustomEvent('assistantUpdated', {
        detail: { assistant: updatedAssistant }
      }));
      console.log('[useAssistantTabLogic] 已派发assistantUpdated事件');

      // 关闭图标选择器
      handleCloseIconPicker();

      // 显示成功通知
      showNotification('助手图标已更新');
    } catch (error) {
      console.error('[useAssistantTabLogic] 更新助手图标失败:', error);
      showNotification('更新助手图标失败');
    }
  };

  // 按拼音升序排序
  const handleSortByPinyinAsc = () => {
    const sorted = [...userAssistants].sort((a, b) => {
      const pinyinA = tinyPinyin.convertToPinyin(a.name, '', true);
      const pinyinB = tinyPinyin.convertToPinyin(b.name, '', true);
      return pinyinA.localeCompare(pinyinB);
    });

    // 更新Redux中的助手列表顺序
    sorted.forEach((assistant, index) => {
      dispatch({
        type: 'assistants/updateAssistantOrder',
        payload: { assistantId: assistant.id, order: index }
      });
    });

    // 显示通知
    showNotification('助手已按拼音升序排列');

    handleCloseAssistantMenu();
  };

  // 按拼音降序排序
  const handleSortByPinyinDesc = () => {
    const sorted = [...userAssistants].sort((a, b) => {
      const pinyinA = tinyPinyin.convertToPinyin(a.name, '', true);
      const pinyinB = tinyPinyin.convertToPinyin(b.name, '', true);
      return pinyinB.localeCompare(pinyinA);
    });

    // 更新Redux中的助手列表顺序
    sorted.forEach((assistant, index) => {
      dispatch({
        type: 'assistants/updateAssistantOrder',
        payload: { assistantId: assistant.id, order: index }
      });
    });

    // 显示通知
    showNotification('助手已按拼音降序排列');

    handleCloseAssistantMenu();
  };

  // 添加助手到分组
  const handleAddToGroup = (groupId: string) => {
    if (assistantToGroup) {
      dispatch(addItemToGroup({
        groupId: groupId,
        itemId: assistantToGroup.id
      }));
      handleCloseAddToGroupMenu();
    }
  };

  // 处理助手名称输入变化
  const handleEditNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditAssistantName(e.target.value);
  };

  // 处理助手提示词输入变化
  const handleEditPromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditAssistantPrompt(e.target.value);
  };

  // 打开提示词选择器
  const handleOpenPromptSelector = () => {
    setPromptSelectorOpen(true);
  };

  // 关闭提示词选择器
  const handleClosePromptSelector = () => {
    setPromptSelectorOpen(false);
  };

  // 选择提示词
  const handleSelectPrompt = (prompt: string) => {
    setEditAssistantPrompt(prompt);
    setPromptSelectorOpen(false);
  };

  // 打开图标选择器
  const handleOpenIconPicker = () => {
    if (!selectedMenuAssistant) {
      console.warn('[useAssistantTabLogic] 没有选中的助手，无法打开图标选择器');
      return;
    }

    console.log('[useAssistantTabLogic] 打开图标选择器，选中的助手:', {
      id: selectedMenuAssistant.id,
      name: selectedMenuAssistant.name,
      emoji: selectedMenuAssistant.emoji
    });

    setIconPickerOpen(true);
    // 不要立即关闭菜单，保持selectedMenuAssistant的值
    setAssistantMenuAnchorEl(null); // 只关闭菜单UI，不清空选中的助手
  };

  // 关闭图标选择器
  const handleCloseIconPicker = () => {
    setIconPickerOpen(false);
    // 清空选中的助手
    setSelectedMenuAssistant(null);
  };

  // 打开头像上传器
  const handleOpenAvatarUploader = () => {
    setAvatarUploaderOpen(true);
  };

  // 关闭头像上传器
  const handleCloseAvatarUploader = () => {
    setAvatarUploaderOpen(false);
  };

  // 保存头像
  const handleSaveAvatar = (avatarDataUrl: string) => {
    setEditAssistantAvatar(avatarDataUrl);
  };

  // 移除头像
  const handleRemoveAvatar = () => {
    setEditAssistantAvatar('');
  };

  // 搜索相关处理函数
  const handleSearchClick = useCallback(() => {
    setShowSearch(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    // 取消待执行的防抖函数
    debouncedSearch.cancel();
  }, [debouncedSearch]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    // 触发防抖搜索
    debouncedSearch(value);
  }, [debouncedSearch]);

  return {
    // 状态
    assistantDialogOpen,
    selectedAssistantId,
    assistantGroups,
    assistantGroupMap,
    ungroupedAssistants,
    filteredUserAssistants, // 新增：过滤后的助手列表
    notification,
    assistantMenuAnchorEl,
    selectedMenuAssistant,
    addToGroupMenuAnchorEl,
    assistantToGroup,
    groupDialogOpen,
    editDialogOpen,
    editAssistantName,
    editAssistantPrompt,
    editAssistantAvatar,
    editingAssistant,
    promptSelectorOpen,
    iconPickerOpen,
    avatarUploaderOpen,
    // 搜索相关状态
    searchQuery,
    debouncedSearchQuery,
    showSearch,

    // 处理函数
    showNotification,
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
    handleRemoveAvatar,
    // 搜索相关处理函数
    handleSearchClick,
    handleCloseSearch,
    handleSearchChange,

    // 数据
    predefinedAssistantsData
  };
}