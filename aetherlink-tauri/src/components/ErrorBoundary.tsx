import { Component, type ReactNode } from 'react';
import { Button, Box, Typography } from '@mui/material';

interface Props {
  children: ReactNode;
  error?: Error;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary捕获错误:', error, errorInfo);
  }

  render() {
    const error = this.props.error || this.state.error;
    
    if (this.state.hasError || error) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          height="100vh"
          padding={3}
        >
          <Typography variant="h5" gutterBottom>
            应用遇到了问题
          </Typography>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            {error?.message || '未知错误'}
          </Typography>
          {this.props.onRetry && (
            <Button
              variant="contained"
              onClick={this.props.onRetry}
              sx={{ mt: 2 }}
            >
              重试
            </Button>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
