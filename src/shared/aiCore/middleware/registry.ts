/**
 * 中间件注册表
 * 集中管理所有可用的中间件
 */
import type { Middleware } from './types';

/**
 * 中间件注册表类
 */
class MiddlewareRegistryClass {
  private middlewares: Map<string, Middleware> = new Map();

  /**
   * 注册中间件
   */
  public register(middleware: Middleware): void {
    if (this.middlewares.has(middleware.name)) {
      console.warn(`[MiddlewareRegistry] 中间件 "${middleware.name}" 已存在，将被覆盖`);
    }
    
    // 设置默认值
    const normalizedMiddleware: Middleware = {
      ...middleware,
      priority: middleware.priority ?? 50,
      enabled: middleware.enabled ?? true,
    };
    
    this.middlewares.set(middleware.name, normalizedMiddleware);
    console.log(`[MiddlewareRegistry] 注册中间件: ${middleware.name} (优先级: ${normalizedMiddleware.priority})`);
  }

  /**
   * 批量注册
   */
  public registerAll(middlewares: Middleware[]): void {
    middlewares.forEach(m => this.register(m));
  }

  /**
   * 获取中间件
   */
  public get(name: string): Middleware | undefined {
    return this.middlewares.get(name);
  }

  /**
   * 检查是否存在
   */
  public has(name: string): boolean {
    return this.middlewares.has(name);
  }

  /**
   * 获取所有中间件
   */
  public getAll(): Middleware[] {
    return Array.from(this.middlewares.values());
  }

  /**
   * 获取所有启用的中间件（按优先级排序）
   */
  public getEnabled(): Middleware[] {
    return this.getAll()
      .filter(m => m.enabled !== false)
      .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
  }

  /**
   * 获取所有名称
   */
  public getNames(): string[] {
    return Array.from(this.middlewares.keys());
  }

  /**
   * 移除中间件
   */
  public remove(name: string): boolean {
    const result = this.middlewares.delete(name);
    if (result) {
      console.log(`[MiddlewareRegistry] 移除中间件: ${name}`);
    }
    return result;
  }

  /**
   * 启用中间件
   */
  public enable(name: string): boolean {
    const middleware = this.middlewares.get(name);
    if (middleware) {
      middleware.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * 禁用中间件
   */
  public disable(name: string): boolean {
    const middleware = this.middlewares.get(name);
    if (middleware) {
      middleware.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * 更新中间件优先级
   */
  public setPriority(name: string, priority: number): boolean {
    const middleware = this.middlewares.get(name);
    if (middleware) {
      middleware.priority = priority;
      return true;
    }
    return false;
  }

  /**
   * 清空注册表
   */
  public clear(): void {
    this.middlewares.clear();
    console.log(`[MiddlewareRegistry] 已清空所有中间件`);
  }

  /**
   * 获取统计信息
   */
  public getStats(): {
    total: number;
    enabled: number;
    disabled: number;
  } {
    const all = this.getAll();
    const enabled = all.filter(m => m.enabled !== false);
    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
    };
  }
}

// 导出单例实例
export const MiddlewareRegistry = new MiddlewareRegistryClass();
