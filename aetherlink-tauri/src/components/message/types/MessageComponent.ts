import type { Message, MessageBlock } from '../../../shared/types/newMessage';
import type { Theme } from '@mui/material';

export interface MessageItemProps {
  message: Message;
  showAvatar?: boolean;
  isCompact?: boolean;
  messageIndex?: number;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (versionId: string) => void;
  onResend?: (messageId: string) => void;
  forceUpdate?: () => void;
}

export interface MessageSettings {
  messageActionMode?: 'bubbles' | 'toolbar';
  customBubbleColors?: {
    userBubbleColor?: string;
    aiBubbleColor?: string;
    userTextColor?: string;
    aiTextColor?: string;
  };
  userMessageMaxWidth?: number;
  messageBubbleMaxWidth?: number;
  messageBubbleMinWidth?: number;
  showMicroBubbles?: boolean;
}

export interface ThemeColors {
  userBubbleColor: string;
  aiBubbleColor: string;
  textPrimary: string;
  buttonSecondary: string;
}

export interface BaseMessageStyleProps {
  message: Message;
  showAvatar?: boolean;
  isCompact?: boolean;
  loading: boolean;
  assistantAvatar?: string | null;
  modelAvatar: string | null;
  userAvatar: string | null;
  showUserAvatar: boolean;
  showUserName: boolean;
  showModelAvatar: boolean;
  showModelName: boolean;
  showMessageDivider?: boolean;
  settings?: MessageSettings;
  themeColors?: ThemeColors;
  themeStyle?: string;
  theme: Theme;
  getProviderName: (providerId: string) => string;
  messageIndex?: number;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (versionId: string) => void;
  onResend?: (messageId: string) => void;
}

export interface MessageContentProps {
  message: Message;
  blocks: MessageBlock[];
  extraPaddingLeft?: number;
  extraPaddingRight?: number;
}

export interface UserInfoProps {
  userAvatar: string | null;
  showUserAvatar: boolean;
  showUserName: boolean;
  createdAt: string;
  themeColors: any;
}

export interface ModelInfoProps {
  modelAvatar: string | null;
  showModelAvatar: boolean;
  showModelName: boolean;
  model?: any;
  modelId?: string;
  createdAt: string;
  getProviderName: (providerId: string) => string;
}

