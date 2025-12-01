/**
 * 日志中间件
 * 对标 Cherry Studio LoggingMiddleware
 */
import type { CompletionsMiddleware } from '../types';
import type { CompletionsResult } from '../schemas';

export const MIDDLEWARE_NAME = 'LoggingMiddleware';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 日志级别 */
  level: LogLevel;
  /** 是否记录请求参数 */
  logParams: boolean;
  /** 是否记录响应内容 */
  logResponse: boolean;
  /** 是否记录性能指标 */
  logMetrics: boolean;
}

const defaultConfig: LoggingConfig = {
  enabled: true,
  level: LogLevel.INFO,
  logParams: false,
  logResponse: false,
  logMetrics: true,
};

/**
 * 日志中间件
 * 记录请求和响应信息，用于调试
 */
export const LoggingMiddleware: CompletionsMiddleware = (_api) => (next) =>
  async (context, params): Promise<CompletionsResult> => {
    const config = defaultConfig;
    
    if (!config.enabled) {
      return next(context, params);
    }

    const startTime = Date.now();
    const { assistant, messages, callType } = params;
    const model = assistant?.model;

    // 请求开始日志
    console.log(`[Logging] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[Logging] 📤 Request Start`);
    console.log(`[Logging]   Model: ${model?.id || 'unknown'}`);
    console.log(`[Logging]   CallType: ${callType}`);
    console.log(`[Logging]   Messages: ${messages?.length || 0}`);
    
    if (config.logParams) {
      console.log(`[Logging]   Params:`, JSON.stringify(params, null, 2).slice(0, 500));
    }

    try {
      const result = await next(context, params);
      
      const duration = Date.now() - startTime;
      const text = result.getText?.() || '';
      const reasoning = result.getReasoning?.();

      // 请求成功日志
      console.log(`[Logging] ✅ Request Success`);
      console.log(`[Logging]   Duration: ${duration}ms`);
      console.log(`[Logging]   Text Length: ${text.length}`);
      
      if (reasoning) {
        console.log(`[Logging]   Reasoning Length: ${reasoning.length}`);
      }
      
      if (config.logMetrics && result.usage) {
        console.log(`[Logging]   Tokens: ${result.usage.prompt_tokens} in / ${result.usage.completion_tokens} out`);
      }
      
      if (config.logResponse && text) {
        console.log(`[Logging]   Response: ${text.slice(0, 200)}...`);
      }

      console.log(`[Logging] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 请求失败日志
      console.error(`[Logging] ❌ Request Failed`);
      console.error(`[Logging]   Duration: ${duration}ms`);
      console.error(`[Logging]   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`[Logging] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      throw error;
    }
  };
