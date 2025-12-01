/**
 * 中间件构建器
 * 对标 Cherry Studio CompletionsMiddlewareBuilder
 */
import type { CompletionsMiddleware, NamedMiddleware } from './types';

/**
 * Completions 中间件构建器
 * 提供流式 API 构建中间件链
 */
export class CompletionsMiddlewareBuilder {
  private middlewares: NamedMiddleware[] = [];

  /**
   * 创建带默认中间件的构建器
   */
  static withDefaults(): CompletionsMiddlewareBuilder {
    // 延迟导入避免循环依赖
    const { DefaultCompletionsNamedMiddlewares } = require('./registry');
    const builder = new CompletionsMiddlewareBuilder();
    builder.middlewares = [...DefaultCompletionsNamedMiddlewares];
    return builder;
  }

  /**
   * 创建空构建器
   */
  static empty(): CompletionsMiddlewareBuilder {
    return new CompletionsMiddlewareBuilder();
  }

  /**
   * 添加中间件
   */
  add(namedMiddleware: NamedMiddleware): this {
    this.middlewares.push(namedMiddleware);
    return this;
  }

  /**
   * 在指定中间件之后插入
   */
  insertAfter(targetName: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index !== -1) {
      this.middlewares.splice(index + 1, 0, namedMiddleware);
    } else {
      console.warn(`[MiddlewareBuilder] Middleware '${targetName}' not found, appending to end`);
      this.middlewares.push(namedMiddleware);
    }
    return this;
  }

  /**
   * 在指定中间件之前插入
   */
  insertBefore(targetName: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === targetName);
    if (index !== -1) {
      this.middlewares.splice(index, 0, namedMiddleware);
    } else {
      console.warn(`[MiddlewareBuilder] Middleware '${targetName}' not found, prepending to start`);
      this.middlewares.unshift(namedMiddleware);
    }
    return this;
  }

  /**
   * 移除中间件
   */
  remove(name: string): this {
    const before = this.middlewares.length;
    this.middlewares = this.middlewares.filter(m => m.name !== name);
    if (this.middlewares.length === before) {
      console.debug(`[MiddlewareBuilder] Middleware '${name}' not found for removal`);
    }
    return this;
  }

  /**
   * 替换中间件
   */
  replace(name: string, namedMiddleware: NamedMiddleware): this {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares[index] = namedMiddleware;
    } else {
      console.warn(`[MiddlewareBuilder] Middleware '${name}' not found for replacement`);
    }
    return this;
  }

  /**
   * 检查是否包含中间件
   */
  has(name: string): boolean {
    return this.middlewares.some(m => m.name === name);
  }

  /**
   * 清空所有中间件
   */
  clear(): this {
    this.middlewares = [];
    return this;
  }

  /**
   * 获取中间件数量
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * 构建最终的中间件数组
   */
  build(): CompletionsMiddleware[] {
    return this.middlewares.map(m => m.middleware);
  }

  /**
   * 获取具名中间件数组（用于调试）
   */
  buildNamed(): NamedMiddleware[] {
    return [...this.middlewares];
  }

  /**
   * 获取中间件名称列表
   */
  getNames(): string[] {
    return this.middlewares.map(m => m.name);
  }

  /**
   * 克隆构建器
   */
  clone(): CompletionsMiddlewareBuilder {
    const builder = new CompletionsMiddlewareBuilder();
    builder.middlewares = [...this.middlewares];
    return builder;
  }
}
