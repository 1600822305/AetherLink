import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Type, Lightbulb, Eye } from 'lucide-react';
import {
  SafeAreaContainer,
  Container,
  HeaderBar,
} from '../../../components/settings/SettingComponents';
import useScrollPosition from '../../../hooks/useScrollPosition';
import TopicNamingTab from './TopicNamingTab';
import IntentAnalysisTab from './IntentAnalysisTab';
import VisionRecognitionTab from './VisionRecognitionTab';

const AssistantModelSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  const { containerRef, handleScroll } = useScrollPosition('settings-assistant-model', {
    autoRestore: true,
    restoreDelay: 0,
  });

  const handleBack = () => navigate('/settings');

  return (
    <SafeAreaContainer>
      <HeaderBar title={t('modelSettings.defaultModel.title')} onBackPress={handleBack} />
      <Container ref={containerRef} onScroll={handleScroll}>
        <Box
          sx={{
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            p: 0.5,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            variant="fullWidth"
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{
              minHeight: 0,
              '& .MuiTabs-flexContainer': { gap: 0.5 },
              '& .MuiTab-root': {
                minHeight: 0,
                borderRadius: 2,
                px: 1.5,
                py: 1.1,
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'none',
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                  color: 'text.primary',
                  bgcolor: 'action.selected',
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              },
            }}
          >
            <Tab disableRipple label={t('modelSettings.defaultModel.tabs.topicNaming', '话题命名')} icon={<Type size={18} />} iconPosition="start" />
            <Tab disableRipple label={t('modelSettings.defaultModel.tabs.intentAnalysis', '意图分析')} icon={<Lightbulb size={18} />} iconPosition="start" />
            <Tab disableRipple label={t('modelSettings.defaultModel.tabs.visionRecognition', '视觉识别')} icon={<Eye size={18} />} iconPosition="start" />
          </Tabs>
        </Box>

        {activeTab === 0 && <TopicNamingTab />}
        {activeTab === 1 && <IntentAnalysisTab />}
        {activeTab === 2 && <VisionRecognitionTab />}
      </Container>
    </SafeAreaContainer>
  );
};

export default AssistantModelSettingsPage;
