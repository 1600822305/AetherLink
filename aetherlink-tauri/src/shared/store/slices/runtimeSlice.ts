import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version: string | null;
  releaseNotes: string | null;
  error: string | null;
}

export interface ExportState {
  isExporting: boolean;
  progress: number;
  error: string | null;
}

export interface RuntimeState {
  // 应用版本
  appVersion: string;
  // 设备信息
  deviceInfo: {
    platform: string;
    model: string;
    osVersion: string;
    manufacturer: string;
    batteryLevel: number;
    isCharging: boolean;
  } | null;
  // 网络状态
  networkStatus: 'online' | 'offline' | 'unknown';
  // 更新状态
  update: UpdateState;
  // 导出状态
  export: ExportState;
  // 是否处于开发模式
  devMode: boolean;
  // 是否处于离线模式
  offlineMode: boolean;
  // 是否处于低功耗模式
  lowPowerMode: boolean;
  // 是否处于后台模式
  backgroundMode: boolean;
}

const initialState: RuntimeState = {
  appVersion: '0.0.0',
  deviceInfo: null,
  networkStatus: 'unknown',
  update: {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    version: null,
    releaseNotes: null,
    error: null
  },
  export: {
    isExporting: false,
    progress: 0,
    error: null
  },
  devMode: false,
  offlineMode: false,
  lowPowerMode: false,
  backgroundMode: false
};

export const runtimeSlice = createSlice({
  name: 'runtime',
  initialState,
  reducers: {
    setAppVersion: (state, action: PayloadAction<string>) => {
      state.appVersion = action.payload;
    },
    setDeviceInfo: (state, action: PayloadAction<RuntimeState['deviceInfo']>) => {
      state.deviceInfo = action.payload;
    },
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline' | 'unknown'>) => {
      state.networkStatus = action.payload;
    },
    setUpdateState: (state, action: PayloadAction<Partial<UpdateState>>) => {
      state.update = { ...state.update, ...action.payload };
    },
    setExportState: (state, action: PayloadAction<Partial<ExportState>>) => {
      state.export = { ...state.export, ...action.payload };
    },
    setDevMode: (state, action: PayloadAction<boolean>) => {
      state.devMode = action.payload;
    },
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.offlineMode = action.payload;
    },
    setLowPowerMode: (state, action: PayloadAction<boolean>) => {
      state.lowPowerMode = action.payload;
    },
    setBackgroundMode: (state, action: PayloadAction<boolean>) => {
      state.backgroundMode = action.payload;
    }
  }
});

export const {
  setAppVersion,
  setDeviceInfo,
  setNetworkStatus,
  setUpdateState,
  setExportState,
  setDevMode,
  setOfflineMode,
  setLowPowerMode,
  setBackgroundMode
} = runtimeSlice.actions;

export default runtimeSlice.reducer;
