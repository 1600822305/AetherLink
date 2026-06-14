/**
 * 正则替换工具函数
 * 用于在消息发送/显示时应用正则规则
 */
import type { AssistantRegex, AssistantRegexScope } from '../types/Assistant';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('RegexUtils');

/**
 * 应用单个正则规则到文本
 * @param text 原始文本
 * @param rule 正则规则
 * @returns 替换后的文本
 */
export function applyRegexRule(text: string, rule: AssistantRegex): string {
  if (!text || !rule.enabled || !rule.pattern) {
    return text;
  }

  try {
    // 使用全局匹配标志
    const regex = new RegExp(rule.pattern, 'g');
    return text.replace(regex, rule.replacement);
  } catch (error) {
    logger.error(`正则执行失败: ${rule.name}`, error);
    return text;
  }
}

/**
 * 应用多个正则规则到文本（按顺序执行）
 * @param text 原始文本
 * @param rules 正则规则数组
 * @param scope 作用范围（user/assistant）
 * @param visualOnly 是否只应用 visualOnly 规则
 * @returns 替换后的文本
 */
export function applyRegexRules(
  text: string,
  rules: AssistantRegex[] | undefined,
  scope: AssistantRegexScope,
  visualOnly?: boolean
): string {
  if (!text || !rules || rules.length === 0) {
    return text;
  }

  let result = text;

  for (const rule of rules) {
    // 跳过未启用的规则
    if (!rule.enabled) continue;

    // 检查作用范围
    if (!rule.scopes.includes(scope)) continue;

    // 如果指定了 visualOnly 过滤
    if (visualOnly !== undefined) {
      // visualOnly=true 时只应用 visualOnly 规则
      // visualOnly=false 时只应用非 visualOnly 规则
      if (rule.visualOnly !== visualOnly) continue;
    }

    result = applyRegexRule(result, rule);
  }

  return result;
}

/**
 * 应用正则规则到消息内容（用于发送前处理）
 * 只应用非 visualOnly 的规则
 * @param content 消息内容
 * @param rules 正则规则数组
 * @param scope 作用范围
 * @returns 处理后的内容
 */
export function applyRegexRulesForSending(
  content: string,
  rules: AssistantRegex[] | undefined,
  scope: AssistantRegexScope
): string {
  // 发送时只应用非 visualOnly 的规则
  return applyRegexRules(content, rules, scope, false);
}

/**
 * 应用正则规则到消息内容（用于显示处理）
 * 应用所有规则（包括 visualOnly）
 * @param content 消息内容
 * @param rules 正则规则数组
 * @param scope 作用范围
 * @returns 处理后的内容
 */
export function applyRegexRulesForDisplay(
  content: string,
  rules: AssistantRegex[] | undefined,
  scope: AssistantRegexScope
): string {
  // 显示时应用所有规则
  return applyRegexRules(content, rules, scope);
}

/**
 * 检查规则数组中是否有适用于指定范围的启用规则
 * @param rules 正则规则数组
 * @param scope 作用范围
 * @param visualOnly 可选，只检查特定类型的规则
 * @returns 是否有适用规则
 */
export function hasApplicableRules(
  rules: AssistantRegex[] | undefined,
  scope: AssistantRegexScope,
  visualOnly?: boolean
): boolean {
  if (!rules || rules.length === 0) return false;

  return rules.some(rule => {
    if (!rule.enabled) return false;
    if (!rule.scopes.includes(scope)) return false;
    if (visualOnly !== undefined && rule.visualOnly !== visualOnly) return false;
    return true;
  });
}
