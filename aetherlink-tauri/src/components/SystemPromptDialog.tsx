import React, { useState, useEffect } from 'react';
import {
  Dialog,
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
  Divider
} from '@mui/material';
import { X as CloseIcon, User, MessageSquare } from 'lucide-react';
import type { ChatTopic, Assistant } from '../shared/types/Assistant';
import { TopicService } from '../shared/services/topics/TopicService';
import { updateTopic } from '../shared/store/slices/assistantsSlice';
import { useAppDispatch } from '../shared/store';
import { dexieStorage } from '../shared/services/storage/DexieStorageService';
import { useDialogBackHandler } from '../hooks/useDialogBackHandler';

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
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [tokensCount, setTokensCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('combined');

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

          console.log('[SystemPromptDialog] 保存助手系统提示词:', {
            assistantId: assistant.id,
            assistantName: assistant.name,
            systemPrompt: trimmedPrompt.substring(0, 50) + (trimmedPrompt.length > 50 ? '...' : '')
          });

          const updatedAssistant = {
            ...assistant,
            systemPrompt: trimmedPrompt
          };

          await dexieStorage.saveAssistant(updatedAssistant);
          console.log('[SystemPromptDialog] 已保存助手系统提示词到数据库');

          // 派发事件通知其他组件更新
          window.dispatchEvent(new CustomEvent('assistantUpdated', {
            detail: { assistant: updatedAssistant }
          }));
          console.log('[SystemPromptDialog] 已派发助手更新事件');
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
      console.error('[SystemPromptDialog] 保存系统提示词失败:', error);
      setError(error instanceof Error ? error.message : '保存系统提示词失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存到话题的辅助函数
  const handleSaveToTopic = async (promptContent: string) => {
    // 如果没有话题但有助手，先创建话题
    if (!topic && assistant) {
      console.log('[SystemPromptDialog] 没有当前话题，尝试创建新话题');
      const newTopic = await TopicService.createNewTopic();

      if (newTopic) {
        console.log('[SystemPromptDialog] 成功创建新话题:', newTopic.id);

        // 更新新话题的提示词
        (newTopic as any).prompt = promptContent;
        await TopicService.saveTopic(newTopic);
        console.log('[SystemPromptDialog] 已保存话题提示词');
        return;
      } else {
        throw new Error('创建话题失败');
      }
    }

    // 更新现有话题提示词
    if (topic) {
      console.log('[SystemPromptDialog] 更新现有话题的系统提示词');
      const updatedTopic = { ...topic, prompt: promptContent };

      // 保存到数据库
      await TopicService.saveTopic(updatedTopic);
      console.log('[SystemPromptDialog] 已保存话题提示词到数据库');

      // 强制刷新Redux状态
      if (assistant) {
        dispatch(updateTopic({
          assistantId: assistant.id,
          topic: updatedTopic
        }));
        console.log('[SystemPromptDialog] 已通过Redux更新话题状态');
      }

      // 调用保存回调，通知父组件更新
      if (onSave) {
        console.log('[SystemPromptDialog] 调用onSave回调，通知父组件更新');
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '12px',
          margin: '16px',
          minHeight: '600px',
          width: '90%',
          maxWidth: '800px',
        }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.palette.divider}`,
        pb: 1
      }}>
        系统提示词设置
        <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{
        pt: 2,
        pb: 0,
        minHeight: '500px',
        height: '70vh',
        display: 'flex',
        flexDirection: 'column'
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
            size="small"
            sx={{
              mb: 1,
              '& .MuiToggleButton-root': {
                fontSize: '12px',
                fontWeight: 600,
                px: 1.5,
                py: 0.5,
                minHeight: '32px',
                '&.Mui-selected': {
                  fontWeight: 700,
                }
              }
            }}
          >
            <ToggleButton value="combined">
              <MessageSquare size={14} style={{ marginRight: 3 }} />
              组合预览
            </ToggleButton>
            <ToggleButton value="assistant" disabled={!assistant}>
              <User size={14} style={{ marginRight: 3 }} />
              助手提示词
            </ToggleButton>
            <ToggleButton value="topic">
              <MessageSquare size={14} style={{ marginRight: 3 }} />
              话题提示词
            </ToggleButton>
          </ToggleButtonGroup>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: '11px',
              fontWeight: 500,
              color: theme.palette.text.secondary
            }}
          >
            当前编辑: {getSaveTarget()}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <TextField
          autoFocus
          multiline
          fullWidth
          variant="outlined"
          placeholder={editMode === 'combined' ? '组合预览（只读）' : '输入系统提示词...'}
          value={prompt}
          onChange={handlePromptChange}
          disabled={editMode === 'combined'}
          rows={16}
          sx={{
            mb: 0,
            flex: 1,
            '& .MuiInputBase-root': {
              fontSize: '14px',
              lineHeight: 1.5,
              height: '100%',
            },
            '& .MuiInputBase-inputMultiline': {
              height: '100% !important',
              overflow: 'auto !important',
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
        padding: '8px 24px 16px 24px',
        borderTop: `1px solid ${theme.palette.divider}`,
        mt: 0
      }}>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={saving || editMode === 'combined'}
        >
          {saving ? '保存中...' : `保存到${getSaveTarget()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SystemPromptDialog;