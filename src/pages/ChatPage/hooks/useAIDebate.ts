import { createLogger } from '../../../shared/services/infra/logger';
const logger = createLogger('useAIDebate');
import { useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { DebateConfig, DebateRole } from '../../../shared/services/ai/AIDebateService';
import { createAssistantMessage } from '../../../shared/utils/messageUtils';
import { newMessagesActions } from '../../../shared/store/slices/newMessagesSlice';
import { upsertManyBlocks } from '../../../shared/store/slices/messageBlocksSlice';
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '../../../shared/types/newMessage';
import type { SiliconFlowImageFormat, ChatTopic } from '../../../shared/types';
import type { Model } from '../../../shared/types';
import { selectProviders } from '../../../shared/store/selectors/settingsSelectors';
import { findModelInProviders } from '../../../shared/utils/modelUtils';
import { TopicService } from '../../../shared/services/topics/TopicService';
import { dexieStorage } from '../../../shared/services/storage/DexieStorageService';
import { flushThrottledUpdates, throttledBlockUpdate } from '../../../shared/store/thunks/message/utils';
import { isAbortError } from '../../../shared/utils/abortController';

interface UseAIDebateProps {
  onSendMessage: (message: string, images?: SiliconFlowImageFormat[], toolsEnabled?: boolean, files?: any[]) => void;
  currentTopic: ChatTopic | null;
}

export const useAIDebate = ({ currentTopic }: UseAIDebateProps) => {
  const dispatch = useDispatch();
  const providers = useSelector(selectProviders);
  const [isDebating, setIsDebating] = useState(false);
  const [currentDebateConfig, setCurrentDebateConfig] = useState<DebateConfig | null>(null);
  const debateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortableDelay = useCallback((ms: number, signal?: AbortSignal) => {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Operation aborted', 'AbortError'));
        return;
      }

      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Operation aborted', 'AbortError'));
      }, { once: true });
    });
  }, []);

  const cleanupDebateRuntime = useCallback(() => {
    if (debateTimeoutRef.current) {
      clearTimeout(debateTimeoutRef.current);
      debateTimeoutRef.current = null;
    }

    abortControllerRef.current = null;

    if (currentTopic?.id) {
      dispatch(newMessagesActions.setTopicLoading({ topicId: currentTopic.id, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId: currentTopic.id, streaming: false }));
    }
  }, [currentTopic?.id, dispatch]);

  // 把 role.modelId（可能是 JSON 身份键）解析为真实的 Model 对象与纯 id
  const resolveRoleModel = useCallback(
    (rawModelId?: string): { modelId: string; model?: Model } => {
      if (!rawModelId) return { modelId: 'ai-debate' };
      const found = findModelInProviders(providers, rawModelId, { includeDisabled: true });
      if (found?.model) {
        return {
          modelId: found.model.id,
          model: { ...found.model, provider: found.provider.id } as Model,
        };
      }
      // 兜底：身份键无法解析时直接用原值（多半就是纯 id）
      return { modelId: rawModelId };
    },
    [providers]
  );

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

      // 先保存到 Dexie，再由 TopicService 同步写入 Redux，保持与普通消息链路一致
      await TopicService.saveMessageAndBlocks(message, blocks);

      logger.debug(`✅ AI消息已发送: ${roleName}`);
    } catch (error) {
      logger.error('发送AI消息失败:', error);
    }
  }, [currentTopic]);

  // 开始AI辩论
  const handleStartDebate = async (question: string, config: DebateConfig) => {
    if (!currentTopic || isDebating) {
      return;
    }

    try {
      logger.debug('🎯 开始AI辩论:', { question, config });

      setIsDebating(true);
      setCurrentDebateConfig(config);

      // 初始化timeout ref为非null值，表示辩论正在进行
      debateTimeoutRef.current = setTimeout(() => {}, 0);

      // 创建 AbortController 用于中断正在进行的请求与轮间等待
      const debateController = new AbortController();
      abortControllerRef.current = debateController;

      // 发送辩论开始消息（使用系统消息，不使用当前选择的模型）
      const startMessage = `🎯 **AI辩论开始**\n\n**辩论主题：** ${question}\n\n**参与角色：**\n${config.roles.map(role => `• **${role.name}** (${role.stance === 'pro' ? '正方' : role.stance === 'con' ? '反方' : role.stance === 'neutral' ? '中立' : '主持人'})`).join('\n')}\n\n**最大轮数：** ${config.maxRounds}\n\n---\n\n让我们开始辩论！`;

      await sendAIMessage(startMessage, '系统');

      // 等待一下再开始辩论流程，让开始消息先显示；该等待必须可中断
      await abortableDelay(1000, debateController.signal);

      // 开始辩论流程
      await startDebateFlow(question, config);

    } catch (error) {
      if (isAbortError(error)) {
        logger.debug('AI辩论启动阶段已被中断');
      } else {
        logger.error('开始AI辩论失败:', error);
      }
      setIsDebating(false);
      setCurrentDebateConfig(null);
      cleanupDebateRuntime();
    }
  };

  // 停止AI辩论
  const handleStopDebate = useCallback(async () => {
    logger.debug('🛑 用户请求停止辩论');

    // 中断正在进行的 AI 请求和等待
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort('user_stop');
    }

    cleanupDebateRuntime();

    if (isDebating) {
      setIsDebating(false);
      setCurrentDebateConfig(null);

      // 发送辩论结束消息
      await sendAIMessage('🛑 **AI辩论已停止**\n\n辩论被用户手动终止。', '系统');
    }
  }, [isDebating, sendAIMessage, cleanupDebateRuntime]);

  // 辩论流程
  const startDebateFlow = async (question: string, config: DebateConfig) => {
    let currentRound = 1;
    let currentSpeakerIndex = 0;
    let shouldContinue = true;
    const conversationHistory: string[] = [];

    // 添加初始问题到历史
    conversationHistory.push(`辩论主题：${question}`);

    logger.debug('🎯 开始AI辩论流程:', { question, maxRounds: config.maxRounds, rolesCount: config.roles.length });

    while (currentRound <= config.maxRounds && shouldContinue) {
      logger.debug(`📢 第${currentRound}轮开始，共${config.roles.length}个角色`);

      // 遍历所有角色
      for (let i = 0; i < config.roles.length && shouldContinue; i++) {
        const role = config.roles[currentSpeakerIndex];

        logger.debug(`🎭 ${role.name} 准备发言 (${getRoleStanceText(role.stance)})`);

        try {
          // 构建上下文
          const context = buildDebateContext(question, conversationHistory, currentRound, role);

          // 发送AI请求
          logger.debug(`🤖 正在请求 ${role.name} 的回应...`);
          const response = await streamRoleResponse(role, currentRound, context);

          if (response) {
            // 添加到历史记录
            conversationHistory.push(`${role.name}：${response}`);
          }

          // 如果在生成过程中被中断，直接跳出
          shouldContinue = debateTimeoutRef.current !== null;
          if (!shouldContinue) {
            break;
          }

          // 检查主持人是否建议结束（但至少要进行2轮完整辩论）
          if (response && role.stance === 'moderator' && currentRound >= 2 && checkEndSuggestion(response)) {
            logger.debug('🏁 主持人建议结束辩论');
            await abortableDelay(2000, abortControllerRef.current?.signal);
            await endDebateWithSummary(question, conversationHistory, config);
            return;
          }

          // 等待一段时间再继续（可中断）
          if (shouldContinue) {
            logger.debug(`⏳ 等待3秒后继续...`);
            try {
              await abortableDelay(3000, abortControllerRef.current?.signal);
            } catch (error) {
              if (isAbortError(error)) {
                shouldContinue = false;
                break;
              }
              throw error;
            }
            shouldContinue = debateTimeoutRef.current !== null;
          }
        } catch (error) {
          if (isAbortError(error)) {
            logger.debug(`🛑 角色 ${role.name} 发言被中断`);
            shouldContinue = false;
            break;
          }
          logger.error(`❌ 角色 ${role.name} 发言失败:`, error);
        }

        // 移动到下一个发言者
        currentSpeakerIndex = (currentSpeakerIndex + 1) % config.roles.length;

        // 检查是否应该继续（通过ref检查最新状态）
        shouldContinue = debateTimeoutRef.current !== null;
      }

      if (!shouldContinue) {
        break;
      }

      currentRound++;
      logger.debug(`✅ 第${currentRound - 1}轮结束`);
    }

    // 如果正常结束（达到最大轮数）
    if (shouldContinue) {
      logger.debug('🏁 达到最大轮数，结束辩论');
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

  // 发送AI请求（支持流式输出）
  const sendAIRequest = async (
    role: DebateRole,
    context: string,
    options?: { onDelta?: (delta: string) => void }
  ): Promise<string> => {
    const emitDelta = (delta: string) => {
      if (!delta) return;
      try {
        options?.onDelta?.(delta);
      } catch (error) {
        logger.error(`⚠️ 推送流式增量失败 (${role.name}):`, error);
      }
    };

    const fallback = () => {
      const simulated = getSimulatedResponse(role.stance);
      emitDelta(simulated);
      return simulated;
    };

    try {
      // 检查角色是否配置了模型
      if (!role.modelId) {
        logger.warn(`角色 ${role.name} 未配置模型，使用模拟响应`);
        return fallback();
      }

      // 导入API服务
      const { sendChatRequest } = await import('../../../shared/api');

      let accumulated = '';
      const signal = abortControllerRef.current?.signal;

      // 调用真实的AI API
      const response = await sendChatRequest({
        messages: [{
          role: 'user' as const,
          content: context
        }],
        modelId: role.modelId,
        systemPrompt: role.systemPrompt,
        abortSignal: signal,
        onChunk: (chunk: string) => {
          if (signal?.aborted) {
            throw new DOMException('Operation aborted', 'AbortError');
          }
          if (!chunk) return;

          if (accumulated && chunk.startsWith(accumulated)) {
            accumulated = chunk;
          } else {
            accumulated += chunk;
          }

          emitDelta(chunk);
        }
      });

      if (signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      const responseContent = response.content ?? '';
      const finalContent = accumulated || responseContent;

      if (!accumulated && response.success && responseContent) {
        emitDelta(responseContent);
      }

      if (response.success && finalContent) {
        logger.debug(`✅ ${role.name} AI响应成功`);
        return finalContent;
      }

      logger.error(`❌ ${role.name} AI响应失败:`, response.error || 'content为空');
      logger.debug(`完整响应对象:`, response);
      return fallback();
    } catch (error) {
      if (isAbortError(error)) {
        logger.debug(`🛑 ${role.name} AI请求已中断`);
        throw error;
      }

      logger.error(`❌ ${role.name} AI请求异常:`, error);
      return fallback();
    }
  };

  // 流式发送辩论消息
  const streamRoleResponse = async (role: DebateRole, round: number, context: string): Promise<string> => {
    if (!currentTopic) {
      logger.warn('当前没有有效的话题，无法发送辩论消息');
      return '';
    }

    const header = `**第${round}轮 - ${role.name}** (${getRoleStanceText(role.stance)})\n\n`;

    // 把角色存储的身份键解析为真实 Model（含 name/provider），
    // 避免气泡头部显示成 {"id":"...","provider":"..."} 的原始 JSON
    const { modelId: resolvedModelId, model: resolvedModel } = resolveRoleModel(role.modelId);

    const { message, blocks } = createAssistantMessage({
      assistantId: currentTopic.assistantId || '',
      topicId: currentTopic.id,
      modelId: resolvedModelId,
      model: resolvedModel,
      initialContent: header,
      status: AssistantMessageStatus.STREAMING
    });

    const mainTextBlock = blocks.find(block => block.type === MessageBlockType.MAIN_TEXT);

    if (!mainTextBlock) {
      logger.warn(`未找到主文本块，角色: ${role.name}`);
      return '';
    }

    // 先保存到 Dexie，再由 TopicService 同步写入 Redux
    await TopicService.saveMessageAndBlocks(message, blocks);
    dispatch(newMessagesActions.setTopicLoading({ topicId: currentTopic.id, loading: true }));
    dispatch(newMessagesActions.setTopicStreaming({ topicId: currentTopic.id, streaming: true }));

    let accumulatedContent = '';

    const updateMessageStatus = (status: AssistantMessageStatus) => {
      const changes = {
        status,
        updatedAt: new Date().toISOString()
      };

      dispatch(newMessagesActions.updateMessage({
        id: message.id,
        changes
      }));

      void dexieStorage.updateMessage(message.id, changes).catch(error => {
        logger.error(`持久化消息状态失败 (${message.id}):`, error);
      });
    };

    const updateBlockContent = (content: string, status: MessageBlockStatus) => {
      const changes = {
        content: header + content,
        status,
        updatedAt: new Date().toISOString()
      };
      const updatedBlock = {
        ...mainTextBlock,
        ...changes
      };

      dispatch(upsertManyBlocks([updatedBlock]));

      if (status === MessageBlockStatus.STREAMING) {
        throttledBlockUpdate(mainTextBlock.id, changes);
      } else {
        flushThrottledUpdates();
        void dexieStorage.updateMessageBlock(mainTextBlock.id, changes).catch(error => {
          logger.error(`持久化消息块失败 (${mainTextBlock.id}):`, error);
        });
      }
    };

    const handleDelta = (delta: string) => {
      if (!delta) return;

      if (accumulatedContent && delta.startsWith(accumulatedContent)) {
        accumulatedContent = delta;
      } else {
        accumulatedContent += delta;
      }

      updateBlockContent(accumulatedContent, MessageBlockStatus.STREAMING);
    };

    try {
      updateMessageStatus(AssistantMessageStatus.STREAMING);

      const response = await sendAIRequest(role, context, { onDelta: handleDelta });
      const finalContent = accumulatedContent || response || '';

      updateBlockContent(finalContent, MessageBlockStatus.SUCCESS);
      updateMessageStatus(AssistantMessageStatus.SUCCESS);

      return finalContent;
    } catch (error) {
      if (isAbortError(error)) {
        updateBlockContent(accumulatedContent, MessageBlockStatus.PAUSED);
        updateMessageStatus(AssistantMessageStatus.PAUSED);
      } else {
        updateBlockContent(accumulatedContent, MessageBlockStatus.ERROR);
        updateMessageStatus(AssistantMessageStatus.ERROR);
      }
      throw error;
    } finally {
      dispatch(newMessagesActions.setTopicLoading({ topicId: currentTopic.id, loading: false }));
      dispatch(newMessagesActions.setTopicStreaming({ topicId: currentTopic.id, streaming: false }));
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
      logger.debug('🔚 检测到专属停止指令 [DEBATE_END]');
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
      cleanupDebateRuntime();
      return;
    }

    try {
      // 生成总结
      const summary = await generateSummary(question, history, config);

      const finalMessage = `🏁 **AI辩论结束**\n\n## 辩论总结\n\n${summary}\n\n---\n\n感谢各位AI角色的精彩辩论！`;
      await sendAIMessage(finalMessage, '系统');

    } catch (error) {
      if (isAbortError(error)) {
        logger.debug('🛑 辩论总结生成被中断');
        throw error;
      }

      logger.error('生成辩论总结失败:', error);
      await sendAIMessage('🏁 **AI辩论结束**\n\n辩论已结束，但总结生成失败。', '系统');
    } finally {
      setIsDebating(false);
      setCurrentDebateConfig(null);
      cleanupDebateRuntime();
    }
  };

  const createFallbackSummary = (question: string, history: string[], reason: string): string => {
    const speeches = history.filter(item => !item.startsWith('辩论主题：'));
    const speechCount = speeches.length;
    const recentSpeeches = speeches.slice(-6);

    const debateRecord = recentSpeeches.length > 0
      ? recentSpeeches.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : '暂无有效角色发言记录。';

    return `
**辩论主题：** ${question}

**总结状态：** 使用本地模板总结

**原因：** ${reason}

**已记录发言数：** ${speechCount} 条

**最近发言摘录：**
${debateRecord}

**简要结论：**
本轮辩论已完成或被系统收束。由于当前没有可用的总结模型，本次未调用 AI 进行深度归纳。你可以在 AI 辩论设置中为“总结角色”配置模型，或确保至少一个辩论角色配置了可用模型，下次将自动使用该模型生成完整总结。

**建议：**
- 如果希望获得高质量总结，请添加一个 summary 总结角色并选择模型。
- 如果不需要 AI 总结，可以在 AI 辩论设置中关闭“生成总结”。
- 当前发言内容已经保留在上方消息中，可直接基于原文继续讨论。
    `.trim();
  };

  // 生成辩论总结
  const generateSummary = async (question: string, history: string[], config: DebateConfig): Promise<string> => {
    try {
      logger.debug('🤖 开始生成AI辩论总结...');

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

      // 优先找总结角色，如果没有则找其他配置了模型的角色。
      // 注意：这里必须使用本次 start 传入的 config，不能依赖 React state 闭包里的 currentDebateConfig。
      let summaryRole = config.roles?.find(role => role.stance === 'summary' && role.modelId);

      if (!summaryRole) {
        // 如果没有专门的总结角色，找任意一个配置了模型的角色
        summaryRole = config.roles?.find(role => role.modelId);
      }

      if (!summaryRole?.modelId) {
        return createFallbackSummary(question, history, '未配置总结角色，也没有找到任何配置了模型的辩论角色。');
      }

      logger.debug(`🤖 使用${summaryRole.stance === 'summary' ? '专门的总结角色' : '辩论角色'} ${summaryRole.modelId} (${summaryRole.name}) 生成总结`);

      // 调用AI生成总结
      const response = await sendChatRequest({
        messages: [{
          role: 'user' as const,
          content: summaryPrompt
        }],
        modelId: summaryRole.modelId,
        systemPrompt: '你是一位专业的辩论分析师，擅长客观分析和总结辩论内容。请提供深入、平衡的分析。',
        abortSignal: abortControllerRef.current?.signal
      });

      if (response.success && response.content) {
        logger.debug('✅ AI总结生成成功');
        return response.content;
      } else {
        logger.error('❌ AI总结生成失败:', response.error);
        throw new Error('AI总结生成失败');
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      logger.error('生成AI总结时发生错误:', error);

      return createFallbackSummary(
        question,
        history,
        `AI 总结生成失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  return {
    isDebating,
    handleStartDebate,
    handleStopDebate,
    currentDebateConfig
  };
};
