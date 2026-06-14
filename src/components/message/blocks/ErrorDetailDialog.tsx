/**
 * 错误详情对话框组件 - MUI 版本
 * 完全参考另一个项目的ErrorDetailSheet，适配 MUI Dialog
 */
import React, { useState } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  IconButton,
  Paper
} from '@mui/material';
import BackButtonDialog from '../../common/BackButtonDialog';
import { X as CloseIcon, Copy as CopyIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  SerializedError,
  SerializedAiSdkError,
  SerializedAiSdkErrorUnion
} from '../../../shared/types/error';
import {
  isSerializedError,
  isSerializedAiSdkError,
  isSerializedAiSdkErrorUnion,
  isSerializedAiSdkAPICallError,
  isSerializedAiSdkDownloadError,
  isSerializedAiSdkInvalidArgumentError,
  isSerializedAiSdkInvalidDataContentError,
  isSerializedAiSdkInvalidMessageRoleError,
  isSerializedAiSdkInvalidPromptError,
  isSerializedAiSdkInvalidToolInputError,
  isSerializedAiSdkJSONParseError,
  isSerializedAiSdkMessageConversionError,
  isSerializedAiSdkNoObjectGeneratedError,
  isSerializedAiSdkNoSpeechGeneratedError,
  isSerializedAiSdkNoSuchModelError,
  isSerializedAiSdkNoSuchProviderError,
  isSerializedAiSdkNoSuchToolError,
  isSerializedAiSdkRetryError,
  isSerializedAiSdkToolCallRepairError,
  isSerializedAiSdkTooManyEmbeddingValuesForCallError,
  isSerializedAiSdkTypeValidationError,
  isSerializedAiSdkUnsupportedFunctionalityError
} from '../../../shared/types/error';
import {
  formatSerializedError,
  formatAiSdkError,
  safeToString
} from '../../../shared/utils/error';
import { createLogger } from '../../../shared/services/infra/logger';

const logger = createLogger('ErrorDetailDialog');

interface ErrorDetailDialogProps {
  open: boolean;
  onClose: () => void;
  error?: SerializedError;
}

/**
 * 错误详情对话框
 */
const ErrorDetailDialog: React.FC<ErrorDetailDialogProps> = ({ open, onClose, error }) => {
  const { t } = useTranslation();
  const [copiedText, setCopiedText] = useState(false);

  /**
   * 复制错误详情到剪贴板
   */
  const copyErrorDetails = async () => {
    if (!error) return;

    let errorText: string;

    if (isSerializedAiSdkError(error)) {
      errorText = formatAiSdkError(error as SerializedAiSdkError);
    } else if (isSerializedError(error)) {
      errorText = formatSerializedError(error);
    } else {
      errorText = safeToString(error);
    }

    try {
      await navigator.clipboard.writeText(errorText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      logger.error('复制失败:', err);
    }
  };

  /**
   * 渲染错误详情内容
   */
  const renderErrorDetails = (error?: SerializedError) => {
    if (!error) return <Typography>{t('errors.unknownError')}</Typography>;

    if (isSerializedAiSdkErrorUnion(error)) {
      return <AiSdkError error={error} />;
    }

    return <BuiltinError error={error} />;
  };

  return (
    <BackButtonDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6">{t('errors.detail')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            size="small"
            startIcon={<CopyIcon size={16} />}
            onClick={copyErrorDetails}
            disabled={!error}
            sx={{ textTransform: 'none' }}
          >
            {copiedText ? t('common.copied') : t('common.copy')}
          </Button>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon size={20} />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {renderErrorDetails(error)}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </BackButtonDialog>
  );
};

/**
 * 错误详情项组件
 */
const ErrorDetailItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {label}:
      </Typography>
      {children}
    </Box>
  );
};

/**
 * 错误详情值组件
 */
const ErrorDetailValue: React.FC<{ children: React.ReactNode; isCode?: boolean }> = ({ children, isCode = false }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: 'action.hover',
        fontFamily: isCode ? 'monospace' : 'inherit',
        fontSize: '0.875rem',
        overflow: 'auto',
        wordBreak: 'break-word'
      }}
    >
      <Typography variant="body2" component="div" sx={{ fontFamily: 'inherit' }}>
        {children}
      </Typography>
    </Paper>
  );
};

/**
 * 堆栈跟踪组件
 */
const StackTrace: React.FC<{ stack: string }> = ({ stack }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: 'error.dark',
        color: 'error.contrastText',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        overflow: 'auto',
        maxHeight: '200px',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap'
      }}
    >
      {stack}
    </Paper>
  );
};

/**
 * JSON 查看器组件
 */
const JsonViewer: React.FC<{ data: any }> = ({ data }) => {
  const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: 'action.hover',
        overflow: 'auto',
        maxHeight: '300px'
      }}
    >
      <pre
        style={{
          margin: 0,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {formatted}
      </pre>
    </Paper>
  );
};

/**
 * 内置错误组件
 */
const BuiltinError: React.FC<{ error: SerializedError }> = ({ error }) => {
  const { t } = useTranslation();

  return (
    <Box>
      {error.name && (
        <ErrorDetailItem label={t('errors.name')}>
          <ErrorDetailValue>{error.name}</ErrorDetailValue>
        </ErrorDetailItem>
      )}
      {error.message && (
        <ErrorDetailItem label={t('errors.message')}>
          <ErrorDetailValue>{error.message}</ErrorDetailValue>
        </ErrorDetailItem>
      )}
      {error.stack && (
        <ErrorDetailItem label={t('errors.stack')}>
          <StackTrace stack={error.stack} />
        </ErrorDetailItem>
      )}
    </Box>
  );
};

/**
 * AI SDK 错误基础信息组件
 */
const AiSdkErrorBase: React.FC<{ error: SerializedAiSdkError }> = ({ error }) => {
  const { t } = useTranslation();

  return (
    <Box>
      <BuiltinError error={error} />
      {error.cause && (
        <ErrorDetailItem label={t('errors.cause')}>
          {typeof error.cause === 'object' && error.cause !== null ? (
            <JsonViewer data={error.cause} />
          ) : (
            <ErrorDetailValue>{safeToString(error.cause)}</ErrorDetailValue>
          )}
        </ErrorDetailItem>
      )}
    </Box>
  );
};

/**
 * AI SDK 错误组件
 */
const AiSdkError: React.FC<{ error: SerializedAiSdkErrorUnion }> = ({ error }) => {
  const { t } = useTranslation();

  return (
    <Box>
      <AiSdkErrorBase error={error} />

      {/* API 调用错误和下载错误的共同字段 */}
      {(isSerializedAiSdkAPICallError(error) || isSerializedAiSdkDownloadError(error)) && (
        <>
          {error.statusCode && (
            <ErrorDetailItem label={t('errors.statusCode')}>
              <ErrorDetailValue>{error.statusCode}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.url && (
            <ErrorDetailItem label={t('errors.requestUrl')}>
              <ErrorDetailValue>{error.url}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* API 调用错误特有字段 */}
      {isSerializedAiSdkAPICallError(error) && (
        <>
          {error.requestBodyValues && (
            <ErrorDetailItem label={t('errors.requestBodyValues')}>
              <JsonViewer data={error.requestBodyValues} />
            </ErrorDetailItem>
          )}

          {error.responseHeaders && (
            <ErrorDetailItem label={t('errors.responseHeaders')}>
              <JsonViewer data={error.responseHeaders} />
            </ErrorDetailItem>
          )}

          {error.responseBody && (
            <ErrorDetailItem label={t('errors.responseBody')}>
              <JsonViewer data={error.responseBody} />
            </ErrorDetailItem>
          )}

          {error.data && (
            <ErrorDetailItem label={t('errors.data')}>
              <JsonViewer data={error.data} />
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 下载错误特有字段 */}
      {isSerializedAiSdkDownloadError(error) && (
        <>
          {error.statusText && (
            <ErrorDetailItem label={t('errors.statusText')}>
              <ErrorDetailValue>{error.statusText}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 无效参数错误 */}
      {isSerializedAiSdkInvalidArgumentError(error) && (
        <>
          {error.parameter && (
            <ErrorDetailItem label={t('errors.parameter')}>
              <ErrorDetailValue>{error.parameter}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 无效参数错误和类型验证错误的共同字段 */}
      {(isSerializedAiSdkInvalidArgumentError(error) || isSerializedAiSdkTypeValidationError(error)) && (
        <>
          {error.value && (
            <ErrorDetailItem label={t('errors.value')}>
              <ErrorDetailValue>{safeToString(error.value)}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 无效数据内容错误 */}
      {isSerializedAiSdkInvalidDataContentError(error) && (
        <ErrorDetailItem label={t('errors.content')}>
          <ErrorDetailValue>{safeToString(error.content)}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 无效消息角色错误 */}
      {isSerializedAiSdkInvalidMessageRoleError(error) && (
        <ErrorDetailItem label={t('errors.role')}>
          <ErrorDetailValue>{error.role}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 无效提示词错误 */}
      {isSerializedAiSdkInvalidPromptError(error) && (
        <ErrorDetailItem label={t('errors.prompt')}>
          <ErrorDetailValue>{safeToString(error.prompt)}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 无效工具输入错误 */}
      {isSerializedAiSdkInvalidToolInputError(error) && (
        <>
          {error.toolName && (
            <ErrorDetailItem label={t('errors.toolName')}>
              <ErrorDetailValue>{error.toolName}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.toolInput && (
            <ErrorDetailItem label={t('errors.toolInput')}>
              <ErrorDetailValue>{error.toolInput}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* JSON 解析错误和未生成对象错误的共同字段 */}
      {(isSerializedAiSdkJSONParseError(error) || isSerializedAiSdkNoObjectGeneratedError(error)) && (
        <ErrorDetailItem label={t('errors.text')}>
          <ErrorDetailValue>{error.text}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 消息转换错误 */}
      {isSerializedAiSdkMessageConversionError(error) && (
        <ErrorDetailItem label={t('errors.originalMessage')}>
          <ErrorDetailValue>{safeToString(error.originalMessage)}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 未生成语音错误 */}
      {isSerializedAiSdkNoSpeechGeneratedError(error) && (
        <ErrorDetailItem label={t('errors.responses')}>
          <ErrorDetailValue>{error.responses.join(', ')}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 未生成对象错误 */}
      {isSerializedAiSdkNoObjectGeneratedError(error) && (
        <>
          {error.response && (
            <ErrorDetailItem label={t('errors.response')}>
              <ErrorDetailValue>{safeToString(error.response)}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.usage && (
            <ErrorDetailItem label={t('errors.usage')}>
              <ErrorDetailValue>{safeToString(error.usage)}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.finishReason && (
            <ErrorDetailItem label={t('errors.finishReason')}>
              <ErrorDetailValue>{error.finishReason}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 模型不存在、提供商不存在、嵌入值过多错误的共同字段 */}
      {(isSerializedAiSdkNoSuchModelError(error) ||
        isSerializedAiSdkNoSuchProviderError(error) ||
        isSerializedAiSdkTooManyEmbeddingValuesForCallError(error)) && (
        <ErrorDetailItem label={t('errors.modelId')}>
          <ErrorDetailValue>{error.modelId}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 模型不存在和提供商不存在的共同字段 */}
      {(isSerializedAiSdkNoSuchModelError(error) || isSerializedAiSdkNoSuchProviderError(error)) && (
        <ErrorDetailItem label={t('errors.modelType')}>
          <ErrorDetailValue>{error.modelType}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 提供商不存在错误 */}
      {isSerializedAiSdkNoSuchProviderError(error) && (
        <>
          <ErrorDetailItem label={t('errors.providerId')}>
            <ErrorDetailValue>{error.providerId}</ErrorDetailValue>
          </ErrorDetailItem>

          <ErrorDetailItem label={t('errors.availableProviders')}>
            <ErrorDetailValue>{error.availableProviders.join(', ')}</ErrorDetailValue>
          </ErrorDetailItem>
        </>
      )}

      {/* 工具不存在错误 */}
      {isSerializedAiSdkNoSuchToolError(error) && (
        <>
          <ErrorDetailItem label={t('errors.toolName')}>
            <ErrorDetailValue>{error.toolName}</ErrorDetailValue>
          </ErrorDetailItem>
          {error.availableTools && (
            <ErrorDetailItem label={t('errors.availableTools')}>
              <ErrorDetailValue>{error.availableTools.join(', ') || t('common.none')}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 重试错误 */}
      {isSerializedAiSdkRetryError(error) && (
        <>
          {error.reason && (
            <ErrorDetailItem label={t('errors.reason')}>
              <ErrorDetailValue>{error.reason}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.lastError && (
            <ErrorDetailItem label={t('errors.lastError')}>
              <ErrorDetailValue>{safeToString(error.lastError)}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.errors && error.errors.length > 0 && (
            <ErrorDetailItem label={t('errors.errors')}>
              <ErrorDetailValue>{error.errors.map(e => safeToString(e)).join('\n\n')}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 嵌入值过多错误 */}
      {isSerializedAiSdkTooManyEmbeddingValuesForCallError(error) && (
        <>
          {error.provider && (
            <ErrorDetailItem label={t('errors.provider')}>
              <ErrorDetailValue>{error.provider}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.maxEmbeddingsPerCall && (
            <ErrorDetailItem label={t('errors.maxEmbeddingsPerCall')}>
              <ErrorDetailValue>{error.maxEmbeddingsPerCall}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
          {error.values && (
            <ErrorDetailItem label={t('errors.values')}>
              <ErrorDetailValue>{safeToString(error.values)}</ErrorDetailValue>
            </ErrorDetailItem>
          )}
        </>
      )}

      {/* 工具调用修复错误 */}
      {isSerializedAiSdkToolCallRepairError(error) && (
        <ErrorDetailItem label={t('errors.originalError')}>
          <ErrorDetailValue>{safeToString(error.originalError)}</ErrorDetailValue>
        </ErrorDetailItem>
      )}

      {/* 不支持的功能错误 */}
      {isSerializedAiSdkUnsupportedFunctionalityError(error) && (
        <ErrorDetailItem label={t('errors.functionality')}>
          <ErrorDetailValue>{error.functionality}</ErrorDetailValue>
        </ErrorDetailItem>
      )}
    </Box>
  );
};

export default ErrorDetailDialog;

