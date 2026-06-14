/**
 * 技能激活标签组件
 * 在聊天输入框上方显示当前助手绑定的技能，点击可激活/取消激活
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Chip, IconButton, Tooltip, useTheme } from '@mui/material';
import { Zap } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../shared/store';
import { updateAssistant } from '../../shared/store/slices/assistantsSlice';
import { SkillManager } from '../../shared/services/skills/SkillManager';
import { mcpService } from '../../shared/services/mcp';
import { dexieStorage } from '../../shared/services/storage/DexieStorageService';
import type { Skill } from '../../shared/types/Skill';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('SkillActivationTags');

const SkillActivationTags: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const dispatch = useDispatch();

  const currentAssistant = useSelector((state: RootState) => state.assistants.currentAssistant);
  const [boundSkills, setBoundSkills] = useState<Skill[]>([]);
  const [expanded, setExpanded] = useState(false);

  // 记录由技能自动启动的 MCP 服务器 ID 和自动开启的工具总开关
  const skillStartedMcpRef = useRef<{ serverId: string; toolsWasOff: boolean } | null>(null);

  // 加载助手绑定的技能
  const loadBoundSkills = useCallback(async () => {
    if (!currentAssistant?.skillIds?.length) {
      setBoundSkills([]);
      return;
    }
    try {
      const skills = await SkillManager.getSkillsForAssistant(currentAssistant.id);
      setBoundSkills(skills);
    } catch (error) {
      logger.error('[SkillActivationTags] 加载绑定技能失败:', error);
      setBoundSkills([]);
    }
  }, [currentAssistant?.id, currentAssistant?.skillIds]);

  useEffect(() => {
    loadBoundSkills();
  }, [loadBoundSkills]);

  // 切换技能激活状态
  const handleToggleSkill = useCallback(async (skillId: string) => {
    if (!currentAssistant) return;

    const isCurrentlyActive = currentAssistant.activeSkillId === skillId;
    const newActiveSkillId = isCurrentlyActive ? null : skillId;

    try {
      // 持久化到数据库
      await dexieStorage.updateAssistant(currentAssistant.id, {
        activeSkillId: newActiveSkillId,
      });

      // 同步 Redux 状态
      dispatch(updateAssistant({
        ...currentAssistant,
        activeSkillId: newActiveSkillId,
      }));

      const skill = boundSkills.find(s => s.id === skillId);

      if (!isCurrentlyActive && skill) {
        // ===== 激活技能 =====
        SkillManager.recordSkillUsage(skillId);

        // MCP 联动：自动启动关联的 MCP 服务器
        if (skill.mcpServerId) {
          try {
            const toolsEnabledVal = await dexieStorage.getSetting('mcp-tools-enabled');
            const toolsWasOff = toolsEnabledVal !== true;
            const server = await mcpService.getServerByIdAsync(skill.mcpServerId);
            const serverWasInactive = server ? !server.isActive : false;

            if (server && serverWasInactive) {
              await mcpService.toggleServer(skill.mcpServerId, true);
              logger.info(`[SkillActivationTags] 自动启动 MCP 服务器: ${server.name}`);
            }

            // 确保工具总开关开启
            if (toolsWasOff) {
              window.dispatchEvent(new CustomEvent('mcp-tools-toggle', { detail: { enabled: true } }));
              logger.info('[SkillActivationTags] 自动开启 MCP 工具总开关');
            }

            // 通知 MCPToolsButton 刷新服务器列表
            window.dispatchEvent(new CustomEvent('mcp-servers-changed'));

            // 记录自动启动的状态，停用时恢复
            skillStartedMcpRef.current = {
              serverId: skill.mcpServerId,
              toolsWasOff,
            };
          } catch (error) {
            logger.warn('[SkillActivationTags] MCP 服务器自动启动失败:', error);
          }
        }
      } else if (isCurrentlyActive) {
        // ===== 停用技能 =====
        // MCP 联动：恢复之前的状态
        const mcpState = skillStartedMcpRef.current;
        if (mcpState) {
          try {
            // 关闭技能自动启动的 MCP 服务器
            const server = await mcpService.getServerByIdAsync(mcpState.serverId);
            if (server?.isActive) {
              await mcpService.toggleServer(mcpState.serverId, false);
              logger.info(`[SkillActivationTags] 自动关闭 MCP 服务器: ${server.name}`);
            }

            // 如果工具总开关是技能自动打开的，恢复关闭
            if (mcpState.toolsWasOff) {
              window.dispatchEvent(new CustomEvent('mcp-tools-toggle', { detail: { enabled: false } }));
              logger.info('[SkillActivationTags] 自动关闭 MCP 工具总开关（恢复原状态）');
            }

            // 通知 MCPToolsButton 刷新服务器列表
            window.dispatchEvent(new CustomEvent('mcp-servers-changed'));
          } catch (error) {
            logger.warn('[SkillActivationTags] MCP 服务器自动关闭失败:', error);
          }
          skillStartedMcpRef.current = null;
        }
      }

      logger.info(
        `[SkillActivationTags] ${isCurrentlyActive ? '停用' : '激活'}技能: ${skill?.name || skillId}`
      );
    } catch (error) {
      logger.error('[SkillActivationTags] 切换技能激活状态失败:', error);
    }
  }, [currentAssistant, boundSkills, dispatch]);

  // 无绑定技能时不渲染
  if (boundSkills.length === 0) return null;

  const activeSkillId = currentAssistant?.activeSkillId;
  const hasActiveSkill = boundSkills.some(s => s.id === activeSkillId);

  // 有激活技能时自动展开
  const isExpanded = expanded || hasActiveSkill;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5,
        mb: 0.5,
        flexWrap: 'wrap',
      }}
    >
      {/* 闪电图标 — 点击切换技能标签栏显隐 */}
      <Tooltip title={isExpanded ? '收起技能' : '展开技能'} arrow>
        <IconButton
          size="small"
          onClick={() => setExpanded(prev => !prev)}
          sx={{
            width: 26,
            height: 26,
            borderRadius: '6px',
            backgroundColor: isExpanded
              ? (isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.08)')
              : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: isDarkMode
                ? 'rgba(251, 191, 36, 0.25)'
                : 'rgba(217, 119, 6, 0.15)',
            },
          }}
        >
          <Zap
            size={14}
            fill={isExpanded ? (isDarkMode ? 'rgba(251, 191, 36, 0.8)' : 'rgba(217, 119, 6, 0.7)') : 'none'}
            color={isDarkMode ? 'rgba(251, 191, 36, 0.8)' : 'rgba(217, 119, 6, 0.7)'}
          />
        </IconButton>
      </Tooltip>

      {/* 技能标签列表 — 仅在展开时显示 */}
      {isExpanded && boundSkills.map((skill) => {
        const isActive = activeSkillId === skill.id;
        return (
          <Chip
            key={skill.id}
            label={`${skill.emoji || '🔧'} ${skill.name}`}
            size="small"
            onClick={() => handleToggleSkill(skill.id)}
            sx={{
              height: 26,
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.75rem',
              backgroundColor: isActive
                ? (isDarkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.1)')
                : (isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'),
              color: isActive
                ? (isDarkMode ? 'rgba(251, 191, 36, 0.95)' : 'rgba(217, 119, 6, 0.9)')
                : (isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)'),
              border: isActive
                ? `1px solid ${isDarkMode ? 'rgba(251, 191, 36, 0.4)' : 'rgba(217, 119, 6, 0.3)'}`
                : `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: isActive
                  ? (isDarkMode ? 'rgba(251, 191, 36, 0.25)' : 'rgba(217, 119, 6, 0.15)')
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)'),
              },
              '& .MuiChip-label': {
                px: 1,
              },
            }}
          />
        );
      })}
    </Box>
  );
};

export default SkillActivationTags;
