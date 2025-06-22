import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { setThemeStyle } from '../../shared/store/settingsSlice';
import { themeConfigs, getThemePreviewColors } from '../../shared/config/themes';
import type { ThemeStyle } from '../../shared/config/themes';
import {
  CheckCircle as CheckCircleIcon,
  Palette as PaletteIcon,
  Sparkles as AutoAwesomeIcon,
  Minus as MinimizeIcon,
  Palette as ColorLensIcon,
  Leaf as LeafIcon,
  Waves as WavesIcon,
  Sunset as SunsetIcon,
  Square as SquareIcon,
  Zap as ZapIcon
} from 'lucide-react';

// 主题图标映射
const themeIcons: Record<ThemeStyle, React.ReactNode> = {
  default: <PaletteIcon />,
  claude: <AutoAwesomeIcon />,
  minimal: <MinimizeIcon />,
  vibrant: <ColorLensIcon />,
  nature: <LeafIcon />,
  ocean: <WavesIcon />,
  sunset: <SunsetIcon />,
  monochrome: <SquareIcon />,
  cyberpunk: <ZapIcon />,
};

interface ThemeStyleSelectorProps {
  compact?: boolean;
}

const ThemeStyleSelector: React.FC<ThemeStyleSelectorProps> = ({ compact = false }) => {
  const dispatch = useDispatch();
  const currentTheme = useTheme();
  const currentThemeStyle = useSelector((state: any) => state.settings.themeStyle) || 'default';

  const handleThemeStyleChange = (themeStyle: ThemeStyle) => {
    dispatch(setThemeStyle(themeStyle as 'default' | 'claude' | 'minimal' | 'vibrant' | 'nature' | 'ocean' | 'sunset' | 'monochrome' | 'cyberpunk'));
  };

  const ThemePreviewCard: React.FC<{ themeStyle: ThemeStyle }> = ({ themeStyle }) => {
    const config = themeConfigs[themeStyle];
    const previewColors = getThemePreviewColors(themeStyle);
    const isSelected = currentThemeStyle === themeStyle;

    return (
      <Card
        elevation={0}
        sx={{
          position: 'relative',
          border: '2px solid',
          borderColor: isSelected ? currentTheme.palette.primary.main : 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          transition: 'all 0.2s ease-in-out',
          aspectRatio: compact ? '1.2/1' : '1.1/1', // 设置宽高比
          minHeight: compact ? '120px' : '140px', // 设置最小高度
          maxWidth: '200px', // 限制最大宽度
          '&:hover': {
            borderColor: isSelected ? currentTheme.palette.primary.main : alpha(currentTheme.palette.primary.main, 0.5),
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
          },
        }}
      >
        <CardActionArea onClick={() => handleThemeStyleChange(themeStyle)}>
          <CardContent sx={{ p: compact ? 1.5 : 2 }}>
            {/* 选中状态指示器 */}
            {isSelected && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                }}
              >
                <CheckCircleIcon
                  size={20}
                  style={{
                    color: currentTheme.palette.primary.main,
                  }}
                />
              </Box>
            )}

            {/* 主题预览区域 */}
            <Box
              sx={{
                height: compact ? 60 : 80,
                borderRadius: 1,
                mb: 1.5,
                position: 'relative',
                overflow: 'hidden',
                background: config.gradients?.primary || previewColors.primary,
              }}
            >
              {/* 模拟界面元素 */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  right: 8,
                  height: 20,
                  bgcolor: previewColors.paper,
                  borderRadius: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: previewColors.primary,
                    mr: 0.5,
                  }}
                />
                <Box
                  sx={{
                    flex: 1,
                    height: 4,
                    bgcolor: alpha(previewColors.primary, 0.3),
                    borderRadius: 0.5,
                  }}
                />
              </Box>

              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  left: 8,
                  right: 8,
                  height: 16,
                  bgcolor: alpha(previewColors.paper, 0.9),
                  borderRadius: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  gap: 0.5,
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 8,
                    bgcolor: previewColors.secondary,
                    borderRadius: 0.5,
                  }}
                />
                <Box
                  sx={{
                    width: 20,
                    height: 8,
                    bgcolor: alpha(previewColors.primary, 0.5),
                    borderRadius: 0.5,
                  }}
                />
              </Box>
            </Box>

            {/* 主题信息 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  color: previewColors.primary,
                  mr: 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {themeIcons[themeStyle]}
              </Box>
              <Typography
                variant={compact ? 'body2' : 'subtitle2'}
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                }}
              >
                {config.name}
              </Typography>
            </Box>

            {!compact && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mb: 1,
                  lineHeight: 1.3,
                }}
              >
                {config.description}
              </Typography>
            )}

            {/* 颜色预览 */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: previewColors.primary,
                  border: '2px solid',
                  borderColor: 'background.paper',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: previewColors.secondary,
                  border: '2px solid',
                  borderColor: 'background.paper',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
              {config.colors.accent && (
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: config.colors.accent,
                    border: '2px solid',
                    borderColor: 'background.paper',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              )}
              {isSelected && (
                <Chip
                  label="当前"
                  size="small"
                  sx={{
                    ml: 'auto',
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: alpha(currentTheme.palette.primary.main, 0.1),
                    color: currentTheme.palette.primary.main,
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          mb: 2,
          color: 'text.primary',
        }}
      >
        主题风格
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
      >
        选择您喜欢的界面设计风格，每种风格都有独特的色彩搭配和视觉效果
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: compact ? 1 : 2,
          justifyContent: compact ? 'flex-start' : 'center',
          '& > *': {
            flex: compact ? '1 1 calc(50% - 8px)' : '0 0 auto',
            minWidth: compact ? '140px' : '160px',
            maxWidth: compact ? '180px' : '200px',
          }
        }}
      >
        {(Object.keys(themeConfigs) as ThemeStyle[]).map((themeStyle) => (
          <Box key={themeStyle}>
            <ThemePreviewCard themeStyle={themeStyle} />
          </Box>
        ))}
      </Box>

      {/* 主题特性说明 */}
      <Box sx={{ mt: 3, p: 2, bgcolor: alpha(currentTheme.palette.primary.main, 0.05), borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
          💡 <strong>提示：</strong>主题风格会影响整个应用的色彩搭配、按钮样式和视觉效果。
          您可以随时在设置中更改主题风格，更改会立即生效。
        </Typography>
      </Box>
    </Box>
  );
};

export default ThemeStyleSelector;
