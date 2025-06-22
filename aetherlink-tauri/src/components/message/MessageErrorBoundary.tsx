import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { formatErrorMessage } from '../../shared/utils/error';

interface Props {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件
 * 捕获渲染过程中的错误，防止整个应用崩溃
 */
class MessageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态，下次渲染时显示错误UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 记录错误信息
    console.error('消息渲染错误:', error);
    console.error('错误组件栈:', errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 显示错误UI
      return <ErrorFallback fallback={this.props.fallback} error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * 错误回退组件
 * 当发生错误时显示
 */
const ErrorFallback = ({ fallback, error }: { fallback?: React.ReactNode; error?: Error }) => {
  // 如果有自定义回退UI，则使用它
  if (fallback) {
    return <>{fallback}</>;
  }

  // 获取错误详情
  const errorDetails = process.env.NODE_ENV !== 'production' && error
    ? formatErrorMessage(error)
    : null;

  return (
    <Box sx={{ my: 1 }}>
      <Alert severity="error" variant="outlined">
        <Typography variant="body1">
          渲染消息时发生错误
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          请尝试刷新页面或联系支持团队
        </Typography>
        {errorDetails && (
          <Box 
            component="pre" 
            sx={{ 
              mt: 1, 
              p: 1, 
              backgroundColor: 'rgba(0, 0, 0, 0.04)', 
              borderRadius: 1,
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '200px'
            }}
          >
            {errorDetails}
          </Box>
        )}
      </Alert>
    </Box>
  );
};

export default MessageErrorBoundary;
