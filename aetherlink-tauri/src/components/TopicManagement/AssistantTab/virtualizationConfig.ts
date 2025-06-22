/**
 * 虚拟化配置
 * 用于管理大列表渲染的性能参数
 */

export const VIRTUALIZATION_CONFIG = {
  // 启用虚拟化的阈值
  ENABLE_THRESHOLD: {
    ASSISTANT_LIST: 20,        // 助手列表超过20个时启用虚拟化
    GROUP_ASSISTANT_LIST: 15,  // 分组内助手超过15个时启用虚拟化
    TOPIC_LIST: 30,           // 话题列表超过30个时启用虚拟化
  },

  // 项目高度配置
  ITEM_HEIGHT: {
    ASSISTANT_ITEM: 72,       // 助手项高度
    TOPIC_ITEM: 64,          // 话题项高度 (56px + 8px margin-bottom)
    GROUP_HEADER: 48,        // 分组头部高度
  },

  // 预渲染配置 - 优化：减少预渲染数量提升性能
  OVERSCAN_COUNT: {
    DEFAULT: 2,              // 默认预渲染项目数（减少到2）
    LARGE_LIST: 3,           // 大列表预渲染项目数（减少到3）
    SMALL_LIST: 1,           // 小列表预渲染项目数（减少到1）
  },

  // 容器高度配置
  CONTAINER_HEIGHT: {
    DEFAULT: 400,            // 默认容器高度
    GROUP_MAX: 300,          // 分组内最大高度
    FULL_SCREEN: 'calc(100vh - 200px)', // 全屏模式高度
  },

  // 性能监控配置
  PERFORMANCE: {
    ENABLE_MONITOR: process.env.NODE_ENV === 'development', // 开发环境启用监控
    RENDER_TIME_THRESHOLD: 16, // 渲染时间阈值（毫秒）
    MEMORY_CHECK_INTERVAL: 1000, // 内存检查间隔（毫秒）
  },

  // 滚动配置
  SCROLL: {
    THROTTLE_DELAY: 16,      // 滚动事件节流延迟（约60fps）
    SMOOTH_SCROLL: true,     // 启用平滑滚动
  },
} as const;

/**
 * 根据列表大小获取预渲染数量
 */
export function getOverscanCount(listSize: number): number {
  if (listSize > 100) {
    return VIRTUALIZATION_CONFIG.OVERSCAN_COUNT.LARGE_LIST;
  } else if (listSize < 20) {
    return VIRTUALIZATION_CONFIG.OVERSCAN_COUNT.SMALL_LIST;
  }
  return VIRTUALIZATION_CONFIG.OVERSCAN_COUNT.DEFAULT;
}

/**
 * 判断是否应该启用虚拟化
 */
export function shouldEnableVirtualization(
  listSize: number,
  type: 'assistant' | 'topic' | 'group'
): boolean {
  switch (type) {
    case 'assistant':
      return listSize > VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD.ASSISTANT_LIST;
    case 'topic':
      return listSize > VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD.TOPIC_LIST;
    case 'group':
      return listSize > VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD.GROUP_ASSISTANT_LIST;
    default:
      return false;
  }
}

/**
 * 获取项目高度
 */
export function getItemHeight(type: 'assistant' | 'topic' | 'group'): number {
  switch (type) {
    case 'assistant':
      return VIRTUALIZATION_CONFIG.ITEM_HEIGHT.ASSISTANT_ITEM;
    case 'topic':
      return VIRTUALIZATION_CONFIG.ITEM_HEIGHT.TOPIC_ITEM;
    case 'group':
      return VIRTUALIZATION_CONFIG.ITEM_HEIGHT.GROUP_HEADER;
    default:
      return VIRTUALIZATION_CONFIG.ITEM_HEIGHT.ASSISTANT_ITEM;
  }
}

/**
 * 计算容器高度
 */
export function calculateContainerHeight(
  listSize: number,
  itemHeight: number,
  maxHeight?: number
): number {
  const calculatedHeight = listSize * itemHeight;
  const defaultMax = VIRTUALIZATION_CONFIG.CONTAINER_HEIGHT.DEFAULT;
  const maxAllowed = maxHeight || defaultMax;
  
  return Math.min(calculatedHeight, maxAllowed);
}

/**
 * 性能优化建议
 */
export function getPerformanceRecommendation(listSize: number): {
  shouldVirtualize: boolean;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
} {
  if (listSize < 10) {
    return {
      shouldVirtualize: false,
      recommendation: '列表较小，建议使用标准渲染以减少复杂性',
      severity: 'low'
    };
  } else if (listSize < 50) {
    return {
      shouldVirtualize: true,
      recommendation: '列表中等大小，建议启用虚拟化以提升性能',
      severity: 'medium'
    };
  } else {
    return {
      shouldVirtualize: true,
      recommendation: '列表较大，强烈建议启用虚拟化以避免性能问题',
      severity: 'high'
    };
  }
}
