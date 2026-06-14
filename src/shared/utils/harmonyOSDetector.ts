/**
 * HarmonyOS 兼容性检测工具
 * 检测鸿蒙系统版本和功能支持
 */

import { isHarmonyOS, getPlatformInfo } from './platformDetection';
import { detectHarmonyOSFeatures, HARMONYOS_VERSIONS } from '../config/harmonyOSConfig';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('HarmonyOS');

/**
 * 鸿蒙兼容性检测结果
 */
export interface HarmonyOSCompatibility {
  isHarmonyOS: boolean;
  version?: string;
  isSupported: boolean;
  features: {
    webView: boolean;
    gestureNavigation: boolean;
    darkMode: boolean;
    splitScreen: boolean;
    foldable: boolean;
  };
  warnings: string[];
  recommendations: string[];
}

/**
 * 检测鸿蒙兼容性
 */
export function detectHarmonyOSCompatibility(): HarmonyOSCompatibility {
  const platformInfo = getPlatformInfo();
  const isHarmony = isHarmonyOS();
  
  const compatibility: HarmonyOSCompatibility = {
    isHarmonyOS: isHarmony,
    isSupported: false,
    features: {
      webView: false,
      gestureNavigation: false,
      darkMode: false,
      splitScreen: false,
      foldable: false,
    },
    warnings: [],
    recommendations: [],
  };

  if (!isHarmony) {
    return compatibility;
  }

  // 检测功能支持
  const features = detectHarmonyOSFeatures();
  compatibility.features = features;

  // 检测版本（如果可能）
  const version = detectHarmonyOSVersion();
  compatibility.version = version;

  // 判断是否支持
  if (version) {
    const versionNumber = parseFloat(version);
    const minVersion = parseFloat(HARMONYOS_VERSIONS.MIN_VERSION);
    compatibility.isSupported = versionNumber >= minVersion;

    if (!compatibility.isSupported) {
      compatibility.warnings.push(
        `当前鸿蒙版本 ${version} 低于最低要求版本 ${HARMONYOS_VERSIONS.MIN_VERSION}`
      );
      compatibility.recommendations.push(
        `建议升级到鸿蒙 ${HARMONYOS_VERSIONS.RECOMMENDED_VERSION} 或更高版本`
      );
    }
  } else {
    // 无法检测版本，假设支持
    compatibility.isSupported = true;
    compatibility.warnings.push('无法检测鸿蒙系统版本');
  }

  // 检查功能支持
  if (!features.webView) {
    compatibility.warnings.push('未检测到鸿蒙 WebView 支持');
    compatibility.recommendations.push('部分功能可能无法正常使用');
  }

  if (features.foldable) {
    compatibility.recommendations.push('检测到折叠屏设备，建议优化折叠屏体验');
  }

  // 添加一般性建议
  compatibility.recommendations.push(
    '请确保已授予应用必要的权限（剪贴板、文件、相机等）',
    '如遇到问题，请尝试在设置中手动授权',
    '建议定期更新到最新版本的鸿蒙系统'
  );

  return compatibility;
}

/**
 * 检测鸿蒙系统版本
 */
function detectHarmonyOSVersion(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const userAgent = navigator.userAgent;

  // 尝试从 UserAgent 中提取版本号
  // 示例: HarmonyOS/4.0.0 或 OpenHarmony/5.0
  const harmonyMatch = userAgent.match(/HarmonyOS[/\s](\d+\.?\d*)/i);
  if (harmonyMatch && harmonyMatch[1]) {
    return harmonyMatch[1];
  }

  const openHarmonyMatch = userAgent.match(/OpenHarmony[/\s](\d+\.?\d*)/i);
  if (openHarmonyMatch && openHarmonyMatch[1]) {
    return openHarmonyMatch[1];
  }

  // 尝试从鸿蒙 API 获取版本
  if (typeof window !== 'undefined') {
    // @ts-ignore
    const harmonyAPI = window.harmony || window.HarmonyOS;
    if (harmonyAPI && harmonyAPI.version) {
      return harmonyAPI.version;
    }
  }

  return undefined;
}

/**
 * 显示鸿蒙兼容性警告（如果需要）
 */
export function showHarmonyOSCompatibilityWarning(
  compatibility: HarmonyOSCompatibility
): void {
  if (!compatibility.isHarmonyOS) {
    return;
  }

  if (compatibility.warnings.length > 0) {
    logger.warn('兼容性警告:');
    compatibility.warnings.forEach(warning => {
      logger.warn(`  - ${warning}`);
    });
  }

  if (compatibility.recommendations.length > 0) {
    logger.info('建议:');
    compatibility.recommendations.forEach(rec => {
      logger.info(`  - ${rec}`);
    });
  }
}

/**
 * 生成兼容性报告
 */
export function generateCompatibilityReport(
  compatibility: HarmonyOSCompatibility
): string {
  const lines: string[] = [];
  
  lines.push('=== 鸿蒙系统兼容性报告 ===');
  lines.push('');
  lines.push(`运行在鸿蒙系统: ${compatibility.isHarmonyOS ? '是' : '否'}`);
  
  if (compatibility.isHarmonyOS) {
    lines.push(`系统版本: ${compatibility.version || '未知'}`);
    lines.push(`兼容性: ${compatibility.isSupported ? '✓ 支持' : '✗ 不支持'}`);
    lines.push('');
    lines.push('功能支持:');
    lines.push(`  - WebView: ${compatibility.features.webView ? '✓' : '✗'}`);
    lines.push(`  - 手势导航: ${compatibility.features.gestureNavigation ? '✓' : '✗'}`);
    lines.push(`  - 深色模式: ${compatibility.features.darkMode ? '✓' : '✗'}`);
    lines.push(`  - 分屏功能: ${compatibility.features.splitScreen ? '✓' : '✗'}`);
    lines.push(`  - 折叠屏: ${compatibility.features.foldable ? '✓' : '✗'}`);
    
    if (compatibility.warnings.length > 0) {
      lines.push('');
      lines.push('⚠️ 警告:');
      compatibility.warnings.forEach(warning => {
        lines.push(`  - ${warning}`);
      });
    }
    
    if (compatibility.recommendations.length > 0) {
      lines.push('');
      lines.push('💡 建议:');
      compatibility.recommendations.forEach(rec => {
        lines.push(`  - ${rec}`);
      });
    }
  }
  
  lines.push('');
  lines.push('=== 报告结束 ===');
  
  return lines.join('\n');
}

/**
 * 在应用启动时自动检测并显示兼容性信息
 */
export function initHarmonyOSCompatibilityCheck(): void {
  if (!isHarmonyOS()) {
    return;
  }

  const compatibility = detectHarmonyOSCompatibility();
  
  logger.debug('兼容性检测完成');
  logger.debug(generateCompatibilityReport(compatibility));
  
  showHarmonyOSCompatibilityWarning(compatibility);
}

