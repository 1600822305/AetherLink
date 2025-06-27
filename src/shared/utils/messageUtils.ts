/**
 * 消息工具模块 - 向后兼容导出
 * 
 * 注意：此文件已重构为模块化结构，所有功能已迁移到 messageUtils/ 文件夹中
 * 为保持向后兼容性，此文件重新导出所有功能
 * 
 * 新的模块化结构：
 * - messageUtils/constants.ts - 常量定义
 * - messageUtils/messageFactory.ts - 消息创建工厂
 * - messageUtils/blockFactory.ts - 消息块创建工厂
 * - messageUtils/blockFinders.ts - 消息块查找器
 * - messageUtils/contentExtractor.ts - 内容提取器
 * - messageUtils/utilityFunctions.ts - 工具函数
 * - messageUtils/index.ts - 统一导出
 */

// 重新导出所有功能以保持向后兼容
export * from './messageUtils/index';
