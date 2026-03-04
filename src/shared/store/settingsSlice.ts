import { createSlice } from '@reduxjs/toolkit';
import type { Model } from '../types';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { GeneratedImage } from '../types';
import type { ModelProvider } from '../config/defaultModels';
import { findModelInProviders, getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../utils/modelUtils';

// 从子模块导入
export type { SettingsState } from './settings/types';
import type { SettingsState } from './settings/types';
import { ensureModelIdentityKey, setDefaultFlags, canonicalModelKey, createSetter } from './settings/helpers';
import { DEFAULT_HAPTIC_FEEDBACK, DEFAULT_CONTEXT_CONDENSE, DEFAULT_TOOLBAR_BUTTONS, getInitialState } from './settings/defaults';

const initialState = getInitialState();

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: createSetter('theme'),
    setThemeStyle: createSetter('themeStyle'),
    setFontSize: createSetter('fontSize'),
    setFontFamily: createSetter('fontFamily'),
    setLanguage: createSetter('language'),
    setSendWithEnter: createSetter('sendWithEnter'),
    setEnableNotifications: createSetter('enableNotifications'),
    setMobileInputMethodEnterAsNewline: createSetter('mobileInputMethodEnterAsNewline'),
    addModel: (state, action: PayloadAction<Model>) => {
        state.models.push(action.payload);
    },
    updateModel: (state, action: PayloadAction<{ id: string; updates: Partial<Model> }>) => {
      const { id, updates } = action.payload;
      const identity = parseModelIdentityKey(id);
      
      if (identity) {
        const modelIndex = state.models.findIndex(model => 
          modelMatchesIdentity(model, identity, model.provider)
        );
        if (modelIndex !== -1) {
          state.models[modelIndex] = { ...state.models[modelIndex], ...updates };
        }
      }
    },
    deleteModel: (state, action: PayloadAction<string>) => {
      const modelId = action.payload;
      const identity = parseModelIdentityKey(modelId);

      if (identity) {
        // 从全局models数组中删除模型
        state.models = state.models.filter(model => 
          !modelMatchesIdentity(model, identity, model.provider)
        );

        // 从所有provider的models数组中删除模型
        state.providers.forEach((provider: ModelProvider, index: number) => {
          state.providers[index].models = provider.models.filter((model: Model) => 
            !modelMatchesIdentity(model, identity, provider.id)
          );
        });
      }

      // 校验默认模型是否仍然存在
      const defaultMatch = findModelInProviders(state.providers, state.defaultModelId, { includeDisabled: true });
      if (defaultMatch) {
        state.defaultModelId = canonicalModelKey(defaultMatch.model, defaultMatch.provider.id);
        setDefaultFlags(state.providers, state.defaultModelId);
      } else {
        const replacement = state.providers
          .flatMap((provider: ModelProvider) => provider.models.map(model => ({ model, provider })))
          .find(({ model }) => model.enabled);

        if (replacement) {
          state.defaultModelId = canonicalModelKey(replacement.model, replacement.provider.id);
          setDefaultFlags(state.providers, state.defaultModelId);
        } else {
          state.defaultModelId = undefined;
        }
      }

      // 如果删除的是当前选中的模型，需要重新设置当前模型
      if (!findModelInProviders(state.providers, state.currentModelId, { includeDisabled: true })) {
        state.currentModelId = state.defaultModelId;
      }
    },
    setDefaultModel: (state, action: PayloadAction<string>) => {
      const identity = parseModelIdentityKey(action.payload);
      state.models.forEach(model => {
        model.isDefault = modelMatchesIdentity(model, identity);
      });
      setDefaultFlags(state.providers, action.payload);
      state.defaultModelId = identity ? getModelIdentityKey(identity) : action.payload;
    },
    setCurrentModel: (state, action: PayloadAction<string>) => {
      state.currentModelId = ensureModelIdentityKey(action.payload, state.providers) || action.payload;
    },
    addProvider: (state, action: PayloadAction<ModelProvider>) => {
      state.providers.push(action.payload);
    },
    updateProvider: (state, action: PayloadAction<{ id: string; updates: Partial<ModelProvider> }>) => {
      const { id, updates } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === id);
      if (providerIndex !== -1) {
        state.providers[providerIndex] = { ...state.providers[providerIndex], ...updates };

        // 如果apiKey、baseUrl、extraHeaders、extraBody、apiKeys、useCorsPlugin或providerType更新了，也要更新所有关联模型
        if (updates.apiKey !== undefined || updates.baseUrl !== undefined || updates.extraHeaders !== undefined || updates.extraBody !== undefined || updates.apiKeys !== undefined || updates.useCorsPlugin !== undefined || updates.providerType !== undefined) {
          state.providers[providerIndex].models = state.providers[providerIndex].models.map((model: Model) => ({
            ...model,
            apiKey: updates.apiKey !== undefined ? updates.apiKey : model.apiKey,
            baseUrl: updates.baseUrl !== undefined ? updates.baseUrl : model.baseUrl,
            providerExtraHeaders: updates.extraHeaders !== undefined ? updates.extraHeaders : model.providerExtraHeaders,
            providerExtraBody: updates.extraBody !== undefined ? updates.extraBody : model.providerExtraBody,
            useCorsPlugin: updates.useCorsPlugin !== undefined ? updates.useCorsPlugin : model.useCorsPlugin,
            providerType: updates.providerType !== undefined ? updates.providerType : model.providerType
          }));
        }
      }
    },
    deleteProvider: (state, action: PayloadAction<string>) => {
      state.providers = state.providers.filter((provider: ModelProvider) => provider.id !== action.payload);
    },
    reorderProviders: (state, action: PayloadAction<ModelProvider[]>) => {
      state.providers = action.payload;
    },
    toggleProviderEnabled: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
      const { id, enabled } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === id);
      if (providerIndex !== -1) {
        state.providers[providerIndex].isEnabled = enabled;
      }
    },
    addModelToProvider: (state, action: PayloadAction<{ providerId: string; model: Model }>) => {
      const { providerId, model } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);
      if (providerIndex !== -1) {
        const provider = state.providers[providerIndex];
        state.providers[providerIndex].models.push({
          ...model,
          provider: providerId,
          providerType: provider.providerType || providerId,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl
        });
      }
    },
    setProviderDefaultModel: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const { providerId, modelId } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);
      if (providerIndex !== -1) {
        const identity = parseModelIdentityKey(modelId);
        state.providers[providerIndex].models.forEach((model: Model) => {
          model.isDefault = modelMatchesIdentity(model, identity, providerId);
        });
      }
    },
    deleteModelFromProvider: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const { providerId, modelId } = action.payload;
      const providerIndex = state.providers.findIndex((provider: ModelProvider) => provider.id === providerId);

      if (providerIndex !== -1) {
        // 从provider的models数组中删除模型
        state.providers[providerIndex].models = state.providers[providerIndex].models.filter(
          (model: Model) => model.id !== modelId
        );

        const defaultMatch = findModelInProviders(state.providers, state.defaultModelId, { includeDisabled: true });
        if (defaultMatch) {
          state.defaultModelId = canonicalModelKey(defaultMatch.model, defaultMatch.provider.id);
          setDefaultFlags(state.providers, state.defaultModelId);
        } else {
          const replacement = state.providers
            .flatMap((provider: ModelProvider) => provider.models.map(model => ({ model, provider })))
            .find(({ model }) => model.enabled);

          if (replacement) {
            state.defaultModelId = canonicalModelKey(replacement.model, replacement.provider.id);
            setDefaultFlags(state.providers, state.defaultModelId);
          } else {
            state.defaultModelId = undefined;
          }
        }

        if (!findModelInProviders(state.providers, state.currentModelId, { includeDisabled: true })) {
          state.currentModelId = state.defaultModelId;
        }
      }
    },
    addGeneratedImage: (state, action: PayloadAction<GeneratedImage>) => {
      // 初始化generatedImages数组（如果不存在）
      if (!state.generatedImages) {
        state.generatedImages = [];
      }

      // 添加新生成的图像
      state.generatedImages.unshift(action.payload);

      // 限制保存的历史图像数量（保存最近的50张）
      if (state.generatedImages.length > 50) {
        state.generatedImages = state.generatedImages.slice(0, 50);
      }
    },
    deleteGeneratedImage: (state, action: PayloadAction<string>) => {
      // 如果generatedImages不存在，直接返回
      if (!state.generatedImages) {
        return;
      }

      // 根据图像URL删除
      state.generatedImages = state.generatedImages.filter(
        image => image.url !== action.payload
      );
    },
    clearGeneratedImages: (state) => {
      state.generatedImages = [];
    },
    updateSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      const updates: Partial<SettingsState> = { ...action.payload };

      if (updates.defaultModelId !== undefined) {
        updates.defaultModelId = ensureModelIdentityKey(updates.defaultModelId, state.providers);
        setDefaultFlags(state.providers, updates.defaultModelId);
      }

      if (updates.currentModelId !== undefined) {
        updates.currentModelId = ensureModelIdentityKey(updates.currentModelId, state.providers);
      }

      if (updates.topicNamingModelId !== undefined) {
        updates.topicNamingModelId = ensureModelIdentityKey(updates.topicNamingModelId, state.providers);
      }

      // 🔥 修复损坏的 topToolbar 设置
      if (updates.topToolbar) {
        const validModelSelectorDisplayStyles = ['icon', 'text'] as const;
        const displayStyle = updates.topToolbar.modelSelectorDisplayStyle;
        if (displayStyle !== undefined && !validModelSelectorDisplayStyles.includes(displayStyle as any)) {
          console.warn(`[settingsSlice] 修复无效的 modelSelectorDisplayStyle: "${displayStyle}", 重置为 "icon"`);
          updates.topToolbar = {
            ...updates.topToolbar,
            modelSelectorDisplayStyle: 'icon'
          };
        }
        
        const validModelSelectorStyles = ['dialog', 'dropdown'] as const;
        const selectorStyle = updates.topToolbar.modelSelectorStyle;
        if (selectorStyle !== undefined && !validModelSelectorStyles.includes(selectorStyle as any)) {
          console.warn(`[settingsSlice] 修复无效的 modelSelectorStyle: "${selectorStyle}", 重置为 "dialog"`);
          updates.topToolbar = {
            ...updates.topToolbar,
            modelSelectorStyle: 'dialog'
          };
        }
      }

      // 🔥 修复损坏的全局 modelSelectorStyle 设置
      if (updates.modelSelectorStyle !== undefined) {
        const validStyles = ['dialog', 'dropdown'] as const;
        if (!validStyles.includes(updates.modelSelectorStyle as any)) {
          console.warn(`[settingsSlice] 修复无效的全局 modelSelectorStyle: "${updates.modelSelectorStyle}", 重置为 "dialog"`);
          updates.modelSelectorStyle = 'dialog';
        }
      }

      Object.assign(state, updates);
    },
    setModelSelectorStyle: createSetter('modelSelectorStyle'),

    // 更新模型组合供应商的模型列表
    updateModelComboModels: (state, action: PayloadAction<Model[]>) => {
      const comboProvider = state.providers.find((p: ModelProvider) => p.id === 'model-combo');
      if (comboProvider) {
        comboProvider.models = action.payload;
      }
    },
    // 话题命名相关的action creators
    setEnableTopicNaming: createSetter('enableTopicNaming'),
    setTopicNamingPrompt: createSetter('topicNamingPrompt'),
    setTopicNamingModelId: createSetter('topicNamingModelId'),
    setMessageStyle: createSetter('messageStyle'),
    setRenderUserInputAsMarkdown: createSetter('renderUserInputAsMarkdown'),
    setAutoScrollToBottom: createSetter('autoScrollToBottom'),
    setShowAIDebateButton: createSetter('showAIDebateButton'),
    setShowQuickPhraseButton: createSetter('showQuickPhraseButton'),

    // 代码块设置 actions
    setCodeThemeLight: createSetter('codeThemeLight'),
    setCodeThemeDark: createSetter('codeThemeDark'),
    setEditorTheme: createSetter('editorTheme'),
    setEditorZoomLevel: createSetter('editorZoomLevel'),
    setCodeEditor: createSetter('codeEditor'),
    setCodeShowLineNumbers: createSetter('codeShowLineNumbers'),
    setCodeCollapsible: createSetter('codeCollapsible'),
    setCodeWrappable: createSetter('codeWrappable'),
    setCodeDefaultCollapsed: createSetter('codeDefaultCollapsed'),
    setMermaidEnabled: createSetter('mermaidEnabled'),
    // 长文本粘贴为文件功能设置 actions
    setPasteLongTextAsFile: createSetter('pasteLongTextAsFile'),
    setPasteLongTextThreshold: createSetter('pasteLongTextThreshold'),
    // 工具栏样式设置 actions
    setToolbarStyle: createSetter('toolbarStyle'),

    // 工具栏按钮配置 actions
    setToolbarButtonOrder: (state, action: PayloadAction<string[]>) => {
      state.toolbarButtons = { ...DEFAULT_TOOLBAR_BUTTONS, ...state.toolbarButtons, order: action.payload };
    },
    setToolbarButtonVisibility: (state, action: PayloadAction<{ buttonId: string; visible: boolean }>) => {
      const { buttonId, visible } = action.payload;
      const current = state.toolbarButtons || { ...DEFAULT_TOOLBAR_BUTTONS };
      current.visibility[buttonId] = visible;
      state.toolbarButtons = current;
    },
    updateToolbarButtons: (state, action: PayloadAction<{ order: string[]; visibility: { [key: string]: boolean } }>) => {
      state.toolbarButtons = action.payload;
    },

    // 性能监控显示控制
    setShowPerformanceMonitor: createSetter('showPerformanceMonitor'),
    // 开发者工具悬浮窗显示控制
    setShowDevToolsFloatingButton: createSetter('showDevToolsFloatingButton'),
    
    // 触觉反馈设置控制（默认值 + 当前值 + 新值 三层合并）
    setHapticFeedbackEnabled: (state, action: PayloadAction<boolean>) => {
      state.hapticFeedback = { ...DEFAULT_HAPTIC_FEEDBACK, ...state.hapticFeedback, enabled: action.payload };
    },
    setHapticFeedbackOnSidebar: (state, action: PayloadAction<boolean>) => {
      state.hapticFeedback = { ...DEFAULT_HAPTIC_FEEDBACK, ...state.hapticFeedback, enableOnSidebar: action.payload };
    },
    setHapticFeedbackOnSwitch: (state, action: PayloadAction<boolean>) => {
      state.hapticFeedback = { ...DEFAULT_HAPTIC_FEEDBACK, ...state.hapticFeedback, enableOnSwitch: action.payload };
    },
    setHapticFeedbackOnListItem: (state, action: PayloadAction<boolean>) => {
      state.hapticFeedback = { ...DEFAULT_HAPTIC_FEEDBACK, ...state.hapticFeedback, enableOnListItem: action.payload };
    },
    setHapticFeedbackOnNavigation: (state, action: PayloadAction<boolean>) => {
      state.hapticFeedback = { ...DEFAULT_HAPTIC_FEEDBACK, ...state.hapticFeedback, enableOnNavigation: action.payload };
    },

    // 侧边栏 tab 索引设置
    setSidebarTabIndex: createSetter('sidebarTabIndex'),

    // 上下文压缩设置 actions（默认值 + 当前值 + 新值 三层合并）
    setContextCondenseEnabled: (state, action: PayloadAction<boolean>) => {
      state.contextCondense = { ...DEFAULT_CONTEXT_CONDENSE, ...state.contextCondense, enabled: action.payload };
    },
    setContextCondenseThreshold: (state, action: PayloadAction<number>) => {
      state.contextCondense = { ...DEFAULT_CONTEXT_CONDENSE, ...state.contextCondense, threshold: action.payload };
    },
    setContextCondenseModelId: (state, action: PayloadAction<string | undefined>) => {
      state.contextCondense = { ...DEFAULT_CONTEXT_CONDENSE, ...state.contextCondense, modelId: action.payload };
    },
    setContextCondenseCustomPrompt: (state, action: PayloadAction<string | undefined>) => {
      state.contextCondense = { ...DEFAULT_CONTEXT_CONDENSE, ...state.contextCondense, customPrompt: action.payload };
    },
    updateContextCondenseSettings: (state, action: PayloadAction<Partial<NonNullable<SettingsState['contextCondense']>>>) => {
      state.contextCondense = { ...DEFAULT_CONTEXT_CONDENSE, ...state.contextCondense, ...action.payload };
    },
  },
  extraReducers: () => {
    // redux-persist 已完全接管设置持久化，不再需要额外的加载逻辑
  }
});

// 导出操作
export const {
  setTheme,
  setThemeStyle,
  setFontSize,
  setFontFamily,
  setLanguage,
  setSendWithEnter,
  setEnableNotifications,
  setMobileInputMethodEnterAsNewline,
  addModel,
  updateModel,
  deleteModel,
  setDefaultModel,
  setCurrentModel,
  addProvider,
  updateProvider,
  deleteProvider,
  reorderProviders,
  toggleProviderEnabled,
  addModelToProvider,
  setProviderDefaultModel,
  deleteModelFromProvider,
  addGeneratedImage,
  deleteGeneratedImage,
  clearGeneratedImages,
  updateSettings,
  setModelSelectorStyle,
  updateModelComboModels,
  // 话题命名相关的actions
  setEnableTopicNaming,
  setTopicNamingPrompt,
  setTopicNamingModelId,
  // 消息样式相关的actions
  setMessageStyle,
  setRenderUserInputAsMarkdown,
  // 自动滚动控制
  setAutoScrollToBottom,
  // AI辩论按钮显示控制
  setShowAIDebateButton,
  // 快捷短语按钮显示控制
  setShowQuickPhraseButton,
  // 代码块设置控制
  setCodeThemeLight,
  setCodeThemeDark,
  setEditorTheme,
  setEditorZoomLevel,
  setCodeEditor,
  setCodeShowLineNumbers,
  setCodeCollapsible,
  setCodeWrappable,
  setCodeDefaultCollapsed,
  setMermaidEnabled,
  // 长文本粘贴为文件功能控制
  setPasteLongTextAsFile,
  setPasteLongTextThreshold,
  // 工具栏样式控制
  setToolbarStyle,
  // 工具栏按钮配置控制
  setToolbarButtonOrder,
  setToolbarButtonVisibility,
  updateToolbarButtons,
  // 性能监控控制
  setShowPerformanceMonitor,
  setShowDevToolsFloatingButton,
  // 触觉反馈控制
  setHapticFeedbackEnabled,
  setHapticFeedbackOnSidebar,
  setHapticFeedbackOnSwitch,
  setHapticFeedbackOnListItem,
  setHapticFeedbackOnNavigation,
  // 侧边栏 tab 控制
  setSidebarTabIndex,
  // 上下文压缩控制
  setContextCondenseEnabled,
  setContextCondenseThreshold,
  setContextCondenseModelId,
  setContextCondenseCustomPrompt,
  updateContextCondenseSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
