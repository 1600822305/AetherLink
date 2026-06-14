/**
 * 网络搜索工具消息块组件 - SolidJS 版本
 * 
 * 使用细粒度响应式系统，解决 React 版本的掉帧问题
 * 点击后弹出对话框显示搜索结果
 */
import { createSignal, createMemo, For, Show, onCleanup, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useAppState } from '../../../shared/hooks/useAppState';
import { createLogger } from '../../../shared/services/infra/logger';
import './WebSearchTool.solid.css';

const logger = createLogger('WebSearchTool');

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  content?: string;
}

export interface WebSearchToolProps {
  // Block 状态
  status: 'pending' | 'processing' | 'streaming' | 'success' | 'error';
  // 搜索结果
  results: SearchResult[];
  // 主题模式
  themeMode: 'light' | 'dark';
}

// favicon 状态缓存：存储每个 hostname 对应的最佳 favicon URL
const faviconCache = new Map<string, string>();
// 失败的 favicon URL 缓存
const failedFaviconUrls = new Set<string>();

/**
 * 获取域名的 hostname
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * 获取 favicon URL 候选列表（按优先级排序）
 * 参考 Cherry Studio 的 FallbackFavicon 实现
 */
function getFaviconUrls(hostname: string): string[] {
  return [
    `https://icon.horse/icon/${hostname}`,
    `https://favicon.splitbee.io/?url=${hostname}`,
    `https://favicon.im/${hostname}`,
    `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
    `https://${hostname}/favicon.ico`
  ];
}

/**
 * 获取最佳 favicon URL（优先使用缓存）
 */
function getBestFaviconUrl(hostname: string): string {
  if (!hostname) return '';
  
  // 如果有缓存的成功 URL，直接返回
  if (faviconCache.has(hostname)) {
    return faviconCache.get(hostname)!;
  }
  
  // 返回第一个候选 URL
  const urls = getFaviconUrls(hostname);
  return urls[0];
}

/**
 * 尝试下一个 favicon URL
 */
function getNextFaviconUrl(hostname: string, currentUrl: string): string | null {
  const urls = getFaviconUrls(hostname);
  const currentIndex = urls.indexOf(currentUrl);
  
  // 查找下一个未失败的 URL
  for (let i = currentIndex + 1; i < urls.length; i++) {
    if (!failedFaviconUrls.has(urls[i])) {
      return urls[i];
    }
  }
  
  return null;
}

/**
 * 标记 favicon URL 加载成功
 */
function markFaviconSuccess(hostname: string, url: string): void {
  faviconCache.set(hostname, url);
}

/**
 * 标记 favicon URL 加载失败
 */
function markFaviconFailed(url: string): void {
  failedFaviconUrls.add(url);
}

/**
 * 获取主机名
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Favicon 图片组件 - 支持多源回退
 */
function FaviconImage(props: { url: string; size?: number }) {
  const hostname = createMemo(() => extractHostname(props.url));
  const [currentSrc, setCurrentSrc] = createSignal('');
  const [failed, setFailed] = createSignal(false);
  
  // 初始化 src
  createEffect(() => {
    const host = hostname();
    if (host) {
      setCurrentSrc(getBestFaviconUrl(host));
      setFailed(false);
    }
  });
  
  const handleError = () => {
    const host = hostname();
    const current = currentSrc();
    
    if (host && current) {
      markFaviconFailed(current);
      const nextUrl = getNextFaviconUrl(host, current);
      
      if (nextUrl) {
        setCurrentSrc(nextUrl);
      } else {
        setFailed(true);
      }
    } else {
      setFailed(true);
    }
  };
  
  const handleLoad = () => {
    const host = hostname();
    const current = currentSrc();
    if (host && current) {
      markFaviconSuccess(host, current);
    }
  };
  
  const size = props.size || 14;
  
  return (
    <Show when={!failed() && currentSrc()} fallback={
      <svg class="solid-ws-globe" width={size - 2} height={size - 2} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M2 12h20"></path>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    }>
      <img
        src={currentSrc()}
        alt=""
        style={{ width: `${size}px`, height: `${size}px` }}
        onError={handleError}
        onLoad={handleLoad}
      />
    </Show>
  );
}

/**
 * 网络搜索工具组件
 */
export function WebSearchTool(props: WebSearchToolProps) {
  const [dialogOpen, setDialogOpen] = createSignal(false);
  
  // 计算状态
  const isSearching = createMemo(() =>
    props.status === 'processing' || props.status === 'streaming'
  );
  const isDone = createMemo(() => props.status === 'success');
  const isError = createMemo(() => props.status === 'error');
  const resultCount = createMemo(() => props.results?.length || 0);
  
  // 预览结果（最多3个）
  const previewResults = createMemo(() =>
    (props.results || []).slice(0, 3)
  );

  // 打开对话框
  const openDialog = () => {
    setDialogOpen(true);
  };
  
  // 关闭对话框
  const closeDialog = () => {
    setDialogOpen(false);
  };
  
  // 点击背景关闭对话框
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('solid-ws-dialog-backdrop')) {
      closeDialog();
    }
  };

  // 集成全局返回键处理系统
  const dialogId = 'solid-web-search-results';
  
  createEffect(() => {
    const isOpen = dialogOpen();
    const { openDialog: registerDialog, closeDialog: unregisterDialog } = useAppState.getState();
    
    if (isOpen) {
      registerDialog(dialogId, () => {
        logger.debug('通过返回键关闭');
        setDialogOpen(false);
      });
    } else {
      unregisterDialog(dialogId);
    }
    
    onCleanup(() => {
      if (isOpen) {
        unregisterDialog(dialogId);
      }
    });
  });

  return (
    <div class={`solid-web-search-tool ${props.themeMode}`}>
      {/* 搜索中状态 */}
      <Show when={isSearching()}>
        <div class="solid-ws-status searching">
          <div class="solid-ws-spinner" />
          <span class="solid-ws-status-text">正在搜索...</span>
        </div>
      </Show>

      {/* 错误状态 */}
      <Show when={isError()}>
        <div class="solid-ws-status error">
          <svg class="solid-ws-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span class="solid-ws-status-text">搜索失败</span>
        </div>
      </Show>

      {/* 完成状态 - 点击打开对话框 */}
      <Show when={isDone() && resultCount() > 0}>
        <button class="solid-ws-header" onClick={openDialog}>
          {/* 预览图标 */}
          <div class="solid-ws-favicons">
            <For each={previewResults()}>
              {(result, i) => (
                <div
                  class="solid-ws-favicon"
                  style={{
                    "margin-left": i() > 0 ? '-6px' : '0',
                    "z-index": 3 - i()
                  }}
                >
                  <FaviconImage url={result.url} size={14} />
                </div>
              )}
            </For>
          </div>
          
          <span class="solid-ws-count">{resultCount()} 个引用内容</span>
          
          <svg class="solid-ws-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </Show>

      {/* 无结果状态 */}
      <Show when={isDone() && resultCount() === 0}>
        <div class="solid-ws-status warning">
          <svg class="solid-ws-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span class="solid-ws-status-text">未找到结果</span>
        </div>
      </Show>

      {/* 默认/待处理状态 */}
      <Show when={props.status === 'pending'}>
        <div class="solid-ws-status default">
          <svg class="solid-ws-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span class="solid-ws-status-text">网络搜索</span>
        </div>
      </Show>

      {/* 搜索结果对话框 */}
      <Show when={dialogOpen()}>
        <Portal>
          <div 
            class={`solid-ws-dialog-backdrop ${props.themeMode}`}
            onClick={handleBackdropClick}
          >
            <div class={`solid-ws-dialog ${props.themeMode}`}>
              {/* 对话框标题栏 */}
              <div class="solid-ws-dialog-header">
                <h2 class="solid-ws-dialog-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  搜索结果
                  <span class="solid-ws-dialog-count">({resultCount()})</span>
                </h2>
                <button 
                  class="solid-ws-dialog-close-btn"
                  onClick={closeDialog}
                  aria-label="关闭"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* 对话框内容 */}
              <div class="solid-ws-dialog-content">
                <div class="solid-ws-results">
                  <For each={props.results}>
                    {(result, index) => (
                      <a
                        class="solid-ws-result-item"
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {/* Favicon */}
                        <div class="solid-ws-result-favicon">
                          <FaviconImage url={result.url} size={14} />
                        </div>
                        
                        {/* 内容 */}
                        <div class="solid-ws-result-content">
                          <div class="solid-ws-result-title-row">
                            <span class="solid-ws-result-title">
                              {result.title || getHostname(result.url)}
                            </span>
                            <svg class="solid-ws-external" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </div>
                          <Show when={result.snippet || result.content}>
                            <p class="solid-ws-result-snippet">
                              {result.snippet || result.content}
                            </p>
                          </Show>
                        </div>
                        
                        {/* 序号 */}
                        <div class="solid-ws-result-index">
                          {index() + 1}
                        </div>
                      </a>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
}

export default WebSearchTool;