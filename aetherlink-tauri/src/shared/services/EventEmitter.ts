/**
 * 使用 Emittery 库实现事件系统
 * 与最佳实例保持一致，确保流式输出事件能够正确触发
 */
import Emittery from 'emittery';

// 创建全局事件发射器
export const EventEmitter = new Emittery();

// 定义常用事件名称
export const EVENT_NAMES = {
  // 消息相关事件
  MESSAGE_CREATED: 'message:created',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_COMPLETE: 'message:complete',

  // 流式处理事件
  STREAM_TEXT_DELTA: 'stream:text_delta',
  STREAM_TEXT_FIRST_CHUNK: 'stream:text_first_chunk', // 添加首个文本块事件
  STREAM_TEXT_COMPLETE: 'stream:text_complete',
  STREAM_THINKING_DELTA: 'stream:thinking_delta',
  STREAM_THINKING_COMPLETE: 'stream:thinking_complete',
  STREAM_ERROR: 'stream:error',
  STREAM_COMPLETE: 'stream:complete',

  // 块相关事件
  BLOCK_CREATED: 'block:created',
  BLOCK_UPDATED: 'block:updated',
  BLOCK_DELETED: 'block:deleted',

  // 主题相关事件
  TOPIC_CREATED: 'topic:created',
  TOPIC_UPDATED: 'topic:updated',
  TOPIC_DELETED: 'topic:deleted',
  CHANGE_TOPIC: 'CHANGE_TOPIC', // 电脑端兼容事件

  // UI相关事件
  UI_SCROLL_TO_BOTTOM: 'ui:scroll_to_bottom',
  UI_FORCE_UPDATE: 'ui:force_update',
  UI_COPY_SUCCESS: 'ui:copy_success',

  // 版本相关事件
  VERSION_CREATED: 'version:created',
  VERSION_LOADED: 'version:loaded',
  VERSION_SWITCHED: 'version:switched',
  VERSION_DELETED: 'version:deleted',

  // 应用生命周期事件
  APP_INITIALIZED: 'app:initialized',
  APP_READY: 'app:ready',
  APP_WILL_CLOSE: 'app:will_close',
  APP_ERROR: 'app:error',

  // 其他事件
  SEND_MESSAGE: 'send:message',
  CONTENT_UPDATED: 'content:updated',
  RESPONSE_COMPLETED: 'response:completed',
  RESPONSE_ERROR: 'response:error',
  ESTIMATED_TOKEN_COUNT: 'estimated_token_count',
  EDIT_CODE_BLOCK: 'edit_code_block',

  // 工具相关事件
  TOOL_USE_DETECTED: 'tool:use_detected',

  // API Key 错误相关事件
  API_KEY_ERROR: 'api_key:error',
  API_KEY_RETRY: 'api_key:retry',
  SHOW_API_KEY_CONFIG: 'api_key:show_config',

  // 模型组合相关事件
  MODEL_COMBO_CREATED: 'model_combo:created',
  MODEL_COMBO_UPDATED: 'model_combo:updated',
  MODEL_COMBO_DELETED: 'model_combo:deleted',
  MODEL_COMBO_EXECUTED: 'model_combo:executed',
  MODEL_COMBO_EXECUTION_STARTED: 'model_combo:execution_started',
  MODEL_COMBO_EXECUTION_COMPLETED: 'model_combo:execution_completed',
  MODEL_COMBO_EXECUTION_ERROR: 'model_combo:execution_error',

  // 最佳实例兼容事件
  NEW_BRANCH: 'NEW_BRANCH',
  NEW_CONTEXT: 'NEW_CONTEXT',
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  ADD_NEW_TOPIC: 'ADD_NEW_TOPIC',
  SHOW_TOPIC_SIDEBAR: 'SHOW_TOPIC_SIDEBAR',
  SWITCH_TOPIC_SIDEBAR: 'SWITCH_TOPIC_SIDEBAR',
  COPY_TOPIC_IMAGE: 'COPY_TOPIC_IMAGE',
  EXPORT_TOPIC_IMAGE: 'EXPORT_TOPIC_IMAGE',
  LOCATE_MESSAGE: 'LOCATE_MESSAGE',
  RESEND_MESSAGE: 'RESEND_MESSAGE',
  SHOW_MODEL_SELECTOR: 'SHOW_MODEL_SELECTOR',
  QUOTE_TEXT: 'QUOTE_TEXT'
};
