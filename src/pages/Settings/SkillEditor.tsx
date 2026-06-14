/**
 * 技能编辑器页面
 * 编辑技能的名称、描述、指令内容、触发短语等
 *
 * 布局参考 MCPServerDetail：SafeAreaContainer + AppBar + Box(scrollable)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon,
  Save,
  Zap,
  Tag,
  FileText,
  MessageSquare,
  Plug,
} from 'lucide-react';
import type { MCPServer } from '../../shared/types';
import { mcpService } from '../../shared/services/mcp';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../shared/store';
import { loadSkills } from '../../shared/store/slices/skillsSlice';
import { SkillManager } from '../../shared/services/skills/SkillManager';
import type { Skill } from '../../shared/types/Skill';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import { toastManager } from '../../components/EnhancedToast';
import AssistantIconPicker from '../../components/TopicManagement/AssistantTab/AssistantIconPicker';
import { useTranslation } from '../../i18n';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('SkillEditor');

// ========================================================================
// 主组件
// ========================================================================

const SkillEditor: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { skillId } = useParams<{ skillId: string }>();

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单字段
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [triggerInput, setTriggerInput] = useState('');
  const [triggerPhrases, setTriggerPhrases] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mcpServerId, setMcpServerId] = useState<string>('');
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // 加载技能
  useEffect(() => {
    const load = async () => {
      if (!skillId) return;
      setLoading(true);
      const s = await SkillManager.getSkillById(skillId);
      if (s) {
        setSkill(s);
        setName(s.name);
        setEmoji(s.emoji || '');
        setDescription(s.description);
        setContent(s.content);
        setTriggerPhrases(s.triggerPhrases || []);
        setTags(s.tags || []);
        setMcpServerId(s.mcpServerId || '');
      } else {
        toastManager.error('技能不存在');
        navigate('/settings/skills');
      }
      setLoading(false);
    };
    load();
    // 加载 MCP 服务器列表
    mcpService.getServersAsync().then(servers => setMcpServers(servers));
  }, [skillId, navigate]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!skill) return;
    setSaving(true);
    try {
      const updated: Skill = {
        ...skill,
        name: name.trim() || t('settings.skillsSettings.editor.unnamedSkill'),
        emoji: emoji.trim() || '🔧',
        description: description.trim(),
        content,
        triggerPhrases,
        tags,
        mcpServerId: mcpServerId || undefined,
        updatedAt: new Date().toISOString(),
      };
      const success = await SkillManager.saveSkill(updated);
      if (success) {
        setSkill(updated);
        dispatch(loadSkills() as any);
        toastManager.success(t('settings.skillsSettings.editor.saved'));
      } else {
        toastManager.error(t('settings.skillsSettings.editor.saveFailed'));
      }
    } catch (error) {
      logger.error('保存失败:', error);
      toastManager.error(t('settings.skillsSettings.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [skill, name, emoji, description, content, triggerPhrases, tags, mcpServerId, dispatch]);

  // 添加触发短语
  const handleAddTrigger = () => {
    const phrase = triggerInput.trim();
    if (phrase && !triggerPhrases.includes(phrase)) {
      setTriggerPhrases([...triggerPhrases, phrase]);
      setTriggerInput('');
    }
  };

  // 删除触发短语
  const handleDeleteTrigger = (phrase: string) => {
    setTriggerPhrases(triggerPhrases.filter(p => p !== phrase));
  };

  // 添加标签
  const handleAddTag = () => {
    const tag = tagsInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagsInput('');
    }
  };

  // 删除标签
  const handleDeleteTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleBack = () => {
    navigate('/settings/skills');
  };

  const isBuiltin = skill?.source === 'builtin';

  if (loading) {
    return (
      <SafeAreaContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress size={28} />
        </Box>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer>
      {/* 顶部导航栏 - 同 MCPServerDetail */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', height: 56 }}>
          <IconButton
            edge="start"
            onClick={handleBack}
            aria-label="back"
            sx={{ color: 'primary.main' }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 600, fontSize: '1.1rem' }}
            noWrap
          >
            {skill?.emoji} {skill?.name || t('settings.skillsSettings.editor.editSkill')}
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={16} />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('settings.skillsSettings.editor.save')}
          </Button>
        </Toolbar>
      </AppBar>

      {/* 滚动内容区域 - 同 MCPServerDetail */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: 2,
          py: 2,
          pb: 'var(--content-bottom-padding)',
        }}
      >
        {/* 基本信息 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <Zap size={18} />
            {t('settings.skillsSettings.editor.basicInfo')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              <Box
                onClick={() => !isBuiltin && setIconPickerOpen(true)}
                sx={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: isBuiltin ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  ...(!isBuiltin && {
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }),
                }}
              >
                {emoji || '🔧'}
              </Box>
              <TextField
                size="small"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                disabled={isBuiltin}
                placeholder="🔧"
                inputProps={{ style: { fontSize: '1rem', textAlign: 'center', padding: '2px 4px' } }}
                sx={{ width: 48, '& .MuiInputBase-root': { height: 24 } }}
              />
            </Box>
            <TextField
              fullWidth
              size="small"
              label={t('settings.skillsSettings.editor.skillName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isBuiltin}
              sx={{ minWidth: 0 }}
            />
          </Box>

          <AssistantIconPicker
            open={iconPickerOpen}
            onClose={() => setIconPickerOpen(false)}
            onSelectEmoji={(selected) => setEmoji(selected)}
            currentEmoji={emoji}
          />

          <TextField
            fullWidth
            size="small"
            label={t('settings.skillsSettings.editor.descriptionLabel')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            disabled={isBuiltin}
          />

          {isBuiltin && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {t('settings.skillsSettings.editor.builtinReadonly')}
            </Typography>
          )}
        </Paper>

        {/* 技能指令 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <FileText size={18} />
            {t('settings.skillsSettings.editor.instructions')}
          </Typography>

          <TextField
            fullWidth
            size="small"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            minRows={8}
            maxRows={20}
            placeholder={t('settings.skillsSettings.editor.instructionsPlaceholder')}
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                lineHeight: 1.6,
              },
            }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('settings.skillsSettings.editor.instructionsHint')}
          </Typography>
        </Paper>

        {/* 触发短语 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <MessageSquare size={18} />
            {t('settings.skillsSettings.editor.triggerPhrases')}
          </Typography>

          <TextField
            fullWidth
            size="small"
            placeholder={t('settings.skillsSettings.editor.triggerPlaceholder')}
            value={triggerInput}
            onChange={(e) => setTriggerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTrigger();
              }
            }}
            disabled={isBuiltin}
            sx={{ mb: 1.5 }}
          />

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {triggerPhrases.map(phrase => (
              <Chip
                key={phrase}
                label={phrase}
                size="small"
                onDelete={isBuiltin ? undefined : () => handleDeleteTrigger(phrase)}
                sx={{ mb: 0.5 }}
              />
            ))}
            {triggerPhrases.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('settings.skillsSettings.editor.noTriggerPhrases')}
              </Typography>
            )}
          </Box>
        </Paper>

        {/* 标签 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <Tag size={18} />
            {t('settings.skillsSettings.editor.tags')}
          </Typography>

          <TextField
            fullWidth
            size="small"
            placeholder={t('settings.skillsSettings.editor.tagPlaceholder')}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            disabled={isBuiltin}
            sx={{ mb: 1.5 }}
          />

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                onDelete={isBuiltin ? undefined : () => handleDeleteTag(tag)}
                sx={{ mb: 0.5 }}
              />
            ))}
            {tags.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('settings.skillsSettings.editor.noTags')}
              </Typography>
            )}
          </Box>
        </Paper>

        {/* MCP 服务器关联 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <Plug size={18} />
            {t('settings.skillsSettings.editor.mcpServer')}
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel shrink>{t('settings.skillsSettings.editor.selectMcpServer')}</InputLabel>
            <Select
              value={mcpServerId}
              label={t('settings.skillsSettings.editor.selectMcpServer')}
              onChange={(e) => setMcpServerId(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>{t('settings.skillsSettings.editor.mcpNone')}</em>
              </MenuItem>
              {mcpServers.map(server => (
                <MenuItem key={server.id} value={server.id}>
                  {server.name || server.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('settings.skillsSettings.editor.mcpHint')}
          </Typography>
        </Paper>

        {/* 元信息 */}
        {skill && (
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, bgcolor: 'transparent' }} elevation={0}>
            <Typography variant="caption" color="text.secondary">
              {t('settings.skillsSettings.editor.source')}：{skill.source === 'builtin' ? t('settings.skillsSettings.editor.sourceBuiltin') : skill.source === 'user' ? t('settings.skillsSettings.editor.sourceUser') : t('settings.skillsSettings.editor.sourceCommunity')}
              {skill.version && ` | ${t('settings.skillsSettings.editor.version')}：${skill.version}`}
              {skill.author && ` | ${t('settings.skillsSettings.editor.author')}：${skill.author}`}
            </Typography>
            <br />
            <Typography variant="caption" color="text.secondary">
              {t('settings.skillsSettings.editor.created')}：{new Date(skill.createdAt).toLocaleString()}
              {' | '}
              {t('settings.skillsSettings.editor.updated')}：{new Date(skill.updatedAt).toLocaleString()}
            </Typography>
          </Paper>
        )}
      </Box>
    </SafeAreaContainer>
  );
};

export default SkillEditor;
