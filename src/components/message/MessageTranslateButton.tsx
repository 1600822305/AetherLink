import React, { useState, useCallback, useRef, useEffect } from 'react';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { Languages } from 'lucide-react';
import { throttle } from 'lodash';
import { builtinLanguages, type TranslateLanguage } from '../../shared/services/translate/TranslateConfig';
import { translateText } from '../../shared/services/translate';
import { MessageBlockType, MessageBlockStatus } from '../../shared/types/newMessage';
import type { TranslationMessageBlock, Message } from '../../shared/types/newMessage';
import { v4 as uuidv4 } from 'uuid';
import { getMainTextContent } from '../../shared/utils/messageUtils';
import { toastManager } from '../EnhancedToast';
import { messageBlockRepository } from '../../shared/services/messages/MessageBlockRepository';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MessageTranslateButton');

interface MessageTranslateButtonProps {
  message: Message;
  buttonStyle?: React.CSSProperties | object;
  size?: number;
}

const MessageTranslateButton: React.FC<MessageTranslateButtonProps> = ({
  message,
  buttonStyle,
  size = 16
}) => {
  const [translateAnchorEl, setTranslateAnchorEl] = useState<null | HTMLElement>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleTranslateClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setTranslateAnchorEl(event.currentTarget);
  }, []);

  const handleTranslateClose = useCallback(() => {
    setTranslateAnchorEl(null);
  }, []);

  const handleTranslate = useCallback(async (language: TranslateLanguage) => {
    if (isTranslating) return;
    
    const content = getMainTextContent(message);
    if (!content || !content.trim()) {
      toastManager.warning('没有可翻译的内容');
      handleTranslateClose();
      return;
    }

    setIsTranslating(true);
    handleTranslateClose();

    // 创建翻译块
    const translationBlockId = uuidv4();
    const translationBlock: TranslationMessageBlock = {
      id: translationBlockId,
      messageId: message.id,
      type: MessageBlockType.TRANSLATION,
      content: '翻译中...',
      sourceContent: content,
      sourceLanguage: '原文',
      targetLanguage: language.label,
      status: MessageBlockStatus.STREAMING,
      createdAt: new Date().toISOString()
    };

    await messageBlockRepository.createBlockAndAttach(translationBlock);

    // 节流更新数据库，避免频繁写入
    const throttledDbUpdate = throttle(
      async (blockId: string, changes: Partial<TranslationMessageBlock>) => {
        await messageBlockRepository.updateBlock(blockId, changes);
      },
      200,
      { leading: true, trailing: true }
    );

    try {
      let finalResult = '';
      await translateText(
        content,
        language,
        (text, isComplete) => {
          if (mountedRef.current) {
            finalResult = text;
            const updatedBlock = {
              ...translationBlock,
              content: text,
              status: isComplete ? MessageBlockStatus.SUCCESS : MessageBlockStatus.STREAMING
            };
            throttledDbUpdate(translationBlockId, { content: text, status: updatedBlock.status });
          }
        }
      );
      
      // 最终更新为成功状态
      if (mountedRef.current) {
        throttledDbUpdate.flush();
        const finalBlock = {
          ...translationBlock,
          content: finalResult,
          status: MessageBlockStatus.SUCCESS
        };
        await messageBlockRepository.updateBlock(translationBlockId, {
          ...finalBlock,
          content: finalResult, 
          status: MessageBlockStatus.SUCCESS 
        });
      }
    } catch (error) {
      logger.error('翻译失败:', error);
      if (mountedRef.current) {
        const errorBlock = {
          ...translationBlock,
          content: '翻译失败: ' + (error instanceof Error ? error.message : '未知错误'),
          status: MessageBlockStatus.ERROR
        };
        await messageBlockRepository.updateBlock(translationBlockId, {
          ...errorBlock,
          content: errorBlock.content, 
          status: MessageBlockStatus.ERROR 
        });
      }
      toastManager.error('翻译失败');
    } finally {
      if (mountedRef.current) {
        setIsTranslating(false);
      }
    }
  }, [isTranslating, message, handleTranslateClose]);

  return (
    <>
      <Tooltip title="翻译">
        <IconButton
          size="small"
          onClick={handleTranslateClick}
          sx={{
            ...buttonStyle,
            opacity: isTranslating ? 1 : 0.8,
          }}
        >
          <Languages size={size} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={translateAnchorEl}
        open={Boolean(translateAnchorEl)}
        onClose={handleTranslateClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            maxHeight: 300,
            overflowY: 'auto'
          }
        }}
      >
        {builtinLanguages.map((lang) => (
          <MenuItem
            key={lang.langCode}
            onClick={() => handleTranslate(lang)}
            sx={{ fontSize: '0.9rem' }}
          >
            {lang.emoji} {lang.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default React.memo(MessageTranslateButton);
