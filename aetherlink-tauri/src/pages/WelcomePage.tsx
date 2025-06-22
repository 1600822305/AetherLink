import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  CircularProgress,
  Avatar,
  useTheme,
  alpha,
  Card,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../shared/store';
import { addModel, setDefaultModel } from '../shared/store/settingsSlice';
import { presetModels } from '../shared/data/presetModels';
import {
  Lightbulb,
  Shield,
  CheckCheck,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  CheckCircle
} from 'lucide-react';
import type { Model } from '../shared/types';
import { setStorageItem } from '../shared/utils/storage';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const theme = useTheme();

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('gpt-3.5-turbo');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [completed, setCompleted] = useState(false);

  // 处理下一步
  const handleNext = async () => {
    if (activeStep === 1 && !apiKey.trim()) {
      setApiKeyError('请输入API密钥');
      return;
    }

    if (activeStep === 2) {
      await handleFinish();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  // 处理上一步
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // 处理完成
  const handleFinish = async () => {
    setLoading(true);

    try {
      // 获取选中的预设模型
      const selectedPreset = presetModels.find(model => model.id === selectedModelId);

      if (selectedPreset) {
        // 创建模型配置
        const model: Model = {
          id: selectedPreset.id,
          name: selectedPreset.name,
          provider: selectedPreset.provider,
          apiKey: apiKey,
          baseUrl: selectedPreset.defaultBaseUrl,
          maxTokens: 4096,
          temperature: 0.7,
          enabled: true,
          isDefault: true,
          iconUrl: `/icons/${selectedPreset.provider}.png`,
        };

        // 添加模型到Redux
        dispatch(addModel(model));
        dispatch(setDefaultModel(model.id));

        // 设置first-time-user标记，防止再次显示欢迎页面
        await setStorageItem('first-time-user', 'false');

        // 模拟API测试延迟
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 显示完成状态
        setCompleted(true);

        // 3秒后导航到主页
        setTimeout(() => {
          navigate('/chat');
        }, 2000);
      }
    } catch (error) {
      console.error('设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理跳过
  const handleSkip = async () => {
    try {
      // 设置first-time-user标记，防止再次显示欢迎页面
      await setStorageItem('first-time-user', 'false');
      navigate('/chat');
    } catch (error) {
      console.error('保存用户状态失败:', error);
      // 无论如何都导航到主页
      navigate('/chat');
    }
  };

  // 获取当前选择的模型
  const currentModel = presetModels.find(model => model.id === selectedModelId);

  // 步骤图标
  const stepIcons = [
    <Lightbulb size={20} color={theme.palette.primary.main} />,
    <Shield size={20} color={theme.palette.primary.main} />,
    <CheckCheck size={20} color={theme.palette.primary.main} />
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
        py: 4,
        backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(147, 51, 234, 0.1) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(147, 51, 234, 0.05) 2%, transparent 0%)',
        backgroundSize: '100px 100px',
      }}
    >
      <Container maxWidth="sm">
        <Card
          elevation={6}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            overflow: 'visible',
            position: 'relative',
          }}
        >
          {completed ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'success.main',
                  width: 80,
                  height: 80,
                  mb: 3,
                  boxShadow: 3,
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <CheckCircle size={50} />
              </Avatar>
              <Typography variant="h4" gutterBottom fontWeight="bold">
                设置完成
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                您的AetherLink已准备就绪，即将进入应用...
              </Typography>
              <CircularProgress size={24} sx={{ mt: 2 }} />

              <style>{`
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                  100% { transform: scale(1); }
                }
              `}</style>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  top: -30,
                  left: 'calc(50% - 30px)',
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: 3,
                }}
              >
                <MessageCircle size={30} color="#fff" />
              </Box>

              <Box sx={{ textAlign: 'center', mb: 4, mt: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
                  欢迎使用 AetherLink
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  让我们一起完成几个简单的设置步骤，开始您的AI之旅
                </Typography>
              </Box>

              <Stepper activeStep={activeStep} orientation="vertical">
                <Step>
                  <StepLabel
                    StepIconComponent={() => (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: activeStep >= 0 ? 'primary.main' : 'action.disabled'
                        }}
                      >
                        {stepIcons[0]}
                      </Avatar>
                    )}
                  >
                    <Typography fontWeight="medium">选择AI模型</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" paragraph>
                      选择您想要使用的AI模型。您可以随时在设置中更改或添加更多模型。
                    </Typography>

                    <Box sx={{ mb: 2, mt: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                      {presetModels.slice(0, 4).map((model) => (
                        <Paper
                          key={model.id}
                          elevation={selectedModelId === model.id ? 4 : 1}
                          sx={{
                            p: 2,
                            textAlign: 'center',
                            cursor: 'pointer',
                            borderRadius: 2,
                            border: selectedModelId === model.id ? `2px solid ${theme.palette.primary.main}` : 'none',
                            bgcolor: selectedModelId === model.id
                              ? alpha(theme.palette.primary.main, 0.1)
                              : 'background.paper',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                            }
                          }}
                          onClick={() => setSelectedModelId(model.id)}
                        >
                          <Typography variant="subtitle2">{model.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {model.provider}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>

                    <Box sx={{ mb: 2, mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        onClick={handleSkip}
                        startIcon={<SkipForward size={16} />}
                      >
                        跳过设置
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        endIcon={<ChevronRight size={16} />}
                      >
                        继续
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel
                    StepIconComponent={() => (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: activeStep >= 1 ? 'primary.main' : 'action.disabled'
                        }}
                      >
                        {stepIcons[1]}
                      </Avatar>
                    )}
                  >
                    <Typography fontWeight="medium">设置API密钥</Typography>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" paragraph>
                        输入您的{currentModel?.provider || ''}API密钥。这将安全地存储在您的设备上，不会发送到我们的服务器。
                      </Typography>

                      <TextField
                        fullWidth
                        label="API密钥"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setApiKeyError('');
                        }}
                        margin="normal"
                        type="password"
                        error={!!apiKeyError}
                        helperText={apiKeyError || `请输入您的${currentModel?.provider || ''} API密钥`}
                        required
                        variant="outlined"
                        sx={{ mt: 2 }}
                        slotProps={{
                          input: {
                            'aria-invalid': !!apiKeyError,
                            'aria-describedby': 'welcome-api-key-helper-text'
                          },
                          formHelperText: {
                            id: 'welcome-api-key-helper-text'
                          }
                        }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        onClick={handleBack}
                        startIcon={<ChevronLeft size={16} />}
                      >
                        返回
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        endIcon={<ChevronRight size={16} />}
                      >
                        继续
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                <Step>
                  <StepLabel
                    StepIconComponent={() => (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: activeStep >= 2 ? 'primary.main' : 'action.disabled'
                        }}
                      >
                        {stepIcons[2]}
                      </Avatar>
                    )}
                  >
                    <Typography fontWeight="medium">完成设置</Typography>
                  </StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" paragraph>
                        您已经成功配置了 <strong>{currentModel?.name}</strong> ({currentModel?.provider})。
                        点击"完成"按钮开始使用AetherLink。
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        onClick={handleBack}
                        startIcon={<ChevronLeft size={16} />}
                        disabled={loading}
                      >
                        返回
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                            设置中...
                          </>
                        ) : '完成'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
            </>
          )}
        </Card>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            opacity: 0.7
          }}
        >
          AetherLink © {new Date().getFullYear()} 版本 1.0.0
        </Typography>
      </Container>
    </Box>
  );
};

export default WelcomePage;
