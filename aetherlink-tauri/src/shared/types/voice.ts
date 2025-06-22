export interface SpeechRecognitionResult {
  matches: string[];
}

export interface SpeechRecognitionPermissions {
  speechRecognition: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';
}

export interface SpeechRecognitionOptions {
  language?: string;
  maxResults?: number;
  partialResults?: boolean;
  popup?: boolean;
}

export interface VoiceRecognitionSettings {
  enabled: boolean;
  language: string;
  autoStart: boolean;
  silenceTimeout: number;
  maxResults: number;
  partialResults: boolean;
  permissionStatus: 'granted' | 'denied' | 'unknown';
  provider: 'capacitor' | 'openai';
}

// OpenAI Whisper API 相关类型
export interface OpenAIWhisperSettings {
  apiKey: string;
  showApiKey: boolean;
  model: string;
  language?: string;
  temperature?: number;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface WhisperTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}