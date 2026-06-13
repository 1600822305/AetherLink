/**
 * Calendar MCP Server
 * 提供日历事件的创建、查询、修改和删除功能
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createLogger } from '../../infra/logger';

const logger = createLogger('Calendar MCP');


// 工具定义
const GET_CALENDARS_TOOL: Tool = {
  name: 'get_calendars',
  description: '获取设备上的所有日历列表',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

const GET_CALENDAR_EVENTS_TOOL: Tool = {
  name: 'get_calendar_events',
  description: '获取指定时间范围内的日历事件',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: '开始日期，ISO 8601格式，例如：2025-11-08T00:00:00.000Z'
      },
      endDate: {
        type: 'string',
        description: '结束日期，ISO 8601格式，例如：2025-11-15T23:59:59.999Z'
      },
      calendarId: {
        type: 'string',
        description: '日历ID，如果不提供则查询所有日历（可选）'
      }
    },
    required: ['startDate', 'endDate']
  }
};

const CREATE_CALENDAR_EVENT_TOOL: Tool = {
  name: 'create_calendar_event',
  description: '创建新的日历事件',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '事件标题'
      },
      startDate: {
        type: 'string',
        description: '开始时间，ISO 8601格式'
      },
      endDate: {
        type: 'string',
        description: '结束时间，ISO 8601格式'
      },
      location: {
        type: 'string',
        description: '事件地点（可选）'
      },
      notes: {
        type: 'string',
        description: '事件备注（可选）'
      },
      calendarId: {
        type: 'string',
        description: '目标日历ID，如果不提供则使用默认日历（可选）'
      }
    },
    required: ['title', 'startDate', 'endDate']
  }
};

const UPDATE_CALENDAR_EVENT_TOOL: Tool = {
  name: 'update_calendar_event',
  description: '更新已存在的日历事件',
  inputSchema: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: '要更新的事件ID'
      },
      title: {
        type: 'string',
        description: '新的事件标题（可选）'
      },
      startDate: {
        type: 'string',
        description: '新的开始时间，ISO 8601格式（可选）'
      },
      endDate: {
        type: 'string',
        description: '新的结束时间，ISO 8601格式（可选）'
      },
      location: {
        type: 'string',
        description: '新的事件地点（可选）'
      },
      notes: {
        type: 'string',
        description: '新的事件备注（可选）'
      }
    },
    required: ['eventId']
  }
};

const DELETE_CALENDAR_EVENT_TOOL: Tool = {
  name: 'delete_calendar_event',
  description: '删除日历事件',
  inputSchema: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: '要删除的事件ID'
      },
      startDate: {
        type: 'string',
        description: '事件开始时间，ISO 8601格式'
      },
      endDate: {
        type: 'string',
        description: '事件结束时间，ISO 8601格式'
      }
    },
    required: ['eventId', 'startDate', 'endDate']
  }
};

interface CalendarEvent {
  id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  notes?: string;
  calendarId?: string;
}

// 入参校验 schema（与上方各工具的 inputSchema 保持一致）
const GetEventsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  calendarId: z.string().optional()
});

const CreateEventSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
  calendarId: z.string().optional()
});

const UpdateEventSchema = z.object({
  eventId: z.string(),
  title: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional()
});

const DeleteEventSchema = z.object({
  eventId: z.string(),
  startDate: z.string(),
  endDate: z.string()
});

/**
 * Calendar Server 类
 */
export class CalendarServer {
  public server: Server;
  private calendarPlugin: any;

  constructor() {
    this.server = new Server(
      {
        name: '@aether/calendar',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.initCalendarPlugin();
    this.setupHandlers();
  }

  private initCalendarPlugin(): void {
    // 检查是否在移动端环境
    if (typeof window !== 'undefined' && (window as any).plugins?.calendar) {
      this.calendarPlugin = (window as any).plugins.calendar;
    } else {
      logger.warn('Cordova Calendar plugin not found, running in mock mode');
    }
  }

  private setupHandlers(): void {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          GET_CALENDARS_TOOL,
          GET_CALENDAR_EVENTS_TOOL,
          CREATE_CALENDAR_EVENT_TOOL,
          UPDATE_CALENDAR_EVENT_TOOL,
          DELETE_CALENDAR_EVENT_TOOL
        ]
      };
    });

    // 执行工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_calendars':
            return await this.getCalendars();
          case 'get_calendar_events':
            return await this.getCalendarEvents(GetEventsSchema.parse(args));
          case 'create_calendar_event':
            return await this.createCalendarEvent(CreateEventSchema.parse(args));
          case 'update_calendar_event':
            return await this.updateCalendarEvent(UpdateEventSchema.parse(args));
          case 'delete_calendar_event':
            return await this.deleteCalendarEvent(DeleteEventSchema.parse(args));
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
   * 获取所有日历
   */
  private async getCalendars(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      if (!this.calendarPlugin) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: '日历插件未初始化，请在移动设备上运行',
                mockData: [
                  { id: 'mock-1', name: '默认日历', isPrimary: true },
                  { id: 'mock-2', name: '工作日历', isPrimary: false }
                ]
              }, null, 2)
            }
          ]
        };
      }

      return new Promise((resolve) => {
        this.calendarPlugin.listCalendars(
          (calendars: any[]) => {
            const result = calendars.map(cal => ({
              id: cal.id,
              name: cal.name,
              displayName: cal.displayName,
              isPrimary: cal.isPrimary || false
            }));

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ calendars: result }, null, 2)
                }
              ]
            });
          },
          (error: any) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `获取日历列表失败: ${error}`
                }
              ]
            });
          }
        );
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `获取日历列表失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }

  /**
   * 获取日历事件
   */
  private async getCalendarEvents(params: {
    startDate: string;
    endDate: string;
    calendarId?: string;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { startDate, endDate, calendarId } = params;

      if (!this.calendarPlugin) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: '日历插件未初始化，请在移动设备上运行',
                mockData: {
                  events: [
                    {
                      id: 'mock-event-1',
                      title: '示例会议',
                      startDate: startDate,
                      endDate: endDate,
                      location: '会议室A'
                    }
                  ]
                }
              }, null, 2)
            }
          ]
        };
      }

      return new Promise((resolve) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        this.calendarPlugin.findEvent(
          null, // title filter
          null, // location filter
          null, // notes filter
          start,
          end,
          (events: any[]) => {
            let filteredEvents = events;
            if (calendarId) {
              filteredEvents = events.filter(e => e.calendar_id === calendarId);
            }

            const result = filteredEvents.map(event => ({
              id: event.id,
              title: event.title,
              startDate: event.startDate,
              endDate: event.endDate,
              location: event.eventLocation || '',
              notes: event.notes || '',
              calendarId: event.calendar_id
            }));

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ events: result, count: result.length }, null, 2)
                }
              ]
            });
          },
          (error: any) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `查询日历事件失败: ${error}`
                }
              ]
            });
          }
        );
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `查询日历事件失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }

  /**
   * 创建日历事件
   */
  private async createCalendarEvent(params: CalendarEvent): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { title, startDate, endDate, location, notes, calendarId } = params;

      if (!this.calendarPlugin) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: '日历插件未初始化，请在移动设备上运行',
                mockResponse: {
                  success: true,
                  message: `模拟创建事件: ${title}`,
                  eventDetails: params
                }
              }, null, 2)
            }
          ]
        };
      }

      return new Promise((resolve) => {
        const start = new Date(startDate!);
        const end = new Date(endDate!);

        const options: any = {
          calendarId: calendarId || null,
          url: null
        };

        this.calendarPlugin.createEventInteractivelyWithOptions(
          title,
          location || '',
          notes || '',
          start,
          end,
          options,
          () => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `成功创建日历事件: ${title}`,
                    event: {
                      title,
                      startDate,
                      endDate,
                      location,
                      notes
                    }
                  }, null, 2)
                }
              ]
            });
          },
          (error: any) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `创建日历事件失败: ${error}`
                }
              ]
            });
          }
        );
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `创建日历事件失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }

  /**
   * 更新日历事件
   */
  private async updateCalendarEvent(params: CalendarEvent & { eventId: string }): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { eventId, title, startDate, endDate, location, notes } = params;

      if (!this.calendarPlugin) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: '日历插件未初始化，请在移动设备上运行',
                mockResponse: {
                  success: true,
                  message: `模拟更新事件: ${eventId}`,
                  updates: params
                }
              }, null, 2)
            }
          ]
        };
      }

      return new Promise((resolve) => {
        // 注意: cordova-plugin-calendar 需要先删除再创建来实现更新
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        this.calendarPlugin.modifyEvent(
          title || null,
          location || null,
          notes || null,
          start,
          end,
          title || null, // newTitle
          location || null, // newLocation
          notes || null, // newNotes
          start, // newStartDate
          end, // newEndDate
          () => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `成功更新日历事件: ${eventId}`,
                    updates: params
                  }, null, 2)
                }
              ]
            });
          },
          (error: any) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `更新日历事件失败: ${error}`
                }
              ]
            });
          }
        );
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `更新日历事件失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }

  /**
   * 删除日历事件
   */
  private async deleteCalendarEvent(params: {
    eventId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const { eventId, startDate, endDate } = params;

      if (!this.calendarPlugin) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: '日历插件未初始化，请在移动设备上运行',
                mockResponse: {
                  success: true,
                  message: `模拟删除事件: ${eventId}`
                }
              }, null, 2)
            }
          ]
        };
      }

      return new Promise((resolve) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        this.calendarPlugin.deleteEvent(
          null, // title
          null, // location
          null, // notes
          start,
          end,
          () => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `成功删除日历事件: ${eventId}`
                  }, null, 2)
                }
              ]
            });
          },
          (error: any) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `删除日历事件失败: ${error}`
                }
              ]
            });
          }
        );
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `删除日历事件失败: ${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }
}

