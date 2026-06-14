/**
 * 技能管理页面
 * 管理内置技能和自定义技能的启用/禁用/CRUD
 *
 * 布局参考 MCPServerDetail：SafeAreaContainer + AppBar + Box(scrollable)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Paper,
  Chip,
  CircularProgress,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  Checkbox,
} from '@mui/material';
import {
  ArrowLeft as ArrowBackIcon,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Zap,
  ChevronRight,
  Download,
  Upload,
  BarChart3,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../shared/store';
import { loadSkills, toggleSkillEnabled, removeSkill } from '../../shared/store/slices/skillsSlice';
import { SkillManager } from '../../shared/services/skills/SkillManager';
import type { SkillExportData } from '../../shared/services/skills/SkillManager';
import type { Skill } from '../../shared/types/Skill';
import { SafeAreaContainer } from '../../components/settings/SettingComponents';
import { toastManager } from '../../components/EnhancedToast';
import CustomSwitch from '../../components/CustomSwitch';
import { useSkillBinding } from '../../hooks/useSkillBinding';
import { useTranslation } from '../../i18n';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('SkillsSettings');

// ========================================================================
// 主组件
// ========================================================================

const SkillsSettings: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { skills, loading } = useAppSelector(state => state.skills);

  const [searchQuery, setSearchQuery] = useState('');
  const [bindDialogSkill, setBindDialogSkill] = useState<Skill | null>(null);

  const { assistants: availableAssistants, getAssistantsForSkill, getBindCount, toggleSkillForAssistant } = useSkillBinding();

  // 初始化
  useEffect(() => {
    dispatch(loadSkills() as any);
  }, [dispatch]);

  // 按来源分组
  const builtinSkills = skills.filter(s => s.source === 'builtin');
  const userSkills = skills.filter(s => s.source === 'user');

  // 搜索过滤
  const filterSkills = useCallback((list: Skill[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const filteredBuiltin = filterSkills(builtinSkills);
  const filteredUser = filterSkills(userSkills);

  // 切换启用状态
  const handleToggle = async (skill: Skill, enabled: boolean) => {
    const success = await SkillManager.toggleSkill(skill.id, enabled);
    if (success) {
      dispatch(toggleSkillEnabled({ id: skill.id, enabled }));
    } else {
      toastManager.warning(t('settings.skillsSettings.messages.maxEnabled'));
    }
  };

  // 删除技能
  const handleDelete = async (skill: Skill) => {
    if (skill.source === 'builtin') {
      toastManager.warning(t('settings.skillsSettings.messages.builtinCannotDelete'));
      await handleToggle(skill, false);
      return;
    }
    const success = await SkillManager.deleteSkill(skill.id);
    if (success) {
      dispatch(removeSkill(skill.id));
      toastManager.success(t('settings.skillsSettings.messages.deleted'));
    } else {
      toastManager.error(t('settings.skillsSettings.messages.deleteFailed'));
    }
  };

  // 新建技能
  const handleCreate = async () => {
    const skill = await SkillManager.createSkill({
      name: t('settings.skillsSettings.newSkill.name'),
      description: t('settings.skillsSettings.newSkill.description'),
    });
    if (skill) {
      dispatch(loadSkills() as any);
      navigate(`/settings/skills/${skill.id}`);
    } else {
      toastManager.error(t('settings.skillsSettings.messages.createFailed'));
    }
  };

  // 导出全部技能
  const handleExportAll = async () => {
    try {
      const data = await SkillManager.exportSkills();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aetherlink-skills-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toastManager.success(t('settings.skillsSettings.messages.exported', { count: data.skills.length }));
    } catch (error) {
      logger.error('导出失败:', error);
      toastManager.error(t('settings.skillsSettings.messages.exportFailed'));
    }
  };

  // 导入技能（支持 .json 和 .md）
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md';
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const mdFiles = files.filter(f => f.name.endsWith('.md'));
      const jsonFiles = files.filter(f => f.name.endsWith('.json'));

      let totalImported = 0;
      let totalSkipped = 0;

      // 处理 .md 文件（SKILL.md 格式）
      if (mdFiles.length > 0) {
        try {
          const mdContents = await Promise.all(
            mdFiles.map(async f => ({ name: f.name, content: await f.text() }))
          );
          const result = await SkillManager.importFromMarkdownFiles(mdContents);
          totalImported += result.imported;
          totalSkipped += result.skipped;
        } catch (error) {
          logger.error('SKILL.md 导入失败:', error);
        }
      }

      // 处理 .json 文件（原有格式）
      for (const file of jsonFiles) {
        try {
          const text = await file.text();
          const data: SkillExportData = JSON.parse(text);
          if (!data?.skills?.length) {
            totalSkipped++;
            continue;
          }
          const result = await SkillManager.importSkills(data);
          totalImported += result.imported;
          totalSkipped += result.skipped;
        } catch (error) {
          logger.error('JSON 导入失败:', error);
          totalSkipped++;
        }
      }

      dispatch(loadSkills() as any);

      if (totalImported > 0) {
        toastManager.success(
          totalSkipped
            ? t('settings.skillsSettings.messages.importedWithSkipped', { imported: totalImported, skipped: totalSkipped })
            : t('settings.skillsSettings.messages.imported', { imported: totalImported })
        );
      } else {
        toastManager.error(t('settings.skillsSettings.messages.importFailed'));
      }
    };
    input.click();
  };

  // 单个技能导出为 SKILL.md
  const handleExportAsMarkdown = (skill: Skill) => {
    try {
      const md = SkillManager.exportToMarkdown(skill);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skill.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff-_]/g, '_')}.SKILL.md`;
      a.click();
      URL.revokeObjectURL(url);
      toastManager.success(t('settings.skillsSettings.messages.exportedMd', { name: skill.name }));
    } catch (error) {
      logger.error('导出 SKILL.md 失败:', error);
      toastManager.error(t('settings.skillsSettings.messages.exportFailed'));
    }
  };

  // 升级内置技能
  const handleUpgradeBuiltin = async () => {
    const count = await SkillManager.upgradeBuiltinSkills();
    if (count > 0) {
      dispatch(loadSkills() as any);
      toastManager.success(t('settings.skillsSettings.messages.upgraded', { count }));
    } else {
      toastManager.info(t('settings.skillsSettings.messages.allUpToDate'));
    }
  };

  // 刷新
  const handleRefresh = () => {
    dispatch(loadSkills() as any);
  };

  const handleBack = useSmartBack('/settings');

  // 渲染技能卡片
  const renderSkillCard = (skill: Skill) => (
    <Box
      key={skill.id}
      onClick={() => navigate(`/settings/skills/${skill.id}`)}
      sx={{
        p: 1.5,
        mb: 1,
        borderRadius: 1,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        '&:hover': {
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        },
        '&:last-child': { mb: 0 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>
            {skill.emoji || '🔧'}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {skill.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {skill.description}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setBindDialogSkill(skill); }}
            title="绑定助手"
          >
            <Box sx={{ position: 'relative', display: 'flex' }}>
              <Users size={14} />
              {getBindCount(skill.id) > 0 && (
                <Box sx={{
                  position: 'absolute', top: -4, right: -6,
                  bgcolor: 'primary.main', color: 'white',
                  borderRadius: '50%', width: 14, height: 14,
                  fontSize: '0.6rem', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {getBindCount(skill.id)}
                </Box>
              )}
            </Box>
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleExportAsMarkdown(skill); }}
            title={t('settings.skillsSettings.exportAsMd')}
          >
            <Download size={14} />
          </IconButton>
          {skill.source === 'user' && (
            <IconButton
              size="small"
              color="error"
              onClick={(e) => { e.stopPropagation(); handleDelete(skill); }}
            >
              <Trash2 size={16} />
            </IconButton>
          )}
          <CustomSwitch
            checked={skill.enabled}
            onChange={(e) => { e.stopPropagation(); handleToggle(skill, e.target.checked); }}
          />
          <ChevronRight size={16} style={{ opacity: 0.4 }} />
        </Box>
      </Box>

      {/* 标签 + 使用次数 */}
      {((skill.tags && skill.tags.length > 0) || (skill.usageCount != null && skill.usageCount > 0)) && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {skill.tags?.slice(0, 3).map(tag => (
            <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          ))}
          {(skill.usageCount != null && skill.usageCount > 0) && (
            <Chip
              icon={<BarChart3 size={10} />}
              label={`${skill.usageCount}次`}
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }}
            />
          )}
        </Box>
      )}
    </Box>
  );

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
            {t('settings.skillsSettings.title')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton onClick={handleImport} size="small" title={t('settings.skillsSettings.importSkill')}>
              <Upload size={18} />
            </IconButton>
            <IconButton onClick={handleExportAll} size="small" title={t('settings.skillsSettings.exportAll')}>
              <Download size={18} />
            </IconButton>
            <IconButton onClick={handleCreate} size="small" sx={{ color: 'primary.main' }}>
              <Plus size={20} />
            </IconButton>
          </Box>
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
        {/* 搜索栏 */}
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('settings.skillsSettings.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search size={18} style={{ marginRight: 8, opacity: 0.5 }} />,
              }}
            />
            <IconButton onClick={handleRefresh} size="small">
              <RefreshCw size={18} />
            </IconButton>
          </Box>

          {/* 统计 */}
          <Box sx={{ display: 'flex', mt: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              {t('settings.skillsSettings.stats', { total: skills.length, enabled: skills.filter(s => s.enabled).length })}
            </Typography>
            <Button size="small" variant="text" startIcon={<RefreshCw size={14} />} onClick={handleUpgradeBuiltin} sx={{ fontSize: '0.75rem' }}>
              {t('settings.skillsSettings.checkUpdate')}
            </Button>
          </Box>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {/* 内置技能 */}
            {filteredBuiltin.length > 0 && (
              <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem', fontWeight: 600 }}>
                  <Zap size={18} />
                  {t('settings.skillsSettings.builtinSkills')} ({filteredBuiltin.length})
                </Typography>
                <Box sx={{
                  maxHeight: { xs: '45vh', sm: '50vh' },
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {filteredBuiltin.map(renderSkillCard)}
                </Box>
              </Paper>
            )}

            {/* 自定义技能 */}
            <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem', fontWeight: 600 }}>
                <Zap size={18} />
                {t('settings.skillsSettings.customSkills')} ({filteredUser.length})
              </Typography>

              {filteredUser.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('settings.skillsSettings.noCustomSkills')}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Plus size={16} />}
                    onClick={handleCreate}
                  >
                    {t('settings.skillsSettings.createFirst')}
                  </Button>
                </Box>
              ) : (
                <Box sx={{
                  maxHeight: { xs: '45vh', sm: '50vh' },
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {filteredUser.map(renderSkillCard)}
                </Box>
              )}
            </Paper>
          </>
        )}

        {/* 使用教程 */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem', fontWeight: 600 }}>
            {t('settings.skillsSettings.tutorial.title')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('settings.skillsSettings.tutorial.whatIsSkill')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {t('settings.skillsSettings.tutorial.whatIsSkillDesc')}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('settings.skillsSettings.tutorial.quickStart')}
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 1 } }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  <span dangerouslySetInnerHTML={{ __html: t('settings.skillsSettings.tutorial.step1') }} />
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  <span dangerouslySetInnerHTML={{ __html: t('settings.skillsSettings.tutorial.step2') }} />
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  <span dangerouslySetInnerHTML={{ __html: t('settings.skillsSettings.tutorial.step3') }} />
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('settings.skillsSettings.tutorial.advanced')}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.advancedTip1')}
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.advancedTip2')}
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.advancedTip3')}
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.advancedTip4')}
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                🔌 {t('settings.skillsSettings.tutorial.bridgeMode')}
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.bridgeModeTip1')}
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.bridgeModeTip2')}
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {t('settings.skillsSettings.tutorial.bridgeModeTip3')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* 快速绑定助手对话框 */}
      <Dialog
        open={!!bindDialogSkill}
        onClose={() => setBindDialogSkill(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {bindDialogSkill && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '1.2rem' }}>{bindDialogSkill.emoji || '🔧'}</Typography>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                    {t('settings.skillsSettings.bindAssistant')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {bindDialogSkill.name}
                  </Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setBindDialogSkill(null)}>
                <X size={18} />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              {availableAssistants.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  {t('settings.skillsSettings.noAssistants')}
                </Typography>
              ) : (
                <Box sx={{ maxHeight: '50vh', overflowY: 'auto' }}>
                  {getAssistantsForSkill(bindDialogSkill.id).map(info => (
                    <Box
                      key={info.assistantId}
                      onClick={() => toggleSkillForAssistant(bindDialogSkill.id, info.assistantId)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 0.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: info.isBound
                          ? (theme) => theme.palette.mode === 'dark' ? 'rgba(25,118,210,0.12)' : 'rgba(25,118,210,0.06)'
                          : 'transparent',
                        border: info.isBound ? '1px solid' : '1px solid transparent',
                        borderColor: info.isBound ? 'primary.main' : 'transparent',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      <Checkbox size="small" checked={info.isBound} sx={{ p: 0 }} />
                      <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>
                        {info.assistantEmoji || '🤖'}
                      </Typography>
                      <Typography variant="body2" fontWeight={info.isBound ? 600 : 400} sx={{ flex: 1 }} noWrap>
                        {info.assistantName}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </SafeAreaContainer>
  );
};

export default SkillsSettings;
