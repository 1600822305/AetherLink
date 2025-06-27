import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Box, Fade } from '@mui/material';
import type { RootState } from '../../shared/store';
import { messageBlocksSelectors } from '../../shared/store/slices/messageBlocksSlice';
import type { MessageBlock, Message } from '../../shared/types/newMessage';
import { MessageBlockType, MessageBlockStatus } from '../../shared/types/newMessage';


// 直接导入块组件，与最佳实例保持一致
import MainTextBlock from './blocks/MainTextBlock';
import ThinkingBlock from './blocks/ThinkingBlock';
import ImageBlock from './blocks/ImageBlock';
import VideoBlock from './blocks/VideoBlock';
import CodeBlock from './blocks/CodeBlock';
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
// import ToolBlock from './blocks/ToolBlock'; // 已移除：工具块在 MainTextBlock 中原位渲染

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

  // 检查是否有空内容的成功状态块
  const hasEmptySuccessBlock = useMemo(() => {
    if (renderedBlocks.length === 0) return false;

    // 如果消息状态是 streaming、processing 或 success，不显示错误
    if (message.status === 'streaming' || message.status === 'processing' || message.status === 'success') {
      return false;
    }

    // 如果消息有版本历史，不显示错误
    if (message.versions && message.versions.length > 0) {
      return false;
    }

    return renderedBlocks.some(block =>
      block.type === MessageBlockType.MAIN_TEXT &&
      block.status === MessageBlockStatus.SUCCESS &&
      (!('content' in block) || !(block as any).content || (block as any).content.trim() === '')
    );
  }, [renderedBlocks, message.status, message.versions]);

  // 是否启用动画
  const enableAnimation = message.status.includes('ing');

  return (
    <Box sx={{ width: '100%' }}>
      {/* 只有在没有渲染块且消息状态为streaming时才显示占位符 */}
      {renderedBlocks.length === 0 && message.status === 'streaming' ? (
        renderPlaceholder()
      ) : hasEmptySuccessBlock ? (
        renderEmptyContentMessage()
      ) : (
        <>
          {/* 渲染所有块 */}
          {renderedBlocks.map((block) => {
            let blockComponent: React.ReactNode = null;

            // 处理空内容的成功状态块
            if (block.type === MessageBlockType.MAIN_TEXT &&
                block.status === MessageBlockStatus.SUCCESS &&
                (!('content' in block) || !(block as any).content || (block as any).content.trim() === '') &&
                message.status !== 'streaming' &&
                message.status !== 'processing' &&
                message.status !== 'success' &&
                (!message.versions || message.versions.length === 0)) {
              return renderEmptyContentMessage();
            }

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
                blockComponent = <ImageBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.VIDEO:
                blockComponent = <VideoBlock key={block.id} block={block} />;
                break;
              case MessageBlockType.CODE:
                blockComponent = <CodeBlock key={block.id} block={block} />;
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
                // 🔧 修复工具块重复渲染问题：
                // 工具块已经在 MainTextBlock 中原位渲染，这里跳过避免重复显示
                blockComponent = null;
                break;
              case MessageBlockType.SEARCH_RESULTS:
                blockComponent = <SearchResultsBlock key={block.id} block={block as any} />;
                break;
              case MessageBlockType.KNOWLEDGE_REFERENCE:
                blockComponent = <KnowledgeReferenceBlock key={block.id} block={block as any} />;
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
        </>
      )}
    </Box>
  );
};

export default React.memo(MessageBlockRenderer);
