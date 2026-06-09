import React, { startTransition, useEffect, useDeferredValue } from 'react';
import { Box, Tabs, Tab, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useSidebarContext } from './SidebarContext';
import TabPanel, { a11yProps } from './TabPanel';
import AssistantTab from './AssistantTab/index';
import TopicTab from './TopicTab/index';
import SettingsTab from './SettingsTab/index';
import NoteTab from './NoteTab/index';
import WorkspaceTab from './WorkspaceTab/index';
import { Bot, MessageSquare, Settings, FileText, FolderOpen, Languages } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { parseModelIdentityKey } from '../../shared/utils/modelUtils';
import { ENABLE_NOTE_SIDEBAR_KEY, simpleNoteService } from '../../shared/services/notes/SimpleNoteService';
import { workspaceService, ENABLE_WORKSPACE_SIDEBAR_KEY } from '../../shared/services/files/WorkspaceService';
import { useNavigate } from 'react-router-dom';

/**
 * 侧边栏标签页内容组件 - 使用memo优化性能
 */
const SidebarTabsContent = React.memo(function SidebarTabsContent() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const showNoteTab = useSelector((state: RootState) => (state.settings as any)[ENABLE_NOTE_SIDEBAR_KEY]);
  const showWorkspaceTab = useSelector((state: RootState) => (state.settings as any)[ENABLE_WORKSPACE_SIDEBAR_KEY]);
  // 当前选中的模型 ID（存储为身份标识 key，需解析出真实 model.id），
  // 供设置页按模型动态生成「推理努力程度」档位（如 DeepSeek V4 仅 关闭/高/最高）。
  const currentModelId = useSelector((state: RootState) => state.settings.currentModelId);
  const currentModelBaseId = React.useMemo(
    () => parseModelIdentityKey(currentModelId)?.id,
    [currentModelId]
  );

  // 启动时从 dexie 同步侧边栏开关状态到 Redux
  // 修复：redux-persist 的 throttle 可能导致关闭后未持久化，重启后恢复旧值
  useEffect(() => {
    const syncSidebarFlags = async () => {
      try {
        const [wsEnabled, noteEnabled] = await Promise.all([
          workspaceService.isSidebarEnabled(),
          simpleNoteService.isSidebarEnabled(),
        ]);
        dispatch(updateSettings({
          [ENABLE_WORKSPACE_SIDEBAR_KEY]: wsEnabled,
          [ENABLE_NOTE_SIDEBAR_KEY]: noteEnabled,
        }));
      } catch (e) {
        console.error('[SidebarTabsContent] 同步侧边栏开关失败:', e);
      }
    };
    syncSidebarFlags();
  }, [dispatch]);

  // 计算额外Tab数量，用于调整样式
  const extraTabCount = (showNoteTab ? 1 : 0) + (showWorkspaceTab ? 1 : 0);
  const hasExtraTabs = extraTabCount > 0;

  const {
    loading,
    value,
    setValue,
    userAssistants,
    currentAssistant,
    assistantWithTopics,
    currentTopic,
    handleSelectAssistant,
    handleAddAssistant,
    handleUpdateAssistant,
    handleDeleteAssistant,

    handleSelectTopic,
    handleCreateTopic,
    handleDeleteTopic,
    handleUpdateTopic,
    settings,
    settingsArray,
    handleSettingChange,
    handleContextLengthChange,
    handleContextCountChange,
    handleMathRendererChange,
    handleThinkingEffortChange,
    mcpMode,
    toolsEnabled,
    handleMCPModeChange,
    handleToolsToggle,
    refreshTopics
  } = useSidebarContext();

  // 修复：如果当前 tab 索引指向已关闭的 tab，重置到助手 tab
  // Tab 布局: 0=助手, 1=话题, [2=工作区], [2/3=笔记], last=设置
  useEffect(() => {
    const maxValidIndex = 2 + (showWorkspaceTab ? 1 : 0) + (showNoteTab ? 1 : 0);
    if (value > maxValidIndex) {
      setValue(0);
    }
  }, [showWorkspaceTab, showNoteTab, value, setValue]);

  // 使用useDeferredValue延迟非关键状态更新，提升切换性能
  const deferredValue = useDeferredValue(value);
  const deferredUserAssistants = useDeferredValue(userAssistants);
  const deferredCurrentAssistant = useDeferredValue(currentAssistant);
  const deferredAssistantWithTopics = useDeferredValue(assistantWithTopics);
  const deferredCurrentTopic = useDeferredValue(currentTopic);

  // 标签页切换 - 优化版本，避免不必要的数据刷新
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    console.log(`[SidebarTabs] 标签页切换: ${value} -> ${newValue}`, {
      currentAssistant: currentAssistant?.id,
      assistantWithTopics: assistantWithTopics?.id,
      topicsCount: assistantWithTopics?.topics?.length || 0,
      topicIds: assistantWithTopics?.topicIds?.length || 0,
      currentTopic: currentTopic?.id
    });

    if (newValue === 1) { // 切换到话题标签页
      console.log('[SidebarTabs] 切换到话题标签页，话题详情:',
        assistantWithTopics?.topics?.map((t) => ({id: t.id, name: t.name})) || []);

      // 优化：只有在话题数据为空或过期时才刷新
      const hasTopics = assistantWithTopics?.topics && assistantWithTopics.topics.length > 0;
      if (!hasTopics && refreshTopics) {
        console.log('[SidebarTabs] 话题数据为空，刷新话题数据');
        refreshTopics();
      } else {
        console.log('[SidebarTabs] 话题数据已存在，跳过刷新以提升性能');
      }
    }

    if (newValue === 0) { // 切换到助手标签页
      console.log('[SidebarTabs] 切换到助手标签页');
      // 助手数据已预加载，无需刷新
    }

    // 使用startTransition标记为非紧急更新，提升性能
    startTransition(() => {
      setValue(newValue);
    });
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={value}
              onChange={handleChange}
              aria-label="sidebar tabs"
              variant={hasExtraTabs ? "scrollable" : "fullWidth"}
              scrollButtons={hasExtraTabs ? false : "auto"}
              sx={{
                minHeight: hasExtraTabs ? '50px' : '48px',
                margin: hasExtraTabs ? '0' : '0 10px',
                padding: hasExtraTabs ? '8px 2px' : '10px 0',
                '& .MuiTabs-indicator': {
                  display: 'none',
                },
                ...(hasExtraTabs ? {
                  '& .MuiTabs-flexContainer': {
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1px',
                    width: '100%',
                  },
                } : {}),
                '& .MuiTab-root': {
                  ...(hasExtraTabs ? {
                    flex: 1,
                    minWidth: 0,
                    minHeight: '42px',
                    padding: '3px 1px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                  } : {
                    minHeight: '32px',
                    borderRadius: '8px',
                    '& .MuiTab-iconWrapper': {
                      marginBottom: '2px',
                    },
                  }),
                  transition: 'none',
                  '&.Mui-selected': {
                    backgroundColor: 'var(--theme-selected-color)',
                  },
                  '&:hover': {
                    backgroundColor: 'var(--theme-hover-color)',
                  },
                },
              }}
            >
              <Tab
                icon={<Bot size={hasExtraTabs ? 14 : 18} />}
                label="助手"
                {...a11yProps(0)}
                sx={{
                  ...(hasExtraTabs ? {
                    flex: 1,
                    minHeight: '42px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    padding: '3px 1px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                  } : {
                    minHeight: '32px',
                    borderRadius: '8px',
                    '& .MuiTab-iconWrapper': {
                      marginBottom: '2px',
                    },
                  }),
                  color: 'var(--theme-text-primary)',
                  fontWeight: '500',
                  '&.Mui-selected': {
                    color: 'var(--theme-text-primary)',
                  },
                  '&:hover': {
                    color: 'var(--theme-text-primary)',
                  },
                }}
              />
              <Tab
                icon={<MessageSquare size={hasExtraTabs ? 14 : 18} />}
                label="话题"
                {...a11yProps(1)}
                sx={{
                  ...(hasExtraTabs ? {
                    flex: 1,
                    minHeight: '42px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    padding: '3px 1px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                  } : {
                    minHeight: '32px',
                    borderRadius: '8px',
                    '& .MuiTab-iconWrapper': {
                      marginBottom: '2px',
                    },
                  }),
                  color: 'var(--theme-text-primary)',
                  fontWeight: '500',
                  '&.Mui-selected': {
                    color: 'var(--theme-text-primary)',
                  },
                  '&:hover': {
                    color: 'var(--theme-text-primary)',
                  },
                }}
              />
              {showWorkspaceTab && (
                <Tab
                  icon={<FolderOpen size={14} />}
                  label="工作区"
                  {...a11yProps(2)}
                  sx={{
                    flex: 1,
                    minHeight: '42px',
                    borderRadius: '4px',
                    color: 'var(--theme-text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    padding: '3px 1px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                    '&.Mui-selected': {
                      color: 'var(--theme-text-primary)',
                    },
                    '&:hover': {
                      color: 'var(--theme-text-primary)',
                    },
                  }}
                />
              )}
              {showNoteTab && (
                <Tab
                  icon={<FileText size={14} />}
                  label="笔记"
                  {...a11yProps(2 + (showWorkspaceTab ? 1 : 0))}
                  sx={{
                    flex: 1,
                    minHeight: '42px',
                    borderRadius: '4px',
                    color: 'var(--theme-text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    padding: '3px 1px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                    '&.Mui-selected': {
                      color: 'var(--theme-text-primary)',
                    },
                    '&:hover': {
                      color: 'var(--theme-text-primary)',
                    },
                  }}
                />
              )}
              <Tab
                icon={<Settings size={hasExtraTabs ? 14 : 18} />}
                label="设置"
                {...a11yProps(2 + extraTabCount)}
                sx={{
                  ...(hasExtraTabs ? {
                    flex: 1,
                    minHeight: '42px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    padding: '3px 1px',
                    '& .MuiTab-iconWrapper': {
                      margin: '0 auto 1px auto',
                      display: 'block',
                    },
                  } : {
                    minHeight: '32px',
                    borderRadius: '8px',
                    '& .MuiTab-iconWrapper': {
                      marginBottom: '2px',
                    },
                  }),
                  color: 'var(--theme-text-primary)',
                  fontWeight: '500',
                  '&.Mui-selected': {
                    color: 'var(--theme-text-primary)',
                  },
                  '&:hover': {
                    color: 'var(--theme-text-primary)',
                  },
                }}
              />
            </Tabs>
          </Box>

          {/* 修复：保持所有TabPanel挂载，只通过TabPanel内部的display控制显示 */}
          <TabPanel value={deferredValue} index={0}>
            <AssistantTab
              userAssistants={deferredUserAssistants}
              currentAssistant={deferredCurrentAssistant}
              onSelectAssistant={handleSelectAssistant}
              onAddAssistant={handleAddAssistant}
              onUpdateAssistant={handleUpdateAssistant}
              onDeleteAssistant={handleDeleteAssistant}
            />
          </TabPanel>

          <TabPanel value={deferredValue} index={1}>
            {/* 直接渲染组件，与最佳实例保持一致 */}
            <TopicTab
              key={deferredAssistantWithTopics?.id || deferredCurrentAssistant?.id || 'no-assistant'}
              currentAssistant={deferredAssistantWithTopics || deferredCurrentAssistant}
              currentTopic={deferredCurrentTopic}
              onSelectTopic={handleSelectTopic}
              onCreateTopic={handleCreateTopic}
              onDeleteTopic={handleDeleteTopic}
              onUpdateTopic={handleUpdateTopic}
            />
          </TabPanel>

          {showWorkspaceTab && (
            <TabPanel value={deferredValue} index={2}>
              <WorkspaceTab />
            </TabPanel>
          )}

          {showNoteTab && (
            <TabPanel value={deferredValue} index={2 + (showWorkspaceTab ? 1 : 0)}>
              <NoteTab />
            </TabPanel>
          )}

          <TabPanel value={deferredValue} index={2 + extraTabCount}>
            <SettingsTab
              settings={settingsArray}
              onSettingChange={handleSettingChange}
              modelId={currentModelBaseId}
              initialContextLength={settings.contextLength}
              onContextLengthChange={handleContextLengthChange}
              initialContextCount={settings.contextCount}
              onContextCountChange={handleContextCountChange}
              initialMathRenderer={settings.mathRenderer}
              onMathRendererChange={handleMathRendererChange}
              initialThinkingEffort={settings.defaultThinkingEffort}
              onThinkingEffortChange={(value: string) => handleThinkingEffortChange(value as any)}
              mcpMode={mcpMode}
              toolsEnabled={toolsEnabled}
              onMCPModeChange={handleMCPModeChange}
              onToolsToggle={handleToolsToggle}
            />
          </TabPanel>

          {/* 翻译按钮 - 仅在助手tab和话题tab时显示 */}
          {(deferredValue === 0 || deferredValue === 1) && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                pt: 1,
                pb: 'calc(var(--safe-area-bottom-computed, 0px) + 8px)',
                mt: 'auto',
              }}
            >
              <Tooltip title="翻译" placement="top">
                <IconButton
                  onClick={() => {
                    navigate('/translate');
                  }}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    backgroundColor: 'var(--theme-hover-color)',
                    color: 'var(--theme-text-primary)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'var(--theme-selected-color)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Languages size={22} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  );
});

export default SidebarTabsContent;
