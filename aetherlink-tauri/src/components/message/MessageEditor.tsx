import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, useMediaQuery, useTheme } from '@mui/material';
import { useDispatch } from 'react-redux';
import { newMessagesActions } from '../../shared/store/slices/newMessagesSlice';
import type { Message } from '../../shared/types/newMessage.ts';
import { UserMessageStatus, AssistantMessageStatus } from '../../shared/types/newMessage.ts';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import { clearGetMainTextContentCache } from '../../shared/utils/messageUtils';
// 开发环境日志工具 - 只保留错误日志
const isDev = process.env.NODE_ENV === 'development';
const devError = isDev ? console.error : () => {};

interface MessageEditorProps {
  message: Message;
  topicId?: string;
  open: boolean;
  onClose: () => void;
}

const MessageEditor: React.FC<MessageEditorProps> = ({ message, topicId, open, onClose }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 🚀 简化：只在保存时需要查找主文本块，移除不必要的selector

  // 🔧 重写：基于信息块系统架构的内容获取逻辑
  const loadInitialContent = useCallback(async () => {
    // 方法1：检查消息是否有直接的 content 字段（编辑后的内容）
    if (typeof (message as any).content === 'string' && (message as any).content.trim()) {
      return (message as any).content.trim();
    }

    // 方法2：检查消息是否有 blocks 数组
    if (!message.blocks || message.blocks.length === 0) {
      return '';
    }

    // 方法3：从数据库批量加载所有消息块
    try {
      const messageBlocks = await dexieStorage.getMessageBlocksByMessageId(message.id);

      if (messageBlocks.length === 0) {
        // 如果批量获取失败，尝试逐个获取
        const individualBlocks = [];
        for (const blockId of message.blocks) {
          try {
            const block = await dexieStorage.getMessageBlock(blockId);
            if (block) {
              individualBlocks.push(block);
            }
          } catch (error) {
            devError('[MessageEditor] 获取块失败:', blockId, error);
          }
        }
        messageBlocks.push(...individualBlocks);
      }

      // 方法4：查找主文本块或未知类型块
      const textBlocks = messageBlocks.filter(block =>
        block.type === 'main_text' ||
        block.type === 'unknown'
      );

      for (const block of textBlocks) {
        const blockContent = (block as any).content;
        if (blockContent && typeof blockContent === 'string' && blockContent.trim()) {
          return blockContent.trim();
        }
      }

      // 方法5：如果没有找到主文本块，检查所有块是否有 content 字段
      for (const block of messageBlocks) {
        const blockContent = (block as any).content;
        if (blockContent && typeof blockContent === 'string' && blockContent.trim()) {
          return blockContent.trim();
        }
      }

      return '';

    } catch (error) {
      devError('[MessageEditor] 加载消息块时出错:', error);
      return '';
    }
  }, [message]);

  const [editedContent, setEditedContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const isUser = message.role === 'user';

  // 🚀 改进：异步加载内容的逻辑，添加清理函数防止内存泄漏
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后设置状态

    if (open && !isInitialized) {
      const initContent = async () => {
        try {
          const content = await loadInitialContent();

          // 只有在组件仍然挂载时才设置状态
          if (isMounted) {
            setEditedContent(content);
            setIsInitialized(true);
          }
        } catch (error) {
          devError('[MessageEditor] 初始化内容失败:', error);
          if (isMounted) {
            setEditedContent('');
            setIsInitialized(true); // 即使失败也标记为已初始化，避免无限重试
          }
        }
      };
      initContent();
    } else if (!open) {
      // Dialog关闭时重置状态
      setIsInitialized(false);
      setEditedContent('');
    }

    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [open, isInitialized, loadInitialContent]);

  // 🚀 性能优化：保存逻辑 - 减少数据库调用和日志输出
  const handleSave = useCallback(async () => {
    // 获取编辑后的文本内容
    const editedText = typeof editedContent === 'string'
      ? editedContent.trim()
      : '';

    if (!topicId || !editedText) {
      devError('[MessageEditor] 保存失败: 缺少topicId或内容为空');
      return;
    }

    try {
      // 🚀 简化：直接从数据库查找主文本块
      let mainTextBlockId: string | undefined;
      if (message.blocks && message.blocks.length > 0) {
        for (const blockId of message.blocks) {
          const block = await dexieStorage.getMessageBlock(blockId);
          if (block && (block.type === 'main_text' || block.type === 'unknown')) {
            mainTextBlockId = blockId;
            break;
          }
        }
      }

      if (!mainTextBlockId) {
        console.warn('[MessageEditor] 未找到主文本块，消息可能没有正确的块结构');
      }



      // � 性能优化：批量更新数据库和Redux状态
      const updatedAt = new Date().toISOString();

      // 🔧 修复：区分用户消息和AI消息的更新策略
      const messageUpdates = {
        status: isUser ? UserMessageStatus.SUCCESS : AssistantMessageStatus.SUCCESS,
        updatedAt,
        // 用户消息：设置content字段；AI消息：不设置content字段，让其从消息块获取
        ...(isUser && { content: editedText })
      };

      // 🚀 性能优化：使用事务批量更新数据库，减少I/O操作
      try {
        await dexieStorage.transaction('rw', [dexieStorage.messages, dexieStorage.message_blocks, dexieStorage.topics], async () => {
          // 更新消息块
          if (mainTextBlockId) {
            await dexieStorage.updateMessageBlock(mainTextBlockId, {
              content: editedText,
              updatedAt
            });
          }

          // 更新消息表
          await dexieStorage.updateMessage(message.id, messageUpdates);

          // 🔧 修复：确保同时更新topic.messages数组
          if (topicId) {
            const topic = await dexieStorage.topics.get(topicId);
            if (topic && topic.messages) {
              // 查找消息在数组中的位置
              const messageIndex = topic.messages.findIndex((m: any) => m.id === message.id);

              if (messageIndex >= 0) {
                // 更新topic.messages数组中的消息
                const updatedMessage = {
                  ...topic.messages[messageIndex],
                  ...messageUpdates
                };
                topic.messages[messageIndex] = updatedMessage;



                // 保存更新后的话题
                await dexieStorage.topics.put(topic);
              } else {
                console.warn('[MessageEditor] 在topic.messages中未找到消息:', message.id);
              }
            } else {
              console.warn('[MessageEditor] 话题不存在或没有messages数组:', topicId);
            }
          }
        });


      } catch (dbError) {
        devError('[MessageEditor] 数据库更新失败:', dbError);
        throw dbError; // 重新抛出错误以便后续处理
      }

      // 🚀 性能优化：批量更新Redux状态
      if (mainTextBlockId) {
        dispatch({
          type: 'messageBlocks/updateOneBlock',
          payload: {
            id: mainTextBlockId,
            changes: {
              content: editedText,
              updatedAt
            }
          }
        });
      }

      dispatch(newMessagesActions.updateMessage({
        id: message.id,
        changes: messageUpdates
      }));

      // 🔧 修复：清除getMainTextContent缓存，确保立即获取最新内容
      try {
        clearGetMainTextContentCache();
      } catch (error) {
        console.warn('[MessageEditor] 清除缓存失败:', error);
      }

      // 🔧 修复AI消息特殊问题：对于AI消息，不设置message.content字段
      // 让getMainTextContent函数从消息块获取最新内容，而不是从缓存的content字段
      if (!isUser) {
        // AI消息：移除content字段，强制从消息块获取内容
        dispatch(newMessagesActions.updateMessage({
          id: message.id,
          changes: {
            ...(message as any).content && { content: undefined }, // 清除content字段（如果存在）
            updatedAt: new Date().toISOString()
          }
        }));

      }

      // 🔧 修复：强制触发组件重新渲染
      // 通过更新消息的updatedAt字段来触发依赖该字段的组件重新渲染
      setTimeout(() => {
        dispatch(newMessagesActions.updateMessage({
          id: message.id,
          changes: {
            updatedAt: new Date().toISOString()
          }
        }));

        // 🔧 额外修复：强制更新消息块的updatedAt，确保MainTextBlock重新渲染
        if (mainTextBlockId) {
          dispatch({
            type: 'messageBlocks/updateOneBlock',
            payload: {
              id: mainTextBlockId,
              changes: {
                updatedAt: new Date().toISOString()
              }
            }
          });
        }


      }, 100);



      // � 性能优化：直接关闭Dialog，移除不必要的延迟和事件
      // Redux状态更新是同步的，不需要额外的延迟或全局事件
      onClose();

    } catch (error) {
      devError('[MessageEditor] 保存失败:', error);
      alert('保存失败，请重试');
    }
  }, [editedContent, topicId, message, dispatch, isUser, onClose]);

  // 🚀 性能优化：关闭处理 - 使用useCallback
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 🚀 性能优化：内容变更处理 - 使用useCallback
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedContent(e.target.value);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={isMobile ? "xs" : "sm"} // 移动端使用更小的宽度
      // 移动端优化：确保Dialog正确显示
      slotProps={{
        paper: {
          sx: {
            margin: isMobile ? 1 : 3,
            maxHeight: isMobile ? '90vh' : '80vh',
            // 移动端确保内容可见
            ...(isMobile && {
              position: 'fixed',
              top: '5%',
              left: '5%',
              right: '5%',
              bottom: 'auto',
              transform: 'none'
            })
          }
        }
      }}
      // 移动端禁用backdrop点击关闭，避免意外关闭
      disableEscapeKeyDown={isMobile}
    >
      <DialogTitle sx={{
        pb: 1,
        fontWeight: 500,
        fontSize: isMobile ? '1.1rem' : '1.25rem' // 移动端字体调整
      }}>
        编辑{isUser ? '消息' : '回复'}
      </DialogTitle>
      <DialogContent sx={{
        pt: 2,
        pb: isMobile ? 1 : 2 // 移动端减少底部间距
      }}>
        <TextField
          multiline
          fullWidth
          minRows={isMobile ? 3 : 4} // 移动端减少最小行数
          maxRows={isMobile ? 8 : 10} // 移动端调整最大行数
          value={editedContent}
          onChange={handleContentChange}
          variant="outlined"
          placeholder={isInitialized ? "请输入内容..." : "正在加载内容..."}
          disabled={!isInitialized} // 未初始化时禁用输入
          autoFocus={isInitialized && !isMobile} // 移动端不自动聚焦，避免键盘弹出问题
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: isMobile ? '16px' : '14px', // 移动端使用16px避免缩放
              lineHeight: 1.5
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{
        px: 3,
        pb: 2,
        gap: 1 // 按钮间距
      }}>
        <Button
          onClick={handleClose}
          color="inherit"
          size={isMobile ? "medium" : "small"}
          sx={{ minWidth: isMobile ? 80 : 'auto' }}
        >
          取消
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!isInitialized || !editedContent || !editedContent.trim()}
          size={isMobile ? "medium" : "small"}
          sx={{
            mr: 1,
            minWidth: isMobile ? 80 : 'auto'
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MessageEditor;