/**
 * SillyTavern 正则脚本导入转换器
 * 将 SillyTavern 的正则脚本格式转换为本项目的 AssistantRegex 格式
 */
import { v4 as uuidv4 } from 'uuid';
import type { AssistantRegex, AssistantRegexScope } from '../types/Assistant';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('SillyTavernRegex');

/**
 * SillyTavern 正则脚本格式
 */
export interface SillyTavernRegexScript {
  id?: string;
  scriptName: string;
  findRegex: string;
  replaceString: string;
  trimStrings?: string[];
  placement: number[]; // 0=User Input, 1=AI Response, 2=Slash Commands, 3=World Info, 4=Reasoning
  disabled?: boolean;
  markdownOnly?: boolean; // 仅影响显示（对应 visualOnly）
  promptOnly?: boolean;   // 仅影响提示词
  runOnEdit?: boolean;
  substituteRegex?: number; // 0=none, 1=raw, 2=escaped
  minDepth?: number | null;
  maxDepth?: number | null;
}

/**
 * 将 SillyTavern placement 数组转换为作用范围
 * SillyTavern placement: 0=User Input, 1=AI Response
 */
function convertPlacementToScopes(placement: number[]): AssistantRegexScope[] {
  const scopes: AssistantRegexScope[] = [];
  
  if (placement.includes(0)) {
    scopes.push('user');
  }
  if (placement.includes(1)) {
    scopes.push('assistant');
  }
  
  // 如果没有匹配的范围，默认应用到 assistant
  if (scopes.length === 0) {
    scopes.push('assistant');
  }
  
  return scopes;
}

/**
 * 处理 SillyTavern 的 {{match}} 宏
 * 将 {{match}} 转换为 $& (JavaScript 正则的完整匹配引用)
 */
function convertReplaceString(replaceString: string): string {
  // 将 {{match}} 转换为 $&
  return replaceString.replace(/\{\{match\}\}/gi, '$&');
}

/**
 * 将单个 SillyTavern 正则脚本转换为 AssistantRegex
 */
export function convertSillyTavernScript(script: SillyTavernRegexScript): AssistantRegex {
  return {
    id: uuidv4(), // 生成新的 UUID
    name: script.scriptName || '未命名规则',
    pattern: script.findRegex || '',
    replacement: convertReplaceString(script.replaceString || ''),
    scopes: convertPlacementToScopes(script.placement || [1]),
    visualOnly: script.markdownOnly ?? false,
    enabled: !(script.disabled ?? false)
  };
}

/**
 * 批量导入 SillyTavern 正则脚本
 * @param jsonContent JSON 字符串或已解析的对象
 * @returns 转换后的 AssistantRegex 数组
 */
export function importSillyTavernRegexScripts(jsonContent: string | object): AssistantRegex[] {
  let data: SillyTavernRegexScript | SillyTavernRegexScript[];
  
  // 解析 JSON
  if (typeof jsonContent === 'string') {
    try {
      data = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error('无效的 JSON 格式');
    }
  } else {
    data = jsonContent as SillyTavernRegexScript | SillyTavernRegexScript[];
  }
  
  // 处理单个脚本或数组
  const scripts = Array.isArray(data) ? data : [data];
  
  // 验证并转换
  const results: AssistantRegex[] = [];
  
  for (const script of scripts) {
    // 基本验证
    if (!script.scriptName && !script.findRegex) {
      logger.warn('跳过无效脚本:', script);
      continue;
    }
    
    // 验证正则表达式是否有效
    if (script.findRegex) {
      try {
        new RegExp(script.findRegex);
      } catch (error) {
        logger.warn(`正则表达式无效: ${script.findRegex}`, error);
        // 仍然导入，让用户手动修复
      }
    }
    
    results.push(convertSillyTavernScript(script));
  }
  
  return results;
}

/**
 * 验证是否为有效的 SillyTavern 正则脚本格式
 */
export function isSillyTavernRegexFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const scripts = Array.isArray(data) ? data : [data];
  
  for (const script of scripts) {
    // 检查必要字段
    if (typeof script !== 'object' || script === null) {
      return false;
    }
    
    const s = script as Record<string, unknown>;
    
    // SillyTavern 脚本必须有 scriptName 或 findRegex
    if (!s.scriptName && !s.findRegex) {
      return false;
    }
    
    // placement 应该是数组
    if (s.placement !== undefined && !Array.isArray(s.placement)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 获取导入预览信息
 */
export function getImportPreview(jsonContent: string): {
  count: number;
  scripts: Array<{ name: string; pattern: string; scopes: string[] }>;
  errors: string[];
} {
  const errors: string[] = [];
  let data: unknown;
  
  try {
    data = JSON.parse(jsonContent);
  } catch {
    return { count: 0, scripts: [], errors: ['无效的 JSON 格式'] };
  }
  
  if (!isSillyTavernRegexFormat(data)) {
    return { count: 0, scripts: [], errors: ['不是有效的 SillyTavern 正则脚本格式'] };
  }
  
  const scripts = Array.isArray(data) ? data : [data];
  const preview = scripts.map((script: SillyTavernRegexScript) => {
    const scopes = convertPlacementToScopes(script.placement || [1]);
    return {
      name: script.scriptName || '未命名',
      pattern: script.findRegex || '',
      scopes: scopes
    };
  });
  
  return {
    count: scripts.length,
    scripts: preview,
    errors
  };
}
