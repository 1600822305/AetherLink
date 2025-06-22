import React from 'react';
import { SiliconFlowTTSTab, type SiliconFlowTTSSettings } from './SiliconFlowTTSTab';
import { OpenAITTSTab, type OpenAITTSSettings } from './OpenAITTSTab';
import { AzureTTSTab, type AzureTTSSettings } from './AzureTTSTab';

// TTS组件统一导出
export { SiliconFlowTTSTab, type SiliconFlowTTSSettings } from './SiliconFlowTTSTab';
export { OpenAITTSTab, type OpenAITTSSettings } from './OpenAITTSTab';
export { AzureTTSTab, type AzureTTSSettings } from './AzureTTSTab';

// TTS服务类型定义
export type TTSServiceType = 'siliconflow' | 'openai' | 'azure';

// 统一的TTS设置接口
export interface TTSSettings {
  siliconflow: SiliconFlowTTSSettings;
  openai: OpenAITTSSettings;
  azure: AzureTTSSettings;
}

// TTS Tab配置接口
export interface TTSTabConfig {
  id: TTSServiceType;
  label: string;
  component: React.ComponentType<any>;
  description?: string;
  features?: string[];
}

// TTS服务配置
export const TTS_SERVICES: TTSTabConfig[] = [
  {
    id: 'siliconflow',
    label: '硅基流动 TTS',
    component: SiliconFlowTTSTab,
    description: '国产化TTS服务，支持多语言语音合成',
    features: ['CosyVoice2-0.5B', '多语言支持', '情感控制', '高性价比'],
  },
  {
    id: 'openai',
    label: 'OpenAI TTS',
    component: OpenAITTSTab,
    description: 'OpenAI官方TTS服务，音质优秀',
    features: ['TTS-1', 'TTS-1-HD', '6种语音', '流式传输'],
  },
  {
    id: 'azure',
    label: '微软Azure TTS',
    component: AzureTTSTab,
    description: '企业级TTS服务，功能丰富',
    features: ['Neural语音', 'SSML支持', '多种风格', '角色扮演'],
  },
];

// 获取TTS服务配置
export const getTTSServiceConfig = (serviceId: TTSServiceType): TTSTabConfig | undefined => {
  return TTS_SERVICES.find(service => service.id === serviceId);
};

// 获取所有TTS服务ID
export const getAllTTSServiceIds = (): TTSServiceType[] => {
  return TTS_SERVICES.map(service => service.id);
};

// 获取默认TTS服务
export const getDefaultTTSService = (): TTSServiceType => {
  return 'siliconflow';
};
