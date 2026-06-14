/**
 * 系统闹钟插件 Web 实现（Mock）
 */

import { WebPlugin } from '@capacitor/core';
import type { SystemAlarmPlugin } from '../SystemAlarmPlugin';
import { createLogger } from '../../services/infra/logger';

const logger = createLogger('SystemAlarmWeb');

export class SystemAlarmWeb extends WebPlugin implements SystemAlarmPlugin {
  async setAlarm(options: {
    title: string;
    hour: number;
    minute: number;
    skipUi?: boolean;
    repeat?: 'none' | 'daily' | 'weekday' | 'weekend';
  }): Promise<{ success: boolean; message: string }> {
    logger.debug('setAlarm called with:', options);
    return {
      success: true,
      message: `Mock: 设置闹钟 "${options.title}" 在 ${options.hour}:${options.minute}${options.repeat && options.repeat !== 'none' ? ` (重复: ${options.repeat})` : ''}`
    };
  }

  async showAlarms(): Promise<{ success: boolean; message: string }> {
    logger.debug('showAlarms called');
    return {
      success: true,
      message: 'Mock: 打开系统闹钟列表'
    };
  }

  async setTimer(options: {
    seconds: number;
    message: string;
    skipUi?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    logger.debug('setTimer called with:', options);
    return {
      success: true,
      message: `Mock: 设置倒计时 ${options.seconds} 秒 - ${options.message}`
    };
  }
}

