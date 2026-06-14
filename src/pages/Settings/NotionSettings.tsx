import React, { useState, useEffect, useMemo } from 'react';
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
  IconButton
} from '@mui/material';
import CustomSwitch from '../../components/CustomSwitch';
import { ArrowLeft, ExternalLink, Database, Key, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../shared/store';
import { updateSettings } from '../../shared/store/settingsSlice';
import { notionApiRequest, NotionApiError } from '../../utils/notionApiUtils';
import { useTranslation } from '../../i18n';
import useScrollPosition from '../../hooks/useScrollPosition';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import Scrollbar from '../../components/Scrollbar';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('NotionSettings');

/**
 * Notion设置页面
 * 用于配置Notion集成设置
 */
const NotionSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const notionSettingsFromStore = useSelector((state: RootState) => state.settings.notion);
  const notionSettings = useMemo(() => notionSettingsFromStore || {
    enabled: false,
    apiKey: '',
    databaseId: '',
    pageTitleField: 'Name',
    dateField: ''
  }, [notionSettingsFromStore]);

  // 使用滚动位置保存功能
  const {
    containerRef,
    handleScroll
  } = useScrollPosition('settings-notion', {
    autoRestore: true,
    restoreDelay: 0
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  


  const [localSettings, setLocalSettings] = useState(notionSettings);

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
        message: t('settings.notion.testConnection.errorMissingFields')
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
          message: t('settings.notion.testConnection.errorTitleFieldNotFound', {
            field: localSettings.pageTitleField
          })
        });
      } else {
        const dbName = data.title?.[0]?.plain_text || '';
        setTestResult({
          success: true,
          message: dbName
            ? t('settings.notion.testConnection.success', { name: dbName })
            : t('settings.notion.testConnection.successUnknown')
        });
      }
    } catch (error) {
      logger.error('测试Notion连接失败:', error);
      const message = error instanceof NotionApiError
        ? error.getUserFriendlyMessage()
        : (error instanceof Error ? error.message : t('errors.unknownError'));

      setTestResult({
        success: false,
        message: t('settings.notion.testConnection.error', { message })
      });
    } finally {
      setTesting(false);
    }
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
            <ArrowLeft size={20} />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
              sx={{
                flexGrow: 1,
                fontWeight: 600,
              }}
            >
            {t('settings.notion.pageTitle')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Scrollbar
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flexGrow: 1,
          padding: '16px',
          paddingBottom: 'var(--content-bottom-padding)',
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
              {t('settings.notion.configTitle')}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('settings.notion.description')}
            <Link 
              href="https://docs.cherry-ai.com/data-settings/notion" 
              target="_blank" 
              sx={{ ml: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              {t('settings.notion.viewTutorial')}
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
            label={t('settings.notion.enableExport')}
            sx={{ mb: 3 }}
          />

          {/* 配置表单 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: localSettings.enabled ? 1 : 0.5 }}>
            <TextField
              label={t('settings.notion.fields.apiKey.label')}
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => handleSettingChange('apiKey', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.fields.apiKey.placeholder')}
              helperText={t('settings.notion.fields.apiKey.helperText')}
              InputProps={{
                startAdornment: <Key size={16} style={{ marginRight: 8, color: '#666' }} />
              }}
              fullWidth
            />

            <TextField
              label={t('settings.notion.fields.databaseId.label')}
              value={localSettings.databaseId}
              onChange={(e) => handleSettingChange('databaseId', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.fields.databaseId.placeholder')}
              helperText={t('settings.notion.fields.databaseId.helperText')}
              fullWidth
            />

            <TextField
              label={t('settings.notion.fields.pageTitleField.label')}
              value={localSettings.pageTitleField}
              onChange={(e) => handleSettingChange('pageTitleField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.fields.pageTitleField.placeholder')}
              helperText={t('settings.notion.fields.pageTitleField.helperText')}
              fullWidth
            />

            <TextField
              label={t('settings.notion.fields.dateField.label')}
              value={localSettings.dateField || ''}
              onChange={(e) => handleSettingChange('dateField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder={t('settings.notion.fields.dateField.placeholder')}
              helperText={t('settings.notion.fields.dateField.helperText')}
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
              {testing ? t('settings.notion.testConnection.testing') : t('settings.notion.testConnection.button')}
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
                <strong>{t('settings.notion.corsInfo.title')}</strong>
                <br />
                {t('settings.notion.corsInfo.webDev')}
                <br />
                {t('settings.notion.corsInfo.production')}
                <br />
                1. {t('settings.notion.corsInfo.suggestion1')}
                <br />
                2. {t('settings.notion.corsInfo.suggestion2')}
                <br />
                3. {t('settings.notion.corsInfo.suggestion3')}
                <br />
                <strong>{t('settings.notion.corsInfo.note')}</strong>
              </Typography>
            </Alert>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* 配置说明 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.notion.setupSteps.title')}
            </Typography>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step1')}{' '}
                  <Link href="https://www.notion.so/my-integrations" target="_blank">
                    {t('settings.notion.setupSteps.step1Link')}
                  </Link>{' '}
                  {t('settings.notion.setupSteps.step1Suffix')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step2')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step3')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step4')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step5')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step6')}
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  {t('settings.notion.setupSteps.step7')}
                </Typography>
              </li>
            </Box>
          </Box>
        </Paper>
      </Scrollbar>
    </SafeAreaContainer>
  );
};

export default NotionSettingsPage; 