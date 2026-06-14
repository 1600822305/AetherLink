import { useState, useCallback, useMemo } from 'react';
import {
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Chip
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { LUCIDE_ICON_CATEGORIES, COMMON_EMOJIS } from './iconUtils';

interface AssistantIconPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  currentEmoji?: string;
}

/**
 * 多端适配的现代化助手图标选择器 - 支持Lucide Icons和Emoji
 */
export default function AssistantIconPicker({
  open,
  onClose,
  onSelectEmoji,
  currentEmoji
}: AssistantIconPickerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedIcon, setSelectedIcon] = useState<string>(currentEmoji || '');
  const [activeTab, setActiveTab] = useState(0);

  // 使用useCallback优化点击处理函数
  const handleIconSelect = useCallback((iconName: string) => {
    setSelectedIcon(iconName);
    onSelectEmoji(iconName);
    onClose();
  }, [onSelectEmoji, onClose]);

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  }, []);

  // 使用useMemo缓存响应式计算结果
  const gridColumns = useMemo(() => {
    if (isMobile) return 6;
    if (isTablet) return 8;
    return 10;
  }, [isMobile, isTablet]);

  const iconSize = useMemo(() => {
    if (isMobile) return 18;
    if (isTablet) return 20;
    return 22;
  }, [isMobile, isTablet]);

  const buttonSize = useMemo(() => {
    if (isMobile) return 36;
    if (isTablet) return 40;
    return 44;
  }, [isMobile, isTablet]);

  // 使用useCallback优化渲染函数
  const renderLucideIcon = useCallback((iconData: { icon: any, name: string }, isSelected: boolean) => {
    const IconComponent = iconData.icon;

    return (
      <IconButton
        key={iconData.name}
        onClick={() => handleIconSelect(iconData.name)}
        sx={{
          width: buttonSize,
          height: buttonSize,
          border: isSelected ? '2px solid' : '1px solid transparent',
          borderColor: isSelected ? 'primary.main' : 'transparent',
          borderRadius: isMobile ? '6px' : '8px',
          backgroundColor: isSelected ? 'primary.50' : 'transparent',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: 'primary.light',
            transform: 'scale(1.05)'
          },
          '&:active': {
            transform: 'scale(0.95)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        <IconComponent size={iconSize} />
      </IconButton>
    );
  }, [buttonSize, iconSize, isMobile, handleIconSelect]);

  // 使用useCallback优化emoji渲染函数
  const renderEmoji = useCallback((emoji: string, isSelected: boolean) => {
    return (
      <IconButton
        key={emoji}
        onClick={() => handleIconSelect(emoji)}
        sx={{
          width: buttonSize,
          height: buttonSize,
          fontSize: isMobile ? '1rem' : '1.2rem',
          border: isSelected ? '2px solid' : '1px solid transparent',
          borderColor: isSelected ? 'primary.main' : 'transparent',
          borderRadius: isMobile ? '6px' : '8px',
          backgroundColor: isSelected ? 'primary.50' : 'transparent',
          '&:hover': {
            backgroundColor: 'action.hover',
            borderColor: 'primary.light',
            transform: 'scale(1.05)'
          },
          '&:active': {
            transform: 'scale(0.95)'
          },
          transition: 'all 0.2s ease'
        }}
      >
        {emoji}
      </IconButton>
    );
  }, [buttonSize, isMobile, handleIconSelect]);

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      // 修复aria-hidden警告
      disableEnforceFocus
      disableAutoFocus
      disableRestoreFocus
      sx={{
        '& .MuiDialog-paper': {
          width: isMobile ? '95vw' : isTablet ? '80vw' : '600px',
          maxWidth: isMobile ? '95vw' : '600px',
          maxHeight: isMobile ? '90vh' : '80vh',
          borderRadius: isMobile ? '12px' : '16px'
        }
      }}
    >
      <DialogTitle sx={{
        pb: 1,
        textAlign: 'center',
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Box>
          <Typography variant={isMobile ? "h6" : "h5"} component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
            选择助手图标
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isMobile ? '选择图标或emoji' : '选择一个现代化图标或传统emoji'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* 标签页 */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{
            px: isMobile ? 1 : 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontSize: isMobile ? '0.875rem' : '1rem'
            }
          }}
        >
          <Tab label="现代图标" />
          <Tab label="传统Emoji" />
        </Tabs>

        {/* 内容区域 */}
        <Box sx={{
          p: isMobile ? 1 : 2,
          maxHeight: isMobile ? '60vh' : '50vh',
          overflow: 'auto'
        }}>
          {activeTab === 0 ? (
            // Lucide Icons 标签页
            <Box>
              {Object.entries(LUCIDE_ICON_CATEGORIES).map(([categoryName, icons]) => (
                <Box key={categoryName} sx={{ mb: isMobile ? 2 : 3 }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 1,
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'background.paper',
                    zIndex: 1,
                    py: 0.5
                  }}>
                    <Chip
                      label={
                        categoryName === 'people' ? '👤 人物' :
                        categoryName === 'tech' ? '💻 科技' :
                        categoryName === 'tools' ? '🔧 工具' :
                        categoryName === 'business' ? '💼 商务' :
                        categoryName === 'creative' ? '🎨 创意' :
                        categoryName === 'general' ? '⭐ 通用' : categoryName
                      }
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                        fontWeight: 600
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                      gap: isMobile ? 0.5 : 1
                    }}
                  >
                    {icons.map((iconData) =>
                      renderLucideIcon(iconData, selectedIcon === iconData.name)
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            // Emoji 标签页
            <Box>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 2,
                justifyContent: 'center'
              }}>
                <Chip
                  label="😊 经典表情"
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: isMobile ? '0.75rem' : '0.875rem',
                    fontWeight: 600
                  }}
                />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
                  gap: isMobile ? 0.5 : 1
                }}
              >
                {COMMON_EMOJIS.map((emoji) =>
                  renderEmoji(emoji, selectedIcon === emoji)
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
    </BackButtonDialog>
  );
}
