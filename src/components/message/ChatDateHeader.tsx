/**
 * ChatDateHeader - 聊天消息列表的日期分组标题（展示型组件）
 *
 * 抽出供旧的 MessageGroup 与虚拟化路径 VirtualizedMessageContent 共用，
 * 统一日期格式与暗色背景，避免两处样式/格式各写一遍而漂移。
 * 传入 onToggleExpand 时显示可点击的折叠箭头（旧分组用），不传则为纯标题（虚拟化用）。
 */
import React from 'react';
import { Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ChevronDown as ExpandMoreIcon } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn');

const DateHeaderPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1, 2),
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
}));

/** 统一的日期标题格式，解析失败时回退原字符串 */
export function formatChatDate(date: string): string {
  try {
    return dayjs(date).format('YYYY年MM月DD日 dddd');
  } catch {
    return date;
  }
}

interface ChatDateHeaderProps {
  date: string;
  isDarkMode: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const ChatDateHeader: React.FC<ChatDateHeaderProps> = ({
  date,
  isDarkMode,
  expanded,
  onToggleExpand,
}) => (
  <DateHeaderPaper
    onClick={onToggleExpand}
    sx={{
      cursor: onToggleExpand ? 'pointer' : 'default',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    }}
  >
    <Typography variant="body2" color="text.primary">
      {formatChatDate(date)}
    </Typography>

    {onToggleExpand && (
      <ExpandMoreIcon
        size={20}
        style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease',
          color: '#757575',
        }}
      />
    )}
  </DateHeaderPaper>
);

export default ChatDateHeader;
