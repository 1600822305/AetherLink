/**
 * ElevenLabs TTS 引擎
 * 支持高质量多语言语音合成
 */

import { BaseTTSEngine } from './BaseTTSEngine';
import type { TTSEngineType, TTSSynthesisResult, ElevenLabsTTSConfig } from '../types';
import { createLogger } from '../../infra/logger';
const logger = createLogger('ElevenLabsEngine');

// ElevenLabs 预设语音列表
export const ELEVENLABS_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: '温暖的英式男声' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: '柔和的女声' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: '专业的男性旁白' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: '亲切的女声' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: '深沉的英式男声' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: '年轻的男声' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: '优雅的女声' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: '成熟的女声' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', description: '亲切的男性声音' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: '活泼的女声' },
];

// ElevenLabs 模型列表
export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: '多语言高质量模型' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: '低延迟优化模型' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5', description: '超低延迟模型' },
  { id: 'eleven_monolingual_v1', name: 'English v1', description: '英语专用模型' },
];

// 输出格式选项
export const ELEVENLABS_OUTPUT_FORMATS = [
  { id: 'mp3_44100_128', name: 'MP3 44.1kHz 128kbps', description: '高质量' },
  { id: 'mp3_44100_64', name: 'MP3 44.1kHz 64kbps', description: '标准质量' },
  { id: 'mp3_22050_32', name: 'MP3 22.05kHz 32kbps', description: '低带宽' },
  { id: 'pcm_16000', name: 'PCM 16kHz', description: '原始 PCM' },
  { id: 'pcm_22050', name: 'PCM 22.05kHz', description: '原始 PCM 高采样' },
  { id: 'pcm_24000', name: 'PCM 24kHz', description: '原始 PCM 24k' },
  { id: 'pcm_44100', name: 'PCM 44.1kHz', description: '原始 PCM CD 质量' },
  { id: 'ulaw_8000', name: 'μ-law 8kHz', description: '电话质量' },
];

export class ElevenLabsEngine extends BaseTTSEngine {
  readonly name: TTSEngineType = 'elevenlabs';
  readonly priority = 6; // 较高优先级

  protected config: ElevenLabsTTSConfig = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.elevenlabs.io',
    modelId: 'eleven_multilingual_v2',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb', // 默认 George
    outputFormat: 'mp3_44100_128',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
    speed: 1.0,
  };

  protected async doInitialize(): Promise<void> {
    // ElevenLabs 不需要预热
  }

  isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey && !!this.config.voiceId;
  }

  async synthesize(text: string): Promise<TTSSynthesisResult> {
    if (!this.config.apiKey) {
      return { success: false, error: 'ElevenLabs API Key 未设置' };
    }

    if (!this.config.voiceId) {
      return { success: false, error: 'ElevenLabs Voice ID 未设置' };
    }

    try {
      const baseUrl = this.config.baseUrl?.replace(/\/$/, '') || 'https://api.elevenlabs.io';
      // output_format 作为 URL query parameter
      const outputFormat = this.config.outputFormat || 'mp3_44100_128';
      const url = `${baseUrl}/v1/text-to-speech/${this.config.voiceId}?output_format=${outputFormat}`;

      // 构建请求体
      const requestBody: Record<string, unknown> = {
        text,
        model_id: this.config.modelId,
      };

      // 语音设置
      const voiceSettings: Record<string, unknown> = {
        stability: this.config.stability ?? 0.5,
        similarity_boost: this.config.similarityBoost ?? 0.75,
        style: this.config.style ?? 0,
        use_speaker_boost: this.config.useSpeakerBoost ?? true,
      };

      // 添加语速（如果支持）
      if (this.config.speed && this.config.speed !== 1.0) {
        voiceSettings.speed = this.config.speed;
      }

      requestBody.voice_settings = voiceSettings;

      // 根据输出格式设置 Accept 头
      const acceptMime = this.getMimeType(outputFormat);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'Accept': acceptMime,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `ElevenLabs TTS 请求失败: ${response.status} ${JSON.stringify(errorData)}`,
        };
      }

      const audioData = await response.arrayBuffer();
      const mimeType = this.getMimeType(this.config.outputFormat);

      return {
        success: true,
        audioData,
        mimeType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 根据输出格式获取 MIME 类型
   */
  private getMimeType(format: string): string {
    if (format.startsWith('mp3_')) {
      return 'audio/mpeg';
    }
    if (format.startsWith('pcm_')) {
      return 'audio/wav';
    }
    if (format.startsWith('ulaw_')) {
      return 'audio/basic';
    }
    return 'audio/mpeg';
  }

  /**
   * 获取可用语音列表
   */
  async getVoices(): Promise<Array<{ id: string; name: string; category: string }>> {
    if (!this.config.apiKey) {
      return [];
    }

    try {
      const baseUrl = this.config.baseUrl?.replace(/\/$/, '') || 'https://api.elevenlabs.io';
      const response = await fetch(`${baseUrl}/v1/voices`, {
        headers: {
          'xi-api-key': this.config.apiKey,
        },
      });

      if (!response.ok) {
        logger.warn('获取 ElevenLabs 语音列表失败');
        return [];
      }

      const data = await response.json();
      return (data.voices || []).map((v: { voice_id: string; name: string; category: string }) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category || 'premade',
      }));
    } catch (error) {
      logger.warn('获取 ElevenLabs 语音列表错误:', error);
      return [];
    }
  }

  stop(): void {
    // ElevenLabs 引擎不直接控制播放，由 AudioPlayer 处理
  }

  updateConfig(config: Partial<ElevenLabsTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ElevenLabsTTSConfig {
    return { ...this.config };
  }
}
