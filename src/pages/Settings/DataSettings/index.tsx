import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SafeAreaContainer,
  HeaderBar,
  Container,
  YStack,
} from '../../../components/settings/SettingComponents';
import BackupRestoreSection from './BackupRestoreSection';

/**
 * 数据设置页面
 * 包含数据备份和恢复功能
 */
const DataSettings: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/settings');
  };

  return (
    <SafeAreaContainer>
      <HeaderBar title="数据管理" onBackPress={handleBack} />
      <YStack sx={{ flex: 1, overflow: 'hidden' }}>
        <Container>
          <YStack sx={{ gap: 3 }}>
            <BackupRestoreSection />
          </YStack>
        </Container>
      </YStack>
    </SafeAreaContainer>
  );
};

export default DataSettings;