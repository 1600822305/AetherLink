import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Alert,
  CircularProgress,
  Link,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  alpha
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { ArrowLeft, ExternalLink, Database, Key, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { notionApiRequest, NotionApiError } from '../../utils/notionApiUtils';
import { useTranslation } from 'react-i18next';

/**
 * Notion设置页面
 * 用于配置Notion集成设置
 */
const NotionSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const notionSettings = useSelector((state: RootState) => state.settings.notion) || {
    enabled: false,
    apiKey: '',
    databaseId: '',
    pageTitleField: 'Name',
    dateField: ''
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  


  const [localSettings, setLocalSettings] = useState(notionSettings);

  const { t } = useTranslation();

  // 监听Redux状态变化并同步到本地状态
  useEffect(() => {
    setLocalSettings(notionSettings);
  }, [notionSettings]);

  const handleBack = () => {
    navigate('/settings');
  };

  // 处理设置变更
  const handleSettingChange = (key: keyof typeof notionSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    dispatch(updateSettings({ notion: newSettings }));
    
    // 清除测试结果
    if (testResult) {
      setTestResult(null);
    }
  };

  // 测试Notion连接
  const testNotionConnection = async () => {
    if (!localSettings.apiKey || !localSettings.databaseId) {
      setTestResult({
        success: false,
        message: t('settings.notion.messages.missingFields')
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // 使用统一的API请求函数
      const data = await notionApiRequest(`/v1/databases/${localSettings.databaseId}`, {
        method: 'GET',
        apiKey: localSettings.apiKey
      });
      
      // 检查页面标题字段是否存在
      const properties = data.properties || {};
      const titleFieldExists = Object.keys(properties).some(key => 
        key === localSettings.pageTitleField && properties[key].type === 'title'
      );

      if (!titleFieldExists) {
        setTestResult({
          success: false,
          message: t('settings.notion.messages.titleFieldMissing', { field: localSettings.pageTitleField })
        });
      } else {
        setTestResult({
          success: true,
          message: t('settings.notion.messages.connectionSuccess', { db: data.title?.[0]?.plain_text || t('common.unknownError') })
        });
      }
    } catch (error) {
      console.error('测试Notion连接失败:', error);
      const message = error instanceof NotionApiError
        ? error.getUserFriendlyMessage()
        : (error instanceof Error ? error.message : '未知错误');

      setTestResult({
        success: false,
        message: t('settings.notion.messages.connectionFailed', { msg: message })
      });
    } finally {
      setTesting(false);
    }
  };



  return (
    <Box sx={{
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: (theme) => theme.palette.mode === 'light'
        ? alpha(theme.palette.primary.main, 0.02)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
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
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              backgroundImage: 'linear-gradient(90deg, #9333EA, #754AB4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t('settings.notion.title')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: { xs: 1, sm: 2 },
          mt: 8,
          '&::-webkit-scrollbar': {
            width: { xs: '4px', sm: '6px' },
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
        }}
      >
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            mb: 3, 
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2 
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Database size={20} style={{ marginRight: 8 }} />
            <Typography variant="h6" component="h3">
              {t('settings.notion.header.title')}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('settings.notion.header.desc')}
            <Link 
              href="https://docs.cherry-ai.com/data-settings/notion" 
              target="_blank" 
              sx={{ ml: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              {t('settings.notion.header.tutorial')}
              <ExternalLink size={14} style={{ marginLeft: 4 }} />
            </Link>
          </Typography>

          {/* 启用开关 */}
          <FormControlLabel
            control={
              <CustomSwitch
                checked={localSettings.enabled}
                onChange={(e) => handleSettingChange('enabled', e.target.checked)}
              />
            }
            label={t('settings.notion.toggle.enable')}
            sx={{ mb: 3 }}
          />

          {/* 配置表单 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: localSettings.enabled ? 1 : 0.5 }}>
            <TextField
              label={t('settings.notion.form.apiKey')}
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => handleSettingChange('apiKey', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.form.apiKeyPlaceholder')}
              helperText={t('settings.notion.form.apiKeyHelper')}
              InputProps={{
                startAdornment: <Key size={16} style={{ marginRight: 8, color: '#666' }} />
              }}
              fullWidth
            />

            <TextField
              label={t('settings.notion.form.databaseId')}
              value={localSettings.databaseId}
              onChange={(e) => handleSettingChange('databaseId', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.form.databaseIdPlaceholder')}
              helperText={t('settings.notion.form.databaseIdHelper')}
              fullWidth
            />

            <TextField
              label={t('settings.notion.form.pageTitle')}
              value={localSettings.pageTitleField}
              onChange={(e) => handleSettingChange('pageTitleField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.form.pageTitlePlaceholder')}
              helperText={t('settings.notion.form.pageTitleHelper')}
              fullWidth
            />

            <TextField
              label={t('settings.notion.form.dateField')}
              value={localSettings.dateField || ''}
              onChange={(e) => handleSettingChange('dateField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.form.dateFieldPlaceholder')}
              helperText={t('settings.notion.form.dateFieldHelper')}
              fullWidth
            />

            {/* 测试连接按钮 */}
            <Button
              variant="outlined"
              onClick={testNotionConnection}
              disabled={!localSettings.enabled || testing || !localSettings.apiKey || !localSettings.databaseId}
              startIcon={testing ? <CircularProgress size={16} /> : <CheckCircle size={16} />}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              {testing ? t('settings.notion.buttons.testing') : t('settings.notion.buttons.test')}
            </Button>

            {/* 测试结果 */}
            {testResult && (
              <Alert 
                severity={testResult.success ? 'success' : 'error'}
                sx={{ mt: 1 }}
              >
                {testResult.message}
              </Alert>
            )}



            {/* CORS 说明 */}
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>{t('settings.notion.corsInfo')}</strong>
                <br />
                {t('settings.notion.corsTips.0')}
                <br />
                {t('settings.notion.corsTips.1')}
                <br />
                {t('settings.notion.corsTips.2')}
                <br />
                {t('settings.notion.corsTips.3')}
                <br />
                {t('settings.notion.corsTips.4')}
                <br />
                <strong>{t('settings.notion.corsTips.5')}</strong>
              </Typography>
            </Alert>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* 配置说明 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.notion.setup.title')}
            </Typography>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.0')} <Link href="https://www.notion.so/my-integrations" target="_blank">Notion Integrations</Link>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.1')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.2')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.3')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.4')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.5')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setup.steps.6')}
                </Typography>
              </li>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default NotionSettingsPage; 