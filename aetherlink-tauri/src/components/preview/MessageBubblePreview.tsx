import React from 'react';
import {
  Box,
  Typography,
  Paper,
  useTheme
} from '@mui/material';
import { getThemeColors } from '../../shared/utils/themeUtils';

interface MessageBubblePreviewProps {
  customBubbleColors: {
    userBubbleColor?: string;
    userTextColor?: string;
    aiBubbleColor?: string;
    aiTextColor?: string;
  };
  messageActionMode: 'bubbles' | 'toolbar';
  showMicroBubbles: boolean;
  // 新增宽度设置props
  messageBubbleMinWidth?: number;
  messageBubbleMaxWidth?: number;
  userMessageMaxWidth?: number;
  // 新增头像和名称显示props
  showUserAvatar?: boolean;
  showUserName?: boolean;
  showModelAvatar?: boolean;
  showModelName?: boolean;
}

const MessageBubblePreview: React.FC<MessageBubblePreviewProps> = ({
  customBubbleColors,
  messageActionMode,
  showMicroBubbles,
  messageBubbleMinWidth = 50,
  messageBubbleMaxWidth = 99,
  userMessageMaxWidth = 80,
  showUserAvatar = true,
  showUserName = true,
  showModelAvatar = true,
  showModelName = true
}) => {
  const theme = useTheme();
  const themeColors = getThemeColors(theme);

  // 计算实际使用的颜色
  const actualUserBubbleColor = customBubbleColors.userBubbleColor || themeColors.userBubbleColor;
  const actualUserTextColor = customBubbleColors.userTextColor || themeColors.textPrimary;
  const actualAiBubbleColor = customBubbleColors.aiBubbleColor || themeColors.aiBubbleColor;
  const actualAiTextColor = customBubbleColors.aiTextColor || themeColors.textPrimary;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        minHeight: '300px'
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        实时预览
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 用户消息预览 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{
            maxWidth: `${userMessageMaxWidth}%`,
            minWidth: `${messageBubbleMinWidth}%`,
            position: 'relative'
          }}>
            {/* 用户名称 */}
            {showUserName && (
              <Typography variant="caption" sx={{
                display: 'block',
                textAlign: 'right',
                mb: 0.5,
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}>
                用户
              </Typography>
            )}
            <Paper
              sx={{
                padding: 1.5,
                backgroundColor: actualUserBubbleColor,
                color: actualUserTextColor,
                borderRadius: '12px',
                border: 'none',
                boxShadow: 'none',
                position: 'relative'
              }}
            >
              <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                你好！有什么可以帮助你的吗？
              </Typography>

              {/* 工具栏模式预览 */}
              {messageActionMode === 'toolbar' && (
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  mt: 1,
                  pt: 1,
                  borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  opacity: 0.8
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {/* 模拟工具栏按钮 */}
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualUserTextColor,
                      opacity: 0.6
                    }} />
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualUserTextColor,
                      opacity: 0.6
                    }} />
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualUserTextColor,
                      opacity: 0.6
                    }} />
                  </Box>
                </Box>
              )}
            </Paper>

            {/* 气泡模式预览 */}
            {messageActionMode === 'bubbles' && (
              <>
                {/* 三点菜单 */}
                <Box sx={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 14,
                  height: 14,
                  borderRadius: '2px',
                  backgroundColor: actualUserTextColor,
                  opacity: 0.6
                }} />

                {/* 小功能气泡 */}
                {showMicroBubbles && (
                  <Box sx={{
                    position: 'absolute',
                    top: -18,
                    right: 0,
                    display: 'flex',
                    gap: '3px'
                  }}>
                    <Box sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '6px',
                      backgroundColor: themeColors.userBubbleColor,
                      opacity: 0.8
                    }} />
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* 用户头像 */}
          {showUserAvatar && (
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: showUserName ? 2.5 : 0
            }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.7rem' }}>
                U
              </Typography>
            </Box>
          )}
        </Box>

        {/* AI消息预览 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1 }}>
          {/* AI头像 */}
          {showModelAvatar && (
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: showModelName ? 2.5 : 0
            }}>
              <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.7rem' }}>
                AI
              </Typography>
            </Box>
          )}

          <Box sx={{
            maxWidth: `${messageBubbleMaxWidth}%`,
            minWidth: `${messageBubbleMinWidth}%`,
            position: 'relative'
          }}>
            {/* AI名称 */}
            {showModelName && (
              <Typography variant="caption" sx={{
                display: 'block',
                textAlign: 'left',
                mb: 0.5,
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}>
                AI助手
              </Typography>
            )}
            <Paper
              sx={{
                padding: 1.5,
                backgroundColor: actualAiBubbleColor,
                color: actualAiTextColor,
                borderRadius: '12px',
                border: 'none',
                boxShadow: 'none',
                position: 'relative'
              }}
            >
              <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                我是AI助手，很高兴为您服务！我可以帮助您解答问题、提供信息和协助完成各种任务。
              </Typography>

              {/* 工具栏模式预览 */}
              {messageActionMode === 'toolbar' && (
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  mt: 1,
                  pt: 1,
                  borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  opacity: 0.8
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {/* 模拟工具栏按钮 */}
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualAiTextColor,
                      opacity: 0.6
                    }} />
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualAiTextColor,
                      opacity: 0.6
                    }} />
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualAiTextColor,
                      opacity: 0.6
                    }} />
                    <Box sx={{ 
                      width: 16, 
                      height: 16, 
                      borderRadius: '2px',
                      backgroundColor: actualAiTextColor,
                      opacity: 0.6
                    }} />
                  </Box>
                </Box>
              )}
            </Paper>

            {/* 气泡模式预览 */}
            {messageActionMode === 'bubbles' && (
              <>
                {/* 三点菜单 */}
                <Box sx={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 14,
                  height: 14,
                  borderRadius: '2px',
                  backgroundColor: actualAiTextColor,
                  opacity: 0.6
                }} />

                {/* 小功能气泡 */}
                {showMicroBubbles && (
                  <Box sx={{
                    position: 'absolute',
                    top: -18,
                    right: 0,
                    display: 'flex',
                    gap: '3px'
                  }}>
                    <Box sx={{
                      width: 20,
                      height: 12,
                      borderRadius: '6px',
                      backgroundColor: themeColors.aiBubbleColor,
                      opacity: 0.8
                    }} />
                    <Box sx={{
                      width: 16,
                      height: 12,
                      borderRadius: '6px',
                      backgroundColor: themeColors.aiBubbleColor,
                      opacity: 0.8
                    }} />
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* 模式说明 */}
        <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            当前模式：{messageActionMode === 'bubbles' ? '功能气泡模式' : '底部工具栏模式'}
            {messageActionMode === 'bubbles' && !showMicroBubbles && ' (功能气泡已隐藏)'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default MessageBubblePreview;
