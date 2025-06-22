import React from 'react';
import { IconButton, Box, Tooltip } from '@mui/material';
import { Mic, MicOff } from 'lucide-react';

// CSS动画样式
const shakeAnimation = `
  @keyframes shake {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-10deg); }
    75% { transform: rotate(10deg); }
  }
`;

interface VoiceButtonProps {
  isVoiceMode: boolean;
  isDisabled?: boolean;
  onToggleVoiceMode: () => void;
  size?: 'small' | 'medium' | 'large';
  color?: 'default' | 'primary' | 'secondary' | 'error';
  tooltip?: string;
  className?: string;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({
  isVoiceMode,
  isDisabled = false,
  onToggleVoiceMode,
  size = 'medium',
  color = 'default',
  tooltip,
  className
}) => {

  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 28;
      default: return 24;
    }
  };

  const buttonContent = (
    <IconButton
      onClick={onToggleVoiceMode}
      disabled={isDisabled}
      className={className}
      color={isVoiceMode ? "error" : color}
      size={size}
      sx={{
        position: 'relative',
        transition: 'all 0.25s ease-in-out',
        backgroundColor: isVoiceMode ? 'rgba(211, 47, 47, 0.15)' : 'transparent',
        '&:hover': {
          transform: isDisabled ? 'none' : 'scale(1.08)',
          backgroundColor: isVoiceMode ? 'rgba(211, 47, 47, 0.25)' : 'rgba(0, 0, 0, 0.08)',
        },
        '&.Mui-disabled': {
          opacity: 0.5,
        },
        '&:active': {
          backgroundColor: isVoiceMode ? 'rgba(211, 47, 47, 0.3)' : 'rgba(0, 0, 0, 0.15)',
          transform: 'scale(0.95)',
        },
      }}
      aria-label={isVoiceMode ? "退出语音输入模式" : "切换到语音输入模式"}
    >
      {/* 波动效果背景 */}
      {isVoiceMode && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '85%',
            height: '85%',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': {
              '0%': { 
                transform: 'translate(-50%, -50%) scale(0.9)',
                opacity: 0.7,
              },
              '50%': { 
                transform: 'translate(-50%, -50%) scale(1.2)',
                opacity: 0.3,
              },
              '100%': { 
                transform: 'translate(-50%, -50%) scale(0.9)',
                opacity: 0.7,
              }
            },
          }}
        />
      )}
      
      {/* 添加动画样式 */}
      <style>{shakeAnimation}</style>

      {/* 麦克风图标 */}
      {isVoiceMode ? (
        <MicOff
          size={getIconSize()}
          color="#f44336"
          style={{
            transition: 'color 0.2s ease-in-out, transform 0.2s ease-in-out',
            animation: 'shake 1s ease-in-out',
          }}
        />
      ) : (
        <Mic
          size={getIconSize()}
          style={{
            transition: 'color 0.2s ease-in-out',
          }}
        />
      )}
    </IconButton>
  );

  // 提供更明确的提示文本
  const defaultTooltip = isVoiceMode ? "点击退出语音输入模式" : "点击启用语音输入";
  const displayTooltip = tooltip || defaultTooltip;

  return (
    <Tooltip title={displayTooltip} arrow placement="top">
      {buttonContent}
    </Tooltip>
  );
};

export default VoiceButton;
