import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../shared/store';
import { useAppDispatch } from '../shared/store';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import { AssistantService } from '../shared/services/assistant';
import { AssistantManager } from '../shared/services/assistant/AssistantManager';
import { newMessagesActions } from '../shared/store/slices/newMessagesSlice';
import { setCurrentAssistant, setAssistants } from '../shared/store/slices/assistantsSlice';
import { initGroups } from '../shared/store/slices/groupsSlice';
import { useModelComboSync } from '../shared/hooks/useModelComboSync';
import { unifiedFileManager } from '../shared/services/files/UnifiedFileManagerService';
import { migrateTopicPreviews } from '../shared/services/topics/TopicPreviewService';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('AppInitializer');

// 全局初始化标志，防止多个组件实例同时初始化
let globalInitialized = false;

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

  // 应用初始化逻辑 - 优化版本，实现数据预加载
  useEffect(() => {
    // 🔥 防止重复初始化
    if (globalInitialized || assistants.length > 0) {
      logger.debug('已初始化或助手数据已存在，跳过初始化');
      return;
    }

    globalInitialized = true; // 立即设置标志，防止并发初始化

    const initializeApp = async () => {
      logger.debug('开始应用初始化...');

      // 确保加载分组数据
      dispatch(initGroups());

      // 🚀 性能优化：将非关键的权限检查移到后台执行，不阻塞启动流程
      Promise.resolve().then(async () => {
        try {
          logger.debug('后台检查文件管理器权限状态...');
          const permissionResult = await unifiedFileManager.checkPermissions();
          if (permissionResult.granted) {
            logger.debug('文件管理器权限已授予');
          } else {
            logger.debug('文件管理器权限未授予，用户可在工作区设置中手动授权');
          }
        } catch (error) {
          logger.error('检查文件管理器权限失败:', error);
        }
      });

      try {
        // 🔥 优化：一次性预加载所有助手和话题数据到Redux
        logger.debug('预加载所有助手和话题数据...');
        const allAssistants = await AssistantManager.getUserAssistants();

        if (allAssistants.length > 0) {
          logger.debug(`预加载了 ${allAssistants.length} 个助手，每个助手的话题已预加载`);

          // 批量更新到Redux，避免多次重渲染
          dispatch(setAssistants(allAssistants));

          // 1. 确保选中了一个助手 - 简化版本，直接从预加载的数据中获取
          if (!currentAssistant) {
            logger.debug('当前没有选中助手，从预加载数据中选择');

            // 从数据库获取当前助手ID
            const currentAssistantId = await dexieStorage.getSetting('currentAssistant');

            let selectedAssistant = null;
            if (currentAssistantId) {
              // 🔥 优化：直接从预加载的助手列表中查找，无需再次查询数据库
              selectedAssistant = allAssistants.find(a => a.id === currentAssistantId);
              if (selectedAssistant) {
                logger.debug(`从预加载数据中找到当前助手: ${selectedAssistant.name}`);
              }
            }

            // 如果没找到，选择第一个助手
            if (!selectedAssistant && allAssistants.length > 0) {
              selectedAssistant = allAssistants[0];
              logger.debug(`选择第一个助手: ${selectedAssistant.name}`);

              // 保存到数据库
              await dexieStorage.saveSetting('currentAssistant', selectedAssistant.id);
            }

            if (selectedAssistant) {
              // 🔥 优化：设置当前助手（数据已预加载，包含话题）
              dispatch(setCurrentAssistant(selectedAssistant));

              // 2. 确保选中了该助手下的一个话题
              if (!currentTopicId && selectedAssistant.topics && selectedAssistant.topics.length > 0) {
                logger.debug(`自动选择第一个话题: ${selectedAssistant.topics[0].name}`);
                dispatch(newMessagesActions.setCurrentTopicId(selectedAssistant.topics[0].id));
              }
            }
          }
        // 如果已有当前助手，检查话题选择情况
        else if (currentAssistant.topics && currentAssistant.topics.length > 0) {
          // 情况1: 没有选中话题，自动选择第一个话题
          if (!currentTopicId) {
            logger.debug(`已有当前助手但没有选中话题，自动选择第一个话题: ${currentAssistant.topics[0].name}`);
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
                  logger.debug(`话题 ${currentTopicId} 确实属于当前助手，跳过切换`);
                } else {
                  logger.debug(`当前话题 ${currentTopicId} 不属于当前助手，自动选择第一个话题: ${currentAssistant.topics[0].name}`);
                  dispatch(newMessagesActions.setCurrentTopicId(currentAssistant.topics[0].id));
                }
              } catch (error) {
                logger.error('验证话题归属时出错:', error);
                // 出错时保持当前状态，不进行切换
              }
            } else {
              // 减少重复日志输出
              // console.log(`[AppInitializer] 当前话题 ${currentTopicId} 属于当前助手，无需切换`);
            }
          }
        }
        } else {
          // 没有助手数据，创建默认助手
          logger.debug('没有助手数据，创建默认助手');
          const defaultAssistants = await AssistantService.initializeDefaultAssistants();

          if (defaultAssistants.length > 0) {
            // 🔥 修复：直接使用创建的默认助手，避免重复查询
            logger.debug(`创建了 ${defaultAssistants.length} 个默认助手`);
            dispatch(setAssistants(defaultAssistants));

            const firstAssistant = defaultAssistants[0];
            dispatch(setCurrentAssistant(firstAssistant));

            if (firstAssistant.topics && firstAssistant.topics.length > 0) {
              dispatch(newMessagesActions.setCurrentTopicId(firstAssistant.topics[0].id));
            }
          }
        }
      } catch (error) {
        logger.error('初始化过程中出错:', error);
      }
    };

    // 🔥 移除不再使用的 selectFirstAssistant 函数，逻辑已内联

    // 执行初始化；完成后在后台对历史话题做一次性预览回填（不阻塞启动）
    initializeApp().finally(() => {
      void migrateTopicPreviews();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]); // 🔥 修复：移除会导致循环的依赖项，仅在组件挂载时执行一次

  // 这是一个纯逻辑组件，不渲染任何UI
  return null;
};

export default AppInitializer;
