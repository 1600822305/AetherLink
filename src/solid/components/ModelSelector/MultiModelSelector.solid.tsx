/**
 * MultiModelSelector - SolidJS 版本
 * 多模型选择器，允许用户选择多个模型进行并行响应
 * 使用原生 HTML + CSS，不依赖 Material-UI 组件库
 */
import { createSignal, createMemo, For, Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Model } from '../../../shared/types';
import { getModelIdentityKey } from '../../../shared/utils/modelUtils';
import { getModelOrProviderIcon } from '../../../shared/utils/providerIcons';
import { useAppState } from '../../../shared/hooks/useAppState';
import { createLogger } from '../../../shared/services/infra/logger';
import './MultiModelSelector.solid.css';

const logger = createLogger('MultiModelSelector');

export interface MultiModelSelectorProps {
  open: boolean;
  onClose: () => void;
  availableModels: Model[];
  /** 选择变更回调 - 选择后立即回调 */
  onSelectionChange?: (selectedModels: Model[]) => void;
  /** 已选中的模型列表 - 用于外部控制 */
  selectedModels?: Model[];
  maxSelection?: number;
  providers: any[];
  themeMode: 'light' | 'dark';
  fullScreen: boolean;
}

// localStorage 键名
const STORAGE_KEY = 'multi_model_selector_last_selection';

// 保存选择到 localStorage
const saveSelection = (modelIds: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modelIds));
  } catch (e) {
    logger.warn('保存多模型选择失败:', e);
  }
};

// 从 localStorage 加载选择
const loadSelection = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    logger.warn('加载多模型选择失败:', e);
    return [];
  }
};

export function MultiModelSelector(props: MultiModelSelectorProps) {
  logger.debug('MultiModelSelector 已加载');

  const maxSelection = () => props.maxSelection ?? 5;
  const [internalSelectedIds, setInternalSelectedIds] = createSignal<string[]>([]);
  const [activeTab, setActiveTab] = createSignal<string>('all');
  const [lastSelection, setLastSelection] = createSignal<string[]>([]);

  // 生成唯一的模型标识符（提前定义，供 effect 使用）
  const getUniqueModelId = (model: Model): string => {
    const providerId = model.provider || (model as any).providerId || 'unknown';
    return getModelIdentityKey({ id: model.id, provider: providerId });
  };

  // 判断是否为外部控制模式
  const isControlled = () => props.selectedModels !== undefined;

  // 获取当前选中的模型 ID 列表
  const selectedModelIds = () => {
    if (isControlled()) {
      return (props.selectedModels || []).map(m => getUniqueModelId(m));
    }
    return internalSelectedIds();
  };

  // 设置选中的模型 ID 列表
  const setSelectedModelIds = (updater: string[] | ((prev: string[]) => string[])) => {
    const newIds = typeof updater === 'function' ? updater(selectedModelIds()) : updater;
    
    if (isControlled() && props.onSelectionChange) {
      // 外部控制模式：通过回调通知父组件
      const selectedModels = newIds.map(uniqueId => 
        props.availableModels.find(model => getUniqueModelId(model) === uniqueId)
      ).filter(Boolean) as Model[];
      props.onSelectionChange(selectedModels);
    } else {
      // 内部控制模式
      setInternalSelectedIds(newIds);
    }
  };

  // 初始化时加载上次选择
  createEffect(() => {
    if (props.open) {
      const saved = loadSelection();
      // 过滤掉已不存在的模型
      const validIds = saved.filter(id => 
        props.availableModels.some(m => getModelIdentityKey({ id: m.id, provider: m.provider || (m as any).providerId || 'unknown' }) === id)
      );
      setLastSelection(validIds);
    }
  });
  const [showLeftArrow, setShowLeftArrow] = createSignal(false);
  const [showRightArrow, setShowRightArrow] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [startX, setStartX] = createSignal(0);
  const [scrollLeftStart, setScrollLeftStart] = createSignal(0);
  let tabsContainerRef: HTMLDivElement | undefined;

  // 提供商名称映射
  const providerNameMap = createMemo(() => {
    const map = new Map<string, string>();
    props.providers.forEach((provider: any) => {
      map.set(provider.id, provider.name);
    });
    return map;
  });

  // 获取提供商名称
  const getProviderName = (providerId: string) => {
    return providerNameMap().get(providerId) || providerId;
  };

  // 按提供商分组的模型
  const groupedModels = createMemo(() => {
    const groups: Record<string, Model[]> = {};
    const providersMap: Record<string, { id: string; displayName: string }> = {};

    props.availableModels.forEach(model => {
      const providerId = model.provider || model.providerType || '未知';
      const displayName = getProviderName(providerId);

      if (!providersMap[providerId]) {
        providersMap[providerId] = { id: providerId, displayName };
      }

      if (!groups[providerId]) {
        groups[providerId] = [];
      }
      groups[providerId].push(model);
    });

    const providersArray = Object.values(providersMap);

    const providerOrderMap = new Map<string, number>();
    props.providers.forEach((provider: any, index: number) => {
      providerOrderMap.set(provider.id, index);
    });

    providersArray.sort((a, b) => {
      const orderA = providerOrderMap.get(a.id);
      const orderB = providerOrderMap.get(b.id);

      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return { groups, providers: providersArray };
  });

  // 当前标签页显示的模型列表
  const displayedModels = createMemo(() => {
    const tab = activeTab();
    const groups = groupedModels().groups;

    if (tab === 'all') {
      return props.availableModels;
    } else {
      return groups[tab] || [];
    }
  });

  // 处理模型选择
  const handleToggleModel = (model: Model) => {
    const uniqueId = getUniqueModelId(model);
    setSelectedModelIds(prev => {
      if (prev.includes(uniqueId)) {
        return prev.filter(id => id !== uniqueId);
      } else {
        if (prev.length >= maxSelection()) {
          return prev;
        }
        return [...prev, uniqueId];
      }
    });
  };

  // 全选
  const handleSelectAll = () => {
    const allUniqueIds = props.availableModels.slice(0, maxSelection()).map(model => getUniqueModelId(model));
    setSelectedModelIds(allUniqueIds);
  };

  // 清空选择
  const handleClearAll = () => {
    setSelectedModelIds([]);
  };

  // 快速选择上次的模型
  const handleQuickSelectLast = () => {
    const last = lastSelection();
    if (last.length > 0) {
      setSelectedModelIds(last.slice(0, maxSelection()));
    }
  };

  // 确认选择
  const handleConfirm = () => {
    const ids = selectedModelIds();
    if (ids.length > 0) {
      // 保存选择到 localStorage
      saveSelection(ids);
      // 选择已通过 onSelectionChange 同步，直接关闭
      props.onClose();
    }
  };

  // 关闭对话框
  const handleClose = () => {
    // 外部控制模式下不清空选择（由父组件管理）
    if (!isControlled()) {
      setInternalSelectedIds([]);
    }
    props.onClose();
  };

  // 检查是否需要显示滚动箭头
  const updateScrollButtons = () => {
    if (!tabsContainerRef) return;

    const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1);
  };

  // 鼠标滚轮横向滚动 - 增加滚动速度倍数
  const handleWheel = (e: WheelEvent) => {
    if (!tabsContainerRef) return;
    e.preventDefault();
    // 滚动速度倍数：3倍更丝滑
    tabsContainerRef.scrollLeft += e.deltaY * 3;
    updateScrollButtons();
  };

  // 鼠标拖拽滚动
  const handleMouseDown = (e: MouseEvent) => {
    if (!tabsContainerRef) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsContainerRef.offsetLeft);
    setScrollLeftStart(tabsContainerRef.scrollLeft);
    tabsContainerRef.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || !tabsContainerRef) return;
    e.preventDefault();
    const x = e.pageX - tabsContainerRef.offsetLeft;
    const walk = (x - startX()) * 1.5;
    tabsContainerRef.scrollLeft = scrollLeftStart() - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (tabsContainerRef) {
      tabsContainerRef.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging()) {
      setIsDragging(false);
      if (tabsContainerRef) {
        tabsContainerRef.style.cursor = 'grab';
      }
    }
  };

  // 滚动标签页
  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsContainerRef) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left'
      ? tabsContainerRef.scrollLeft - scrollAmount
      : tabsContainerRef.scrollLeft + scrollAmount;

    tabsContainerRef.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  // 监听标签页变化，更新滚动按钮
  createEffect(() => {
    groupedModels();
    setTimeout(updateScrollButtons, 0);
  });

  // 对话框关闭时重置标签页（仅内部控制模式清空选择）
  createEffect(() => {
    if (!props.open) {
      setActiveTab('all');
      // 外部控制模式下不清空选择（由父组件管理）
      if (!isControlled()) {
        setInternalSelectedIds([]);
      }
    }
  });

  // 点击背景关闭对话框
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('solid-multi-dialog-backdrop')) {
      handleClose();
    }
  };

  // 集成全局返回键处理系统
  const dialogId = 'solid-multi-model-selector';

  createEffect(() => {
    const isOpen = props.open;
    const { openDialog, closeDialog } = useAppState.getState();

    if (isOpen) {
      openDialog(dialogId, () => {
        logger.debug('通过返回键关闭');
        handleClose();
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

  // 获取已选择的模型对象
  const selectedModels = createMemo(() => {
    return selectedModelIds().map(uniqueId => {
      return props.availableModels.find(model => getUniqueModelId(model) === uniqueId);
    }).filter(Boolean) as Model[];
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class={`solid-multi-dialog-backdrop ${props.themeMode}`}
          onClick={handleBackdropClick}
        >
          <div class={`solid-multi-dialog ${props.fullScreen ? 'fullscreen' : ''} ${props.themeMode}`}>
            {/* 标题栏 */}
            <div class="solid-multi-dialog-header">
              <h2 class="solid-multi-dialog-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                  <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                </svg>
                选择多个模型
                <span style="margin-left: 8px; font-size: 12px; color: #90caf9; font-weight: normal;">
                  ⚡ SolidJS
                </span>
              </h2>
              <button
                class="solid-multi-dialog-close-btn"
                onClick={handleClose}
                aria-label="close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* 选择状态和操作按钮 */}
            <div class="solid-multi-selection-bar">
              <span class="solid-multi-selection-count">
                已选择 {selectedModelIds().length} / {maxSelection()} 个模型
              </span>
              <div class="solid-multi-action-buttons">
                <button
                  class="solid-multi-action-btn"
                  onClick={handleSelectAll}
                  disabled={props.availableModels.length === 0}
                  title="全选"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <polyline points="9 11 12 14 22 4"></polyline>
                  </svg>
                </button>
                <button
                  class="solid-multi-action-btn"
                  onClick={handleClearAll}
                  disabled={selectedModelIds().length === 0}
                  title="清空"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* 快速选择上次 */}
            <Show when={lastSelection().length > 0 && selectedModelIds().length === 0}>
              <div class="solid-multi-quick-select">
                <button
                  class="solid-multi-quick-select-btn"
                  onClick={handleQuickSelectLast}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  快速选择上次的 {lastSelection().length} 个模型
                </button>
              </div>
            </Show>

            {/* 已选择的模型标签 */}
            <Show when={selectedModels().length > 0}>
              <div class="solid-multi-selected-tags">
                <span class="solid-multi-selected-label">已选择的模型：</span>
                <div class="solid-multi-tags-container">
                  <For each={selectedModels()}>
                    {(model) => (
                      <span class="solid-multi-tag">
                        {getProviderName(model.provider || model.providerType || '未知')} / {model.name || model.id}
                        <button
                          class="solid-multi-tag-remove"
                          onClick={() => handleToggleModel(model)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </span>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* 标签页 */}
            <div class="solid-multi-tabs-wrapper">
              <Show when={showLeftArrow()}>
                <button
                  class="solid-multi-tab-scroll-button left"
                  onClick={() => scrollTabs('left')}
                  aria-label="向左滚动"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
              </Show>

              <div
                class="solid-multi-tabs-container"
                ref={tabsContainerRef}
                onScroll={updateScrollButtons}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                <div class="solid-multi-tabs">
                  <button
                    class={`solid-multi-tab ${activeTab() === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    全部
                  </button>
                  <For each={groupedModels().providers}>
                    {(provider) => (
                      <button
                        class={`solid-multi-tab ${activeTab() === provider.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(provider.id)}
                      >
                        {provider.displayName}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <Show when={showRightArrow()}>
                <button
                  class="solid-multi-tab-scroll-button right"
                  onClick={() => scrollTabs('right')}
                  aria-label="向右滚动"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </Show>
            </div>

            {/* 模型列表 */}
            <div class="solid-multi-dialog-content">
              <Show when={props.availableModels.length > 0} fallback={
                <div class="solid-multi-empty">
                  没有可用的模型
                </div>
              }>
                <div class="solid-multi-model-list">
                  <For each={displayedModels()}>
                    {(model) => {
                      const uniqueId = getUniqueModelId(model);
                      const isSelected = () => selectedModelIds().includes(uniqueId);
                      const isDisabled = () => !isSelected() && selectedModelIds().length >= maxSelection();

                      return (
                        <MultiModelItem
                          model={model}
                          isSelected={isSelected()}
                          isDisabled={isDisabled()}
                          onToggle={() => !isDisabled() && handleToggleModel(model)}
                          providerDisplayName={getProviderName(model.provider || model.providerType || '未知')}
                          isDark={props.themeMode === 'dark'}
                        />
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            {/* 底部操作栏 */}
            <div class="solid-multi-dialog-actions">
              <button class="solid-multi-btn solid-multi-btn-cancel" onClick={handleClose}>
                取消
              </button>
              <button
                class="solid-multi-btn solid-multi-btn-confirm"
                onClick={handleConfirm}
                disabled={selectedModelIds().length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                  <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                </svg>
                发送到 {selectedModelIds().length} 个模型
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

interface MultiModelItemProps {
  model: Model;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  providerDisplayName: string;
  isDark: boolean;
}

// MultiModelItem 子组件
function MultiModelItem(props: MultiModelItemProps) {
  const providerIcon = createMemo(() => {
    const modelId = props.model.id || '';
    const providerId = props.model.provider || props.model.providerType || '';
    return getModelOrProviderIcon(modelId, providerId, props.isDark);
  });

  return (
    <div
      class={`solid-multi-model-item ${props.isSelected ? 'selected' : ''} ${props.isDisabled ? 'disabled' : ''}`}
      onClick={props.onToggle}
    >
      <div class="solid-multi-checkbox">
        <input
          type="checkbox"
          checked={props.isSelected}
          disabled={props.isDisabled}
          onChange={props.onToggle}
        />
        <span class="solid-multi-checkmark"></span>
      </div>
      <div class="solid-multi-model-icon">
        <img
          src={providerIcon()}
          alt={props.providerDisplayName}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) {
              (fallback as HTMLElement).style.display = 'flex';
            }
          }}
        />
        <div class="solid-multi-model-icon-fallback" style="display: none;">
          {props.providerDisplayName[0]}
        </div>
      </div>
      <div class="solid-multi-model-info">
        <div class={`solid-multi-model-name ${props.isSelected ? 'selected' : ''}`}>
          {props.model.name || props.model.id}
        </div>
        <div class="solid-multi-model-description">
          {props.model.description || props.model.id}
        </div>
      </div>
    </div>
  );
}

export default MultiModelSelector;
