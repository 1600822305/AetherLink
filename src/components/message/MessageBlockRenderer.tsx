import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Box, Fade } from '@mui/material';
import type { RootState } from '../../shared/store';
import { messageBlocksSelectors } from '../../shared/store/slices/messageBlocksSlice';
import type { MessageBlock, Message, ImageMessageBlock, VideoMessageBlock } from '../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../shared/types/newMessage';


// 直接导入块组件，与最佳实例保持一致
import MainTextBlock from './blocks/MainTextBlock';
import ThinkingBlock from './blocks/ThinkingBlock';
import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import { CodeBlockView } from '../CodeBlockView';
import CitationBlock from './blocks/CitationBlock';
import ErrorBlock from './blocks/ErrorBlock';
import TranslationBlock from './blocks/TranslationBlock';
import MathBlock from './blocks/MathBlock';
import MultiModelBlock from './blocks/MultiModelBlock';
import ModelComparisonBlock from './blocks/ModelComparisonBlock';
import ChartBlock from './blocks/ChartBlock';
import FileBlock from './blocks/FileBlock';
import PlaceholderBlock from './blocks/PlaceholderBlock';
import SearchResultsBlock from './blocks/SearchResultsBlock';
import KnowledgeReferenceBlock from './blocks/KnowledgeReferenceBlock';
import ContextSummaryBlock from './blocks/ContextSummaryBlock';
import ToolBlock from './blocks/ToolBlock';

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
  // const theme = useTheme(); // 暂时不需要
  // 从Redux状态中获取块实体
  const blockEntities = useSelector((state: RootState) => messageBlocksSelectors.selectEntities(state));

  // 简化版本，不依赖事件监听，直接从Redux状态读取

  // 获取所有有效的块 - 与最佳实例保持一致，不进行排序
  const renderedBlocks = useMemo(() => {
    // 只渲染存在于Redux状态中的块，按照 blocks 数组的原始顺序
    const validBlocks = blocks
      .map((blockId) => blockEntities[blockId])
      .filter(Boolean) as MessageBlock[];

    // 与最佳实例保持一致：不对块进行排序，保持原始顺序
    // 这样确保工具块显示在正确的位置（通常在主文本块之后）
    return validBlocks;
  }, [blocks, blockEntities]);

  // 对块进行分组（图片分组、视频去重）
  const groupedBlocks = useMemo(() => groupSimilarBlocks(renderedBlocks), [renderedBlocks]);

  // 检查消息是否正在处理中（参考 Cherry Studio 的 isMessageProcessing）
  const isProcessing = useMemo(() => {
    return message.status === 'streaming' || 
           message.status === 'processing' || 
           message.status === 'pending';
  }, [message.status]);

  // 是否启用动画
  const enableAnimation = message.status.includes('ing');

  return (
    <Box sx={{ width: '100%' }}>
      {(
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

            switch (block.type) {
              case MessageBlockType.UNKNOWN:
                // 参考最佳实例逻辑：PROCESSING状态下渲染占位符块，SUCCESS状态下当作主文本块处理
                if (block.status === MessageBlockStatus.PROCESSING) {
                  blockComponent = <PlaceholderBlock key={block.id} block={block} />;
                } else if (block.status === MessageBlockStatus.SUCCESS) {
                  // 兼容性处理：将 UNKNOWN 类型的成功状态块当作主文本块处理
                  blockComponent = <MainTextBlock key={block.id} block={block as any} role={message.role} messageId={message.id} />;
                }
                break;
              case MessageBlockType.MAIN_TEXT:
                blockComponent = <MainTextBlock key={block.id} block={block} role={message.role} messageId={message.id} />;
                break;
              case MessageBlockType.THINKING:
                blockComponent = <ThinkingBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.IMAGE:
                // 单独的图片块（非连续分组的情况）
                blockComponent = <ImageBlock key={block.id} block={block} isSingle={true} />;
                break;
              case MessageBlockType.VIDEO:
                blockComponent = <VideoBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.CODE:
                // 使用新版 CodeBlockView
                blockComponent = (
                  <CodeBlockView 
                    key={block.id} 
                    language={(block as any).language || 'text'}
                  >
                    {(block as any).content || ''}
                  </CodeBlockView>
                );
                break;
              case MessageBlockType.CITATION:
                blockComponent = <CitationBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.ERROR:
                blockComponent = <ErrorBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.TRANSLATION:
                blockComponent = <TranslationBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.MATH:
                blockComponent = <MathBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.MULTI_MODEL:
                // 检查是否是对比分析块
                if ('subType' in block && (block as any).subType === 'comparison') {
                  blockComponent = <ModelComparisonBlock key={block.id} block={block as any} />;
                } else {
                  blockComponent = <MultiModelBlock key={block.id} block={block as any} />;
                }
                break;
              case MessageBlockType.CHART:
                blockComponent = <ChartBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.FILE:
                blockComponent = <FileBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.TOOL:
                // 工具块按 message.blocks 顺序独立渲染
                blockComponent = <ToolBlock key={block.id} block={block as any} />;
                break;
              case MessageBlockType.SEARCH_RESULTS:
                blockComponent = <SearchResultsBlock key={block.id} block={block as any} />;
                break;
              case MessageBlockType.KNOWLEDGE_REFERENCE:
                blockComponent = <KnowledgeReferenceBlock key={block.id} block={block as any} />;
                break;
              case MessageBlockType.CONTEXT_SUMMARY:
                blockComponent = <ContextSummaryBlock key={block.id} block={block as any} />;
                break;
              default:
                console.warn('不支持的块类型:', (block as any).type, block);
                break;
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
          {/* 
            处理中占位符（参考 Cherry Studio）
            只在消息没有任何块（或没有 PROCESSING 状态的块）时显示
            避免与实际的占位符块重复渲染
          */}
          {isProcessing && renderedBlocks.length === 0 && (
            <AnimatedBlockWrapper key="message-loading-placeholder" enableAnimation={true}>
              <PlaceholderBlock
                block={{
                  id: `loading-${message.id}`,
                  messageId: message.id,
                  type: MessageBlockType.UNKNOWN,
                  status: MessageBlockStatus.PROCESSING,
                  createdAt: new Date().toISOString()
                }}
              />
            </AnimatedBlockWrapper>
          )}
        </>
      )}
    </Box>
  );
};

export default React.memo(MessageBlockRenderer);
