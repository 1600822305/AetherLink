import { invoke } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';

/**
 * Tauri服务桥接层
 * 用于替换Capacitor原生功能
 */
class TauriBridge {
  /**
   * 检测是否在Tauri环境中运行
   */
  get isAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * 拍照或从相册选择照片
   * @param source 图片来源（相机或相册）
   * @returns 照片信息
   */
  async takePicture(_source: 'CAMERA' | 'PHOTOS' = 'CAMERA') {
    try {
      if (!this.isAvailable) {
        throw new Error('Tauri not available');
      }

      const filePath = await open({
        multiple: false,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
        ]
      });

      if (filePath) {
        return {
          webPath: filePath as string,
          format: 'jpeg'
        };
      }
      throw new Error('No file selected');
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
  async showToast(messageText: string, _duration: 'short' | 'long' = 'short') {
    try {
      if (!this.isAvailable) {
        // 在非Tauri环境下使用浏览器通知
        console.log('Toast:', messageText);
        return;
      }

      await message(messageText, {
        title: 'AetherLink'
      });
    } catch (error) {
      console.error('Toast error:', error);
    }
  }

  /**
   * 获取设备信息
   * @returns 设备信息
   */
  async getDeviceInfo() {
    try {
      if (!this.isAvailable) {
        return {
          platform: 'web',
          model: 'Browser',
          operatingSystem: navigator.platform,
          osVersion: navigator.userAgent,
          manufacturer: 'Unknown',
          isVirtual: false,
          webViewVersion: 'N/A'
        };
      }

      // 在Tauri中可以通过Rust命令获取设备信息
      // 这里先返回基本信息，后续可以扩展
      return {
        platform: 'desktop',
        model: 'Desktop',
        operatingSystem: await invoke('get_os_type'),
        osVersion: await invoke('get_os_version'),
        manufacturer: 'Unknown',
        isVirtual: false,
        webViewVersion: 'Tauri'
      };
    } catch (error) {
      console.error('Device info error:', error);
      return {
        platform: 'unknown',
        model: 'Unknown',
        operatingSystem: 'Unknown',
        osVersion: 'Unknown',
        manufacturer: 'Unknown',
        isVirtual: false,
        webViewVersion: 'Unknown'
      };
    }
  }

  /**
   * 触发震动反馈
   * @param style 震动样式
   */
  async vibrate(style: 'HEAVY' | 'MEDIUM' | 'LIGHT' = 'MEDIUM') {
    try {
      if (!this.isAvailable) {
        // 在浏览器中使用Vibration API
        if ('vibrate' in navigator) {
          const duration = style === 'HEAVY' ? 200 : style === 'MEDIUM' ? 100 : 50;
          navigator.vibrate(duration);
        }
        return;
      }

      // 在Tauri中可以通过Rust命令实现震动
      // 桌面端通常不支持震动，这里只是占位
      console.log(`Vibrate: ${style}`);
    } catch (error) {
      console.error('Vibrate error:', error);
    }
  }

  /**
   * 退出应用
   */
  async exitApp() {
    try {
      if (!this.isAvailable) {
        window.close();
        return;
      }

      await invoke('exit_app');
    } catch (error) {
      console.error('Exit app error:', error);
    }
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      if (!this.isAvailable) {
        return {
          success: false,
          message: 'Tauri not available - running in browser mode'
        };
      }

      return {
        success: true,
        message: 'Tauri bridge connected successfully',
        platform: 'tauri'
      };
    } catch (error) {
      console.error('Test connection error:', error);
      return {
        success: false,
        message: (error as Error).message || 'Connection test failed'
      };
    }
  }

  /**
   * 获取WebView信息
   */
  async getWebViewInfo() {
    try {
      if (!this.isAvailable) {
        return {
          version: 'Browser',
          qualityLevel: '优秀',
          packageName: 'browser',
          isGoogleChrome: navigator.userAgent.includes('Chrome'),
          supportsModernFeatures: true,
          needsUpgrade: false,
          upgradeRecommendation: '浏览器环境，无需升级'
        };
      }

      return {
        version: 'Tauri WebView',
        qualityLevel: '优秀',
        packageName: 'tauri',
        isGoogleChrome: false,
        supportsModernFeatures: true,
        needsUpgrade: false,
        upgradeRecommendation: 'Tauri原生WebView，性能优秀'
      };
    } catch (error) {
      console.error('WebView info error:', error);
      throw error;
    }
  }
}

export const tauriBridge = new TauriBridge();
export default tauriBridge;
