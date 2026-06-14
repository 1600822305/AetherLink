/**
 * TTS 管理器
 * 统一管理所有 TTS 引擎，提供简洁的播放接口
 */

import type { 
  TTSEngineType, 
  ITTSEngine, 
  TTSPlaybackState, 
  TTSEvent, 
  TTSEventCallback 
} from './types';
import { AudioPlayer } from './utils/AudioPlayer';
import { preprocessText, chunkText } from './utils/textProcessor';

// 引擎导入
import { CapacitorEngine } from './engines/CapacitorEngine';
import { GeminiEngine } from './engines/GeminiEngine';
import { AzureEngine } from './engines/AzureEngine';
import { OpenAIEngine } from './engines/OpenAIEngine';
import { SiliconFlowEngine } from './engines/SiliconFlowEngine';
import { ElevenLabsEngine } from './engines/ElevenLabsEngine';
import { MiniMaxEngine } from './engines/MiniMaxEngine';
import { VolcanoEngine } from './engines/VolcanoEngine';
import { WebSpeechEngine } from './engines/WebSpeechEngine';
import { createLogger } from '../infra/logger';
const logger = createLogger('TTSManager');

/**
 * 播放队列管理
 */
class PlaybackQueue {
  private chunks: string[] = [];
  private currentIndex: number = 0;
  private isPaused: boolean = false;
  
  /**
   * 设置播放队列
   */
  setChunks(chunks: string[]): void {
    this.chunks = chunks;
    this.currentIndex = 0;
    this.isPaused = false;
  }
  
  /**
   * 获取当前块
   */
  getCurrentChunk(): string | null {
    if (this.currentIndex >= this.chunks.length) {
      return null;
    }
    return this.chunks[this.currentIndex];
  }
  
  /**
   * 前进到下一块
   */
  advance(): boolean {
    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++;
      return true;
    }
    return false; // 已到达末尾
  }
  
  /**
   * 暂停播放
   */
  pause(): void {
    this.isPaused = true;
  }
  
  /**
   * 恢复播放
   */
  resume(): void {
    this.isPaused = false;
  }
  
  /**
   * 重置队列
   */
  reset(): void {
    this.chunks = [];
    this.currentIndex = 0;
    this.isPaused = false;
  }
  
  /**
   * 检查是否已完成
   */
  isFinished(): boolean {
    return this.currentIndex >= this.chunks.length;
  }
  
  /**
   * 获取播放进度
   */
  getProgress(): { current: number; total: number; percentage: number } {
    return {
      current: this.currentIndex,
      total: this.chunks.length,
      percentage: this.chunks.length > 0 ? (this.currentIndex / this.chunks.length) * 100 : 0
    };
  }
  
  // Getters
  get chunksArray(): string[] { return this.chunks; }
  get index(): number { return this.currentIndex; }
  get paused(): boolean { return this.isPaused; }
}

export class TTSManager {
  private static instance: TTSManager;
  
  private engines: Map<TTSEngineType, ITTSEngine> = new Map();
  private activeEngine: TTSEngineType | null = null;
  private audioPlayer: AudioPlayer;
  private eventListeners: TTSEventCallback[] = [];
  
  // 播放状态
  private _state: TTSPlaybackState = {
    isPlaying: false,
    isPaused: false,
    currentMessageId: null,
    currentEngine: null,
    error: null,
  };
  
  // 使用新的播放队列管理
  private playbackQueue: PlaybackQueue = new PlaybackQueue();
  
  private constructor() {
    this.audioPlayer = new AudioPlayer();
    this.registerEngines();
    this.setupAudioCallbacks();
    
    // 异步初始化引擎
    this.initializeEngines();
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(): TTSManager {
    if (!TTSManager.instance) {
      TTSManager.instance = new TTSManager();
    }
    return TTSManager.instance;
  }
  
  /**
   * 注册所有引擎
   */
  private registerEngines(): void {
    const engines: ITTSEngine[] = [
      new CapacitorEngine(),
      new GeminiEngine(),
      new AzureEngine(),
      new OpenAIEngine(),
      new SiliconFlowEngine(),
      new ElevenLabsEngine(),
      new MiniMaxEngine(),
      new VolcanoEngine(),
      new WebSpeechEngine(),
    ];
    
    engines.forEach(engine => {
      this.engines.set(engine.name, engine);
    });
  }
  
  /**
   * 异步初始化所有引擎
   */
  private async initializeEngines(): Promise<void> {
    const initPromises = Array.from(this.engines.values()).map(async (engine) => {
      try {
        await engine.initialize();
        logger.debug(`✅ ${engine.name} 引擎初始化完成`);
      } catch (error) {
        logger.warn(`⚠️ ${engine.name} 引擎初始化失败:`, error);
      }
    });
    
    await Promise.allSettled(initPromises);
    logger.debug('🎵 TTS Manager 初始化完成');
  }
  
  /**
   * 设置音频播放回调
   */
  private setupAudioCallbacks(): void {
    this.audioPlayer.onEnd(() => {
      // 只有在使用AudioPlayer时才前进（非directPlay引擎）
      if (this._state.currentEngine && !this.isDirectPlayEngine(this._state.currentEngine)) {
        this.advanceOrFinish();
      }
    });
    
    this.audioPlayer.onError((error) => {
      this._state.error = error.message;
      this.stopInternal();
      this.emit({ type: 'error', error: error.message });
    });
  }
  
  /**
   * 检查是否为directPlay引擎
   */
  private isDirectPlayEngine(engineType: TTSEngineType): boolean {
    // Capacitor TTS和WebSpeech API是directPlay引擎
    return engineType === 'capacitor' || engineType === 'webspeech';
  }
  
  /**
   * 播放文本
   */
  async speak(text: string, messageId?: string): Promise<boolean> {
    // 停止当前播放
    if (this._state.isPlaying) {
      this.stop();
    }
    
    // 预处理文本
    const processedText = preprocessText(text);
    if (!processedText) {
      logger.warn('文本为空，无法播放');
      return false;
    }
    
    // 分块并设置到播放队列
    const chunks = chunkText(processedText);
    this.playbackQueue.setChunks(chunks);
    
    // 更新状态
    this._state = {
      isPlaying: true,
      isPaused: false,
      currentMessageId: messageId || null,
      currentEngine: null,
      error: null,
    };
    
    this.emit({ type: 'start', messageId });
    
    // 开始播放第一块
    return this.playNextChunk();
  }
  
  /**
   * 播放下一个分块
   */
  private async playNextChunk(): Promise<boolean> {
    logger.debug(`🎵 [DEBUG] playNextChunk called, currentIndex: ${this.playbackQueue.index}, isFinished: ${this.playbackQueue.isFinished()}`);
    
    // 检查是否已完成
    if (this.playbackQueue.isFinished()) {
      logger.debug(`🎵 [DEBUG] Playback finished, calling finishPlayback()`);
      this.finishPlayback();
      return true;
    }
    
    const chunk = this.playbackQueue.getCurrentChunk();
    if (!chunk) {
      logger.debug(`🎵 [DEBUG] No current chunk, calling finishPlayback()`);
      this.finishPlayback();
      return true;
    }
    
    logger.debug(`🎵 [DEBUG] Playing chunk: "${chunk.substring(0, 50)}..."`);
    
    // 如果有指定活动引擎，只使用该引擎
    if (this.activeEngine) {
      const active = this.engines.get(this.activeEngine);
      if (active?.isAvailable()) {
        try {
          logger.debug(`🎵 使用 ${active.name} 引擎播放`);
          const result = await active.synthesize(chunk);
          
          if (result.success) {
            this._state.currentEngine = active.name;
            
            // directPlay 表示 synthesize 已经播放完毕，需要手动前进
            if (result.directPlay) {
              logger.debug(`🎵 [DEBUG] DirectPlay engine completed, advancing to next chunk...`);
              
              // 直接前进到下一块，不需要额外调用speak
              if (this.playbackQueue.advance()) {
                logger.debug(`🎵 [DEBUG] Advanced to next chunk, continuing playback`);
                // 递归播放下一块
                return this.playNextChunk();
              } else {
                logger.debug(`🎵 [DEBUG] No more chunks, finishing playback`);
                // 已完成所有块
                this.finishPlayback();
                return true;
              }
            } else if (result.audioData) {
              const played = await this.audioPlayer.play(result.audioData, result.mimeType);
              if (played) return true;
            }
          }
        } catch (error) {
          logger.warn(`${active.name} 引擎播放失败:`, error);
        }
      }
    }
    
    // 没有活动引擎或活动引擎失败，按优先级尝试其他引擎
    const sortedEngines = Array.from(this.engines.values())
      .filter(e => e.isAvailable() && e.name !== this.activeEngine)
      .sort((a, b) => a.priority - b.priority);
    
    for (const engine of sortedEngines) {
      try {
        logger.debug(`🎵 降级到 ${engine.name} 引擎`);
        const result = await engine.synthesize(chunk);
        
        if (result.success) {
          this._state.currentEngine = engine.name;
          
          if (result.directPlay) {
            logger.debug(`🎵 [DEBUG] DirectPlay engine completed, advancing to next chunk...`);
            
            // 直接前进到下一块，不需要额外调用speak
            if (this.playbackQueue.advance()) {
              logger.debug(`🎵 [DEBUG] Advanced to next chunk, continuing playback`);
              // 递归播放下一块
              return this.playNextChunk();
            } else {
              logger.debug(`🎵 [DEBUG] No more chunks, finishing playback`);
              // 已完成所有块
              this.finishPlayback();
              return true;
            }
          } else if (result.audioData) {
            const played = await this.audioPlayer.play(result.audioData, result.mimeType);
            if (played) return true;
          }
        }
      } catch (error) {
        logger.warn(`${engine.name} 引擎播放失败:`, error);
      }
    }
    
    // 所有引擎都失败
    this._state.error = '所有 TTS 引擎播放失败';
    this.stopInternal();
    this.emit({ type: 'error', error: this._state.error });
    return false;
  }
  
  /**
   * 前进到下一块或完成
   */
  private advanceOrFinish(): void {
    logger.debug(`🎵 [DEBUG] advanceOrFinish called, paused: ${this.playbackQueue.paused}, index: ${this.playbackQueue.index}`);
    
    // 如果处于暂停状态，不前进
    if (this.playbackQueue.paused) {
      logger.debug(`🎵 [DEBUG] Queue is paused, not advancing`);
      return;
    }
    
    // 前进到下一块
    if (this.playbackQueue.advance()) {
      logger.debug(`🎵 [DEBUG] Advanced to next chunk, new index: ${this.playbackQueue.index}`);
      // 还有下一块，继续播放
      this.playNextChunk();
    } else {
      logger.debug(`🎵 [DEBUG] Cannot advance, calling finishPlayback()`);
      // 已完成所有块
      this.finishPlayback();
    }
  }
  
  /**
   * 完成播放
   */
  private finishPlayback(): void {
    const messageId = this._state.currentMessageId;
    this.stopInternal();
    this.emit({ type: 'end', messageId: messageId || undefined });
  }
  
  /**
   * 停止播放
   */
  stop(): void {
    // 停止所有引擎
    this.engines.forEach(engine => engine.stop());
    
    // 停止音频播放器
    this.audioPlayer.stop();
    
    this.stopInternal();
  }
  
  /**
   * 暂停播放
   */
  pause(): boolean {
    if (!this._state.isPlaying || this._state.isPaused) {
      return false;
    }
    
    // 暂停音频播放器
    this.audioPlayer.pause();
    
    // 暂停所有引擎（如果支持）
    this.engines.forEach(engine => {
      if ('pause' in engine && typeof engine.pause === 'function') {
        try {
          (engine as any).pause();
        } catch (error) {
          logger.warn('引擎暂停失败:', error);
        }
      }
    });
    
    // 同步播放队列状态
    this.playbackQueue.pause();
    
    // 更新状态
    this._state.isPaused = true;
    this.emit({ type: 'pause', messageId: this._state.currentMessageId || undefined });
    
    return true;
  }
  
  /**
   * 恢复播放
   */
  async resume(): Promise<boolean> {
    if (!this._state.isPaused) {
      return false;
    }
    
    try {
      // 同步播放队列状态
      this.playbackQueue.resume();
      
      // 恢复音频播放器
      if (this.audioPlayer.isPaused) {
        await this.audioPlayer.resume();
      } else {
        // 如果音频播放器没有暂停状态，需要重新播放当前块
        return this.playNextChunk();
      }
      
      // 恢复所有引擎（如果支持）
      this.engines.forEach(engine => {
        if ('resume' in engine && typeof engine.resume === 'function') {
          try {
            (engine as any).resume();
          } catch (error) {
            logger.warn('引擎恢复失败:', error);
          }
        }
      });
      
      // 更新状态
      this._state.isPaused = false;
      this.emit({ type: 'resume', messageId: this._state.currentMessageId || undefined });
      
      return true;
    } catch (error) {
      logger.error('恢复播放失败:', error);
      this._state.error = '恢复播放失败';
      this.emit({ type: 'error', error: this._state.error });
      return false;
    }
  }
  
  /**
   * 内部停止 (不停止引擎)
   */
  private stopInternal(): void {
    this.playbackQueue.reset();
    this._state = {
      isPlaying: false,
      isPaused: false,
      currentMessageId: null,
      currentEngine: null,
      error: this._state.error,
    };
  }
  
  /**
   * 设置活动引擎
   */
  setActiveEngine(type: TTSEngineType): void {
    if (this.engines.has(type)) {
      this.activeEngine = type;
    }
  }
  
  /**
   * 获取引擎
   */
  getEngine<T extends ITTSEngine>(type: TTSEngineType): T | undefined {
    return this.engines.get(type) as T | undefined;
  }
  
  /**
   * 配置引擎
   */
  configureEngine(type: TTSEngineType, config: Record<string, unknown>): void {
    const engine = this.engines.get(type);
    if (engine) {
      engine.updateConfig(config);
    }
  }
  
  /**
   * 获取播放进度
   */
  getProgress(): { current: number; total: number; percentage: number } | null {
    if (!this._state.isPlaying) {
      return null;
    }
    return this.playbackQueue.getProgress();
  }
  
  /**
   * 获取播放状态
   */
  get state(): TTSPlaybackState {
    return { ...this._state };
  }
  
  /**
   * 是否正在播放
   */
  get isPlaying(): boolean {
    return this._state.isPlaying;
  }
  
  /**
   * 当前消息 ID
   */
  get currentMessageId(): string | null {
    return this._state.currentMessageId;
  }
  
  /**
   * 添加事件监听
   */
  addEventListener(callback: TTSEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }
  
  /**
   * 触发事件
   */
  private emit(event: TTSEvent): void {
    this.eventListeners.forEach(cb => cb(event));
  }
  
  /**
   * 销毁
   */
  dispose(): void {
    this.stop();
    this.audioPlayer.dispose();
    this.eventListeners = [];
  }
}
