import { useState } from 'react';
import { isValidUrl } from '../utils';

interface UseUrlScraperProps {
  onDetectUrl?: (url: string) => Promise<string>;
}

export const useUrlScraper = ({ onDetectUrl }: UseUrlScraperProps) => {
  const [detectedUrl, setDetectedUrl] = useState<string>('');
  const [parsedContent, setParsedContent] = useState<string>('');
  const [urlScraperStatus, setUrlScraperStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [scraperError, setScraperError] = useState<string>('');

  // 处理URL抓取
  const handleUrlScraping = async (url: string) => {
    if (!onDetectUrl) return;

    try {
      setUrlScraperStatus('parsing');
      const content = await onDetectUrl(url);
      setParsedContent(content);
      setUrlScraperStatus('success');
    } catch (error) {
      console.error('URL抓取失败:', error);
      setUrlScraperStatus('error');
      setScraperError(error instanceof Error ? error.message : '网页解析失败');
    }
  };

  // 重置URL抓取状态
  const resetUrlScraper = () => {
    setDetectedUrl('');
    setParsedContent('');
    setUrlScraperStatus('idle');
    setScraperError('');
  };

  // 检测消息中的URL
  const detectUrlInMessage = (message: string) => {
    // 如果URL已经被检测到，不再重复检测
    if (detectedUrl || urlScraperStatus !== 'idle') return;

    // 如果消息包含URL并且我们有处理函数，尝试检测URL
    if (onDetectUrl) {
      // 使用正则表达式寻找可能的URL
      const urlMatch = message.match(/https?:\/\/\S+/);
      if (urlMatch && urlMatch[0]) {
        const potentialUrl = urlMatch[0];
        // 检验URL是否有效
        if (isValidUrl(potentialUrl)) {
          setDetectedUrl(potentialUrl);
          handleUrlScraping(potentialUrl);
        }
      }
    }
  };

  return {
    detectedUrl,
    parsedContent,
    urlScraperStatus,
    scraperError,
    handleUrlScraping,
    resetUrlScraper,
    detectUrlInMessage
  };
};
