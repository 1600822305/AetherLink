import React from 'react';
import { IconButton, CircularProgress, Badge, Tooltip } from '@mui/material';
import { Send, Plus, Square, Image, Search } from 'lucide-react';
import type { ImageContent, FileContent } from '../../../shared/types';

interface ChatInputButtonsProps {
  uploadingMedia: boolean;
  isLoading: boolean;
  allowConsecutiveMessages: boolean;
  isStreaming: boolean;
  imageGenerationMode: boolean;
  webSearchActive: boolean;
  images: ImageContent[];
  files: FileContent[];
  isDarkMode: boolean;
  isTablet: boolean;
  disabledColor: string;
  handleOpenUploadMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleSubmit: () => void;
  onStopResponse?: () => void;
  canSendMessage: () => boolean;
}

const ChatInputButtons: React.FC<ChatInputButtonsProps> = (props) => {
  const {
    uploadingMedia, isLoading, allowConsecutiveMessages, isStreaming, imageGenerationMode, webSearchActive,
    images, files, isDarkMode, isTablet, disabledColor,
    handleOpenUploadMenu, handleSubmit, onStopResponse, canSendMessage
  } = props;

  const showLoadingIndicator = isLoading && !allowConsecutiveMessages;

  return (
    <>
          {/* 添加按钮，打开上传菜单 */}
          <Tooltip title="添加图片或文件">
            <span>
              <IconButton
                size={isTablet ? "large" : "medium"}
                onClick={handleOpenUploadMenu}
                disabled={uploadingMedia || (isLoading && !allowConsecutiveMessages)}
                style={{
                  color: uploadingMedia ? disabledColor : (isDarkMode ? '#ffffff' : '#000000'),
                  padding: isTablet ? '10px' : '8px',
                  position: 'relative',
                  marginRight: isTablet ? '4px' : '0'
                }}
              >
                {uploadingMedia ? (
                  <CircularProgress size={isTablet ? 28 : 24} />
                ) : (
                  <Badge badgeContent={images.length + files.length} color="primary" max={9} invisible={images.length + files.length === 0}>
                    <Plus size={isTablet ? 28 : 24} />
                  </Badge>
                )}
              </IconButton>
            </span>
          </Tooltip>

          {/* 发送按钮或停止按钮 */}
          <Tooltip
            title={
              isStreaming ? "停止生成" :
              imageGenerationMode ? "生成图像" :
              webSearchActive ? "搜索网络" :
              "发送消息"
            }
          >
            <span>
              <IconButton
                onClick={isStreaming && onStopResponse ? onStopResponse : handleSubmit}
                disabled={!isStreaming && (!canSendMessage() || (isLoading && !allowConsecutiveMessages))}
                size={isTablet ? "large" : "medium"}
                style={{
                  color: isStreaming ? '#ff4d4f' : !canSendMessage() || (isLoading && !allowConsecutiveMessages) ? disabledColor : imageGenerationMode ? '#9C27B0' : webSearchActive ? '#3b82f6' : isDarkMode ? '#4CAF50' : '#09bb07',
                  padding: isTablet ? '10px' : '8px'
                }}
              >
                {isStreaming ? (
                  <Square size={isTablet ? 20 : 18} />
                ) : showLoadingIndicator ? (
                  <CircularProgress size={isTablet ? 28 : 24} color="inherit" />
                ) : imageGenerationMode ? (
                  <Image size={isTablet ? 20 : 18} />
                ) : webSearchActive ? (
                  <Search size={isTablet ? 20 : 18} />
                ) : (
                  <Send size={isTablet ? 20 : 18} />
                )}
              </IconButton>
            </span>
          </Tooltip>
    </>
  );
};

export default ChatInputButtons;
