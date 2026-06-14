/**
 * 控制台噪音过滤：抑制已知的第三方/框架 console.error 噪音（React 属性告警、手势库提示等）。
 * 自旧 EnhancedConsoleService 迁移而来（阶段6）：旧服务在全量拦截 console 时顺带做了这层过滤，
 * 退役其 console 拦截后，这里仅保留对 console.error 的噪音抑制，避免污染控制台。
 */
let installed = false;

function isNoise(args: unknown[]): boolean {
  if (args.length === 0) return false;
  const message = String(args[0] ?? '');
  return (
    message.includes('non-boolean attribute `button`') ||
    (message.includes('Received `%s` for a non-boolean attribute `%s`') &&
      args.length > 1 &&
      String(args[1]).includes('true') &&
      String(args[2]).includes('button')) ||
    message.includes("The Menu component doesn't accept a Fragment as a child") ||
    message.includes(
      '[@use-gesture]: The drag target has its `touch-action` style property set to `auto`',
    ) ||
    message.includes('Selector unknown returned the root state') ||
    message.includes('This can lead to unnecessary rerenders')
  );
}

export function installConsoleNoiseFilter(): void {
  if (installed || typeof console === 'undefined') return;
  installed = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (isNoise(args)) return;
    originalError(...args);
  };
}
