import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Toast } from '@capacitor/toast';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor, registerPlugin } from '@capacitor/core';

// 定义ModernWebView插件接口
export interface ModernWebViewPlugin {
  echo(options: { value: string }): Promise<{ value: string; plugin: string; version: string }>;

  getWebViewInfo(): Promise<{
    version: number;
    versionName: string;
    packageName: string;
    userAgent: string;
    isGoogleChrome: boolean;
    isUpdatable: boolean;
    supportsModernFeatures: boolean;
    qualityLevel: string;
    needsUpgrade: boolean;
    strategy: string;
    strategyDescription: string;
    upgradeRecommendation: string;
  }>;

  checkUpgradeNeeded(): Promise<{
    needsUpgrade: boolean;
    currentVersion: number;
    minRecommendedVersion: number;
    isUpdatable: boolean;
    upgradeRecommendation: string;
  }>;
}

// 注册插件
const ModernWebView = registerPlugin<ModernWebViewPlugin>('ModernWebView');

/**
 * Capacitor服务桥接层
 * 用于给Vue组件提供Capacitor原生功能
 */
class CapacitorBridge {
  /**
   * 拍照或从相册选择照片
   * @param source 图片来源（相机或相册）
   * @returns 照片信息
   */
  async takePicture(source: 'CAMERA' | 'PHOTOS' = 'CAMERA') {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: source === 'CAMERA' ? CameraSource.Camera : CameraSource.Photos,
      });
      return {
        webPath: image.webPath,
        format: image.format
      };
    } catch (error) {
      console.error('Camera error:', error);
      throw error;
    }
  }

  /**
   * 显示Toast消息
   * @param message 要显示的消息
   * @param duration 持续时间('short'或'long')
   */
  async showToast(message: string, duration: 'short' | 'long' = 'short') {
    await Toast.show({
      text: message,
      duration: duration
    });
  }

  /**
   * 获取设备信息
   */
  async getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      const battery = await Device.getBatteryInfo();

      return {
        model: info.model,
        platform: info.platform,
        operatingSystem: info.operatingSystem,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        batteryLevel: battery.batteryLevel,
        isCharging: battery.isCharging
      };
    } catch (error) {
      console.error('Device info error:', error);
      throw error;
    }
  }

  /**
   * 触发震动反馈
   * @param style 震动样式
   */
  async vibrate(style: 'HEAVY' | 'MEDIUM' | 'LIGHT' = 'MEDIUM') {
    let impactStyle: ImpactStyle;

    switch(style) {
      case 'HEAVY':
        impactStyle = ImpactStyle.Heavy;
        break;
      case 'LIGHT':
        impactStyle = ImpactStyle.Light;
        break;
      case 'MEDIUM':
      default:
        impactStyle = ImpactStyle.Medium;
        break;
    }

    await Haptics.impact({ style: impactStyle });
  }

  /**
   * 退出应用
   */
  async exitApp() {
    await App.exitApp();
  }

  /**
   * 测试ModernWebView插件连接
   */
  async testModernWebViewPlugin() {
    try {
      console.log('🔍 测试ModernWebView插件连接...');
      const result = await ModernWebView.echo({ value: 'Hello from frontend!' });
      console.log('✅ 插件连接成功:', result);
      return result;
    } catch (error) {
      console.error('❌ 插件连接失败:', error);
      throw error;
    }
  }

  /**
   * 获取WebView版本信息
   */
  async getWebViewInfo() {
    try {
      if (Capacitor.isNativePlatform()) {
        // 调用原生插件获取WebView信息
        console.log('🔍 开始调用原生WebView检测插件...');

        const result = await ModernWebView.getWebViewInfo();
        console.log('✅ WebView信息获取成功:', result);
        return result;
      } else {
        // Web平台返回浏览器信息
        console.log('🌐 Web平台，返回浏览器信息');
        return {
          version: 'Web Platform',
          versionName: navigator.userAgent,
          packageName: 'browser',
          userAgent: navigator.userAgent,
          isGoogleChrome: navigator.userAgent.includes('Chrome'),
          isUpdatable: false,
          supportsModernFeatures: true,
          qualityLevel: '优秀',
          needsUpgrade: false,
          strategy: 'WEB_BROWSER',
          strategyDescription: '使用浏览器原生WebView',
          upgradeRecommendation: '您正在使用浏览器版本，无需升级。'
        };
      }
    } catch (error) {
      console.error('❌ WebView info error:', error);
      throw error;
    }
  }

  /**
   * 检查WebView是否需要升级
   */
  async checkWebViewUpgrade() {
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('🔍 开始检查WebView升级需求...');
        const result = await ModernWebView.checkUpgradeNeeded();
        console.log('✅ WebView升级检查完成:', result);
        return result;
      } else {
        return {
          needsUpgrade: false,
          currentVersion: 'Web Platform',
          minRecommendedVersion: 0,
          isUpdatable: false,
          upgradeRecommendation: '您正在使用浏览器版本，无需升级。'
        };
      }
    } catch (error) {
      console.error('❌ WebView upgrade check error:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const capacitorBridge = new CapacitorBridge();