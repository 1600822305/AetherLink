import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  List,
  ListItem,
  Divider,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent
} from '@mui/material';
import { Search, X, Clock } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { debounce } from 'lodash';
import dayjs from 'dayjs';
import { getMainTextContent } from '../../shared/utils/blockUtils';
import { selectMessagesForTopic } from '../../shared/store/selectors/messageSelectors';

interface SearchResult {
  id: string;
  topicId: string;
  topicName: string;
  messageContent: string;
  messageRole: 'user' | 'assistant';
  createdAt: string;
  highlightedContent?: string;
}

interface ChatSearchInterfaceProps {
  open: boolean;
  onClose: () => void;
  onTopicSelect?: (topicId: string) => void;
  onMessageSelect?: (topicId: string, messageId: string) => void;
}

const ChatSearchInterface: React.FC<ChatSearchInterfaceProps> = ({
  open,
  onClose,
  onTopicSelect,
  onMessageSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({
    count: 0,
    time: 0,
    limited: false,
    error: false
  });

  // 从Redux获取所有助手和话题数据
  const assistants = useSelector((state: RootState) => state.assistants.assistants);
  const allTopics = useMemo(() => {
    return assistants.flatMap(assistant => assistant.topics || []);
  }, [assistants]);

  // 获取Redux state用于消息查询 - 只选择需要的状态部分
  const messagesState = useSelector((state: RootState) => state.messages);

  // 解析搜索查询，支持引号、特殊字符等
  const parseSearchQuery = useCallback((query: string) => {
    const keywords: string[] = [];
    const phrases: string[] = [];

    // 匹配引号内的短语
    const phraseMatches = query.match(/"([^"]+)"/g);
    if (phraseMatches) {
      phraseMatches.forEach(match => {
        const phrase = match.slice(1, -1).trim(); // 移除引号
        if (phrase.length > 0) {
          phrases.push(phrase.toLowerCase());
        }
      });
    }

    // 移除引号短语后，处理剩余的关键词
    let remainingQuery = query.replace(/"[^"]*"/g, '');

    // 分割关键词，支持多种分隔符
    const wordMatches = remainingQuery.match(/\S+/g);
    if (wordMatches) {
      wordMatches.forEach(word => {
        const cleanWord = word.toLowerCase().trim();
        if (cleanWord.length > 0 && !phrases.includes(cleanWord)) {
          keywords.push(cleanWord);
        }
      });
    }

    return { keywords, phrases };
  }, []);

  // 高亮搜索关键词
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;

    const { keywords, phrases } = parseSearchQuery(query);
    let highlightedText = text;

    // 先高亮短语（优先级更高）
    phrases.forEach(phrase => {
      try {
        // 转义特殊字符
        const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedPhrase})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      } catch (error) {
        console.warn('短语高亮失败:', phrase, error);
      }
    });

    // 再高亮单个关键词
    keywords.forEach(keyword => {
      try {
        // 转义特殊字符
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      } catch (error) {
        console.warn('关键词高亮失败:', keyword, error);
      }
    });

    return highlightedText;
  }, [parseSearchQuery]);

  // 检查文本是否匹配搜索条件
  const isTextMatch = useCallback((text: string, keywords: string[], phrases: string[]) => {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    // 检查短语匹配（必须完全匹配）
    for (const phrase of phrases) {
      if (lowerText.includes(phrase)) {
        return true;
      }
    }

    // 检查关键词匹配（任意一个匹配即可）
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return true;
      }
    }

    return false;
  }, []);

  // 安全获取消息文本内容
  const getMessageText = useCallback((message: any): string => {
    try {
      // 首先尝试从消息的content字段获取
      if (message.content && typeof message.content === 'string') {
        return message.content.trim();
      }

      // 使用getMainTextContent从消息块中获取内容
      const textContent = getMainTextContent(message);
      return textContent ? textContent.trim() : '';
    } catch (error) {
      // 详细的错误处理
      if (error instanceof TypeError) {
        console.warn('消息对象结构异常:', message?.id, error.message);
      } else if (error instanceof ReferenceError) {
        console.warn('消息引用错误:', message?.id, error.message);
      } else {
        console.warn('获取消息内容时发生未知错误:', message?.id, error);
      }
      return '';
    }
  }, []);

  // 智能提取包含关键词的文本片段
  const extractRelevantSnippet = useCallback((text: string, keywords: string[], phrases: string[], maxLength: number = 150) => {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // 查找所有匹配位置
    const matches: { start: number; end: number; term: string }[] = [];

    // 查找短语匹配
    phrases.forEach(phrase => {
      const lowerText = text.toLowerCase();
      const lowerPhrase = phrase.toLowerCase();
      let index = 0;

      while ((index = lowerText.indexOf(lowerPhrase, index)) !== -1) {
        matches.push({
          start: index,
          end: index + phrase.length,
          term: phrase
        });
        index += phrase.length;
      }
    });

    // 查找关键词匹配
    keywords.forEach(keyword => {
      const lowerText = text.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      let index = 0;

      while ((index = lowerText.indexOf(lowerKeyword, index)) !== -1) {
        matches.push({
          start: index,
          end: index + keyword.length,
          term: keyword
        });
        index += keyword.length;
      }
    });

    if (matches.length === 0) {
      // 没有找到匹配，返回开头部分
      return text.substring(0, maxLength) + '...';
    }

    // 按位置排序
    matches.sort((a, b) => a.start - b.start);

    // 选择第一个匹配作为中心点
    const firstMatch = matches[0];
    const centerPos = Math.floor((firstMatch.start + firstMatch.end) / 2);

    // 计算片段的开始和结束位置
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, centerPos - halfLength);
    let end = Math.min(text.length, start + maxLength);

    // 如果结尾超出，调整开始位置
    if (end - start < maxLength && start > 0) {
      start = Math.max(0, end - maxLength);
    }

    // 尝试在单词边界处截断
    if (start > 0) {
      const spaceIndex = text.indexOf(' ', start);
      if (spaceIndex !== -1 && spaceIndex - start < 20) {
        start = spaceIndex + 1;
      }
    }

    if (end < text.length) {
      const spaceIndex = text.lastIndexOf(' ', end);
      if (spaceIndex !== -1 && end - spaceIndex < 20) {
        end = spaceIndex;
      }
    }

    let snippet = text.substring(start, end);

    // 添加省略号
    if (start > 0) {
      snippet = '...' + snippet;
    }
    if (end < text.length) {
      snippet = snippet + '...';
    }

    return snippet;
  }, []);

  // 搜索函数
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchStats({ count: 0, time: 0, limited: false, error: false });
      return;
    }

    setIsSearching(true);
    const startTime = performance.now();
    const results: SearchResult[] = [];
    const MAX_RESULTS = 100; // 限制最大结果数量
    const MAX_SNIPPET_LENGTH = 150; // 限制片段长度

    try {
      const { keywords, phrases } = parseSearchQuery(query);

      if (keywords.length === 0 && phrases.length === 0) {
        setSearchResults([]);
        setSearchStats({ count: 0, time: 0, limited: false, error: false });
        return;
      }

      // 搜索话题名称和消息内容
      for (const topic of allTopics) {
        // 如果已达到最大结果数，停止搜索
        if (results.length >= MAX_RESULTS) {
          console.info(`搜索结果已达到最大限制 ${MAX_RESULTS}，停止搜索`);
          break;
        }

        // 搜索话题名称
        const topicName = topic.name || '';
        if (topicName && isTextMatch(topicName, keywords, phrases)) {
          results.push({
            id: `topic-${topic.id}`,
            topicId: topic.id,
            topicName: topicName || '未命名话题',
            messageContent: '话题标题匹配',
            messageRole: 'user',
            createdAt: topic.createdAt || new Date().toISOString(),
            highlightedContent: highlightText(topicName, query)
          });
        }

        // 搜索消息内容 - 使用新的消息系统
        try {
          // 构造完整的state对象来调用selectMessagesForTopic
          const state = { messages: messagesState } as RootState;
          const topicMessages = selectMessagesForTopic(state, topic.id);
          if (topicMessages && Array.isArray(topicMessages) && topicMessages.length > 0) {
            for (const message of topicMessages) {
              // 如果已达到最大结果数，停止搜索
              if (results.length >= MAX_RESULTS) {
                break;
              }

              const messageText = getMessageText(message);

              if (messageText && isTextMatch(messageText, keywords, phrases)) {
                // 智能提取包含关键词的内容片段
                const snippet = extractRelevantSnippet(messageText, keywords, phrases, MAX_SNIPPET_LENGTH);

                results.push({
                  id: `message-${message.id}`,
                  topicId: topic.id,
                  topicName: topic.name || '未命名话题',
                  messageContent: snippet,
                  messageRole: message.role || 'user',
                  createdAt: message.createdAt || new Date().toISOString(),
                  highlightedContent: highlightText(snippet, query)
                });
              }
            }
          }
        } catch (error) {
          console.warn(`搜索话题 ${topic.id} 的消息时发生错误:`, error);
          // 继续搜索其他话题，不中断整个搜索过程
          continue;
        }
      }

      const endTime = performance.now();
      const searchTime = (endTime - startTime) / 1000;

      // 按时间排序，最新的在前
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setSearchResults(results);
      setSearchStats({
        count: results.length,
        time: searchTime,
        limited: results.length >= MAX_RESULTS,
        error: false
      });

      if (results.length >= MAX_RESULTS) {
        console.info(`搜索结果已限制为 ${MAX_RESULTS} 条，可能还有更多结果`);
      }
    } catch (error) {
      console.error('搜索过程中发生严重错误:', error);
      setSearchResults([]);
      setSearchStats({ count: 0, time: 0, limited: false, error: true });
    } finally {
      setIsSearching(false);
    }
  }, [allTopics, highlightText, parseSearchQuery, isTextMatch, getMessageText, extractRelevantSnippet, messagesState]);

  // 防抖搜索
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  // 监听搜索查询变化
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // 清空搜索
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchStats({ count: 0, time: 0, limited: false, error: false });
  }, []);

  // 处理搜索结果点击
  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.id.startsWith('topic-')) {
      onTopicSelect?.(result.topicId);
    } else if (result.id.startsWith('message-')) {
      const messageId = result.id.replace('message-', '');
      onMessageSelect?.(result.topicId, messageId);
    }
    onClose();
  }, [onTopicSelect, onMessageSelect, onClose]);

  // 按日期分组搜索结果
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: SearchResult[] } = {};
    
    searchResults.forEach(result => {
      const date = dayjs(result.createdAt).format('MM/DD');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(result);
    });
    
    return groups;
  }, [searchResults]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            maxHeight: '80vh',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            boxShadow: '0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12), 0 11px 15px -7px rgba(0,0,0,0.20)'
          }
        },
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '80vh' }}>
        {/* 搜索头部 */}
        <Box sx={{
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
              搜索话题和消息
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton onClick={onClose} size="small">
              <X size={20} />
            </IconButton>
          </Box>

          <TextField
            fullWidth
            placeholder="搜索话题和消息..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            variant="outlined"
            size="medium"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={20} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleClearSearch}>
                      <X size={18} />
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'background.default',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&.Mui-focused': {
                  bgcolor: 'background.paper'
                }
              }
            }}
          />

          {/* 搜索统计 */}
          {searchQuery && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              {isSearching ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    搜索中...
                  </Typography>
                </Box>
              ) : searchStats.error ? (
                <Typography variant="body2" color="error">
                  搜索时发生错误，请重试
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    找到 {searchStats.count} 个结果 ({searchStats.time.toFixed(3)}s)
                  </Typography>
                  {searchStats.limited && (
                    <Typography variant="caption" color="warning.main" sx={{
                      bgcolor: 'warning.light',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: '0.7rem'
                    }}>
                      结果已限制，可能还有更多
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* 搜索结果 */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              color: 'text.secondary'
            }}>
              <Search size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                没有找到匹配的结果
              </Typography>
              <Typography variant="body2">
                尝试使用不同的关键词
              </Typography>
            </Box>
          )}

          {Object.entries(groupedResults).map(([date, results]) => (
            <Box key={date} sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{
                mb: 2,
                color: 'text.secondary',
                fontSize: '1.1rem',
                fontWeight: 600
              }}>
                {date}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <List disablePadding>
                {results.map((result) => (
                  <ListItem
                    key={result.id}
                    component="div"
                    onClick={() => handleResultClick(result)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderColor: 'primary.main'
                      },
                      flexDirection: 'column',
                      alignItems: 'stretch'
                    }}
                  >
                    {/* 主要内容：话题名称和角色标签 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography
                        variant="subtitle1"
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      >
                        {result.topicName}
                      </Typography>
                      <Chip
                        label={result.messageRole === 'user' ? '用户' : '助手'}
                        size="small"
                        variant="outlined"
                        color={result.messageRole === 'user' ? 'primary' : 'secondary'}
                        sx={{ fontSize: '0.75rem', height: 22 }}
                      />
                    </Box>

                    {/* 次要内容：消息内容和时间 */}
                    <Box>
                      <Typography
                        component="div"
                        variant="body2"
                        sx={{
                          mb: 1,
                          '& mark': {
                            backgroundColor: 'warning.light',
                            color: 'warning.contrastText',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontWeight: 500
                          }
                        }}
                        dangerouslySetInnerHTML={{
                          __html: result.highlightedContent || result.messageContent
                        }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Clock size={14} />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {dayjs(result.createdAt).format('HH:mm')}
                        </Typography>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ChatSearchInterface;
