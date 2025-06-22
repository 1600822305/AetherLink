# 🔍 网络搜索服务模块

这个模块包含了所有与网络搜索相关的服务和组件，提供统一的搜索接口和多种搜索引擎支持。

## 📁 文件结构

```
webSearch/
├── index.ts                    # 模块导出入口
├── BingFreeSearchService.ts    # 免费多搜索引擎服务（主要）
├── EnhancedWebSearchService.ts # 增强网络搜索服务（集成器）
├── BingMobileSDK.ts           # Bing移动端SDK
├── TavilyMobileSDK.ts         # Tavily移动端SDK
└── README.md                  # 本文档
```

## 🚀 主要服务

### 1. BingFreeSearchService
**免费多搜索引擎服务** - 支持多种搜索引擎的免费搜索服务

**支持的搜索引擎：**
- 🔍 Bing（默认）
- 🌐 Google
- 🔍 百度
- 🔍 搜狗
- 🔍 Yandex

**特性：**
- 基于SearXNG的成熟解析逻辑
- 支持移动端CORS绕过
- 内容抓取和摘要
- 多语言支持
- 安全搜索过滤

### 2. EnhancedWebSearchService
**增强网络搜索服务** - 整合多个搜索提供商的统一接口

**支持的提供商：**
- bing-free（免费Bing搜索）
- tavily（Tavily API）
- exa（Exa API）
- bocha（Bocha API）
- firecrawl（Firecrawl API）

### 3. BingMobileSDK
**Bing移动端SDK** - 专门为移动端优化的Bing搜索SDK

### 4. TavilyMobileSDK
**Tavily移动端SDK** - 移动端兼容的Tavily搜索SDK

## 📖 使用方法

### 基本使用

```typescript
import { bingFreeSearchService } from '../services/webSearch';

// 使用默认Bing搜索
const results = await bingFreeSearchService.search({
  query: '搜索关键词',
  maxResults: 10
});

// 使用Google搜索
const googleResults = await bingFreeSearchService.search({
  query: '搜索关键词',
  maxResults: 10,
  searchEngine: 'google'
});
```

### 通过统一接口使用

```typescript
import { enhancedWebSearchService } from '../services/webSearch';

const results = await enhancedWebSearchService.search(
  provider,
  query,
  websearchSettings
);
```

## 🔧 配置选项

### BingSearchOptions
```typescript
interface BingSearchOptions {
  query: string;                    // 搜索查询
  maxResults?: number;              // 最大结果数
  language?: string;                // 语言设置
  region?: string;                  // 地区设置
  safeSearch?: 'strict' | 'moderate' | 'off'; // 安全搜索
  freshness?: 'day' | 'week' | 'month';       // 时间过滤
  timeout?: number;                 // 超时时间
  fetchContent?: boolean;           // 是否抓取内容
  maxContentLength?: number;        // 最大内容长度
  searchEngine?: SearchEngine;      // 搜索引擎选择
}
```

## 🎯 技术特点

- **多搜索引擎支持**：基于SearXNG的成熟实现
- **移动端优化**：使用capacitor-cors-bypass-enhanced解决CORS问题
- **智能解析**：为每个搜索引擎定制的HTML解析策略
- **容错处理**：强大的错误处理和回退机制
- **性能优化**：使用node-html-parser进行高效HTML解析
- **统一接口**：所有搜索引擎返回统一的结果格式

## 📱 移动端支持

所有服务都支持移动端环境，通过以下技术实现：
- Capacitor插件集成
- CORS绕过处理
- 移动端优化的网络请求
- 原生平台检测

## 🔄 迁移说明

如果您之前直接导入这些服务，请更新导入路径：

```typescript
// 旧的导入方式
import { bingFreeSearchService } from '../services/BingFreeSearchService';

// 新的导入方式
import { bingFreeSearchService } from '../services/webSearch';
```
