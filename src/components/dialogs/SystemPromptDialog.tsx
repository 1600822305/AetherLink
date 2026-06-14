import React, { useState, useEffect } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Typography,
  Box,
  Alert,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  useMediaQuery
} from '@mui/material';
import BackButtonDialog from '../common/BackButtonDialog';
import { X as CloseIcon, User, MessageSquare } from 'lucide-react';
import type { ChatTopic, Assistant } from '../../shared/types/Assistant';
import { TopicService } from '../../shared/services/topics/TopicService';
import { updateTopic } from '../../shared/store/slices/assistantsSlice';
import AgentPromptSelector from '../AgentPromptSelector';
import { useAppDispatch } from '../../shared/store';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { useDialogBackHandler } from '../../hooks/useDialogBackHandler';
import { useKeyboard } from '../../shared/hooks/useKeyboard';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('SystemPromptDialog');

interface SystemPromptDialogProps {
  open: boolean;
  onClose: () => void;
  topic: ChatTopic | null;
  assistant: Assistant | null;
  onSave?: (updatedTopic: ChatTopic) => void;
}

type EditMode = 'assistant' | 'topic' | 'combined';

/**
 * 系统提示词编辑对话框
 * 修复版本：分离编辑模式，避免提示词重复问题
 */
const SystemPromptDialog: React.FC<SystemPromptDialogProps> = ({
  open,
  onClose,
  topic,
  assistant,
  onSave
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 键盘适配 - 在移动端锁定键盘，避免其他组件响应
  useKeyboard({ lock: isMobile && open });
  
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [tokensCount, setTokensCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('combined');
  const [showPresetSelector, setShowPresetSelector] = useState(false);

  const DIALOG_ID = 'system-prompt-dialog';

  // 使用对话框返回键处理Hook
  const { handleClose } = useDialogBackHandler(DIALOG_ID, open, onClose);

  // 智能估算token数量
  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    const words = text.match(/\b\w+\b/g)?.length || 0;
    const cjkChars = (text.match(/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    return Math.ceil(words * 1.3 + cjkChars * 2);
  };



  // 获取保存目标描述
  const getSaveTarget = (): string => {
    switch (editMode) {
      case 'assistant':
        return '助手提示词';
      case 'topic':
        return '话题提示词';
      case 'combined':
      default:
        // 智能判断保存目标
        if (assistant?.systemPrompt && topic?.prompt) {
          return '组合提示词（需选择具体编辑目标）';
        } else if (assistant?.systemPrompt) {
          return '助手提示词';
        } else if (topic?.prompt) {
          return '话题提示词';
        } else {
          return '新提示词';
        }
    }
  };

  // 当对话框打开时，初始化提示词和编辑模式
  useEffect(() => {
    if (open) {
      // 智能确定初始编辑模式
      let initialMode: EditMode = 'combined';

      // 如果只有助手提示词，默认编辑助手
      if (assistant?.systemPrompt && !topic?.prompt) {
        initialMode = 'assistant';
      }
      // 如果只有话题提示词，默认编辑话题
      else if (!assistant?.systemPrompt && topic?.prompt) {
        initialMode = 'topic';
      }
      // 如果都有或都没有，使用组合模式
      else {
        initialMode = 'combined';
      }

      setEditMode(initialMode);

      // 根据模式设置对应的提示词内容
      let displayPrompt = '';
      switch (initialMode) {
        case 'assistant':
          displayPrompt = assistant?.systemPrompt || '';
          break;
        case 'topic':
          displayPrompt = topic?.prompt || '';
          break;
        case 'combined':
        default:
          // 组合模式：显示完整的生效提示词（只读预览）
          if (assistant?.systemPrompt) {
            displayPrompt = assistant.systemPrompt;
            // 只有当话题提示词不为空时才追加
            if (topic?.prompt && topic.prompt.trim()) {
              displayPrompt += '\n\n[追加] ' + topic.prompt;
            }
          } else if (topic?.prompt && topic.prompt.trim()) {
            displayPrompt = topic.prompt;
          } else {
            displayPrompt = '点击此处编辑系统提示词';
          }
          break;
      }

      setPrompt(displayPrompt);
      setTokensCount(estimateTokens(displayPrompt));
      setError(null);
    }
  }, [open, topic, assistant]);

  // 修复后的保存逻辑：根据编辑模式智能保存
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const trimmedPrompt = prompt.trim();

      // 根据编辑模式决定保存逻辑
      switch (editMode) {
        case 'assistant':
          // 保存到助手
          if (!assistant) {
            throw new Error('没有找到助手信息');
          }

          logger.info('[SystemPromptDialog] 保存助手系统提示词:', {
            assistantId: assistant.id,
            assistantName: assistant.name,
            systemPrompt: trimmedPrompt.substring(0, 50) + (trimmedPrompt.length > 50 ? '...' : '')
          });

          const updatedAssistant = {
            ...assistant,
            systemPrompt: trimmedPrompt
          };

          await dexieStorage.saveAssistant(updatedAssistant);
          logger.info('[SystemPromptDialog] 已保存助手系统提示词到数据库');

          // 派发事件通知其他组件更新
          window.dispatchEvent(new CustomEvent('assistantUpdated', {
            detail: { assistant: updatedAssistant }
          }));
          logger.info('[SystemPromptDialog] 已派发助手更新事件');
          break;

        case 'topic':
          // 保存到话题
          await handleSaveToTopic(trimmedPrompt);
          break;

        case 'combined':
        default:
          // 组合模式：智能判断保存目标
          if (assistant?.systemPrompt && !topic?.prompt) {
            // 只有助手提示词，保存到助手
            const updatedAssistant = { ...assistant, systemPrompt: trimmedPrompt };
            await dexieStorage.saveAssistant(updatedAssistant);
            window.dispatchEvent(new CustomEvent('assistantUpdated', {
              detail: { assistant: updatedAssistant }
            }));
          } else {
            // 其他情况保存到话题
            await handleSaveToTopic(trimmedPrompt);
          }
          break;
      }

      // 使用handleClose来清理对话框状态并关闭
      handleClose();
    } catch (error) {
      logger.error('[SystemPromptDialog] 保存系统提示词失败:', error);
      setError(error instanceof Error ? error.message : '保存系统提示词失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存到话题的辅助函数
  const handleSaveToTopic = async (promptContent: string) => {
    // 如果没有话题但有助手，先创建话题
    if (!topic && assistant) {
      logger.info('[SystemPromptDialog] 没有当前话题，尝试创建新话题');
      const newTopic = await TopicService.createNewTopic();

      if (newTopic) {
        logger.info('[SystemPromptDialog] 成功创建新话题:', newTopic.id);

        // 更新新话题的提示词
        (newTopic as any).prompt = promptContent;
        await TopicService.saveTopic(newTopic);
        logger.info('[SystemPromptDialog] 已保存话题提示词');
        return;
      } else {
        throw new Error('创建话题失败');
      }
    }

    // 更新现有话题提示词
    if (topic) {
      logger.info('[SystemPromptDialog] 更新现有话题的系统提示词');
      const updatedTopic = { ...topic, prompt: promptContent };

      // 保存到数据库
      await TopicService.saveTopic(updatedTopic);
      logger.info('[SystemPromptDialog] 已保存话题提示词到数据库');

      // 强制刷新Redux状态
      if (assistant) {
        dispatch(updateTopic({
          assistantId: assistant.id,
          topic: updatedTopic
        }));
        logger.info('[SystemPromptDialog] 已通过Redux更新话题状态');
      }

      // 调用保存回调，通知父组件更新
      if (onSave) {
        logger.info('[SystemPromptDialog] 调用onSave回调，通知父组件更新');
        onSave(updatedTopic);
      }
    }
  };

  // 当提示词变化时，更新token计数
  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setPrompt(text);
    setTokensCount(estimateTokens(text));
  };

  // 处理编辑模式切换
  const handleEditModeChange = (newMode: EditMode) => {
    setEditMode(newMode);

    // 根据新模式获取对应的提示词内容
    let newPrompt = '';
    switch (newMode) {
      case 'assistant':
        newPrompt = assistant?.systemPrompt || '';
        break;
      case 'topic':
        newPrompt = topic?.prompt || '';
        break;
      case 'combined':
      default:
        // 组合模式：显示完整的生效提示词（只读预览）
        if (assistant?.systemPrompt) {
          newPrompt = assistant.systemPrompt;
          // 只有当话题提示词不为空时才追加
          if (topic?.prompt && topic.prompt.trim()) {
            newPrompt += '\n\n[追加] ' + topic.prompt;
          }
        } else if (topic?.prompt && topic.prompt.trim()) {
          newPrompt = topic.prompt;
        } else {
          newPrompt = '点击此处编辑系统提示词';
        }
        break;
    }

    setPrompt(newPrompt);
    setTokensCount(estimateTokens(newPrompt));
  };

  // 处理预设提示词选择
  const handlePresetSelect = (selectedPrompt: string) => {
    setPrompt(selectedPrompt);
    setTokensCount(estimateTokens(selectedPrompt));
    setShowPresetSelector(false);
  };

  return (
  <BackButtonDialog
    open={open}
    onClose={handleClose}
    maxWidth={isMobile ? false : "md"}
    fullWidth
    fullScreen={isMobile}
    PaperProps={{
      sx: {
        bgcolor: 'background.paper',
        backdropFilter: 'blur(10px)',
        border: '1px solid',
        borderColor: 'divider',
        // 移动端全屏适配
        ...(isMobile && {
          margin: 0,
          maxHeight: '100vh',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column'
        })
      }
    }}
  >
    <DialogTitle sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `1px solid ${theme.palette.divider}`,
      pb: 1,
      // 移动端适配顶部安全区域
      ...(isMobile && {
        minHeight: '64px'
      })
    }}>
      <Typography component="span" variant={isMobile ? "h6" : "subtitle1"}>
        系统提示词设置
      </Typography>
      <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
        <CloseIcon />
      </IconButton>
    </DialogTitle>

    <DialogContent sx={{
      pt: 2,
      pb: 0,
      minHeight: isMobile ? 'auto' : '500px',
      height: isMobile ? 'calc(100dvh - 140px)' : '70vh',
      display: 'flex',
      flexDirection: 'column',
      // 移动端内容区域适配
      ...(isMobile && {
        px: 2,
        // 使用 100dvh 而不是 100vh，避免键盘弹出时高度变化
        height: 'calc(100dvh - 140px)',
        // 移除动态高度调整，保持布局稳定
        overflow: 'auto'
      })
    }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!topic && !saving && (
        <Alert severity="info" sx={{ mb: 2 }}>
          保存将创建新话题并应用此系统提示词
        </Alert>
      )}

      {/* 编辑模式选择器 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          编辑模式
        </Typography>
        <ToggleButtonGroup
          value={editMode}
          exclusive
          onChange={(_, newMode) => newMode && handleEditModeChange(newMode)}
          size={isMobile ? "medium" : "small"}
          sx={{
            mb: 1,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            '& .MuiToggleButton-root': {
              fontSize: isMobile ? '14px' : '12px',
              fontWeight: 600,
              px: isMobile ? 2 : 1.5,
              py: isMobile ? 1 : 0.5,
              minHeight: isMobile ? '40px' : '32px',
              '&.Mui-selected': {
                fontWeight: 700,
              }
            }
          }}
        >
          <ToggleButton value="combined">
            <MessageSquare size={isMobile ? 16 : 14} style={{ marginRight: 4 }} />
            组合预览
          </ToggleButton>
          <ToggleButton value="assistant" disabled={!assistant}>
            <User size={isMobile ? 16 : 14} style={{ marginRight: 4 }} />
            助手提示词
          </ToggleButton>
          <ToggleButton value="topic">
            <MessageSquare size={isMobile ? 16 : 14} style={{ marginRight: 4 }} />
            话题提示词
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: isMobile ? '12px' : '11px',
            fontWeight: 500,
            color: theme.palette.text.secondary
          }}
        >
          当前编辑: {getSaveTarget()}
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowPresetSelector(true)}
          disabled={editMode === 'combined'}
        >
          选择预设提示词
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <TextField
        autoFocus={!isMobile}
        multiline
        fullWidth
        variant="outlined"
        placeholder={editMode === 'combined' ? '组合预览（只读）' : '输入系统提示词...'}
        value={prompt}
        onChange={handlePromptChange}
        disabled={editMode === 'combined'}
        rows={isMobile ? 10 : 12}
        sx={{
          mb: 0,
          flex: 1,
          '& .MuiInputBase-root': {
            fontSize: isMobile ? '16px' : '14px', // 移动端使用16px防止缩放
            lineHeight: 1.5,
            height: '100%',
          },
          '& .MuiInputBase-inputMultiline': {
            height: '100% !important',
            overflow: 'auto !important',
            // 移动端防止缩放
            fontSize: isMobile ? '16px' : '14px',
          }
        }}
      />

        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: theme.palette.text.secondary,
          fontSize: '0.75rem',
          mt: 0.5,
          mb: 0
        }}>
          <Typography variant="caption">
            {editMode === 'combined' ? '预览模式：显示最终生效的提示词' : '编辑模式：修改后点击保存'}
          </Typography>
          <Typography variant="caption">
            估计Token数量: {tokensCount}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{
        padding: isMobile ? '16px 24px' : '8px 24px 16px 24px',
        borderTop: `1px solid ${theme.palette.divider}`,
        mt: 0,
        // 移动端按钮区域适配
        ...(isMobile && {
          minHeight: '72px'
        })
      }}>
        <Button 
          onClick={onClose} 
          color="inherit"
          size={isMobile ? "large" : "medium"}
          sx={{ 
            fontSize: isMobile ? '16px' : '14px',
            px: isMobile ? 3 : 2
          }}
        >
          取消
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={saving || editMode === 'combined'}
          size={isMobile ? "large" : "medium"}
          sx={{ 
            fontSize: isMobile ? '16px' : '14px',
            px: isMobile ? 3 : 2
          }}
        >
          {saving ? '保存中...' : `保存到${getSaveTarget()}`}
        </Button>
      </DialogActions>

      {/* 预设提示词选择器 */}
      {showPresetSelector && (
        <AgentPromptSelector
          open={showPresetSelector}
          onClose={() => setShowPresetSelector(false)}
          onSelect={handlePresetSelect}
          currentPrompt={prompt}
        />
      )}
    </BackButtonDialog>
  );
};

export default SystemPromptDialog;