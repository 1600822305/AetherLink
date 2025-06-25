# 平台检测系统迁移指南

## 概述

我们已经将平台检测系统从简单的三分类（Web、Capacitor、Tauri）升级为更精确的细分检测系统，支持具体的操作系统和运行时环境组合。

## 新的平台分类

### 运行时环境 (RuntimeType)
- `TAURI` - Tauri 运行时
- `CAPACITOR` - Capacitor 运行时  
- `WEB` - 纯 Web 环境

### 操作系统 (OSType)
- `WINDOWS` - Windows 系统
- `MACOS` - macOS 系统
- `LINUX` - Linux 系统
- `ANDROID` - Android 系统
- `IOS` - iOS 系统
- `WEB` - Web 环境

### 详细平台类型 (PlatformType)
- `TAURI_WINDOWS` - Tauri Windows 应用
- `TAURI_MACOS` - Tauri macOS 应用
- `TAURI_LINUX` - Tauri Linux 应用
- `TAURI_ANDROID` - Tauri Android 应用
- `TAURI_IOS` - Tauri iOS 应用
- `CAPACITOR_ANDROID` - Capacitor Android 应用
- `CAPACITOR_IOS` - Capacitor iOS 应用
- `CAPACITOR_WEB` - Capacitor Web 应用
- `WEB` - 纯 Web 应用

## 迁移步骤

### 1. 向后兼容性

**好消息：现有代码无需修改！** 所有旧的 API 都保持兼容：

```typescript
// 这些代码继续正常工作
import { isMobile, isDesktop, isTauri, isCapacitor } from './platformDetection';

if (isMobile()) {
  // 移动端逻辑
}

if (isTauri()) {
  // Tauri 逻辑
}
```

### 2. 升级到新 API (推荐)

```typescript
// 旧方式
import { getPlatformInfo, PlatformType } from './platformDetection';
const info = getPlatformInfo();
if (info.type === PlatformType.TAURI) {
  // Tauri 逻辑
}

// 新方式 (推荐)
import { getPlatformInfo, PlatformType } from './platformDetection';
const info = getPlatformInfo();
if (info.platformType === PlatformType.TAURI_WINDOWS) {
  // Windows 特定的 Tauri 逻辑
}
```

### 3. React Hook 升级

```typescript
// 旧方式
const { isTauri, isMobile } = usePlatformInfo();

// 新方式 (获得更多信息)
const { 
  isTauri, 
  isMobile,
  isWindows,
  isAndroid,
  platformType,
  runtimeType,
  osType 
} = usePlatformInfo();
```

## 新功能示例

### 1. 平台特定逻辑

```typescript
import { getPlatformInfo, PlatformType } from './platformDetection';

const platformInfo = getPlatformInfo();

switch (platformInfo.platformType) {
  case PlatformType.TAURI_WINDOWS:
    // Windows 特定功能：系统托盘、Fluent Design
    break;
    
  case PlatformType.TAURI_MACOS:
    // macOS 特定功能：菜单栏、Touch ID
    break;
    
  case PlatformType.CAPACITOR_ANDROID:
    // Android 特定功能：Material Design、指纹识别
    break;
    
  case PlatformType.CAPACITOR_IOS:
    // iOS 特定功能：Face ID、圆角设计
    break;
}
```

### 2. 便捷检测函数

```typescript
import { isWindows, isMacOS, isAndroid, isIOS } from './platformDetection';

// 操作系统检测
if (isWindows()) {
  // Windows 特定逻辑
}

if (isMacOS()) {
  // macOS 特定逻辑
}

// 移动端检测
if (isAndroid()) {
  // Android 特定逻辑
}

if (isIOS()) {
  // iOS 特定逻辑
}
```

### 3. 平台配置

```typescript
import { getPlatformConfig } from './platformDetection';

const config = getPlatformConfig();

// 功能支持检测
if (config.features.systemTray) {
  // 显示系统托盘选项
}

if (config.features.touchID) {
  // 显示 Touch ID 选项
}

// UI 配置
if (config.ui.materialDesign) {
  // 使用 Material Design 组件
}

if (config.ui.fluentDesign) {
  // 使用 Fluent Design 组件
}
```

## 最佳实践

### 1. 优先使用新的细分检测

```typescript
// ❌ 避免过于宽泛的检测
if (isMobile()) {
  // Android 和 iOS 的逻辑可能不同
}

// ✅ 推荐使用具体的平台检测
if (isAndroid()) {
  // Android 特定逻辑
} else if (isIOS()) {
  // iOS 特定逻辑
}
```

### 2. 使用平台配置而不是硬编码

```typescript
// ❌ 避免硬编码功能支持
if (isTauri()) {
  // 假设所有 Tauri 平台都支持系统托盘
}

// ✅ 使用配置检测
const config = getPlatformConfig();
if (config.features.systemTray) {
  // 确保当前平台支持系统托盘
}
```

### 3. 渐进式升级

1. **第一步**：继续使用现有代码（向后兼容）
2. **第二步**：在新功能中使用新 API
3. **第三步**：逐步重构现有代码使用新 API

## 常见问题

### Q: 现有代码会不会出错？
A: 不会！所有旧的 API 都保持兼容，现有代码可以正常运行。

### Q: 什么时候需要升级？
A: 当您需要针对特定操作系统或平台提供不同功能时。

### Q: 如何测试不同平台？
A: 使用 `PlatformTest` 组件或 `PlatformDetectionExample` 组件进行测试。

## 参考资料

- [平台检测 API 文档](./src/shared/utils/platformDetection.ts)
- [平台适配器文档](./src/shared/adapters/PlatformAdapter.ts)
- [React Hook 文档](./src/hooks/usePlatform.ts)
- [测试组件示例](./src/components/PlatformTest.tsx)
- [使用示例](./src/examples/PlatformDetectionExample.tsx)
