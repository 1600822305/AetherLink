import React, { useMemo } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../../shared/store';
import { updateSettings } from '../../../shared/store/settingsSlice';
import { getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../../../shared/utils/modelUtils';
import { SettingGroup, Row, YStack } from '../../../components/settings/SettingComponents';
import CustomSwitch from '../../../components/CustomSwitch';
import ModelPickerRow from './ModelPickerRow';
import { useAllModels, type ModelWithProvider } from './useAllModels';

const TopicNamingTab: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const defaultModelId = useSelector((state: RootState) => state.settings.defaultModelId);
  const topicNamingModelId = useSelector((state: RootState) => state.settings.topicNamingModelId);
  const enableTopicNaming = useSelector((state: RootState) => state.settings.enableTopicNaming);
  const topicNamingPrompt = useSelector((state: RootState) => state.settings.topicNamingPrompt);
  const topicNamingUseCurrentModel = useSelector((state: RootState) => state.settings.topicNamingUseCurrentModel);

  const allModels = useAllModels();

  const selectedModel = useMemo(() => {
    const identity = parseModelIdentityKey(topicNamingModelId || defaultModelId);
    if (!identity) return null;
    return allModels.find((model) => modelMatchesIdentity(model, identity, model.providerId)) || null;
  }, [allModels, topicNamingModelId, defaultModelId]);

  const handleModelSelect = (model: ModelWithProvider) => {
    const providerId = (model as any).provider || model.providerId;
    dispatch(updateSettings({ topicNamingModelId: getModelIdentityKey({ id: model.id, provider: providerId }) }));
  };

  return (
    <YStack sx={{ gap: 3 }}>
      <SettingGroup title={t('modelSettings.defaultModel.namingModel')}>
        <Row>
          <Box sx={{ flex: 1 }}>
            <Typography>{t('modelSettings.defaultModel.autoNaming')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('modelSettings.defaultModel.autoNamingDesc')}
            </Typography>
          </Box>
          <CustomSwitch
            checked={enableTopicNaming}
            onChange={(e) => dispatch(updateSettings({ enableTopicNaming: e.target.checked }))}
          />
        </Row>

        <Row>
          <Box sx={{ flex: 1 }}>
            <Typography>{t('modelSettings.defaultModel.useCurrentTopicModel')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('modelSettings.defaultModel.useCurrentTopicModelDesc')}
            </Typography>
          </Box>
          <CustomSwitch
            checked={topicNamingUseCurrentModel ?? true}
            onChange={(e) => dispatch(updateSettings({ topicNamingUseCurrentModel: e.target.checked }))}
          />
        </Row>

        {topicNamingUseCurrentModel === false && (
          <ModelPickerRow
            label={t('modelSettings.defaultModel.namingModel')}
            selectedModel={selectedModel as ModelWithProvider | null}
            availableModels={allModels}
            onSelect={handleModelSelect}
            buttonText={t('modelSettings.defaultModel.selectModel')}
            notSelectedText={t('modelSettings.defaultModel.notSelected')}
          />
        )}
      </SettingGroup>

      <SettingGroup title={t('modelSettings.defaultModel.namingPrompt')}>
        <Row sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('modelSettings.defaultModel.namingPromptDesc')}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
            size="small"
            value={topicNamingPrompt}
            onChange={(e) => dispatch(updateSettings({ topicNamingPrompt: e.target.value }))}
            placeholder={t('modelSettings.defaultModel.namingPromptPlaceholder')}
          />
          {topicNamingPrompt && (
            <Button
              variant="outlined"
              size="small"
              sx={{ textTransform: 'none' }}
              onClick={() => dispatch(updateSettings({ topicNamingPrompt: '' }))}
            >
              {t('modelSettings.defaultModel.resetToDefault')}
            </Button>
          )}
        </Row>
      </SettingGroup>
    </YStack>
  );
};

export default TopicNamingTab;
