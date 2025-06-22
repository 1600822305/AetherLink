// 简化版本，不使用EventEmitter

// AI辩论角色接口
interface DebateRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId?: string;
  color: string;
  stance: 'pro' | 'con' | 'neutral' | 'moderator' | 'summary';
}

// AI辩论配置接口
interface DebateConfig {
  enabled: boolean;
  maxRounds: number;
  autoEndConditions: {
    consensusReached: boolean;
    maxTokensPerRound: number;
    timeoutMinutes: number;
  };
  roles: DebateRole[];
  moderatorEnabled: boolean;
  summaryEnabled: boolean;
}

// 辩论消息接口
interface DebateMessage {
  id: string;
  roleId: string;
  roleName: string;
  content: string;
  round: number;
  timestamp: number;
  color: string;
  stance: string;
}

// 辩论状态接口
interface DebateState {
  isActive: boolean;
  currentRound: number;
  currentSpeaker: number;
  question: string;
  config: DebateConfig;
  messages: DebateMessage[];
  startTime: number;
  shouldEnd: boolean;
  endReason?: string;
}

class AIDebateService {
  private static instance: AIDebateService;
  private debateState: DebateState | null = null;

  static getInstance(): AIDebateService {
    if (!AIDebateService.instance) {
      AIDebateService.instance = new AIDebateService();
    }
    return AIDebateService.instance;
  }

  // 开始辩论
  async startDebate(question: string, config: DebateConfig): Promise<boolean> {
    try {
      // 检查配置有效性
      if (!config.enabled || config.roles.length < 2) {
        throw new Error('辩论配置无效：需要至少2个角色');
      }

      // 初始化辩论状态
      this.debateState = {
        isActive: true,
        currentRound: 1,
        currentSpeaker: 0,
        question,
        config,
        messages: [],
        startTime: Date.now(),
        shouldEnd: false
      };

      // 开始第一轮辩论
      await this.nextSpeaker();

      return true;
    } catch (error) {
      console.error('开始辩论失败:', error);
      return false;
    }
  }

  // 停止辩论
  stopDebate(reason: string = '用户手动停止'): void {
    if (this.debateState) {
      this.debateState.isActive = false;
      this.debateState.shouldEnd = true;
      this.debateState.endReason = reason;

      // 如果启用了总结，生成总结
      if (this.debateState.config.summaryEnabled) {
        this.generateSummary();
      }

      this.debateState = null;
    }
  }

  // 下一个发言者
  private async nextSpeaker(): Promise<void> {
    if (!this.debateState || !this.debateState.isActive) {
      return;
    }

    const { config, currentRound, currentSpeaker } = this.debateState;
    const roles = config.roles;

    // 检查是否应该结束辩论
    if (this.shouldEndDebate()) {
      this.stopDebate(this.debateState.endReason || '达到结束条件');
      return;
    }

    // 获取当前发言角色
    const currentRole = roles[currentSpeaker];
    if (!currentRole) {
      this.stopDebate('角色配置错误');
      return;
    }

    // 构建上下文
    const context = this.buildContext();

    // 发送AI请求
    try {
      const response = await this.sendAIRequest(currentRole, context);

      if (response) {
        // 添加消息到辩论历史
        const message: DebateMessage = {
          id: `debate_${Date.now()}_${currentRole.id}`,
          roleId: currentRole.id,
          roleName: currentRole.name,
          content: response,
          round: currentRound,
          timestamp: Date.now(),
          color: currentRole.color,
          stance: currentRole.stance
        };

        this.debateState.messages.push(message);

        // 检查主持人是否建议结束
        if (currentRole.stance === 'moderator' && this.checkModeratorEndSuggestion(response)) {
          this.debateState.shouldEnd = true;
          this.debateState.endReason = '主持人建议结束辩论';
        }

        // 移动到下一个发言者
        this.moveToNextSpeaker();

        // 延迟后继续下一个发言者
        setTimeout(() => {
          this.nextSpeaker();
        }, 1000);
      }
    } catch (error) {
      console.error('AI请求失败:', error);
    }
  }

  // 移动到下一个发言者
  private moveToNextSpeaker(): void {
    if (!this.debateState) return;

    const { config } = this.debateState;
    const totalSpeakers = config.roles.length;

    this.debateState.currentSpeaker = (this.debateState.currentSpeaker + 1) % totalSpeakers;

    // 如果回到第一个发言者，增加轮数
    if (this.debateState.currentSpeaker === 0) {
      this.debateState.currentRound++;
    }
  }

  // 检查是否应该结束辩论
  private shouldEndDebate(): boolean {
    if (!this.debateState) return true;

    const { config, currentRound, startTime, shouldEnd } = this.debateState;

    // 用户手动停止或主持人建议停止
    if (shouldEnd) {
      return true;
    }

    // 达到最大轮数
    if (currentRound > config.maxRounds) {
      this.debateState.endReason = `达到最大轮数 ${config.maxRounds}`;
      return true;
    }

    // 超时检查
    const elapsed = Date.now() - startTime;
    const timeoutMs = config.autoEndConditions.timeoutMinutes * 60 * 1000;
    if (elapsed > timeoutMs) {
      this.debateState.endReason = `超时 ${config.autoEndConditions.timeoutMinutes} 分钟`;
      return true;
    }

    return false;
  }

  // 构建上下文
  private buildContext(): string {
    if (!this.debateState) return '';

    const { question, messages, currentRound } = this.debateState;

    let context = `辩论主题：${question}\n\n`;
    context += `当前轮数：第 ${currentRound} 轮\n\n`;

    if (messages.length > 0) {
      context += '之前的发言：\n';
      messages.slice(-6).forEach((msg) => { // 只取最近6条消息避免上下文过长
        context += `${msg.roleName}（${msg.stance}）：${msg.content}\n\n`;
      });
    }

    context += '请基于以上内容进行回应，保持你的角色立场和专业性。';

    return context;
  }

  // 发送AI请求 - 调用实际的消息发送接口
  private async sendAIRequest(role: DebateRole, _context: string): Promise<string> {
    // 这里应该调用实际的AI API，暂时返回模拟响应
    return new Promise((resolve) => {
      setTimeout(() => {
        const responses = {
          pro: [
            '我认为这个观点是正确的，因为有充分的证据支持...',
            '从逻辑角度来看，支持这个立场是合理的...',
            '基于实际案例，我们可以看到积极的效果...'
          ],
          con: [
            '我必须指出这个观点存在明显的缺陷...',
            '反对的理由很充分，因为...',
            '这种做法可能带来负面后果...'
          ],
          neutral: [
            '从客观角度分析，双方都有合理之处...',
            '让我们理性地看待这个问题...',
            '需要考虑更多的因素和角度...'
          ],
          moderator: [
            '感谢各位的精彩发言，让我们总结一下要点...',
            '讨论很充分，是否可以寻找共同点？',
            '基于目前的讨论，我建议我们可以结束这轮辩论了。'
          ],
          summary: [
            '基于以上讨论，我来总结一下各方观点...',
            '让我们回顾一下辩论的主要内容...',
            '综合各方意见，可以得出以下结论...'
          ]
        };

        const roleResponses = responses[role.stance as keyof typeof responses] || responses.neutral;
        const randomResponse = roleResponses[Math.floor(Math.random() * roleResponses.length)];

        resolve(`**${role.name}**：${randomResponse}`);
      }, 2000 + Math.random() * 3000); // 2-5秒随机延迟
    });
  }

  // 检查主持人是否建议结束
  private checkModeratorEndSuggestion(response: string): boolean {
    const endKeywords = ['结束', '总结', '共识', '充分讨论', '可以结束'];
    return endKeywords.some(keyword => response.includes(keyword));
  }

  // 生成辩论总结
  private async generateSummary(): Promise<void> {
    if (!this.debateState) return;

    try {
      // 构建总结上下文
      const summaryContext = this.buildSummaryContext();

      // 这里应该调用AI生成总结
      const summary = await this.generateAISummary(summaryContext);

      console.log('辩论总结:', summary);
    } catch (error) {
      console.error('生成总结失败:', error);
    }
  }

  // 构建总结上下文
  private buildSummaryContext(): string {
    if (!this.debateState) return '';

    const { question, messages } = this.debateState;

    let context = `辩论主题：${question}\n\n`;
    context += '完整辩论记录：\n';

    messages.forEach((msg) => {
      context += `${msg.roleName}（${msg.stance}）：${msg.content}\n\n`;
    });

    context += '\n请对以上辩论进行客观总结，包括：\n';
    context += '1. 主要观点和论据\n';
    context += '2. 双方的核心分歧\n';
    context += '3. 可能的共识点\n';
    context += '4. 建议和结论';

    return context;
  }

  // 生成AI总结
  private async generateAISummary(_context: string): Promise<string> {
    // 这里需要调用实际的AI API生成总结
    // 暂时返回模拟总结
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`
## 辩论总结

### 主要观点
- 正方强调了积极影响和实际效益
- 反方指出了潜在风险和实施困难
- 中立方提供了平衡的分析视角

### 核心分歧
双方在实施可行性和长期影响方面存在分歧。

### 可能共识
各方都认同需要谨慎考虑和充分准备。

### 建议
建议进一步研究和小规模试点，在实践中验证各方观点。
        `);
      }, 3000);
    });
  }

  // 获取当前辩论状态
  getDebateState(): DebateState | null {
    return this.debateState;
  }
}

export default AIDebateService;
export type { DebateRole, DebateConfig, DebateMessage, DebateState };
