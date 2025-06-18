import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../shared/store';
import { useAppDispatch } from '../shared/store';
import { dexieStorage } from '../shared/services/DexieStorageService';
import { AssistantService } from '../shared/services/assistant';
import { newMessagesActions } from '../shared/store/slices/newMessagesSlice';
import { setCurrentAssistant } from '../shared/store/slices/assistantsSlice';
import { initGroups } from '../shared/store/slices/groupsSlice';
import { useModelComboSync } from '../shared/hooks/useModelComboSync';
import { advancedFileManagerService } from '../shared/services/AdvancedFileManagerService';

/**
 * 应用初始化组件
 * 负责处理应用启动时的初始化逻辑，包括：
 * 1. 确保选中了一个助手
 * 2. 确保选中了该助手下的一个话题
 */
const AppInitializer = () => {
  const dispatch = useAppDispatch();

  // 从Redux获取当前状态
  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);
  const currentTopicId = useSelector((state: RootState) => state.messages.currentTopicId);
  const assistants = useSelector((state: RootState) => state.assistants.assistants);

  // 使用ref来避免重复执行话题归属检查
  const lastCheckedTopicId = useRef<string | null>(null);

  // 初始化模型组合同步
  useModelComboSync();

  // 应用初始化逻辑
  useEffect(() => {
    const initializeApp = async () => {
      // 确保加载分组数据
      dispatch(initGroups());

      // 注释掉自动权限请求，改为用户主动触发
      // 检查文件管理器权限状态（不自动请求）
      try {
        console.log('[AppInitializer] 检查文件管理器权限状态...');
        const permissionResult = await advancedFileManagerService.checkPermissions();
        if (permissionResult.granted) {
          console.log('[AppInitializer] 文件管理器权限已授予');
        } else {
          console.log('[AppInitializer] 文件管理器权限未授予，用户可在工作区设置中手动授权');
        }
      } catch (error) {
        console.error('[AppInitializer] 检查文件管理器权限失败:', error);
      }

      try {
        // 1. 确保选中了一个助手
        if (!currentAssistant) {
          console.log('[AppInitializer] 当前没有选中助手，尝试获取当前助手');

          // 从数据库获取当前助手ID
          const currentAssistantId = await dexieStorage.getSetting('currentAssistant');

          if (currentAssistantId) {
            console.log(`[AppInitializer] 从数据库找到当前助手ID: ${currentAssistantId}`);

            // 获取助手详情
            const assistant = await dexieStorage.getAssistant(currentAssistantId);

            if (assistant) {
              console.log(`[AppInitializer] 找到当前助手: ${assistant.name}`);

              // 加载助手的话题
              const topicIds = assistant.topicIds || [];
              const topics = [];

              for (const topicId of topicIds) {
                const topic = await dexieStorage.getTopic(topicId);
                if (topic) {
                  topics.push(topic);
                }
              }

              // 按最后消息时间排序
              topics.sort((a, b) => {
                const timeA = new Date(a.lastMessageTime || a.updatedAt || a.createdAt || 0).getTime();
                const timeB = new Date(b.lastMessageTime || b.updatedAt || b.createdAt || 0).getTime();
                return timeB - timeA; // 降序排序，最新的在前面
              });

              // 更新助手对象，包含话题
              const assistantWithTopics = {
                ...assistant,
                topics
              };

              // 设置当前助手
              dispatch(setCurrentAssistant(assistantWithTopics));

              // 2. 确保选中了该助手下的一个话题
              if (!currentTopicId && topics.length > 0) {
                console.log(`[AppInitializer] 自动选择第一个话题: ${topics[0].name}`);
                dispatch(newMessagesActions.setCurrentTopicId(topics[0].id));
              }
            } else {
              console.log('[AppInitializer] 未找到当前助手，尝试选择第一个助手');
              selectFirstAssistant();
            }
          } else {
            console.log('[AppInitializer] 未找到当前助手ID，尝试选择第一个助手');
            selectFirstAssistant();
          }
        }
        // 如果已有当前助手，检查话题选择情况
        else if (currentAssistant.topics && currentAssistant.topics.length > 0) {
          // 情况1: 没有选中话题，自动选择第一个话题
          if (!currentTopicId) {
            console.log(`[AppInitializer] 已有当前助手但没有选中话题，自动选择第一个话题: ${currentAssistant.topics[0].name}`);
            dispatch(newMessagesActions.setCurrentTopicId(currentAssistant.topics[0].id));
          }
          // 情况2: 已选中话题，但需要验证该话题是否属于当前助手
          // 优化：只在真正需要时才进行话题归属检查，避免用户手动选择被覆盖
          else {
            // 检查当前话题是否属于当前助手
            const topicBelongsToAssistant = currentAssistant.topicIds?.includes(currentTopicId) ||
                                           currentAssistant.topics.some(topic => topic.id === currentTopicId);

            // 只有在话题确实不属于当前助手时才切换，并且添加额外的验证
            // 避免重复检查同一个话题
            if (!topicBelongsToAssistant && lastCheckedTopicId.current !== currentTopicId) {
              lastCheckedTopicId.current = currentTopicId;

              // 从数据库再次验证话题是否存在且属于当前助手
              try {
                const topicFromDB = await dexieStorage.getTopic(currentTopicId);
                if (topicFromDB && topicFromDB.assistantId === currentAssistant.id) {
                  // 话题确实属于当前助手，可能是数据同步问题，不需要切换
                  console.log(`[AppInitializer] 话题 ${currentTopicId} 确实属于当前助手，跳过切换`);
                } else {
                  console.log(`[AppInitializer] 当前话题 ${currentTopicId} 不属于当前助手，自动选择第一个话题: ${currentAssistant.topics[0].name}`);
                  dispatch(newMessagesActions.setCurrentTopicId(currentAssistant.topics[0].id));
                }
              } catch (error) {
                console.error('[AppInitializer] 验证话题归属时出错:', error);
                // 出错时保持当前状态，不进行切换
              }
            } else {
              // 减少重复日志输出
              // console.log(`[AppInitializer] 当前话题 ${currentTopicId} 属于当前助手，无需切换`);
            }
          }
        }
      } catch (error) {
        console.error('[AppInitializer] 初始化过程中出错:', error);
      }
    };

    // 选择第一个助手的辅助函数
    const selectFirstAssistant = async () => {
      try {
        if (assistants.length > 0) {
          const firstAssistant = assistants[0];
          console.log(`[AppInitializer] 选择第一个助手: ${firstAssistant.name}`);

          // 保存当前助手ID到数据库
          await dexieStorage.saveSetting('currentAssistant', firstAssistant.id);

          // 设置当前助手
          dispatch(setCurrentAssistant(firstAssistant));

          // 如果助手有话题，选择第一个话题
          if (firstAssistant.topics && firstAssistant.topics.length > 0) {
            console.log(`[AppInitializer] 自动选择第一个话题: ${firstAssistant.topics[0].name}`);
            dispatch(newMessagesActions.setCurrentTopicId(firstAssistant.topics[0].id));
          } else {
            console.log('[AppInitializer] 助手没有话题，尝试创建默认话题');

            // 创建默认话题
            const newTopic = await AssistantService.getDefaultTopic(firstAssistant.id);

            // 确保newTopic不为null
            if (newTopic) {
              await dexieStorage.saveTopic(newTopic);

              // 更新助手
              const updatedAssistant = {
                ...firstAssistant,
                topicIds: [...(firstAssistant.topicIds || []), newTopic.id],
                topics: [...(firstAssistant.topics || []), newTopic]
              };

              await dexieStorage.saveAssistant(updatedAssistant);
              dispatch(setCurrentAssistant(updatedAssistant));

              // 选择新创建的话题
              dispatch(newMessagesActions.setCurrentTopicId(newTopic.id));
            } else {
              console.error('[AppInitializer] 创建默认话题失败，返回null');
            }
          }
        } else {
          console.log('[AppInitializer] 没有可用的助手，需要创建默认助手');

          // 创建默认助手
          const defaultAssistants = await AssistantService.initializeDefaultAssistants();

          if (defaultAssistants.length > 0) {
            const firstAssistant = defaultAssistants[0];

            // 设置当前助手
            dispatch(setCurrentAssistant(firstAssistant));

            // 选择第一个话题
            if (firstAssistant.topics && firstAssistant.topics.length > 0) {
              dispatch(newMessagesActions.setCurrentTopicId(firstAssistant.topics[0].id));
            }
          }
        }
      } catch (error) {
        console.error('[AppInitializer] 选择第一个助手失败:', error);
      }
    };

    // 执行初始化
    initializeApp();
  }, [dispatch, currentAssistant, currentTopicId, assistants]);

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default AppInitializer;
