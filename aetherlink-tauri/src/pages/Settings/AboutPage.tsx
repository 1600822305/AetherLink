import React from 'react';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Container,
  Divider,
  Paper,
  Button,
  Chip,
  useTheme,
  Fade,
  Slide,
} from '@mui/material';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// QQ群链接
const QQ_GROUP_URL = 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=V-b46WoBNLIM4oc34JMULwoyJ3hyrKac&authKey=q%2FSwCcxda4e55ygtwp3h9adQXhqBLZ9wJdvM0QxTjXQkbxAa2tHoraOGy2fiibyY&noverify=0&group_code=930126592';

const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleBack = () => {
    navigate('/settings');
  };

  const handleJoinQQGroup = async () => {
    try {
      // 使用传统方法打开链接
      window.open(QQ_GROUP_URL, '_blank');
    } catch (error) {
      console.error('打开浏览器失败:', error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* 顶部 AppBar 透明渐变，滚动时加阴影 */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 16px 0 rgba(147,51,234,0.08)',
          borderBottom: `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(147,51,234,0.18)' : 'rgba(147,51,234,0.12)'}`,
          zIndex: 1100,
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              transition: 'all 0.2s',
              '&:hover': {
                color: '#9333ea',
                transform: 'scale(1.12)',
                background: 'rgba(147,51,234,0.08)',
              },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: '#9333ea',
              textShadow: '0 2px 8px rgba(147,51,234,0.08)',
            }}
          >
            关于我们
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{
        py: 4,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}>
        <Fade in timeout={800}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 4 },
              borderRadius: 5,
              background: 'rgba(255,255,255,0.35)',
              boxShadow: '0 8px 32px 0 rgba(31,38,135,0.18)',
              backdropFilter: 'blur(18px)',
              border: '1.5px solid rgba(147,51,234,0.13)',
              position: 'relative',
              overflow: 'visible',
              width: '100%',
            }}
          >
            {/* 渐变分割线 */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 6, background: 'linear-gradient(90deg,#a18cd1,#fbc2eb,#9333ea)', opacity: 0.18, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />

            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, letterSpacing: 1.1, color: '#9333ea' }}>
              关于AetherLink
            </Typography>
            <Divider sx={{ mb: 3, background: 'linear-gradient(90deg,#a18cd1,#fbc2eb,#9333ea)', height: 3, borderRadius: 2, opacity: 0.25 }} />

            {/* Logo 加入渐变边框和浮动动画 */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 130,
                  height: 130,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#a18cd1,#fbc2eb,#9333ea)',
                  p: '2.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 24px 0 rgba(147,51,234,0.13)',
                  animation: 'floatLogo 3.2s ease-in-out infinite',
                  '@keyframes floatLogo': {
                    '0%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                    '100%': { transform: 'translateY(0px)' },
                  },
                }}
              >
                <img
                  src="/assets/logo.png"
                  alt="AetherLink Logo"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'contain',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.7)',
                    boxShadow: '0 2px 12px 0 rgba(147,51,234,0.08)',
                  }}
                />
              </Box>
            </Box>

            <Typography variant="body1" paragraph sx={{ fontSize: 18, fontWeight: 500, color: '#3b0764', mb: 1 }}>
              AetherLink是一个强大的AI助手应用，支持多种大语言模型，帮助您更高效地完成工作。
            </Typography>

            <Typography variant="body1" paragraph sx={{ fontSize: 17, color: '#5b21b6', mb: 2 }}>
              我们致力于为用户提供最佳的AI辅助体验，让人工智能技术真正帮助到每一个人。
            </Typography>

            {/* 用户交流群卡片 */}
            <Slide in direction="up" timeout={900}>
              <Box
                sx={{
                  mt: 3,
                  mb: 3,
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(147,51,234,0.07)',
                  border: '1.5px solid rgba(147,51,234,0.13)',
                  boxShadow: '0 2px 12px 0 rgba(147,51,234,0.08)',
                  transition: 'box-shadow 0.3s',
                  '&:hover': {
                    boxShadow: '0 6px 24px 0 rgba(147,51,234,0.18)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MessageCircle size={22} style={{ marginRight: 8, color: '#9333ea' }} />
                  <Typography variant="subtitle1" fontWeight="medium" sx={{ color: '#7c3aed', fontWeight: 700 }}>
                    用户交流群
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5, color: '#6d28d9', fontWeight: 500 }}>
                  如有问题或建议，欢迎加入我们的QQ群进行反馈
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label="群号: 930126592" variant="outlined" size="small" sx={{ borderColor: '#a18cd1', color: '#7c3aed', fontWeight: 700, fontSize: 15 }} />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleJoinQQGroup}
                    startIcon={<MessageCircle size={20} />}
                    sx={{
                      background: 'linear-gradient(90deg,#a18cd1,#fbc2eb,#9333ea)',
                      color: '#fff',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px 0 rgba(147,51,234,0.13)',
                      transition: 'all 0.18s',
                      '&:hover': {
                        background: 'linear-gradient(90deg,#9333ea,#a18cd1,#fbc2eb)',
                        transform: 'scale(1.08)',
                        boxShadow: '0 6px 18px 0 rgba(147,51,234,0.18)',
                      },
                    }}
                  >
                    加入QQ群
                  </Button>
                </Box>
              </Box>
            </Slide>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontWeight: 600, fontSize: 15, letterSpacing: 1 }}>
              版本: <span style={{ color: '#9333ea', fontWeight: 700 }}>0.4.9</span>
            </Typography>

            {/* 底部按钮组 */}
            <Box sx={{ mt: 5, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                href="https://github.com/1600822305/CS-LLM-house"
                target="_blank"
                sx={{
                  borderColor: '#a18cd1',
                  color: '#9333ea',
                  fontWeight: 700,
                  px: 3,
                  borderRadius: 3,
                  transition: 'all 0.18s',
                  '&:hover': {
                    background: 'linear-gradient(90deg,#a18cd1,#fbc2eb,#9333ea)',
                    color: '#fff',
                    borderColor: '#9333ea',
                    transform: 'scale(1.07)',
                  },
                }}
              >
                GitHub
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => navigate('/devtools')}
                sx={{
                  borderColor: '#fbc2eb',
                  color: '#7c3aed',
                  fontWeight: 700,
                  px: 3,
                  borderRadius: 3,
                  transition: 'all 0.18s',
                  '&:hover': {
                    background: 'linear-gradient(90deg,#fbc2eb,#a18cd1,#9333ea)',
                    color: '#fff',
                    borderColor: '#9333ea',
                    transform: 'scale(1.07)',
                  },
                }}
              >
                开发者工具
              </Button>
            </Box>
          </Paper>
        </Fade>
      </Container>
      {/* 全局动画 keyframes 注入 */}
      <style>{`
        @keyframes floatLogo {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes chatIconPulse {
          0% { filter: drop-shadow(0 0 0 #a18cd1); }
          50% { filter: drop-shadow(0 0 8px #a18cd1); }
          100% { filter: drop-shadow(0 0 0 #a18cd1); }
        }

        /* 自定义滚动条样式 */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(147, 51, 234, 0.1);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #a18cd1, #9333ea);
          border-radius: 4px;
          transition: all 0.3s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #9333ea, #7c3aed);
          transform: scale(1.1);
        }

        /* 移动端滚动条优化 */
        @media (max-width: 768px) {
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }

          ::-webkit-scrollbar-thumb {
            background: rgba(147, 51, 234, 0.6);
            border-radius: 3px;
          }

          ::-webkit-scrollbar-track {
            background: rgba(147, 51, 234, 0.05);
            border-radius: 3px;
          }
        }

        /* 增强移动端滚动体验 */
        html, body {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        /* 确保滚动容器在移动端正常工作 */
        @media (max-width: 768px) {
          .MuiBox-root {
            overflow-x: hidden;
          }
        }

        /* 小屏设备特殊优化 */
        @media (max-width: 480px) {
          ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }

          ::-webkit-scrollbar-thumb {
            background: rgba(147, 51, 234, 0.8);
            border-radius: 2px;
          }
        }
      `}</style>
    </Box>
  );
};

export default AboutPage; 