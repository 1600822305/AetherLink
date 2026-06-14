/**
 * Web Speech API 引擎
 * 浏览器原生语音合成，作为兜底方案
 */

import { BaseTTSEngine } from './BaseTTSEngine';
import type { TTSEngineType, TTSSynthesisResult, WebSpeechTTSConfig } from '../types';
import { createLogger } from '../../infra/logger';
const logger = createLogger('WebSpeechEngine');

export class WebSpeechEngine extends BaseTTSEngine {
  readonly name: TTSEngineType = 'webspeech';
  readonly priority = 99; // 最低优先级，兜底
  
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  
  protected config: WebSpeechTTSConfig = {
    enabled: true, // 默认启用作为兜底
    voice: undefined,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  };
  
  protected async doInitialize(): Promise<void> {
    if (!('speechSynthesis' in window)) {
      throw new Error('浏览器不支持 Web Speech API');
    }
    
    // 预加载语音列表
    this.voices = window.speechSynthesis.getVoices();
    
    // 某些浏览器需要异步加载
    if (this.voices.length === 0) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices();
          resolve();
        };
        // 超时保护
        setTimeout(resolve, 1000);
      });
    }
    
      logger.debug('Web Speech API 初始化完成，语音数:', this.voices.length);
  }
  
  isAvailable(): boolean {
    return 'speechSynthesis' in window;
  }
  
  async synthesize(_text: string): Promise<TTSSynthesisResult> {
    // Web Speech API 直接播放，不返回音频数据
    return {
      success: true,
      directPlay: true,
    };
  }
  
  /**
   * 直接播放
   */
  async speak(text: string): Promise<boolean> {
    if (!('speechSynthesis' in window)) {
      return false;
    }
    
    try {
      // 取消当前播放
      window.speechSynthesis.cancel();
      
      // 创建语音合成
      this.utterance = new SpeechSynthesisUtterance(text);
      
      // 选择语音
      const selectedVoice = this.selectVoice();
      if (selectedVoice) {
        this.utterance.voice = selectedVoice;
      }
      
      // 设置参数
      this.utterance.rate = this.config.rate;
      this.utterance.pitch = this.config.pitch;
      this.utterance.volume = this.config.volume;
      
      // 播放
      return new Promise((resolve) => {
        if (!this.utterance) {
          resolve(false);
          return;
        }
        
        this.utterance.onend = () => resolve(true);
        this.utterance.onerror = () => resolve(false);
        
        window.speechSynthesis.speak(this.utterance);
      });
    } catch (error) {
      logger.error('Web Speech API 播放失败:', error);
      return false;
    }
  }
  
  private selectVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) {
      this.voices = window.speechSynthesis.getVoices();
    }
    
    // 优先使用配置的语音
    if (this.config.voice) {
      const found = this.voices.find(v => v.name === this.config.voice);
      if (found) return found;
    }
    
    // 尝试找中文语音
    const zhVoice = this.voices.find(v => v.lang === 'zh-CN');
    if (zhVoice) return zhVoice;
    
    // 返回第一个可用语音
    return this.voices[0] || null;
  }
  
  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.utterance = null;
  }
  
  /**
   * 获取可用语音列表
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
  
  updateConfig(config: Partial<WebSpeechTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
