import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { WebSearchSettings, WebSearchCustomProvider, WebSearchProvider, WebSearchProviderConfig, SearchEngine } from '../../types';
import { getStorageItem, setStorageItem } from '../../utils/storage';

// 存储键名
const STORAGE_KEY = 'webSearchSettings';

// 默认提供商配置 - 包含免费和收费API服务
const getDefaultProviders = (): WebSearchProviderConfig[] => [
  {
    id: 'bing-free',
    name: 'Bing 免费搜索 (推荐)',
    apiHost: 'https://www.bing.com',
    apiKey: '', // 免费服务，无需API密钥
    url: 'https://www.bing.com/search?q=%s&ensearch=1'
  },
  {
    id: 'tavily',
    name: 'Tavily (付费)',
    apiHost: 'https://api.tavily.com',
    apiKey: ''
  },
  {
    id: 'exa',
    name: 'Exa (神经搜索)',
    apiHost: 'https://api.exa.ai',
    apiKey: ''
  },
  {
    id: 'bocha',
    name: 'Bocha (AI搜索)',
    apiHost: 'https://api.bochaai.com',
    apiKey: ''
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl (网页抓取)',
    apiHost: 'https://api.firecrawl.dev',
    apiKey: ''
  },
  {
    id: 'cloudflare-ai-search',
    name: 'Cloudflare AI Search',
    apiHost: 'https://api.cloudflare.com',
    apiKey: '',
    accountId: '',
    autoragName: ''
  }
];

// 从IndexedDB加载初始状态
const loadFromStorage = async (): Promise<WebSearchSettings> => {
  try {
    const savedSettings = await getStorageItem<WebSearchSettings>(STORAGE_KEY);
    if (savedSettings) {
      // 确保包含所有必需的字段
      return {
        ...savedSettings,
        searchWithTime: savedSettings.searchWithTime ?? false,
        excludeDomains: savedSettings.excludeDomains ?? [],
        providers: savedSettings.providers ?? getDefaultProviders(),
        // 🚀 重要：activeProviderId 是临时状态，每次启动时重置
        // 只有用户在当前会话中点击搜索按钮选择引擎后才会设置
        activeProviderId: undefined
      };
    }
  } catch (error) {
    console.error('Failed to load webSearchSettings from IndexedDB', error);
  }

  // 默认初始状态
  return {
    enabled: false,
    provider: 'bing-free', // 默认使用免费的Bing搜索
    apiKey: '',
    includeInContext: true,
    maxResults: 5,
    showTimestamp: true,
    filterSafeSearch: true,
    searchWithTime: false,
    excludeDomains: [],
    providers: getDefaultProviders(),
    customProviders: [],

    // 🚀 新增：每个提供商独立的API密钥存储
    apiKeys: {},

    // 🚀 新增：Tavily最佳实践默认设置
    searchDepth: 'basic',
    chunksPerSource: 3,
    includeRawContent: false,
    includeAnswer: false,
    minScore: 0.3,
    enableQueryValidation: true,
    enablePostProcessing: true,
    enableSmartSearch: false,
    timeRange: 'week',
    newsSearchDays: 7,

    // 🚀 新增：搜索引擎选择默认设置
    selectedSearchEngine: 'bing',

    // 🚀 新增：当前激活的搜索提供商ID（临时状态，不持久化）
    activeProviderId: undefined
  };
};

// 定义初始状态（首次加载使用默认值）
const initialState: WebSearchSettings = {
  enabled: false,
  provider: 'bing-free', // 默认使用免费的Bing搜索
  apiKey: '',
  includeInContext: true,
  maxResults: 5,
  showTimestamp: true,
  filterSafeSearch: true,
  searchWithTime: false,
  excludeDomains: [],
  providers: getDefaultProviders(),
  customProviders: [],

  // 🚀 新增：每个提供商独立的API密钥存储
  apiKeys: {},

  // 🚀 新增：Tavily最佳实践默认设置
  searchDepth: 'basic',
  chunksPerSource: 3,
  includeRawContent: false,
  includeAnswer: false,
  minScore: 0.3,
  enableQueryValidation: true,
  enablePostProcessing: true,
  enableSmartSearch: false,
  timeRange: 'week',
  newsSearchDays: 7,

  // 🚀 新增：搜索引擎选择默认设置
  selectedSearchEngine: 'bing',

  // 🚀 新增：当前激活的搜索提供商ID（仅当用户点击搜索按钮选择引擎后才设置）
  // 这个字段用于区分"设置中选择了自动模式"和"用户实际点击了搜索按钮"
  activeProviderId: undefined as string | undefined
};

// 延迟加载数据，避免循环导入
let isInitialized = false;

export const initializeWebSearchSettings = async () => {
  if (isInitialized) return;

  try {
    const settings = await loadFromStorage();
    // 这个函数会在store初始化后被调用
    return settings;
  } catch (err) {
    console.error('加载网络搜索设置失败:', err);
    return null;
  } finally {
    isInitialized = true;
  }
};

// 保存到IndexedDB的辅助函数
const saveToStorage = (state: WebSearchSettings) => {
  // 创建一个可序列化的副本，移除任何不可序列化的属性
  const serializableState: WebSearchSettings = {
    enabled: state.enabled,
    provider: state.provider,
    apiKey: state.apiKey,
    baseUrl: state.baseUrl,
    includeInContext: state.includeInContext,
    maxResults: state.maxResults,
    showTimestamp: state.showTimestamp,
    filterSafeSearch: state.filterSafeSearch,
    searchWithTime: state.searchWithTime,
    excludeDomains: [...(state.excludeDomains || [])],
    providers: state.providers.map(p => ({ ...p })),
    customProviders: (state.customProviders || []).map(p => ({ ...p })),
    contentLimit: state.contentLimit,

    // 🚀 新增：每个提供商独立的API密钥存储
    apiKeys: { ...(state.apiKeys || {}) },

    // 🚀 新增：Tavily最佳实践相关字段
    searchDepth: state.searchDepth,
    chunksPerSource: state.chunksPerSource,
    includeRawContent: state.includeRawContent,
    includeAnswer: state.includeAnswer,
    minScore: state.minScore,
    enableQueryValidation: state.enableQueryValidation,
    enablePostProcessing: state.enablePostProcessing,
    enableSmartSearch: state.enableSmartSearch,
    timeRange: state.timeRange,
    newsSearchDays: state.newsSearchDays,

    // 🚀 新增：搜索引擎选择相关字段
    selectedSearchEngine: state.selectedSearchEngine

    // 🚀 注意：activeProviderId 是临时状态，不持久化
    // 只有用户点击搜索按钮选择引擎后才设置，会话结束后清除
  };

  setStorageItem(STORAGE_KEY, serializableState).catch(error => {
    console.error('Failed to save webSearchSettings to IndexedDB', error);
  });
};

const webSearchSlice = createSlice({
  name: 'webSearch',
  initialState,
  reducers: {
    setWebSearchSettings: (_, action: PayloadAction<WebSearchSettings>) => {
      const newState = { ...action.payload };
      saveToStorage(newState);
      return newState;
    },
    toggleWebSearchEnabled: (state) => {
      state.enabled = !state.enabled;
      saveToStorage(state);
    },
    setWebSearchProvider: (state, action: PayloadAction<WebSearchProvider>) => {
      state.provider = action.payload;

      // 🚀 切换提供商时，自动加载该提供商的API密钥
      if (state.apiKeys && state.apiKeys[action.payload]) {
        state.apiKey = state.apiKeys[action.payload];
      } else {
        // 如果没有保存的API密钥，清空当前显示的密钥
        state.apiKey = '';
      }

      saveToStorage(state);
    },
    setWebSearchApiKey: (state, action: PayloadAction<string>) => {
      // 更新全局apiKey（向后兼容）
      state.apiKey = action.payload;

      // 🚀 同时更新当前提供商的独立API密钥存储
      if (!state.apiKeys) {
        state.apiKeys = {};
      }
      state.apiKeys[state.provider] = action.payload;

      // 同时更新当前选中provider的apiKey
      const currentProviderIndex = state.providers.findIndex(p => p.id === state.provider);
      if (currentProviderIndex !== -1) {
        state.providers[currentProviderIndex].apiKey = action.payload;
      }

      saveToStorage(state);
    },
    setWebSearchBaseUrl: (state, action: PayloadAction<string | undefined>) => {
      state.baseUrl = action.payload;
      saveToStorage(state);
    },
    setWebSearchMaxResults: (state, action: PayloadAction<number>) => {
      state.maxResults = action.payload;
      saveToStorage(state);
    },
    toggleIncludeInContext: (state) => {
      state.includeInContext = !state.includeInContext;
      saveToStorage(state);
    },
    toggleShowTimestamp: (state) => {
      state.showTimestamp = !state.showTimestamp;
      saveToStorage(state);
    },
    toggleFilterSafeSearch: (state) => {
      state.filterSafeSearch = !state.filterSafeSearch;
      saveToStorage(state);
    },

    // 🚀 新增：Tavily最佳实践相关actions
    setSearchDepth: (state, action: PayloadAction<'basic' | 'advanced'>) => {
      state.searchDepth = action.payload;
      saveToStorage(state);
    },
    setChunksPerSource: (state, action: PayloadAction<number>) => {
      state.chunksPerSource = action.payload;
      saveToStorage(state);
    },
    toggleIncludeRawContent: (state) => {
      state.includeRawContent = !state.includeRawContent;
      saveToStorage(state);
    },
    toggleIncludeAnswer: (state) => {
      state.includeAnswer = !state.includeAnswer;
      saveToStorage(state);
    },
    setMinScore: (state, action: PayloadAction<number>) => {
      state.minScore = action.payload;
      saveToStorage(state);
    },
    toggleQueryValidation: (state) => {
      state.enableQueryValidation = !state.enableQueryValidation;
      saveToStorage(state);
    },
    togglePostProcessing: (state) => {
      state.enablePostProcessing = !state.enablePostProcessing;
      saveToStorage(state);
    },
    toggleSmartSearch: (state) => {
      state.enableSmartSearch = !state.enableSmartSearch;
      saveToStorage(state);
    },
    setTimeRange: (state, action: PayloadAction<'day' | 'week' | 'month' | 'year'>) => {
      state.timeRange = action.payload;
      saveToStorage(state);
    },
    setNewsSearchDays: (state, action: PayloadAction<number>) => {
      state.newsSearchDays = action.payload;
      saveToStorage(state);
    },
    // 🚀 新增：搜索引擎选择相关action
    setSelectedSearchEngine: (state, action: PayloadAction<SearchEngine>) => {
      state.selectedSearchEngine = action.payload;
      saveToStorage(state);
    },
    // 🚀 新增：设置当前激活的搜索提供商ID（用户点击搜索按钮选择引擎后调用）
    setActiveProviderId: (state, action: PayloadAction<string | undefined>) => {
      state.activeProviderId = action.payload;
      // 注意：activeProviderId 是临时状态，不需要持久化到存储
    },
    addCustomProvider: (state, action: PayloadAction<WebSearchCustomProvider>) => {
      if (!state.customProviders) {
        state.customProviders = [];
      }
      state.customProviders.push(action.payload);
      saveToStorage(state);
    },
    updateCustomProvider: (state, action: PayloadAction<WebSearchCustomProvider>) => {
      if (!state.customProviders) {
        state.customProviders = [];
        state.customProviders.push(action.payload);
        saveToStorage(state);
        return;
      }

      const index = state.customProviders.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.customProviders[index] = action.payload;
      } else {
        state.customProviders.push(action.payload);
      }
      saveToStorage(state);
    },
    deleteCustomProvider: (state, action: PayloadAction<string>) => {
      if (!state.customProviders) return;
      state.customProviders = state.customProviders.filter(p => p.id !== action.payload);
      saveToStorage(state);
    },
    toggleCustomProviderEnabled: (state, action: PayloadAction<string>) => {
      if (!state.customProviders) return;

      const index = state.customProviders.findIndex(p => p.id === action.payload);
      if (index !== -1) {
        state.customProviders[index].enabled = !state.customProviders[index].enabled;
        saveToStorage(state);
      }
    },
    // 新增的action
    toggleSearchWithTime: (state) => {
      state.searchWithTime = !state.searchWithTime;
      saveToStorage(state);
    },
    setExcludeDomains: (state, action: PayloadAction<string[]>) => {
      state.excludeDomains = action.payload;
      saveToStorage(state);
    },
    addExcludeDomain: (state, action: PayloadAction<string>) => {
      if (!state.excludeDomains.includes(action.payload)) {
        state.excludeDomains.push(action.payload);
        saveToStorage(state);
      }
    },
    removeExcludeDomain: (state, action: PayloadAction<string>) => {
      state.excludeDomains = state.excludeDomains.filter(domain => domain !== action.payload);
      saveToStorage(state);
    },
    setContentLimit: (state, action: PayloadAction<number | undefined>) => {
      state.contentLimit = action.payload;
      saveToStorage(state);
    },
    updateProvider: (state, action: PayloadAction<WebSearchProviderConfig>) => {
      const index = state.providers.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.providers[index] = action.payload;
        saveToStorage(state);
      }
    },
    resetProviders: (state) => {
      state.providers = getDefaultProviders();
      saveToStorage(state);
    },
    // 🚀 强制刷新提供商列表
    refreshProviders: (state) => {
      const currentProviders = getDefaultProviders();
      // 保留用户已有的全部配置（apiKey、accountId、autoragName、basicAuth 等），仅用默认值补全缺失字段
      state.providers = currentProviders.map(newProvider => {
        const existingProvider = state.providers.find(p => p.id === newProvider.id);
        if (existingProvider) {
          return {
            ...newProvider,
            ...existingProvider,
            name: newProvider.name
          };
        }
        return newProvider;
      });
      saveToStorage(state);
    }
  }
});

export const {
  setWebSearchSettings,
  toggleWebSearchEnabled,
  setWebSearchProvider,
  setWebSearchApiKey,
  setWebSearchBaseUrl,
  setWebSearchMaxResults,
  toggleIncludeInContext,
  toggleShowTimestamp,
  toggleFilterSafeSearch,
  addCustomProvider,
  updateCustomProvider,
  deleteCustomProvider,
  toggleCustomProviderEnabled,
  toggleSearchWithTime,
  setExcludeDomains,
  addExcludeDomain,
  removeExcludeDomain,
  setContentLimit,
  updateProvider,
  resetProviders,
  refreshProviders,

  // 🚀 新增：Tavily最佳实践相关actions
  setSearchDepth,
  setChunksPerSource,
  toggleIncludeRawContent,
  toggleIncludeAnswer,
  setMinScore,
  toggleQueryValidation,
  togglePostProcessing,
  toggleSmartSearch,
  setTimeRange,
  setNewsSearchDays,

  // 🚀 新增：搜索引擎选择相关actions
  setSelectedSearchEngine,

  // 🚀 新增：激活搜索提供商相关actions
  setActiveProviderId
} = webSearchSlice.actions;

export default webSearchSlice.reducer;