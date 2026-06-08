import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  IconButton,
  AppBar,
  Toolbar,
  Divider
} from '@mui/material';
import { ArrowLeft, Info, Brain, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { ThinkingDisplayStyle } from '../../components/message/blocks/ThinkingBlock';
import ThinkingBlock from '../../components/message/blocks/ThinkingBlock';
import type { ThinkingMessageBlock } from '../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../shared/types/newMessage';
import { useTranslation } from '../../i18n';
import CustomSwitch from '../../components/CustomSwitch';
import { SafeAreaContainer, CARD_STYLES } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';

const ThinkingProcessSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings);

  // 获取思考过程相关设置
  const thinkingDisplayStyle = (settings as any).thinkingDisplayStyle || ThinkingDisplayStyle.COMPACT;
  const thoughtAutoCollapse = (settings as any).thoughtAutoCollapse !== false;
  const thinkingToolInline = (settings as any).thinkingToolInline !== false;

  // 创建预览用的思考块数据
  const previewThinkingBlock: ThinkingMessageBlock = {
    id: 'preview-thinking-block',
    messageId: 'preview-message',
    type: MessageBlockType.THINKING,
    createdAt: new Date(Date.now() - 3500).toISOString(),
    updatedAt: new Date().toISOString(),
    status: MessageBlockStatus.SUCCESS,
    content: t('settings.appearance.thinkingProcess.preview.texts.previewContent'),
    thinking_millsec: 3500
  };

  const handleBack = () => {
    navigate('/settings/appearance');
  };

  // 事件处理函数
  const handleThinkingStyleChange = (event: { target: { value: any } }) => {
    dispatch(updateSettings({
      thinkingDisplayStyle: event.target.value
    }));
  };

  const handleThoughtAutoCollapseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      thoughtAutoCollapse: event.target.checked
    }));
  };

  const handleThinkingToolInlineChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateSettings({
      thinkingToolInline: event.target.checked
    }));
  };

  // 获取样式显示名称的辅助函数
  const getStyleDisplayName = (style: string) => {
    const styleKeyMap: Record<string, string> = {
      [ThinkingDisplayStyle.COMPACT]: 'compact',
      [ThinkingDisplayStyle.FULL]: 'full',
      [ThinkingDisplayStyle.MINIMAL]: 'minimal',
      [ThinkingDisplayStyle.BUBBLE]: 'bubble',
      [ThinkingDisplayStyle.TIMELINE]: 'timeline',
      [ThinkingDisplayStyle.CARD]: 'card',
      [ThinkingDisplayStyle.INLINE]: 'inline',
      [ThinkingDisplayStyle.HIDDEN]: 'hidden',
      [ThinkingDisplayStyle.STREAM]: 'stream',
      [ThinkingDisplayStyle.DOTS]: 'dots',
      [ThinkingDisplayStyle.WAVE]: 'wave',
      [ThinkingDisplayStyle.SIDEBAR]: 'sidebar',
      [ThinkingDisplayStyle.OVERLAY]: 'overlay',
      [ThinkingDisplayStyle.BREADCRUMB]: 'breadcrumb',
      [ThinkingDisplayStyle.FLOATING]: 'floating',
      [ThinkingDisplayStyle.TERMINAL]: 'terminal'
    };
    const key = styleKeyMap[style];
    return key ? t(`settings.appearance.thinkingProcess.display.styles.${key}`) : style;
  };

  return (
    <SafeAreaContainer>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            aria-label="back"
            sx={{
              color: (theme) => theme.palette.primary.main,
            }}
          >
            <ArrowLeft />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 600,
              }}
            >
            {t('settings.appearance.thinkingProcess.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Scrollbar
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
        }}
      >
        {/* 思考过程显示设置 */}
        <Paper elevation={0} sx={CARD_STYLES.elevated}>
          <Box sx={CARD_STYLES.header}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Brain size={20} style={{ marginRight: 8, color: '#9333EA' }} />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.1rem' }
                }}
              >
                {t('settings.appearance.thinkingProcess.display.title')}
              </Typography>
              <Tooltip title={t('settings.appearance.thinkingProcess.display.tooltip')}>
                <IconButton size="small" sx={{ ml: 1 }}>
                  <Info size={16} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
            >
              {t('settings.appearance.thinkingProcess.display.description')}
            </Typography>
          </Box>

          <Divider />

          <Box sx={CARD_STYLES.content}>
            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
              <InputLabel>{t('settings.appearance.thinkingProcess.display.styleLabel')}</InputLabel>
              <Select
                value={thinkingDisplayStyle}
                onChange={handleThinkingStyleChange}
                label={t('settings.appearance.thinkingProcess.display.styleLabel')}
                MenuProps={{
                  disableAutoFocus: true,
                  disableRestoreFocus: true
                }}
              >
                <MenuItem value={ThinkingDisplayStyle.COMPACT}>{t('settings.appearance.thinkingProcess.display.styles.compact')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.FULL}>{t('settings.appearance.thinkingProcess.display.styles.full')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.MINIMAL}>{t('settings.appearance.thinkingProcess.display.styles.minimal')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.BUBBLE}>{t('settings.appearance.thinkingProcess.display.styles.bubble')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.TIMELINE}>{t('settings.appearance.thinkingProcess.display.styles.timeline')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.CARD}>{t('settings.appearance.thinkingProcess.display.styles.card')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.INLINE}>{t('settings.appearance.thinkingProcess.display.styles.inline')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.HIDDEN}>{t('settings.appearance.thinkingProcess.display.styles.hidden')}</MenuItem>
                {/* 2025年新增的先进样式 */}
                <MenuItem value={ThinkingDisplayStyle.STREAM}>{t('settings.appearance.thinkingProcess.display.styles.stream')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.DOTS}>{t('settings.appearance.thinkingProcess.display.styles.dots')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.WAVE}>{t('settings.appearance.thinkingProcess.display.styles.wave')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.SIDEBAR}>{t('settings.appearance.thinkingProcess.display.styles.sidebar')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.OVERLAY}>{t('settings.appearance.thinkingProcess.display.styles.overlay')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.BREADCRUMB}>{t('settings.appearance.thinkingProcess.display.styles.breadcrumb')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.FLOATING}>{t('settings.appearance.thinkingProcess.display.styles.floating')}</MenuItem>
                <MenuItem value={ThinkingDisplayStyle.TERMINAL}>{t('settings.appearance.thinkingProcess.display.styles.terminal')}</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body1">
                {t('settings.appearance.thinkingProcess.display.autoCollapse')}
              </Typography>
              <CustomSwitch
                checked={thoughtAutoCollapse}
                onChange={handleThoughtAutoCollapseChange}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body1">
                  {t('settings.appearance.thinkingProcess.display.toolInline')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem' } }}>
                  {t('settings.appearance.thinkingProcess.display.toolInlineDescription')}
                </Typography>
              </Box>
              <CustomSwitch
                checked={thinkingToolInline}
                onChange={handleThinkingToolInlineChange}
              />
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                lineHeight: 1.5
              }}
            >
              {t('settings.appearance.thinkingProcess.display.instructions.intro')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.compact')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.full')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.minimal')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.bubble')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.timeline')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.card')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.inline')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.hidden')}
              <br />
              <br /><strong>{t('settings.appearance.thinkingProcess.display.instructions.newStylesTitle')}</strong>
              <br />{t('settings.appearance.thinkingProcess.display.instructions.stream')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.dots')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.wave')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.sidebar')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.overlay')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.breadcrumb')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.floating')}
              <br />{t('settings.appearance.thinkingProcess.display.instructions.terminal')}
            </Typography>
          </Box>
        </Paper>

        {/* 实时预览组件 */}
        {thinkingDisplayStyle !== ThinkingDisplayStyle.HIDDEN && (
          <Paper elevation={0} sx={CARD_STYLES.elevated}>
            <Box sx={CARD_STYLES.header}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Eye size={20} style={{ marginRight: 8, color: '#9333EA' }} />
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  {t('settings.appearance.thinkingProcess.preview.title')}
                </Typography>
                <Tooltip title={t('settings.appearance.thinkingProcess.preview.tooltip')}>
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Info size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                {t('settings.appearance.thinkingProcess.preview.description')}
              </Typography>
            </Box>

            <Divider />

            <Box sx={CARD_STYLES.content}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
              >
                {t('settings.appearance.thinkingProcess.preview.currentStyle')}<strong>{getStyleDisplayName(thinkingDisplayStyle)}</strong>
              </Typography>

              {/* 预览思考块 */}
              <Box sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.01)'
              }}>
                <ThinkingBlock block={previewThinkingBlock} />
              </Box>
            </Box>
          </Paper>
        )}

        {/* 底部间距 */}
        <Box sx={{ height: '20px' }} />
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default ThinkingProcessSettings;
