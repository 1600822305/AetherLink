import { useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { DebateConfig, DebateRole } from '../../../shared/services/AIDebateService';
import { createAssistantMessage } from '../../../shared/utils/messageUtils';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '../../../shared/types/newMessage';

interface UseAIDebateProps {
  onSendMessage: (message: string, images?: any[], toolsEnabled?: boolean, files?: any[]) => void;
  currentTopic: any;
}

export const useAIDebate = ({ onSendMessage, currentTopic }: UseAIDebateProps) => {
  const dispatch = useDispatch();
  const [isDebating, setIsDebating] = useState(false);
  const [currentDebateConfig, setCurrentDebateConfig] = useState<DebateConfig | null>(null);
  const debateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 发送AI消息（作为助手消息）
  const sendAIMessage = useCallback(async (content: string, roleName: string, modelId?: string) => {
    if (!currentTopic) return;

    try {
      // 创建助手消息
      const { message, blocks } = createAssistantMessage({
        assistantId: currentTopic.assistantId || '',
        topicId: currentTopic.id,
        modelId: modelId || 'ai-debate',
        initialContent: content
      });

      // 设置消息状态为成功
      message.status = AssistantMessageStatus.SUCCESS;

      // 更新主文本块的内容和状态
      const mainTextBlock = blocks.find(block => block.type === MessageBlockType.MAIN_TEXT);
      if (mainTextBlock) {
        mainTextBlock.content = content;
        mainTextBlock.status = MessageBlockStatus.SUCCESS;
      }

      // 添加消息到Redux store
      dispatch(newMessagesActions.addMessage({
        topicId: currentTopic.id,
        message
      }));
      dispatch(upsertManyBlocks(blocks));

      console.log(`✅ AI消息已发送: ${roleName}`);
    } catch (error) {
      console.error('发送AI消息失败:', error);
    }
  }, [dispatch, currentTopic]);

  // 开始AI辩论
  const handleStartDebate = useCallback(async (question: string, config: DebateConfig) => {
    if (!currentTopic || isDebating) {
      return;
    }

    try {
      console.log('🎯 开始AI辩论:', { question, config });

      setIsDebating(true);
      setCurrentDebateConfig(config);

      // 初始化timeout ref为非null值，表示辩论正在进行
      debateTimeoutRef.current = setTimeout(() => {}, 0);

      // 发送辩论开始消息（使用系统消息，不使用当前选择的模型）
      const startMessage = `🎯 **AI辩论开始**\n\n**辩论主题：** ${question}\n\n**参与角色：**\n${config.roles.map(role => `• **${role.name}** (${role.stance === 'pro' ? '正方' : role.stance === 'con' ? '反方' : role.stance === 'neutral' ? '中立' : '主持人'})`).join('\n')}\n\n**最大轮数：** ${config.maxRounds}\n\n---\n\n让我们开始辩论！`;

      await sendAIMessage(startMessage, '系统');

      // 等待一下再开始辩论流程，让开始消息先显示
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 开始辩论流程
      await startDebateFlow(question, config);

    } catch (error) {
      console.error('开始AI辩论失败:', error);
      setIsDebating(false);
      setCurrentDebateConfig(null);
      if (debateTimeoutRef.current) {
        clearTimeout(debateTimeoutRef.current);
        debateTimeoutRef.current = null;
      }
    }
  }, [currentTopic, isDebating, onSendMessage]);

  // 停止AI辩论
  const handleStopDebate = useCallback(async () => {
    console.log('🛑 用户请求停止辩论');

    if (debateTimeoutRef.current) {
      clearTimeout(debateTimeoutRef.current);
      debateTimeoutRef.current = null;
    }

    if (isDebating) {
      setIsDebating(false);
      setCurrentDebateConfig(null);

      // 发送辩论结束消息
      await sendAIMessage('🛑 **AI辩论已停止**\n\n辩论被用户手动终止。', '系统');
    }
  }, [isDebating, sendAIMessage]);

  // 辩论流程
  const startDebateFlow = async (question: string, config: DebateConfig) => {
    let currentRound = 1;
    let currentSpeakerIndex = 0;
    let shouldContinue = true;
    const conversationHistory: string[] = [];

    // 添加初始问题到历史
    conversationHistory.push(`辩论主题：${question}`);

    console.log('🎯 开始AI辩论流程:', { question, maxRounds: config.maxRounds, rolesCount: config.roles.length });

    while (currentRound <= config.maxRounds && shouldContinue) {
      console.log(`📢 第${currentRound}轮开始，共${config.roles.length}个角色`);

      // 遍历所有角色
      for (let i = 0; i < config.roles.length && shouldContinue; i++) {
        const role = config.roles[currentSpeakerIndex];

        console.log(`🎭 ${role.name} 准备发言 (${getRoleStanceText(role.stance)})`);

        try {
          // 构建上下文
          const context = buildDebateContext(question, conversationHistory, currentRound, role);

          // 发送AI请求
          console.log(`🤖 正在请求 ${role.name} 的回应...`);
          const response = await sendAIRequest(role, context);

          if (response && shouldContinue) {
            // 添加到历史记录
            conversationHistory.push(`${role.name}：${response}`);

            // 发送AI消息到聊天界面（作为助手消息）
            const formattedMessage = `**第${currentRound}轮 - ${role.name}** (${getRoleStanceText(role.stance)})\n\n${response}`;
            console.log(`💬 ${role.name} 发言完成，发送AI消息到界面`);
            await sendAIMessage(formattedMessage, role.name, role.modelId);

            // 检查主持人是否建议结束（但至少要进行2轮完整辩论）
            if (role.stance === 'moderator' && currentRound >= 2 && checkEndSuggestion(response)) {
              console.log('🏁 主持人建议结束辩论');
              await new Promise(resolve => setTimeout(resolve, 2000));
              await endDebateWithSummary(question, conversationHistory, config);
              return;
            }

            // 等待一段时间再继续
            console.log(`⏳ 等待3秒后继续...`);
            await new Promise(resolve => {
              debateTimeoutRef.current = setTimeout(resolve, 3000);
            });
          }
        } catch (error) {
          console.error(`❌ 角色 ${role.name} 发言失败:`, error);
        }

        // 移动到下一个发言者
        currentSpeakerIndex = (currentSpeakerIndex + 1) % config.roles.length;

        // 检查是否应该继续（通过ref检查最新状态）
        shouldContinue = debateTimeoutRef.current !== null;
      }

      currentRound++;
      console.log(`✅ 第${currentRound - 1}轮结束`);
    }

    // 如果正常结束（达到最大轮数）
    if (shouldContinue) {
      console.log('🏁 达到最大轮数，结束辩论');
      await endDebateWithSummary(question, conversationHistory, config);
    }
  };

  // 构建辩论上下文
  const buildDebateContext = (question: string, history: string[], round: number, role: DebateRole): string => {
    let context = `你是${role.name}，${role.description}\n\n`;
    context += `${role.systemPrompt}\n\n`;
    context += `当前是第${round}轮辩论。\n\n`;
    context += `辩论主题：${question}\n\n`;

    if (history.length > 1) {
      context += '之前的发言：\n';
      // 只取最近的6条发言避免上下文过长
      const recentHistory = history.slice(-6);
      recentHistory.forEach(item => {
        context += `${item}\n`;
      });
      context += '\n';
    }

    // 为主持人添加特殊指导
    if (role.stance === 'moderator') {
      context += `\n📊 **辩论进度提醒**：\n`;
      context += `- 当前轮数：第${round}轮\n`;
      context += `- 总发言数：${history.length - 1}条\n`;
      if (round < 2) {
        context += `- 状态：辩论刚开始，请推动讨论深入，不要急于结束\n`;
      } else if (round < 3) {
        context += `- 状态：辩论进行中，继续引导各方深入交流\n`;
      } else {
        context += `- 状态：可以考虑是否已充分讨论，必要时可建议结束\n`;
      }
      context += '\n';

      context += `🔚 **重要提醒**：如果你认为辩论已经充分进行，各方观点都得到了充分表达，可以在回应的最后添加专属停止指令：\n`;
      context += `**[DEBATE_END]** - 这是系统识别的结束指令，添加此指令后辩论将立即结束并进入总结阶段。\n\n`;
    }

    context += '请基于你的角色立场和以上内容进行回应，保持专业和理性。回应应该简洁明了，不超过200字。';

    return context;
  };

  // 发送AI请求
  const sendAIRequest = async (role: DebateRole, context: string): Promise<string> => {
    try {
      // 检查角色是否配置了模型
      if (!role.modelId) {
        console.warn(`角色 ${role.name} 未配置模型，使用模拟响应`);
        return getSimulatedResponse(role.stance);
      }

      // 导入API服务
      const { sendChatRequest } = await import('../../../shared/api');

      // 构建消息
      const messages = [{
        role: 'user' as const,
        content: context
      }];

      console.log(`🤖 调用真实AI API - 角色: ${role.name}, 模型: ${role.modelId}`);

      // 调用真实的AI API
      const response = await sendChatRequest({
        messages,
        modelId: role.modelId,
        systemPrompt: role.systemPrompt
      });

      if (response.success && response.content) {
        console.log(`✅ ${role.name} AI响应成功`);
        return response.content;
      } else {
        console.error(`❌ ${role.name} AI响应失败:`, response.error || 'content为空');
        console.log(`[DEBUG] 完整响应对象:`, response);
        return getSimulatedResponse(role.stance);
      }
    } catch (error) {
      console.error(`❌ ${role.name} AI请求异常:`, error);
      return getSimulatedResponse(role.stance);
    }
  };

  // 获取模拟响应（作为备用）
  const getSimulatedResponse = (stance: string): string => {
    const responses = {
      pro: [
        '我认为这个观点是正确的，有充分的证据支持这一立场。从实际效果来看，采用这种方法能够带来显著的积极影响。',
        '支持这个观点的理由很充分。从逻辑角度分析，这是最合理的选择，能够有效解决当前面临的问题。',
        '基于大量的实际案例，我们可以清楚地看到这种做法的积极效果。数据表明这是正确的方向。'
      ],
      con: [
        '我必须指出这个观点存在明显的缺陷。仔细分析会发现，这种做法可能带来意想不到的负面后果。',
        '反对的理由很充分。从风险评估的角度来看，这种方法的潜在危害远大于可能的收益。',
        '虽然表面上看起来合理，但深入分析会发现这种做法在实际执行中会遇到很多困难和问题。'
      ],
      neutral: [
        '从客观角度分析，双方都有合理之处。我们需要更全面地考虑各种因素，寻找平衡点。',
        '让我们理性地看待这个问题。每种观点都有其价值，关键是如何在实践中找到最佳的解决方案。',
        '这个问题确实复杂，需要考虑更多的因素和角度。建议我们从多个维度来评估可行性。'
      ],
      moderator: [
        '感谢各位的精彩发言。让我总结一下目前的主要观点和分歧点，看看是否能找到一些共同点。',
        '讨论很充分，各方都提出了有价值的观点。现在让我们看看是否可以在某些方面达成共识。',
        '基于目前的讨论，我认为各方的观点都得到了充分表达。建议我们可以准备结束这轮辩论了。'
      ]
    };

    const roleResponses = responses[stance as keyof typeof responses] || responses.neutral;
    return roleResponses[Math.floor(Math.random() * roleResponses.length)];
  };

  // 获取角色立场文本
  const getRoleStanceText = (stance: string): string => {
    switch (stance) {
      case 'pro': return '正方';
      case 'con': return '反方';
      case 'neutral': return '中立';
      case 'moderator': return '主持人';
      case 'summary': return '总结';
      default: return '参与者';
    }
  };

  // 检查是否建议结束
  const checkEndSuggestion = (response: string): boolean => {
    // 只检查专属停止指令
    if (response.includes('[DEBATE_END]')) {
      console.log('🔚 检测到专属停止指令 [DEBATE_END]');
      return true;
    }
    return false;
  };

  // 结束辩论并生成总结
  const endDebateWithSummary = async (question: string, history: string[], config: DebateConfig) => {
    if (!config.summaryEnabled) {
      setIsDebating(false);
      setCurrentDebateConfig(null);
      await sendAIMessage('🏁 **AI辩论结束**\n\n感谢各位的精彩辩论！', '系统');
      return;
    }

    try {
      // 生成总结
      const summary = await generateSummary(question, history);

      const finalMessage = `🏁 **AI辩论结束**\n\n## 辩论总结\n\n${summary}\n\n---\n\n感谢各位AI角色的精彩辩论！`;
      await sendAIMessage(finalMessage, '系统');

    } catch (error) {
      console.error('生成辩论总结失败:', error);
      await sendAIMessage('🏁 **AI辩论结束**\n\n辩论已结束，但总结生成失败。', '系统');
    } finally {
      setIsDebating(false);
      setCurrentDebateConfig(null);
    }
  };

  // 生成辩论总结
  const generateSummary = async (question: string, history: string[]): Promise<string> => {
    try {
      console.log('🤖 开始生成AI辩论总结...');

      // 构建总结提示词
      const summaryPrompt = `请对以下AI辩论进行客观、专业的总结分析：

**辩论主题：** ${question}

**完整辩论记录：**
${history.join('\n\n')}

请提供一个结构化的总结，包括：

1. **主要观点梳理**：各方的核心论点和支撑论据
2. **分歧点分析**：双方争议的焦点和根本分歧
3. **论证质量评估**：各方论证的逻辑性和说服力
4. **共识点识别**：可能达成一致的观点或原则
5. **深度思考**：对辩论主题的进一步思考和启发
6. **结论建议**：基于辩论内容的平衡性建议

请保持客观中立，避免偏向任何一方，重点分析论证过程和思维逻辑。`;

      // 导入API服务
      const { sendChatRequest } = await import('../../../shared/api');

      // 优先找总结角色，如果没有则找其他配置了模型的角色
      let summaryRole = currentDebateConfig?.roles?.find(role => role.stance === 'summary' && role.modelId);

      if (!summaryRole) {
        // 如果没有专门的总结角色，找任意一个配置了模型的角色
        summaryRole = currentDebateConfig?.roles?.find(role => role.modelId);
      }

      if (!summaryRole?.modelId) {
        throw new Error('没有找到配置了模型的角色来生成总结');
      }

      console.log(`🤖 使用${summaryRole.stance === 'summary' ? '专门的总结角色' : '辩论角色'} ${summaryRole.modelId} (${summaryRole.name}) 生成总结`);

      // 调用AI生成总结
      const response = await sendChatRequest({
        messages: [{
          role: 'user' as const,
          content: summaryPrompt
        }],
        modelId: summaryRole.modelId,
        systemPrompt: '你是一位专业的辩论分析师，擅长客观分析和总结辩论内容。请提供深入、平衡的分析。'
      });

      if (response.success && response.content) {
        console.log('✅ AI总结生成成功');
        return response.content;
      } else {
        console.error('❌ AI总结生成失败:', response.error);
        throw new Error('AI总结生成失败');
      }
    } catch (error) {
      console.error('生成AI总结时发生错误:', error);

      // 如果AI生成失败，返回基础模板总结
      return `
**辩论主题：** ${question}

**主要观点：**
- 正方强调了积极影响和实际效益
- 反方指出了潜在风险和实施困难
- 中立方提供了平衡的分析视角

**核心分歧：**
双方在实施可行性和长期影响方面存在分歧。

**可能共识：**
各方都认同需要谨慎考虑和充分准备。

**建议：**
建议进一步研究和小规模试点，在实践中验证各方观点。

*注：本总结由于技术原因使用了模板格式，未能调用AI进行深度分析。*
      `.trim();
    }
  };

  return {
    isDebating,
    handleStartDebate,
    handleStopDebate,
    currentDebateConfig
  };
};
