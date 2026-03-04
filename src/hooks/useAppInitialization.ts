import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { statusBarService } from '../shared/services/platform/StatusBarService';
import { safeAreaService } from '../shared/services/platform/SafeAreaService';
import { DataManager } from '../shared/services';
import { DataRepairService } from '../shared/services/storage/DataRepairService';
import { DatabaseCleanupService } from '../shared/services/storage/DatabaseCleanupService';
import { initGroups } from '../shared/store/slices/groupsSlice';
import store from '../shared/store';
// 🚀 性能优化：性能指标追踪
import { recordMetric } from '../utils/performanceMetrics';

export const useAppInitialization = () => {
  const [appInitialized, setAppInitialized] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(0);
  const [initializationStep, setInitializationStep] = useState('正在启动...');
  const [isFirstInstall, setIsFirstInstall] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);

  const dispatch = useDispatch();

  const initializeApp = useCallback(async (signal: AbortSignal) => {
    try {
      // 检测首次安装
      const hasLaunched = localStorage.getItem('app-has-launched');
      const isFirst = !hasLaunched;
      setIsFirstInstall(isFirst);

      if (signal.aborted) return;

      // 步骤1: 界面初始化（快速）
      setInitializationStep(isFirst ? '欢迎使用 AetherLink...' : '初始化界面...');
      setInitializationProgress(10);

      if (signal.aborted) return;

      // 步骤2: 并行初始化服务和主题
      setInitializationStep('配置显示设置...');
      setInitializationProgress(30);

      // 从 Redux store 获取主题设置并初始化服务（并行）
      await safeAreaService.initialize();

      const settingsState = store.getState().settings;
      const currentTheme = settingsState?.theme || 'system';
      const currentThemeStyle = settingsState?.themeStyle || 'default';
      const actualTheme = currentTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : currentTheme as 'light' | 'dark';

      await statusBarService.initialize(actualTheme, currentThemeStyle);

      if (signal.aborted) return;

      // 步骤3: 数据库和数据修复（并行优化）
      setInitializationStep('准备数据...');
      setInitializationProgress(60);

      // 并行执行数据库清理和版本检查
      await Promise.all([
        DatabaseCleanupService.needsCleanup() 
          ? DatabaseCleanupService.cleanupDatabase() 
          : Promise.resolve(),
        DataManager.ensureDatabaseVersion()
      ]);

      // 异步修复数据，不阻塞界面
      DataRepairService.checkDataConsistency().then(hasIssues => {
        if (hasIssues) {
          console.log('[Init] 后台执行数据修复...');
          return DataRepairService.repairAllData({
            fixAssistantTopicRelations: true,
            fixDuplicateMessages: true,
            fixOrphanTopics: true,
            migrateMessages: true
          });
        }
      }).catch(err => console.error('[Init] 数据修复失败:', err));

      if (signal.aborted) return;

      // 步骤4: 加载数据
      setInitializationStep('加载应用数据...');
      setInitializationProgress(90);

      dispatch(initGroups() as any);

      // ：消息加载由useActiveTopic Hook按需自动处理，无需批量预加载
      console.log('[useAppInitialization] ：跳过批量消息预加载，由Hook按需加载');

      if (signal.aborted) return;

      // 完成
      setInitializationStep(isFirst ? '欢迎使用 AetherLink!' : '启动完成');
      setInitializationProgress(100);

      if (isFirst) {
        localStorage.setItem('app-has-launched', 'true');
        localStorage.setItem('app-first-launch-time', Date.now().toString());
      }

      // 快速完成，不额外等待
      await new Promise(resolve => setTimeout(resolve, 100));
      setAppInitialized(true);

      // 🚀 性能优化：记录应用初始化完成时间
      if (process.env.NODE_ENV === 'development') {
        recordMetric('appInitialized');
      }

    } catch (error) {
      if (!signal.aborted) {
        console.error('应用初始化失败:', error);
        setInitError(error as Error);
      }
    }
  }, [dispatch]);

  const retryInitialization = useCallback(() => {
    setInitError(null);
    setAppInitialized(false);
    setInitializationProgress(0);
    setInitializationStep('重新启动...');
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    if (!appInitialized && !initError) {
      initializeApp(abortController.signal);
    }

    return () => {
      abortController.abort();
    };
  }, [initializeApp, appInitialized, initError]);

  return {
    appInitialized,
    initializationProgress,
    initializationStep,
    isFirstInstall,
    initError,
    retryInitialization
  };
};
