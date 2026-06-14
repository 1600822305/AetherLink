import React, { useMemo } from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { Box, Fade, CircularProgress, Typography } from '@mui/material';
import type { RootState } from '../../shared/store';
import { makeSelectBlocksByIds } from '../../shared/store/selectors/messageBlockSelectors';
import type { MessageBlock, Message, ImageMessageBlock, VideoMessageBlock, MainTextMessageBlock, CodeMessageBlock, ToolMessageBlock, ContextSummaryMessageBlock, ThinkingMessageBlock } from '../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus, AssistantMessageStatus } from '../../shared/types/newMessage';


// 直接导入块组件，与最佳实例保持一致
// 注意：MultiModelBlock 和 ModelComparisonBlock 已移除
// 多模型功能现在通过 askId 分组多个独立的助手消息实现，由 MultiModelMessageGroup 组件处理
import MainTextBlock from './blocks/MainTextBlock';
import ThinkingBlock from './blocks/ThinkingBlock';
import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import { CodeBlockView } from '../CodeBlockView';
import CitationBlock from './blocks/CitationBlock';
import ErrorBlock from './blocks/ErrorBlock';
import TranslationBlock from './blocks/TranslationBlock';
import MathBlock from './blocks/MathBlock';
import ChartBlock from './blocks/ChartBlock';
import FileBlock from './blocks/FileBlock';
import PlaceholderBlock from './blocks/PlaceholderBlock';
import KnowledgeReferenceBlock from './blocks/KnowledgeReferenceBlock';
import ContextSummaryBlock from './blocks/ContextSummaryBlock';
import ToolBlock from './blocks/ToolBlock';
import { isEmptyMainTextBlock, shouldShowEmptyContentMessage } from './messageBlockRenderGuards';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('MessageBlockRenderer');

// 类型定义：分组后的块可以是单个块或块数组
type GroupedBlock = MessageBlock | MessageBlock[];

// 简单的动画块包装器组件（使用 MUI Fade）
interface AnimatedBlockWrapperProps {
  children: React.ReactNode;
  enableAnimation: boolean;
}

const AnimatedBlockWrapper: React.FC<AnimatedBlockWrapperProps> = ({ children, enableAnimation }) => {
  return (
    <Fade in={true} timeout={enableAnimation ? 300 : 0}>
      <div>
        {children}
      </div>
    </Fade>
  );
};

/**
 * 图片分组容器组件
 * 用于网格展示多张连续图片
 */
interface ImageBlockGroupProps {
  children: React.ReactNode;
  count: number;
}

const ImageBlockGroup: React.FC<ImageBlockGroupProps> = ({ children, count }) => {
  // 根据图片数量动态计算列数
  const getGridColumns = () => {
    if (count === 1) return '1fr';
    if (count === 2) return 'repeat(2, 1fr)';
    if (count <= 4) return 'repeat(2, 1fr)';
    return 'repeat(3, 1fr)';
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(),
        gap: 1,
        maxWidth: '100%',
      }}
    >
      {children}
    </Box>
  );
};

/**
 * 将连续的同类型媒体块分组
 * - 连续的图片块会被分组到一个数组中
 * - 相同路径的视频块会被去重（只保留第一个）
 * - 其他块保持原样
 */
/**
 * 类型守卫：判断是否为代码块
 */
const isCodeBlock = (block: MessageBlock): block is CodeMessageBlock => {
  return block.type === MessageBlockType.CODE;
};

/**
 * 类型守卫：判断是否为工具块
 */
const isToolBlock = (block: MessageBlock): block is ToolMessageBlock => {
  return block.type === MessageBlockType.TOOL;
};


/**
 * 类型守卫：判断是否为上下文摘要块
 */
const isContextSummaryBlock = (block: MessageBlock): block is ContextSummaryMessageBlock => {
  return block.type === MessageBlockType.CONTEXT_SUMMARY;
};

/**
 * 动画状态列表
 */
const ANIMATING_STATUSES = ['streaming', 'processing', 'searching'];

const groupSimilarBlocks = (blocks: MessageBlock[]): GroupedBlock[] => {
  const seenVideoPaths = new Set<string>();
  
  return blocks.reduce<GroupedBlock[]>((acc, currentBlock) => {
    // 图片块分组逻辑
    if (currentBlock.type === MessageBlockType.IMAGE) {
      const prevGroup = acc[acc.length - 1];
      // 如果上一个元素是图片数组，追加到该数组
      if (Array.isArray(prevGroup) && prevGroup[0]?.type === MessageBlockType.IMAGE) {
        prevGroup.push(currentBlock);
      } else {
        // 否则创建新的图片数组
        acc.push([currentBlock]);
      }
      return acc;
    }
    
    // 视频块去重逻辑
    if (currentBlock.type === MessageBlockType.VIDEO) {
      const videoBlock = currentBlock as VideoMessageBlock;
      const videoPath = videoBlock.url || '';
      
      // 如果这个视频路径已经存在，跳过
      if (videoPath && seenVideoPaths.has(videoPath)) {
        return acc;
      }
      
      // 记录视频路径
      if (videoPath) {
        seenVideoPaths.add(videoPath);
      }
      
      acc.push(currentBlock);
      return acc;
    }
    
    // 其他类型块直接添加
    acc.push(currentBlock);
    return acc;
  }, []);
};

/**
 * 计算「思考阶段工具调用」的内嵌归组（供应商无关）
 *
 * 仅依据 block 顺序推断 phase：位于某个 THINKING 块之后、且在本回合首个
 * MAIN_TEXT(正式回答) 之前的 TOOL 块，判定为思考阶段工具 → 内嵌进对应思考块；
 * 一旦出现 MAIN_TEXT 即进入回答阶段，后续 TOOL 块保持顶层独立渲染。
 *
 * 该推断对所有供应商一致（DeepSeek/Claude/Gemini/...），无任何 provider 特有字段依赖。
 * 判断不明确时一律安全回退为顶层块，绝不丢块。
 */
const computeInlineToolGroups = (
  blocks: MessageBlock[],
  enabled: boolean
): { consumedToolIds: Set<string>; inlineToolMap: Map<string, ToolMessageBlock[]> } => {
  const consumedToolIds = new Set<string>();
  const inlineToolMap = new Map<string, ToolMessageBlock[]>();
  if (!enabled) return { consumedToolIds, inlineToolMap };

  let currentThinkingId: string | null = null;
  for (const block of blocks) {
    if (block.type === MessageBlockType.THINKING) {
      currentThinkingId = block.id;
    } else if (block.type === MessageBlockType.MAIN_TEXT) {
      // 进入回答阶段，后续工具块归为顶层
      currentThinkingId = null;
    } else if (block.type === MessageBlockType.TOOL && currentThinkingId) {
      const arr = inlineToolMap.get(currentThinkingId) ?? [];
      arr.push(block as ToolMessageBlock);
      inlineToolMap.set(currentThinkingId, arr);
      consumedToolIds.add(block.id);
    }
  }

  return { consumedToolIds, inlineToolMap };
};

interface Props {
  blocks: string[];
  message: Message;
  // 添加额外的 padding 属性
  extraPaddingLeft?: number;
  extraPaddingRight?: number;
}

/**
 * 消息块渲染器组件
 * 负责根据块类型渲染不同的块组件
 */
const MessageBlockRenderer: React.FC<Props> = ({
  blocks,
  message,
  extraPaddingLeft = 0,
  extraPaddingRight = 0
}) => {
  // 仅依赖自身块ID映射，避免全局实体导致重渲染
  // 每个组件实例持有独立的记忆化 selector，避免多消息共用单一缓存互相失效
  const selectBlocksByIds = useMemo(() => makeSelectBlocksByIds(), []);
  const renderedBlocks = useSelector(
    (state: RootState) => selectBlocksByIds(state, blocks),
    shallowEqual
  );

  // 是否在思考块内显示思考阶段的工具调用（默认开启，可在设置中关闭以回到现状）
  const thinkingToolInline = useSelector((state: RootState) =>
    (state.settings as any).thinkingToolInline !== false
  );

  // 计算思考阶段工具的内嵌归组：被内嵌的工具块从顶层流剔除，挂到对应思考块
  const { consumedToolIds, inlineToolMap } = useMemo(
    () => computeInlineToolGroups(renderedBlocks, thinkingToolInline),
    [renderedBlocks, thinkingToolInline]
  );

  // 顶层可见块（剔除已内嵌的工具块）
  const visibleBlocks = useMemo(
    () => consumedToolIds.size === 0
      ? renderedBlocks
      : renderedBlocks.filter((b) => !consumedToolIds.has(b.id)),
    [renderedBlocks, consumedToolIds]
  );

  // 对块进行分组（图片分组、视频去重）
  const groupedBlocks = useMemo(() => groupSimilarBlocks(visibleBlocks), [visibleBlocks]);

  // 渲染占位符块
  const renderPlaceholder = () => {
    // 检查是否有任何块正在流式输出
    const hasStreamingBlock = renderedBlocks.some(block => block.status === MessageBlockStatus.STREAMING);

    // 如果有流式输出的块，不显示占位符
    if (hasStreamingBlock) {
      return null;
    }

    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
        color: 'text.secondary'
      }}>
        正在生成回复...
      </Box>
    );
  };

  // 渲染空内容提示 - 更友好的提示，不再显示为错误
  const renderEmptyContentMessage = () => {
    return (
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
        color: 'text.secondary', // 使用次要文本颜色而不是错误颜色
        fontStyle: 'italic'
      }}>
        正在加载内容...
      </Box>
    );
  };

  // 检查是否有空内容的成功状态块 - 使用提取的工具函数
  const hasEmptySuccessBlock = useMemo(() => {
    return shouldShowEmptyContentMessage(renderedBlocks, message);
  }, [renderedBlocks, message]);

  // 是否启用动画 - 使用显式状态比较
  const enableAnimation = ANIMATING_STATUSES.includes(message.status);

  // 是否正在搜索知识库
  const isSearching = message.status === AssistantMessageStatus.SEARCHING;

  return (
    <Box sx={{ width: '100%' }}>
      {/* 知识库搜索中状态指示器 */}
      {isSearching && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          mb: 1,
          borderRadius: 1,
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider'
        }}>
          <CircularProgress size={18} thickness={4} />
          <Typography variant="body2" color="text.secondary">
            正在搜索知识库...
          </Typography>
        </Box>
      )}
      {/* 只有在没有渲染块且消息状态为streaming时才显示占位符 */}
      {renderedBlocks.length === 0 && message.status === 'streaming' ? (
        renderPlaceholder()
      ) : hasEmptySuccessBlock ? (
        renderEmptyContentMessage()
      ) : (
        <>
          {/* 渲染所有块（支持分组） */}
          {groupedBlocks.map((blockOrGroup) => {
            // 处理图片分组
            if (Array.isArray(blockOrGroup)) {
              const imageBlocks = blockOrGroup as ImageMessageBlock[];
              const groupKey = imageBlocks.map(b => b.id).join('-');
              
              // 单张图片不需要分组容器
              if (imageBlocks.length === 1) {
                return (
                  <AnimatedBlockWrapper key={groupKey} enableAnimation={enableAnimation}>
                    <Box sx={{ mb: 1, pl: extraPaddingLeft, pr: extraPaddingRight }}>
                      <ImageBlock block={imageBlocks[0]} isSingle={true} />
                    </Box>
                  </AnimatedBlockWrapper>
                );
              }
              
              // 多张图片使用网格容器
              return (
                <AnimatedBlockWrapper key={groupKey} enableAnimation={enableAnimation}>
                  <Box sx={{ mb: 1, pl: extraPaddingLeft, pr: extraPaddingRight }}>
                    <ImageBlockGroup count={imageBlocks.length}>
                      {imageBlocks.map((imageBlock) => (
                        <ImageBlock key={imageBlock.id} block={imageBlock} isSingle={false} />
                      ))}
                    </ImageBlockGroup>
                  </Box>
                </AnimatedBlockWrapper>
              );
            }
            
            // 处理单个块
            const block = blockOrGroup;
            let blockComponent: React.ReactNode = null;

            // 处理空内容的成功状态块 - 使用提取的工具函数
            if (isEmptyMainTextBlock(block, message)) {
              return renderEmptyContentMessage();
            }

            switch (block.type) {
              case MessageBlockType.UNKNOWN:
                // 参考最佳实例逻辑：PROCESSING状态下渲染占位符块，SUCCESS状态下当作主文本块处理
                if (block.status === MessageBlockStatus.PROCESSING) {
                  blockComponent = <PlaceholderBlock block={block} />;
                } else if (block.status === MessageBlockStatus.SUCCESS) {
                  // 兼容性处理：将 UNKNOWN 类型的成功状态块当作主文本块处理
                  blockComponent = <MainTextBlock block={block as unknown as MainTextMessageBlock} role={message.role} messageId={message.id} />;
                }
                break;
              case MessageBlockType.MAIN_TEXT:
                blockComponent = <MainTextBlock block={block} role={message.role} messageId={message.id} />;
                break;
              case MessageBlockType.THINKING:
                blockComponent = (
                  <ThinkingBlock
                    block={block as ThinkingMessageBlock}
                    inlineToolBlocks={inlineToolMap.get(block.id)}
                  />
                );
                break;
              case MessageBlockType.IMAGE:
                // 单独的图片块（非连续分组的情况）
                blockComponent = <ImageBlock block={block} isSingle={true} />;
                break;
              case MessageBlockType.VIDEO:
                blockComponent = <VideoBlock block={block} />;
                break;
              case MessageBlockType.CODE:
                // 使用新版 CodeBlockView - 使用类型守卫
                if (isCodeBlock(block)) {
                  blockComponent = (
                    <CodeBlockView language={block.language || 'text'}>
                      {block.content || ''}
                    </CodeBlockView>
                  );
                }
                break;
              case MessageBlockType.CITATION:
                blockComponent = <CitationBlock block={block} />;
                break;
              case MessageBlockType.ERROR:
                blockComponent = <ErrorBlock block={block} />;
                break;
              case MessageBlockType.TRANSLATION:
                blockComponent = <TranslationBlock block={block} />;
                break;
              case MessageBlockType.MATH:
                blockComponent = <MathBlock block={block} />;
                break;
              // 注意：MULTI_MODEL case 已移除
              // 多模型功能现在通过 askId 分组多个独立的助手消息实现
              case MessageBlockType.CHART:
                blockComponent = <ChartBlock block={block} />;
                break;
              case MessageBlockType.FILE:
                blockComponent = <FileBlock block={block} />;
                break;
              case MessageBlockType.TOOL:
                // 工具块按 message.blocks 顺序独立渲染 - 使用类型守卫
                if (isToolBlock(block)) {
                  blockComponent = <ToolBlock block={block} />;
                }
                break;
              case MessageBlockType.KNOWLEDGE_REFERENCE:
                // 历史遗留类型：新引用走 CITATION，旧数据仍按原组件渲染
                blockComponent = <KnowledgeReferenceBlock block={block} />;
                break;
              case MessageBlockType.CONTEXT_SUMMARY:
                // 使用类型守卫
                if (isContextSummaryBlock(block)) {
                  blockComponent = <ContextSummaryBlock block={block} />;
                }
                break;
              default: {
                // exhaustive check - 如果到达这里说明有未处理的类型
                const _exhaustiveCheck: never = block;
                if (process.env.NODE_ENV === 'development') {
                  logger.warn('不支持的块类型:', (_exhaustiveCheck as MessageBlock).type, _exhaustiveCheck);
                }
                break;
              }
            }

            // 如果没有组件，跳过渲染
            if (!blockComponent) return null;

            return (
              <AnimatedBlockWrapper
                key={block.id}
                enableAnimation={enableAnimation}>
                <Box
                  sx={{
                    mb: 1,
                    // 添加额外的 padding
                    pl: extraPaddingLeft,
                    pr: extraPaddingRight
                  }}
                >
                  {blockComponent}
                </Box>
              </AnimatedBlockWrapper>
            );
          })}
        </>
      )}
    </Box>
  );
};

// 辅助函数：比较数组
const areArraysEqual = <T,>(a?: T[], b?: T[]): boolean => {
  if (a === b) return true;
  const arrayA = a ?? [];
  const arrayB = b ?? [];
  if (arrayA.length !== arrayB.length) return false;
  for (let i = 0; i < arrayA.length; i += 1) {
    if (arrayA[i] !== arrayB[i]) return false;
  }
  return true;
};

// 使用自定义比较函数优化 React.memo
export default React.memo(MessageBlockRenderer, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.versions?.length === nextProps.message.versions?.length &&
    areArraysEqual(prevProps.blocks, nextProps.blocks) &&
    prevProps.extraPaddingLeft === nextProps.extraPaddingLeft &&
    prevProps.extraPaddingRight === nextProps.extraPaddingRight
  );
});
