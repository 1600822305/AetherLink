import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  FormControlLabel,
  Switch,
  TextField,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse
} from '@mui/material';
import { Play, Square, FolderOpen, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { CustomIcon } from './icons';
import { useNavigate } from 'react-router-dom';

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
      category: '科技与社会',
      topics: [
        '人工智能是否会取代大部分人类工作？',
        '社交媒体对青少年的影响是利大于弊还是弊大于利？',
        '自动驾驶汽车是否应该全面推广？',
        '远程工作是否应该成为未来工作的主流模式？',
        '虚拟现实技术是否会改变人类的社交方式？'
      ]
    },
    {
      category: '教育与成长',
      topics: [
        '在线教育是否能够完全替代传统课堂教育？',
        '学生是否应该从小学开始学习编程？',
        '考试制度是否是评估学生能力的最佳方式？',
        '家长是否应该限制孩子使用电子设备的时间？',
        '大学教育是否对每个人都是必需的？'
      ]
    },
    {
      category: '环境与可持续发展',
      topics: [
        '个人行为改变是否足以应对气候变化？',
        '核能是否是解决能源危机的最佳方案？',
        '电动汽车是否真的比燃油汽车更环保？',
        '是否应该禁止使用一次性塑料制品？',
        '城市化发展是否有利于环境保护？'
      ]
    },
    {
      category: '经济与商业',
      topics: [
        '基本收入制度是否应该在全球推行？',
        '加密货币是否会取代传统货币？',
        '共享经济模式是否可持续发展？',
        '企业是否应该承担更多的社会责任？',
        '全球化是否对发展中国家有利？'
      ]
    },
    {
      category: '健康与生活',
      topics: [
        '素食主义是否比杂食更健康？',
        '运动是否是保持健康的最重要因素？',
        '心理健康是否应该得到与身体健康同等的重视？',
        '基因编辑技术是否应该用于人类？',
        '传统医学是否有科学依据？'
      ]
    },
    {
      category: '社会与文化',
      topics: [
        '社会应该追求绝对平等还是机会平等？',
        '传统文化是否应该在现代社会中保持不变？',
        '个人隐私权是否应该让位于公共安全？',
        '言论自由是否应该有边界？',
        '多元文化主义是否有利于社会和谐？'
      ]
    }
  ];

  // 加载配置和分组
  useEffect(() => {
    const loadConfig = () => {
      try {
        // 加载当前配置
        const saved = localStorage.getItem('aiDebateConfig');
        if (saved) {
          const parsedConfig = JSON.parse(saved);
          setConfig(parsedConfig);
          setCustomSettings({
            maxRounds: parsedConfig.maxRounds || DEFAULT_CONFIG.MAX_ROUNDS,
            enableModerator: parsedConfig.moderatorEnabled ?? DEFAULT_CONFIG.MODERATOR_ENABLED,
            enableSummary: parsedConfig.summaryEnabled ?? DEFAULT_CONFIG.SUMMARY_ENABLED
          });
        }

        // 加载分组配置
        const savedGroups = localStorage.getItem('aiDebateConfigGroups');
        if (savedGroups) {
          const parsedGroups = JSON.parse(savedGroups);
          setConfigGroups(parsedGroups);
        }
      } catch (error) {
        console.error('加载AI辩论配置失败:', error);
      }
    };
    loadConfig();
  }, []);

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
    navigate('/settings/ai-debate');
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
      // 如果选择"当前配置"，重新加载当前配置
      const saved = localStorage.getItem('aiDebateConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        setConfig(parsedConfig);
        setCustomSettings({
          maxRounds: parsedConfig.maxRounds || DEFAULT_CONFIG.MAX_ROUNDS,
          enableModerator: parsedConfig.moderatorEnabled ?? DEFAULT_CONFIG.MODERATOR_ENABLED,
          enableSummary: parsedConfig.summaryEnabled ?? DEFAULT_CONFIG.SUMMARY_ENABLED
        });
      }
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
        tooltip: '停止AI辩论'
      };
    } else {
      return {
        color: isConfigValid ? 'primary' as const : 'default' as const,
        icon: <CustomIcon name="aiDebate" size={20} color="currentColor" />,
        tooltip: isConfigValid ? '开始AI辩论' : 'AI辩论功能未配置'
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
            disabled={disabled || (!isConfigValid && !isDebating)}
            color={buttonProps.color}
            size="small"
          >
            {buttonProps.icon}
          </IconButton>
        </span>
      </Tooltip>

      {/* 辩论配置对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <CustomIcon name="aiDebate" size={20} color="currentColor" style={{ marginRight: 8 }} />
          AI辩论设置
        </DialogTitle>

        <DialogContent>
          {!isConfigValid ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              AI辩论功能未正确配置。请先配置至少2个辩论角色。
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              已配置 {config?.roles.length} 个辩论角色，准备开始辩论。
            </Alert>
          )}

          {/* 辩论问题输入 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              辩论主题/问题
            </Typography>
            <TextField
              value={debateQuestion}
              onChange={(e) => setDebateQuestion(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="请输入要辩论的主题或问题，或从下方选择预设主题..."
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
                💡 快速选择预设主题
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
                <InputLabel>选择配置分组</InputLabel>
                <Select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  label="选择配置分组"
                >
                  <MenuItem value="">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FolderOpen size={16} style={{ marginRight: 8 }} />
                      当前配置
                    </Box>
                  </MenuItem>
                  {configGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FolderOpen size={16} style={{ marginRight: 8 }} />
                        {group.name}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({group.config.roles.length} 个角色)
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
                参与辩论的角色：
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
            辩论设置：
          </Typography>

          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="最大辩论轮数"
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
              helperText="输入数字，建议1-20轮"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={customSettings.enableModerator}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    enableModerator: e.target.checked
                  })}
                  disabled={!isConfigValid}
                />
              }
              label="启用主持人"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={customSettings.enableSummary}
                  onChange={(e) => setCustomSettings({
                    ...customSettings,
                    enableSummary: e.target.checked
                  })}
                  disabled={!isConfigValid}
                />
              }
              label="生成辩论总结"
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleGoToSettings} startIcon={<Settings size={16} />}>
            配置角色
          </Button>
          <Button onClick={() => setDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleStartDebate}
            variant="contained"
            startIcon={<Play size={16} />}
            disabled={!isConfigValid || !debateQuestion.trim()}
          >
            开始辩论
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AIDebateButton;
