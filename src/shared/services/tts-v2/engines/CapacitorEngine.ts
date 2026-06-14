/**
 * Capacitor TTS 引擎
 * 使用设备原生 TTS，性能最佳
 */

import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { BaseTTSEngine } from './BaseTTSEngine';
import type { TTSEngineType, TTSSynthesisResult, CapacitorTTSConfig } from '../types';
import { createLogger } from '../../infra/logger';
const logger = createLogger('CapacitorEngine');

export class CapacitorEngine extends BaseTTSEngine {
  readonly name: TTSEngineType = 'capacitor';
  readonly priority = 1; // 最高优先级
  
  protected config: CapacitorTTSConfig = {
    enabled: false,
    language: 'zh-CN',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  };
  
  /**
   * 预热引擎 - 使用惰性初始化策略
   * Android TTS 存在异步初始化问题，getSupportedLanguages() 可能在服务绑定前调用导致空指针
   * 参考: https://stackoverflow.com/questions/4141567/how-to-wait-for-texttospeech-initialization-on-android
   */
  protected async doInitialize(): Promise<void> {
    // 策略：不在初始化时调用 getSupportedLanguages()
    // 而是在首次 speak() 时让 TTS 服务自然绑定
    // 这样可以避免 Android 上的空指针异常
    
    try {
      // 仅做简单的可用性检查，不触发可能导致空指针的操作
      // 实际的 TTS 服务绑定会在首次 speak() 调用时自动完成
      logger.debug('Capacitor TTS 引擎已注册，将在首次使用时完成初始化');
      
      // 可选：尝试预热，但失败不影响功能
      this.warmupAsync();
    } catch (error) {
      // 即使检查失败也不抛出错误，让引擎保持可用状态
      logger.warn('Capacitor TTS 预检查失败，将在使用时重试:', error);
    }
  }

  /**
   * 异步预热（后台执行，不阻塞初始化）
   */
  private async warmupAsync(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 1000; // 毫秒

    // 延迟执行预热，给 TTS 服务更多时间绑定
    await this.delay(500);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const languages = await TextToSpeech.getSupportedLanguages();
        logger.debug('✅ Capacitor TTS 预热完成，支持语言数:', languages.languages?.length || 0);
        return;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Android 空指针异常 - 继续重试
        if (errorMsg.includes('null object reference') && attempt < maxRetries) {
          logger.debug(`Capacitor TTS 预热重试 (${attempt}/${maxRetries})...`);
          await this.delay(retryDelay * attempt);
          continue;
        }
        
        // 预热失败不影响功能，TTS 会在首次 speak() 时初始化
        logger.debug('Capacitor TTS 预热跳过，将在首次使用时初始化');
        return;
      }
    }
  }

  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 合成并播放 (原生 TTS 直接播放)
   */
  async synthesize(text: string): Promise<TTSSynthesisResult> {
    try {
      await TextToSpeech.speak({
        text,
        lang: this.config.language,
        rate: this.config.rate,
        pitch: this.config.pitch,
        volume: this.config.volume,
        category: 'ambient',
        queueStrategy: 0, // 立即播放
      });
      
      return {
        success: true,
        directPlay: true, // 标记为已直接播放
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * 直接播放接口
   */
  async speak(text: string): Promise<boolean> {
    const result = await this.synthesize(text);
    return result.success;
  }
  
  /**
   * 停止播放
   */
  stop(): void {
    try {
      TextToSpeech.stop();
    } catch (error) {
      logger.warn('停止 Capacitor TTS 失败:', error);
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<CapacitorTTSConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
