import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { getMainTextContent, findImageBlocks, findFileBlocks, findToolBlocks } from '../../../utils/blockUtils';
import { getFileTypeByExtension, readFileContent, FileTypes } from '../../../utils/fileUtils';
import type { MCPTool, Message } from '../../../types'; // 补充Message类型
import type { ToolMessageBlock } from '../../../types/newMessage';
import { REFERENCE_PROMPT } from '../../../config/prompts';
import { MobileKnowledgeService } from '../../../services/knowledge/MobileKnowledgeService';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../../types/newMessage';
import store, { type RootState } from '../../index';
import { getKnowledgeSelectionFromStore } from '../../../hooks/useKnowledgeContext';
import { clearSelectedKnowledgeBase } from '../../slices/knowledgeSelectionSlice';
import type { SelectedKnowledgeInfo } from '../../slices/knowledgeSelectionSlice';
import { injectSystemPromptVariables } from '../../../utils/systemPromptVariables';
import { EventEmitter, EVENT_NAMES } from '../../../services/infra/EventService';
import { getContextSettings, estimateMessagesTokenCount, truncateConversation } from '../../../services/messages/messageService';
import { applyRegexRulesForSending } from '../../../utils/regexUtils';
import type { AssistantRegex } from '../../../types/Assistant';
import { searchRelevantMemories, buildMemoryPrompt, isMemoryEnabled, isMemoryAllowedForAssistant, setActiveMemoryAssistant } from './memoryIntegration';
import { SkillPromptBuilder } from '../../../services/skills/SkillPromptBuilder';
import { SkillManager } from '../../../services/skills/SkillManager';

/** 知识库搜索引用，用于注入到当前用户提问 */
export interface KnowledgeSearchReference {
  id: number;
  content: string;
  type: 'file';
  similarity: number;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceUrl: string;
}

/** 将知识库引用以 REFERENCE_PROMPT 格式包装到用户提问中 */
const applyKnowledgeReferences = (content: string, references: KnowledgeSearchReference[]): string => {
  const referenceContent = `\`\`\`json\n${JSON.stringify(references, null, 2)}\n\`\`\``;
  return REFERENCE_PROMPT
    .replace('{question}', content)
    .replace('{references}', referenceContent);
};

/**
 * 在构建API消息之前执行知识库搜索，返回引用列表供 prepareMessagesForApi 注入
 * @returns 搜索到的引用；未选中知识库或无结果时返回null
 */
export const performKnowledgeSearchIfNeeded = async (
  topicId: string,
  assistantMessageId: string
): Promise<KnowledgeSearchReference[] | null> => {
  try {
    console.log('[performKnowledgeSearchIfNeeded] 开始检查知识库选择状态...');

    const storeState = store.getState();
    // 优先使用多选列表，兼容旧的单选
    const selectedKBs = storeState.knowledgeSelection.selectedKnowledgeBases;
    const contextData = getKnowledgeSelectionFromStore(storeState);

    if (selectedKBs.length === 0 && !contextData) {
      console.log('[performKnowledgeSearchIfNeeded] 没有选中知识库，直接返回');
      return null;
    }

    // 确定要搜索的知识库列表
    const knowledgeBasesToSearch: SelectedKnowledgeInfo[] = selectedKBs.length > 0
      ? selectedKBs
      : contextData ? [contextData.knowledgeBase] : [];

    if (knowledgeBasesToSearch.length === 0) return null;

    console.log(`[performKnowledgeSearchIfNeeded] 检测到 ${knowledgeBasesToSearch.length} 个知识库，开始并行搜索...`);

    // 设置助手消息状态为搜索中
    store.dispatch(newMessagesActions.updateMessage({
      id: assistantMessageId,
      changes: {
        status: AssistantMessageStatus.SEARCHING
      }
    }));

    // 获取话题消息
    const messages = await dexieStorage.getTopicMessages(topicId);
    if (!messages || messages.length === 0) {
      console.warn('[performKnowledgeSearchIfNeeded] 无法获取话题消息');
      return null;
    }

    // 找到最后一条用户消息
    const userMessage = messages
      .filter((m: Message) => m.role === 'user')
      .pop();

    if (!userMessage) {
      console.warn('[performKnowledgeSearchIfNeeded] 未找到用户消息');
      return null;
    }

    // 获取用户消息的文本内容
    const userContent = getMainTextContent(userMessage);
    if (!userContent) {
      console.warn('[performKnowledgeSearchIfNeeded] 用户消息内容为空');
      return null;
    }

    console.log('[performKnowledgeSearchIfNeeded] 用户消息内容:', userContent);

    // 并行搜索所有选中的知识库
    const knowledgeService = MobileKnowledgeService.getInstance();
    const searchPromises = knowledgeBasesToSearch.map(async (kb) => {
      try {
        const results = await knowledgeService.search({
          knowledgeBaseId: kb.id,
          query: userContent.trim(),
          threshold: 0.6,
          limit: kb.documentCount || 5,
          useEnhancedRAG: true
        });
        return { kb, results };
      } catch (err) {
        console.warn(`[performKnowledgeSearchIfNeeded] 知识库 "${kb.name}" 搜索失败:`, err);
        return { kb, results: [] };
      }
    });

    const allSearchResults = await Promise.all(searchPromises);

    // 合并所有结果并按相似度降序排列
    let globalIndex = 1;
    const allReferences: KnowledgeSearchReference[] = [];

    for (const { kb, results } of allSearchResults) {
      for (const result of results) {
        allReferences.push({
          id: globalIndex++,
          content: result.content,
          type: 'file' as const,
          similarity: result.similarity,
          knowledgeBaseId: kb.id,
          knowledgeBaseName: kb.name,
          sourceUrl: `knowledge://${kb.id}/${result.documentId || (globalIndex - 1)}`
        });
      }
    }

    // 按相似度降序排列并重新编号
    allReferences.sort((a, b) => b.similarity - a.similarity);
    allReferences.forEach((ref, i) => { ref.id = i + 1; });

    const totalResults = allReferences.length;
    console.log(`[performKnowledgeSearchIfNeeded] 并行搜索完成: ${knowledgeBasesToSearch.length} 个知识库, ${totalResults} 个结果`);

    if (totalResults > 0) {
      // 发送知识库搜索完成事件
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_SEARCH_COMPLETED, {
        messageId: assistantMessageId,
        knowledgeBaseIds: knowledgeBasesToSearch.map(kb => kb.id),
        knowledgeBaseNames: knowledgeBasesToSearch.map(kb => kb.name),
        searchQuery: userContent,
        searchResults: allSearchResults.flatMap(r => r.results),
        references: allReferences
      });
    }

    // 清除知识库选择状态
    store.dispatch(clearSelectedKnowledgeBase());

    return totalResults > 0 ? allReferences : null;
  } catch (error) {
    console.error('[performKnowledgeSearchIfNeeded] 知识库搜索失败:', error);
    store.dispatch(clearSelectedKnowledgeBase());
    return null;
  }
};

export const prepareMessagesForApi = async (
  topicId: string,
  assistantMessageId: string,
  _mcpTools?: MCPTool[], // 添加下划线前缀表示未使用的参数
  options?: {
    assistant?: any; // 支持传入缓存的 assistant 信息
    messages?: Message[]; // 支持传入缓存的消息列表，避免重复查询
    knowledgeReferences?: KnowledgeSearchReference[]; // 提前搜索好的知识库引用，注入到当前用户提问
  }
) => {
  console.log('[prepareMessagesForApi] 开始准备API消息', { topicId, assistantMessageId });

  // 获取上下文设置（类似 Roo Code 的 manageContext）
  const { contextCount, contextWindowSize, maxOutputTokens } = await getContextSettings();
  console.log(`[prepareMessagesForApi] 上下文设置: contextCount=${contextCount}, contextWindowSize=${contextWindowSize}, maxOutputTokens=${maxOutputTokens}`);

  // 3. 获取包含content字段的消息
  // 优先使用传入的 messages，避免重复查询数据库
  const messages = options?.messages || await dexieStorage.getTopicMessages(topicId);
  if (options?.messages) {
    console.log(`[prepareMessagesForApi] 使用缓存的消息列表，消息数: ${messages.length}`);
  }

  // 按创建时间排序消息，确保顺序正确
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB; // 升序排列，最早的在前面
  });

  // 4. 获取当前助手消息
  const assistantMessage = sortedMessages.find((msg: Message) => msg.id === assistantMessageId);
  if (!assistantMessage) {
    throw new Error(`找不到助手消息 ${assistantMessageId}`);
  }

  // 获取当前助手消息的创建时间
  const assistantMessageTime = new Date(assistantMessage.createdAt).getTime();

  // 5. 应用上下文消息数量限制（参考 cherry-studio 的 filterContextMessages）
  // 首先过滤掉当前助手消息和时间更晚的消息，以及 clear 消息之后的内容
  let contextFilteredMessages = sortedMessages.filter((msg: Message) => {
    // 排除当前助手消息
    if (msg.id === assistantMessageId) return false;
    // 排除 system 消息
    if (msg.role === 'system') return false;
    // 排除创建时间晚于当前助手消息的消息
    const messageTime = new Date(msg.createdAt).getTime();
    if (messageTime >= assistantMessageTime) return false;
    return true;
  });
  
  // 查找最后一个 clear 类型消息的索引
  let clearIndex = -1;
  for (let i = contextFilteredMessages.length - 1; i >= 0; i--) {
    if (contextFilteredMessages[i].type === 'clear') {
      clearIndex = i;
      break;
    }
  }
  
  // 如果找到了 clear 消息，只保留 clear 消息之后的消息
  if (clearIndex !== -1) {
    contextFilteredMessages = contextFilteredMessages.slice(clearIndex + 1);
    console.log(`[prepareMessagesForApi] 发现 clear 消息，过滤后消息数: ${contextFilteredMessages.length}`);
  }

  // 然后应用 contextCount 限制（使用 takeRight 逻辑）
  // contextCount 代表**轮数**，1轮 = 1条用户消息 + 1条AI回复 = 2条消息
  // 所以实际取的消息数 = contextCount * 2
  const actualMessageCount = contextCount * 2;
  let limitedMessages = contextCount >= 100000
    ? contextFilteredMessages  // 无限制
    : contextFilteredMessages.slice(-actualMessageCount);
  
  console.log(`[prepareMessagesForApi] 消息轮数限制: 原始消息数=${sortedMessages.length}, 过滤后消息数=${contextFilteredMessages.length}, 限制后消息数=${limitedMessages.length}, 设置轮数=${contextCount}`);

  // 类似 Roo Code：如果设置了上下文窗口大小，应用 Token 限制
  if (contextWindowSize > 0) {
    const TOKEN_BUFFER_PERCENTAGE = 0.1;
    // 确保 maxOutputTokens 不超过窗口的 50%（类似 Roo Code 的限制）
    const effectiveMaxOutput = Math.min(maxOutputTokens, contextWindowSize * 0.5);
    const allowedTokens = contextWindowSize * (1 - TOKEN_BUFFER_PERCENTAGE) - effectiveMaxOutput;
    
    // 只有当 allowedTokens 为正数时才进行限制
    if (allowedTokens > 0) {
      let currentTokens = estimateMessagesTokenCount(limitedMessages);
      console.log(`[prepareMessagesForApi] Token 检查: ${currentTokens}/${allowedTokens} (窗口: ${contextWindowSize})`);
      
      // 如果超出限制，进行滑动窗口截断（最多尝试 10 次，避免无限循环）
      let attempts = 0;
      const maxAttempts = 10;
      while (currentTokens > allowedTokens && limitedMessages.length > 2 && attempts < maxAttempts) {
        const prevLength = limitedMessages.length;
        limitedMessages = truncateConversation(limitedMessages, 0.3);
        
        // 如果消息数没有减少，退出循环
        if (limitedMessages.length >= prevLength) {
          console.log(`[prepareMessagesForApi] 无法继续截断，退出`);
          break;
        }
        
        currentTokens = estimateMessagesTokenCount(limitedMessages);
        console.log(`[prepareMessagesForApi] 滑动窗口截断后: Token=${currentTokens}/${allowedTokens}, 消息数=${limitedMessages.length}`);
        attempts++;
      }
    } else {
      console.log(`[prepareMessagesForApi] 跳过 Token 限制: allowedTokens=${allowedTokens} (窗口太小或输出 Token 太大)`);
    }
  }

  // 获取系统提示词
  // 优先使用传入的 assistant，避免重复查询数据库
  let systemPrompt = '';
  let assistant = options?.assistant;
  
  // 如果没有传入 assistant，才从数据库获取
  if (!assistant) {
    const topic = await dexieStorage.getTopic(topicId);
    const assistantId = topic?.assistantId;
    if (assistantId) {
      assistant = await dexieStorage.getAssistant(assistantId);
    }
  }
  
  // 获取话题信息（用于话题提示词）
  const topic = await dexieStorage.getTopic(topicId);
  
  // 修改：实现追加模式 - 助手提示词 + Skills摘要/激活内容 + 话题提示词
  if (assistant) {
    const assistantPrompt = assistant.systemPrompt || '';
    const topicPrompt = (topic?.prompt && topic.prompt.trim()) ? topic.prompt : '';

    // 获取助手绑定的已启用技能（OpenClaw 风格：无激活概念，全部精简注入）
    let enabledSkills: import('../../../types/Skill').Skill[] = [];
    try {
      if (assistant.skillIds?.length) {
        console.log(`[prepareMessagesForApi] 助手有 ${assistant.skillIds.length} 个绑定技能 ID:`, assistant.skillIds);
        enabledSkills = await SkillManager.getSkillsForAssistant(assistant.id);
        console.log(`[prepareMessagesForApi] 获取到 ${enabledSkills.length} 个已启用技能:`, enabledSkills.map(s => s.name));
      } else {
        console.log(`[prepareMessagesForApi] 助手没有绑定技能 (skillIds=${JSON.stringify(assistant.skillIds)})`);
      }
    } catch (error) {
      console.warn('[prepareMessagesForApi] 获取技能信息失败，降级到无技能模式:', error);
    }

    // 使用 SkillPromptBuilder 统一组装 system prompt（OpenClaw 风格精简列表）
    if (enabledSkills.length > 0) {
      systemPrompt = SkillPromptBuilder.assembleSystemPrompt({
        assistantPrompt,
        enabledSkills,
        topicPrompt: topicPrompt || undefined,
      });
    } else {
      // 无技能时保持原有逻辑
      systemPrompt = assistantPrompt;
      if (topicPrompt) {
        systemPrompt = systemPrompt ? systemPrompt + '\n\n' + topicPrompt : topicPrompt;
      }
    }
  } else if (topic && topic.prompt && topic.prompt.trim()) {
    // 如果没有助手，使用话题的提示词（仅当不为空时）
    systemPrompt = topic.prompt;
  }

  // 注意：默认系统提示词的获取在UI层面处理（SystemPromptBubble和SystemPromptDialog）
  // 这里不需要获取默认系统提示词，避免循环依赖问题
  // 如果没有助手提示词和话题提示词，使用空字符串也是可以的

  // 6. 转换为API请求格式
  // 注意：limitedMessages 已经过滤掉了当前助手消息和 system 消息
  const apiMessages = [];

  // 获取助手的正则规则
  const regexRules: AssistantRegex[] = assistant?.regexRules || [];
  const hasRegexRules = regexRules.length > 0;
  if (hasRegexRules) {
    console.log(`[prepareMessagesForApi] 检测到 ${regexRules.length} 条正则规则`);
  }

  // 知识库引用注入到上下文中最后一条用户消息（即当前提问）
  const lastUserMessageId = [...limitedMessages].reverse().find((m) => m.role === 'user')?.id;

  for (const message of limitedMessages) {
    let content = getMainTextContent(message);

    // 应用正则规则（非 visualOnly 的规则，用于发送）
    if (hasRegexRules && content) {
      const scope = message.role as 'user' | 'assistant';
      const originalContent = content;
      content = applyRegexRulesForSending(content, regexRules, scope);
      if (content !== originalContent) {
        console.log(`[prepareMessagesForApi] 对 ${scope} 消息应用了正则规则`);
      }
    }

    // 将知识库引用注入到当前提问（上下文中最后一条用户消息）
    if (
      message.role === 'user' &&
      message.id === lastUserMessageId &&
      content &&
      options?.knowledgeReferences?.length
    ) {
      content = applyKnowledgeReferences(content, options.knowledgeReferences);
      console.log(`[prepareMessagesForApi] 为消息 ${message.id} 注入知识库引用，数量: ${options.knowledgeReferences.length}`);
    }

    // 检查是否有文件或图片块
    const imageBlocks = findImageBlocks(message);
    const fileBlocks = findFileBlocks(message);

    // 如果是 assistant 消息且有工具块，需要在内容后面添加 <tool_use> 标签
    // 这样 AI 才能看到自己发出的工具调用，理解工具结果的来源
    if (message.role === 'assistant') {
      const toolBlocksForContent = findToolBlocks(message);
      if (toolBlocksForContent.length > 0) {
        const toolUseTags = toolBlocksForContent
          .map((block) => {
            const toolBlock = block as ToolMessageBlock;
            const toolName = toolBlock.toolName || toolBlock.toolId || 'unknown_tool';
            const args = toolBlock.arguments || {};
            return `<tool_use>\n  <name>${toolName}</name>\n  <arguments>${JSON.stringify(args)}</arguments>\n</tool_use>`;
          })
          .join('\n\n');
        content = (content || '') + '\n\n' + toolUseTags;
        console.log(`[prepareMessagesForApi] 为 assistant 消息添加工具调用标签，工具数量: ${toolBlocksForContent.length}`);
      }
    }

    // 如果没有文件和图片，使用简单格式
    if (imageBlocks.length === 0 && fileBlocks.length === 0) {
      apiMessages.push({
        role: message.role,
        content: content || '' // 确保content不为undefined或null
      });
    } else {
      // 有文件或图片时，使用多模态格式
      const parts = [];

      // 确保至少有一个文本部分，即使内容为空
      // 这样可以避免parts数组为空导致API请求失败
      parts.push({ type: 'text', text: content || '' });

      // 处理图片块
      for (const imageBlock of imageBlocks) {
        if (imageBlock.url) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: imageBlock.url
            }
          });
        } else if (imageBlock.file && imageBlock.file.base64Data) {
          let base64Data = imageBlock.file.base64Data;
          if (base64Data && typeof base64Data === 'string' && base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${imageBlock.file.mimeType || 'image/jpeg'};base64,${base64Data}`
            }
          });
        }
      }

      // 处理文件块
      for (const fileBlock of fileBlocks) {
        if (fileBlock.file) {
          const fileType = getFileTypeByExtension(fileBlock.file.name || fileBlock.file.origin_name || '');

          // 处理文本、代码和文档类型的文件
          if (fileType === FileTypes.TEXT || fileType === FileTypes.CODE || fileType === FileTypes.DOCUMENT) {
            try {
              const fileContent = await readFileContent(fileBlock.file);
              if (fileContent) {
                // 按照最佳实例格式：文件名\n文件内容
                const fileName = fileBlock.file.origin_name || fileBlock.file.name || '未知文件';
                parts.push({
                  type: 'text',
                  text: `${fileName}\n${fileContent}`
                });
              }
            } catch (error) {
              console.error(`[prepareMessagesForApi] 读取文件内容失败:`, error);
            }
          }
        }
      }

      apiMessages.push({
        role: message.role,
        content: parts
      });
    }

    // 处理工具块：如果是 assistant 消息且有工具块，需要添加工具结果消息
    // 参考 Cherry Studio：工具结果以 <tool_use_result> 格式作为 user 消息添加
    if (message.role === 'assistant') {
      const toolBlocks = findToolBlocks(message);
      if (toolBlocks.length > 0) {
        // 构建工具结果消息
        const toolResults = toolBlocks
          .map((block) => {
            const toolBlock = block as ToolMessageBlock;
            const toolName = toolBlock.toolName || toolBlock.toolId || 'unknown_tool';
            // 获取工具结果内容
            let resultContent = '';
            if (typeof toolBlock.content === 'string') {
              resultContent = toolBlock.content;
            } else if (toolBlock.content) {
              resultContent = JSON.stringify(toolBlock.content);
            }
            // 如果有 metadata.rawMcpToolResponse，检查是否有额外结果
            const rawResponse = toolBlock.metadata?.rawMcpToolResponse as any;
            if (rawResponse?.result) {
              const rawResult = rawResponse.result;
              resultContent = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
            }
            return `<tool_use_result>\n  <name>${toolName}</name>\n  <result>${resultContent}</result>\n</tool_use_result>`;
          })
          .join('\n\n');
        
        // 添加工具结果作为 user 消息
        if (toolResults) {
          apiMessages.push({
            role: 'user',
            content: toolResults
          });
          console.log(`[prepareMessagesForApi] 添加工具结果消息，工具数量: ${toolBlocks.length}`);
        }
      }
    }
  }

  // 在数组开头添加系统消息
  // 注意：MCP 工具注入现在由提供商层的智能切换机制处理

  // 获取当前设置并注入系统提示词变量
  const currentState: RootState = store.getState();
  const variableConfig = currentState.settings.systemPromptVariables;
  let processedSystemPrompt = injectSystemPromptVariables(systemPrompt, variableConfig || {});

  // 🧠 记忆系统集成：搜索相关记忆并注入到系统提示词（按当前对话助手隔离）
  if (isMemoryEnabled() && isMemoryAllowedForAssistant(assistant)) {
    try {
      if (assistant?.id) {
        setActiveMemoryAssistant(assistant.id);
      }
      const lastUserMessage = limitedMessages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        const userContent = getMainTextContent(lastUserMessage);
        if (userContent) {
          const memories = await searchRelevantMemories(userContent, 5, assistant?.id);
          if (memories.length > 0) {
            const memoryPrompt = buildMemoryPrompt(memories);
            processedSystemPrompt = processedSystemPrompt + '\n' + memoryPrompt;
            console.log(`[prepareMessagesForApi] 已注入 ${memories.length} 条相关记忆到系统提示词`);
          }
        }
      }
    } catch (error) {
      console.error('[prepareMessagesForApi] 记忆搜索失败:', error);
    }
  }

  apiMessages.unshift({
    role: 'system',
    content: processedSystemPrompt
  });

  console.log(`[prepareMessagesForApi] 准备完成，系统提示词长度: ${processedSystemPrompt.length}，API消息数量: ${apiMessages.length}，上下文限制: ${contextCount}`);

  return apiMessages;
};