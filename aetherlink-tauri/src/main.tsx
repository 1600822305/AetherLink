

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initStorageService, dexieStorage } from './shared/services/storage/storageService';
import { initializeServices } from './shared/services';
// 移除旧的系统提示词slice引用
// import { loadSystemPrompts } from './shared/store/slices/systemPromptsSlice';

// 导入 EventSource polyfill 以支持移动端 SSE
import { EventSourcePolyfill } from 'event-source-polyfill';
import { Capacitor } from '@capacitor/core';

//  保存原生fetch引用，防止被拦截器覆盖
if (typeof globalThis !== 'undefined' && globalThis.fetch) {
  (globalThis as any).__originalFetch = globalThis.fetch.bind(globalThis);
  console.log('[Fetch Backup] 原生fetch已备份');
}

// 全局替换 EventSource
if (typeof window !== 'undefined') {
  (window as any).EventSource = EventSourcePolyfill;
  console.log('[SSE Polyfill] EventSource polyfill 已加载');
}



// 显示启动画面的最小时间（毫秒）
const MIN_SPLASH_DURATION_NORMAL = 1000; // 正常启动1秒
const MIN_SPLASH_DURATION_FIRST_INSTALL = 3000; // 首次安装3秒

// 初始化系统服务
async function initializeApp() {
  const startTime = Date.now();

  try {
    console.log('[INFO] 应用初始化开始');

    // 检测是否是首次安装
    const hasLaunched = localStorage.getItem('app-has-launched');
    const isFirstTime = !hasLaunched;
    const minSplashDuration = isFirstTime ? MIN_SPLASH_DURATION_FIRST_INSTALL : MIN_SPLASH_DURATION_NORMAL;

    console.log(`[INFO] ${isFirstTime ? '首次安装' : '正常启动'}，启动画面最小显示时间: ${minSplashDuration}ms`);

    // 立即渲染应用，避免白屏
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // 在后台进行初始化
    await initializeInBackground();

    // 标记应用已启动（在初始化完成后）
    if (isFirstTime) {
      try {
        localStorage.setItem('app-has-launched', 'true');
        localStorage.setItem('app-first-launch-time', Date.now().toString());
      } catch (error) {
        console.warn('[WARN] 无法保存启动标记:', error);
      }
    }

    // 确保启动画面显示足够时间
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minSplashDuration - elapsedTime);

    if (remainingTime > 0) {
      console.log(`[INFO] 等待 ${remainingTime}ms 以确保启动画面显示足够时间`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    // 原生启动画面已禁用，无需手动隐藏
    console.log('[INFO] 原生启动画面已禁用，应用启动完成');

    console.log('[App] 应用启动完成');

  } catch (error) {
    console.error('应用初始化失败:',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error));

    // 原生启动画面已禁用，无需手动隐藏
    console.log('[WARN] 应用初始化失败，但原生启动画面已自动隐藏');

    // 显示用户友好的错误信息
    showErrorUI(error);
  }
}

// 后台初始化函数
async function initializeInBackground() {
  try {
    // 首先，确保Dexie数据库已经打开并准备就绪
    try {
      const isOpen = await dexieStorage.isOpen();
      if (!isOpen) {
        await dexieStorage.open();
      }
      console.log('数据库连接已就绪');
    } catch (dbError) {
      console.error('数据库连接初始化失败:',
        dbError instanceof Error ? dbError.message : String(dbError));
      throw new Error('数据库连接失败，无法初始化应用');
    }

    // 初始化存储服务，包括数据迁移
    await initStorageService();
    console.log('Dexie存储服务初始化成功');

    // 初始化其他服务
    await initializeServices();
    console.log('所有服务初始化完成');



    // 移动端：原生层已禁用CORS，无需代理服务
    if (Capacitor.isNativePlatform()) {
      console.log('移动端：原生层已禁用CORS，直接使用标准fetch');
    }

    console.log('[App] 后台初始化完成');
  } catch (error) {
    console.error('[ERROR] 后台初始化失败:', error);
    throw error;
  }
}

// 显示错误界面
function showErrorUI(_error: any) {
  const errorContainer = document.createElement('div');
  errorContainer.style.padding = '20px';
  errorContainer.style.maxWidth = '600px';
  errorContainer.style.margin = '50px auto';
  errorContainer.style.textAlign = 'center';
  errorContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  errorContainer.innerHTML = `
    <h2 style="color: #d32f2f;">应用启动失败</h2>
    <p>应用初始化过程中遇到问题，请尝试刷新页面或清除浏览器缓存后重试。</p>
    <button id="retry-btn" style="padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">重试</button>
  `;
  document.body.appendChild(errorContainer);

  // 添加重试按钮功能
  document.getElementById('retry-btn')?.addEventListener('click', () => {
    window.location.reload();
  });
}

// 启动应用
initializeApp();
