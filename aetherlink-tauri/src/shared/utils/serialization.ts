/**
 * 序列化工具函数
 * 提供数据序列化和反序列化的工具函数，确保数据可以安全地存储到IndexedDB
 *
 * 主要解决以下问题：
 * 1. 循环引用：对象中的属性引用了对象本身或其祖先对象
 * 2. 不可序列化的对象：函数、DOM节点、React组件等
 * 3. 特殊对象：如Map、Set、Symbol等
 */

/**
 * 检查对象是否可以被序列化
 * @param obj 要检查的对象
 * @returns 是否可序列化
 */
export function isSerializable(obj: any): boolean {
  // 处理基本类型和null
  if (obj === null || obj === undefined) return true;
  if (typeof obj !== 'object') return typeof obj !== 'function';

  // 处理日期对象
  if (obj instanceof Date) return true;

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.every(item => isSerializable(item));
  }

  // 处理普通对象
  try {
    JSON.stringify(obj);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 深度克隆对象，确保返回的对象是可序列化的
 * 移除所有不可序列化的属性
 * @param obj 要克隆的对象
 * @returns 可序列化的克隆对象
 */
export function makeSerializable<T>(obj: T): T {
  // 处理基本类型和null
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') {
    return typeof obj === 'function' ? (undefined as any) : obj;
  }

  // 处理日期对象
  if (obj instanceof Date) return new Date(obj.getTime()) as any;

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => makeSerializable(item)) as any;
  }

  // 处理普通对象
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (isSerializable(value)) {
        result[key] = makeSerializable(value);
      }
    }
  }

  return result;
}

/**
 * 安全地序列化对象为JSON字符串
 * 移除所有不可序列化的属性
 * @param obj 要序列化的对象
 * @returns JSON字符串
 */
export function safeStringify(obj: any): string {
  return JSON.stringify(makeSerializable(obj));
}

/**
 * 安全地解析JSON字符串为对象
 * @param str JSON字符串
 * @returns 解析后的对象
 */
export function safeParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    console.error('解析JSON字符串失败:', e);
    return null;
  }
}

/**
 * 检测对象中是否存在循环引用
 * @param obj 要检查的对象
 * @returns 是否存在循环引用
 */
export function hasCircularReferences(obj: any): boolean {
  const seen = new WeakSet();

  const detect = (obj: any): boolean => {
    // 处理基本类型和null
    if (obj === null || obj === undefined) return false;
    if (typeof obj !== 'object') return false;

    // 检测循环引用
    if (seen.has(obj)) return true;

    // 将当前对象添加到已访问集合
    seen.add(obj);

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.some(item => detect(item));
    }

    // 处理普通对象
    return Object.values(obj).some(value => detect(value));
  };

  return detect(obj);
}

/**
 * 诊断对象中的序列化问题
 * 返回详细的问题报告
 * @param obj 要诊断的对象
 * @returns 问题报告
 */
export function diagnoseSerializationIssues(obj: any): {
  hasCircularRefs: boolean;
  nonSerializableProps: string[];
  path: string;
} {
  const seen = new WeakSet();
  const nonSerializableProps: string[] = [];
  let hasCircularRefs = false;

  const diagnose = (obj: any, path: string = 'root') => {
    // 处理基本类型和null
    if (obj === null || obj === undefined) return;

    // 检查函数
    if (typeof obj === 'function') {
      nonSerializableProps.push(`${path} (function)`);
      return;
    }

    // 只处理对象
    if (typeof obj !== 'object') return;

    // 检测循环引用
    if (seen.has(obj)) {
      hasCircularRefs = true;
      nonSerializableProps.push(`${path} (circular reference)`);
      return;
    }

    // 将当前对象添加到已访问集合
    seen.add(obj);

    // 处理数组
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        diagnose(item, `${path}[${index}]`);
      });
      return;
    }

    // 处理特殊对象
    if (obj instanceof Date) return;
    if (obj instanceof Map) {
      nonSerializableProps.push(`${path} (Map)`);
      return;
    }
    if (obj instanceof Set) {
      nonSerializableProps.push(`${path} (Set)`);
      return;
    }
    if (obj instanceof RegExp) {
      nonSerializableProps.push(`${path} (RegExp)`);
      return;
    }

    // 处理普通对象
    for (const [key, value] of Object.entries(obj)) {
      diagnose(value, `${path}.${key}`);
    }
  };

  diagnose(obj);

  return {
    hasCircularRefs,
    nonSerializableProps,
    path: 'root'
  };
}
