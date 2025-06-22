import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { statusBarService } from '../shared/services/StatusBarService';
import { safeAreaService } from '../shared/services/SafeAreaService';
import { DataManager } from '../shared/services';
import { DataRepairService } from '../shared/services/DataRepairService';
import { DatabaseCleanupService } from '../shared/services/storage/DatabaseCleanupService';
// import { dexieStorage } from '../shared/services/storage/DexieStorageService';
// import { loadTopicMessagesThunk } from '../shared/store/slices/newMessagesSlice';
import { initGroups } from '../shared/store/slices/groupsSlice';
import { getStorageItem } from '../shared/utils/storage';

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

      // 步骤1: 界面初始化
      setInitializationStep(isFirst ? '欢迎使用 AetherLink...' : '初始化界面...');
      setInitializationProgress(10);
      await new Promise(resolve => setTimeout(resolve, isFirst ? 300 : 100));

      if (signal.aborted) return;

      // 步骤2: 服务初始化
      setInitializationStep('配置显示设置...');
      setInitializationProgress(20);

      // 从存储中获取当前主题设置
      const savedSettings = await getStorageItem('settings') as any;
      const currentTheme = savedSettings?.theme || 'system';
      const currentThemeStyle = savedSettings?.themeStyle || 'default';

      // 确定实际的主题模式
      const actualTheme = currentTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : currentTheme as 'light' | 'dark';

      await Promise.all([
        safeAreaService.initialize(),
        statusBarService.initialize(actualTheme, currentThemeStyle)
      ]);

      if (signal.aborted) return;

      // 步骤3: 数据库准备
      setInitializationStep('准备数据库...');
      setInitializationProgress(40);

      if (DatabaseCleanupService.needsCleanup()) {
        await DatabaseCleanupService.cleanupDatabase();
      }

      if (signal.aborted) return;

      // 步骤4: 数据修复
      setInitializationStep('检查数据完整性...');
      setInitializationProgress(60);

      await DataManager.ensureDatabaseVersion();

      const hasIssues = await DataRepairService.checkDataConsistency();
      if (hasIssues) {
        await DataRepairService.repairAllData({
          fixAssistantTopicRelations: true,
          fixDuplicateMessages: true,
          fixOrphanTopics: true,
          migrateMessages: true
        });
      }

      if (signal.aborted) return;

      // 步骤5: 加载数据
      setInitializationStep('加载应用数据...');
      setInitializationProgress(80);

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

      await new Promise(resolve => setTimeout(resolve, isFirst ? 500 : 200));
      setAppInitialized(true);

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
