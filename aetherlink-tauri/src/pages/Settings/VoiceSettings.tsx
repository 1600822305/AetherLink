import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  AppBar,
  Toolbar,
  Alert,
  FormControlLabel,
  FormHelperText,
  Tabs,
  Tab,

  Chip
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import {
  ArrowLeft,
  Volume2,
  Mic,
  Square
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { TTSService } from '../../shared/services/TTSService';
import { getStorageItem, setStorageItem } from '../../shared/utils/storage';
import {
  SiliconFlowTTSTab,
  OpenAITTSTab,
  AzureTTSTab,
  type SiliconFlowTTSSettings,
  type OpenAITTSSettings,
  type AzureTTSSettings,
} from '../../components/TTS';
import TTSTestSection from '../../components/TTS/TTSTestSection'; // 导入 TTSTestSection
import { useVoiceRecognition } from '../../shared/hooks/useVoiceRecognition'; // 导入 useVoiceRecognition
import type { VoiceRecognitionSettings, OpenAIWhisperSettings } from '../../shared/types/voice'; // 导入语音识别类型
import { OpenAIWhisperTab, WhisperTestSection } from '../../components/VoiceRecognition'; // 导入OpenAI Whisper组件
import { voiceRecognitionService } from '../../shared/services/VoiceRecognitionService'; // 导入语音识别服务

// 🚀 性能优化：定义状态类型，便于状态合并

interface UIState {
  mainTabValue: number; // 主Tab索引
  ttsSubTabValue: number; // TTS子Tab索引
  sttSubTabValue: number; // 新增：STT子Tab索引
  isSaved: boolean;
  saveError: string;
  isTestPlaying: boolean;
}

// 语音设置组件
const VoiceSettings: React.FC = () => {
  const navigate = useNavigate();

  // 🚀 性能优化：使用 useMemo 缓存 TTSService 实例
  const ttsService = useMemo(() => TTSService.getInstance(), []);

  // 🚀 性能优化：使用 useRef 管理定时器，避免内存泄漏
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🚀 性能优化：合并相关状态，减少重新渲染次数
  const [siliconFlowSettings, setSiliconFlowSettings] = useState<SiliconFlowTTSSettings>({
    apiKey: '',
    showApiKey: false,
    selectedModel: 'FunAudioLLM/CosyVoice2-0.5B',
    selectedVoice: 'alex',
    useStream: false, // 默认不启用流式输出
  });

  const [openaiSettings, setOpenaiSettings] = useState<OpenAITTSSettings>({
    apiKey: '',
    showApiKey: false,
    selectedModel: 'tts-1',
    selectedVoice: 'alloy',
    selectedFormat: 'mp3',
    speed: 1.0,
    useStream: false,
  });

  const [uiState, setUIState] = useState<UIState>({
    mainTabValue: 0, // 默认显示TTS Tab
    ttsSubTabValue: 0, // 默认显示硅基流动TTS
    sttSubTabValue: 0, // 默认显示Capacitor语音识别
    isSaved: false,
    saveError: '',
    isTestPlaying: false,
  });

  // 语音识别相关状态
  const [speechRecognitionSettings, setSpeechRecognitionSettings] = useState<VoiceRecognitionSettings>({
    enabled: true,
    language: 'zh-CN',
    autoStart: false,
    silenceTimeout: 2000,
    maxResults: 5,
    partialResults: true,
    permissionStatus: 'unknown',
    provider: 'capacitor', // 默认使用Capacitor
  });

  // OpenAI Whisper设置
  const [whisperSettings, setWhisperSettings] = useState<OpenAIWhisperSettings>({
    apiKey: '',
    showApiKey: false,
    model: 'whisper-1',
    language: 'zh',
    temperature: 0,
    responseFormat: 'json',
  });

  const [azureSettings, setAzureSettings] = useState<AzureTTSSettings>({
    apiKey: '',
    showApiKey: false,
    region: 'eastus',
    voiceName: 'zh-CN-XiaoxiaoNeural',
    language: 'zh-CN',
    outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
    rate: 'medium',
    pitch: 'medium',
    volume: 'medium',
    style: 'general',
    styleDegree: 1.0,
    role: 'default',
    useSSML: true,
  });

  // 其他独立状态
  const [testText, setTestText] = useState('你好，我是语音合成服务，感谢你的使用！');
  const [enableTTS, setEnableTTS] = useState(true);
  const [selectedTTSService, setSelectedTTSService] = useState<'siliconflow' | 'openai' | 'azure'>('siliconflow');
  const [useOpenai, setUseOpenai] = useState(false);
  const [useAzure, setUseAzure] = useState(false);

  // 引入语音识别hook
  const {
    isListening,
    recognitionText,
    permissionStatus,
    error,
    startRecognition,
    stopRecognition,
  } = useVoiceRecognition();

  // 🚀 性能优化：只在组件挂载时加载设置，避免重复调用
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log('[VoiceSettings] 开始加载设置...');

        // 加载基础设置
        const storedApiKey = await getStorageItem<string>('siliconflow_api_key') || '';
        const storedModel = await getStorageItem<string>('tts_model') || 'FunAudioLLM/CosyVoice2-0.5B';
        const storedVoice = await getStorageItem<string>('tts_voice') || 'alex';
        const storedUseStream = (await getStorageItem<string>('siliconflow_tts_stream')) === 'true';
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false'; // 默认启用

        // 加载OpenAI设置
        const storedOpenaiApiKey = await getStorageItem<string>('openai_tts_api_key') || '';
        const storedOpenaiModel = await getStorageItem<string>('openai_tts_model') || 'tts-1';
        const storedOpenaiVoice = await getStorageItem<string>('openai_tts_voice') || 'alloy';
        const storedOpenaiFormat = await getStorageItem<string>('openai_tts_format') || 'mp3';
        const storedOpenaiSpeed = Number(await getStorageItem<string>('openai_tts_speed') || '1.0');
        const storedUseOpenaiStream = (await getStorageItem<string>('openai_tts_stream')) === 'true';
        const storedUseOpenai = (await getStorageItem<string>('use_openai_tts')) === 'true';

        // 加载Azure设置
        const storedAzureApiKey = await getStorageItem<string>('azure_tts_api_key') || '';
        const storedAzureRegion = await getStorageItem<string>('azure_tts_region') || 'eastus';
        const storedAzureVoiceName = await getStorageItem<string>('azure_tts_voice') || 'zh-CN-XiaoxiaoNeural';
        const storedAzureLanguage = await getStorageItem<string>('azure_tts_language') || 'zh-CN';
        const storedAzureOutputFormat = await getStorageItem<string>('azure_tts_format') || 'audio-24khz-160kbitrate-mono-mp3';
        const storedAzureRate = await getStorageItem<string>('azure_tts_rate') || 'medium';
        const storedAzurePitch = await getStorageItem<string>('azure_tts_pitch') || 'medium';
        const storedAzureVolume = await getStorageItem<string>('azure_tts_volume') || 'medium';
        const storedAzureStyle = await getStorageItem<string>('azure_tts_style') || 'general';
        const storedAzureStyleDegree = parseFloat(await getStorageItem<string>('azure_tts_style_degree') || '1.0');
        const storedAzureRole = await getStorageItem<string>('azure_tts_role') || 'default';
        const storedAzureUseSSML = (await getStorageItem<string>('azure_tts_use_ssml')) !== 'false'; // 默认启用
        const storedUseAzure = (await getStorageItem<string>('use_azure_tts')) === 'true';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        // 加载语音识别设置
        const storedSpeechRecognitionEnabled = (await getStorageItem<string>('speech_recognition_enabled')) !== 'false'; // 默认启用
        const storedSpeechRecognitionLanguage = await getStorageItem<string>('speech_recognition_language') || 'zh-CN';
        const storedSpeechRecognitionAutoStart = (await getStorageItem<string>('speech_recognition_auto_start')) === 'true';
        const storedSpeechRecognitionSilenceTimeout = Number(await getStorageItem<string>('speech_recognition_silence_timeout') || '2000');
        const storedSpeechRecognitionMaxResults = Number(await getStorageItem<string>('speech_recognition_max_results') || '5');
        const storedSpeechRecognitionPartialResults = (await getStorageItem<string>('speech_recognition_partial_results')) !== 'false'; // 默认启用
        const storedSpeechRecognitionProvider = await getStorageItem<string>('speech_recognition_provider') || 'capacitor';

        // 加载OpenAI Whisper设置
        const storedWhisperApiKey = await getStorageItem<string>('whisper_api_key') || '';
        const storedWhisperModel = await getStorageItem<string>('whisper_model') || 'whisper-1';
        const storedWhisperLanguage = await getStorageItem<string>('whisper_language') || 'zh';
        const storedWhisperTemperature = Number(await getStorageItem<string>('whisper_temperature') || '0');
        const storedWhisperResponseFormat = await getStorageItem<string>('whisper_response_format') || 'json';

        // 🚀 性能优化：批量更新状态，减少重新渲染
        setSiliconFlowSettings({
          apiKey: storedApiKey,
          showApiKey: false,
          selectedModel: storedModel,
          selectedVoice: storedVoice,
          useStream: storedUseStream,
        });

        setOpenaiSettings({
          apiKey: storedOpenaiApiKey,
          showApiKey: false,
          selectedModel: storedOpenaiModel,
          selectedVoice: storedOpenaiVoice,
          selectedFormat: storedOpenaiFormat,
          speed: storedOpenaiSpeed,
          useStream: storedUseOpenaiStream,
        });

        // 根据选择的服务设置TTS子Tab索引
        let ttsTabIndex = 0;
        if (storedSelectedTTSService === 'openai') ttsTabIndex = 1;
        else if (storedSelectedTTSService === 'azure') ttsTabIndex = 2;

        setUIState(prev => ({
          ...prev,
          ttsSubTabValue: ttsTabIndex,
        }));

        // 设置Azure状态
        setAzureSettings({
          apiKey: storedAzureApiKey,
          showApiKey: false,
          region: storedAzureRegion,
          voiceName: storedAzureVoiceName,
          language: storedAzureLanguage,
          outputFormat: storedAzureOutputFormat,
          rate: storedAzureRate,
          pitch: storedAzurePitch,
          volume: storedAzureVolume,
          style: storedAzureStyle,
          styleDegree: storedAzureStyleDegree,
          role: storedAzureRole,
          useSSML: storedAzureUseSSML,
        });

        setEnableTTS(storedEnableTTS);
        setUseOpenai(storedUseOpenai);
        setUseAzure(storedUseAzure);
        setSelectedTTSService(storedSelectedTTSService as 'siliconflow' | 'openai' | 'azure');

        // 设置TTSService
        ttsService.setApiKey(storedApiKey);
        ttsService.setOpenAIApiKey(storedOpenaiApiKey);
        ttsService.setOpenAIModel(storedOpenaiModel);
        ttsService.setOpenAIVoice(storedOpenaiVoice);
        ttsService.setOpenAIResponseFormat(storedOpenaiFormat);
        ttsService.setOpenAISpeed(storedOpenaiSpeed);
        ttsService.setUseOpenAIStream(storedUseOpenaiStream);
        ttsService.setUseOpenAI(storedUseOpenai);

        // 设置Azure TTS
        ttsService.setAzureApiKey(storedAzureApiKey);
        ttsService.setAzureRegion(storedAzureRegion);
        ttsService.setAzureVoiceName(storedAzureVoiceName);
        ttsService.setAzureLanguage(storedAzureLanguage);
        ttsService.setAzureOutputFormat(storedAzureOutputFormat);
        ttsService.setAzureRate(storedAzureRate);
        ttsService.setAzurePitch(storedAzurePitch);
        ttsService.setAzureVolume(storedAzureVolume);
        ttsService.setAzureStyle(storedAzureStyle);
        ttsService.setAzureStyleDegree(storedAzureStyleDegree);
        ttsService.setAzureRole(storedAzureRole);
        ttsService.setAzureUseSSML(storedAzureUseSSML);
        ttsService.setUseAzure(storedUseAzure);

        if (storedModel && storedVoice) {
          ttsService.setDefaultVoice(storedModel, `${storedModel}:${storedVoice}`);
        }

        // 更新语音识别设置
        setSpeechRecognitionSettings({
          enabled: storedSpeechRecognitionEnabled,
          language: storedSpeechRecognitionLanguage,
          autoStart: storedSpeechRecognitionAutoStart,
          silenceTimeout: storedSpeechRecognitionSilenceTimeout,
          maxResults: storedSpeechRecognitionMaxResults,
          partialResults: storedSpeechRecognitionPartialResults,
          permissionStatus: 'unknown', // 将在组件加载后更新
          provider: storedSpeechRecognitionProvider as 'capacitor' | 'openai',
        });

        // 更新OpenAI Whisper设置
        setWhisperSettings({
          apiKey: storedWhisperApiKey,
          showApiKey: false,
          model: storedWhisperModel,
          language: storedWhisperLanguage,
          temperature: storedWhisperTemperature,
          responseFormat: storedWhisperResponseFormat as any,
        });

        console.log('[VoiceSettings] 设置加载完成');
      } catch (error) {
        console.error('加载语音设置失败:', error);
      }
    };

    loadSettings();
  }, []); // 🚀 空依赖数组，只在组件挂载时执行一次

  // 🚀 性能优化：使用 useCallback 缓存函数，避免子组件不必要的重新渲染
  const handleBack = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  // 🚀 性能优化：使用 useCallback 缓存保存函数
  const handleSave = useCallback(async () => {
    try {
      // 保存到异步存储
      await setStorageItem('siliconflow_api_key', siliconFlowSettings.apiKey);
      await setStorageItem('tts_model', siliconFlowSettings.selectedModel);
      await setStorageItem('tts_voice', siliconFlowSettings.selectedVoice);
      await setStorageItem('siliconflow_tts_stream', siliconFlowSettings.useStream.toString());
      await setStorageItem('enable_tts', enableTTS.toString());

      // 保存OpenAI设置
      await setStorageItem('openai_tts_api_key', openaiSettings.apiKey);
      await setStorageItem('openai_tts_model', openaiSettings.selectedModel);
      await setStorageItem('openai_tts_voice', openaiSettings.selectedVoice);
      await setStorageItem('openai_tts_format', openaiSettings.selectedFormat);
      await setStorageItem('openai_tts_speed', openaiSettings.speed.toString());
      await setStorageItem('openai_tts_stream', openaiSettings.useStream.toString());
      await setStorageItem('use_openai_tts', useOpenai.toString());

      // 保存Azure设置
      await setStorageItem('azure_tts_api_key', azureSettings.apiKey);
      await setStorageItem('azure_tts_region', azureSettings.region);
      await setStorageItem('azure_tts_voice', azureSettings.voiceName);
      await setStorageItem('azure_tts_language', azureSettings.language);
      await setStorageItem('azure_tts_format', azureSettings.outputFormat);
      await setStorageItem('azure_tts_rate', azureSettings.rate);
      await setStorageItem('azure_tts_pitch', azureSettings.pitch);
      await setStorageItem('azure_tts_volume', azureSettings.volume);
      await setStorageItem('azure_tts_style', azureSettings.style);
      await setStorageItem('azure_tts_style_degree', azureSettings.styleDegree.toString());
      await setStorageItem('azure_tts_role', azureSettings.role);
      await setStorageItem('azure_tts_use_ssml', azureSettings.useSSML.toString());
      await setStorageItem('use_azure_tts', useAzure.toString());
      await setStorageItem('selected_tts_service', selectedTTSService);

      // 保存语音识别设置
      await setStorageItem('speech_recognition_enabled', speechRecognitionSettings.enabled.toString());
      await setStorageItem('speech_recognition_language', speechRecognitionSettings.language);
      await setStorageItem('speech_recognition_auto_start', speechRecognitionSettings.autoStart.toString());
      await setStorageItem('speech_recognition_silence_timeout', speechRecognitionSettings.silenceTimeout.toString());
      await setStorageItem('speech_recognition_max_results', speechRecognitionSettings.maxResults.toString());
      await setStorageItem('speech_recognition_partial_results', speechRecognitionSettings.partialResults.toString());
      await setStorageItem('speech_recognition_provider', speechRecognitionSettings.provider);

      // 保存OpenAI Whisper设置
      await setStorageItem('whisper_api_key', whisperSettings.apiKey);
      await setStorageItem('whisper_model', whisperSettings.model);
      await setStorageItem('whisper_language', whisperSettings.language || '');
      await setStorageItem('whisper_temperature', whisperSettings.temperature?.toString() || '0');
      await setStorageItem('whisper_response_format', whisperSettings.responseFormat || 'json');

      // 更新TTSService
      ttsService.setApiKey(siliconFlowSettings.apiKey);
      ttsService.setUseSiliconFlowStream(siliconFlowSettings.useStream);
      ttsService.setDefaultVoice(siliconFlowSettings.selectedModel, `${siliconFlowSettings.selectedModel}:${siliconFlowSettings.selectedVoice}`);

      // 更新OpenAI设置
      ttsService.setOpenAIApiKey(openaiSettings.apiKey);
      ttsService.setOpenAIModel(openaiSettings.selectedModel);
      ttsService.setOpenAIVoice(openaiSettings.selectedVoice);
      ttsService.setOpenAIResponseFormat(openaiSettings.selectedFormat);
      ttsService.setOpenAISpeed(openaiSettings.speed);
      ttsService.setUseOpenAIStream(openaiSettings.useStream);
      ttsService.setUseOpenAI(useOpenai);

      // 更新Azure设置
      ttsService.setAzureApiKey(azureSettings.apiKey);
      ttsService.setAzureRegion(azureSettings.region);
      ttsService.setAzureVoiceName(azureSettings.voiceName);
      ttsService.setAzureLanguage(azureSettings.language);
      ttsService.setAzureOutputFormat(azureSettings.outputFormat);
      ttsService.setAzureRate(azureSettings.rate);
      ttsService.setAzurePitch(azureSettings.pitch);
      ttsService.setAzureVolume(azureSettings.volume);
      ttsService.setAzureStyle(azureSettings.style);
      ttsService.setAzureStyleDegree(azureSettings.styleDegree);
      ttsService.setAzureRole(azureSettings.role);
      ttsService.setAzureUseSSML(azureSettings.useSSML);
      ttsService.setUseAzure(useAzure);

      // 🚀 性能优化：使用 ref 管理定时器，避免内存泄漏
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 显示保存成功提示
      setUIState(prev => ({
        ...prev,
        isSaved: true,
        saveError: '',
      }));

      // 3秒后隐藏提示
      saveTimeoutRef.current = setTimeout(() => {
        setUIState(prev => ({
          ...prev,
          isSaved: false,
        }));
      }, 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      setUIState(prev => ({
        ...prev,
        saveError: '保存设置失败，请重试',
      }));
    }
  }, [siliconFlowSettings, openaiSettings, azureSettings, enableTTS, useOpenai, useAzure, selectedTTSService, ttsService, speechRecognitionSettings, whisperSettings]);

  // 🚀 防抖自动保存功能 (暂时注释，未使用)
  // const debouncedAutoSave = useCallback(() => {
  //   if (autoSaveTimeoutRef.current) {
  //     clearTimeout(autoSaveTimeoutRef.current);
  //   }
  //   autoSaveTimeoutRef.current = setTimeout(() => {
  //     console.log('🔄 自动保存设置...');
  //     handleSave();
  //   }, 2000); // 2秒防抖
  // }, [handleSave]);

  // 🚀 性能优化：使用 useCallback 缓存测试TTS函数
  const handleTestTTS = useCallback(async () => {
    if (uiState.isTestPlaying) {
      ttsService.stop();
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    setUIState(prev => ({ ...prev, isTestPlaying: true }));

    // 根据选择的服务设置TTS
    ttsService.setUseOpenAI(selectedTTSService === 'openai');
    ttsService.setUseAzure(selectedTTSService === 'azure');

    if (selectedTTSService === 'azure') {
      // 使用Azure TTS
      ttsService.setAzureApiKey(azureSettings.apiKey);
      ttsService.setAzureRegion(azureSettings.region);
      ttsService.setAzureVoiceName(azureSettings.voiceName);
      ttsService.setAzureLanguage(azureSettings.language);
      ttsService.setAzureOutputFormat(azureSettings.outputFormat);
      ttsService.setAzureRate(azureSettings.rate);
      ttsService.setAzurePitch(azureSettings.pitch);
      ttsService.setAzureVolume(azureSettings.volume);
      ttsService.setAzureStyle(azureSettings.style);
      ttsService.setAzureStyleDegree(azureSettings.styleDegree);
      ttsService.setAzureRole(azureSettings.role);
      ttsService.setAzureUseSSML(azureSettings.useSSML);
    } else if (selectedTTSService === 'openai') {
      // 使用OpenAI TTS
      ttsService.setOpenAIApiKey(openaiSettings.apiKey);
      ttsService.setOpenAIModel(openaiSettings.selectedModel);
      ttsService.setOpenAIVoice(openaiSettings.selectedVoice);
      ttsService.setOpenAIResponseFormat(openaiSettings.selectedFormat);
      ttsService.setOpenAISpeed(openaiSettings.speed);
      ttsService.setUseOpenAIStream(openaiSettings.useStream);
    } else {
      // 使用硅基流动TTS
      ttsService.setApiKey(siliconFlowSettings.apiKey);
      ttsService.setUseSiliconFlowStream(siliconFlowSettings.useStream);
      ttsService.setDefaultVoice(siliconFlowSettings.selectedModel, `${siliconFlowSettings.selectedModel}:${siliconFlowSettings.selectedVoice}`);
    }

    const success = await ttsService.speak(testText);

    if (!success) {
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
    }

    // 🚀 性能优化：使用 ref 管理定时器，避免内存泄漏
    if (playCheckIntervalRef.current) {
      clearInterval(playCheckIntervalRef.current);
    }

    // 监听播放结束 - 优化：减少轮询频率，使用递归检查
    const checkPlaybackStatus = () => {
      if (!ttsService.getIsPlaying()) {
        setUIState(prev => ({ ...prev, isTestPlaying: false }));
        if (playCheckIntervalRef.current) {
          clearInterval(playCheckIntervalRef.current);
          playCheckIntervalRef.current = null;
        }
      } else {
        // 递归检查，但增加间隔时间到1秒
        playCheckIntervalRef.current = setTimeout(checkPlaybackStatus, 1000);
      }
    };

    // 延迟开始检查，给播放一些时间
    setTimeout(checkPlaybackStatus, 1000);
  }, [uiState.isTestPlaying, selectedTTSService, azureSettings, openaiSettings, siliconFlowSettings, testText, ttsService]);

  // 🚀 性能优化：使用 useCallback 缓存主Tab变化处理函数
  const handleMainTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setUIState(prev => ({ ...prev, mainTabValue: newValue }));
  }, []);

  // 🚀 性能优化：使用 useCallback 缓存TTS子Tab变化处理函数
  const handleTTSSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setUIState(prev => ({ ...prev, ttsSubTabValue: newValue }));

    // 根据Tab索引更新服务选择
    let service: 'siliconflow' | 'openai' | 'azure' = 'siliconflow';
    if (newValue === 1) service = 'openai';
    else if (newValue === 2) service = 'azure';

    setSelectedTTSService(service);
    setUseOpenai(service === 'openai');
    setUseAzure(service === 'azure');
  }, []);

  // 新增：STT子Tab变化处理函数
  const handleSTTSubTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setUIState(prev => ({ ...prev, sttSubTabValue: newValue }));

    // 根据Tab索引更新语音识别提供者
    const provider = newValue === 0 ? 'capacitor' : 'openai';
    setSpeechRecognitionSettings(prev => ({
      ...prev,
      provider
    }));
  }, []);

  // 🚀 新增：服务选择器变化时同步TTS子Tab
  const handleServiceChange = useCallback((value: string) => {
    setSelectedTTSService(value as 'siliconflow' | 'openai' | 'azure');

    // 更新旧的状态以保持兼容性
    const isOpenAI = value === 'openai';
    const isAzure = value === 'azure';
    setUseOpenai(isOpenAI);
    setUseAzure(isAzure);

    // 更新TTS子Tab索引
    let ttsTabIndex = 0;
    if (value === 'openai') ttsTabIndex = 1;
    else if (value === 'azure') ttsTabIndex = 2;

    setUIState(prev => ({ ...prev, ttsSubTabValue: ttsTabIndex }));
  }, []);

  // 🚀 性能优化：组件卸载时清理定时器和资源
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      // 停止正在播放的测试音频
      if (uiState.isTestPlaying) {
        ttsService.stop();
      }
    };
  }, [uiState.isTestPlaying, ttsService]);

  // 检查并请求麦克风权限函数
  const checkAndRequestPermissions = async () => {
    try {
      const result = await voiceRecognitionService.requestPermissions();
      console.log('权限状态:', result);
    } catch (error) {
      console.error('请求权限失败:', error);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh', // 固定视口高度
      width: '100vw', // 固定视口宽度
      overflow: 'hidden', // 防止整体页面滚动
      bgcolor: 'background.default'
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)', // iOS Safari支持
          background: 'rgba(255, 255, 255, 0.8)',
          '@media (prefers-color-scheme: dark)': {
            background: 'rgba(18, 18, 18, 0.8)',
          },
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 }, // 移动端更紧凑
            px: { xs: 1, sm: 2, md: 3 }, // 响应式内边距
          }}
        >
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label="返回"
            size="large"
            sx={{
              color: 'primary.main',
              mr: { xs: 1, sm: 2 },
              '&:hover': {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' }, // 响应式字体
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text', // Safari支持
              color: 'transparent',
              textAlign: { xs: 'left', sm: 'left' },
            }}
          >
            语音功能设置
          </Typography>
        </Toolbar>
      </AppBar>

      {/* 可滚动的内容区域 */}
      <Box
        sx={{
          flex: 1, // 占据剩余空间
          overflow: 'auto', // 允许滚动
          overflowX: 'hidden', // 禁止水平滚动
          pt: { xs: 7, sm: 8 }, // 顶部边距（为AppBar留空间）
          pb: { xs: 2, sm: 3 }, // 底部边距
          px: { xs: 1, sm: 2, md: 3 }, // 水平内边距
          // 移动端滚动优化
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          // 自定义滚动条样式
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '10px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.2)',
            },
          },
        }}
      >
        {/* 内容容器 */}
        <Box
          sx={{
            maxWidth: { xs: '100%', sm: '100%', md: '1200px', lg: '1400px' },
            mx: 'auto', // 居中对齐
            width: '100%',
          }}
        >
        {/* 保存结果提示 */}
        {uiState.isSaved && (
          <Alert
            severity="success"
            sx={{
              mb: { xs: 1.5, sm: 2 },
              borderRadius: { xs: 1, sm: 2 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              '& .MuiAlert-icon': {
                fontSize: { xs: '1.2rem', sm: '1.5rem' },
              },
            }}
          >
            设置已保存成功
          </Alert>
        )}

        {uiState.saveError && (
          <Alert
            severity="error"
            sx={{
              mb: { xs: 1.5, sm: 2 },
              borderRadius: { xs: 1, sm: 2 },
              fontSize: { xs: '0.875rem', sm: '1rem' },
              '& .MuiAlert-icon': {
                fontSize: { xs: '1.2rem', sm: '1.5rem' },
              },
            }}
          >
            {uiState.saveError}
          </Alert>
        )}

        <Tabs
          value={uiState.mainTabValue}
          onChange={handleMainTabChange}
          variant="fullWidth" // 主Tab使用fullWidth
          sx={{
            mb: { xs: 2, sm: 3 },
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-indicator': {
              height: { xs: 3, sm: 4 },
              borderRadius: '2px 2px 0 0',
              background: 'linear-gradient(90deg, #9333EA, #754AB4)',
            },
            '& .MuiTab-root': {
              minHeight: { xs: 56, sm: 64 },
              fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
              fontWeight: 600,
              textTransform: 'none',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
          }}
        >
          <Tab label="文本转语音 (TTS)" icon={<Volume2 size={20} />} iconPosition="start" />
          <Tab label="语音识别 (STT)" icon={<Mic size={20} />} iconPosition="start" />
        </Tabs>

        {uiState.mainTabValue === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3, md: 4 }, // 响应式内边距
              mb: { xs: 2, sm: 3 }, // 响应式外边距
              borderRadius: { xs: 2, sm: 3 }, // 响应式圆角
              border: '1px solid',
              borderColor: 'divider',
              background: 'background.paper',
              boxShadow: {
                xs: '0 2px 8px rgba(0,0,0,0.04)',
                sm: '0 4px 12px rgba(0,0,0,0.08)'
              }, // 响应式阴影
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: {
                  xs: '0 4px 12px rgba(0,0,0,0.08)',
                  sm: '0 8px 24px rgba(0,0,0,0.12)'
                },
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: { xs: 2, sm: 3 },
                fontWeight: 600,
                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' }, // 响应式字体
                color: 'text.primary',
              }}
            >
              文本转语音 (TTS) 功能
            </Typography>

            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={enableTTS}
                    onChange={(e) => setEnableTTS(e.target.checked)}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      fontWeight: 500,
                    }}
                  >
                    启用语音转换功能
                  </Typography>
                }
                sx={{
                  '& .MuiFormControlLabel-label': {
                    ml: { xs: 1, sm: 1.5 },
                  },
                }}
              />
            </Box>

            <Typography
              variant="body2"
              sx={{
                mb: { xs: 2, sm: 3 },
                color: 'text.secondary',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                lineHeight: { xs: 1.4, sm: 1.6 },
                px: { xs: 0, sm: 1 }, // 移动端无内边距，桌面端有内边距
              }}
            >
              启用后，在聊天界面可以将AI回复内容转换为语音播放。本应用支持硅基流动TTS、OpenAI TTS和微软Azure TTS服务，如API无效则会自动降级使用浏览器内置的Web Speech API功能。
            </Typography>

            {/* TTS服务选择器 */}
            <FormControl
              fullWidth
              sx={{
                mb: { xs: 2, sm: 3 },
                '& .MuiInputLabel-root': {
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                },
              }}
            >
              <InputLabel>选择TTS服务</InputLabel>
              <Select
                value={selectedTTSService}
                onChange={(e) => handleServiceChange(e.target.value)}
                label="选择TTS服务"
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
                sx={{
                  '& .MuiSelect-select': {
                    py: { xs: 1.5, sm: 2 }, // 响应式内边距
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderRadius: { xs: 1.5, sm: 2 },
                  },
                }}
              >
                <MenuItem
                  value="siliconflow"
                  sx={{
                    py: { xs: 1, sm: 1.5 },
                    px: { xs: 2, sm: 3 },
                  }}
                >
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    width: '100%',
                  }}>
                    <Chip
                      size="small"
                      label="推荐"
                      color="primary"
                      variant="outlined"
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                        '& .MuiChip-label': {
                          px: { xs: 0.5, sm: 1 },
                        },
                      }}
                    />
                    <Typography sx={{
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
                      ml: { xs: 0.5, sm: 1 },
                    }}>
                      硅基流动 TTS (免费额度)
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="openai"
                  sx={{
                    py: { xs: 1, sm: 1.5 },
                    px: { xs: 2, sm: 3 },
                  }}
                >
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    width: '100%',
                  }}>
                    <Chip
                      size="small"
                      label="付费"
                      color="warning"
                      variant="outlined"
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                        '& .MuiChip-label': {
                          px: { xs: 0.5, sm: 1 },
                        },
                      }}
                    />
                    <Typography sx={{
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
                      ml: { xs: 0.5, sm: 1 },
                    }}>
                      OpenAI TTS (高音质)
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  value="azure"
                  sx={{
                    py: { xs: 1, sm: 1.5 },
                    px: { xs: 2, sm: 3 },
                  }}
                >
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    width: '100%',
                  }}>
                    <Chip
                      size="small"
                      label="企业级"
                      color="info"
                      variant="outlined"
                      sx={{
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        height: { xs: 20, sm: 24 },
                        '& .MuiChip-label': {
                          px: { xs: 0.5, sm: 1 },
                        },
                      }}
                    />
                    <Typography sx={{
                      fontSize: { xs: '0.85rem', sm: '0.95rem' },
                      ml: { xs: 0.5, sm: 1 },
                    }}>
                      微软Azure TTS (免费额度+付费)
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
              <FormHelperText sx={{
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                mt: { xs: 0.5, sm: 1 },
                px: { xs: 0, sm: 1 },
              }}>
                选择您要使用的文本转语音服务。硅基流动提供免费额度，OpenAI音质优秀，Azure提供企业级服务。
              </FormHelperText>
            </FormControl>

            <Tabs
              value={uiState.ttsSubTabValue}
              onChange={handleTTSSubTabChange}
              variant="scrollable" // 始终使用可滚动模式
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                mb: { xs: 2, sm: 3 },
                borderBottom: 1,
                borderColor: 'divider',
                // 滑动容器样式
                '& .MuiTabs-scroller': {
                  overflow: 'auto !important',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch', // iOS 滑动优化
                  '&::-webkit-scrollbar': {
                    display: 'none', // 隐藏滚动条
                  },
                  scrollbarWidth: 'none', // Firefox 隐藏滚动条
                },
                '& .MuiTabs-flexContainer': {
                  gap: { xs: 0.5, sm: 1 },
                  minWidth: 'fit-content',
                },
                '& .MuiTab-root': {
                  minHeight: { xs: 56, sm: 64 },
                  fontSize: { xs: '0.7rem', sm: '0.875rem', md: '1rem' },
                  fontWeight: 500,
                  textTransform: 'none',
                  px: { xs: 1.5, sm: 2, md: 3 },
                  py: { xs: 1, sm: 1.5 },
                  minWidth: { xs: 'auto', sm: 120, md: 160 }, // 响应式最小宽度
                  maxWidth: { xs: 200, sm: 250, md: 300 },
                  whiteSpace: 'nowrap',
                  '&.Mui-selected': {
                    fontWeight: 600,
                    color: 'primary.main',
                  },
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transition: 'background-color 0.2s ease-in-out',
                  },
                },
                '& .MuiTabs-indicator': {
                  height: { xs: 3, sm: 4 },
                  borderRadius: '2px 2px 0 0',
                  background: 'linear-gradient(90deg, #9333EA, #754AB4)',
                },
                // 滚动按钮样式
                '& .MuiTabs-scrollButtons': {
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: { xs: '1.2rem', sm: '1.5rem' },
                  },
                },
              }}
            >
              <Tab
                label={
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    flexDirection: 'row', // 始终水平布局
                    textAlign: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                    <Typography sx={{
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      硅基流动
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.25,
                      alignItems: 'center',
                    }}>
                      {selectedTTSService === 'siliconflow' && (
                        <Chip
                          size="small"
                          label="使用中"
                          color="success"
                          variant="filled"
                          sx={{
                            fontSize: { xs: '0.55rem', sm: '0.65rem' },
                            height: { xs: 16, sm: 20 },
                            minWidth: 'auto',
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                              py: 0,
                            },
                          }}
                        />
                      )}
                      {siliconFlowSettings.apiKey && selectedTTSService !== 'siliconflow' && (
                        <Chip
                          size="small"
                          label="已配置"
                          color="info"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.55rem', sm: '0.65rem' },
                            height: { xs: 16, sm: 20 },
                            minWidth: 'auto',
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                              py: 0,
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    flexDirection: { xs: 'column', sm: 'row' },
                    textAlign: 'center',
                  }}>
                    <Typography sx={{
                      fontSize: { xs: '0.7rem', sm: '0.85rem' },
                      fontWeight: 'inherit',
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    }}>
                      OpenAI TTS
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}>
                      {selectedTTSService === 'openai' && (
                        <Chip
                          size="small"
                          label="当前使用"
                          color="success"
                          variant="filled"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem' },
                            height: { xs: 14, sm: 18 },
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                            },
                          }}
                        />
                      )}
                      {openaiSettings.apiKey && (
                        <Chip
                          size="small"
                          label="已配置"
                          color="info"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem' },
                            height: { xs: 14, sm: 18 },
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    flexDirection: { xs: 'column', sm: 'row' },
                    textAlign: 'center',
                  }}>
                    <Typography sx={{
                      fontSize: { xs: '0.7rem', sm: '0.85rem' },
                      fontWeight: 'inherit',
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    }}>
                      微软Azure TTS
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}>
                      {selectedTTSService === 'azure' && (
                        <Chip
                          size="small"
                          label="当前使用"
                          color="success"
                          variant="filled"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem' },
                            height: { xs: 14, sm: 18 },
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                            },
                          }}
                        />
                      )}
                      {azureSettings.apiKey && (
                        <Chip
                          size="small"
                          label="已配置"
                          color="info"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.6rem', sm: '0.7rem' },
                            height: { xs: 14, sm: 18 },
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
            </Tabs>

            {uiState.ttsSubTabValue === 0 && (
              <SiliconFlowTTSTab
                settings={siliconFlowSettings}
                onSettingsChange={setSiliconFlowSettings}
              />
            )}

            {uiState.ttsSubTabValue === 1 && (
              <OpenAITTSTab
                settings={openaiSettings}
                onSettingsChange={setOpenaiSettings}
              />
            )}

            {uiState.ttsSubTabValue === 2 && (
              <AzureTTSTab
                settings={azureSettings}
                onSettingsChange={setAzureSettings}
              />
            )}
          </Paper>
        )}

        {/* TTS测试区域 */}
        {uiState.mainTabValue === 0 && (
          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService={selectedTTSService}
            openaiApiKey={openaiSettings.apiKey}
            azureApiKey={azureSettings.apiKey}
            siliconFlowApiKey={siliconFlowSettings.apiKey}
          />
        )}

        {uiState.mainTabValue === 1 && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              mb: { xs: 2, sm: 3 }, // 响应式外边距
              borderRadius: { xs: 2, sm: 3 },
              border: '1px solid',
              borderColor: 'divider',
              background: 'background.paper',
              boxShadow: {
                xs: '0 2px 8px rgba(0,0,0,0.04)',
                sm: '0 4px 12px rgba(0,0,0,0.08)'
              },
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: {
                  xs: '0 4px 12px rgba(0,0,0,0.08)',
                  sm: '0 8px 24px rgba(0,0,0,0.12)'
                },
              },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                mb: { xs: 2, sm: 3 },
                fontWeight: 600,
                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
                color: 'text.primary',
              }}
            >
              语音识别 (STT) 功能
            </Typography>

            {/* 基础设置 */}
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
              <FormControlLabel
                control={
                  <CustomSwitch
                    checked={speechRecognitionSettings.enabled}
                    onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: { xs: '0.9rem', sm: '1rem' },
                      fontWeight: 500,
                    }}
                  >
                    启用语音识别功能
                  </Typography>
                }
                sx={{
                  '& .MuiFormControlLabel-label': {
                    ml: { xs: 1, sm: 1.5 },
                  },
                }}
              />
            </Box>

            {/* 语音识别服务选择 - 添加子Tab */}
            <Tabs
              value={uiState.sttSubTabValue}
              onChange={handleSTTSubTabChange}
              variant="scrollable" // 始终使用可滚动模式
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                mb: { xs: 2, sm: 3 },
                borderBottom: 1,
                borderColor: 'divider',
                // 滑动容器样式
                '& .MuiTabs-scroller': {
                  overflow: 'auto !important',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch', // iOS 滑动优化
                  '&::-webkit-scrollbar': {
                    display: 'none', // 隐藏滚动条
                  },
                  scrollbarWidth: 'none', // Firefox 隐藏滚动条
                },
                '& .MuiTabs-flexContainer': {
                  gap: { xs: 0.5, sm: 1 },
                  minWidth: 'fit-content',
                },
                '& .MuiTab-root': {
                  minHeight: { xs: 56, sm: 64 },
                  fontSize: { xs: '0.7rem', sm: '0.875rem', md: '1rem' },
                  fontWeight: 500,
                  textTransform: 'none',
                  px: { xs: 1.5, sm: 2, md: 3 },
                  py: { xs: 1, sm: 1.5 },
                  minWidth: { xs: 'auto', sm: 120, md: 160 }, // 响应式最小宽度
                  maxWidth: { xs: 200, sm: 250, md: 300 },
                  whiteSpace: 'nowrap',
                  '&.Mui-selected': {
                    fontWeight: 600,
                    color: 'primary.main',
                  },
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    transition: 'background-color 0.2s ease-in-out',
                  },
                },
                '& .MuiTabs-indicator': {
                  height: { xs: 3, sm: 4 },
                  borderRadius: '2px 2px 0 0',
                  background: 'linear-gradient(90deg, #9333EA, #754AB4)',
                },
                // 滚动按钮样式
                '& .MuiTabs-scrollButtons': {
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: { xs: '1.2rem', sm: '1.5rem' },
                  },
                },
              }}
            >
              {/* Capacitor Tab */}
              <Tab
                label={
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    flexDirection: 'row', // 始终水平布局
                    textAlign: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                    <Typography sx={{
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      本地识别
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.25,
                      alignItems: 'center',
                    }}>
                      {speechRecognitionSettings.provider === 'capacitor' && (
                        <Chip
                          size="small"
                          label="使用中"
                          color="success"
                          variant="filled"
                          sx={{
                            fontSize: { xs: '0.55rem', sm: '0.65rem' },
                            height: { xs: 16, sm: 20 },
                            minWidth: 'auto',
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                              py: 0,
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
              />

              {/* OpenAI Whisper Tab */}
              <Tab
                label={
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 0.5, sm: 1 },
                    flexDirection: 'row', // 始终水平布局
                    textAlign: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}>
                    <Typography sx={{
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      OpenAI Whisper
                    </Typography>
                    <Box sx={{
                      display: 'flex',
                      gap: 0.25,
                      alignItems: 'center',
                    }}>
                      {speechRecognitionSettings.provider === 'openai' && (
                        <Chip
                          size="small"
                          label="使用中"
                          color="success"
                          variant="filled"
                          sx={{
                            fontSize: { xs: '0.55rem', sm: '0.65rem' },
                            height: { xs: 16, sm: 20 },
                            minWidth: 'auto',
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                            },
                          }}
                        />
                      )}
                      {whisperSettings.apiKey && speechRecognitionSettings.provider !== 'openai' && (
                        <Chip
                          size="small"
                          label="已配置"
                          color="info"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.55rem', sm: '0.65rem' },
                            height: { xs: 16, sm: 20 },
                            minWidth: 'auto',
                            '& .MuiChip-label': {
                              px: { xs: 0.5, sm: 0.75 },
                              py: 0,
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                }
              />
            </Tabs>

            {/* 根据选中的子Tab显示不同的内容 */}
            {uiState.sttSubTabValue === 0 && (
              // Capacitor语音识别设置
              <>
                <FormControl fullWidth sx={{ mb: { xs: 2, sm: 3 } }}>
                  <InputLabel>默认语言</InputLabel>
                  <Select
                    value={speechRecognitionSettings.language}
                    onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, language: e.target.value }))}
                    label="默认语言"
                    MenuProps={{
                      disableAutoFocus: true,
                      disableRestoreFocus: true
                    }}
                  >
                    <MenuItem value="zh-CN">中文 (普通话)</MenuItem>
                    <MenuItem value="en-US">English (US)</MenuItem>
                    {/* 可以根据需要添加更多语言 */}
                  </Select>
                  <FormHelperText>选择语音识别的默认语言。</FormHelperText>
                </FormControl>

                <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, sm: 3 } }}>
                  权限状态: {permissionStatus}
                </Typography>

                {/* 识别参数 */}
                <Typography variant="h6" sx={{ mb: { xs: 2, sm: 3 }, fontWeight: 600 }}>
                  识别参数
                </Typography>

                <TextField
                  fullWidth
                  label="静音超时时间 (毫秒)"
                  type="number"
                  value={speechRecognitionSettings.silenceTimeout}
                  onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, silenceTimeout: Number(e.target.value) }))}
                  sx={{ mb: { xs: 2, sm: 3 } }}
                />

                <TextField
                  fullWidth
                  label="最大结果数量"
                  type="number"
                  value={speechRecognitionSettings.maxResults}
                  onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, maxResults: Number(e.target.value) }))}
                  sx={{ mb: { xs: 2, sm: 3 } }}
                />

                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={speechRecognitionSettings.partialResults}
                      onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, partialResults: e.target.checked }))}
                    />
                  }
                  label="显示部分结果"
                  sx={{ mb: { xs: 2, sm: 3 } }}
                />

                <FormControlLabel
                  control={
                    <CustomSwitch
                      checked={speechRecognitionSettings.autoStart}
                      onChange={(e) => setSpeechRecognitionSettings(prev => ({ ...prev, autoStart: e.target.checked }))}
                    />
                  }
                  label="自动开始识别"
                  sx={{ mb: { xs: 2, sm: 3 } }}
                />

                {/* 测试区域 */}
                <Typography variant="h6" sx={{ mb: { xs: 2, sm: 3 }, fontWeight: 600 }}>
                  测试语音识别
                </Typography>

                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, mb: { xs: 2, sm: 3 }, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button
                    variant="outlined"
                    onClick={checkAndRequestPermissions}
                    disabled={permissionStatus === 'granted'}
                    sx={{ flex: 1 }}
                  >
                    检查并请求权限
                  </Button>
                  <Button
                    variant="contained"
                    color={isListening ? "error" : "primary"}
                    onClick={isListening ? stopRecognition : () => startRecognition({
                      language: speechRecognitionSettings.language,
                      maxResults: speechRecognitionSettings.maxResults,
                      partialResults: speechRecognitionSettings.partialResults,
                      popup: false,
                    })}
                    startIcon={isListening ? <Square size={16} /> : <Mic size={16} />}
                    sx={{ flex: 1 }}
                  >
                    {isListening ? "停止识别" : "开始识别"}
                  </Button>
                </Box>

                {recognitionText && (
                  <Alert severity="info" sx={{ mb: { xs: 2, sm: 3 } }}>
                    实时识别结果: {recognitionText}
                  </Alert>
                )}

                {error && (
                  <Alert severity="error" sx={{ mb: { xs: 2, sm: 3 } }}>
                    语音识别错误: {error.message || '未知错误'}
                  </Alert>
                )}
              </>
            )}

            {uiState.sttSubTabValue === 1 && (
              // OpenAI Whisper设置
              <>
                <OpenAIWhisperTab
                  settings={whisperSettings}
                  onSettingsChange={setWhisperSettings}
                />

                <WhisperTestSection
                  settings={whisperSettings}
                  enabled={speechRecognitionSettings.enabled}
                />
              </>
            )}
          </Paper>
        )}

        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end', // 按钮靠右
          mt: { xs: 2, sm: 3 }, // 顶部间距
        }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            size={window.innerWidth < 600 ? "large" : "medium"}
            sx={{
              minHeight: { xs: 48, sm: 40 },
              fontSize: { xs: '0.9rem', sm: '1rem' },
              fontWeight: 600,
              borderRadius: { xs: 2, sm: 1.5 },
              px: { xs: 3, sm: 2 },
              background: 'linear-gradient(45deg, #9333EA, #754AB4)',
              '&:hover': {
                background: 'linear-gradient(45deg, #7C3AED, #6D28D9)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            保存设置
          </Button>
        </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default VoiceSettings;