/**
 * 中间件构建器
 * 提供流式API来构建中间件链
 */
import type { Middleware, MiddlewareBuilderOptions } from './types';
import { MIDDLEWARE_NAMES } from './types';
import { MiddlewareRegistry } from './registry';

/**
 * 中间件构建器类
 * 支持链式调用构建中间件列表
 */
export class MiddlewareBuilder {
  private middlewares: Middleware[] = [];

  constructor(options?: MiddlewareBuilderOptions) {
    if (options?.middlewares) {
      this.middlewares = [...options.middlewares];
    }
  }

  /**
   * 创建带默认中间件的构建器
   */
  public static withDefaults(): MiddlewareBuilder {
    const builder = new MiddlewareBuilder();

    // 按优先级添加默认中间件
    const defaultOrder = [
      MIDDLEWARE_NAMES.FINAL_CONSUMER,      // 0 - 最外层：消费最终结果
      MIDDLEWARE_NAMES.ERROR_HANDLER,       // 10 - 错误处理
      MIDDLEWARE_NAMES.ABORT_HANDLER,       // 20 - 中断处理
      MIDDLEWARE_NAMES.TIMEOUT_HANDLER,     // 25 - 超时处理
      MIDDLEWARE_NAMES.LOGGER,              // 30 - 日志
      MIDDLEWARE_NAMES.WEB_SEARCH,          // 40 - 网络搜索
      MIDDLEWARE_NAMES.TOOL_USE_EXTRACTION, // 50 - 工具调用提取
      MIDDLEWARE_NAMES.THINKING_EXTRACTION, // 60 - 思考过程提取
      MIDDLEWARE_NAMES.RESPONSE_TRANSFORM,  // 70 - 响应转换
      MIDDLEWARE_NAMES.STREAM_ADAPTER,      // 80 - 流适配
      MIDDLEWARE_NAMES.REQUEST_TRANSFORM,   // 90 - 请求转换
    ];

    defaultOrder.forEach(name => {
      const middleware = MiddlewareRegistry.get(name);
      if (middleware && middleware.enabled !== false) {
        builder.middlewares.push(middleware);
      }
    });

    return builder;
  }

  /**
   * 创建空的构建器
   */
  public static empty(): MiddlewareBuilder {
    return new MiddlewareBuilder();
  }

  /**
   * 从注册表创建（包含所有启用的中间件）
   */
  public static fromRegistry(): MiddlewareBuilder {
    const builder = new MiddlewareBuilder();
    builder.middlewares = MiddlewareRegistry.getEnabled();
    return builder;
  }

  /**
   * 添加中间件
   */
  public add(middleware: Middleware | string): MiddlewareBuilder {
    if (typeof middleware === 'string') {
      const m = MiddlewareRegistry.get(middleware);
      if (m) {
        this.middlewares.push(m);
      } else {
        console.warn(`[MiddlewareBuilder] 未找到中间件: ${middleware}`);
      }
    } else {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * 在指定位置之前插入中间件
   */
  public insertBefore(targetName: string, middleware: Middleware | string): MiddlewareBuilder {
    const toInsert = this.resolveMiddleware(middleware);
    if (!toInsert) return this;

    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index === -1) {
      this.middlewares.unshift(toInsert);
    } else {
      this.middlewares.splice(index, 0, toInsert);
    }
    return this;
  }

  /**
   * 在指定位置之后插入中间件
   */
  public insertAfter(targetName: string, middleware: Middleware | string): MiddlewareBuilder {
    const toInsert = this.resolveMiddleware(middleware);
    if (!toInsert) return this;

    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index === -1) {
      this.middlewares.push(toInsert);
    } else {
      this.middlewares.splice(index + 1, 0, toInsert);
    }
    return this;
  }

  /**
   * 移除中间件
   */
  public remove(name: string): MiddlewareBuilder {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
    return this;
  }

  /**
   * 替换中间件
   */
  public replace(name: string, middleware: Middleware): MiddlewareBuilder {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares[index] = middleware;
    }
    return this;
  }

  /**
   * 只保留指定的中间件
   */
  public only(...names: string[]): MiddlewareBuilder {
    this.middlewares = this.middlewares.filter(m => names.includes(m.name));
    return this;
  }

  /**
   * 排除指定的中间件
   */
  public except(...names: string[]): MiddlewareBuilder {
    this.middlewares = this.middlewares.filter(m => !names.includes(m.name));
    return this;
  }

  /**
   * 清空所有中间件
   */
  public clear(): MiddlewareBuilder {
    this.middlewares = [];
    return this;
  }

  /**
   * 按优先级排序
   */
  public sort(): MiddlewareBuilder {
    this.middlewares.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
    return this;
  }

  /**
   * 构建中间件数组
   */
  public build(): Middleware[] {
    return [...this.middlewares];
  }

  /**
   * 获取当前中间件名称列表
   */
  public getNames(): string[] {
    return this.middlewares.map(m => m.name);
  }

  /**
   * 检查是否包含指定中间件
   */
  public has(name: string): boolean {
    return this.middlewares.some(m => m.name === name);
  }

  /**
   * 获取中间件数量
   */
  public count(): number {
    return this.middlewares.length;
  }

  /**
   * 克隆构建器
   */
  public clone(): MiddlewareBuilder {
    const builder = new MiddlewareBuilder();
    builder.middlewares = [...this.middlewares];
    return builder;
  }

  /**
   * 解析中间件（字符串或对象）
   */
  private resolveMiddleware(middleware: Middleware | string): Middleware | undefined {
    if (typeof middleware === 'string') {
      return MiddlewareRegistry.get(middleware);
    }
    return middleware;
  }
}
