import { getStorageItem } from '../../utils/storage';
import { TTSManager } from './TTSManager';

/**
 * 初始化 TTS 服务配置
 * 从存储中读取用户选择的引擎和参数，配置 TTSManager
 */
export async function initTTS(): Promise<void> {
  const tts = TTSManager.getInstance();

  // 加载用户选择的 TTS 服务
  const selectedService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';
  const enableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';

  if (enableTTS) {
    // 根据选择配置引擎
    switch (selectedService) {
      case 'capacitor': {
        const language = await getStorageItem<string>('capacitor_tts_language') || 'zh-CN';
        const rate = parseFloat(await getStorageItem<string>('capacitor_tts_rate') || '1.0');
        const pitch = parseFloat(await getStorageItem<string>('capacitor_tts_pitch') || '1.0');
        const volume = parseFloat(await getStorageItem<string>('capacitor_tts_volume') || '1.0');
        tts.configureEngine('capacitor', { enabled: true, language, rate, pitch, volume });
        tts.setActiveEngine('capacitor');
        break;
      }
      case 'openai': {
        const apiKey = await getStorageItem<string>('openai_tts_api_key') || '';
        const model = await getStorageItem<string>('openai_tts_model') || 'tts-1';
        const voice = await getStorageItem<string>('openai_tts_voice') || 'alloy';
        tts.configureEngine('openai', { enabled: true, apiKey, model, voice });
        tts.setActiveEngine('openai');
        break;
      }
      case 'azure': {
        const apiKey = await getStorageItem<string>('azure_tts_api_key') || '';
        const region = await getStorageItem<string>('azure_tts_region') || 'eastus';
        const voiceName = await getStorageItem<string>('azure_tts_voice_name') || 'zh-CN-XiaoxiaoNeural';
        tts.configureEngine('azure', { enabled: true, apiKey, region, voiceName });
        tts.setActiveEngine('azure');
        break;
      }
      case 'gemini': {
        const apiKey = await getStorageItem<string>('gemini_tts_api_key') || '';
        const model = await getStorageItem<string>('gemini_tts_model') || 'gemini-2.5-flash-preview-tts';
        const voice = await getStorageItem<string>('gemini_tts_voice') || 'Kore';
        tts.configureEngine('gemini', { enabled: true, apiKey, model, voice });
        tts.setActiveEngine('gemini');
        break;
      }
      case 'elevenlabs': {
        const apiKey = await getStorageItem<string>('elevenlabs_tts_api_key') || '';
        const model = await getStorageItem<string>('elevenlabs_tts_model') || 'eleven_multilingual_v2';
        const voice = await getStorageItem<string>('elevenlabs_tts_voice') || 'Rachel';
        tts.configureEngine('elevenlabs', { enabled: true, apiKey, model, voice });
        tts.setActiveEngine('elevenlabs');
        break;
      }
      case 'minimax': {
        const apiKey = await getStorageItem<string>('minimax_tts_api_key') || '';
        const groupId = await getStorageItem<string>('minimax_tts_group_id') || '';
        const model = await getStorageItem<string>('minimax_tts_model') || 'speech-01';
        const voice = await getStorageItem<string>('minimax_tts_voice') || 'male-qn-qingse';
        tts.configureEngine('minimax', { enabled: true, apiKey, groupId, model, voice });
        tts.setActiveEngine('minimax');
        break;
      }
      case 'volcano': {
        const appId = await getStorageItem<string>('volcano_app_id') || '';
        const accessToken = await getStorageItem<string>('volcano_access_token') || '';
        const voiceType = await getStorageItem<string>('volcano_voice_type') || 'zh_female_cancan_mars_bigtts';
        const apiVersion = (await getStorageItem<string>('volcano_api_version') || 'auto') as 'auto' | 'v1' | 'v3';
        const resourceId = await getStorageItem<string>('volcano_resource_id') || '';
        const model = await getStorageItem<string>('volcano_model') || '';
        tts.configureEngine('volcano', { enabled: true, appId, accessToken, voiceType, apiVersion, resourceId, model });
        tts.setActiveEngine('volcano');
        break;
      }
      case 'siliconflow':
      default: {
        const apiKey = await getStorageItem<string>('siliconflow_api_key') || '';
        const model = await getStorageItem<string>('tts_model') || 'FunAudioLLM/CosyVoice2-0.5B';
        const voice = await getStorageItem<string>('tts_voice') || 'FunAudioLLM/CosyVoice2-0.5B:alex';
        tts.configureEngine('siliconflow', { enabled: true, apiKey, model, voice });
        tts.setActiveEngine('siliconflow');
        break;
      }
    }
  }

  console.log('🎵 TTS V2 初始化完成, 使用引擎:', selectedService);
}
