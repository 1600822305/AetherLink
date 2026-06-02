/**
 * Alarm MCP Server
 * 调用系统原生闹钟应用设置闹钟
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import SystemAlarm from '../../../plugins/SystemAlarmPlugin';

// 工具定义
const SET_ALARM_TOOL: Tool = {
  name: 'set_alarm',
  description: '调用系统原生闹钟应用直接设置闹钟，自动完成无需用户手动操作',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '闹钟标题'
      },
      time: {
        type: 'string',
        description: '闹钟时间，ISO 8601格式，例如：2025-11-08T07:00:00.000Z'
      },
      repeat: {
        type: 'string',
        description: '重复模式：none(不重复), daily(每天), weekday(工作日), weekend(周末)',
        enum: ['none', 'daily', 'weekday', 'weekend'],
        default: 'none'
      },
      skipUi: {
        type: 'boolean',
        description: '是否跳过系统UI直接设置，默认true自动设置',
        default: true
      }
    },
    required: ['title', 'time']
  }
};

const SHOW_ALARMS_TOOL: Tool = {
  name: 'show_alarms',
  description: '打开系统闹钟应用，查看和管理所有闹钟',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

const SET_TIMER_TOOL: Tool = {
  name: 'set_timer',
  description: '设置倒计时',
  inputSchema: {
    type: 'object',
    properties: {
      seconds: {
        type: 'number',
        description: '倒计时秒数'
      },
      message: {
        type: 'string',
        description: '倒计时描述',
        default: '倒计时'
      },
      skipUi: {
        type: 'boolean',
        description: '是否跳过系统UI直接设置',
        default: false
      }
    },
    required: ['seconds']
  }
};

interface AlarmParams {
  title: string;
  time: string;
  repeat?: 'none' | 'daily' | 'weekday' | 'weekend';
  skipUi?: boolean;
}

interface TimerParams {
  seconds: number;
  message?: string;
  skipUi?: boolean;
}

/**
 * Alarm Server 类
 */
export class AlarmServer {
  public server: Server;

  constructor() {
    this.server = new Server(
      {
        name: '@aether/alarm',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          SET_ALARM_TOOL,
          SHOW_ALARMS_TOOL,
          SET_TIMER_TOOL
        ]
      };
    });

    // 执行工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'set_alarm':
            return await this.setAlarm(this.parseAlarmParams(args));
          case 'show_alarms':
            return await this.showAlarms();
          case 'set_timer':
            return await this.setTimer(this.parseTimerParams(args));
          default:
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : '未知错误'
              }, null, 2)
            }
          ]
        };
      }
    });
  }

  /**
   * 校验并解析 set_alarm 工具入参
   */
  private parseAlarmParams(args: Record<string, unknown> | undefined): AlarmParams {
    if (!args || typeof args !== 'object') {
      throw new Error('set_alarm 参数无效：缺少参数对象');
    }
    const { title, time, repeat, skipUi } = args;
    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error('set_alarm 参数无效：title 必须为非空字符串');
    }
    if (typeof time !== 'string' || Number.isNaN(new Date(time).getTime())) {
      throw new Error('set_alarm 参数无效：time 必须为可解析的时间字符串');
    }
    const allowedRepeat = ['none', 'daily', 'weekday', 'weekend'] as const;
    const repeatValue =
      typeof repeat === 'string' && (allowedRepeat as readonly string[]).includes(repeat)
        ? (repeat as AlarmParams['repeat'])
        : 'none';
    return {
      title,
      time,
      repeat: repeatValue,
      skipUi: typeof skipUi === 'boolean' ? skipUi : undefined
    };
  }

  /**
   * 校验并解析 set_timer 工具入参
   */
  private parseTimerParams(args: Record<string, unknown> | undefined): TimerParams {
    if (!args || typeof args !== 'object') {
      throw new Error('set_timer 参数无效：缺少参数对象');
    }
    const { seconds, message, skipUi } = args;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('set_timer 参数无效：seconds 必须为正数');
    }
    return {
      seconds,
      message: typeof message === 'string' ? message : undefined,
      skipUi: typeof skipUi === 'boolean' ? skipUi : undefined
    };
  }

  /**
   * 设置系统闹钟
   */
  private async setAlarm(params: AlarmParams): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { title, time, repeat = 'none', skipUi = true } = params;

      // 解析时间
      const alarmTime = new Date(time);
      const hour = alarmTime.getHours();
      const minute = alarmTime.getMinutes();

      // 调用系统闹钟
      const result = await SystemAlarm.setAlarm({
        title,
        hour,
        minute,
        repeat,
        skipUi
      });

      const repeatText = repeat === 'none' ? '单次' : 
                        repeat === 'daily' ? '每天' :
                        repeat === 'weekday' ? '工作日' : '周末';

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: result.message,
              alarm: {
                title,
                time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                repeat: repeatText,
                originalTime: time,
                action: '已自动设置完成'
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `设置系统闹钟失败: ${error instanceof Error ? error.message : '未知错误'}`
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * 打开系统闹钟列表
   */
  private async showAlarms(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const result = await SystemAlarm.showAlarms();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: result.message,
              action: '已打开系统闹钟应用'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `打开系统闹钟失败: ${error instanceof Error ? error.message : '未知错误'}`
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * 设置倒计时
   */
  private async setTimer(params: TimerParams): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { seconds, message = '倒计时', skipUi = false } = params;

      const result = await SystemAlarm.setTimer({
        seconds,
        message,
        skipUi
      });

      // 格式化时间显示
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      let timeText = '';
      if (hours > 0) timeText += `${hours}小时`;
      if (minutes > 0) timeText += `${minutes}分钟`;
      if (secs > 0 || timeText === '') timeText += `${secs}秒`;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: result.message,
              timer: {
                duration: timeText,
                seconds: seconds,
                description: message,
                action: skipUi ? '已直接设置' : '已打开系统倒计时界面'
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `设置倒计时失败: ${error instanceof Error ? error.message : '未知错误'}`
            }, null, 2)
          }
        ]
      };
    }
  }
}
