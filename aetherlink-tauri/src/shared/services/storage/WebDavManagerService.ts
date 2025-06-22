import type { WebDavConfig, WebDavConnectionResult, WebDavUploadResult, WebDavDownloadResult, WebDavBackupFile } from '../../types';
import { corsService } from '../network/CORSBypassService';
import { Capacitor } from '@capacitor/core';

/**
 * 基于 webdav-manager.js 的 WebDAV 服务
 * 使用成熟的 WebDAV 客户端库，专为浏览器设计
 */
export class WebDavManagerService {
  private config: WebDavConfig;
  private authHeader: string;

  constructor(config: WebDavConfig) {
    this.config = config;
    this.authHeader = `Basic ${btoa(`${config.webdavUser}:${config.webdavPass}`)}`;
  }

  /**
   * 构建正确的 WebDAV URL
   */
  private buildUrl(path: string = ''): string {
    // 移动端直接使用原始 URL
    const host = this.config.webdavHost.replace(/\/$/, '');
    const basePath = this.config.webdavPath.replace(/^\/+|\/+$/g, '');

    if (!basePath) {
      return path ? `${host}/${path}` : host;
    }

    return path ? `${host}/${basePath}/${path}` : `${host}/${basePath}`;
  }

  /**
   * 发送 HTTP 请求 - 使用项目统一的 CORS 绕过服务
   */
  private async makeRequest(options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    data?: string | Blob;
  }) {
    try {
      // 在移动端使用 CORS 绕过服务
      if (Capacitor.isNativePlatform()) {
        const headers = {
          'Authorization': this.authHeader,
          ...options.headers
        };

        const response = await corsService.request({
          url: options.url,
          method: options.method as any,
          headers,
          data: options.data,
          timeout: 30000,
          responseType: 'text'
        });

        return {
          success: response.success,
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          error: response.success ? undefined : `${response.status} ${response.statusText}`
        };
      } else {
        // Web 端直接使用 fetch 和代理
        return await this.fallbackFetch(options);
      }
    } catch (error: any) {
      if (!Capacitor.isNativePlatform()) {
        console.warn('CORS 服务失败，回退到 fetch:', error);
        return await this.fallbackFetch(options);
      }
      throw error;
    }
  }

  /**
   * 回退到标准 fetch（仅 Web 端）
   */
  private async fallbackFetch(options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    data?: string | Blob;
  }) {
    // 在 Web 端将原始 URL 转换为代理 URL
    let proxyUrl = options.url;
    if (options.url.startsWith('http')) {
      // 如果是完整 URL，转换为代理路径
      const originalUrl = new URL(options.url);
      // 将 https://dav.jianguoyun.com/dav/AetherLink/ 转换为 /api/webdav/AetherLink/
      // 代理会将 /api/webdav/AetherLink/ 重写为 /dav/AetherLink/
      const pathWithoutDav = originalUrl.pathname.replace(/^\/dav/, '');
      proxyUrl = `/api/webdav${pathWithoutDav}`;
    }

    // 仅在开发环境显示详细日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🌐 [WebDAV Manager] 原始 URL:', options.url);
      console.log('🌐 [WebDAV Manager] 代理 URL:', proxyUrl);
    }

    const headers = {
      'Authorization': this.authHeader,
      ...options.headers
    };

    const response = await fetch(proxyUrl, {
      method: options.method,
      headers,
      body: options.data
    });

    const responseText = await response.text();

    // 仅在开发环境或出错时显示响应日志
    if (process.env.NODE_ENV === 'development' || !response.ok) {
      console.log('🌐 [WebDAV Manager] 代理响应:', {
        status: response.status,
        statusText: response.statusText,
        dataLength: responseText.length
      });
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseText,
      error: response.ok ? undefined : `${response.status} ${response.statusText}`
    };
  }

  /**
   * 检查 WebDAV 连接
   */
  async checkConnection(): Promise<WebDavConnectionResult> {
    try {
      const url = this.config.webdavHost;

      const response = await this.makeRequest({
        url,
        method: 'PROPFIND',
        headers: {
          'Content-Type': 'application/xml',
          'Depth': '0'
        }
      });

      if (response.success && (response.status === 200 || response.status === 207)) {
        return { success: true };
      } else {
        return {
          success: false,
          error: `连接失败: ${response.status} ${response.statusText || response.error}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `连接错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 上传文件到 WebDAV
   */
  async uploadFile(fileName: string, data: string | Blob): Promise<WebDavUploadResult> {
    try {
      // 确保目录存在
      await this.ensureDirectory();

      const url = this.buildUrl(fileName);
      
      const response = await this.makeRequest({
        url,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        data: data
      });

      if (response.success && (response.status === 200 || response.status === 201 || response.status === 204)) {
        return { success: true, fileName };
      } else {
        return { 
          success: false, 
          error: `上传失败: ${response.status} ${response.statusText || response.error}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `上传错误: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 从 WebDAV 下载文件
   */
  async downloadFile(fileName: string): Promise<WebDavDownloadResult> {
    try {
      const url = this.buildUrl(fileName);
      
      const response = await this.makeRequest({
        url,
        method: 'GET'
      });

      if (response.success && response.status === 200) {
        return { success: true, data: response.data };
      } else {
        return { 
          success: false, 
          error: `下载失败: ${response.status} ${response.statusText || response.error}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `下载错误: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 列出 WebDAV 目录中的备份文件
   */
  async listBackupFiles(): Promise<WebDavBackupFile[]> {
    try {
      const url = this.buildUrl() + '/';
      
      const response = await this.makeRequest({
        url,
        method: 'PROPFIND',
        headers: {
          'Content-Type': 'application/xml',
          'Depth': '1'
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
          <D:propfind xmlns:D="DAV:">
            <D:prop>
              <D:displayname/>
              <D:getlastmodified/>
              <D:getcontentlength/>
              <D:resourcetype/>
            </D:prop>
          </D:propfind>`
      });

      if (!response.success || (response.status !== 200 && response.status !== 207)) {
        throw new Error(`列表请求失败: ${response.status} ${response.statusText || response.error}`);
      }

      return this.parseWebDavResponse(response.data);
    } catch (error) {
      console.error('列出备份文件失败:', error);
      return [];
    }
  }

  /**
   * 删除 WebDAV 文件
   */
  async deleteFile(fileName: string): Promise<WebDavConnectionResult> {
    try {
      const url = this.buildUrl(fileName);
      
      const response = await this.makeRequest({
        url,
        method: 'DELETE'
      });

      if (response.success && (response.status === 200 || response.status === 204)) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `删除失败: ${response.status} ${response.statusText || response.error}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `删除错误: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(): Promise<void> {
    try {
      const url = this.buildUrl() + '/';
      
      const response = await this.makeRequest({
        url,
        method: 'MKCOL'
      });

      // 201 表示创建成功，405 表示目录已存在
      if (!response.success && response.status !== 405) {
        console.warn('创建目录失败，但继续执行:', response.status, response.statusText || response.error);
      }
    } catch (error) {
      console.warn('创建目录时出错，但继续执行:', error);
    }
  }

  /**
   * 解析 WebDAV PROPFIND 响应 - 使用 webdav-manager.js 的解析逻辑
   */
  private parseWebDavResponse(xmlText: string): WebDavBackupFile[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // 检查解析错误
      const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        console.error('🚫 [WebDAV Manager] XML 解析错误:', parseError.textContent);
        return [];
      }

      const responses = xmlDoc.querySelectorAll('response');
      
      const files: WebDavBackupFile[] = [];
      const baseUrl = this.buildUrl();

      responses.forEach((node) => {
        const href = node.querySelector('href')?.textContent || '';
        const itemUri = this.normalizeURL(href);
        
        // 跳过根目录本身
        if (itemUri === baseUrl + '/' || itemUri === baseUrl) {
          return;
        }

        const props = node.querySelector('propstat status')?.textContent?.includes('200') 
          ? node.querySelector('propstat') 
          : null;

        if (!props) {
          return;
        }

        const displayName = props.querySelector('displayname')?.textContent || '';
        const lastModified = props.querySelector('getlastmodified')?.textContent || '';
        const contentLength = props.querySelector('getcontentlength')?.textContent || '0';
        const resourceType = props.querySelector('resourcetype');
        
        const isDirectory = resourceType?.querySelector('collection') !== null;

        // 只包含 .json 备份文件
        if (isDirectory || !displayName.endsWith('.json')) {
          return;
        }

        const file = {
          fileName: displayName,
          modifiedTime: lastModified,
          size: parseInt(contentLength, 10),
          path: href
        };

        files.push(file);
      });

      // 按修改时间降序排序
      return files.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
    } catch (error) {
      console.error('🚫 [WebDAV Manager] 解析 WebDAV 响应失败:', error);
      return [];
    }
  }

  /**
   * 标准化 URL
   */
  private normalizeURL(url: string): string {
    if (!url.match(/^https?:\/\//)) {
      const baseUrl = this.config.webdavHost.replace(/^(https?:\/\/[^\/]+\/).*$/, '$1');
      url = baseUrl + url.replace(/^\/+/, '');
    }
    return url;
  }
}
