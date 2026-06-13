/**
 * MCP 工具确认服务
 * 
 * 单例服务，管理敏感工具调用的确认/拒绝流程。
 * 通过 EventEmitter 与 UI 层解耦，支持多端适配。
 * 
 * 流程：
 * 1. MCPService.callTool() 检查工具是否需要确认
 * 2. 需要确认 → 调用 requestConfirmation()
 * 3. 发出事件 → UI 展示确认对话框
 * 4. 用户决定 → respond() → resolve Promise
 * 5. 返回执行或拒绝结果
 */

import { v4 as uuid } from 'uuid';
import { EventEmitter } from '../../infra/EventService';
import type {
  RiskLevel,
  ToolConfirmationRequest,
  ConfirmableToolEntry
} from './types';
import { createLogger } from '../../infra/logger';

const logger = createLogger('ToolConfirmation');


/** 确认系统事件名 */
export const CONFIRMATION_EVENTS = {
  /** 需要用户确认（UI 监听此事件弹出对话框） */
  REQUIRED: 'mcp:tool_confirmation_required',
  /** 确认请求已过期 */
  EXPIRED: 'mcp:tool_confirmation_expired'
} as const;

/** 确认请求超时时间（毫秒） */
const CONFIRMATION_TIMEOUT = 60_000;

/** 待处理的确认请求 */
interface PendingRequest {
  request: ToolConfirmationRequest;
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ToolConfirmationService {
  private static instance: ToolConfirmationService;

  /** 已注册需要确认的工具 */
  private registry: Map<string, ConfirmableToolEntry> = new Map();

  /** 待处理的确认请求 */
  private pending: Map<string, PendingRequest> = new Map();

  private constructor() {}

  static getInstance(): ToolConfirmationService {
    if (!ToolConfirmationService.instance) {
      ToolConfirmationService.instance = new ToolConfirmationService();
    }
    return ToolConfirmationService.instance;
  }

  // ─── 注册表管理 ───

  /**
   * 注册需要确认的工具
   * @param toolName 工具名（直接匹配 callTool 的 toolName 参数）
   * @param risk 风险等级
   * @param summaryBuilder 可选的摘要生成器
   */
  registerConfirmable(
    toolName: string,
    risk: RiskLevel,
    summaryBuilder?: (args: Record<string, unknown>) => string
  ): void {
    this.registry.set(toolName, { toolName, risk, summaryBuilder });
    logger.debug(`已注册需确认工具: ${toolName} (${risk})`);
  }

  /**
   * 批量注册
   */
  registerMultiple(entries: Array<{ toolName: string; risk: RiskLevel; summaryBuilder?: (args: Record<string, unknown>) => string }>): void {
    for (const entry of entries) {
      this.registerConfirmable(entry.toolName, entry.risk, entry.summaryBuilder);
    }
  }

  /**
   * 取消注册
   */
  unregister(toolName: string): void {
    this.registry.delete(toolName);
  }

  /**
   * 检查工具是否需要确认
   */
  needsConfirmation(toolName: string): boolean {
    return this.registry.has(toolName);
  }

  /**
   * 获取工具的风险等级
   */
  getRiskLevel(toolName: string): RiskLevel {
    return this.registry.get(toolName)?.risk || 'medium';
  }

  // ─── 确认流程 ───

  /**
   * 请求用户确认
   * 返回 Promise<boolean>，挂起直到用户操作或超时
   */
  async requestConfirmation(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<boolean> {
    const entry = this.registry.get(toolName);
    if (!entry) return true; // 未注册的工具默认通过

    const request: ToolConfirmationRequest = {
      id: uuid(),
      serverName,
      toolName,
      arguments: args,
      summary: entry.summaryBuilder
        ? entry.summaryBuilder(args)
        : this.buildDefaultSummary(toolName, args),
      risk: entry.risk,
      timestamp: Date.now()
    };

    return new Promise<boolean>((resolve) => {
      // 超时自动拒绝
      const timer = setTimeout(() => {
        if (this.pending.has(request.id)) {
          logger.warn(`确认请求超时，自动拒绝: ${toolName}`);
          this.pending.delete(request.id);
          EventEmitter.emit(CONFIRMATION_EVENTS.EXPIRED, { requestId: request.id });
          resolve(false);
        }
      }, CONFIRMATION_TIMEOUT);

      this.pending.set(request.id, { request, resolve, timer });

      // 通知 UI 层
      logger.debug(`等待用户确认: ${toolName}`, request);
      EventEmitter.emit(CONFIRMATION_EVENTS.REQUIRED, request);
    });
  }

  /**
   * UI 层调用：用户做出了决定
   */
  respond(requestId: string, approved: boolean): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      logger.warn(`未找到待处理的确认请求: ${requestId}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(requestId);

    logger.debug(`用户${approved ? '批准' : '拒绝'}了操作: ${pending.request.toolName}`);
    pending.resolve(approved);
  }

  /**
   * 获取当前待处理的确认请求数
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * 清理所有待处理请求（全部拒绝）
   */
  rejectAll(): void {
    for (const [, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.resolve(false);
    }
    this.pending.clear();
  }

  // ─── 内部工具 ───

  /**
   * 默认摘要生成器
   */
  private buildDefaultSummary(toolName: string, args: Record<string, unknown>): string {
    const parts: string[] = [];

    switch (toolName) {
      case 'create_knowledge_base':
        parts.push(`创建知识库「${args.name || '未命名'}」`);
        if (args.model) parts.push(`使用模型: ${args.model}`);
        break;
      case 'delete_knowledge_base':
        parts.push(`删除知识库（ID: ${args.id}）及其所有关联文档`);
        break;
      case 'delete_document':
        parts.push(`删除文档片段（ID: ${args.documentId}）`);
        break;
      case 'add_document':
        parts.push(`向知识库添加文档`);
        if (args.source) parts.push(`来源: ${args.source}`);
        break;
      default:
        parts.push(`执行操作: ${toolName}`);
        break;
    }

    return parts.join('，');
  }
}
