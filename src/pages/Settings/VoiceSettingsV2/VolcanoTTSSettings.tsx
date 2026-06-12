import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  Button,
  FormControlLabel,
  Divider,
  TextField,
  MenuItem,
  Slider,
  InputAdornment
} from '@mui/material';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TTSManager, type VolcanoTTSConfig, type VolcanoApiVersion, VOLCANO_VOICES, VOLCANO_EMOTIONS, isBigModelVoice, isSeedTts2Voice } from '../../../shared/services/tts-v2';
import { getStorageItem, setStorageItem } from '../../../shared/utils/storage';
import { cssVar } from '../../../shared/utils/cssVariables';
import TTSTestSection from '../../../components/TTS/TTSTestSection';
import CustomSwitch from '../../../components/CustomSwitch';
import { useTranslation } from '../../../i18n';
import { SafeAreaContainer } from '../../../components/settings/SettingComponents';
import FullScreenSelector, { type SelectorGroup } from '../../../components/TTS/FullScreenSelectorSolid';

// 音色分组 (完整版 - 基于官方文档)
const VOICE_GROUPS = {
  '通用场景': ['灿灿2.0', '灿灿', '炀炀', '擎苍2.0', '擎苍', '通用女声2.0', '通用女声', '通用男声', '超自然音色-梓梓2.0', '超自然音色-梓梓', '超自然音色-燃燃2.0', '超自然音色-燃燃'],
  '有声阅读': ['阳光青年', '反卷青年', '通用赘婿', '古风少御', '霸气青叔', '质朴青年', '温柔淑女', '开朗青年', '甜宠少御', '儒雅青年'],
  '智能助手': ['甜美小源', '亲切女声', '知性女声', '诚诚', '童童', '亲切男声'],
  '视频配音': ['译制片男声', '懒小羊', '清新文艺女声', '鸡汤女声', '智慧老者', '慈爱姥姥', '说唱小哥', '活力解说男', '影视解说小帅', '解说小帅-多情感', '影视解说小美', '纨绔青年', '直播一姐', '沉稳解说男', '潇洒青年', '阳光男声', '活泼女声', '小萝莉'],
  '特色音色': ['奶气萌娃', '动漫海绵', '动漫海星', '动漫小新', '天才童声'],
  '广告配音': ['促销男声', '促销女声', '磁性男声'],
  '新闻播报': ['新闻女声', '新闻男声'],
  '教育场景': ['知性姐姐-双语', '温柔小哥'],
  '方言-东北': ['东北老铁', '东北丫头'],
  '方言-西南': ['重庆小伙', '四川甜妹儿', '重庆幺妹儿', '广西表哥'],
  '方言-粤语': ['港剧男神', '广东女仔'],
  '方言-其他': ['西安佟掌柜', '沪上阿姐', '甜美台妹', '台普男声', '相声演员', '乡村企业家', '湖南妹坨', '长沙靓女', '方言灿灿'],
  '美式英语': ['慵懒女声-Ava', '议论女声-Alicia', '情感女声-Lawrence', '美式女声-Amelia', '讲述女声-Amanda', '活力女声-Ariana', '活力男声-Jackson', '天才少女', 'Stefan', '天真萌娃-Lily'],
  '英式英语': ['亲切女声-Anna'],
  '澳洲英语': ['澳洲男声-Henry'],
  '日语': ['元气少女', '萌系少女', '气质女声', '日语男声'],
  '葡萄牙语': ['活力男声-Carlos', '活力女声-葡语'],
  '西班牙语': ['气质御姐-西语'],
  // 豆包大模型音色 (完整版)
  '豆包-通用': ['[豆包]Vivi', '[豆包]灿灿', '[豆包]爽快思思', '[豆包]温暖阿虎', '[豆包]少年梓辛', '[豆包]邻家女孩', '[豆包]渊博小叔', '[豆包]阳光青年', '[豆包]甜美小源', '[豆包]清澈梓梓', '[豆包]邻家男孩', '[豆包]甜美悦悦', '[豆包]心灵鸡汤', '[豆包]解说小明', '[豆包]开朗姐姐', '[豆包]亲切女声', '[豆包]温柔小雅', '[豆包]快乐小东', '[豆包]文静毛毛', '[豆包]悠悠君子', '[豆包]魅力苏菲', '[豆包]阳光阿辰', '[豆包]甜美桃子', '[豆包]清新女声', '[豆包]知性女声', '[豆包]清爽男大', '[豆包]温柔小哥'],
  '豆包-角色扮演': ['[豆包]傲娇霸总', '[豆包]病娇姐姐', '[豆包]妩媚御姐', '[豆包]傲娇女友', '[豆包]冷酷哥哥', '[豆包]成熟姐姐', '[豆包]贴心女友', '[豆包]性感御姐', '[豆包]病娇弟弟', '[豆包]傲慢少爷', '[豆包]腹黑公子', '[豆包]暖心学姐', '[豆包]可爱女生', '[豆包]知性温婉', '[豆包]暖心体贴', '[豆包]开朗轻快', '[豆包]活泼爽朗', '[豆包]率真小伙', '[豆包]温柔文雅', '[豆包]温柔女神', '[豆包]炀炀'],
  '豆包-视频配音': ['[豆包]擎苍', '[豆包]霸气青叔', '[豆包]温柔淑女', '[豆包]儒雅青年', '[豆包]悬疑解说', '[豆包]古风少御', '[豆包]活力小哥', '[豆包]鸡汤妹妹', '[豆包]贴心女声', '[豆包]萌丫头', '[豆包]磁性解说男声', '[豆包]广告解说', '[豆包]少儿故事', '[豆包]天才童声', '[豆包]俏皮女声', '[豆包]懒音绵宝', '[豆包]亮嗓萌仔', '[豆包]暖阳女声'],
  '豆包-IP音色': ['[豆包]猴哥', '[豆包]熊二', '[豆包]佩奇猪', '[豆包]樱桃丸子', '[豆包]武则天', '[豆包]顾姐', '[豆包]四郎', '[豆包]鲁班七号'],
  '豆包-多情感': ['[豆包]冷酷哥哥-多情感', '[豆包]高冷御姐-多情感', '[豆包]傲娇霸总-多情感', '[豆包]邻居阿姨-多情感', '[豆包]儒雅男友-多情感', '[豆包]俊朗男友-多情感', '[豆包]柔美女友-多情感', '[豆包]阳光青年-多情感', '[豆包]爽快思思-多情感', '[豆包]深夜播客'],
  '豆包-英文': ['[豆包]Lauren', '[豆包]Amanda', '[豆包]Adam', '[豆包]Jackson', '[豆包]Emily', '[豆包]Smith', '[豆包]Anna', '[豆包]Sarah', '[豆包]Dryw', '[豆包]Nara', '[豆包]Bruce', '[豆包]Michael', '[豆包]Daisy', '[豆包]Luna', '[豆包]Owen', '[豆包]Lucas', '[豆包]Candice-多情感', '[豆包]Serena-多情感', '[豆包]Glen-多情感', '[豆包]Sylus-多情感'],
  '豆包-客服': ['[豆包]理性圆子', '[豆包]清甜桃桃', '[豆包]清晰小雪', '[豆包]开朗婷婷', '[豆包]温婉珊珊', '[豆包]甜美小雨', '[豆包]灵动欣欣', '[豆包]乖巧可儿', '[豆包]阳光洋洋'],
  '豆包2.0 (仅V3)': ['[豆包2.0]小何', '[豆包2.0]Vivi', '[豆包2.0]云舟', '[豆包2.0]小天', '[豆包2.0]刘飞', '[豆包2.0]魅力苏菲', '[豆包2.0]清新女声', '[豆包2.0]甜美小源', '[豆包2.0]甜美桃子', '[豆包2.0]爽快思思', '[豆包2.0]邻家女孩', '[豆包2.0]少年梓辛', '[豆包2.0]魅力女友', '[豆包2.0]流畅女声', '[豆包2.0]儒雅逸辰', '[豆包2.0]知性灿灿', '[豆包2.0]撒娇学妹', '[豆包2.0]猴哥', '[豆包2.0]佩奇猪'],
};

// V3 高级选项常量
const RESOURCE_ID_OPTIONS = [
  { value: '', labelKey: 'resourceIdAuto' },
  { value: 'volc.service_type.10029', labelKey: 'resourceIdBigtts' },
  { value: 'seed-tts-2.0', labelKey: 'resourceIdSeed2' },
];

const MODEL_OPTIONS = [
  { value: '', labelKey: 'modelDefault' },
  { value: 'seed-tts-1.1', labelKey: 'modelSeed11' },
];

const VolcanoTTSSettings: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ttsManager = useMemo(() => TTSManager.getInstance(), []);
  
  const playCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 状态管理
  const [settings, setSettings] = useState({
    appId: '',
    accessToken: '',
    showAppId: false,
    showAccessToken: false,
    voiceType: 'BV001_streaming',
    voiceName: '通用女声',
    emotion: '',
    speed: 1.0,
    volume: 1.0,
    pitch: 1.0,
    encoding: 'mp3' as 'mp3' | 'ogg_opus' | 'wav' | 'pcm',
    apiVersion: 'auto' as VolcanoApiVersion,
    resourceId: '',
    model: '',
  });

  const [uiState, setUIState] = useState({
    saveError: '',
    isTestPlaying: false,
  });

  const [testText, setTestText] = useState('');
  const [enableTTS, setEnableTTS] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);

  // 全屏选择器状态
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [emotionSelectorOpen, setEmotionSelectorOpen] = useState(false);

  // 将音色分组转换为选择器格式
  const voiceGroups: SelectorGroup[] = useMemo(() => {
    return Object.entries(VOICE_GROUPS).map(([groupName, voices]) => ({
      name: groupName,
      items: voices.map(voiceName => {
        const voiceType = VOLCANO_VOICES[voiceName as keyof typeof VOLCANO_VOICES];
        const compat = voiceType && isSeedTts2Voice(voiceType)
          ? 'V3'
          : voiceType && isBigModelVoice(voiceType) ? 'V1+V3' : 'V1';
        return {
          key: voiceName,
          label: voiceName,
          subLabel: `${voiceType} · ${compat}`,
        };
      }),
    }));
  }, []);

  // 接口版本与音色兼容性检查
  const versionMismatch = useMemo(() => {
    if (settings.apiVersion === 'v1' && isSeedTts2Voice(settings.voiceType)) {
      return t('settings.voice.tabSettings.volcano.versionMismatchV1');
    }
    if (settings.apiVersion === 'v3' && !isBigModelVoice(settings.voiceType)) {
      return t('settings.voice.tabSettings.volcano.versionMismatchV3');
    }
    return '';
  }, [settings.apiVersion, settings.voiceType, t]);

  const showV3Options = settings.apiVersion === 'v3' || settings.apiVersion === 'auto';

  // 情感分组 (完整版)
  const emotionGroups: SelectorGroup[] = useMemo(() => {
    const basicEmotions = ['happy', 'sad', 'angry', 'scare', 'fear', 'hate', 'surprise', 'tear', 'novel_dialog', 'excited', 'coldness', 'neutral', 'depressed'];
    const communicationEmotions = ['pleased', 'sorry', 'annoyed', 'shy', 'tender'];
    const professionalStyles = ['customer_service', 'professional', 'serious', 'assistant', 'advertising', 'news', 'entertainment'];
    const narrativeStyles = ['narrator', 'narrator_immersive', 'storytelling', 'radio', 'chat'];
    const specialStyles = ['comfort', 'lovey-dovey', 'energetic', 'conniving', 'tsundere', 'charming', 'yoga', 'tension', 'magnetic', 'vocal-fry', 'asmr', 'dialect'];
    const englishEmotions = ['warm', 'affectionate', 'authoritative'];

    const createItems = (keys: string[]) => keys
      .filter(key => key in VOLCANO_EMOTIONS)
      .map(key => ({
        key,
        label: VOLCANO_EMOTIONS[key as keyof typeof VOLCANO_EMOTIONS],
        subLabel: key,
      }));

    return [
      { name: '基础情感', items: createItems(basicEmotions) },
      { name: '交流情感', items: createItems(communicationEmotions) },
      { name: '专业风格', items: createItems(professionalStyles) },
      { name: '叙述风格', items: createItems(narrativeStyles) },
      { name: '特色风格', items: createItems(specialStyles) },
      { name: '英文专用', items: createItems(englishEmotions) },
    ];
  }, []);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedAppId = await getStorageItem<string>('volcano_app_id') || '';
        const storedAccessToken = await getStorageItem<string>('volcano_access_token') || '';
        const storedVoiceType = await getStorageItem<string>('volcano_voice_type') || 'BV001_streaming';
        const storedVoiceName = await getStorageItem<string>('volcano_voice_name') || '通用女声';
        const storedEmotion = await getStorageItem<string>('volcano_emotion') || '';
        const storedSpeed = parseFloat(await getStorageItem<string>('volcano_speed') || '1.0');
        const storedVolume = parseFloat(await getStorageItem<string>('volcano_volume') || '1.0');
        const storedPitch = parseFloat(await getStorageItem<string>('volcano_pitch') || '1.0');
        const storedEncoding = (await getStorageItem<string>('volcano_encoding') || 'mp3') as 'mp3' | 'ogg_opus' | 'wav' | 'pcm';
        const storedApiVersion = (await getStorageItem<string>('volcano_api_version') || 'auto') as VolcanoApiVersion;
        const storedResourceId = await getStorageItem<string>('volcano_resource_id') || '';
        const storedModel = await getStorageItem<string>('volcano_model') || '';
        const storedEnableTTS = (await getStorageItem<string>('enable_tts')) !== 'false';
        const storedSelectedTTSService = await getStorageItem<string>('selected_tts_service') || 'siliconflow';

        setSettings({
          appId: storedAppId,
          accessToken: storedAccessToken,
          showAppId: false,
          showAccessToken: false,
          voiceType: storedVoiceType,
          voiceName: storedVoiceName,
          emotion: storedEmotion,
          speed: storedSpeed,
          volume: storedVolume,
          pitch: storedPitch,
          encoding: storedEncoding,
          apiVersion: storedApiVersion,
          resourceId: storedResourceId,
          model: storedModel,
        });

        setEnableTTS(storedEnableTTS);
        setIsEnabled(storedSelectedTTSService === 'volcano');

        // 配置 TTSManager
        ttsManager.configureEngine('volcano', {
          enabled: true,
          appId: storedAppId,
          accessToken: storedAccessToken,
          voiceType: storedVoiceType,
          emotion: storedEmotion,
          speed: storedSpeed,
          volume: storedVolume,
          pitch: storedPitch,
          encoding: storedEncoding,
          apiVersion: storedApiVersion,
          resourceId: storedResourceId,
          model: storedModel,
        } as Partial<VolcanoTTSConfig>);
        
        setTestText(t('settings.voice.volcano.testText'));
      } catch (error) {
        console.error(t('settings.voice.common.loadingError', { service: 'Volcano TTS' }), error);
      }
    };

    loadSettings();
  }, [ttsManager, t]);

  // 保存配置
  const saveConfig = useCallback(async (): Promise<boolean> => {
    try {
      if (isEnabled && !settings.appId.trim()) {
        setUIState(prev => ({
          ...prev,
          saveError: t('settings.voice.volcano.appIdRequired'),
        }));
        return false;
      }

      if (isEnabled && !settings.accessToken.trim()) {
        setUIState(prev => ({
          ...prev,
          saveError: t('settings.voice.volcano.accessTokenRequired'),
        }));
        return false;
      }

      await setStorageItem('volcano_app_id', settings.appId);
      await setStorageItem('volcano_access_token', settings.accessToken);
      await setStorageItem('volcano_voice_type', settings.voiceType);
      await setStorageItem('volcano_voice_name', settings.voiceName);
      await setStorageItem('volcano_emotion', settings.emotion);
      await setStorageItem('volcano_speed', settings.speed.toString());
      await setStorageItem('volcano_volume', settings.volume.toString());
      await setStorageItem('volcano_pitch', settings.pitch.toString());
      await setStorageItem('volcano_encoding', settings.encoding);
      await setStorageItem('volcano_api_version', settings.apiVersion);
      await setStorageItem('volcano_resource_id', settings.resourceId);
      await setStorageItem('volcano_model', settings.model);
      await setStorageItem('enable_tts', enableTTS.toString());

      ttsManager.configureEngine('volcano', {
        enabled: true,
        appId: settings.appId,
        accessToken: settings.accessToken,
        voiceType: settings.voiceType,
        emotion: settings.emotion,
        speed: settings.speed,
        volume: settings.volume,
        pitch: settings.pitch,
        encoding: settings.encoding,
        apiVersion: settings.apiVersion,
        resourceId: settings.resourceId,
        model: settings.model,
      } as Partial<VolcanoTTSConfig>);

      if (isEnabled) {
        await setStorageItem('selected_tts_service', 'volcano');
        ttsManager.setActiveEngine('volcano');
      } else {
        ttsManager.configureEngine('volcano', { enabled: false });
      }

      setUIState(prev => ({ ...prev, saveError: '' }));
      return true;
    } catch (error) {
      console.error(t('settings.voice.common.saveErrorText', { service: 'Volcano TTS' }), error);
      setUIState(prev => ({
        ...prev,
        saveError: t('settings.voice.common.saveError'),
      }));
      return false;
    }
  }, [settings, enableTTS, isEnabled, ttsManager, t]);

  const handleSave = useCallback(async () => {
    const success = await saveConfig();
    if (success) {
      setTimeout(() => navigate('/settings/voice'), 0);
    }
  }, [saveConfig, navigate]);

  const handleEnableChange = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  // 测试 TTS
  const handleTestTTS = useCallback(async () => {
    if (uiState.isTestPlaying) {
      ttsManager.stop();
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    if (!settings.appId) {
      setUIState(prev => ({ ...prev, saveError: t('settings.voice.volcano.appIdRequired') }));
      return;
    }
    if (!settings.accessToken) {
      setUIState(prev => ({ ...prev, saveError: t('settings.voice.volcano.accessTokenRequired') }));
      return;
    }

    setUIState(prev => ({ ...prev, isTestPlaying: true }));

    ttsManager.configureEngine('volcano', {
      enabled: true,
      appId: settings.appId,
      accessToken: settings.accessToken,
      voiceType: settings.voiceType,
      emotion: settings.emotion,
      speed: settings.speed,
      volume: settings.volume,
      pitch: settings.pitch,
      encoding: settings.encoding,
      apiVersion: settings.apiVersion,
      resourceId: settings.resourceId,
      model: settings.model,
    } as Partial<VolcanoTTSConfig>);
    ttsManager.setActiveEngine('volcano');

    const success = await ttsManager.speak(testText);
    if (!success) {
      setUIState(prev => ({ ...prev, isTestPlaying: false }));
      return;
    }

    const checkPlaybackStatus = () => {
      if (!ttsManager.isPlaying) {
        setUIState(prev => ({ ...prev, isTestPlaying: false }));
        if (playCheckIntervalRef.current) {
          clearInterval(playCheckIntervalRef.current);
        }
      }
    };
    
    playCheckIntervalRef.current = setInterval(checkPlaybackStatus, 100);
  }, [settings, testText, ttsManager, uiState.isTestPlaying, t]);

  const handleBack = () => navigate('/settings/voice');

  // 清理
  useEffect(() => {
    return () => {
      if (playCheckIntervalRef.current) {
        clearInterval(playCheckIntervalRef.current);
      }
      if (uiState.isTestPlaying) {
        ttsManager.stop();
      }
    };
  }, [uiState.isTestPlaying, ttsManager]);

  // 主题变量
  const toolbarBg = cssVar('toolbar-bg');
  const toolbarBorder = cssVar('toolbar-border');
  const toolbarShadow = cssVar('toolbar-shadow');
  const textPrimary = cssVar('text-primary');
  const borderDefault = cssVar('border-default');
  const borderSubtle = cssVar('border-subtle');
  const hoverBg = cssVar('hover-bg');
  const bgPaper = cssVar('bg-paper');
  const bgDefault = cssVar('bg-default');
  const primaryColor = cssVar('primary');

  return (
    <SafeAreaContainer sx={{ width: '100vw', overflow: 'hidden', backgroundColor: bgDefault }}>
      {/* 顶部导航栏 */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: toolbarBg,
          color: textPrimary,
          borderBottom: `1px solid ${toolbarBorder}`,
          boxShadow: `0 18px 40px -24px ${toolbarShadow}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 2.5, md: 4 }, gap: { xs: 1, sm: 1.5 } }}>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label={t('settings.voice.back')}
            size="large"
            sx={{
              color: primaryColor,
              mr: { xs: 1, sm: 2 },
              borderRadius: 2,
              border: `1px solid ${borderSubtle}`,
              '&:hover': { backgroundColor: hoverBg, transform: 'translateY(-1px)' },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
            {t('settings.voice.volcano.title')}
          </Typography>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: 2, px: { xs: 2.5, sm: 3 }, py: { xs: 0.9, sm: 1 }, fontWeight: 700 }}>
            {t('settings.voice.common.save')}
          </Button>
        </Toolbar>
      </AppBar>

      {/* 内容区域 */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: 2, pb: 'var(--content-bottom-padding)', px: { xs: 1.5, sm: 2.5, md: 4 } }}>
        <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
          {/* 错误提示 */}
          {uiState.saveError && (
            <Alert severity="error" sx={{ mb: { xs: 1.5, sm: 2 }, borderRadius: { xs: 1, sm: 2 } }}>
              {uiState.saveError}
            </Alert>
          )}

          {/* 配置区域 */}
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, mb: { xs: 2, sm: 3 }, borderRadius: { xs: 2, sm: 2.5 }, border: `1px solid ${borderDefault}`, bgcolor: bgPaper }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              {t('settings.voice.common.apiConfig')}
            </Typography>

            {/* 启用开关 */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={<CustomSwitch checked={isEnabled} onChange={(e) => handleEnableChange(e.target.checked)} />}
                label={t('settings.voice.common.enableService', { name: t('settings.voice.services.volcano.name') })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 4 }}>
                {t('settings.voice.volcano.enableDesc')}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* App ID */}
            <TextField
              fullWidth
              label={t('settings.voice.tabSettings.volcano.appId')}
              placeholder={t('settings.voice.tabSettings.volcano.appIdPlaceholder')}
              value={settings.appId}
              onChange={(e) => setSettings(prev => ({ ...prev, appId: e.target.value }))}
              type={settings.showAppId ? 'text' : 'password'}
              sx={{ mb: 2 }}
              helperText={t('settings.voice.tabSettings.volcano.appIdHelper')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSettings(prev => ({ ...prev, showAppId: !prev.showAppId }))}>
                      {settings.showAppId ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Access Token */}
            <TextField
              fullWidth
              label={t('settings.voice.tabSettings.volcano.accessToken')}
              placeholder={t('settings.voice.tabSettings.volcano.accessTokenPlaceholder')}
              value={settings.accessToken}
              onChange={(e) => setSettings(prev => ({ ...prev, accessToken: e.target.value }))}
              type={settings.showAccessToken ? 'text' : 'password'}
              sx={{ mb: 3 }}
              helperText={t('settings.voice.tabSettings.volcano.accessTokenHelper')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSettings(prev => ({ ...prev, showAccessToken: !prev.showAccessToken }))}>
                      {settings.showAccessToken ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* 接口版本 */}
            <TextField
              fullWidth
              select
              label={t('settings.voice.tabSettings.volcano.apiVersion')}
              value={settings.apiVersion}
              onChange={(e) => setSettings(prev => ({ ...prev, apiVersion: e.target.value as VolcanoApiVersion }))}
              sx={{ mb: 2 }}
              helperText={t('settings.voice.tabSettings.volcano.apiVersionHelper')}
            >
              <MenuItem value="auto">{t('settings.voice.tabSettings.volcano.apiVersionAuto')}</MenuItem>
              <MenuItem value="v1">{t('settings.voice.tabSettings.volcano.apiVersionV1')}</MenuItem>
              <MenuItem value="v3">{t('settings.voice.tabSettings.volcano.apiVersionV3')}</MenuItem>
            </TextField>

            {/* V3 高级选项 */}
            {showV3Options && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mb: 1 }}>
                <TextField
                  fullWidth
                  select
                  label={t('settings.voice.tabSettings.volcano.resourceId')}
                  value={settings.resourceId}
                  onChange={(e) => setSettings(prev => ({ ...prev, resourceId: e.target.value }))}
                  sx={{ mb: 2 }}
                  helperText={t('settings.voice.tabSettings.volcano.resourceIdHelper')}
                >
                  {RESOURCE_ID_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {t(`settings.voice.tabSettings.volcano.${opt.labelKey}`)}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  select
                  label={t('settings.voice.tabSettings.volcano.model')}
                  value={settings.model}
                  onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                  sx={{ mb: 2 }}
                  helperText={t('settings.voice.tabSettings.volcano.modelHelper')}
                >
                  {MODEL_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {t(`settings.voice.tabSettings.volcano.${opt.labelKey}`)}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            )}

            {/* 版本与音色兼容性警告 */}
            {versionMismatch && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                {versionMismatch}
              </Alert>
            )}

            <Divider sx={{ mb: 3 }} />

            {/* 音色选择 - 点击打开全屏选择器 */}
            <TextField
              fullWidth
              label={t('settings.voice.tabSettings.volcano.voice')}
              value={settings.voiceName}
              onClick={() => setVoiceSelectorOpen(true)}
              sx={{ mb: 2, cursor: 'pointer' }}
              helperText={t('settings.voice.tabSettings.volcano.voiceHelper')}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <ChevronRight size={18} />
                  </InputAdornment>
                ),
                sx: { cursor: 'pointer' }
              }}
            />

            {/* 情感选择 - 点击打开全屏选择器 */}
            <TextField
              fullWidth
              label={t('settings.voice.tabSettings.volcano.emotion')}
              value={settings.emotion ? `${VOLCANO_EMOTIONS[settings.emotion as keyof typeof VOLCANO_EMOTIONS]} (${settings.emotion})` : t('settings.voice.tabSettings.volcano.emotionNone')}
              onClick={() => setEmotionSelectorOpen(true)}
              sx={{ mb: 2, cursor: 'pointer' }}
              helperText={t('settings.voice.tabSettings.volcano.emotionHelper')}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <ChevronRight size={18} />
                  </InputAdornment>
                ),
                sx: { cursor: 'pointer' }
              }}
            />

            {/* 音频格式 */}
            <TextField
              fullWidth
              select
              label={t('settings.voice.tabSettings.volcano.encoding')}
              value={settings.encoding}
              onChange={(e) => setSettings(prev => ({ ...prev, encoding: e.target.value as 'mp3' | 'ogg_opus' | 'wav' | 'pcm' }))}
              sx={{ mb: 3 }}
              helperText={t('settings.voice.tabSettings.volcano.encodingHelper')}
            >
              <MenuItem value="mp3">MP3</MenuItem>
              <MenuItem value="ogg_opus">OGG Opus</MenuItem>
              <MenuItem value="wav">WAV</MenuItem>
              <MenuItem value="pcm">PCM</MenuItem>
            </TextField>

            {/* 语音参数 - 简约风格 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 语速 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>语速</Typography>
                <Slider
                  value={settings.speed}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, speed: value as number }))}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ minWidth: 32, fontWeight: 600, color: 'primary.main' }}>
                  {settings.speed.toFixed(1)}
                </Typography>
              </Box>

              {/* 音量 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>音量</Typography>
                <Slider
                  value={settings.volume}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, volume: value as number }))}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ minWidth: 32, fontWeight: 600, color: 'primary.main' }}>
                  {settings.volume.toFixed(1)}
                </Typography>
              </Box>

              {/* 音调 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>音调</Typography>
                <Slider
                  value={settings.pitch}
                  onChange={(_, value) => setSettings(prev => ({ ...prev, pitch: value as number }))}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ minWidth: 32, fontWeight: 600, color: 'primary.main' }}>
                  {settings.pitch.toFixed(1)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* 测试区域 */}
          <TTSTestSection
            testText={testText}
            setTestText={setTestText}
            handleTestTTS={handleTestTTS}
            isTestPlaying={uiState.isTestPlaying}
            enableTTS={enableTTS}
            selectedTTSService="volcano"
            openaiApiKey=""
            azureApiKey=""
            siliconFlowApiKey=""
          />
        </Box>
      </Box>

      {/* 音色全屏选择器 */}
      <FullScreenSelector
        open={voiceSelectorOpen}
        onClose={() => setVoiceSelectorOpen(false)}
        title="选择音色"
        groups={voiceGroups}
        selectedKey={settings.voiceName}
        onSelect={(key) => {
          const voiceType = VOLCANO_VOICES[key as keyof typeof VOLCANO_VOICES];
          setSettings(prev => ({
            ...prev,
            voiceName: key,
            voiceType: voiceType || prev.voiceType,
            emotion: '', // 切换音色时重置情感
          }));
        }}
      />

      {/* 情感全屏选择器 */}
      <FullScreenSelector
        open={emotionSelectorOpen}
        onClose={() => setEmotionSelectorOpen(false)}
        title="选择情感风格"
        groups={emotionGroups}
        selectedKey={settings.emotion}
        onSelect={(key) => {
          setSettings(prev => ({ ...prev, emotion: key }));
        }}
        allowEmpty
        emptyLabel={t('settings.voice.tabSettings.volcano.emotionNone') as string}
      />
    </SafeAreaContainer>
  );
};

export default VolcanoTTSSettings;
