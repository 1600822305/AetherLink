# Phase 6: 状态管理优化

> 预计工时：2-3天
> 前置依赖：Phase 5 (供应商迁移)
> 参考文件：`cherry-studio-main/src/renderer/src/store/llm.ts`

## 🎯 目标

1. 优化Provider状态管理
2. 集成到现有Redux Store
3. 实现Provider CRUD操作
4. 添加持久化支持

## 📁 需要创建/修改的文件

```
src/shared/
├── store/
│   ├── slices/
│   │   └── providersSlice.ts   # Provider状态切片
│   └── index.ts                 # 更新导出
│
└── aiCore/
    └── hooks/
        ├── useProvider.ts       # Provider Hook
        └── useProviderApi.ts    # Provider API Hook
```

## 📝 详细实现

### 6.1 Provider状态切片 (`store/slices/providersSlice.ts`)

```typescript
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Provider, SystemProvider } from '@/shared/aiCore/types';
import { getSystemProviders, SYSTEM_PROVIDERS_CONFIG } from '@/shared/aiCore/provider/configs/system-providers';

/**
 * Provider状态接口
 */
export interface ProvidersState {
  /** 所有Provider列表 */
  providers: Provider[];
  /** 默认Provider ID */
  defaultProviderId: string | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** Provider特定设置 */
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

/**
 * 初始状态
 */
const initialState: ProvidersState = {
  providers: getSystemProviders(),
  defaultProviderId: null,
  loading: false,
  error: null,
  providerSettings: {
    ollama: {
      keepAliveTime: 0,
    },
  },
};

/**
 * 异步操作：获取Provider模型列表
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

      // 动态导入API模块
      const { fetchModels } = await import('@/shared/services/ProviderFactory');
      const models = await fetchModels(provider);
      
      return { providerId, models };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

/**
 * 异步操作：测试Provider连接
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

      const { testConnection } = await import('@/shared/services/ProviderFactory');
      const result = await testConnection(provider as any);
      
      return { providerId, success: result };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

/**
 * Provider状态切片
 */
const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    /**
     * 添加Provider
     */
    addProvider: (state, action: PayloadAction<Provider>) => {
      // 检查是否已存在
      const existingIndex = state.providers.findIndex(p => p.id === action.payload.id);
      if (existingIndex === -1) {
        state.providers.unshift(action.payload);
      } else {
        console.warn(`Provider ${action.payload.id} already exists`);
      }
    },

    /**
     * 更新Provider
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
     * 删除Provider
     */
    removeProvider: (state, action: PayloadAction<string>) => {
      // 不能删除系统Provider
      const provider = state.providers.find(p => p.id === action.payload);
      if (provider?.isSystem) {
        console.warn(`Cannot remove system provider: ${action.payload}`);
        return;
      }
      state.providers = state.providers.filter(p => p.id !== action.payload);
    },

    /**
     * 启用/禁用Provider
     */
    toggleProvider: (state, action: PayloadAction<string>) => {
      const provider = state.providers.find(p => p.id === action.payload);
      if (provider) {
        provider.enabled = !provider.enabled;
      }
    },

    /**
     * 设置默认Provider
     */
    setDefaultProvider: (state, action: PayloadAction<string>) => {
      state.defaultProviderId = action.payload;
    },

    /**
     * 更新Provider模型列表
     */
    updateProviderModels: (state, action: PayloadAction<{ providerId: string; models: any[] }>) => {
      const provider = state.providers.find(p => p.id === action.payload.providerId);
      if (provider) {
        provider.models = action.payload.models;
        provider.enabled = true; // 有模型后自动启用
      }
    },

    /**
     * 添加模型到Provider
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
     * 从Provider移除模型
     */
    removeModelFromProvider: (state, action: PayloadAction<{ providerId: string; modelId: string }>) => {
      const provider = state.providers.find(p => p.id === action.payload.providerId);
      if (provider) {
        provider.models = provider.models.filter(m => m.id !== action.payload.modelId);
      }
    },

    /**
     * 移动Provider顺序
     */
    moveProvider: (state, action: PayloadAction<{ providerId: string; newIndex: number }>) => {
      const currentIndex = state.providers.findIndex(p => p.id === action.payload.providerId);
      if (currentIndex !== -1) {
        const [provider] = state.providers.splice(currentIndex, 1);
        state.providers.splice(action.payload.newIndex, 0, provider);
      }
    },

    /**
     * 重置为系统Provider
     */
    resetToSystemProviders: (state) => {
      state.providers = getSystemProviders();
      state.defaultProviderId = null;
      state.error = null;
    },

    /**
     * 批量更新Providers
     */
    setProviders: (state, action: PayloadAction<Provider[]>) => {
      state.providers = action.payload;
    },

    /**
     * 更新Ollama设置
     */
    setOllamaKeepAliveTime: (state, action: PayloadAction<number>) => {
      state.providerSettings.ollama = {
        ...state.providerSettings.ollama,
        keepAliveTime: action.payload,
      };
    },

    /**
     * 更新VertexAI设置
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

// 导出actions
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

// 导出reducer
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
```

### 6.2 Provider Hooks (`aiCore/hooks/useProvider.ts`)

```typescript
import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { Provider } from '../types';
import {
  selectAllProviders,
  selectEnabledProviders,
  selectProviderById,
  selectDefaultProvider,
  selectProvidersLoading,
  selectProvidersError,
  addProvider,
  updateProvider,
  removeProvider,
  toggleProvider,
  setDefaultProvider,
  fetchProviderModels,
  testProviderConnection,
} from '@/shared/store/slices/providersSlice';

/**
 * Provider状态Hook
 */
export function useProviders() {
  const dispatch = useDispatch();
  
  const providers = useSelector(selectAllProviders);
  const enabledProviders = useSelector(selectEnabledProviders);
  const defaultProvider = useSelector(selectDefaultProvider);
  const loading = useSelector(selectProvidersLoading);
  const error = useSelector(selectProvidersError);

  const actions = useMemo(() => ({
    add: (provider: Provider) => dispatch(addProvider(provider)),
    update: (provider: Partial<Provider> & { id: string }) => dispatch(updateProvider(provider)),
    remove: (id: string) => dispatch(removeProvider(id)),
    toggle: (id: string) => dispatch(toggleProvider(id)),
    setDefault: (id: string) => dispatch(setDefaultProvider(id)),
    fetchModels: (id: string) => dispatch(fetchProviderModels(id) as any),
    testConnection: (id: string) => dispatch(testProviderConnection(id) as any),
  }), [dispatch]);

  return {
    providers,
    enabledProviders,
    defaultProvider,
    loading,
    error,
    ...actions,
  };
}

/**
 * 单个Provider Hook
 */
export function useProvider(providerId: string) {
  const dispatch = useDispatch();
  
  const provider = useSelector((state: any) => selectProviderById(state, providerId));
  const loading = useSelector(selectProvidersLoading);

  const update = useCallback((changes: Partial<Provider>) => {
    dispatch(updateProvider({ id: providerId, ...changes }));
  }, [dispatch, providerId]);

  const toggle = useCallback(() => {
    dispatch(toggleProvider(providerId));
  }, [dispatch, providerId]);

  const fetchModels = useCallback(() => {
    return dispatch(fetchProviderModels(providerId) as any);
  }, [dispatch, providerId]);

  const testConnection = useCallback(() => {
    return dispatch(testProviderConnection(providerId) as any);
  }, [dispatch, providerId]);

  return {
    provider,
    loading,
    update,
    toggle,
    fetchModels,
    testConnection,
  };
}

/**
 * Provider API Hook
 */
export function useProviderApi(providerId?: string) {
  const { defaultProvider } = useProviders();
  const targetProvider = useSelector((state: any) => 
    providerId ? selectProviderById(state, providerId) : null
  ) || defaultProvider;

  const getClient = useCallback(async () => {
    if (!targetProvider) {
      throw new Error('No provider available');
    }
    
    const { ApiClientFactory, initializeDefaultClients } = await import('../clients/factory');
    await initializeDefaultClients();
    
    return ApiClientFactory.create(targetProvider);
  }, [targetProvider]);

  return {
    provider: targetProvider,
    getClient,
  };
}
```

### 6.3 更新Store导出 (`store/index.ts`)

```typescript
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// 导入所有slice
import providersReducer from './slices/providersSlice';
// ... 其他现有的reducer

// 持久化配置
const providersPersistConfig = {
  key: 'providers',
  storage,
  whitelist: ['providers', 'defaultProviderId', 'providerSettings'],
};

// 组合reducer
const rootReducer = combineReducers({
  providers: persistReducer(providersPersistConfig, providersReducer),
  // ... 其他现有的reducer
});

// 创建store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

// 导出类型
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// 导出selectors和actions
export * from './slices/providersSlice';
```

## ✅ 完成标准

1. [ ] Provider Redux Slice完成
2. [ ] 所有CRUD操作可用
3. [ ] 异步操作（获取模型、测试连接）可用
4. [ ] Hooks封装完成
5. [ ] 持久化配置完成
6. [ ] 与现有Store集成

## 🧪 测试用例

```typescript
// tests/store/providersSlice.test.ts
import { configureStore } from '@reduxjs/toolkit';
import providersReducer, {
  addProvider,
  updateProvider,
  removeProvider,
  toggleProvider,
} from '@/shared/store/slices/providersSlice';

describe('providersSlice', () => {
  const createTestStore = () => configureStore({
    reducer: { providers: providersReducer },
  });

  test('should add provider', () => {
    const store = createTestStore();
    const provider = {
      id: 'test',
      type: 'openai' as const,
      name: 'Test',
      apiKey: 'key',
      apiHost: 'https://test.com',
      models: [],
    };
    
    store.dispatch(addProvider(provider));
    
    const state = store.getState();
    expect(state.providers.providers.find(p => p.id === 'test')).toBeDefined();
  });

  test('should toggle provider', () => {
    const store = createTestStore();
    store.dispatch(toggleProvider('openai'));
    
    const state = store.getState();
    const provider = state.providers.providers.find(p => p.id === 'openai');
    expect(provider?.enabled).toBe(true);
  });
});
```

## 📊 最终架构总结

```
重构后的完整架构:

src/shared/
├── aiCore/                     # AI核心模块
│   ├── types/                  # 类型定义 (Phase 1)
│   ├── clients/                # 客户端实现 (Phase 2, 5)
│   │   ├── base/
│   │   ├── openai/
│   │   ├── gemini/
│   │   ├── anthropic/
│   │   └── factory.ts          # 工厂 (Phase 3)
│   ├── middleware/             # 中间件系统 (Phase 4)
│   ├── provider/               # Provider配置 (Phase 5)
│   └── hooks/                  # React Hooks (Phase 6)
│
├── store/
│   └── slices/
│       └── providersSlice.ts   # 状态管理 (Phase 6)
│
└── api/                        # 旧API（逐步废弃）
```

## 🎉 完成后的收益

1. **代码复用** - 通用逻辑集中在基类和中间件
2. **易于扩展** - 新增供应商只需实现客户端类
3. **类型安全** - 完整的TypeScript类型覆盖
4. **可测试性** - 各组件独立，便于单元测试
5. **可维护性** - 职责清晰，代码结构清晰
