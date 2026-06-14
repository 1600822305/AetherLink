/**
 * 统一音频播放器
 * 处理音频数据的播放、暂停、停止
 */
import { createLogger } from '../../infra/logger';
const logger = createLogger('AudioPlayer');

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private currentBlobUrl: string | null = null;
  
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  
  // 事件回调
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  
  constructor() {
    this.initAudio();
  }
  
  private initAudio(): void {
    this.audio = new Audio();
    
    this.audio.onended = () => {
      this._isPlaying = false;
      this._isPaused = false;
      this.releaseBlobUrl();
      this.onEndCallback?.();
    };
    
    this.audio.onerror = () => {
      this._isPlaying = false;
      this._isPaused = false;
      this.releaseBlobUrl();
      this.onErrorCallback?.(new Error('Audio playback error'));
    };
    
    this.audio.onpause = () => {
      if (!this.audio?.ended) {
        this._isPaused = true;
      }
    };
    
    this.audio.onplay = () => {
      this._isPlaying = true;
      this._isPaused = false;
    };
    
    // 初始化 AudioContext (用于流式播放)
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      logger.warn('AudioContext 初始化失败:', e);
    }
  }
  
  /**
   * 播放音频数据
   */
  async play(audioData: ArrayBuffer, mimeType: string = 'audio/mpeg'): Promise<boolean> {
    if (!this.audio) return false;
    
    try {
      // 停止当前播放
      this.stop();
      
      // 创建 Blob URL
      const blob = new Blob([audioData], { type: mimeType });
      this.currentBlobUrl = URL.createObjectURL(blob);
      
      // 播放
      this.audio.src = this.currentBlobUrl;
      await this.audio.play();
      
      return true;
    } catch (error) {
      logger.error('播放失败:', error);
      this.releaseBlobUrl();
      return false;
    }
  }
  
  /**
   * 暂停播放
   */
  pause(): void {
    if (this.audio && this._isPlaying && !this._isPaused) {
      this.audio.pause();
      this._isPaused = true;
    }
  }
  
  /**
   * 恢复播放
   */
  async resume(): Promise<void> {
    if (this.audio && this._isPaused) {
      await this.audio.play();
      this._isPaused = false;
    }
  }
  
  /**
   * 停止播放
   */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    
    this._isPlaying = false;
    this._isPaused = false;
    this.releaseBlobUrl();
  }
  
  /**
   * 释放 Blob URL
   */
  private releaseBlobUrl(): void {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
  
  /**
   * 设置播放结束回调
   */
  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }
  
  /**
   * 设置错误回调
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }
  
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  
  get isPaused(): boolean {
    return this._isPaused;
  }
  
  /**
   * 获取 AudioContext (用于流式播放)
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
  
  /**
   * 销毁
   */
  dispose(): void {
    this.stop();
    
    if (this.audio) {
      this.audio.src = '';
      this.audio = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
