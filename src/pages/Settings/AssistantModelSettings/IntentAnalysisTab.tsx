import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../../shared/store';
import { updateSettings } from '../../../shared/store/settingsSlice';
import { getModelIdentityKey, modelMatchesIdentity, parseModelIdentityKey } from '../../../shared/utils/modelUtils';
import { SettingGroup, Row, YStack } from '../../../components/settings/SettingComponents';
import CustomSwitch from '../../../components/CustomSwitch';
import ModelPickerRow from './ModelPickerRow';
import { useAllModels, type ModelWithProvider } from './useAllModels';

const IntentAnalysisTab: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const defaultModelId = useSelector((state: RootState) => state.settings.defaultModelId);
  const topicNamingModelId = useSelector((state: RootState) => state.settings.topicNamingModelId);
  const enableAIIntentAnalysis = useSelector((state: RootState) => state.settings.enableAIIntentAnalysis);
  const aiIntentAnalysisUseCurrentModel = useSelector((state: RootState) => state.settings.aiIntentAnalysisUseCurrentModel);
  const aiIntentAnalysisModelId = useSelector((state: RootState) => state.settings.aiIntentAnalysisModelId);

  const allModels = useAllModels();

  const selectedModel = useMemo(() => {
    const identity = parseModelIdentityKey(aiIntentAnalysisModelId || topicNamingModelId || defaultModelId);
    if (!identity) return null;
    return allModels.find((model) => modelMatchesIdentity(model, identity, model.providerId)) || null;
  }, [allModels, aiIntentAnalysisModelId, topicNamingModelId, defaultModelId]);

  const handleModelSelect = (model: ModelWithProvider) => {
    const providerId = (model as any).provider || model.providerId;
    dispatch(updateSettings({ aiIntentAnalysisModelId: getModelIdentityKey({ id: model.id, provider: providerId }) }));
  };

  return (
    <YStack sx={{ gap: 3 }}>
      <SettingGroup title={t('modelSettings.defaultModel.aiIntentAnalysis')}>
        <Row>
          <Box sx={{ flex: 1 }}>
            <Typography>{t('modelSettings.defaultModel.enableAIIntentAnalysis')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('modelSettings.defaultModel.enableAIIntentAnalysisDesc')}
            </Typography>
          </Box>
          <CustomSwitch
            checked={enableAIIntentAnalysis ?? false}
            onChange={(e) => dispatch(updateSettings({ enableAIIntentAnalysis: e.target.checked }))}
          />
        </Row>

        {enableAIIntentAnalysis && (
          <>
            <Row>
              <Box sx={{ flex: 1 }}>
                <Typography>{t('modelSettings.defaultModel.aiIntentUseCurrentModel')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('modelSettings.defaultModel.aiIntentUseCurrentModelDesc')}
                </Typography>
              </Box>
              <CustomSwitch
                checked={aiIntentAnalysisUseCurrentModel ?? true}
                onChange={(e) => dispatch(updateSettings({ aiIntentAnalysisUseCurrentModel: e.target.checked }))}
              />
            </Row>

            {aiIntentAnalysisUseCurrentModel === false && (
              <ModelPickerRow
                label={t('modelSettings.defaultModel.aiIntentAnalysis')}
                selectedModel={selectedModel as ModelWithProvider | null}
                availableModels={allModels}
                onSelect={handleModelSelect}
                buttonText={t('modelSettings.defaultModel.selectModel')}
                notSelectedText={t('modelSettings.defaultModel.notSelected')}
              />
            )}
          </>
        )}
      </SettingGroup>

      <Box sx={{ px: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {t('modelSettings.defaultModel.aiIntentAnalysisDesc')}
        </Typography>
      </Box>
    </YStack>
  );
};

export default IntentAnalysisTab;
