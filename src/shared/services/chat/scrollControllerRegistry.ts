/**
 * 聊天滚动控制器注册表
 * 取代 window.__chatScrollController 全局变量：消息列表挂载时注册控制器，
 * 其他组件（如 ChatNavigation 的「滑到底」按钮）通过 getter 复用同一贴底状态机。
 */
import type { ChatScrollController } from './ChatScrollController';

let activeController: ChatScrollController | null = null;

export const registerChatScrollController = (controller: ChatScrollController): void => {
  activeController = controller;
};

export const unregisterChatScrollController = (controller: ChatScrollController): void => {
  if (activeController === controller) {
    activeController = null;
  }
};

export const getChatScrollController = (): ChatScrollController | null => activeController;
