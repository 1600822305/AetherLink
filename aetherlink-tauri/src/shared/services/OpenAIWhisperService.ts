import type {
  WhisperTranscriptionResponse
} from '../types/voice';

/**
 * OpenAI Whisper语音识别服务类
 * 负责处理与OpenAI Whisper API的通信
 */
class OpenAIWhisperService {
  private static instance: OpenAIWhisperService;
  private apiKey: string = '';
  private model: string = 'whisper-1';
  private language?: string;
  private temperature: number = 0;
  private responseFormat: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt' = 'json';

  private constructor() {}

  public static getInstance(): OpenAIWhisperService {
    if (!OpenAIWhisperService.instance) {
      OpenAIWhisperService.instance = new OpenAIWhisperService();
    }
    return OpenAIWhisperService.instance;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  public setModel(model: string): void {
    this.model = model;
  }

  public setLanguage(language?: string): void {
    this.language = language;
  }

  public setTemperature(temperature: number): void {
    this.temperature = temperature;
  }

  public setResponseFormat(format: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'): void {
    this.responseFormat = format;
  }

  /**
   * 使用OpenAI Whisper API转录音频文件
   * @param audioBlob 音频Blob数据
   * @returns 转录结果
   */
  public async transcribeAudio(audioBlob: Blob): Promise<WhisperTranscriptionResponse> {
    if (!this.apiKey) {
      throw new Error('API密钥未设置，请先设置API密钥');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', this.model);

    if (this.language) {
      formData.append('language', this.language);
    }

    formData.append('temperature', this.temperature.toString());
    formData.append('response_format', this.responseFormat);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API错误: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result as WhisperTranscriptionResponse;
  }

  /**
   * 录制音频并使用Whisper API进行转录
   * @param durationMs 录制时长(毫秒)，默认为5000ms
   * @returns 转录结果
   */
  public async recordAndTranscribe(durationMs: number = 5000): Promise<WhisperTranscriptionResponse> {
    try {
      // 请求麦克风权限并开始录制
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunks.push(event.data);
      });

      // 开始录制
      mediaRecorder.start();
      console.log('开始录制音频...');

      // 设置录制时长
      await new Promise(resolve => setTimeout(resolve, durationMs));

      // 停止录制
      return new Promise((resolve, reject) => {
        mediaRecorder.addEventListener('stop', async () => {
          try {
            // 停止所有轨道
            stream.getTracks().forEach(track => track.stop());

            // 创建音频Blob
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            // 调用Whisper API转录
            const transcription = await this.transcribeAudio(audioBlob);
            resolve(transcription);
          } catch (error) {
            reject(error);
          }
        });

        mediaRecorder.stop();
      });
    } catch (error) {
      console.error('录制或转录失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用的模型列表
   * @returns 模型列表
   */
  public getAvailableModels(): string[] {
    return ['whisper-1'];
  }
}

export const openAIWhisperService = OpenAIWhisperService.getInstance();