import React from 'react';
import { Box, Divider, useTheme } from '@mui/material';

interface ConversationDividerProps {
  show?: boolean;
  style?: 'subtle' | 'normal' | 'prominent';
}

/**
 * 对话分割线组件
 * 用于在对话轮次之间显示分割线
 */
const ConversationDivider: React.FC<ConversationDividerProps> = ({
  show = true,
  style = 'subtle'
}) => {
  const theme = useTheme();

  if (!show) {
    return null;
  }

  // 根据样式设置不同的视觉效果
  const getStyleConfig = () => {
    switch (style) {
      case 'prominent':
        return {
          opacity: 0.6,
          marginY: 3,
          borderWidth: 1,
          borderStyle: 'solid',
        };
      case 'normal':
        return {
          opacity: 0.4,
          marginY: 2.5,
          borderWidth: 0.5,
          borderStyle: 'solid',
        };
      case 'subtle':
      default:
        return {
          opacity: 0.2,
          marginY: 2,
          borderWidth: 0.5,
          borderStyle: 'dashed',
        };
    }
  };

  const styleConfig = getStyleConfig();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        marginY: styleConfig.marginY,
        paddingX: 3,
      }}
    >
      <Divider
        sx={{
          width: '100%',
          opacity: styleConfig.opacity,
          borderColor: theme.palette.divider,
          borderWidth: styleConfig.borderWidth,
          borderStyle: styleConfig.borderStyle,
          '&::before, &::after': {
            borderColor: theme.palette.divider,
            borderWidth: styleConfig.borderWidth,
            borderStyle: styleConfig.borderStyle,
          }
        }}
      />
    </Box>
  );
};

export default ConversationDivider;
