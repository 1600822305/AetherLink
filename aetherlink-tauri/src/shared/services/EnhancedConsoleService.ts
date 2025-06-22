/**
 * 增强控制台服务
 * 捕获所有控制台输出，包括 console.log, console.error, console.warn 等
 * 提供类似浏览器开发者工具的控制台功能
 */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'group' | 'groupEnd' | 'clear';

export interface ConsoleEntry {
  id: string;
  timestamp: number;
  level: ConsoleLevel;
  args: any[];
  stack?: string;
  count?: number;
  groupLevel?: number;
}

export interface ConsoleFilter {
  levels: Set<ConsoleLevel>;
  searchText: string;
  showTimestamps: boolean;
}

class EnhancedConsoleService {
  private static instance: EnhancedConsoleService;
  private entries: ConsoleEntry[] = [];
  private maxEntries = 1000;
  private listeners: ((entries: ConsoleEntry[]) => void)[] = [];
  private originalConsole: Record<string, (...args: any[]) => void> = {};
  private isIntercepting = false;
  private groupLevel = 0;
  private counts: Map<string, number> = new Map();

  private constructor() {
    this.setupConsoleInterception();
  }

  public static getInstance(): EnhancedConsoleService {
    if (!EnhancedConsoleService.instance) {
      EnhancedConsoleService.instance = new EnhancedConsoleService();
    }
    return EnhancedConsoleService.instance;
  }

  private setupConsoleInterception(): void {
    if (this.isIntercepting) return;

    // 保存原始控制台方法
    const consoleMethods: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
    
    consoleMethods.forEach(method => {
      this.originalConsole[method] = console[method].bind(console);
      
      (console as any)[method] = (...args: any[]) => {
        // 过滤特定的警告
        if (method === 'error' && args.length > 0) {
          const message = String(args[0] || '');
          if (message.includes('non-boolean attribute `button`') ||
              (message.includes('Received `%s` for a non-boolean attribute `%s`') &&
               args.length > 1 && String(args[1]).includes('true') && String(args[2]).includes('button')) ||
              message.includes("The Menu component doesn't accept a Fragment as a child") ||
              message.includes('[@use-gesture]: The drag target has its `touch-action` style property set to `auto`') ||
              message.includes('Selector unknown returned the root state') ||
              message.includes('This can lead to unnecessary rerenders')) {
            return; // 不调用原始方法，也不记录到系统
          }
        }

        // 调用原始方法
        this.originalConsole[method](...args);

        // 记录到我们的系统
        this.addEntry({
          id: this.generateId(),
          timestamp: Date.now(),
          level: method,
          args: this.serializeArgs(args),
          stack: method === 'error' || method === 'warn' ? this.getStackTrace() : undefined,
          groupLevel: this.groupLevel
        });
      };
    });

    // 特殊处理 console.group 和 console.groupEnd
    this.originalConsole.group = console.group.bind(console);
    this.originalConsole.groupEnd = console.groupEnd.bind(console);

    console.group = (...args: any[]) => {
      this.originalConsole.group(...args);
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'group',
        args: this.serializeArgs(args),
        groupLevel: this.groupLevel
      });
      this.groupLevel++;
    };

    console.groupEnd = () => {
      this.originalConsole.groupEnd();
      this.groupLevel = Math.max(0, this.groupLevel - 1);
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'groupEnd',
        args: [],
        groupLevel: this.groupLevel
      });
    };

    // 处理 console.clear
    this.originalConsole.clear = console.clear.bind(console);
    console.clear = () => {
      this.originalConsole.clear();
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'clear',
        args: ['Console was cleared'],
        groupLevel: 0
      });
    };

    // 捕获未处理的错误和Promise拒绝
    window.addEventListener('error', (event) => {
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'error',
        args: [`Uncaught ${event.error?.name || 'Error'}: ${event.error?.message || event.message}`],
        stack: event.error?.stack,
        groupLevel: this.groupLevel
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'error',
        args: [`Uncaught (in promise) ${event.reason}`],
        stack: event.reason?.stack,
        groupLevel: this.groupLevel
      });
    });

    this.isIntercepting = true;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private serializeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (arg === null) return null;
      if (arg === undefined) return undefined;
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        return arg;
      }
      if (arg instanceof Error) {
        return {
          __type: 'Error',
          name: arg.name,
          message: arg.message,
          stack: arg.stack
        };
      }
      if (arg instanceof Element) {
        return {
          __type: 'Element',
          tagName: arg.tagName,
          id: arg.id,
          className: arg.className,
          outerHTML: arg.outerHTML.substring(0, 200) + (arg.outerHTML.length > 200 ? '...' : '')
        };
      }
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    });
  }

  private getStackTrace(): string {
    const stack = new Error().stack;
    if (!stack) return '';
    
    const lines = stack.split('\n');
    // 移除前几行（这个函数本身的调用栈）
    return lines.slice(3).join('\n');
  }

  private addEntry(entry: ConsoleEntry): void {
    this.entries.push(entry);
    // this.originalConsole.log('Debug: Adding entry with args', JSON.stringify(entry.args));

    // 限制条目数量
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // 通知监听器
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.entries]);
      } catch (error) {
        this.originalConsole.error('Error in console listener:', error);
      }
    });
  }

  public getEntries(): ConsoleEntry[] {
    return [...this.entries];
  }

  public getFilteredEntries(filter: ConsoleFilter): ConsoleEntry[] {
    return this.entries.filter(entry => {
      // 级别过滤
      if (!filter.levels.has(entry.level)) {
        return false;
      }
      
      // 文本搜索
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        const argsText = entry.args.map(arg => String(arg)).join(' ').toLowerCase();
        if (!argsText.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }

  public addListener(listener: (entries: ConsoleEntry[]) => void): () => void {
    this.listeners.push(listener);
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public clear(): void {
    this.entries = [];
    this.groupLevel = 0;
    this.counts.clear();
    this.notifyListeners();
  }

  public executeCommand(command: string): void {
    try {
      // 在全局作用域中执行命令
      const result = (window as any).eval(command);
      
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'log',
        args: [`> ${command}`, result],
        groupLevel: this.groupLevel
      });
    } catch (error) {
      this.addEntry({
        id: this.generateId(),
        timestamp: Date.now(),
        level: 'error',
        args: [`> ${command}`, error],
        stack: (error as Error).stack,
        groupLevel: this.groupLevel
      });
    }
  }

  public formatArg(arg: any): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg && arg.__type === 'Error') {
      return `${arg.name}: ${arg.message}`;
    }
    if (arg && arg.__type === 'Element') {
      return `<${arg.tagName.toLowerCase()}${arg.id ? ` id="${arg.id}"` : ''}${arg.className ? ` class="${arg.className}"` : ''}>`;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }

  public getArgType(arg: any): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg && arg.__type) return arg.__type;
    return typeof arg;
  }
}

export default EnhancedConsoleService;