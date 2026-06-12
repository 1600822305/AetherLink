/**
 * TTS V2 类型定义
 */

// TTS 引擎类型
export type TTSEngineType = 
  | 'capacitor'    // 原生设备 TTS
  | 'gemini'       // Google Gemini TTS
  | 'azure'        // 微软 Azure TTS
  | 'openai'       // OpenAI TTS
  | 'siliconflow'  // 硅基流动 TTS
  | 'elevenlabs'   // ElevenLabs TTS
  | 'minimax'      // MiniMax TTS
  | 'volcano'      // 火山引擎 TTS (字节跳动)
  | 'webspeech';   // 浏览器 Web Speech API

// 基础配置接口
export interface TTSBaseConfig {
  enabled: boolean;
}

// Capacitor TTS 配置
export interface CapacitorTTSConfig extends TTSBaseConfig {
  language: string;      // 语言代码 (zh-CN, en-US)
  rate: number;          // 语速 (0.0-1.0)
  pitch: number;         // 音调 (0.0-2.0)
  volume: number;        // 音量 (0.0-1.0)
}

// OpenAI TTS 配置
export interface OpenAITTSConfig extends TTSBaseConfig {
  apiKey: string;
  baseUrl?: string;
  model: 'tts-1' | 'tts-1-hd';
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed: number;         // 0.25-4.0
  responseFormat: 'mp3' | 'opus' | 'aac' | 'flac';
}

// Azure TTS 配置
export interface AzureTTSConfig extends TTSBaseConfig {
  apiKey: string;
  region: string;
  voiceName: string;
  language: string;
  rate: string;          // x-slow, slow, medium, fast, x-fast
  pitch: string;         // x-low, low, medium, high, x-high
  volume: string;        // silent, x-soft, soft, medium, loud, x-loud
  style?: string;        // cheerful, sad, angry, etc.
  styleDegree?: number;  // 0.01-2.0
  role?: string;         // Girl, Boy, etc.
  useSSML: boolean;
}

// Gemini TTS 配置
export interface GeminiTTSConfig extends TTSBaseConfig {
  apiKey: string;
  model: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
  voice: string;         // 30种预设语音
  stylePrompt?: string;  // 风格提示词
  useMultiSpeaker: boolean;
  speakers?: Array<{ speaker: string; voiceName: string }>;
}

// 硅基流动 TTS 配置
export interface SiliconFlowTTSConfig extends TTSBaseConfig {
  apiKey: string;
  model: 'FunAudioLLM/CosyVoice2-0.5B' | 'fnlp/MOSS-TTSD-v0.5' | 'IndexTeam/IndexTTS-2';
  voice: string;
  useStream: boolean;
  // MOSS-TTSD 专用配置
  speed?: number;          // 语速 0.5-2.0，默认 1
  gain?: number;           // 音量增益 -10 到 10，默认 0
  maxTokens?: number;      // 最大 token 数，默认 1600
  // 参考音频（用于语音克隆）
  references?: Array<{
    audio: string;         // 参考音频 URL 或 base64
    text: string;          // 参考音频对应的文本
  }>;
}

// ElevenLabs TTS 配置
export interface ElevenLabsTTSConfig extends TTSBaseConfig {
  apiKey: string;
  baseUrl?: string;          // API 基础 URL，默认 https://api.elevenlabs.io
  modelId: string;           // 模型 ID (eleven_multilingual_v2, eleven_turbo_v2_5 等)
  voiceId: string;           // 语音 ID
  outputFormat: string;      // 输出格式 (mp3_44100_128, mp3_22050_32, pcm_16000 等)
  stability?: number;        // 稳定性 0-1
  similarityBoost?: number;  // 相似度增强 0-1
  style?: number;            // 风格 0-1
  useSpeakerBoost?: boolean; // 使用说话者增强
  speed?: number;            // 语速 0.5-2.0
}

// MiniMax TTS 配置
export interface MiniMaxTTSConfig extends TTSBaseConfig {
  apiKey: string;
  groupId: string;           // MiniMax Group ID
  baseUrl?: string;          // API 基础 URL，默认 https://api.minimaxi.chat
  model: string;             // 模型 (speech-02-hd, speech-02 等)
  voiceId: string;           // 语音 ID
  emotion?: string;          // 情感 (neutral, happy, sad, angry 等)
  speed?: number;            // 语速 0.5-2.0
  pitch?: number;            // 音调 -12 到 12
  languageBoost?: string;    // 语言增强 (Chinese, Yue, English 等)
  useStream?: boolean;       // 是否使用流式传输
}

// 火山引擎 TTS 接口版本
export type VolcanoApiVersion = 'auto' | 'v1' | 'v3';

// 火山引擎 TTS 配置 (字节跳动)
export interface VolcanoTTSConfig extends TTSBaseConfig {
  appId: string;             // 火山引擎 App ID
  accessToken: string;       // Access Token
  cluster?: string;          // 集群，默认 volcano_tts (仅 V1)
  apiVersion?: VolcanoApiVersion; // 接口版本，默认 auto (按音色自动路由)
  resourceId?: string;       // V3 接口 Resource ID，留空则按音色自动选择
  model?: string;            // V3 模型版本 (如 seed-tts-1.1)，留空为默认
  voiceType: string;         // 音色类型 (BV700_streaming, BV001_streaming 等)
  emotion?: string;          // 情感 (happy, sad, angry 等)
  speed?: number;            // 语速 0.5-2.0
  volume?: number;           // 音量 0.5-2.0
  pitch?: number;            // 音调 0.5-2.0
  encoding?: 'mp3' | 'ogg_opus' | 'wav' | 'pcm';  // 音频编码格式
}

// Web Speech API 配置
export interface WebSpeechTTSConfig extends TTSBaseConfig {
  voice?: string;
  rate: number;
  pitch: number;
  volume: number;
}

// 所有配置联合类型
export type TTSEngineConfig = 
  | { type: 'capacitor'; config: CapacitorTTSConfig }
  | { type: 'openai'; config: OpenAITTSConfig }
  | { type: 'azure'; config: AzureTTSConfig }
  | { type: 'gemini'; config: GeminiTTSConfig }
  | { type: 'siliconflow'; config: SiliconFlowTTSConfig }
  | { type: 'elevenlabs'; config: ElevenLabsTTSConfig }
  | { type: 'minimax'; config: MiniMaxTTSConfig }
  | { type: 'volcano'; config: VolcanoTTSConfig }
  | { type: 'webspeech'; config: WebSpeechTTSConfig };

// TTS 引擎接口
export interface ITTSEngine {
  /** 引擎名称 */
  readonly name: TTSEngineType;
  /** 优先级 (数字越小优先级越高) */
  readonly priority: number;
  
  /** 初始化/预热引擎 */
  initialize(): Promise<void>;
  
  /** 检查引擎是否可用 */
  isAvailable(): boolean;
  
  /** 合成语音，返回音频数据 */
  synthesize(text: string): Promise<TTSSynthesisResult>;
  
  /** 直接播放 (用于原生TTS) */
  speak?(text: string): Promise<boolean>;
  
  /** 停止播放 */
  stop(): void;
  
  /** 更新配置 */
  updateConfig(config: Partial<TTSBaseConfig>): void;
}

// 合成结果
export interface TTSSynthesisResult {
  success: boolean;
  audioData?: ArrayBuffer;
  mimeType?: string;
  error?: string;
  /** 是否已直接播放 (原生TTS) */
  directPlay?: boolean;
}

// 播放状态
export interface TTSPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentMessageId: string | null;
  currentEngine: TTSEngineType | null;
  error: string | null;
}

// 播放事件
export type TTSEventType = 'start' | 'end' | 'pause' | 'resume' | 'error';

export interface TTSEvent {
  type: TTSEventType;
  messageId?: string;
  error?: string;
}

export type TTSEventCallback = (event: TTSEvent) => void;
