import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { CorsBypass } from 'capacitor-cors-bypass-enhanced';
import { isTauri } from '../../utils/platformDetection';
import { testTauriProxyConnection } from '../../utils/universalFetch';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('networkProxySlice');

/**
 * 代理类型枚举
 */
export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5';

/**
 * 代理配置接口
 */
export interface ProxyConfig {
  /** 是否启用代理 */
  enabled: boolean;
  /** 代理类型 */
  type: ProxyType;
  /** 代理服务器主机名或IP */
  host: string;
  /** 代理服务器端口 */
  port: number;
  /** 代理认证用户名（可选） */
  username?: string;
  /** 代理认证密码（可选） */
  password?: string;
  /** 跳过代理的域名列表 */
  bypass?: string[];
}

/**
 * 代理测试结果
 */
export interface ProxyTestResult {
  /** 测试是否成功 */
  success: boolean;
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** 错误信息 */
  error?: string;
  /** HTTP状态码 */
  statusCode?: number;
  /** 通过代理后的外部IP */
  externalIp?: string;
}

/**
 * 代理状态信息
 */
export interface ProxyStatus {
  /** 代理是否活跃 */
  active: boolean;
  /** 当前代理配置 */
  config?: ProxyConfig;
  /** 通过代理的请求数 */
  requestCount?: number;
  /** 最后一次错误 */
  lastError?: string;
  /** 最后成功请求时间 */
  lastSuccessTime?: number;
}

/**
 * 网络代理状态
 */
interface NetworkProxyState {
  /** 全局代理配置 */
  globalProxy: ProxyConfig;
  /** 代理状态 */
  status: ProxyStatus;
  /** 是否正在测试 */
  isTesting: boolean;
  /** 最后测试结果 */
  lastTestResult?: ProxyTestResult;
  /** 是否已加载 */
  isLoaded: boolean;
}

/**
 * 默认代理配置
 */
const defaultProxyConfig: ProxyConfig = {
  enabled: false,
  type: 'http',
  host: '127.0.0.1',
  port: 8080,
  username: '',
  password: '',
  bypass: ['localhost', '127.0.0.1', '*.local'],
};

/**
 * 初始状态
 */
const initialState: NetworkProxyState = {
  globalProxy: defaultProxyConfig,
  status: {
    active: false,
    requestCount: 0,
  },
  isTesting: false,
  lastTestResult: undefined,
  isLoaded: false,
};

/**
 * 存储键名
 */
const STORAGE_KEY = 'network-proxy-settings';

/**
 * 加载代理设置
 */
export const loadNetworkProxySettings = createAsyncThunk(
  'networkProxy/load',
  async () => {
    try {
      const saved = await getStorageItem<Partial<NetworkProxyState>>(STORAGE_KEY);
      if (saved) {
        return {
          globalProxy: { ...defaultProxyConfig, ...saved.globalProxy },
          status: saved.status || initialState.status,
        };
      }
      return null;
    } catch (e) {
      logger.error('Failed to load network proxy settings:', e);
      return null;
    }
  }
);

/**
 * 保存代理设置
 */
export const saveNetworkProxySettings = createAsyncThunk(
  'networkProxy/save',
  async (state: NetworkProxyState) => {
    try {
      await setStorageItem(STORAGE_KEY, {
        globalProxy: state.globalProxy,
        status: state.status,
      });
      return true;
    } catch (e) {
      logger.error('Failed to save network proxy settings:', e);
      return false;
    }
  }
);

/**
 * 测试代理连接
 * Tauri 桌面端使用专用测试函数，移动端使用 CorsBypass 插件
 */
export const testProxyConnection = createAsyncThunk(
  'networkProxy/test',
  async (
    { config, testUrl }: { config: ProxyConfig; testUrl?: string },
    { rejectWithValue }
  ) => {
    try {
      const url = testUrl || 'https://www.google.com';
      
      // Tauri 桌面端使用专用测试函数
      if (isTauri()) {
        logger.debug('Tauri 桌面端代理测试');
        const result = await testTauriProxyConnection(
          {
            enabled: true,
            type: config.type,
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
          },
          url
        );
        return result as ProxyTestResult;
      }
      
      // 移动端使用 CorsBypass 插件
      logger.debug('移动端代理测试 (CorsBypass)');
      const result = await CorsBypass.testProxy(
        {
          enabled: true,
          type: config.type,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          bypass: config.bypass,
        },
        url
      );

      return result as ProxyTestResult;
    } catch (error: any) {
      logger.error('代理测试失败:', error);
      return rejectWithValue({
        success: false,
        error: error.message || '代理测试失败',
      } as ProxyTestResult);
    }
  }
);

/**
 * 应用全局代理
 * Tauri 桌面端：代理配置存储在 storage 中，每次请求时自动读取
 * 移动端：使用 CorsBypass 插件设置全局代理
 */
export const applyGlobalProxy = createAsyncThunk(
  'networkProxy/apply',
  async (config: ProxyConfig, { rejectWithValue }) => {
    try {
      // Tauri 桌面端：代理配置已保存到 storage，universalFetch 会自动读取
      // 不需要额外操作，但我们记录日志以便调试
      if (isTauri()) {
        logger.debug('Tauri 桌面端代理配置已更新:', {
          enabled: config.enabled,
          type: config.type,
          host: config.host,
          port: config.port,
        });
        return true;
      }
      
      // 移动端使用 CorsBypass 插件
      if (config.enabled) {
        await CorsBypass.setGlobalProxy({
          enabled: true,
          type: config.type,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          bypass: config.bypass,
          applyToAll: true,
        });
      } else {
        await CorsBypass.clearGlobalProxy();
      }

      return true;
    } catch (error: any) {
      logger.error('Failed to apply global proxy:', error);
      return rejectWithValue(error.message || '应用代理失败');
    }
  }
);

/**
 * 网络代理 Slice
 */
const networkProxySlice = createSlice({
  name: 'networkProxy',
  initialState,
  reducers: {
    /** 设置代理启用状态 */
    setProxyEnabled: (state, action: PayloadAction<boolean>) => {
      state.globalProxy.enabled = action.payload;
      state.status.active = action.payload;
    },

    /** 设置代理类型 */
    setProxyType: (state, action: PayloadAction<ProxyType>) => {
      state.globalProxy.type = action.payload;
    },

    /** 设置代理主机 */
    setProxyHost: (state, action: PayloadAction<string>) => {
      state.globalProxy.host = action.payload;
    },

    /** 设置代理端口 */
    setProxyPort: (state, action: PayloadAction<number>) => {
      state.globalProxy.port = action.payload;
    },

    /** 设置代理用户名 */
    setProxyUsername: (state, action: PayloadAction<string>) => {
      state.globalProxy.username = action.payload;
    },

    /** 设置代理密码 */
    setProxyPassword: (state, action: PayloadAction<string>) => {
      state.globalProxy.password = action.payload;
    },

    /** 设置跳过代理列表 */
    setProxyBypass: (state, action: PayloadAction<string[]>) => {
      state.globalProxy.bypass = action.payload;
    },

    /** 更新完整代理配置 */
    updateProxyConfig: (state, action: PayloadAction<Partial<ProxyConfig>>) => {
      state.globalProxy = { ...state.globalProxy, ...action.payload };
    },

    /** 重置代理配置 */
    resetProxyConfig: (state) => {
      state.globalProxy = defaultProxyConfig;
      state.status = { active: false, requestCount: 0 };
      state.lastTestResult = undefined;
    },

    /** 更新代理状态 */
    updateProxyStatus: (state, action: PayloadAction<Partial<ProxyStatus>>) => {
      state.status = { ...state.status, ...action.payload };
    },

    /** 清除测试结果 */
    clearTestResult: (state) => {
      state.lastTestResult = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      // 加载设置
      .addCase(loadNetworkProxySettings.fulfilled, (state, action) => {
        if (action.payload) {
          state.globalProxy = action.payload.globalProxy;
          state.status = action.payload.status;
        }
        state.isLoaded = true;
      })
      .addCase(loadNetworkProxySettings.rejected, (state) => {
        state.isLoaded = true;
      })

      // 测试代理
      .addCase(testProxyConnection.pending, (state) => {
        state.isTesting = true;
        state.lastTestResult = undefined;
      })
      .addCase(testProxyConnection.fulfilled, (state, action) => {
        state.isTesting = false;
        state.lastTestResult = action.payload;
        if (action.payload.success) {
          state.status.lastSuccessTime = Date.now();
        }
      })
      .addCase(testProxyConnection.rejected, (state, action) => {
        state.isTesting = false;
        state.lastTestResult = action.payload as ProxyTestResult;
      })

      // 应用代理
      .addCase(applyGlobalProxy.fulfilled, (state) => {
        state.status.active = state.globalProxy.enabled;
      })
      .addCase(applyGlobalProxy.rejected, (state, action) => {
        state.status.lastError = action.payload as string;
      });
  },
});

export const {
  setProxyEnabled,
  setProxyType,
  setProxyHost,
  setProxyPort,
  setProxyUsername,
  setProxyPassword,
  setProxyBypass,
  updateProxyConfig,
  resetProxyConfig,
  updateProxyStatus,
  clearTestResult,
} = networkProxySlice.actions;

export default networkProxySlice.reducer;
