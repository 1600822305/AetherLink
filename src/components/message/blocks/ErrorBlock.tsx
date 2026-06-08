/**
 * 错误块组件 - 完全重构版
 * 完全参考另一个项目，支持点击查看详细错误信息
 */
import React, { useState, useCallback } from 'react';
import { Alert, Box, Typography, ButtonBase } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ErrorMessageBlock } from '../../../shared/types/newMessage';
import type { SerializedError } from '../../../shared/types/error';
import ErrorDetailDialog from './ErrorDetailDialog';

interface Props {
  block: ErrorMessageBlock;
}

const HTTP_ERROR_CODES = [400, 401, 403, 404, 429, 500, 502, 503, 504];

/**
 * 错误块组件
 */
const ErrorBlock: React.FC<Props> = ({ block }) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  /**
   * 打开详情对话框
   */
  const handleShowDetail = useCallback(() => {
    setDialogOpen(true);
  }, []);

  /**
   * 关闭详情对话框
   */
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  /**
   * 获取用户友好的错误消息
   */
  const getUserFriendlyMessage = () => {
    // 优先显示实际的错误消息
    const errorMessage = block.error?.message || block.message || block.content;

    if (errorMessage) {
      return errorMessage;
    }

    // 如果是HTTP错误码，返回对应的错误消息
    const status = block.error?.status || block.error?.statusCode;
    if (status && HTTP_ERROR_CODES.includes(status)) {
      return t(`errors.http.${status}`) || '未知HTTP错误';
    }

    // 默认错误消息
    return '发生错误，请重试';
  };

  // 准备序列化的错误对象用于详情对话框
  const serializedError: SerializedError | undefined = block.error
    ? {
        name: block.error.name || null,
        message: block.error.message || null,
        stack: block.error.stack || null,
        ...(block.error as any) // 包含所有其他字段
      }
    : undefined;

  return (
    <>
      <Box sx={{ margin: '15px 0 8px' }}>
        <ButtonBase
          onClick={handleShowDetail}
          sx={{
            width: '100%',
            textAlign: 'left',
            borderRadius: 1,
            display: 'block',
            '&:hover': {
              opacity: 0.9
            },
            '&:active': {
              opacity: 0.8
            }
          }}
        >
          <Alert
            severity="error"
            sx={{
              padding: '10px',
              fontSize: '12px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '12px',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  pr: 2
                }}
              >
                {getUserFriendlyMessage()}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '11px',
                  color: 'error.main',
                  fontWeight: 'medium',
                  flexShrink: 0
                }}
              >
                {t('errors.detail')}
              </Typography>
            </Box>
          </Alert>
        </ButtonBase>
      </Box>

      <ErrorDetailDialog open={dialogOpen} onClose={handleCloseDialog} error={serializedError} />
    </>
  );
};

export default React.memo(ErrorBlock);
