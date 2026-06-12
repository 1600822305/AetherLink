/**
 * TTS V2 导出入口
 */

// 管理器
export { TTSManager } from './TTSManager';

// 类型
export type {
  TTSEngineType,
  TTSBaseConfig,
  CapacitorTTSConfig,
  OpenAITTSConfig,
  AzureTTSConfig,
  GeminiTTSConfig,
  SiliconFlowTTSConfig,
  ElevenLabsTTSConfig,
  MiniMaxTTSConfig,
  VolcanoTTSConfig,
  VolcanoApiVersion,
  WebSpeechTTSConfig,
  ITTSEngine,
  TTSSynthesisResult,
  TTSPlaybackState,
  TTSEvent,
  TTSEventType,
  TTSEventCallback,
} from './types';

// 引擎 (按需导入)
export { CapacitorEngine } from './engines/CapacitorEngine';
export { GeminiEngine } from './engines/GeminiEngine';
export { AzureEngine } from './engines/AzureEngine';
export { OpenAIEngine } from './engines/OpenAIEngine';
export { SiliconFlowEngine } from './engines/SiliconFlowEngine';
export { ElevenLabsEngine, ELEVENLABS_VOICES, ELEVENLABS_MODELS, ELEVENLABS_OUTPUT_FORMATS } from './engines/ElevenLabsEngine';
export { MiniMaxEngine, MINIMAX_VOICES, MINIMAX_MODELS, MINIMAX_EMOTIONS, MINIMAX_LANGUAGE_BOOST } from './engines/MiniMaxEngine';
export { VolcanoEngine, VOLCANO_VOICES, VOLCANO_EMOTIONS, VOLCANO_RESOURCE_IDS, isBigModelVoice, isSeedTts2Voice } from './engines/VolcanoEngine';
export { WebSpeechEngine } from './engines/WebSpeechEngine';

// 工具
export { AudioPlayer } from './utils/AudioPlayer';
export { stripMarkdown, chunkText, preprocessText } from './utils/textProcessor';
