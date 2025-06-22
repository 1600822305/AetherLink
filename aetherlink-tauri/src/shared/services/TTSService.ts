import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

/**
 * TTS服务类
 * 使用硅基流动TTS API、OpenAI TTS API、微软Azure TTS API和Web Speech API提供文本到语音转换功能
 */
export class TTSService {
  private static instance: TTSService;
  private audio: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private currentAudioBlob: string | null = null;
  private currentMessageId: string | null = null;

  // 配置加载状态
  private configLoaded: boolean = false;
  private configLoading: boolean = false;

  // 硅基流动API Key，实际应用中应从环境变量或安全存储中获取
  private siliconFlowApiKey: string = '';
  // 硅基流动流式输出设置
  private useSiliconFlowStream: boolean = false;

  // OpenAI API 设置
  private openaiApiKey: string = '';
  private useOpenAI: boolean = false;

  // OpenAI TTS 参数
  private openaiModel: string = 'tts-1'; // 可选: tts-1, tts-1-hd
  private openaiVoice: string = 'alloy'; // 可选: alloy, echo, fable, onyx, nova, shimmer
  private openaiResponseFormat: string = 'mp3'; // 可选: mp3, opus, aac, flac
  private openaiSpeed: number = 1.0; // 范围: 0.25-4.0
  private useOpenAIStream: boolean = false; // 是否使用流式输出

  // Azure TTS API 设置
  private azureApiKey: string = '';
  private azureRegion: string = 'eastus'; // Azure服务区域
  private useAzure: boolean = false;

  // Azure TTS 参数 - 完整的可控参数
  private azureVoiceName: string = 'zh-CN-XiaoxiaoNeural'; // 语音名称
  private azureLanguage: string = 'zh-CN'; // 语言代码
  private azureOutputFormat: string = 'audio-24khz-160kbitrate-mono-mp3'; // 输出格式
  private azureRate: string = 'medium'; // 语速: x-slow, slow, medium, fast, x-fast 或百分比
  private azurePitch: string = 'medium'; // 音调: x-low, low, medium, high, x-high 或Hz值
  private azureVolume: string = 'medium'; // 音量: silent, x-soft, soft, medium, loud, x-loud 或百分比
  private azureStyle: string = 'general'; // 说话风格: general, cheerful, sad, angry, excited, friendly, terrified, shouting, unfriendly, whispering, hopeful
  private azureStyleDegree: number = 1.0; // 风格强度: 0.01-2.0
  private azureRole: string = 'default'; // 角色扮演: default, Girl, Boy, YoungAdultFemale, YoungAdultMale, OlderAdultFemale, OlderAdultMale, SeniorFemale, SeniorMale
  private azureUseSSML: boolean = true; // 是否使用SSML标记语言

  // 默认使用的语音模型
  private defaultModel: string = 'FunAudioLLM/CosyVoice2-0.5B';
  // 默认使用的语音
  private defaultVoice: string = 'FunAudioLLM/CosyVoice2-0.5B:alex';

  // 音频上下文 - 用于流式播放
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private isStreamPlaying: boolean = false;

  /**
   * 构造函数
   */
  private constructor() {
    console.log('初始化TTSService');
    // 预加载语音
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    // 初始化音频元素
    this.audio = new Audio();
    this.audio.onended = () => {
      this.isPlaying = false;
      this.currentMessageId = null;
    };
    this.audio.onerror = () => {
      console.error('音频播放错误');
      this.isPlaying = false;
      this.currentMessageId = null;
    };

    // 尝试初始化AudioContext (用于流式播放)
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext初始化失败，流式播放可能不可用', e);
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  /**
   * 设置硅基流动API密钥
   * @param apiKey API密钥
   */
  public setApiKey(apiKey: string): void {
    this.siliconFlowApiKey = apiKey;
  }

  /**
   * 设置是否使用硅基流动流式输出
   * @param useStream 是否使用流式输出
   */
  public setUseSiliconFlowStream(useStream: boolean): void {
    this.useSiliconFlowStream = useStream;
  }

  /**
   * 设置OpenAI API密钥
   * @param apiKey API密钥
   */
  public setOpenAIApiKey(apiKey: string): void {
    this.openaiApiKey = apiKey;
  }

  /**
   * 设置是否使用OpenAI TTS
   * @param useOpenAI 是否使用OpenAI
   */
  public setUseOpenAI(useOpenAI: boolean): void {
    this.useOpenAI = useOpenAI;
  }

  /**
   * 设置Azure API密钥
   * @param apiKey API密钥
   */
  public setAzureApiKey(apiKey: string): void {
    this.azureApiKey = apiKey;
  }

  /**
   * 设置Azure服务区域
   * @param region 服务区域 (如: eastus, westus2, eastasia等)
   */
  public setAzureRegion(region: string): void {
    this.azureRegion = region;
  }

  /**
   * 设置是否使用Azure TTS
   * @param useAzure 是否使用Azure
   */
  public setUseAzure(useAzure: boolean): void {
    this.useAzure = useAzure;
  }

  /**
   * 设置Azure语音名称
   * @param voiceName 语音名称 (如: zh-CN-XiaoxiaoNeural, en-US-JennyNeural等)
   */
  public setAzureVoiceName(voiceName: string): void {
    this.azureVoiceName = voiceName;
  }

  /**
   * 设置Azure语言
   * @param language 语言代码 (如: zh-CN, en-US等)
   */
  public setAzureLanguage(language: string): void {
    this.azureLanguage = language;
  }

  /**
   * 设置Azure输出格式
   * @param format 输出格式
   */
  public setAzureOutputFormat(format: string): void {
    this.azureOutputFormat = format;
  }

  /**
   * 设置Azure语速
   * @param rate 语速 (x-slow, slow, medium, fast, x-fast 或百分比如 +20%)
   */
  public setAzureRate(rate: string): void {
    this.azureRate = rate;
  }

  /**
   * 设置Azure音调
   * @param pitch 音调 (x-low, low, medium, high, x-high 或Hz值如 +50Hz)
   */
  public setAzurePitch(pitch: string): void {
    this.azurePitch = pitch;
  }

  /**
   * 设置Azure音量
   * @param volume 音量 (silent, x-soft, soft, medium, loud, x-loud 或百分比)
   */
  public setAzureVolume(volume: string): void {
    this.azureVolume = volume;
  }

  /**
   * 设置Azure说话风格
   * @param style 说话风格
   */
  public setAzureStyle(style: string): void {
    this.azureStyle = style;
  }

  /**
   * 设置Azure风格强度
   * @param degree 风格强度 (0.01-2.0)
   */
  public setAzureStyleDegree(degree: number): void {
    this.azureStyleDegree = Math.max(0.01, Math.min(2.0, degree));
  }

  /**
   * 设置Azure角色扮演
   * @param role 角色
   */
  public setAzureRole(role: string): void {
    this.azureRole = role;
  }

  /**
   * 设置是否使用SSML
   * @param useSSML 是否使用SSML
   */
  public setAzureUseSSML(useSSML: boolean): void {
    this.azureUseSSML = useSSML;
  }

  /**
   * 设置OpenAI模型
   * @param model 模型名称 (tts-1, tts-1-hd)
   */
  public setOpenAIModel(model: string): void {
    this.openaiModel = model;
  }

  /**
   * 设置OpenAI语音
   * @param voice 语音名称 (alloy, echo, fable, onyx, nova, shimmer)
   */
  public setOpenAIVoice(voice: string): void {
    this.openaiVoice = voice;
  }

  /**
   * 设置OpenAI响应格式
   * @param format 格式类型 (mp3, opus, aac, flac)
   */
  public setOpenAIResponseFormat(format: string): void {
    this.openaiResponseFormat = format;
  }

  /**
   * 设置OpenAI语速
   * @param speed 语速 (0.25-4.0)
   */
  public setOpenAISpeed(speed: number): void {
    // 确保语速在有效范围内
    if (speed < 0.25) speed = 0.25;
    if (speed > 4.0) speed = 4.0;
    this.openaiSpeed = speed;
  }

  /**
   * 设置是否使用OpenAI流式输出
   * @param useStream 是否使用流式输出
   */
  public setUseOpenAIStream(useStream: boolean): void {
    this.useOpenAIStream = useStream;
  }

  /**
   * 设置默认语音模型和音色
   * @param model 模型名称
   * @param voice 语音名称
   */
  public setDefaultVoice(model: string, voice: string): void {
    if (model) {
      this.defaultModel = model;
    }
    if (voice) {
      this.defaultVoice = voice;
    }
  }

  /**
   * 全局初始化TTS配置（只执行一次）
   * @returns Promise<boolean> 是否初始化成功
   */
  public async initializeConfig(): Promise<boolean> {
    // 如果已经加载过配置，直接返回
    if (this.configLoaded) {
      return true;
    }

    // 如果正在加载，等待加载完成
    if (this.configLoading) {
      return new Promise((resolve) => {
        const checkLoaded = () => {
          if (this.configLoaded) {
            resolve(true);
          } else if (!this.configLoading) {
            resolve(false);
          } else {
            setTimeout(checkLoaded, 50);
          }
        };
        checkLoaded();
      });
    }

    this.configLoading = true;

    try {
      // 动态导入storage工具，避免循环依赖
      const { getStorageItem } = await import('../utils/storage');

      // 从 Dexie 加载TTS配置
      const [apiKey, model, voice, enabled] = await Promise.all([
        getStorageItem<string>('siliconflow_api_key'),
        getStorageItem<string>('tts_model'),
        getStorageItem<string>('tts_voice'),
        getStorageItem<string>('enable_tts')
      ]);

      // 设置配置
      if (apiKey) {
        this.setApiKey(apiKey);
      }
      if (model) {
        this.defaultModel = model;
      }
      if (voice) {
        this.defaultVoice = voice.includes(':') ? voice : `${model || this.defaultModel}:${voice}`;
      }

      this.configLoaded = true;
      this.configLoading = false;

      // 只在开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 TTSService全局配置初始化完成:', {
          hasApiKey: !!apiKey,
          model: this.defaultModel,
          voice: this.defaultVoice,
          enabled: enabled !== 'false'
        });
      }

      return true;
    } catch (error) {
      console.error('TTSService配置初始化失败:', error);
      this.configLoading = false;
      return false;
    }
  }

  /**
   * 检查配置是否已加载
   * @returns boolean 配置是否已加载
   */
  public isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  /**
   * 停止当前播放
   */
  public stop(): void {
    // 停止Audio元素播放
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }

    // 停止Web Speech API播放
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 停止流式播放
    this.stopStream();

    this.isPlaying = false;
    this.currentMessageId = null;

    // 释放Blob URL
    this.releaseBlobUrl();
  }

  /**
   * 释放Blob URL资源
   */
  private releaseBlobUrl(): void {
    if (this.currentAudioBlob) {
      URL.revokeObjectURL(this.currentAudioBlob);
      this.currentAudioBlob = null;
    }
  }

  /**
   * 清理所有资源
   */
  public dispose(): void {
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

  /**
   * 停止流式播放
   */
  private stopStream(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        console.error('停止音频源时出错', e);
      }
      this.sourceNode = null;
    }

    this.isStreamPlaying = false;
  }

  /**
   * 获取播放状态
   */
  public getIsPlaying(): boolean {
    return this.isPlaying || this.isStreamPlaying;
  }

  /**
   * 获取当前播放的消息ID
   */
  public getCurrentMessageId(): string | null {
    return this.currentMessageId;
  }

  /**
   * 切换播放状态
   * @param messageId 消息ID
   * @param text 要播放的文本
   * @param voice 语音名称
   * @returns 是否正在播放
   */
  public async togglePlayback(messageId: string, text: string, voice: string = this.defaultVoice): Promise<boolean> {
    // 如果当前正在播放此消息，则停止播放
    if ((this.isPlaying || this.isStreamPlaying) && this.currentMessageId === messageId) {
      this.stop();
      return false;
    }

    // 如果正在播放其他消息，先停止
    if (this.isPlaying || this.isStreamPlaying) {
      this.stop();
    }

    // 开始播放新消息
    const success = await this.speak(text, voice);
    if (success) {
      this.currentMessageId = messageId;
    }
    return success;
  }

  /**
   * 播放文本
   * @param text 要播放的文本
   * @param voice 语音名称，不指定则使用默认语音
   * @returns 是否成功开始播放
   */
  public async speak(text: string, voice: string = this.defaultVoice): Promise<boolean> {
    try {
      // 如果正在播放，先停止
      if (this.isPlaying || this.isStreamPlaying) {
        this.stop();
      }

      // 确保文本不为空
      if (!text || text.trim() === '') {
        console.error('文本为空，无法播放');
        return false;
      }

      console.log(`开始播放文本，语音: ${voice}`);
      this.isPlaying = true;

      // 首先检查是否使用Azure TTS
      if (this.useAzure) {
        const success = await this.speakWithAzure(text);
        if (success) return true;
      }

      // 然后检查是否使用OpenAI TTS
      if (this.useOpenAI) {
        // 决定是否使用流式输出
        if (this.useOpenAIStream && this.audioContext) {
          const streamSuccess = await this.speakWithOpenAIStream(text);
          if (streamSuccess) return true;
        } else {
          const success = await this.speakWithOpenAI(text);
          if (success) return true;
        }
      }

      // 然后尝试使用硅基流动API
      if (await this.speakWithSiliconFlow(text, voice)) {
        return true;
      }

      // 如果硅基流动API失败，尝试使用Web Speech API
      if (this.speakWithWebSpeechAPI(text, voice)) {
        return true;
      }

      // 如果所有方法都失败
      console.warn('所有TTS方法播放失败');
      this.isPlaying = false;
      return false;
    } catch (error) {
      console.error('播放文本失败:', error);
      this.isPlaying = false;
      this.currentMessageId = null;
      return false;
    }
  }

  /**
   * 使用OpenAI TTS API播放文本 (标准方式)
   * @param text 要播放的文本
   * @returns 是否成功播放
   */
  private async speakWithOpenAI(text: string): Promise<boolean> {
    try {
      // 检查API密钥是否已设置
      if (!this.openaiApiKey) {
        console.warn('OpenAI API密钥未设置，尝试其他方法');
        return false;
      }

      // 准备API请求参数
      const url = 'https://api.openai.com/v1/audio/speech';
      const requestBody = {
        model: this.openaiModel,
        input: text,
        voice: this.openaiVoice,
        response_format: this.openaiResponseFormat,
        speed: this.openaiSpeed
      };

      console.log('OpenAI TTS请求参数:', {
        model: this.openaiModel,
        voice: this.openaiVoice,
        response_format: this.openaiResponseFormat,
        speed: this.openaiSpeed
      });

      // 发送API请求
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI TTS API请求失败:', response.status, errorData);
        return false;
      }

      // 获取音频数据
      const audioBlob = await response.blob();

      // 释放之前的Blob URL
      this.releaseBlobUrl();

      // 创建新的Blob URL
      this.currentAudioBlob = URL.createObjectURL(audioBlob);

      // 播放音频
      if (this.audio) {
        this.audio.src = this.currentAudioBlob;
        try {
          await this.audio.play();
        } catch (error) {
          console.error('OpenAI TTS API播放失败:', error);
          this.isPlaying = false;
          return false;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('OpenAI TTS API播放失败:', error);
      return false;
    }
  }

  /**
   * 使用OpenAI TTS API流式播放文本
   * @param text 要播放的文本
   * @returns 是否成功播放
   */
  private async speakWithOpenAIStream(text: string): Promise<boolean> {
    try {
      // 检查API密钥是否已设置
      if (!this.openaiApiKey) {
        console.warn('OpenAI API密钥未设置，尝试其他方法');
        return false;
      }

      // 确保AudioContext可用
      if (!this.audioContext) {
        console.warn('AudioContext不可用，无法使用流式播放');
        return false;
      }

      // 准备API请求参数
      const url = 'https://api.openai.com/v1/audio/speech';
      const requestBody = {
        model: this.openaiModel,
        input: text,
        voice: this.openaiVoice,
        response_format: this.openaiResponseFormat,
        speed: this.openaiSpeed,
        stream: true  // 流式播放必需参数
      };

      console.log('OpenAI TTS流式请求参数:', {
        model: this.openaiModel,
        voice: this.openaiVoice,
        response_format: this.openaiResponseFormat,
        speed: this.openaiSpeed
      });

      // 发送API请求，设置stream:true
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI TTS API流式请求失败:', response.status, errorData);
        return false;
      }

      // 重置流式播放状态
      this.stopStream();
      this.isStreamPlaying = true;

      // 获取响应体作为流
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('无法获取响应流');
        return false;
      }

      // 根据不同格式选择解码器
      let mimeType = 'audio/mp3';
      switch(this.openaiResponseFormat) {
        case 'mp3': mimeType = 'audio/mp3'; break;
        case 'opus': mimeType = 'audio/opus'; break;
        case 'aac': mimeType = 'audio/aac'; break;
        case 'flac': mimeType = 'audio/flac'; break;
      }

      // 创建媒体源和解码器
      const mediaSource = new MediaSource();
      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(mediaSource);

      // 收集所有块，然后一次性解码和播放
      // 这种方法虽然不是实时流式播放，但比等待整个文件下载快
      const chunks: Uint8Array[] = [];

      // 读取流
      const processStream = async () => {
        let done = false;
        while (!done) {
          const { value, done: isDone } = await reader.read();
          done = isDone;

          if (value) {
            chunks.push(value);
          }

          if (done) {
            // 合并所有块
            const totalLength = chunks.reduce((acc, val) => acc + val.length, 0);
            const merged = new Uint8Array(totalLength);
            let offset = 0;

            for (const chunk of chunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }

            // 创建Blob并播放
            const blob = new Blob([merged], { type: mimeType });
            const url = URL.createObjectURL(blob);

            if (this.audio) {
              this.audio.src = url;
              try {
                await this.audio.play();
                
                // 监听播放完成事件
                this.audio.onended = () => {
                  URL.revokeObjectURL(url);
                  this.isStreamPlaying = false;
                  this.currentMessageId = null;
                };
                
                return true;
              } catch (error) {
                console.error('OpenAI TTS API流式播放失败:', error);
                URL.revokeObjectURL(url);
                this.isStreamPlaying = false;
                return false;
              }
            }
          }
        }

        return false;
      };

      // 开始处理流
      processStream().catch(err => {
        console.error('处理音频流时出错:', err);
        this.isStreamPlaying = false;
      });

      return true;
    } catch (error) {
      console.error('OpenAI TTS API流式播放失败:', error);
      this.isStreamPlaying = false;
      return false;
    }
  }

  /**
   * 使用硅基流动API播放文本
   * @param text 要播放的文本
   * @param voiceName 语音名称
   * @returns 是否成功播放
   */
  private async speakWithSiliconFlow(text: string, voiceName: string): Promise<boolean> {
    try {
      // 检查API密钥是否已设置
      if (!this.siliconFlowApiKey) {
        console.warn('硅基流动API密钥未设置，尝试其他方法');
        return false;
      }

      // 准备API请求参数
      const url = 'https://api.siliconflow.cn/v1/audio/speech';
      const model = this.defaultModel;

      // 处理语音参数：硅基流动需要 "模型名:音色名" 格式
      let voice = voiceName || this.defaultVoice;

      // 如果voice不包含模型名，则添加模型名前缀
      if (voice && !voice.includes(':')) {
        voice = `${model}:${voice}`;
      }

      console.log('硅基流动TTS请求参数:', {
        model,
        voice,
        textLength: text.length,
        useStream: this.useSiliconFlowStream
      });
      console.log('硅基流动TTS文本内容:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

      const requestBody = {
        model: model,
        input: text,
        voice: voice,
        response_format: 'mp3',
        stream: this.useSiliconFlowStream // 添加流式输出参数
      };

      console.log('硅基流动TTS完整请求体:', JSON.stringify(requestBody, null, 2));

      // 根据是否使用流式输出选择不同的处理方式
      if (this.useSiliconFlowStream) {
        return await this.speakWithSiliconFlowStream(url, requestBody);
      } else {
        return await this.speakWithSiliconFlowNormal(url, requestBody);
      }
    } catch (error) {
      console.error('硅基流动API播放失败:', error);
      return false;
    }
  }

  /**
   * 使用硅基流动API播放文本 (标准模式)
   * @param url API地址
   * @param requestBody 请求体
   * @returns 是否成功播放
   */
  private async speakWithSiliconFlowNormal(url: string, requestBody: any): Promise<boolean> {
    try {

      // 发送API请求
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.siliconFlowApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('硅基流动API请求失败:', response.status, errorData);
        return false;
      }

      // 获取音频数据
      const audioBlob = await response.blob();

      // 释放之前的Blob URL
      this.releaseBlobUrl();

      // 创建新的Blob URL
      this.currentAudioBlob = URL.createObjectURL(audioBlob);

      // 播放音频
      if (this.audio) {
        this.audio.src = this.currentAudioBlob;
        try {
          await this.audio.play();
        } catch (error) {
          console.error('硅基流动API播放失败:', error);
          this.isPlaying = false;
          return false;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('硅基流动API标准模式播放失败:', error);
      return false;
    }
  }

  /**
   * 使用硅基流动API播放文本 (流式模式)
   * @param url API地址
   * @param requestBody 请求体
   * @returns 是否成功播放
   */
  private async speakWithSiliconFlowStream(url: string, requestBody: any): Promise<boolean> {
    try {
      console.log('硅基流动TTS开始流式播放...');

      // 检查AudioContext是否可用
      if (!this.audioContext) {
        console.warn('AudioContext不可用，回退到标准模式');
        return await this.speakWithSiliconFlowNormal(url, { ...requestBody, stream: false });
      }

      // 发送流式API请求
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.siliconFlowApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('硅基流动API流式请求失败:', response.status, errorData);
        return false;
      }

      // 处理流式响应
      if (response.body) {
        this.isStreamPlaying = true;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
              chunks.push(value);
              // 可以在这里实现实时播放逻辑
              // 目前先收集所有数据块，然后一次性播放
            }
          }

          // 合并所有音频数据块
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const audioData = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            audioData.set(chunk, offset);
            offset += chunk.length;
          }

          // 创建音频Blob并播放
          const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });

          // 释放之前的Blob URL
          this.releaseBlobUrl();

          // 创建新的Blob URL
          this.currentAudioBlob = URL.createObjectURL(audioBlob);

          // 播放音频
          if (this.audio) {
            this.audio.src = this.currentAudioBlob;
            try {
              await this.audio.play();
              console.log('硅基流动TTS流式播放成功');
              return true;
            } catch (error) {
              console.error('硅基流动API流式播放失败:', error);
              this.isStreamPlaying = false;
              return false;
            }
          }

          return false;
        } finally {
          reader.releaseLock();
          this.isStreamPlaying = false;
        }
      } else {
        console.error('响应体为空');
        return false;
      }
    } catch (error) {
      console.error('硅基流动API流式模式播放失败:', error);
      this.isStreamPlaying = false;
      return false;
    }
  }

  /**
   * 使用Web Speech API播放文本
   * @param text 要播放的文本
   * @param voiceName 语音名称
   * @returns 是否成功播放
   */
  private speakWithWebSpeechAPI(text: string, voiceName: string): boolean {
    try {
      // 检查浏览器是否支持Web Speech API
      if (!('speechSynthesis' in window)) {
        console.error('浏览器不支持Web Speech API');
        return false;
      }

      // 取消当前正在播放的语音
      window.speechSynthesis.cancel();

      // 创建语音合成器实例
      const utterance = new SpeechSynthesisUtterance(text);

      // 获取可用的语音合成声音
      let voices = window.speechSynthesis.getVoices();
      console.log('可用的语音合成声音:', voices);

      // 如果voices为空，可能是因为还没有加载完成
      if (voices.length === 0) {
        // 设置一个超时，等待语音加载
        setTimeout(() => {
          voices = window.speechSynthesis.getVoices();
          this.setVoiceAndPlay(utterance, voices, voiceName);
        }, 100);
        return true;
      }

      // 如果已有voices，直接设置并播放
      return this.setVoiceAndPlay(utterance, voices, voiceName);
    } catch (error) {
      console.error('Web Speech API播放失败:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * 设置语音并播放
   * @param utterance SpeechSynthesisUtterance 实例
   * @param voices 可用的语音列表
   * @param voiceName 语音名称
   * @returns 是否成功播放
   */
  private setVoiceAndPlay(utterance: SpeechSynthesisUtterance, voices: SpeechSynthesisVoice[], voiceName: string): boolean {
    try {
      // 查找指定的语音
      let selectedVoice = voices.find((v) => v.name === voiceName);

      // 如果没有找到指定的语音，尝试使用中文语音
      if (!selectedVoice) {
        console.warn('未找到指定的语音:', voiceName);
        // 尝试找中文语音
        selectedVoice = voices.find((v) => v.lang === 'zh-CN');

        if (selectedVoice) {
          console.log('使用替代中文语音:', selectedVoice.name);
        } else if (voices.length > 0) {
          // 如果没有中文语音，使用第一个可用的语音
          selectedVoice = voices[0];
          console.log('使用第一个可用的语音:', selectedVoice.name);
        } else {
          console.warn('没有可用的语音');
          this.isPlaying = false;
          return false;
        }
      } else {
        console.log('使用指定语音:', selectedVoice.name);
      }

      // 设置语音
      utterance.voice = selectedVoice;

      // 设置其他可选参数
      utterance.rate = 1; // 语速
      utterance.pitch = 1; // 音调
      utterance.volume = 1; // 音量

      // 设置事件处理程序
      utterance.onend = () => {
        console.log('语音播放结束');
        this.isPlaying = false;
        this.currentMessageId = null;
      };

      utterance.onerror = (event) => {
        console.error('语音播放错误:', event);
        this.isPlaying = false;
        this.currentMessageId = null;
      };

      // 开始语音合成
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('设置语音失败:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * 使用Azure TTS API播放文本
   * @param text 要播放的文本
   * @returns 是否成功播放
   */
  private async speakWithAzure(text: string): Promise<boolean> {
    try {
      // 检查API密钥是否已设置
      if (!this.azureApiKey || !this.azureRegion) {
        console.warn('Azure API密钥或区域未设置，尝试其他方法');
        return false;
      }

      console.log('Azure TTS请求参数:', {
        region: this.azureRegion,
        voiceName: this.azureVoiceName,
        language: this.azureLanguage,
        outputFormat: this.azureOutputFormat,
        rate: this.azureRate,
        pitch: this.azurePitch,
        volume: this.azureVolume,
        style: this.azureStyle,
        styleDegree: this.azureStyleDegree,
        role: this.azureRole,
        useSSML: this.azureUseSSML
      });

      // 创建语音配置
      const speechConfig = sdk.SpeechConfig.fromSubscription(this.azureApiKey, this.azureRegion);
      speechConfig.speechSynthesisOutputFormat = this.getAzureOutputFormat();
      speechConfig.speechSynthesisVoiceName = this.azureVoiceName;

      // 创建音频配置 - 使用默认扬声器输出
      const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();

      // 创建语音合成器
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

      // 准备要合成的文本
      let textToSpeak = text;

      // 如果启用SSML，构建SSML文本
      if (this.azureUseSSML) {
        textToSpeak = this.buildSSMLText(text);
      }

      console.log('Azure TTS开始合成，文本长度:', textToSpeak.length);

      // 执行语音合成
      return new Promise<boolean>((resolve) => {
        const startTime = Date.now();

        if (this.azureUseSSML) {
          synthesizer.speakSsmlAsync(
            textToSpeak,
            (result) => {
              const duration = Date.now() - startTime;
              console.log(`Azure TTS合成完成，耗时: ${duration}ms`);

              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                console.log('Azure TTS语音合成成功');
                this.isPlaying = false;
                this.currentMessageId = null;
                resolve(true);
              } else {
                console.error('Azure TTS语音合成失败:', result.errorDetails);
                this.isPlaying = false;
                resolve(false);
              }
              synthesizer.close();
            },
            (error) => {
              console.error('Azure TTS合成错误:', error);
              this.isPlaying = false;
              synthesizer.close();
              resolve(false);
            }
          );
        } else {
          synthesizer.speakTextAsync(
            textToSpeak,
            (result) => {
              const duration = Date.now() - startTime;
              console.log(`Azure TTS合成完成，耗时: ${duration}ms`);

              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                console.log('Azure TTS语音合成成功');
                this.isPlaying = false;
                this.currentMessageId = null;
                resolve(true);
              } else {
                console.error('Azure TTS语音合成失败:', result.errorDetails);
                this.isPlaying = false;
                resolve(false);
              }
              synthesizer.close();
            },
            (error) => {
              console.error('Azure TTS合成错误:', error);
              this.isPlaying = false;
              synthesizer.close();
              resolve(false);
            }
          );
        }
      });

    } catch (error) {
      console.error('Azure TTS播放失败:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * 构建SSML文本
   * @param text 原始文本
   * @returns SSML格式的文本
   */
  private buildSSMLText(text: string): string {
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${this.azureLanguage}">`;

    // 添加语音标签
    ssml += `<voice name="${this.azureVoiceName}">`;

    // 添加韵律控制
    const prosodyAttrs = [];
    if (this.azureRate !== 'medium') prosodyAttrs.push(`rate="${this.azureRate}"`);
    if (this.azurePitch !== 'medium') prosodyAttrs.push(`pitch="${this.azurePitch}"`);
    if (this.azureVolume !== 'medium') prosodyAttrs.push(`volume="${this.azureVolume}"`);

    if (prosodyAttrs.length > 0) {
      ssml += `<prosody ${prosodyAttrs.join(' ')}>`;
    }

    // 添加说话风格（如果支持）
    if (this.azureStyle !== 'general' && this.azureVoiceName.includes('Neural')) {
      const styleAttrs = [`style="${this.azureStyle}"`];
      if (this.azureStyleDegree !== 1.0) {
        styleAttrs.push(`styledegree="${this.azureStyleDegree}"`);
      }
      if (this.azureRole !== 'default') {
        styleAttrs.push(`role="${this.azureRole}"`);
      }
      ssml += `<mstts:express-as ${styleAttrs.join(' ')}>`;
    }

    // 添加文本内容，转义特殊字符
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    ssml += escapedText;

    // 关闭标签
    if (this.azureStyle !== 'general' && this.azureVoiceName.includes('Neural')) {
      ssml += '</mstts:express-as>';
    }

    if (prosodyAttrs.length > 0) {
      ssml += '</prosody>';
    }

    ssml += '</voice>';
    ssml += '</speak>';

    console.log('构建的SSML:', ssml);
    return ssml;
  }

  /**
   * 获取Azure输出格式枚举值
   * @returns Azure SDK的输出格式枚举
   */
  private getAzureOutputFormat(): sdk.SpeechSynthesisOutputFormat {
    const formatMap: Record<string, sdk.SpeechSynthesisOutputFormat> = {
      'audio-16khz-32kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3,
      'audio-16khz-64kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3,
      'audio-16khz-128kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3,
      'audio-24khz-48kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3,
      'audio-24khz-96kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3,
      'audio-24khz-160kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3,
      'audio-48khz-96kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3,
      'audio-48khz-192kbitrate-mono-mp3': sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3,
      'webm-16khz-16bit-mono-opus': sdk.SpeechSynthesisOutputFormat.Webm16Khz16BitMonoOpus,
      'webm-24khz-16bit-mono-opus': sdk.SpeechSynthesisOutputFormat.Webm24Khz16BitMonoOpus,
      'ogg-16khz-16bit-mono-opus': sdk.SpeechSynthesisOutputFormat.Ogg16Khz16BitMonoOpus,
      'ogg-24khz-16bit-mono-opus': sdk.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus,
      'raw-16khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm,
      'raw-24khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm,
      'raw-48khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm,
      'riff-16khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm,
      'riff-24khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm,
      'riff-48khz-16bit-mono-pcm': sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm
    };

    return formatMap[this.azureOutputFormat] || sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;
  }
}