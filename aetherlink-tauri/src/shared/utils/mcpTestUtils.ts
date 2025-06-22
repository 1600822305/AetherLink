/**
 * MCP 连接测试工具
 * 用于测试移动端 MCP HTTP 连接是否正常工作
 */

import { universalFetch } from './universalFetch';
import { Capacitor } from '@capacitor/core';

/**
 * 测试 MCP HTTP 连接
 */
export async function testMCPConnection(url: string): Promise<{
  success: boolean;
  message: string;
  platform: string;
  method: string;
}> {
  const platform = Capacitor.isNativePlatform() ? 'mobile' : 'web';

  try {
    console.log(`[MCP Test] 测试连接: ${url} (平台: ${platform})`);

    // 创建一个简单的 JSON-RPC 请求
    const testMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'AetherLink-Test',
          version: '1.0.0'
        }
      }
    };

    const response = await universalFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage),
      timeout: 10000 // 10秒超时
    });

    if (response.ok) {
      const data = await response.text();
      console.log(`[MCP Test] 连接成功:`, data);

      return {
        success: true,
        message: `连接成功 (状态: ${response.status})`,
        platform,
        method: platform === 'mobile' ? 'Capacitor HTTP' : 'Standard Fetch'
      };
    } else {
      return {
        success: false,
        message: `HTTP 错误: ${response.status} ${response.statusText}`,
        platform,
        method: platform === 'mobile' ? 'Capacitor HTTP' : 'Standard Fetch'
      };
    }
  } catch (error) {
    console.error(`[MCP Test] 连接失败:`, error);

    return {
      success: false,
      message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      platform,
      method: platform === 'mobile' ? 'Capacitor HTTP' : 'Standard Fetch'
    };
  }
}

/**
 * 测试多个 MCP 服务器连接
 */
export async function testMultipleMCPConnections(urls: string[]): Promise<Array<{
  url: string;
  result: Awaited<ReturnType<typeof testMCPConnection>>;
}>> {
  console.log(`[MCP Test] 测试 ${urls.length} 个 MCP 服务器连接`);

  const results = await Promise.allSettled(
    urls.map(async (url) => ({
      url,
      result: await testMCPConnection(url)
    }))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        url: urls[index],
        result: {
          success: false,
          message: `测试失败: ${result.reason}`,
          platform: Capacitor.isNativePlatform() ? 'mobile' : 'web',
          method: 'unknown'
        }
      };
    }
  });
}



/**
 * 生成测试报告
 */
export async function generateMCPTestReport(mcpUrls: string[] = []): Promise<string> {
  const platform = Capacitor.isNativePlatform() ? 'Mobile' : 'Web';
  const timestamp = new Date().toISOString();

  let report = `# MCP 连接测试报告\n\n`;
  report += `**平台**: ${platform}\n`;
  report += `**时间**: ${timestamp}\n`;
  report += `**Capacitor 版本**: ${Capacitor.getPlatform()}\n\n`;



  // MCP 服务器连接测试
  if (mcpUrls.length > 0) {
    report += `## MCP 服务器连接测试\n\n`;
    const mcpResults = await testMultipleMCPConnections(mcpUrls);

    mcpResults.forEach((result, index) => {
      report += `### 服务器 ${index + 1}: ${result.url}\n\n`;
      report += `**结果**: ${result.result.success ? '✅ 成功' : '❌ 失败'}\n`;
      report += `**消息**: ${result.result.message}\n`;
      report += `**方法**: ${result.result.method}\n\n`;
    });
  }

  report += `## 总结\n\n`;
  report += `此测试验证了 MCP 服务器连接功能。\n`;

  return report;
}
