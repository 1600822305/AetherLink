/**
 * 记忆系统 Redux Store Slice
 * 管理记忆配置和状态
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { 
  MemoryState, 
  MemoryConfig,
} from '../../types/memory';
import { memoryService } from '../../services/memory/MemoryService';

// ========================================================================
// 初始状态
// ========================================================================

const initialState: MemoryState = {
  memoryConfig: {
    embeddingDimensions: undefined,
    isAutoDimensions: true,
    similarityThreshold: 0.85,
    defaultSearchLimit: 10,
    // 记忆方式控制：默认都关闭，用户可自由选择
    autoAnalyzeEnabled: false,
    memoryToolEnabled: true,
  },
  currentAssistantId: 'default',
  globalMemoryEnabled: false,
  isLoading: false,
  error: undefined,
};

// ========================================================================
// 异步 Thunks
// ========================================================================

/**
 * 初始化记忆服务
 */
export const initializeMemoryService = createAsyncThunk(
  'memory/initialize',
  async (_, { rejectWithValue }) => {
    try {
      await memoryService.initialize();
      return true;
    } catch (error) {
      return rejectWithValue(String(error));
    }
  }
);

/**
 * 更新记忆配置
 */
export const updateMemoryConfig = createAsyncThunk(
  'memory/updateConfig',
  async (config: Partial<MemoryConfig>, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { memory: MemoryState };
      const newConfig = { ...state.memory.memoryConfig, ...config };
      return newConfig;
    } catch (error) {
      return rejectWithValue(String(error));
    }
  }
);

/**
 * 获取用户列表
 */
export const fetchUsersList = createAsyncThunk(
  'memory/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const users = await memoryService.getUsersList();
      return users;
    } catch (error) {
      return rejectWithValue(String(error));
    }
  }
);

// ========================================================================
// Slice 定义
// ========================================================================

const memorySlice = createSlice({
  name: 'memory',
  initialState,
  reducers: {
    /**
     * 设置当前助手ID（记忆按助手隔离）
     */
    setCurrentAssistantId: (state, action: PayloadAction<string>) => {
      state.currentAssistantId = action.payload;
      // 同步到 localStorage
      try {
        localStorage.setItem('memory_current_assistant_id', action.payload);
      } catch {
        // ignore
      }
    },

    /**
     * 设置全局记忆开关
     */
    setGlobalMemoryEnabled: (state, action: PayloadAction<boolean>) => {
      state.globalMemoryEnabled = action.payload;
    },

    /**
     * 直接更新记忆配置（同步）
     */
    setMemoryConfig: (state, action: PayloadAction<MemoryConfig>) => {
      state.memoryConfig = action.payload;
    },

    /**
     * 部分更新记忆配置
     */
    patchMemoryConfig: (state, action: PayloadAction<Partial<MemoryConfig>>) => {
      state.memoryConfig = { ...state.memoryConfig, ...action.payload };
    },

    /**
     * 清除错误
     */
    clearError: (state) => {
      state.error = undefined;
    },

    /**
     * 重置状态
     */
    resetMemoryState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // 初始化
      .addCase(initializeMemoryService.pending, (state) => {
        state.isLoading = true;
        state.error = undefined;
      })
      .addCase(initializeMemoryService.fulfilled, (state) => {
        state.isLoading = false;
        // 尝试从 localStorage 恢复助手ID
        try {
          const savedAssistantId = localStorage.getItem('memory_current_assistant_id');
          if (savedAssistantId) {
            state.currentAssistantId = savedAssistantId;
          }
        } catch {
          // ignore
        }
      })
      .addCase(initializeMemoryService.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // 更新配置
      .addCase(updateMemoryConfig.fulfilled, (state, action) => {
        state.memoryConfig = action.payload;
      })
      .addCase(updateMemoryConfig.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

// ========================================================================
// 导出 Actions
// ========================================================================

export const {
  setCurrentAssistantId,
  setGlobalMemoryEnabled,
  setMemoryConfig,
  patchMemoryConfig,
  clearError,
  resetMemoryState,
} = memorySlice.actions;

// ========================================================================
// Selectors
// ========================================================================

export const selectMemoryConfig = (state: { memory: MemoryState }) => state.memory.memoryConfig;
export const selectCurrentAssistantId = (state: { memory: MemoryState }) => state.memory.currentAssistantId;
export const selectGlobalMemoryEnabled = (state: { memory: MemoryState }) => state.memory.globalMemoryEnabled;
export const selectMemoryIsLoading = (state: { memory: MemoryState }) => state.memory.isLoading;
export const selectMemoryError = (state: { memory: MemoryState }) => state.memory.error;

// ========================================================================
// 导出 Reducer
// ========================================================================

export default memorySlice.reducer;
