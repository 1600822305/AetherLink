/**
 * TTS 引擎抽象基类
 */

import type { ITTSEngine, TTSEngineType, TTSBaseConfig, TTSSynthesisResult } from '../types';
import { createLogger } from '../../infra/logger';
const logger = createLogger('BaseTTSEngine');

export abstract class BaseTTSEngine implements ITTSEngine {
  abstract readonly name: TTSEngineType;
  abstract readonly priority: number;
  
  protected _initialized: boolean = false;
  protected _available: boolean = false;
  protected config: TTSBaseConfig = { enabled: false };
  
  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    try {
      await this.doInitialize();
      this._initialized = true;
      this._available = true;
    } catch (error) {
      logger.warn(`${this.name} 引擎初始化失败:`, error);
      this._available = false;
    }
  }
  
  /**
   * 子类实现具体初始化逻辑
   */
  protected abstract doInitialize(): Promise<void>;
  
  /**
   * 检查引擎是否可用
   */
  isAvailable(): boolean {
    return this._available && this.config.enabled;
  }
  
  /**
   * 合成语音
   */
  abstract synthesize(text: string): Promise<TTSSynthesisResult>;
  
  /**
   * 停止播放
   */
  abstract stop(): void;
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<TTSBaseConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): TTSBaseConfig {
    return { ...this.config };
  }
}
