import React from 'react';
import { Alert, Box, Typography, Divider } from '@mui/material';
import type { ErrorMessageBlock } from '../../../shared/types/newMessage';

interface Props {
  block: ErrorMessageBlock;
}

/**
 * 错误块组件 - 简化版本（类似）
 * 负责渲染错误信息
 */
const ErrorBlock: React.FC<Props> = ({ block }) => {
  // HTTP错误状态码
  const HTTP_ERROR_CODES = [400, 401, 403, 404, 429, 500, 502, 503, 504];

  // 获取用户友好的错误消息
  const getUserFriendlyMessage = () => {
    // 优先显示实际的错误消息
    const errorMessage = block.error?.message || block.message || block.content;

    if (errorMessage) {
      return errorMessage;
    }

    // 如果是HTTP错误码，返回对应的错误消息
    if (block.error && HTTP_ERROR_CODES.includes(block.error?.status)) {
      const httpErrorMessages: Record<number, string> = {
        400: '请求错误，请检查请求参数是否正确。如果修改了模型设置，请重置到默认设置',
        401: '身份验证失败，请检查 API 密钥是否正确',
        403: '禁止访问，请翻译具体报错信息查看原因，或联系服务商询问被禁止原因',
        404: '模型不存在或者请求路径错误',
        429: '请求速率超过限制，请稍后再试',
        500: '服务器错误，请稍后再试',
        502: '网关错误，请稍后再试',
        503: '服务不可用，请稍后再试',
        504: '网关超时，请稍后再试'
      };
      return httpErrorMessages[block.error.status] || '未知HTTP错误';
    }

    // 默认错误消息
    return '发生错误，请重试';
  };

  // 获取API响应内容
  const getApiResponse = () => {
    // 只从真正的响应字段获取内容，不包括错误消息
    const response = block.error?.response ||
                    block.error?.data ||
                    block.error?.details;

    if (!response) return null;

    // 如果是对象，格式化为JSON
    if (typeof response === 'object') {
      try {
        return JSON.stringify(response, null, 2);
      } catch {
        return String(response);
      }
    }

    // 如果是字符串，但不是简单的错误消息，才显示
    const responseStr = String(response);
    // 排除简单的错误消息，只显示结构化的响应
    if (responseStr.includes('{') || responseStr.includes('[') || responseStr.length > 100) {
      return responseStr;
    }

    return null;
  };

  const apiResponse = getApiResponse();

  return (
    <Box sx={{ margin: '15px 0 8px' }}>
      <Alert
        severity="error"
        sx={{
          padding: '10px',
          fontSize: '12px'
        }}
      >
        {/* 用户友好的错误消息 */}
        <Typography variant="body2" sx={{ fontSize: '12px', mb: apiResponse ? 1 : 0 }}>
          {getUserFriendlyMessage()}
        </Typography>

        {/* API响应内容 */}
        {apiResponse && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ fontSize: '11px', color: 'text.secondary', display: 'block', mb: 0.5 }}>
              API响应:
            </Typography>
            <Box
              component="pre"
              sx={{
                fontSize: '10px',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '150px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {apiResponse}
            </Box>
          </>
        )}
      </Alert>
    </Box>
  );
};

export default React.memo(ErrorBlock);
