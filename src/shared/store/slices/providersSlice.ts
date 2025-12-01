/**
 * Provider 状态管理
 * 参考 Cherry Studio 的 llm.ts
 */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Provider } from '../../aiCore/types';
import { getSystemProviders } from '../../aiCore/provider/configs/system-providers';

// ==================== Types ====================

/**
 * Provider 状态接口
 */
export interface ProvidersState {
  /** 所有 Provider 列表 */
  providers: Provider[];
  /** 默认 Provider ID */
  defaultProviderId: string | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** Provider 特定设置 */
  providerSettings: {
    ollama?: {
      keepAliveTime: number;
    };
    vertexai?: {
      projectId: string;
      location: string;
      credentials: {
        privateKey: string;
        clientEmail: string;
      };
    };
  };
}

// ==================== Initial State ====================

/**
 * 从系统配置创建初始 Provider 列表
 */
function createInitialProviders(): Provider[] {
  const systemConfigs = getSystemProviders();
  return systemConfigs.map(config => ({
    id: config.id,
    type: config.type,
    name: config.name,
    apiKey: '',
    apiHost: config.defaultApiHost,
    models: [],
    isSystem: true,
    enabled: false,
  }));
}

const initialState: ProvidersState = {
  providers: createInitialProviders(),
  defaultProviderId: null,
  loading: false,
  error: null,
  providerSettings: {
    ollama: {
      keepAliveTime: 0,
    },
  },
};

// ==================== Async Thunks ====================

/**
 * 获取 Provider 模型列表
 */
export const fetchProviderModels = createAsyncThunk(
  'providers/fetchModels',
  async (providerId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { providers: ProvidersState };
      const provider = state.providers.providers.find(p => p.id === providerId);

      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      if (!provider.apiKey && provider.id !== 'ollama' && provider.id !== 'lmstudio') {
        throw new Error('API Key is required');
      }

      // 动态导入避免循环依赖
      const { ApiClientFactory, initializeDefaultClients } = await import('../../aiCore/clients');
      await initializeDefaultClients();

      const client = ApiClientFactory.create(provider);
      const models = await client.listModels();

      return {
        providerId,
        models: models.map((m: any) => ({
          id: m.id,
          name: m.id,
          enabled: true,
        })),
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

/**
 * 测试 Provider 连接
 */
export const testProviderConnection = createAsyncThunk(
  'providers/testConnection',
  async (providerId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { providers: ProvidersState };
      const provider = state.providers.providers.find(p => p.id === providerId);

      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      const { ApiClientFactory, initializeDefaultClients } = await import('../../aiCore/clients');
      await initializeDefaultClients();

      const client = ApiClientFactory.create(provider);
      await client.listModels(); // 简单测试

      return { providerId, success: true };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

// ==================== Slice ====================

const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    /**
     * 添加 Provider
     */
    addProvider: (state, action: PayloadAction<Provider>) => {
      const existingIndex = state.providers.findIndex(p => p.id === action.payload.id);
      if (existingIndex === -1) {
        state.providers.unshift(action.payload);
      } else {
        console.warn(`Provider ${action.payload.id} already exists`);
      }
    },

    /**
     * 更新 Provider
     */
    updateProvider: (state, action: PayloadAction<Partial<Provider> & { id: string }>) => {
      const index = state.providers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.providers[index] = {
          ...state.providers[index],
          ...action.payload,
        };
      }
    },

    /**
     * 删除 Provider
     */
    removeProvider: (state, action: PayloadAction<string>) => {
      const provider = state.providers.find(p => p.id === action.payload);
      if (provider?.isSystem) {
        console.warn(`Cannot remove system provider: ${action.payload}`);
        return;
      }
      state.providers = state.providers.filter(p => p.id !== action.payload);
    },

    /**
     * 启用/禁用 Provider
     */
    toggleProvider: (state, action: PayloadAction<string>) => {
      const provider = state.providers.find(p => p.id === action.payload);
      if (provider) {
        provider.enabled = !provider.enabled;
      }
    },

    /**
     * 设置默认 Provider
     */
    setDefaultProvider: (state, action: PayloadAction<string>) => {
      state.defaultProviderId = action.payload;
    },

    /**
     * 更新 Provider 模型列表
     */
    updateProviderModels: (state, action: PayloadAction<{ providerId: string; models: any[] }>) => {
      const provider = state.providers.find(p => p.id === action.payload.providerId);
      if (provider) {
        provider.models = action.payload.models;
        provider.enabled = true;
      }
    },

    /**
     * 添加模型到 Provider
     */
    addModelToProvider: (state, action: PayloadAction<{ providerId: string; model: any }>) => {
      const provider = state.providers.find(p => p.id === action.payload.providerId);
      if (provider) {
        const exists = provider.models.some(m => m.id === action.payload.model.id);
        if (!exists) {
          provider.models.push(action.payload.model);
        }
      }
    },

    /**
     * 从 Provider 移除模型
     */
    removeModelFromProvider: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const provider = state.providers.find(p => p.id === action.payload.providerId);
      if (provider) {
        provider.models = provider.models.filter(m => m.id !== action.payload.modelId);
      }
    },

    /**
     * 移动 Provider 顺序
     */
    moveProvider: (state, action: PayloadAction<{ providerId: string; newIndex: number }>) => {
      const currentIndex = state.providers.findIndex(p => p.id === action.payload.providerId);
      if (currentIndex !== -1) {
        const [provider] = state.providers.splice(currentIndex, 1);
        state.providers.splice(action.payload.newIndex, 0, provider);
      }
    },

    /**
     * 重置为系统 Provider
     */
    resetToSystemProviders: (state) => {
      state.providers = createInitialProviders();
      state.defaultProviderId = null;
      state.error = null;
    },

    /**
     * 批量更新 Providers
     */
    setProviders: (state, action: PayloadAction<Provider[]>) => {
      state.providers = action.payload;
    },

    /**
     * 更新 Ollama 设置
     */
    setOllamaKeepAliveTime: (state, action: PayloadAction<number>) => {
      state.providerSettings.ollama = {
        ...state.providerSettings.ollama,
        keepAliveTime: action.payload,
      };
    },

    /**
     * 更新 VertexAI 设置
     */
    setVertexAISettings: (state, action: PayloadAction<ProvidersState['providerSettings']['vertexai']>) => {
      state.providerSettings.vertexai = action.payload;
    },

    /**
     * 清除错误
     */
    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // 获取模型列表
    builder
      .addCase(fetchProviderModels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProviderModels.fulfilled, (state, action) => {
        state.loading = false;
        const provider = state.providers.find(p => p.id === action.payload.providerId);
        if (provider) {
          provider.models = action.payload.models;
          provider.enabled = true;
        }
      })
      .addCase(fetchProviderModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // 测试连接
    builder
      .addCase(testProviderConnection.pending, (state) => {
        state.loading = true;
      })
      .addCase(testProviderConnection.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          const provider = state.providers.find(p => p.id === action.payload.providerId);
          if (provider) {
            provider.enabled = true;
          }
        }
      })
      .addCase(testProviderConnection.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// ==================== Export Actions ====================

export const {
  addProvider,
  updateProvider,
  removeProvider,
  toggleProvider,
  setDefaultProvider,
  updateProviderModels,
  addModelToProvider,
  removeModelFromProvider,
  moveProvider,
  resetToSystemProviders,
  setProviders,
  setOllamaKeepAliveTime,
  setVertexAISettings,
  clearError,
} = providersSlice.actions;

// ==================== Export Reducer ====================

export default providersSlice.reducer;

// ==================== Selectors ====================

export const selectAllProviders = (state: { providers: ProvidersState }) =>
  state.providers.providers;

export const selectEnabledProviders = (state: { providers: ProvidersState }) =>
  state.providers.providers.filter(p => p.enabled);

export const selectSystemProviders = (state: { providers: ProvidersState }) =>
  state.providers.providers.filter(p => p.isSystem);

export const selectCustomProviders = (state: { providers: ProvidersState }) =>
  state.providers.providers.filter(p => !p.isSystem);

export const selectProviderById = (state: { providers: ProvidersState }, id: string) =>
  state.providers.providers.find(p => p.id === id);

export const selectDefaultProvider = (state: { providers: ProvidersState }) => {
  if (state.providers.defaultProviderId) {
    return state.providers.providers.find(p => p.id === state.providers.defaultProviderId);
  }
  return state.providers.providers.find(p => p.enabled);
};

export const selectProvidersLoading = (state: { providers: ProvidersState }) =>
  state.providers.loading;

export const selectProvidersError = (state: { providers: ProvidersState }) =>
  state.providers.error;
