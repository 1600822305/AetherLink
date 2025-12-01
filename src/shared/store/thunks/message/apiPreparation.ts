import { dexieStorage } from '../../../services/storage/DexieStorageService';
import { getMainTextContent, findImageBlocks, findFileBlocks } from '../../../utils/blockUtils';
import { getFileTypeByExtension, readFileContent, FileTypes } from '../../../utils/fileUtils';
import type { MCPTool, Message } from '../../../types'; // 补充Message类型
import { REFERENCE_PROMPT } from '../../../config/prompts';
import { MobileKnowledgeService } from '../../../services/knowledge/MobileKnowledgeService';
import { newMessagesActions } from '../../slices/newMessagesSlice';
import { AssistantMessageStatus } from '../../../types/newMessage';
import store, { type RootState } from '../../index';
import { injectSystemPromptVariables } from '../../../utils/systemPromptVariables';
import { EventEmitter, EVENT_NAMES } from '../../../services/EventService';
import { getContextSettings, estimateMessagesTokenCount, truncateConversation } from '../../../services/messages/messageService';

/**
 * 在API调用前检查是否需要进行知识库搜索（风格：新模式）
 */
export const performKnowledgeSearchIfNeeded = async (topicId: string, assistantMessageId: string) => {
  try {
    console.log('[performKnowledgeSearchIfNeeded] 开始检查知识库选择状态...');

    // 检查是否有选中的知识库
    const knowledgeContextData = window.sessionStorage.getItem('selectedKnowledgeBase');
    console.log('[performKnowledgeSearchIfNeeded] sessionStorage数据:', knowledgeContextData);

    if (!knowledgeContextData) {
      console.log('[performKnowledgeSearchIfNeeded] 没有选中知识库，直接返回');
      return;
    }

    const contextData = JSON.parse(knowledgeContextData);
    console.log('[performKnowledgeSearchIfNeeded] 解析后的上下文数据:', contextData);

    if (!contextData.isSelected || !contextData.searchOnSend) {
      console.log('[performKnowledgeSearchIfNeeded] 不需要搜索，直接返回', {
        isSelected: contextData.isSelected,
        searchOnSend: contextData.searchOnSend
      });
      return;
    }

    console.log('[performKnowledgeSearchIfNeeded] 检测到知识库选择，开始搜索...');

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
      return;
    }

    // 找到最后一条用户消息
    const userMessage = messages
      .filter((m: Message) => m.role === 'user')
      .pop();

    if (!userMessage) {
      console.warn('[performKnowledgeSearchIfNeeded] 未找到用户消息');
      return;
    }

    // 获取用户消息的文本内容
    const userContent = getMainTextContent(userMessage);
    if (!userContent) {
      console.warn('[performKnowledgeSearchIfNeeded] 用户消息内容为空');
      return;
    }

    console.log('[performKnowledgeSearchIfNeeded] 用户消息内容:', userContent);

    // 搜索知识库 - 使用增强RAG
    const knowledgeService = MobileKnowledgeService.getInstance();
    const searchResults = await knowledgeService.search({
      knowledgeBaseId: contextData.knowledgeBase.id,
      query: userContent.trim(),
      threshold: 0.6,
      limit: contextData.knowledgeBase.documentCount || 5, // 使用知识库配置的文档数量
      useEnhancedRAG: true // 启用增强RAG搜索
    });

    console.log(`[performKnowledgeSearchIfNeeded] 搜索到 ${searchResults.length} 个相关内容`);

    if (searchResults.length > 0) {
      // 转换为KnowledgeReference格式
      const references = searchResults.map((result, index) => ({
        id: index + 1,
        content: result.content,
        type: 'file' as const,
        similarity: result.similarity,
        knowledgeBaseId: contextData.knowledgeBase.id,
        knowledgeBaseName: contextData.knowledgeBase.name,
        sourceUrl: `knowledge://${contextData.knowledgeBase.id}/${result.documentId || index}`
      }));

      // 缓存搜索结果（用于API注入）
      const cacheKey = `knowledge-search-${userMessage.id}`;
      window.sessionStorage.setItem(cacheKey, JSON.stringify(references));

      console.log(`[performKnowledgeSearchIfNeeded] 知识库搜索结果已缓存: ${cacheKey}`);

      // 发送知识库搜索事件（借鉴MCP工具块的事件机制）

      // 发送知识库搜索完成事件，携带搜索结果
      EventEmitter.emit(EVENT_NAMES.KNOWLEDGE_SEARCH_COMPLETED, {
        messageId: assistantMessageId,
        knowledgeBaseId: contextData.knowledgeBase.id,
        knowledgeBaseName: contextData.knowledgeBase.name,
        searchQuery: userContent,
        searchResults: searchResults,
        references: references
      });

      console.log(`[performKnowledgeSearchIfNeeded] 已发送知识库搜索完成事件，结果数量: ${searchResults.length}`);
    }

    // 清除知识库选择状态
    window.sessionStorage.removeItem('selectedKnowledgeBase');

  } catch (error) {
    console.error('[performKnowledgeSearchIfNeeded] 知识库搜索失败:', error);
    // 清除知识库选择状态
    window.sessionStorage.removeItem('selectedKnowledgeBase');
  }
};

export const prepareMessagesForApi = async (
  topicId: string,
  assistantMessageId: string,
  _mcpTools?: MCPTool[], // 添加下划线前缀表示未使用的参数
  options?: { skipKnowledgeSearch?: boolean }
) => {
  console.log('[prepareMessagesForApi] 开始准备API消息', { topicId, assistantMessageId, options });

  // 1. 首先检查是否需要进行知识库搜索（风格：在API调用前搜索）
  if (!options?.skipKnowledgeSearch) {
    console.log('[prepareMessagesForApi] 调用知识库搜索检查...');
    await performKnowledgeSearchIfNeeded(topicId, assistantMessageId);
    console.log('[prepareMessagesForApi] 知识库搜索检查完成');
  } else {
    console.log('[prepareMessagesForApi] 跳过知识库搜索检查');
  }

  // 2. 获取上下文设置（类似 Roo Code 的 manageContext）
  const { contextCount, contextWindowSize, maxOutputTokens } = await getContextSettings();
  console.log(`[prepareMessagesForApi] 上下文设置: contextCount=${contextCount}, contextWindowSize=${contextWindowSize}, maxOutputTokens=${maxOutputTokens}`);

  // 3. 获取包含content字段的消息
  const messages = await dexieStorage.getTopicMessages(topicId);

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

  // 获取当前助手ID，用于获取系统提示词
  const topic = await dexieStorage.getTopic(topicId);
  const assistantId = topic?.assistantId;

  // 获取系统提示词
  // 修改：实现追加模式 - 如果设置了话题提示词，则追加到助手提示词之后
  // 逻辑：助手提示词 + 话题提示词追加（如果有的话）
  let systemPrompt = '';
  if (assistantId) {
    const assistant = await dexieStorage.getAssistant(assistantId);
    if (assistant) {
      // 使用助手的系统提示词作为基础
      systemPrompt = assistant.systemPrompt || '';

      // 只有当话题提示词不为空时才追加
      if (topic && topic.prompt && topic.prompt.trim()) {
        if (systemPrompt) {
          // 如果助手有提示词，则追加话题提示词
          systemPrompt = systemPrompt + '\n\n' + topic.prompt;
        } else {
          // 如果助手没有提示词，则单独使用话题提示词
          systemPrompt = topic.prompt;
        }
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

  for (const message of limitedMessages) {
    // 🔧 修复：获取消息内容 - 优先从 content 字段，否则从数据库获取 blocks
    let content = '';
    
    // 1. 优先检查 message.content
    if (typeof (message as any).content === 'string' && (message as any).content.trim()) {
      content = (message as any).content;
    } else {
      // 2. 尝试从 Redux store 获取
      content = getMainTextContent(message);
      
      // 3. 如果还是空的，从数据库获取 blocks
      if (!content && message.blocks && message.blocks.length > 0) {
        try {
          const blocks = await dexieStorage.getMessageBlocksByMessageId(message.id);
          const mainTextBlock = blocks.find(b => 
            b.type === 'main_text' || b.type === 'unknown' || b.type === 'context_summary'
          );
          if (mainTextBlock && 'content' in mainTextBlock) {
            content = (mainTextBlock as any).content || '';
          }
        } catch (e) {
          console.warn(`[prepareMessagesForApi] 从数据库获取 blocks 失败:`, e);
        }
      }
    }



    // 如果是用户消息，检查是否有知识库搜索结果或选中的知识库
    if (message.role === 'user') {
      const cacheKey = `knowledge-search-${message.id}`;
      const cachedReferences = window.sessionStorage.getItem(cacheKey);

      if (cachedReferences && content) {
        try {
          const references = JSON.parse(cachedReferences);
          if (references && references.length > 0) {
            // 应用REFERENCE_PROMPT格式（风格）
            const referenceContent = `\`\`\`json\n${JSON.stringify(references, null, 2)}\n\`\`\``;
            content = REFERENCE_PROMPT
              .replace('{question}', content)
              .replace('{references}', referenceContent);

            console.log(`[prepareMessagesForApi] 为消息 ${message.id} 应用了知识库上下文，引用数量: ${references.length}`);

            // 清除缓存
            window.sessionStorage.removeItem(cacheKey);
          }
        } catch (error) {
          console.error('[prepareMessagesForApi] 解析知识库缓存失败:', error);
        }
      } else {
        // 检查是否有选中的知识库但没有缓存的搜索结果
        const knowledgeContextData = window.sessionStorage.getItem('selectedKnowledgeBase');
        if (knowledgeContextData && content) {
          try {
            const contextData = JSON.parse(knowledgeContextData);
            if (contextData.isSelected && contextData.searchOnSend) {
              console.log(`[prepareMessagesForApi] 检测到选中的知识库但没有缓存结果，进行实时搜索...`);

              // 使用已导入的知识库服务
              const knowledgeService = MobileKnowledgeService.getInstance();

              // 搜索知识库
              const searchResults = await knowledgeService.search({
                knowledgeBaseId: contextData.knowledgeBase.id,
                query: content.trim(),
                threshold: 0.6,
                limit: contextData.knowledgeBase.documentCount || 5 // 使用知识库配置的文档数量
              });

              if (searchResults.length > 0) {
                // 转换为引用格式
                const references = searchResults.map((result: any, index: number) => ({
                  id: index + 1,
                  content: result.content,
                  type: 'file' as const,
                  similarity: result.similarity,
                  knowledgeBaseId: contextData.knowledgeBase.id,
                  knowledgeBaseName: contextData.knowledgeBase.name,
                  sourceUrl: `knowledge://${contextData.knowledgeBase.id}/${result.documentId}`
                }));

                // 应用REFERENCE_PROMPT格式
                const referenceContent = `\`\`\`json\n${JSON.stringify(references, null, 2)}\n\`\`\``;
                content = REFERENCE_PROMPT
                  .replace('{question}', content)
                  .replace('{references}', referenceContent);

                console.log(`[prepareMessagesForApi] 实时搜索并应用了知识库上下文，引用数量: ${references.length}`);
              }
            }
          } catch (error) {
            console.error('[prepareMessagesForApi] 实时知识库搜索失败:', error);
          }
        }
      }
    }

    // 检查是否有文件或图片块
    const imageBlocks = findImageBlocks(message);
    const fileBlocks = findFileBlocks(message);

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
  }

  // 在数组开头添加系统消息
  // 注意：MCP 工具注入现在由提供商层的智能切换机制处理

  // 获取当前设置并注入系统提示词变量
  const currentState: RootState = store.getState();
  const variableConfig = currentState.settings.systemPromptVariables;
  const processedSystemPrompt = injectSystemPromptVariables(systemPrompt, variableConfig || {});

  apiMessages.unshift({
    role: 'system',
    content: processedSystemPrompt
  });

  console.log(`[prepareMessagesForApi] 准备完成，系统提示词长度: ${processedSystemPrompt.length}，API消息数量: ${apiMessages.length}，上下文限制: ${contextCount}`);

  return apiMessages;
};