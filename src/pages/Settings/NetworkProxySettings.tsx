import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  alpha,
  InputAdornment,
  IconButton,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  X,
  Monitor,
  Smartphone,
  Chrome,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from '../../i18n';
import {
  SafeAreaContainer,
  Container,
  HeaderBar,
  YStack,
  SettingGroup,
  Row,
} from '../../components/settings/SettingComponents';
import CustomSwitch from '../../components/CustomSwitch';
import useScrollPosition from '../../hooks/useScrollPosition';
import type { RootState, AppDispatch } from '../../shared/store';
import {
  setProxyEnabled,
  setProxyType,
  setProxyHost,
  setProxyPort,
  setProxyUsername,
  setProxyPassword,
  setProxyBypass,
  testProxyConnection,
  applyGlobalProxy,
  saveNetworkProxySettings,
  loadNetworkProxySettings,
  clearTestResult,
  type ProxyType,
} from '../../shared/store/slices/networkProxySlice';
import { getCorsProxyUrl, setCorsProxyUrl } from '../../shared/utils/universalFetch';

const NetworkProxySettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useTranslation();

  const { containerRef, handleScroll } = useScrollPosition('settings-network-proxy', {
    autoRestore: true,
    restoreDelay: 0,
  });

  // Redux state
  const { globalProxy, isTesting, lastTestResult, isLoaded, status } = useSelector(
    (state: RootState) => state.networkProxy
  );

  // Local state
  const [showPassword, setShowPassword] = useState(false);
  const [testUrl, setTestUrl] = useState('https://www.google.com');
  const [newBypassDomain, setNewBypassDomain] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [corsProxyUrlInput, setCorsProxyUrlInput] = useState(getCorsProxyUrl());

  // 加载设置
  useEffect(() => {
    if (!isLoaded) {
      dispatch(loadNetworkProxySettings());
    }
  }, [dispatch, isLoaded]);

  // 保存设置（防抖）
  const saveSettings = useCallback(() => {
    dispatch(
      saveNetworkProxySettings({
        globalProxy,
        status,
        isTesting: false,
        isLoaded: true,
      })
    );
  }, [dispatch, globalProxy, status]);

  useEffect(() => {
    if (isLoaded) {
      const id = setTimeout(saveSettings, 500);
      return () => clearTimeout(id);
    }
  }, [globalProxy, isLoaded, saveSettings]);

  // ==================== 事件处理 ====================

  const handleBack = () => navigate('/settings');

  const handleToggleEnabled = async () => {
    const newEnabled = !globalProxy.enabled;
    dispatch(setProxyEnabled(newEnabled));
    await dispatch(applyGlobalProxy({ ...globalProxy, enabled: newEnabled }));
  };

  const handleTypeChange = (event: SelectChangeEvent) => {
    dispatch(setProxyType(event.target.value as ProxyType));
    dispatch(clearTestResult());
  };

  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setProxyHost(e.target.value));
    dispatch(clearTestResult());
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') { dispatch(setProxyPort(0)); dispatch(clearTestResult()); return; }
    if (!/^\d+$/.test(value)) return;
    const port = parseInt(value, 10);
    if (port >= 0 && port <= 65535) { dispatch(setProxyPort(port)); dispatch(clearTestResult()); }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setProxyUsername(e.target.value));
    dispatch(clearTestResult());
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setProxyPassword(e.target.value));
    dispatch(clearTestResult());
  };

  // 快速填入 host:port / protocol://host:port
  const handleQuickInput = () => {
    const input = quickInput.trim();
    if (!input) return;

    let host: string;
    let port = 0;
    let type: ProxyType | null = null;

    const protocolMatch = input.match(/^(https?|socks[45]):\/\//i);
    let addressPart = input;

    if (protocolMatch) {
      const protocol = protocolMatch[1].toLowerCase();
      if (protocol === 'http') type = 'http';
      else if (protocol === 'https') type = 'https';
      else if (protocol === 'socks4') type = 'socks4';
      else if (protocol === 'socks5') type = 'socks5';
      addressPart = input.slice(protocolMatch[0].length);
    }

    const lastColon = addressPart.lastIndexOf(':');
    if (lastColon !== -1) {
      host = addressPart.slice(0, lastColon);
      const p = parseInt(addressPart.slice(lastColon + 1), 10);
      if (!isNaN(p) && p >= 1 && p <= 65535) port = p;
    } else {
      host = addressPart;
    }

    if (host) dispatch(setProxyHost(host));
    if (port > 0) dispatch(setProxyPort(port));
    if (type) dispatch(setProxyType(type));
    dispatch(clearTestResult());
    setQuickInput('');
  };

  const handleTestProxy = () => dispatch(testProxyConnection({ config: globalProxy, testUrl }));

  const handleAddBypassDomain = () => {
    const d = newBypassDomain.trim();
    if (d && !globalProxy.bypass?.includes(d)) {
      dispatch(setProxyBypass([...(globalProxy.bypass || []), d]));
      setNewBypassDomain('');
    }
  };

  const handleRemoveBypassDomain = (domain: string) => {
    dispatch(setProxyBypass((globalProxy.bypass || []).filter((d: string) => d !== domain)));
  };

  const handleCorsProxyUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCorsProxyUrlInput(e.target.value);
  };

  const handleCorsProxyUrlBlur = () => {
    const url = corsProxyUrlInput.trim();
    if (url && url !== getCorsProxyUrl()) {
      setCorsProxyUrl(url);
    }
  };

  // 代理类型选项
  const proxyTypeOptions: { value: ProxyType; label: string }[] = [
    { value: 'http', label: 'HTTP' },
    { value: 'https', label: 'HTTPS' },
    { value: 'socks4', label: 'SOCKS4' },
    { value: 'socks5', label: 'SOCKS5' },
  ];

  return (
    <SafeAreaContainer>
      <HeaderBar title={t('settings.networkProxy.title', '网络代理')} onBackPress={handleBack} />
      <Container ref={containerRef} onScroll={handleScroll}>
        <YStack sx={{ gap: 3 }}>

          {/* ==================== 代理开关 ==================== */}
          <SettingGroup title="代理">
            <Row>
              <Box sx={{ flex: 1 }}>
                <Typography>启用代理</Typography>
                <Typography variant="caption" color="text.secondary">
                  {globalProxy.enabled
                    ? `${globalProxy.type.toUpperCase()} ${globalProxy.host}:${globalProxy.port}`
                    : '所有请求直接发送，不经过代理'}
                </Typography>
              </Box>
              <CustomSwitch checked={globalProxy.enabled} onChange={handleToggleEnabled} />
            </Row>
          </SettingGroup>

          {/* ==================== 服务器配置 ==================== */}
          <SettingGroup title="服务器配置">
            <Row>
              <Typography sx={{ minWidth: 80 }}>快速填入</Typography>
              <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="socks5://127.0.0.1:1080"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickInput()}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleQuickInput}
                  disabled={!quickInput.trim()}
                  sx={{ minWidth: 64, textTransform: 'none', flexShrink: 0 }}
                >
                  解析
                </Button>
              </Box>
            </Row>

            <Row>
              <Typography sx={{ flex: 1 }}>协议类型</Typography>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select value={globalProxy.type} onChange={handleTypeChange}>
                  {proxyTypeOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Row>

            <Row>
              <Typography sx={{ minWidth: 80 }}>主机</Typography>
              <TextField
                size="small"
                placeholder="127.0.0.1"
                value={globalProxy.host}
                onChange={handleHostChange}
                sx={{ flex: 1 }}
              />
            </Row>

            <Row>
              <Typography sx={{ minWidth: 80 }}>端口</Typography>
              <TextField
                size="small"
                placeholder="1080"
                value={globalProxy.port || ''}
                onChange={handlePortChange}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                sx={{ flex: 1 }}
              />
            </Row>
          </SettingGroup>

          {/* ==================== 认证信息 ==================== */}
          <SettingGroup title="认证信息（可选）">
            <Row>
              <Typography sx={{ minWidth: 80 }}>用户名</Typography>
              <TextField
                size="small"
                placeholder="可选"
                value={globalProxy.username || ''}
                onChange={handleUsernameChange}
                sx={{ flex: 1 }}
              />
            </Row>

            <Row>
              <Typography sx={{ minWidth: 80 }}>密码</Typography>
              <TextField
                size="small"
                type={showPassword ? 'text' : 'password'}
                placeholder="可选"
                value={globalProxy.password || ''}
                onChange={handlePasswordChange}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Row>
          </SettingGroup>

          {/* ==================== 连接测试 ==================== */}
          <SettingGroup title="连接测试">
            <Row>
              <Typography sx={{ minWidth: 80 }}>测试地址</Typography>
              <TextField
                size="small"
                placeholder="https://www.google.com"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                sx={{ flex: 1 }}
              />
            </Row>

            <Box sx={{ px: 2, pb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleTestProxy}
                disabled={isTesting || !globalProxy.host || !globalProxy.port}
                startIcon={isTesting ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
                sx={{ textTransform: 'none' }}
              >
                {isTesting ? '测试中...' : '测试连接'}
              </Button>

              {lastTestResult && (
                <Alert
                  severity={lastTestResult.success ? 'success' : 'error'}
                  icon={lastTestResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  sx={{ mt: 1.5, borderRadius: 2 }}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {lastTestResult.success ? '连接成功' : '连接失败'}
                  </Typography>
                  {lastTestResult.success && lastTestResult.responseTime && (
                    <Typography variant="caption" color="text.secondary">
                      响应时间: {lastTestResult.responseTime}ms
                    </Typography>
                  )}
                  {lastTestResult.success && lastTestResult.externalIp && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      出口 IP: {lastTestResult.externalIp}
                    </Typography>
                  )}
                  {!lastTestResult.success && lastTestResult.error && (
                    <Typography variant="caption" color="text.secondary">
                      {lastTestResult.error}
                    </Typography>
                  )}
                </Alert>
              )}
            </Box>
          </SettingGroup>

          {/* ==================== 高级设置 ==================== */}
          <SettingGroup title="高级设置">
            <Row>
              <Box sx={{ minWidth: 80, mr: 1 }}>
                <Typography>CORS 代理</Typography>
                <Typography variant="caption" color="text.secondary">
                  Web 端跨域转发
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="http://localhost:8888"
                value={corsProxyUrlInput}
                onChange={handleCorsProxyUrlChange}
                onBlur={handleCorsProxyUrlBlur}
                sx={{ flex: 1 }}
              />
            </Row>

            <Row sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1 }}>
              <Box>
                <Typography>跳过代理</Typography>
                <Typography variant="caption" color="text.secondary">
                  匹配的域名将直接连接，不经过代理
                </Typography>
              </Box>

              {(globalProxy.bypass || []).length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(globalProxy.bypass || []).map((domain: string) => (
                    <Chip
                      key={domain}
                      label={domain}
                      size="small"
                      onDelete={() => handleRemoveBypassDomain(domain)}
                      deleteIcon={<X size={12} />}
                      sx={{ borderRadius: 1.5, height: 24 }}
                    />
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="*.example.com"
                  value={newBypassDomain}
                  onChange={(e) => setNewBypassDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBypassDomain()}
                />
                <IconButton
                  onClick={handleAddBypassDomain}
                  disabled={!newBypassDomain.trim()}
                  size="small"
                  sx={(theme) => ({
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                    borderRadius: 1.5,
                    width: 40,
                    flexShrink: 0,
                  })}
                >
                  <Plus size={18} />
                </IconButton>
              </Box>
            </Row>
          </SettingGroup>

          {/* ==================== 平台说明 ==================== */}
          <Box sx={{ px: 1.5 }}>
            <YStack sx={{ gap: 0.75 }}>
              {[
                { icon: <Monitor size={14} />, label: 'Tauri 桌面端', desc: '原生 HTTP 插件，支持系统代理' },
                { icon: <Smartphone size={14} />, label: 'Capacitor 移动端', desc: 'CorsBypass 插件，支持全局代理' },
                { icon: <Chrome size={14} />, label: 'Web 端', desc: '通过本地 CORS 代理服务器转发请求' },
              ].map((item) => (
                <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                  <Box sx={{ display: 'flex', flexShrink: 0 }}>{item.icon}</Box>
                  <Typography variant="caption" color="text.secondary">
                    <strong>{item.label}</strong> — {item.desc}
                  </Typography>
                </Box>
              ))}
            </YStack>
          </Box>

        </YStack>
      </Container>
    </SafeAreaContainer>
  );
};

export default NetworkProxySettings;
