import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import {
  Github,
  MessageCircle,
  Terminal,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';
import {
  SafeAreaContainer,
  HeaderBar,
  Container,
  YStack,
  Group,
  PressableRow,
  XStack,
} from '../../components/settings/SettingComponents';
import { useTranslation } from '../../i18n';

// 应用版本号
const APP_VERSION = '0.6.4';

// QQ群链接
const QQ_GROUP_URL = 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=V-b46WoBNLIM4oc34JMULwoyJ3hyrKac&authKey=q%2FSwCcxda4e55ygtwp3h9adQXhqBLZ9wJdvM0QxTjXQkbxAa2tHoraOGy2fiibyY&noverify=0&group_code=930126592';

// GitHub Issues 反馈链接
const GITHUB_ISSUES_URL = 'https://github.com/1600822305/AetherLink/issues';

const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const appVersion = APP_VERSION;
  const [iconError, setIconError] = useState(false);

  const openLink = async (url: string) => {
    try {
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  const handleIconError = () => {
    setIconError(true);
  };

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={t('settings.about.header')}
        onBackPress={() => navigate('/settings')}
      />
      <Container>
        <YStack sx={{ gap: 3 }}>
          {/* Logo and Description */}
          <Group>
            <Box sx={{ p: 2 }}>
              <XStack sx={{ gap: 2 }}>
                <Box
                  component="img"
                  src={iconError ? '/icon-192.png' : '/app-icon.png'}
                  alt="AetherLink Logo"
                  onError={handleIconError}
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <YStack sx={{ gap: 0.5, py: 0.5, flex: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontSize: '22px',
                    }}
                  >
                    {t('settings.about.appName')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                    }}
                  >
                    {t('settings.about.appDescription')}
                  </Typography>
                  <Box
                    sx={{
                      display: 'inline-block',
                      alignSelf: 'flex-start',
                      border: '1px solid',
                      borderColor: 'success.main',
                      backgroundColor: 'success.light',
                      color: 'success.dark',
                      px: 1,
                      py: 0.5,
                      borderRadius: '25px',
                      fontSize: '0.75rem',
                      mt: 0.5,
                    }}
                  >
                    v{appVersion}
                  </Box>
                </YStack>
              </XStack>
            </Box>
          </Group>

          {/* Links Group */}
          <Group>
            <PressableRow
              onClick={() => openLink('https://github.com/1600822305/CS-LLM-house')}
            >
              <XStack sx={{ gap: 1.25, alignItems: 'center' }}>
                <Github size={20} />
                <Typography>{t('settings.about.github.title')}</Typography>
              </XStack>
              <ArrowUpRight size={16} />
            </PressableRow>
            <PressableRow
              onClick={() => openLink(QQ_GROUP_URL)}
            >
              <XStack sx={{ gap: 1.25, alignItems: 'center' }}>
                <MessageCircle size={20} />
                <Typography>{t('settings.about.qqGroup.title')}</Typography>
              </XStack>
              <ArrowUpRight size={16} />
            </PressableRow>
            <PressableRow
              onClick={() => openLink(GITHUB_ISSUES_URL)}
            >
              <XStack sx={{ gap: 1.25, alignItems: 'center' }}>
                <MessageSquare size={20} />
                <Typography>{t('settings.about.feedback.title')}</Typography>
              </XStack>
              <ArrowUpRight size={16} />
            </PressableRow>
            <PressableRow
              onClick={() => navigate('/devtools')}
            >
              <XStack sx={{ gap: 1.25, alignItems: 'center' }}>
                <Terminal size={20} />
                <Typography>{t('settings.about.devTools.title')}</Typography>
              </XStack>
              <ArrowUpRight size={16} />
            </PressableRow>
          </Group>
        </YStack>
      </Container>
    </SafeAreaContainer>
  );
};

export default AboutPage;
