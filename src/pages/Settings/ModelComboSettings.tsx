import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha,
  useTheme,
} from '@mui/material';
import BackButtonDialog from '../../components/common/BackButtonDialog';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Bot,
  Wand2,
  ArrowLeftRight,
  GitBranch,
  ArrowRight
} from 'lucide-react';

import { modelComboService } from '../../shared/services/ai/ModelComboService';
import type { ModelComboConfig, ModelComboTemplate, ModelComboStrategy } from '../../shared/types/ModelCombo';
import { useModelComboSync } from '../../shared/hooks/useModelComboSync';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('ModelComboSettings');
import useScrollPosition from '../../hooks/useScrollPosition';
import {
  SafeAreaContainer,
  Container,
  HeaderBar,
  YStack,
  GroupTitle,
  Group,
} from '../../components/settings/SettingComponents';

const ModelComboSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  const { containerRef, handleScroll } = useScrollPosition('settings-model-combo', {
    autoRestore: true,
    restoreDelay: 0,
  });

  const [combos, setCombos] = useState<ModelComboConfig[]>([]);
  const [templates, setTemplates] = useState<ModelComboTemplate[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comboToDelete, setComboToDelete] = useState<ModelComboConfig | null>(null);
  const location = useLocation();

  const { syncModelCombos } = useModelComboSync();

  const loadData = async () => {
    try {
      const [combosData, templatesData] = await Promise.all([
        modelComboService.getAllCombos(),
        Promise.resolve(modelComboService.getTemplates())
      ]);
      setCombos(combosData);
      setTemplates(templatesData);
    } catch (error) {
      logger.error('加载模型组合数据失败:', error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [location.key]);

  const handleBack = () => {
    navigate('/settings');
  };

  const handleCreateCombo = () => {
    navigate('/settings/model-combo/new');
  };

  const handleEditCombo = (combo: ModelComboConfig) => {
    navigate(`/settings/model-combo/${combo.id}`);
  };

  const handleDeleteCombo = (combo: ModelComboConfig) => {
    setComboToDelete(combo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (comboToDelete) {
      try {
        await modelComboService.deleteCombo(comboToDelete.id);
        await loadData();
        await syncModelCombos();
        setDeleteDialogOpen(false);
        setComboToDelete(null);
      } catch (error) {
        logger.error('删除模型组合失败:', error);
      }
    }
  };

  const handleCreateFromTemplate = async (template: ModelComboTemplate) => {
    try {
      const comboData = {
        ...template.template,
        name: template.name,
        description: template.description
      };
      await modelComboService.createCombo(comboData);
      await loadData();
      await syncModelCombos();
    } catch (error) {
      logger.error('从模板创建模型组合失败:', error);
    }
  };

  const getStrategyIcon = (strategy: ModelComboStrategy, size = 14) => {
    switch (strategy) {
      case 'routing': return <Bot size={size} />;
      case 'ensemble': return <GitBranch size={size} />;
      case 'comparison': return <ArrowLeftRight size={size} />;
      case 'cascade': return <Wand2 size={size} />;
      case 'sequential': return <ArrowRight size={size} />;
      default: return <Bot size={size} />;
    }
  };

  const getStrategyLabel = (strategy: ModelComboStrategy) => {
    switch (strategy) {
      case 'routing': return t('modelSettings.combo.strategy.routing');
      case 'ensemble': return t('modelSettings.combo.strategy.ensemble');
      case 'comparison': return t('modelSettings.combo.strategy.comparison');
      case 'cascade': return t('modelSettings.combo.strategy.cascade');
      case 'sequential': return t('modelSettings.combo.strategy.sequential');
      default: return strategy;
    }
  };

  const getStrategyColor = (strategy: ModelComboStrategy) => {
    switch (strategy) {
      case 'routing': return theme.palette.info.main;
      case 'ensemble': return theme.palette.success.main;
      case 'comparison': return theme.palette.warning.main;
      case 'cascade': return theme.palette.secondary.main;
      case 'sequential': return theme.palette.primary.main;
      default: return theme.palette.text.secondary;
    }
  };

  const strategyChip = (strategy: ModelComboStrategy) => (
    <Chip
      icon={getStrategyIcon(strategy)}
      label={getStrategyLabel(strategy)}
      size="small"
      sx={{
        bgcolor: alpha(getStrategyColor(strategy), 0.1),
        color: getStrategyColor(strategy),
        fontWeight: 600,
        height: 24,
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );

  return (
    <SafeAreaContainer>
      <HeaderBar
        title={t('modelSettings.combo.title')}
        onBackPress={handleBack}
        rightButton={
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={handleCreateCombo}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {t('modelSettings.combo.create', '新建组合')}
          </Button>
        }
      />
      <Container ref={containerRef} onScroll={handleScroll}>

        {/* ==================== 我的组合 ==================== */}
        <YStack sx={{ gap: 1 }}>
          <GroupTitle>{t('modelSettings.combo.myCombos')}</GroupTitle>

          {combos.length === 0 ? (
            <Group sx={{ p: 4, textAlign: 'center' }}>
              <YStack sx={{ alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    mb: 0.5,
                  }}
                >
                  <GitBranch size={26} />
                </Box>
                <Typography sx={{ fontWeight: 600 }}>
                  {t('modelSettings.combo.noComboYet')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('modelSettings.combo.createComboDesc')}
                </Typography>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<Plus size={16} />}
                  onClick={handleCreateCombo}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  {t('modelSettings.combo.createFirst')}
                </Button>
              </YStack>
            </Group>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              {combos.map((combo) => (
                <Group
                  key={combo.id}
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {combo.name}
                    </Typography>
                    <Chip
                      label={combo.enabled
                        ? t('modelSettings.combo.enabledChip', '已启用')
                        : t('modelSettings.combo.disabledChip', '已停用')}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        bgcolor: combo.enabled
                          ? alpha(theme.palette.success.main, 0.12)
                          : alpha(theme.palette.text.secondary, 0.1),
                        color: combo.enabled ? 'success.main' : 'text.secondary',
                      }}
                    />
                  </Box>

                  {combo.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        minHeight: '2.6em',
                      }}
                    >
                      {combo.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
                    {strategyChip(combo.strategy)}
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                      {t('modelSettings.combo.modelCount', { count: combo.models.length })}
                    </Typography>
                    <IconButton size="small" onClick={() => handleEditCombo(combo)} sx={{ color: 'text.secondary' }}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteCombo(combo)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>
                </Group>
              ))}
            </Box>
          )}
        </YStack>

        {/* ==================== 预设模板 ==================== */}
        {templates.length > 0 && (
          <YStack sx={{ gap: 1 }}>
            <GroupTitle>{t('modelSettings.combo.presetTemplates')}</GroupTitle>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 1.5,
              }}
            >
              {templates.map((template) => (
                <Group
                  key={template.id}
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ fontSize: '1.25rem', lineHeight: 1 }}>{template.icon}</Box>
                    <Typography sx={{ fontWeight: 600, flex: 1 }}>{template.name}</Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: '2.6em',
                    }}
                  >
                    {template.description}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
                    {strategyChip(template.strategy)}
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      startIcon={<Plus size={14} />}
                      onClick={() => handleCreateFromTemplate(template)}
                      sx={{ textTransform: 'none' }}
                    >
                      {t('modelSettings.combo.useTemplate')}
                    </Button>
                  </Box>
                </Group>
              ))}
            </Box>
          </YStack>
        )}

      </Container>

      {/* 删除确认对话框 */}
      <BackButtonDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('modelSettings.combo.deleteConfirm')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('modelSettings.combo.deleteMessage', { name: comboToDelete?.name || '' })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disableElevation>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </SafeAreaContainer>
  );
};

export default ModelComboSettings;
