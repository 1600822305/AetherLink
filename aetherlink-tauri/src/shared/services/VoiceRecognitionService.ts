import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { getStorageItem, setStorageItem } from '../utils/storage';
import type {
  SpeechRecognitionOptions,
  SpeechRecognitionPermissions,
} from '../types/voice';
import { openAIWhisperService } from './OpenAIWhisperService';

/**
 * 语音识别服务类，支持多种提供者
 */
class VoiceRecognitionService {
  private static instance: VoiceRecognitionService;
  private isListening: boolean = false;
  private partialResultsCallback: ((text: string) => void) | null = null;
  private errorCallback: ((error: any) => void) | null = null;
  private listeningStateCallback: ((state: 'started' | 'stopped') => void) | null = null;
  private provider: 'capacitor' | 'openai' = 'capacitor'; // 默认使用Capacitor
  private recordingDuration: number = 5000; // OpenAI Whisper录音时长(毫秒)
  private recordingTimeoutId: number | null = null;
  private recordingStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];
  private isWebEnvironment: boolean = false; // 是否在Web环境中
  private webSpeechRecognition: SpeechRecognition | null = null; // Web Speech API 实例

  private constructor() {
    // 检测是否在Web环境中 - 强制在浏览器中使用Web API
    const hasWindow = typeof window !== 'undefined';
    const isInBrowser = hasWindow && typeof navigator !== 'undefined' && !!navigator.userAgent;
    this.isWebEnvironment = isInBrowser;



    // 初始化Web Speech API (如果在Web环境且浏览器支持)
    if (this.isWebEnvironment && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.webSpeechRecognition = new SpeechRecognitionAPI();

      if (this.webSpeechRecognition) {
        this.webSpeechRecognition.continuous = true;
        this.webSpeechRecognition.interimResults = true;

        this.webSpeechRecognition.onresult = (event) => {
          if (this.provider !== 'capacitor') return;

          const result = event.results[event.results.length - 1];
          if (result.isFinal && this.partialResultsCallback) {
            this.partialResultsCallback(result[0].transcript);
          } else if (this.partialResultsCallback) {
            this.partialResultsCallback(result[0].transcript);
          }
        };

        this.webSpeechRecognition.onend = () => {
          if (this.provider !== 'capacitor') return;

          this.isListening = false;
          if (this.listeningStateCallback) {
            this.listeningStateCallback('stopped');
          }
        };

        this.webSpeechRecognition.onerror = (event) => {
          if (this.provider !== 'capacitor') return;

          this.isListening = false;
          if (this.listeningStateCallback) {
            this.listeningStateCallback('stopped');
          }
          if (this.errorCallback) {
            this.errorCallback(new Error(`语音识别错误: ${event.error}`));
          }
        };
      }
    }

    // 初始化时从存储加载提供者
    this.loadProvider();

    // 为Capacitor添加语音识别事件监听
    if (!this.isWebEnvironment) {
      SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (this.provider !== 'capacitor') return;

        if (data.matches && data.matches.length > 0 && this.partialResultsCallback) {
          this.partialResultsCallback(data.matches[0]);
        }
      });
    }
  }

  /**
   * 从存储中加载语音识别提供者
   */
  private async loadProvider() {
    try {
      const storedProvider = await getStorageItem<string>('speech_recognition_provider');
      if (storedProvider === 'openai' || storedProvider === 'capacitor') {
        this.provider = storedProvider;
      }
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): VoiceRecognitionService {
    if (!VoiceRecognitionService.instance) {
      VoiceRecognitionService.instance = new VoiceRecognitionService();
    }
    return VoiceRecognitionService.instance;
  }

  /**
   * 设置语音识别提供者
   */
  public async setProvider(provider: 'capacitor' | 'openai') {
    if (this.isListening) {
      await this.stopRecognition();
    }
    this.provider = provider;
    await setStorageItem('speech_recognition_provider', provider);
  }

  /**
   * 获取当前语音识别提供者
   */
  public getProvider(): 'capacitor' | 'openai' {
    return this.provider;
  }

  /**
   * 检查语音识别权限
   */
  public async checkPermissions(): Promise<SpeechRecognitionPermissions> {
    if (this.provider === 'capacitor') {
      // Web环境使用Web API
      if (this.isWebEnvironment) {
        try {
          // 优先使用 Permissions API 来检查权限状态，避免触发权限请求
          if ('permissions' in navigator) {
            try {
              const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
              if (permissionStatus.state === 'granted') {
                return { speechRecognition: 'granted' };
              } else if (permissionStatus.state === 'denied') {
                return { speechRecognition: 'denied' };
              } else {
                return { speechRecognition: 'prompt' };
              }
            } catch (permError) {
              return { speechRecognition: 'unknown' };
            }
          } else {
            // 如果不支持 Permissions API，返回 unknown，让 requestPermissions 处理
            return { speechRecognition: 'unknown' };
          }
        } catch (error) {
          // 如果 Permissions API 失败，返回 unknown
          return { speechRecognition: 'unknown' };
        }
      } else {
        // 非Web环境使用Capacitor
        try {
          return await SpeechRecognition.checkPermissions();
        } catch (error) {
          return { speechRecognition: 'unknown' };
        }
      }
    } else {
      // OpenAI Whisper使用Web API，所以需要检查麦克风权限
      try {
        // 优先使用 Permissions API
        if ('permissions' in navigator) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'granted') {
            return { speechRecognition: 'granted' };
          } else if (permissionStatus.state === 'denied') {
            return { speechRecognition: 'denied' };
          } else {
            return { speechRecognition: 'prompt' };
          }
        } else {
          return { speechRecognition: 'unknown' };
        }
      } catch (error) {
        return { speechRecognition: 'unknown' };
      }
    }
  }

  /**
   * 请求语音识别权限
   */
  public async requestPermissions(): Promise<SpeechRecognitionPermissions> {
    if (this.provider === 'capacitor') {
      // Web环境使用Web API
      if (this.isWebEnvironment) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // 立即停止，只是为了请求权限
          return { speechRecognition: 'granted' };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            return { speechRecognition: 'denied' };
          }
          return { speechRecognition: 'denied' };
        }
      } else {
        // 非Web环境使用Capacitor
        try {
          return await SpeechRecognition.requestPermissions();
        } catch (error) {
          return { speechRecognition: 'denied' };
        }
      }
    } else {
      // OpenAI Whisper使用Web API，通过尝试访问麦克风来请求权限
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // 立即停止，只是为了请求权限
        return { speechRecognition: 'granted' };
      } catch (error) {

        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          return { speechRecognition: 'denied' };
        }
        return { speechRecognition: 'denied' };
      }
    }
  }

  /**
   * 检查语音识别是否可用
   */
  public isVoiceRecognitionAvailable(): boolean {
    if (this.provider === 'capacitor') {
      if (this.isWebEnvironment) {
        // Web环境检查
        const hasWebSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' ||
                               window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';



        return hasWebSpeechAPI && isSecureContext && !!this.webSpeechRecognition;
      } else {
        // 移动环境，假设Capacitor可用
        return true;
      }
    } else {
      // OpenAI Whisper需要麦克风权限
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
  }

  /**
   * 开始语音识别
   */
  public async startRecognition(options?: SpeechRecognitionOptions): Promise<void> {
    // 如果已经在录音，先停止
    if (this.isListening) {
      try {
        await this.stopRecognition();
        // 添加小延迟，确保之前的录音完全停止
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        // 继续尝试新的录音
      }
    }

    if (!this.isVoiceRecognitionAvailable()) {
      const error = new Error('语音识别在当前环境下不可用');
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      throw error;
    }

    try {
      this.isListening = true;
      if (this.listeningStateCallback) {
        this.listeningStateCallback('started');
      }

      if (this.provider === 'capacitor') {
        if (this.isWebEnvironment && this.webSpeechRecognition) {
          // 为Web Speech API设置事件监听器
          this.webSpeechRecognition.onend = () => {
            // 有时Web Speech API会自动停止，需要确保更新状态
            if (this.isListening) {
              this.isListening = false;
              if (this.listeningStateCallback) {
                this.listeningStateCallback('stopped');
              }
            }
          };

          this.webSpeechRecognition.onerror = (event) => {
            if (this.isListening) {
              this.isListening = false;
              if (this.listeningStateCallback) {
                this.listeningStateCallback('stopped');
              }
            }
            if (this.errorCallback) {
              this.errorCallback(new Error(`语音识别错误: ${event.error}`));
            }
          };

          this.webSpeechRecognition.lang = options?.language || 'zh-CN';
          try {
            this.webSpeechRecognition.start();
          } catch (err) {
            this.isListening = false;
            if (this.listeningStateCallback) {
              this.listeningStateCallback('stopped');
            }
            throw err;
          }
        } else {
          await SpeechRecognition.start({
            language: options?.language || 'zh-CN',
            maxResults: options?.maxResults || 5,
            partialResults: options?.partialResults !== false,
            popup: options?.popup || false,
          });
        }
      } else {
        await this.startWhisperRecognition();
      }
    } catch (error) {
      this.isListening = false;
      if (this.listeningStateCallback) {
        this.listeningStateCallback('stopped');
      }
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      throw error;
    }
  }

  /**
   * 使用OpenAI Whisper开始语音识别
   */
  private async startWhisperRecognition(): Promise<void> {
    try {
      // 请求麦克风权限并开始录制
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.recordingStream);
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        this.audioChunks.push(event.data);
      });

      this.mediaRecorder.addEventListener('stop', async () => {
        try {
          // 创建音频Blob
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

          // 停止所有轨道
          if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
            this.recordingStream = null;
          }

          // 加载Whisper设置
          await this.loadWhisperSettings();

          // 调用Whisper API转录
          const transcription = await openAIWhisperService.transcribeAudio(audioBlob);

          // 如果有部分结果回调，发送结果
          if (this.partialResultsCallback && transcription.text) {
            this.partialResultsCallback(transcription.text);
          }
        } catch (error) {
          if (this.errorCallback) {
            this.errorCallback(error);
          }
        } finally {
          this.isListening = false;
          if (this.listeningStateCallback) {
            this.listeningStateCallback('stopped');
          }
          this.mediaRecorder = null;
        }
      });

      // 开始录制
      this.mediaRecorder.start();

      // 设置定时器自动停止录制
      this.recordingTimeoutId = window.setTimeout(() => {
        this.stopWhisperRecording();
      }, this.recordingDuration);
    } catch (error) {
      this.isListening = false;
      if (this.listeningStateCallback) {
        this.listeningStateCallback('stopped');
      }
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      throw error;
    }
  }

  /**
   * 停止Whisper录音
   */
  private stopWhisperRecording(): void {
    if (this.recordingTimeoutId) {
      clearTimeout(this.recordingTimeoutId);
      this.recordingTimeoutId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * 加载Whisper设置
   */
  private async loadWhisperSettings(): Promise<void> {
    try {
      const apiKey = await getStorageItem<string>('whisper_api_key') || '';
      const model = await getStorageItem<string>('whisper_model') || 'whisper-1';
      const language = await getStorageItem<string>('whisper_language');
      const temperature = Number(await getStorageItem<string>('whisper_temperature') || '0');
      const responseFormat = await getStorageItem<string>('whisper_response_format') || 'json';

      openAIWhisperService.setApiKey(apiKey);
      openAIWhisperService.setModel(model);
      if (language) {
        openAIWhisperService.setLanguage(language);
      }
      openAIWhisperService.setTemperature(temperature);
      openAIWhisperService.setResponseFormat(responseFormat as any);
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 停止语音识别
   */
  public async stopRecognition(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      // 先设置状态为false和通知监听器，防止重复调用
      this.isListening = false;
      if (this.listeningStateCallback) {
        this.listeningStateCallback('stopped');
      }

      if (this.provider === 'capacitor') {
        if (this.isWebEnvironment && this.webSpeechRecognition) {
          try {
            this.webSpeechRecognition.stop();
          } catch (err) {
            // 静默处理错误
          }
        } else {
          await SpeechRecognition.stop().catch(() => {
            // 静默处理错误
          });
        }
      } else {
        this.stopWhisperRecording();
      }
    } catch (error) {
      // 即使出错，也确保状态被设置为stopped
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      // 不再抛出错误，因为这会导致调用方需要额外的错误处理
    }
  }

  /**
   * 设置部分结果回调
   */
  public setPartialResultsCallback(callback: (text: string) => void): void {
    this.partialResultsCallback = callback;
  }

  /**
   * 设置监听状态回调
   */
  public setListeningStateCallback(callback: (state: 'started' | 'stopped') => void): void {
    this.listeningStateCallback = callback;
  }

  /**
   * 设置错误回调
   */
  public setErrorCallback(callback: (error: any) => void): void {
    this.errorCallback = callback;
  }

  /**
   * 获取当前监听状态
   */
  public getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * 获取支持的语言
   */
  public async getSupportedLanguages(): Promise<string[]> {
    if (this.provider === 'capacitor') {
      // Web环境
      if (this.isWebEnvironment) {
        // 常见语言代码列表
        return [
          'zh-CN', 'en-US', 'fr-FR', 'de-DE', 'ja-JP', 'ko-KR',
          'es-ES', 'it-IT', 'pt-BR', 'ru-RU'
        ];
      } else {
        // 非Web环境
        try {
          const result = await SpeechRecognition.getSupportedLanguages();
          return result.languages || [];
        } catch (error) {
          return [];
        }
      }
    } else {
      // OpenAI Whisper支持的语言列表
      return [
        'zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt', 'it', 'nl', 'tr', 'pl', 'ar',
        'hi', 'id', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no',
        'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn',
        'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk',
        'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be',
        'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa',
        'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su'
      ];
    }
  }

  /**
   * 设置OpenAI Whisper录音时长
   */
  public setRecordingDuration(durationMs: number): void {
    this.recordingDuration = durationMs;
  }
}

export const voiceRecognitionService = VoiceRecognitionService.getInstance();