/**
 * 系统提示词变量处理工具
 * 用于在系统提示词中注入动态变量
 */

export interface SystemPromptVariableConfig {
  enableTimeVariable?: boolean;
  enableLocationVariable?: boolean;
  customLocation?: string;
  enableOSVariable?: boolean;
}

/**
 * 获取当前时间的格式化字符串
 */
export const getCurrentTimeString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekday = weekdays[now.getDay()];

  return `${year}年${month}月${day}日 ${hour}:${minute} ${weekday}`;
};

/**
 * 获取操作系统信息
 */
export const getOperatingSystemString = (): string => {
  const userAgent = navigator.userAgent;

  // 检测移动设备
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    // iOS设备
    const iosMatch = userAgent.match(/OS (\d+)_(\d+)/);
    if (iosMatch) {
      return `iOS ${iosMatch[1]}.${iosMatch[2]}`;
    }
    return 'iOS';
  }

  if (/Android/i.test(userAgent)) {
    // Android设备
    const androidMatch = userAgent.match(/Android (\d+\.?\d*)/);
    if (androidMatch) {
      return `Android ${androidMatch[1]}`;
    }
    return 'Android';
  }

  // 检测桌面操作系统
  if (/Windows NT/i.test(userAgent)) {
    const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    const versionMap: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
      '6.0': 'Windows Vista'
    };

    if (windowsMatch && versionMap[windowsMatch[1]]) {
      return versionMap[windowsMatch[1]];
    }
    return 'Windows';
  }

  if (/Mac OS X|macOS/i.test(userAgent)) {
    const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (macMatch) {
      const version = macMatch[1].replace('_', '.');
      return `macOS ${version}`;
    }
    return 'macOS';
  }

  if (/Linux/i.test(userAgent)) {
    return 'Linux';
  }

  if (/CrOS/i.test(userAgent)) {
    return 'Chrome OS';
  }

  // 其他情况
  return '未知操作系统';
};

/**
 * 获取用户位置信息
 */
export const getLocationString = (customLocation?: string): string => {
  if (customLocation && customLocation.trim()) {
    return customLocation.trim();
  }

  // 如果没有自定义位置，尝试从浏览器获取时区信息
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 简单的时区到地区映射
    const timeZoneToLocation: Record<string, string> = {
      'Asia/Shanghai': '中国',
      'Asia/Beijing': '中国北京',
      'Asia/Hong_Kong': '中国香港',
      'Asia/Taipei': '中国台湾',
      'Asia/Tokyo': '日本',
      'Asia/Seoul': '韩国',
      'America/New_York': '美国纽约',
      'America/Los_Angeles': '美国洛杉矶',
      'Europe/London': '英国伦敦',
      'Europe/Paris': '法国巴黎',
    };

    return timeZoneToLocation[timeZone] || timeZone;
  } catch (error) {
    console.warn('无法获取位置信息:', error);
    return '未知位置';
  }
};

/**
 * 在系统提示词中注入变量
 * @param systemPrompt 原始系统提示词
 * @param config 变量配置
 * @returns 处理后的系统提示词
 */
export const injectSystemPromptVariables = (
  systemPrompt: string,
  config: SystemPromptVariableConfig
): string => {
  if (!systemPrompt || !config) {
    return systemPrompt;
  }

  let processedPrompt = systemPrompt;

  // 注入时间变量 - 纯追加模式
  if (config.enableTimeVariable) {
    const currentTime = getCurrentTimeString();
    const timeVariable = `\n\n当前时间：${currentTime}`;
    processedPrompt += timeVariable;
  }

  // 注入位置变量 - 纯追加模式
  if (config.enableLocationVariable) {
    const location = getLocationString(config.customLocation);
    const locationVariable = `\n\n当前位置：${location}`;
    processedPrompt += locationVariable;
  }

  // 注入操作系统变量 - 纯追加模式
  if (config.enableOSVariable) {
    const operatingSystem = getOperatingSystemString();
    const osVariable = `\n\n操作系统：${operatingSystem}`;
    processedPrompt += osVariable;
  }

  return processedPrompt;
};

/**
 * 获取可用的变量列表（用于UI显示）
 */
export const getAvailableVariables = () => [
  {
    key: 'current_time',
    name: '当前时间',
    description: '在系统提示词末尾自动追加当前的日期和时间',
    example: getCurrentTimeString()
  },
  {
    key: 'location',
    name: '当前位置',
    description: '在系统提示词末尾自动追加用户设置的位置信息',
    example: '中国北京'
  },
  {
    key: 'operating_system',
    name: '操作系统',
    description: '在系统提示词末尾自动追加用户的操作系统信息',
    example: getOperatingSystemString()
  }
];
