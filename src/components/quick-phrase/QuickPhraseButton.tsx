import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  IconButton,
  Tooltip,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import BackButtonDrawer from '../common/BackButtonDrawer';
import { Plus, BotMessageSquare } from 'lucide-react';
import { CustomIcon } from '../icons';
import { useTheme } from '@mui/material/styles';
import QuickPhraseService from '../../shared/services/assistant/QuickPhraseService';
import type { QuickPhrase } from '../../shared/types';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import styled from '@emotion/styled';
import { alpha } from '@mui/material/styles';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('QuickPhraseButton');

interface QuickPhraseButtonProps {
  onInsertPhrase: (content: string) => void;
  assistant?: any;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// 样式组件定义
const QuickPanelBody = styled.div<{ theme?: any }>`
  padding: 5px 0;
  background-color: ${props => props.theme?.palette?.background?.paper};
`;

const QuickPanelList = styled.div<{ theme?: any }>`
  max-height: 300px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
    border-radius: 3px;
  }
`;

const QuickPanelItem = styled.div<{ theme?: any }>`
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 5px 1px 5px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'};
  }

  &.focused {
    background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'};
  }
`;

const QuickPanelItemLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const QuickPanelItemIcon = styled.span<{ theme?: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  flex-shrink: 0;
`;

const QuickPanelItemLabel = styled.span`
  font-size: 14px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
`;

const QuickPanelItemRight = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
  flex-shrink: 1;
  min-width: 0;
`;

const QuickPanelItemDescription = styled.span`
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const QuickPanelDivider = styled.div<{ theme?: any }>`
  height: 1px;
  background-color: ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
  margin: 4px 8px;
`;

const QuickPanelFooter = styled.div<{ theme?: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px 6px;
  border-top: 1px solid ${props => props.theme?.palette?.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
`;

const QuickPanelFooterTitle = styled.div<{ theme?: any }>`
  font-size: 12px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const QuickPanelFooterTips = styled.div<{ theme?: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: ${props => props.theme?.palette?.text?.secondary || '#666'};
`;

const QuickPhraseButton: React.FC<QuickPhraseButtonProps> = ({
  onInsertPhrase,
  assistant,
  disabled = false,
  size = 'medium'
}) => {
  const theme = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const [globalPhrases, setGlobalPhrases] = useState<QuickPhrase[]>([]);
  const [assistantPhrases, setAssistantPhrases] = useState<QuickPhrase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    location: 'global' as 'global' | 'assistant'
  });

  // 加载快捷短语
  const loadPhrases = useCallback(async () => {
    try {
      // 加载全局快捷短语
      const global = await QuickPhraseService.getAll();
      setGlobalPhrases(global);

      // 加载助手快捷短语
      if (assistant) {
        const assistantPhrases = QuickPhraseService.getAssistantPhrases(assistant);
        setAssistantPhrases(assistantPhrases);
      }
    } catch (error) {
      logger.error('加载快捷短语失败:', error);
    }
  }, [assistant]);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  // 打开面板
  const handleClick = () => {
    logger.debug('QuickPhrase button clicked, opening panel');
    setPanelOpen(true);
    setSelectedIndex(-1);
  };

  // 关闭面板
  const handleClose = () => {
    setPanelOpen(false);
    setSelectedIndex(-1);
  };

  // 选择快捷短语
  const handlePhraseSelect = (phrase: QuickPhrase) => {
    onInsertPhrase(phrase.content);
    handleClose();
  };

  // 打开添加对话框
  const handleOpenDialog = () => {
    setDialogOpen(true);
    setPanelOpen(false);
  };

  // 关闭添加对话框
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({ title: '', content: '', location: 'global' });
  };

  // 保存快捷短语
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    try {
      if (formData.location === 'global') {
        // 添加到全局快捷短语
        await QuickPhraseService.add({
          title: formData.title,
          content: formData.content
        });
      } else if (formData.location === 'assistant' && assistant) {
        // 添加到助手快捷短语
        await QuickPhraseService.addAssistantPhrase(
          assistant,
          {
            title: formData.title,
            content: formData.content
          },
          async (updatedAssistant) => {
            await dexieStorage.saveAssistant(updatedAssistant);
            // 发送事件通知其他组件更新
            window.dispatchEvent(new CustomEvent('assistantUpdated', {
              detail: { assistant: updatedAssistant }
            }));
          }
        );
      }

      handleCloseDialog();
      await loadPhrases();
    } catch (error) {
      logger.error('保存快捷短语失败:', error);
    }
  };

  // 合并所有短语用于显示
  const allPhrases = useMemo(() => {
    return [...assistantPhrases, ...globalPhrases];
  }, [assistantPhrases, globalPhrases]);

  const iconSize = size === 'large' ? 28 : size === 'small' ? 20 : 24;

  // 键盘导航
  useEffect(() => {
    if (!panelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allPhrases.length ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : allPhrases.length
        );
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        if (selectedIndex === allPhrases.length) {
          handleOpenDialog();
        } else {
          handlePhraseSelect(allPhrases[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [panelOpen, selectedIndex, allPhrases]);

  return (
    <>
      <Tooltip title="快捷短语">
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            size={size}
            style={{
              color: theme.palette.mode === 'dark' ? '#fff' : '#666',
              padding: size === 'large' ? '10px' : size === 'small' ? '6px' : '8px'
            }}
          >
            <CustomIcon name="quickPhrase" size={iconSize} color="currentColor" />
          </IconButton>
        </span>
      </Tooltip>

      {/* 快捷短语选择面板 - 使用 BackButtonDrawer 组件 */}
      <BackButtonDrawer
        anchor="bottom"
        open={panelOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '60vh',
            bgcolor: 'background.paper',
            pb: 'var(--safe-area-bottom-computed, 0px)'
          }
        }}
      >
        <Box sx={{ maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
          {/* 拖拽指示器 */}
          <Box sx={{ pt: 1, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.2),
                borderRadius: 999
              }}
            />
          </Box>

          <QuickPanelBody ref={panelRef} theme={theme}>
            <QuickPanelList theme={theme}>
              {allPhrases.length > 0 && (
                <>
                  {assistantPhrases.map((phrase, index) => (
                    <QuickPanelItem
                      key={phrase.id}
                      theme={theme}
                      className={selectedIndex === index ? 'focused' : ''}
                      onClick={() => handlePhraseSelect(phrase)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <QuickPanelItemLeft>
                        <QuickPanelItemIcon theme={theme}>
                          <BotMessageSquare size={18} />
                        </QuickPanelItemIcon>
                        <QuickPanelItemLabel>{phrase.title}</QuickPanelItemLabel>
                      </QuickPanelItemLeft>
                      <QuickPanelItemRight theme={theme}>
                        <QuickPanelItemDescription>
                          {phrase.content.length > 50
                            ? phrase.content.substring(0, 50) + '...'
                            : phrase.content}
                        </QuickPanelItemDescription>
                      </QuickPanelItemRight>
                    </QuickPanelItem>
                  ))}

                  {globalPhrases.map((phrase, index) => {
                    const itemIndex = assistantPhrases.length + index;
                    return (
                      <QuickPanelItem
                        key={phrase.id}
                        theme={theme}
                        className={selectedIndex === itemIndex ? 'focused' : ''}
                        onClick={() => handlePhraseSelect(phrase)}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                      >
                        <QuickPanelItemLeft>
                          <QuickPanelItemIcon theme={theme}>
                            <CustomIcon name="quickPhrase" size={18} color="currentColor" />
                          </QuickPanelItemIcon>
                          <QuickPanelItemLabel>{phrase.title}</QuickPanelItemLabel>
                        </QuickPanelItemLeft>
                        <QuickPanelItemRight theme={theme}>
                          <QuickPanelItemDescription>
                            {phrase.content.length > 50
                              ? phrase.content.substring(0, 50) + '...'
                              : phrase.content}
                          </QuickPanelItemDescription>
                        </QuickPanelItemRight>
                      </QuickPanelItem>
                    );
                  })}

                  <QuickPanelDivider theme={theme} />
                </>
              )}

              <QuickPanelItem
                theme={theme}
                className={selectedIndex === allPhrases.length ? 'focused' : ''}
                onClick={handleOpenDialog}
                onMouseEnter={() => setSelectedIndex(allPhrases.length)}
              >
                <QuickPanelItemLeft>
                  <QuickPanelItemIcon theme={theme}>
                    <Plus size={18} />
                  </QuickPanelItemIcon>
                  <QuickPanelItemLabel>添加快捷短语...</QuickPanelItemLabel>
                </QuickPanelItemLeft>
              </QuickPanelItem>
            </QuickPanelList>

            <QuickPanelFooter theme={theme}>
              <QuickPanelFooterTitle theme={theme}>快捷短语</QuickPanelFooterTitle>
              <QuickPanelFooterTips theme={theme}>
                <span>ESC 关闭</span>
                <span>▲▼ 选择</span>
                <span>↩︎ 确认</span>
              </QuickPanelFooterTips>
            </QuickPanelFooter>
          </QuickPanelBody>
        </Box>
      </BackButtonDrawer>

      {/* 添加快捷短语对话框 */}
      <BackButtonDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加快捷短语</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="标题"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              size="small"
            />
            
            <TextField
              label="内容"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              multiline
              rows={4}
              fullWidth
              size="small"
            />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">添加位置</FormLabel>
              <RadioGroup
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value as 'global' | 'assistant' })}
                row
              >
                <FormControlLabel
                  value="global"
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CustomIcon name="quickPhrase" size={16} color="currentColor" />
                      <Typography variant="body2">全局快捷短语</Typography>
                    </Box>
                  }
                />
                {assistant && (
                  <FormControlLabel
                    value="assistant"
                    control={<Radio size="small" />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BotMessageSquare size={16} />
                        <Typography variant="body2">助手提示词</Typography>
                      </Box>
                    }
                  />
                )}
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.title.trim() || !formData.content.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </>
  );
};

export default QuickPhraseButton;
