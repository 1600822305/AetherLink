import React, { useState, useEffect } from 'react';
import { getStorageItem } from '../shared/utils/storage';
import {
  IconButton,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  FormControlLabel,
  TextField,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse
} from '@mui/material';
import BackButtonDialog from './common/BackButtonDialog';
import { Play, Square, FolderOpen, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { CustomIcon } from './icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CustomSwitch from './CustomSwitch';
import { createLogger } from '../shared/services/infra/logger';

const logger = createLogger('AIDebateButton');

// AI辩论配置默认值常量
const DEFAULT_CONFIG = {
  MAX_ROUNDS: 5,
  MODERATOR_ENABLED: true,
  SUMMARY_ENABLED: true
} as const;

// AI辩论角色接口
interface DebateRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId?: string;
  color: string;
  stance: 'pro' | 'con' | 'neutral' | 'moderator' | 'summary';
}

// AI辩论配置接口
interface DebateConfig {
  enabled: boolean;
  maxRounds: number;
  autoEndConditions: {
    consensusReached: boolean;
    maxTokensPerRound: number;
    timeoutMinutes: number;
  };
  roles: DebateRole[];
  moderatorEnabled: boolean;
  summaryEnabled: boolean;
}

// 辩论配置分组接口
interface DebateConfigGroup {
  id: string;
  name: string;
  description: string;
  config: DebateConfig;
  createdAt: number;
  updatedAt: number;
}

interface AIDebateButtonProps {
  onStartDebate?: (question: string, config: DebateConfig) => void;
  onStopDebate?: () => void;
  isDebating?: boolean;
  disabled?: boolean;
  question?: string;
}

const AIDebateButton: React.FC<AIDebateButtonProps> = ({
  onStartDebate,
  onStopDebate,
  isDebating = false,
  disabled = false,
  question = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [config, setConfig] = useState<DebateConfig | null>(null);
  const [debateQuestion, setDebateQuestion] = useState('');
  const [customSettings, setCustomSettings] = useState<{
    maxRounds: number;
    enableModerator: boolean;
    enableSummary: boolean;
  }>({
    maxRounds: DEFAULT_CONFIG.MAX_ROUNDS,
    enableModerator: DEFAULT_CONFIG.MODERATOR_ENABLED,
    enableSummary: DEFAULT_CONFIG.SUMMARY_ENABLED
  });

  // 分组相关状态
  const [configGroups, setConfigGroups] = useState<DebateConfigGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // 预设主题折叠状态
  const [topicsExpanded, setTopicsExpanded] = useState(false);

  // 预设辩论主题
  const debateTopics = [
    {
      category: t('aiDebate.topicCategories.tech'),
      topics: [
        t('aiDebate.topics.tech.ai'),
        t('aiDebate.topics.tech.social'),
        t('aiDebate.topics.tech.auto'),
        t('aiDebate.topics.tech.remote'),
        t('aiDebate.topics.tech.vr')
      ]
    },
    {
      category: t('aiDebate.topicCategories.education'),
      topics: [
        t('aiDebate.topics.education.online'),
        t('aiDebate.topics.education.coding'),
        t('aiDebate.topics.education.exam'),
        t('aiDebate.topics.education.screen'),
        t('aiDebate.topics.education.university')
      ]
    },
    {
      category: t('aiDebate.topicCategories.environment'),
      topics: [
        t('aiDebate.topics.environment.individual'),
        t('aiDebate.topics.environment.nuclear'),
        t('aiDebate.topics.environment.ev'),
        t('aiDebate.topics.environment.plastic'),
        t('aiDebate.topics.environment.urban')
      ]
    },
    {
      category: t('aiDebate.topicCategories.economy'),
      topics: [
        t('aiDebate.topics.economy.ubi'),
        t('aiDebate.topics.economy.crypto'),
        t('aiDebate.topics.economy.sharing'),
        t('aiDebate.topics.economy.csr'),
        t('aiDebate.topics.economy.globalization')
      ]
    },
    {
      category: t('aiDebate.topicCategories.health'),
      topics: [
        t('aiDebate.topics.health.vegan'),
        t('aiDebate.topics.health.exercise'),
        t('aiDebate.topics.health.mental'),
        t('aiDebate.topics.health.gene'),
        t('aiDebate.topics.health.traditional')
      ]
    },
    {
      category: t('aiDebate.topicCategories.society'),
      topics: [
        t('aiDebate.topics.society.equality'),
        t('aiDebate.topics.society.tradition'),
        t('aiDebate.topics.society.privacy'),
        t('aiDebate.topics.society.speech'),
        t('aiDebate.topics.society.diversity')
      ]
    }
  ];

  // 加载配置和分组
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 加载当前配置（与 AIDebateSettings 一致，使用 Dexie 存储）
        const parsedConfig = await getStorageItem<DebateConfig>('aiDebateConfig');
        if (parsedConfig) {
          setConfig(parsedConfig);
          setCustomSettings({
            maxRounds: parsedConfig.maxRounds || DEFAULT_CONFIG.MAX_ROUNDS,
            enableModerator: parsedConfig.moderatorEnabled ?? DEFAULT_CONFIG.MODERATOR_ENABLED,
            enableSummary: parsedConfig.summaryEnabled ?? DEFAULT_CONFIG.SUMMARY_ENABLED
          });
        }

        // 加载分组配置
        const parsedGroups = await getStorageItem<DebateConfigGroup[]>('aiDebateConfigGroups');
        if (parsedGroups) {
          setConfigGroups(parsedGroups);
        }
      } catch (error) {
        logger.error(t('errors.aiDebate.loadConfigFailed'), error);
      }
    };
    loadConfig();
  }, [t]);

  // 当外部问题变化时更新内部状态
  useEffect(() => {
    if (question) {
      setDebateQuestion(question);
    }
  }, [question]);

  // 处理按钮点击
  const handleButtonClick = () => {
    if (isDebating) {
      // 如果正在辩论，停止辩论
      onStopDebate?.();
    } else {
      // 如果没有在辩论，打开配置对话框
      setDialogOpen(true);
      if (question) {
        setDebateQuestion(question);
      }
    }
  };

  // 开始辩论
  const handleStartDebate = () => {
    if (!config || !debateQuestion.trim()) {
      return;
    }

    // 创建当前辩论的配置
    const currentConfig: DebateConfig = {
      ...config,
      maxRounds: customSettings.maxRounds,
      moderatorEnabled: customSettings.enableModerator,
      summaryEnabled: customSettings.enableSummary
    };

    onStartDebate?.(debateQuestion.trim(), currentConfig);
    setDialogOpen(false);
  };

  // 前往设置页面
  const handleGoToSettings = () => {
    setDialogOpen(false);
    navigate('/settings/ai-debate', { state: { backTo: location.pathname } });
  };

  // 处理分组选择
  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (groupId) {
      const selectedGroup = configGroups.find(group => group.id === groupId);
      if (selectedGroup) {
        setConfig(selectedGroup.config);
        setCustomSettings({
          maxRounds: selectedGroup.config.maxRounds || DEFAULT_CONFIG.MAX_ROUNDS,
          enableModerator: selectedGroup.config.moderatorEnabled ?? DEFAULT_CONFIG.MODERATOR_ENABLED,
          enableSummary: selectedGroup.config.summaryEnabled ?? DEFAULT_CONFIG.SUMMARY_ENABLED
        });
      }
    } else {
      // 如果选择"当前配置"，重新加载当前配置（与 AIDebateSettings 一致，使用 Dexie 存储）
      (async () => {
        try {
          const parsedConfig = await getStorageItem<DebateConfig>('aiDebateConfig');
          if (parsedConfig) {
            setConfig(parsedConfig);
            setCustomSettings({
              maxRounds: parsedConfig.maxRounds || DEFAULT_CONFIG.MAX_ROUNDS,
              enableModerator: parsedConfig.moderatorEnabled ?? DEFAULT_CONFIG.MODERATOR_ENABLED,
              enableSummary: parsedConfig.summaryEnabled ?? DEFAULT_CONFIG.SUMMARY_ENABLED
            });
          }
        } catch (error) {
          logger.error(t('errors.aiDebate.loadConfigFailed'), error);
        }
      })();
    }
  };

  // 检查配置是否有效
  const isConfigValid = config && config.enabled && config.roles.length >= 2;

  // 获取按钮颜色和图标
  const getButtonProps = () => {
    if (isDebating) {
      return {
        color: 'error' as const,
        icon: <Square size={20} />,
        tooltip: t('aiDebate.button.stop')
      };
    } else {
      return {
        color: isConfigValid ? 'primary' as const : 'default' as const,
        icon: <CustomIcon name="aiDebate" size={20} color="currentColor" />,
        tooltip: isConfigValid ? t('aiDebate.button.start') : t('aiDebate.button.notConfigured')
      };
    }
  };

  const buttonProps = getButtonProps();

  return (
    <>
      <Tooltip title={buttonProps.tooltip}>
        <span>
          <IconButton
            onClick={handleButtonClick}
            disabled={disabled}
            color={buttonProps.color}
            size="small"
          >
            {buttonProps.icon}
          </IconButton>
        </span>
      </Tooltip>

      {/* 辩论配置对话框 */}
      <BackButtonDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
            <CustomIcon name="aiDebate" size={20} color="currentColor" />
          </Box>
          {t('aiDebate.dialog.title')}
        </DialogTitle>

        <DialogContent>
          {!isConfigValid ? (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleGoToSettings}
                  sx={{ fontWeight: 600 }}
                >
                  {t('aiDebate.dialog.goToSettings')}
                </Button>
              }
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t('aiDebate.dialog.notConfiguredTitle')}
                </Typography>
                <Typography variant="body2">
                  {t('aiDebate.dialog.notConfiguredWarning')}
                </Typography>
              </Box>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('aiDebate.dialog.configuredInfo', { count: config?.roles.length })}
            </Alert>
          )}

          {/* 辩论问题输入 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('aiDebate.dialog.topic')}
            </Typography>
            <TextField
              value={debateQuestion}
              onChange={(e) => setDebateQuestion(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder={t('aiDebate.dialog.topicPlaceholder')}
              disabled={!isConfigValid}
            />

            {/* 预设主题选择 */}
            <Box sx={{ mt: 2 }}>
              <Button
                onClick={() => setTopicsExpanded(!topicsExpanded)}
                startIcon={topicsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                sx={{
                  textTransform: 'none',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  p: 0.5,
                  minWidth: 'auto',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                {t('aiDebate.dialog.quickTopics')}
              </Button>
              <Collapse in={topicsExpanded}>
                <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  {debateTopics.map((category, categoryIndex) => (
                    <Box key={categoryIndex} sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', display: 'block', mb: 0.5 }}>
                        {category.category}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {category.topics.map((topic, topicIndex) => (
                          <Chip
                            key={topicIndex}
                            label={topic}
                            size="small"
                            variant="outlined"
                            onClick={() => setDebateQuestion(topic)}
                            sx={{
                              fontSize: '0.7rem',
                              height: 24,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'primary.main',
                                color: 'white'
                              }
                            }}
                            disabled={!isConfigValid}
                          />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          </Box>

          {/* 分组选择 */}
          {configGroups.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel shrink>{t('aiDebate.dialog.selectGroup')}</InputLabel>
                <Select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  label={t('aiDebate.dialog.selectGroup')}
                  displayEmpty
                >
                  <MenuItem value="">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FolderOpen size={16} style={{ marginRight: 8 }} />
                      {t('aiDebate.dialog.currentConfig')}
                    </Box>
                  </MenuItem>
                  {configGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FolderOpen size={16} style={{ marginRight: 8 }} />
                        {group.name}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({t('aiDebate.roles.roleCount', { count: group.config.roles.length })})
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* 当前配置的角色 */}
          {isConfigValid && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('aiDebate.dialog.rolesLabel')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {config?.roles.map((role) => (
                  <Chip
                    key={role.id}
                    label={role.name}
                    size="small"
                    sx={{
                      bgcolor: role.color,
                      color: 'white',
                      '& .MuiChip-label': { fontWeight: 500 }
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* 快速设置 */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('aiDebate.dialog.settingsLabel')}
          </Typography>

          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label={t('aiDebate.basicSettings.maxRounds')}
              value={customSettings.maxRounds}
              onChange={(e) => {
                const value = e.target.value;
                // 直接更新，允许任何输入包括空值
                if (value === '') {
                  setCustomSettings({
                    ...customSettings,
                    maxRounds: 0
                  });
                } else {
                  const num = parseInt(value);
                  if (!isNaN(num)) {
                    setCustomSettings({
                      ...customSettings,
                      maxRounds: num
                    });
                  }
                }
              }}
              size="small"
              disabled={!isConfigValid}
              helperText={t('aiDebate.basicSettings.maxRoundsHelper')}
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={customSettings.enableModerator}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    enableModerator: e.target.checked
                  })}
                  disabled={!isConfigValid}
                />
              }
              label={t('aiDebate.basicSettings.enableModerator')}
            />

            <FormControlLabel
              control={
                <CustomSwitch
                  checked={customSettings.enableSummary}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    enableSummary: e.target.checked
                  })}
                  disabled={!isConfigValid}
                />
              }
              label={t('aiDebate.basicSettings.enableSummary')}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleGoToSettings} startIcon={<Settings size={16} />}>
            {t('aiDebate.dialog.configureRoles')}
          </Button>
          <Button onClick={() => setDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleStartDebate}
            variant="contained"
            startIcon={<Play size={16} />}
            disabled={!isConfigValid || !debateQuestion.trim()}
          >
            {t('aiDebate.dialog.startDebate')}
          </Button>
        </DialogActions>
      </BackButtonDialog>
    </>
  );
};

export default AIDebateButton;
