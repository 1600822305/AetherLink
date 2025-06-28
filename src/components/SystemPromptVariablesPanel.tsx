import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  Switch,
  TextField,
  Divider,
  Chip,
  FormControlLabel,
  Collapse,
  IconButton,
  Alert,
  alpha
} from '@mui/material';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon, Clock as AccessTimeIcon, MapPin as LocationOnIcon, Info as InfoIcon, Monitor as ComputerIcon } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../shared/store';
import { updateSettings } from '../shared/store/slices/settingsSlice';
import {
  getCurrentTimeString,
  getLocationString,
  getOperatingSystemString
} from '../shared/utils/systemPromptVariables';
import { useTranslation } from 'react-i18next';

/**
 * 系统提示词变量注入配置面板
 * 允许用户配置在系统提示词中自动注入的变量
 */
const SystemPromptVariablesPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const variableConfig = settings.systemPromptVariables || {
    enableTimeVariable: false,
    enableLocationVariable: false,
    customLocation: '',
    enableOSVariable: false
  };

  // 更新变量配置
  const updateVariableConfig = (updates: Partial<typeof variableConfig>) => {
    dispatch(updateSettings({
      systemPromptVariables: {
        ...variableConfig,
        ...updates
      }
    }));
  };

  // 处理时间变量开关
  const handleTimeVariableToggle = (enabled: boolean) => {
    updateVariableConfig({ enableTimeVariable: enabled });
  };

  // 处理位置变量开关
  const handleLocationVariableToggle = (enabled: boolean) => {
    updateVariableConfig({ enableLocationVariable: enabled });
  };

  // 处理自定义位置输入
  const handleLocationChange = (location: string) => {
    updateVariableConfig({ customLocation: location });
  };

  // 处理操作系统变量开关
  const handleOSVariableToggle = (enabled: boolean) => {
    updateVariableConfig({ enableOSVariable: enabled });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      {/* 面板标题 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          p: 2,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.02),
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04)
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            🔧 {t('settings.agentPrompts.systemPromptVar.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settings.agentPrompts.systemPromptVar.desc')}
          </Typography>
        </Box>

        {/* 状态指示器 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
          {variableConfig.enableTimeVariable && (
            <Chip
              icon={<AccessTimeIcon size={13} />}
              label={t('settings.agentPrompts.systemPromptVar.chip.time')}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          )}
          {variableConfig.enableLocationVariable && (
            <Chip
              icon={<LocationOnIcon size={13} />}
              label={t('settings.agentPrompts.systemPromptVar.chip.location')}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          )}
          {variableConfig.enableOSVariable && (
            <Chip
              icon={<ComputerIcon size={13} />}
              label={t('settings.agentPrompts.systemPromptVar.chip.os')}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          )}
          {!variableConfig.enableTimeVariable && !variableConfig.enableLocationVariable && !variableConfig.enableOSVariable && (
            <Typography variant="caption" color="text.secondary">
              {t('settings.agentPrompts.systemPromptVar.chip.none')}
            </Typography>
          )}
        </Box>

        <IconButton size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* 配置内容 */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {/* 说明信息 */}
          <Alert
            severity="info"
            icon={<InfoIcon />}
            sx={{ mb: 2, fontSize: '0.85rem' }}
          >
            {t('settings.agentPrompts.systemPromptVar.info')}
          </Alert>

          {/* 时间变量配置 */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={variableConfig.enableTimeVariable}
                  onChange={(e) => handleTimeVariableToggle(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    <AccessTimeIcon size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('settings.agentPrompts.systemPromptVar.time.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {t('settings.agentPrompts.systemPromptVar.time.desc', { time: getCurrentTimeString() })}
                  </Typography>
                </Box>
              }
            />

            {variableConfig.enableTimeVariable && (
              <Box sx={{ mt: 1, ml: 4, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('settings.agentPrompts.systemPromptVar.time.tip')}
                </Typography>
              </Box>
            )}
          </Box>

          {/* 位置变量配置 */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={variableConfig.enableLocationVariable}
                  onChange={(e) => handleLocationVariableToggle(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    <LocationOnIcon size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('settings.agentPrompts.systemPromptVar.location.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {t('settings.agentPrompts.systemPromptVar.location.desc', { location: getLocationString(variableConfig.customLocation) })}
                  </Typography>
                </Box>
              }
            />

            {variableConfig.enableLocationVariable && (
              <Box sx={{ mt: 1, ml: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('settings.agentPrompts.systemPromptVar.location.placeholder')}
                  value={variableConfig.customLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('settings.agentPrompts.systemPromptVar.location.tip')}
                    <br />
                    {t('settings.agentPrompts.systemPromptVar.location.tip2')}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          {/* 操作系统变量配置 */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={variableConfig.enableOSVariable}
                  onChange={(e) => handleOSVariableToggle(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    <ComputerIcon size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('settings.agentPrompts.systemPromptVar.os.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {t('settings.agentPrompts.systemPromptVar.os.desc', { os: getOperatingSystemString() })}
                  </Typography>
                </Box>
              }
            />

            {variableConfig.enableOSVariable && (
              <Box sx={{ mt: 1, ml: 4, p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('settings.agentPrompts.systemPromptVar.os.tip')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SystemPromptVariablesPanel;
