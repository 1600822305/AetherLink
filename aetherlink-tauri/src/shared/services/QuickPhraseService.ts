import { dexieStorage } from './storage/DexieStorageService';
import type { QuickPhrase } from '../types';

/**
 * 快捷短语服务
 * 提供快捷短语的增删改查功能
 */
export class QuickPhraseService {
  /**
   * 获取所有快捷短语
   */
  static async getAll(): Promise<QuickPhrase[]> {
    return await dexieStorage.getAllQuickPhrases();
  }

  /**
   * 获取单个快捷短语
   */
  static async get(id: string): Promise<QuickPhrase | null> {
    return await dexieStorage.getQuickPhrase(id);
  }

  /**
   * 添加快捷短语
   */
  static async add(data: Pick<QuickPhrase, 'title' | 'content'>): Promise<QuickPhrase> {
    return await dexieStorage.addQuickPhrase(data);
  }

  /**
   * 更新快捷短语
   */
  static async update(id: string, data: Pick<QuickPhrase, 'title' | 'content'>): Promise<void> {
    return await dexieStorage.updateQuickPhrase(id, data);
  }

  /**
   * 删除快捷短语
   */
  static async delete(id: string): Promise<void> {
    return await dexieStorage.deleteQuickPhrase(id);
  }

  /**
   * 更新快捷短语顺序
   */
  static async updateOrder(phrases: QuickPhrase[]): Promise<void> {
    return await dexieStorage.updateQuickPhrasesOrder(phrases);
  }

  /**
   * 获取助手的快捷短语
   */
  static getAssistantPhrases(assistant: any): QuickPhrase[] {
    return assistant?.regularPhrases || [];
  }

  /**
   * 更新助手的快捷短语
   */
  static async updateAssistantPhrases(
    assistant: any, 
    phrases: QuickPhrase[], 
    updateAssistantFn: (assistant: any) => Promise<void>
  ): Promise<void> {
    const updatedAssistant = {
      ...assistant,
      regularPhrases: phrases
    };
    await updateAssistantFn(updatedAssistant);
  }

  /**
   * 添加助手快捷短语
   */
  static async addAssistantPhrase(
    assistant: any,
    data: Pick<QuickPhrase, 'title' | 'content'>,
    updateAssistantFn: (assistant: any) => Promise<void>
  ): Promise<QuickPhrase> {
    const now = Date.now();
    const newPhrase: QuickPhrase = {
      id: crypto.randomUUID(),
      title: data.title,
      content: data.content,
      createdAt: now,
      updatedAt: now,
      order: 0
    };

    const existingPhrases = assistant?.regularPhrases || [];
    const updatedPhrases = [newPhrase, ...existingPhrases];

    await this.updateAssistantPhrases(assistant, updatedPhrases, updateAssistantFn);
    return newPhrase;
  }

  /**
   * 删除助手快捷短语
   */
  static async deleteAssistantPhrase(
    assistant: any,
    phraseId: string,
    updateAssistantFn: (assistant: any) => Promise<void>
  ): Promise<void> {
    const existingPhrases = assistant?.regularPhrases || [];
    const updatedPhrases = existingPhrases.filter((phrase: QuickPhrase) => phrase.id !== phraseId);

    await this.updateAssistantPhrases(assistant, updatedPhrases, updateAssistantFn);
  }

  /**
   * 更新助手快捷短语
   */
  static async updateAssistantPhrase(
    assistant: any,
    phraseId: string,
    data: Pick<QuickPhrase, 'title' | 'content'>,
    updateAssistantFn: (assistant: any) => Promise<void>
  ): Promise<void> {
    const existingPhrases = assistant?.regularPhrases || [];
    const updatedPhrases = existingPhrases.map((phrase: QuickPhrase) =>
      phrase.id === phraseId
        ? { ...phrase, ...data, updatedAt: Date.now() }
        : phrase
    );

    await this.updateAssistantPhrases(assistant, updatedPhrases, updateAssistantFn);
  }
}

export default QuickPhraseService;
