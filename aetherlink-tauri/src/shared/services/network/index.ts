/**
 * 网络/API服务模块统一导出
 * 包含所有网络请求、API调用、CORS处理等相关服务
 */

// 核心API服务
export * from './APIService';

// 增强的API提供商（多Key负载均衡、故障转移）
export { EnhancedApiProvider } from './EnhancedApiProvider';
export type { EnhancedApiCallOptions, ApiCallResult } from './EnhancedApiProvider';

// 网络监控服务
export { default as EnhancedNetworkService } from './EnhancedNetworkService';
export type { NetworkEntry, NetworkMethod, NetworkStatus } from './EnhancedNetworkService';

// 原生HTTP服务（移动端CORS绕过）
export { NativeHttpService } from './NativeHttpService';
export type { NativeHttpResponse } from './NativeHttpService';

// 请求拦截服务（开发者工具）
export { default as RequestInterceptorService, RequestStore } from './RequestInterceptorService';
export type { RequestRecord } from './RequestInterceptorService';

// CORS绕过服务
export { CORSBypassService, corsService } from './CORSBypassService';
export type { CORSBypassRequestOptions, CORSBypassResponse } from './CORSBypassService';
