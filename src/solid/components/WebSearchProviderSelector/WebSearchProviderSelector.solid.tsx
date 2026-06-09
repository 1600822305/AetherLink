/**
 * WebSearchProviderSelector - SolidJS 版本
 * 网络搜索提供商选择器，用于快捷选择/关闭网络搜索
 * 使用原生 HTML + CSS，不依赖 Material-UI 组件库
 */
import { For, Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useAppState } from '../../../shared/hooks/useAppState';
import './WebSearchProviderSelector.solid.css';

export interface ProviderItem {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  statusLabel: string;
}

export interface WebSearchProviderSelectorSolidProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderItem[];
  /** 当前激活的提供商 ID（undefined 表示未启用搜索） */
  activeProviderId?: string;
  onSelectProvider: (providerId: string) => void;
  onDisable: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  themeMode: 'light' | 'dark';
  fullScreen: boolean;
}

export function WebSearchProviderSelectorSolid(props: WebSearchProviderSelectorSolidProps) {
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('solid-wsp-dialog-backdrop')) {
      props.onClose();
    }
  };

  // 集成全局返回键处理系统
  const dialogId = 'solid-web-search-provider-selector';

  createEffect(() => {
    const isOpen = props.open;
    const { openDialog, closeDialog } = useAppState.getState();

    if (isOpen) {
      openDialog(dialogId, () => {
        props.onClose();
      });
    } else {
      closeDialog(dialogId);
    }

    onCleanup(() => {
      if (isOpen) {
        closeDialog(dialogId);
      }
    });
  });

  const isDisableSelected = () => !props.activeProviderId;

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class={`solid-wsp-dialog-backdrop ${props.themeMode}`}
          onClick={handleBackdropClick}
        >
          <div class={`solid-wsp-dialog ${props.fullScreen ? 'fullscreen' : ''} ${props.themeMode}`}>
            {/* 标题栏 */}
            <div class="solid-wsp-dialog-header">
              <h2 class="solid-wsp-dialog-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                选择搜索提供商
                <span style="margin-left: 8px; font-size: 12px; color: #90caf9; font-weight: normal;">
                  ⚡ SolidJS
                </span>
              </h2>
              <div class="solid-wsp-header-actions">
                <button
                  class="solid-wsp-icon-btn"
                  onClick={() => props.onRefresh()}
                  title="刷新提供商列表"
                  aria-label="刷新提供商列表"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
                <button
                  class="solid-wsp-icon-btn"
                  onClick={() => props.onClose()}
                  aria-label="close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div class="solid-wsp-dialog-content">
              {/* 禁用网络搜索选项 */}
              <div
                class={`solid-wsp-item ${isDisableSelected() ? 'selected' : ''}`}
                onClick={() => props.onDisable()}
              >
                <div class="solid-wsp-item-icon muted">🚫</div>
                <div class="solid-wsp-item-info">
                  <div class="solid-wsp-item-name">不使用网络搜索</div>
                  <div class="solid-wsp-item-description">禁用网络搜索功能</div>
                </div>
                <Show when={isDisableSelected()}>
                  <span class="solid-wsp-item-check">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                </Show>
              </div>

              <div class="solid-wsp-divider" />

              <div class="solid-wsp-section-label">搜索提供商</div>

              <For each={props.providers}>
                {(provider) => {
                  const isSelected = () => props.activeProviderId === provider.id;
                  return (
                    <div
                      class={`solid-wsp-item ${isSelected() ? 'selected' : ''}`}
                      onClick={() => props.onSelectProvider(provider.id)}
                    >
                      <div class={`solid-wsp-item-icon ${provider.available ? '' : 'muted'}`}>
                        {provider.icon}
                      </div>
                      <div class="solid-wsp-item-info">
                        <div class="solid-wsp-item-name">{provider.name}</div>
                        <div class={`solid-wsp-item-description ${provider.available ? 'available' : 'unavailable'}`}>
                          {provider.available ? `✓ ${provider.statusLabel}` : `⚠️ ${provider.statusLabel}`}
                        </div>
                      </div>
                      <Show when={isSelected()}>
                        <span class="solid-wsp-item-check">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                      </Show>
                    </div>
                  );
                }}
              </For>

              <div class="solid-wsp-divider" />

              {/* 设置入口 */}
              <div class="solid-wsp-item" onClick={() => props.onOpenSettings()}>
                <div class="solid-wsp-item-icon muted">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
                <div class="solid-wsp-item-info">
                  <div class="solid-wsp-item-name">搜索设置</div>
                  <div class="solid-wsp-item-description">配置搜索提供商和选项</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default WebSearchProviderSelectorSolid;
