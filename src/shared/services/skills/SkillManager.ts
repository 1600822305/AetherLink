/**
 * 技能管理服务
 * 负责技能的 CRUD 操作、初始化和助手关联
 */

import { v4 as uuid } from 'uuid';
import type { Skill } from '../../types/Skill';
import { dexieStorage } from '../storage/DexieStorageService';
import { builtinSkills } from '../../config/builtinSkills/index';
import { parseSkillMarkdown, parseMultipleSkillMarkdowns, skillToMarkdown } from './SkillMarkdownParser';
import { createLogger } from '../infra/logger';
const logger = createLogger('SkillManager');

/** 技能导出格式 */
export interface SkillExportData {
  version: '1.0';
  exportedAt: string;
  skills: Skill[];
}

/** 已启用技能数量上限 */
const MAX_ENABLED_SKILLS = 20;

export class SkillManager {
  /**
   * 初始化内置技能
   * 首次启动或内置技能有更新时调用
   */
  static async initializeBuiltinSkills(): Promise<void> {
    try {
      const existingSkills = await dexieStorage.skills.toArray();
      const existingBuiltinIds = new Set(
        existingSkills.filter(s => s.source === 'builtin').map(s => s.id)
      );

      for (const skill of builtinSkills) {
        if (!existingBuiltinIds.has(skill.id)) {
          await dexieStorage.skills.put(skill);
          logger.debug(`初始化内置技能: ${skill.name}`);
        }
      }
    } catch (error) {
      logger.error('初始化内置技能失败:', error);
    }
  }

  // ========== CRUD ==========

  static async getAllSkills(): Promise<Skill[]> {
    return dexieStorage.skills.toArray();
  }

  static async getEnabledSkills(): Promise<Skill[]> {
    return (await dexieStorage.skills.toArray()).filter(s => s.enabled);
  }

  static async getSkillById(id: string): Promise<Skill | null> {
    const skill = await dexieStorage.skills.get(id);
    return skill || null;
  }

  static async saveSkill(skill: Skill): Promise<boolean> {
    try {
      if (!skill.id) {
        skill.id = uuid();
      }
      skill.updatedAt = new Date().toISOString();
      await dexieStorage.skills.put(skill);
      return true;
    } catch (error) {
      logger.error('保存技能失败:', error);
      return false;
    }
  }

  static async createSkill(data: Partial<Skill>): Promise<Skill | null> {
    try {
      const now = new Date().toISOString();
      const skill: Skill = {
        id: uuid(),
        name: data.name || '新技能',
        description: data.description || '',
        emoji: data.emoji || '🔧',
        tags: data.tags || [],
        content: data.content || '',
        triggerPhrases: data.triggerPhrases || [],
        mcpServerId: data.mcpServerId,
        modelOverride: data.modelOverride,
        temperatureOverride: data.temperatureOverride,
        source: 'user',
        version: '1.0.0',
        author: data.author,
        enabled: data.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      };

      await dexieStorage.skills.put(skill);
      logger.debug(`创建技能: ${skill.name} (${skill.id})`);
      return skill;
    } catch (error) {
      logger.error('创建技能失败:', error);
      return null;
    }
  }

  static async deleteSkill(id: string): Promise<boolean> {
    try {
      const skill = await dexieStorage.skills.get(id);
      if (skill?.source === 'builtin') {
        logger.warn('不能删除内置技能，已改为禁用');
        return this.toggleSkill(id, false);
      }
      await dexieStorage.skills.delete(id);
      logger.debug(`已删除技能: ${id}`);
      return true;
    } catch (error) {
      logger.error('删除技能失败:', error);
      return false;
    }
  }

  static async toggleSkill(id: string, enabled: boolean): Promise<boolean> {
    try {
      // 启用时检查上限
      if (enabled) {
        const enabledCount = (await dexieStorage.skills.toArray()).filter(s => s.enabled).length;
        if (enabledCount >= MAX_ENABLED_SKILLS) {
          logger.warn(`已启用技能数量已达上限 (${MAX_ENABLED_SKILLS})`);
          return false;
        }
      }
      await dexieStorage.skills.update(id, {
        enabled,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      logger.error('切换技能状态失败:', error);
      return false;
    }
  }

  // ========== 助手关联 ==========

  static async getSkillsForAssistant(assistantId: string): Promise<Skill[]> {
    try {
      const assistant = await dexieStorage.getAssistant(assistantId);
      if (!assistant?.skillIds?.length) return [];

      const skills: Skill[] = [];
      for (const skillId of assistant.skillIds) {
        const skill = await dexieStorage.skills.get(skillId);
        if (skill && skill.enabled) {
          skills.push(skill);
        }
      }
      return skills;
    } catch (error) {
      logger.error('获取助手技能失败:', error);
      return [];
    }
  }

  static async bindSkillToAssistant(skillId: string, assistantId: string): Promise<void> {
    try {
      const assistant = await dexieStorage.getAssistant(assistantId);
      if (!assistant) return;

      const skillIds = assistant.skillIds || [];
      if (!skillIds.includes(skillId)) {
        skillIds.push(skillId);
        await dexieStorage.updateAssistant(assistantId, { skillIds });
        logger.debug(`绑定技能 ${skillId} 到助手 ${assistantId}`);
      }
    } catch (error) {
      logger.error('绑定技能失败:', error);
    }
  }

  static async unbindSkillFromAssistant(skillId: string, assistantId: string): Promise<void> {
    try {
      const assistant = await dexieStorage.getAssistant(assistantId);
      if (!assistant) return;

      const skillIds = (assistant.skillIds || []).filter(id => id !== skillId);
      const updates: Record<string, any> = { skillIds };
      // 如果解绑的正好是激活的技能，同时清除 activeSkillId
      if (assistant.activeSkillId === skillId) {
        updates.activeSkillId = null;
      }
      await dexieStorage.updateAssistant(assistantId, updates);
      logger.debug(`解绑技能 ${skillId} 从助手 ${assistantId}`);
    } catch (error) {
      logger.error('解绑技能失败:', error);
    }
  }

  // ========== 激活/停用 ==========

  static async activateSkill(skillId: string, assistantId: string): Promise<boolean> {
    try {
      const skill = await dexieStorage.skills.get(skillId);
      if (!skill || !skill.enabled) return false;

      await dexieStorage.updateAssistant(assistantId, { activeSkillId: skillId });
      logger.debug(`激活技能: ${skill.name} (助手: ${assistantId})`);
      return true;
    } catch (error) {
      logger.error('激活技能失败:', error);
      return false;
    }
  }

  static async deactivateSkill(assistantId: string): Promise<void> {
    try {
      await dexieStorage.updateAssistant(assistantId, { activeSkillId: null });
      logger.debug(`停用当前技能 (助手: ${assistantId})`);
    } catch (error) {
      logger.error('停用技能失败:', error);
    }
  }

  // ========== 导入/导出 ==========

  /**
   * 导出技能为 JSON 数据
   * @param skillIds 要导出的技能 ID 列表，空则导出全部
   */
  static async exportSkills(skillIds?: string[]): Promise<SkillExportData> {
    let skills: Skill[];
    if (skillIds?.length) {
      skills = [];
      for (const id of skillIds) {
        const skill = await dexieStorage.skills.get(id);
        if (skill) skills.push(skill);
      }
    } else {
      skills = await dexieStorage.skills.toArray();
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      skills,
    };
  }

  /**
   * 从 JSON 数据导入技能
   * 导入的技能 source 强制设为 'user'，生成新 ID 避免冲突
   */
  static async importSkills(data: SkillExportData): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    if (!data?.skills?.length) return { imported: 0, skipped: 0 };

    for (const raw of data.skills) {
      try {
        const now = new Date().toISOString();
        const skill: Skill = {
          ...raw,
          id: uuid(),
          source: 'user',
          enabled: true,
          createdAt: now,
          updatedAt: now,
        };
        await dexieStorage.skills.put(skill);
        imported++;
        logger.debug(`导入技能: ${skill.name}`);
      } catch (error) {
        logger.warn(`导入技能失败: ${raw.name}`, error);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // ========== 使用统计 ==========

  /**
   * 记录技能使用（激活次数 +1，更新最近使用时间）
   */
  static async recordSkillUsage(skillId: string): Promise<void> {
    try {
      const skill = await dexieStorage.skills.get(skillId);
      if (!skill) return;

      const usage = (skill as any).usageCount ?? 0;
      await dexieStorage.skills.update(skillId, {
        usageCount: usage + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    } catch (error) {
      logger.warn('记录使用统计失败:', error);
    }
  }

  // ========== 版本管理 ==========

  /**
   * 检查并更新内置技能
   * 对比 builtinSkills 配置与数据库中的版本，有更新则覆盖
   */
  static async upgradeBuiltinSkills(): Promise<number> {
    let upgraded = 0;
    try {
      for (const latest of builtinSkills) {
        const existing = await dexieStorage.skills.get(latest.id);
        if (existing && existing.version !== latest.version) {
          await dexieStorage.skills.put({
            ...latest,
            enabled: existing.enabled, // 保留用户的启用状态
            updatedAt: new Date().toISOString(),
          });
          upgraded++;
          logger.debug(`升级内置技能: ${latest.name} (${existing.version} → ${latest.version})`);
        }
      }
    } catch (error) {
      logger.error('升级内置技能失败:', error);
    }
    return upgraded;
  }

  // ========== SKILL.md 导入导出 ==========

  /**
   * 从 SKILL.md 文本导入单个技能
   */
  static async importFromMarkdown(markdown: string): Promise<Skill | null> {
    try {
      const skill = parseSkillMarkdown(markdown);
      await dexieStorage.skills.put(skill);
      logger.debug(`从 SKILL.md 导入技能: ${skill.name}`);
      return skill;
    } catch (error) {
      logger.error('从 SKILL.md 导入失败:', error);
      return null;
    }
  }

  /**
   * 从多个 .md 文件批量导入技能
   */
  static async importFromMarkdownFiles(
    files: { name: string; content: string }[],
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const { skills, errors } = parseMultipleSkillMarkdowns(files);
    let imported = 0;
    let skipped = 0;

    for (const skill of skills) {
      try {
        await dexieStorage.skills.put(skill);
        imported++;
        logger.debug(`从 SKILL.md 导入技能: ${skill.name}`);
      } catch (error) {
        logger.warn(`导入技能失败: ${skill.name}`, error);
        skipped++;
      }
    }

    return {
      imported,
      skipped: skipped + errors.length,
      errors: errors.map(e => `${e.name}: ${e.error}`),
    };
  }

  /**
   * 将技能导出为 SKILL.md 格式文本
   */
  static exportToMarkdown(skill: Skill): string {
    return skillToMarkdown(skill);
  }
}
