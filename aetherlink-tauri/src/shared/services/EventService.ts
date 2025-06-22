import { EventEmitter as EmitteryInstance, EVENT_NAMES as COMMON_EVENT_NAMES } from './EventEmitter';

// 重新导出 EventEmitter，以保持向后兼容性
export const EventEmitter = EmitteryInstance;

// 定义事件名称常量，合并通用事件名称和特定于服务的事件名称
export const EVENT_NAMES = {
  ...COMMON_EVENT_NAMES,

  // 服务特定事件（覆盖通用事件名称以保持兼容性）
  SEND_MESSAGE: 'SEND_MESSAGE',
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  ADD_NEW_TOPIC: 'ADD_NEW_TOPIC',
  SHOW_TOPIC_SIDEBAR: 'SHOW_TOPIC_SIDEBAR',
  SWITCH_TOPIC_SIDEBAR: 'SWITCH_TOPIC_SIDEBAR',
  FORCE_MESSAGES_UPDATE: 'FORCE_MESSAGES_UPDATE',
  SERVICE_ERROR: 'SERVICE_ERROR',
  IMAGE_PROCESSING_DEPRECATED: 'IMAGE_PROCESSING_DEPRECATED',
  TOPICS_CLEARED: 'TOPICS_CLEARED',
  TOPIC_MOVED: 'TOPIC_MOVED',
  MESSAGE_ERROR: 'message:error',
  STREAMING_STARTED: 'streaming:started',
  STREAMING_ENDED: 'streaming:ended',

  // 知识库相关事件
  KNOWLEDGE_BASE_CREATED: 'knowledge_base:created',
  KNOWLEDGE_BASE_UPDATED: 'knowledge_base:updated',
  KNOWLEDGE_BASE_DELETED: 'knowledge_base:deleted',
  KNOWLEDGE_DOCUMENT_PROCESSED: 'knowledge_document:processed',
  KNOWLEDGE_DOCUMENTS_ADDED: 'knowledge_documents:added',
  KNOWLEDGE_DOCUMENT_DELETED: 'knowledge_document:deleted',
  KNOWLEDGE_SEARCH_COMPLETED: 'knowledge_search:completed',
} as const;

// 提供一个更简洁的事件服务使用方式
export class EventService {
  private static instance: EventService;

  // 单例模式
  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  // 发送事件
  static emit(eventName: string, data: any) {
    EventEmitter.emit(eventName, data);
    if (process.env.NODE_ENV === 'development') {
      // 仅在开发环境记录日志
      console.debug(`[EventService] 事件: ${eventName}`, data);
    }
  }

  // 监听事件
  static on(eventName: string, callback: (data: any) => void) {
    const unsubscribe = EventEmitter.on(eventName, callback);
    return () => {
      unsubscribe();
    };
  }

  // 一次性监听事件
  static once(eventName: string, callback: (data: any) => void) {
    // 使用Promise.resolve处理Emittery.once返回的Promise
    const promise = EventEmitter.once(eventName);

    // 添加回调并返回取消函数
    promise.then(callback);

    return () => {
      // 无法取消once，但可以忽略回调
      promise.then(() => {
        // 空操作，仅用于覆盖原回调
      });
    };
  }

  // 移除所有监听器
  static clear() {
    EventEmitter.clearListeners();
  }
}