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
        message: '请先填写API密钥和数据库ID'
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
          message: `数据库中未找到标题字段"${localSettings.pageTitleField}"，请检查字段名称是否正确`
        });
      } else {
        setTestResult({
          success: true,
          message: `连接成功！数据库"${data.title?.[0]?.plain_text || '未命名'}"已就绪`
        });
      }
    } catch (error) {
      console.error('测试Notion连接失败:', error);
      const message = error instanceof NotionApiError
        ? error.getUserFriendlyMessage()
        : (error instanceof Error ? error.message : '未知错误');

      setTestResult({
        success: false,
        message: `连接失败: ${message}`
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
            Notion 集成设置
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
              Notion 集成配置
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            配置Notion集成，将对话导出到您的Notion数据库。
            <Link 
              href="https://docs.cherry-ai.com/data-settings/notion" 
              target="_blank" 
              sx={{ ml: 1, display: 'inline-flex', alignItems: 'center' }}
            >
              查看配置教程
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
            label="启用Notion导出"
            sx={{ mb: 3 }}
          />

          {/* 配置表单 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: localSettings.enabled ? 1 : 0.5 }}>
            <TextField
              label="Notion API 密钥"
              type="password"
              value={localSettings.apiKey}
              onChange={(e) => handleSettingChange('apiKey', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder="secret_xxxxxxxxxxxxxxxxxxxxx"
              helperText="在 https://www.notion.so/my-integrations 创建集成并获取API密钥"
              InputProps={{
                startAdornment: <Key size={16} style={{ marginRight: 8, color: '#666' }} />
              }}
              fullWidth
            />

            <TextField
              label="数据库 ID"
              value={localSettings.databaseId}
              onChange={(e) => handleSettingChange('databaseId', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              helperText="从Notion数据库URL中提取的ID部分"
              fullWidth
            />

            <TextField
              label="页面标题字段名"
              value={localSettings.pageTitleField}
              onChange={(e) => handleSettingChange('pageTitleField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder="Name"
              helperText="数据库中用作标题的字段名称，通常是 'Name' 或 '名称'"
              fullWidth
            />

            <TextField
              label="创建日期字段名（可选）"
              value={localSettings.dateField || ''}
              onChange={(e) => handleSettingChange('dateField', e.target.value)}
              disabled={!localSettings.enabled}
              placeholder="创建日期"
              helperText="如果数据库中有日期字段，填入字段名称；留空则不添加日期信息"
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
              {testing ? '测试中...' : '测试连接'}
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
                <strong>关于跨域问题：</strong>
                <br />
                Web端开发环境下已配置代理，可直接使用。移动端应用已配置 CORS 绕过插件。
                <br />
                生产环境下如遇到跨域错误，建议：
                <br />
                1. 使用移动应用版本（自动绕过CORS）
                <br />
                2. 部署时配置服务器代理
                <br />
                3. 使用支持CORS的环境
                <br />
                <strong>注意：</strong>请重启开发服务器以使代理配置生效。
              </Typography>
            </Alert>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* 配置说明 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              配置步骤：
            </Typography>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
              <li>
                <Typography variant="body2">
                  访问 <Link href="https://www.notion.so/my-integrations" target="_blank">Notion Integrations</Link> 创建一个新的集成
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  复制生成的API密钥并填入上方的"Notion API 密钥"字段
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  在Notion中创建一个数据库，并将集成连接到该数据库
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  从数据库URL中复制数据库ID并填入"数据库 ID"字段
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  确认数据库中标题字段的名称，通常是"Name"或"名称"
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  （可选）如果需要添加创建日期，请填入数据库中日期字段的名称
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  点击"测试连接"按钮验证配置是否正确
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