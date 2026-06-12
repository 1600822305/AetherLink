<div align="center">

# AetherLink

**A Cross-Platform AI Assistant Application**

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/1600822305/CS-LLM-house)
[![Version](https://img.shields.io/badge/version-0.6.5-blue.svg?style=flat-square)](https://github.com/1600822305/AetherLink/releases)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-important.svg?style=flat-square&logo=gnu)](https://www.gnu.org/licenses/agpl-3.0)
[![License: Commercial](https://img.shields.io/badge/License-Commercial-blue.svg?style=flat-square)](mailto:1600822305@qq.com?subject=AetherLink%20Commercial%20License%20Inquiry)

[English](#english) | [中文](#中文)

</div>

---

<a name="english"></a>

## Overview

AetherLink is a modern cross-platform AI assistant application built with cutting-edge web technologies. It supports multiple AI providers (OpenAI, Google Gemini, Anthropic Claude, Grok, SiliconFlow, Volcengine, etc.) and delivers a seamless conversational experience across Android, iOS, and Desktop platforms.

## Key Features

- **Multi-Model Support** — OpenAI, Claude, Gemini, Grok, SiliconFlow, Volcengine, and custom API endpoints
- **Voice Interaction** — Speech recognition (Whisper, Capacitor, Web Speech API) + TTS (Azure, OpenAI, SiliconFlow)
- **MCP Tools Integration** — Model Context Protocol for extended AI capabilities
- **Knowledge Base** — Document upload, semantic search, and intelligent retrieval
- **Cross-Platform** — Capacitor (Android/iOS) + Tauri (Desktop) dual-framework support
- **AI Thinking Process** — Visualize model reasoning with thinking time display
- **Code Highlighting** — Shiki-powered syntax highlighting for 100+ languages

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 19, TypeScript 5.9, Material UI 7 |
| **Build** | Vite 8, SWC Compiler |
| **Mobile** | Capacitor 8, Tauri 2 |
| **State** | Redux Toolkit 2.8, Zustand |
| **Storage** | IndexedDB (Dexie), LocalStorage |
| **Styling** | Tailwind CSS, Emotion |
| **AI SDK** | Vercel AI SDK, OpenAI SDK |

## Quick Start

### Prerequisites

- **Node.js** ≥ 22.0.0
- **npm** ≥ 10.0.0 or **Yarn** 1.22+
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Rust** (for Tauri desktop builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/1600822305/AetherLink.git
cd AetherLink

# Install dependencies
npm install
# or
yarn install

# Start development server
npm run dev
```

### Build Commands

```bash
# Web build
npm run build                # Fast build (recommended)
npm run build:ultra          # Full build with type checking

# Mobile (Capacitor)
npm run build:android        # Build and sync to Android
npm run build:ios            # Build and sync to iOS

# Desktop (Tauri)
npm run build:tauri          # Build desktop application
npm run build:tauri-android  # Build Android via Tauri
```

### Mobile Development

```bash
# Android
npm run build:android
npx cap open android

# iOS (macOS only)
npm run build:ios
npx cap open ios
```

## Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Optional: CORS proxy for development
VITE_CORS_PROXY_URL=http://localhost:8080
```

### API Keys

API keys are configured within the application settings. Navigate to **Settings > Model Providers** to add your API credentials for each provider.

## Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)

## Community

- **QQ Group**: [930126592](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=V-b46WoBNLIM4oc34JMULwoyJ3hyrKac&authKey=q%2FSwCcxda4e55ygtwp3h9adQXhqBLZ9wJdvM0QxTjXQkbxAa2tHoraOGy2fiibyY&noverify=0&group_code=930126592)
- **Issues**: [GitHub Issues](https://github.com/1600822305/AetherLink/issues)

---

<a name="中文"></a>

## 项目简介

AetherLink 是一款基于现代 Web 技术构建的跨平台 AI 助手应用。支持多种 AI 服务商（OpenAI、Google Gemini、Anthropic Claude、Grok、硅基流动、火山方舟等），在 Android、iOS 和桌面端提供流畅的对话体验。

## 核心功能

- **多模型支持** — OpenAI、Claude、Gemini、Grok、硅基流动、火山方舟及自定义 API
- **语音交互** — 语音识别（Whisper、Capacitor、Web Speech API）+ 语音合成（Azure、OpenAI、硅基流动）
- **MCP 工具集成** — Model Context Protocol 扩展 AI 能力
- **知识库管理** — 文档上传、语义搜索、智能检索
- **跨平台部署** — Capacitor（Android/iOS）+ Tauri（桌面端）双框架支持
- **AI 思考过程** — 可视化模型推理过程和思考时间
- **代码高亮** — 基于 Shiki 的语法高亮，支持 100+ 编程语言

## 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | React 19、TypeScript 5.9、Material UI 7 |
| **构建工具** | Vite 8、SWC 编译器 |
| **移动端** | Capacitor 8、Tauri 2 |
| **状态管理** | Redux Toolkit 2.8、Zustand |
| **数据存储** | IndexedDB (Dexie)、LocalStorage |
| **样式方案** | Tailwind CSS、Emotion |
| **AI SDK** | Vercel AI SDK、OpenAI SDK |

## 快速开始

### 环境要求

- **Node.js** ≥ 22.0.0
- **npm** ≥ 10.0.0 或 **Yarn** 1.22+
- **Android Studio**（Android 开发）
- **Xcode**（iOS 开发，仅 macOS）
- **Rust**（Tauri 桌面构建）

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/1600822305/AetherLink.git
cd AetherLink

# 安装依赖
npm install
# 或
yarn install

# 启动开发服务器
npm run dev
```

### 构建命令

```bash
# Web 构建
npm run build                # 快速构建（推荐）
npm run build:ultra          # 完整构建（含类型检查）

# 移动端（Capacitor）
npm run build:android        # 构建并同步到 Android
npm run build:ios            # 构建并同步到 iOS

# 桌面端（Tauri）
npm run build:tauri          # 构建桌面应用
npm run build:tauri-android  # 通过 Tauri 构建 Android
```

### 移动端开发

```bash
# Android
npm run build:android
npx cap open android

# iOS（仅 macOS）
npm run build:ios
npx cap open ios
```

## 配置说明

### 环境变量

在项目根目录创建 `.env.local` 文件：

```env
# 可选：开发环境 CORS 代理
VITE_CORS_PROXY_URL=http://localhost:8080
```

### API 密钥

API 密钥在应用内配置。进入 **设置 > 模型服务商** 添加各服务商的 API 凭证。

## 文档

- [贡献指南](CONTRIBUTING.md)
- [更新日志](CHANGELOG.md)
- [许可证](LICENSE)

## 社区

- **QQ 群**: [930126592](http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=V-b46WoBNLIM4oc34JMULwoyJ3hyrKac&authKey=q%2FSwCcxda4e55ygtwp3h9adQXhqBLZ9wJdvM0QxTjXQkbxAa2tHoraOGy2fiibyY&noverify=0&group_code=930126592)
- **问题反馈**: [GitHub Issues](https://github.com/1600822305/AetherLink/issues)

---

## License | 许可证

AetherLink uses a **tiered licensing model**:

| User Type | License |
|-----------|---------|
| Individuals & teams ≤ 8 | [GNU AGPL v3.0](https://www.gnu.org/licenses/agpl-3.0) |
| Organizations > 8 people | Commercial License Required |

**Commercial Licensing**: 📧 [1600822305@qq.com](mailto:1600822305@qq.com?subject=AetherLink%20Commercial%20License%20Inquiry)

---

## Contributing | 贡献

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

> All contributions are provided under the AGPLv3 license.