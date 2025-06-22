/**
 * 思考内容调试服务
 * 专门用于追踪和调试思考内容的处理过程，帮助发现内容丢失问题
 */

export interface ThinkingDebugEntry {
  id: string;
  timestamp: number;
  source: string; // 来源：'ai-sdk', 'response-handler', 'thinking-block', etc.
  action: string; // 动作：'receive', 'process', 'accumulate', 'display', etc.
  content: string;
  contentLength: number;
  accumulatedLength?: number;
  metadata?: any;
}

class ThinkingDebugService {
  private static instance: ThinkingDebugService;
  private entries: ThinkingDebugEntry[] = [];
  private maxEntries = 500;
  private isEnabled = true; // 可以通过环境变量控制

  private constructor() {
    // 检查是否启用调试
    this.isEnabled = process.env.NODE_ENV === 'development' || 
                     localStorage.getItem('thinking-debug') === 'true';
  }

  public static getInstance(): ThinkingDebugService {
    if (!ThinkingDebugService.instance) {
      ThinkingDebugService.instance = new ThinkingDebugService();
    }
    return ThinkingDebugService.instance;
  }

  public log(entry: Omit<ThinkingDebugEntry, 'id' | 'timestamp'>): void {
    if (!this.isEnabled) return;

    const debugEntry: ThinkingDebugEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...entry
    };

    this.entries.push(debugEntry);

    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // 输出到控制台（带颜色区分）
    const color = this.getColorForSource(entry.source);
    console.log(
      `%c[ThinkingDebug] ${entry.source} - ${entry.action}`,
      `color: ${color}; font-weight: bold;`,
      `"${entry.content}" (长度: ${entry.contentLength}${entry.accumulatedLength ? `, 累积: ${entry.accumulatedLength}` : ''})`
    );

    if (entry.metadata) {
      console.log(`%c[ThinkingDebug] 元数据:`, `color: ${color};`, entry.metadata);
    }
  }

  public getEntries(): ThinkingDebugEntry[] {
    return [...this.entries];
  }

  public getEntriesBySource(source: string): ThinkingDebugEntry[] {
    return this.entries.filter(entry => entry.source === source);
  }

  public getEntriesInTimeRange(startTime: number, endTime: number): ThinkingDebugEntry[] {
    return this.entries.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  public clear(): void {
    this.entries = [];
    console.log('%c[ThinkingDebug] 调试日志已清空', 'color: orange; font-weight: bold;');
  }

  public exportToJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  public analyzeContentFlow(): void {
    if (!this.isEnabled) return;

    console.group('%c[ThinkingDebug] 内容流分析', 'color: purple; font-weight: bold;');
    
    // 按来源分组
    const bySource = this.entries.reduce((acc, entry) => {
      if (!acc[entry.source]) acc[entry.source] = [];
      acc[entry.source].push(entry);
      return acc;
    }, {} as Record<string, ThinkingDebugEntry[]>);

    Object.entries(bySource).forEach(([source, entries]) => {
      console.group(`%c${source}`, `color: ${this.getColorForSource(source)}; font-weight: bold;`);
      
      let totalLength = 0;
      entries.forEach((entry, index) => {
        totalLength += entry.contentLength;
        console.log(
          `${index + 1}. ${entry.action}: "${entry.content}" (${entry.contentLength} 字符)`
        );
      });
      
      console.log(`%c总计: ${entries.length} 条记录, ${totalLength} 字符`, 'font-weight: bold;');
      console.groupEnd();
    });

    // 检查可能的内容丢失
    this.detectPotentialLoss();
    
    console.groupEnd();
  }

  private detectPotentialLoss(): void {
    const aiSdkEntries = this.getEntriesBySource('ai-sdk');
    const handlerEntries = this.getEntriesBySource('response-handler');
    const blockEntries = this.getEntriesBySource('thinking-block');

    const aiSdkTotal = aiSdkEntries.reduce((sum, entry) => sum + entry.contentLength, 0);
    const handlerTotal = handlerEntries.reduce((sum, entry) => sum + (entry.accumulatedLength || entry.contentLength), 0);
    const blockTotal = blockEntries.reduce((sum, entry) => sum + entry.contentLength, 0);

    console.group('%c内容丢失检测', 'color: red; font-weight: bold;');
    console.log(`AI SDK 总字符数: ${aiSdkTotal}`);
    console.log(`ResponseHandler 总字符数: ${handlerTotal}`);
    console.log(`ThinkingBlock 总字符数: ${blockTotal}`);

    if (aiSdkTotal > handlerTotal) {
      console.warn(`⚠️ 可能在 ResponseHandler 中丢失了 ${aiSdkTotal - handlerTotal} 个字符`);
    }
    if (handlerTotal > blockTotal) {
      console.warn(`⚠️ 可能在 ThinkingBlock 中丢失了 ${handlerTotal - blockTotal} 个字符`);
    }
    if (aiSdkTotal === handlerTotal && handlerTotal === blockTotal) {
      console.log('✅ 未检测到内容丢失');
    }
    console.groupEnd();
  }

  private getColorForSource(source: string): string {
    const colors: Record<string, string> = {
      'ai-sdk': '#2196F3',
      'response-handler': '#4CAF50',
      'thinking-block': '#FF9800',
      'stream-processor': '#9C27B0',
      'event-emitter': '#F44336'
    };
    return colors[source] || '#666666';
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  public enable(): void {
    this.isEnabled = true;
    localStorage.setItem('thinking-debug', 'true');
    console.log('%c[ThinkingDebug] 调试已启用', 'color: green; font-weight: bold;');
  }

  public disable(): void {
    this.isEnabled = false;
    localStorage.removeItem('thinking-debug');
    console.log('%c[ThinkingDebug] 调试已禁用', 'color: gray; font-weight: bold;');
  }

  public isDebugEnabled(): boolean {
    return this.isEnabled;
  }
}

export default ThinkingDebugService;

// 导出单例实例
export const thinkingDebugService = ThinkingDebugService.getInstance();

// 在开发环境下将调试服务暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).thinkingDebug = thinkingDebugService;
}
