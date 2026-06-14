/**
 * 全局错误捕获：window 'error' / 'unhandledrejection' 统一记入新日志系统。
 * 自旧 EnhancedConsoleService 的 window 监听迁移而来（阶段6），经统一 logger 走脱敏与内存缓冲。
 */
import { createLogger } from './index';

const log = createLogger('未捕获');
let installed = false;

export function installGlobalErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : undefined;
    const name = error?.name ?? 'Error';
    const message = error?.message ?? event.message;
    log.error(`Uncaught ${name}: ${message}`, error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    log.error(`Uncaught (in promise) ${String(event.reason)}`, event.reason);
  });
}
