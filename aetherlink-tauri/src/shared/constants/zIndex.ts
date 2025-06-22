/**
 * Z-Index 层级管理常量
 * 统一管理应用中所有组件的z-index值，避免层级冲突
 */

export const Z_INDEX = {
  // 基础层级
  BASE: 1,
  
  // 消息相关组件
  MESSAGE: {
    BUBBLE_INDICATORS: 3,    // 气泡指示器（版本指示器等）
    BUBBLE_MENU_BUTTON: 10,  // 气泡模式三点菜单按钮
    TOOLBAR_BUTTON: 100,     // 工具栏按钮
  },
  
  // 菜单和弹窗
  MENU: {
    DROPDOWN: 1300,          // 下拉菜单
    CONTEXT: 1300,           // 上下文菜单
    POPOVER: 1200,           // 弹出框
  },
  
  // 模态框和对话框
  MODAL: {
    BACKDROP: 1400,          // 模态框背景
    DIALOG: 1500,            // 对话框
  },
  
  // 通知和提示
  NOTIFICATION: {
    TOAST: 2000,             // Toast 通知
    TOOLTIP: 1600,           // 工具提示
  },
  
  // 最高层级（调试工具等）
  DEBUG: 9999,
} as const;

// 类型定义，确保类型安全
export type ZIndexLevel = typeof Z_INDEX[keyof typeof Z_INDEX];
