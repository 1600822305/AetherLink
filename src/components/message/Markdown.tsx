import 'katex/dist/katex-swap.css';
import './markdown.css';

import React, { useMemo, memo, useCallback } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
// @ts-ignore rehype-mathjax is not typed
import rehypeMathjax from 'rehype-mathjax';
import rehypeRaw from 'rehype-raw';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';
import { Link } from '@mui/material';
import { isEmpty, omit } from 'lodash';
import type { MainTextMessageBlock, TranslationMessageBlock, ThinkingMessageBlock } from '../../shared/types/newMessage';
import { processLatexBrackets, removeSvgEmptyLines } from '../../utils/formats';
import { getCodeBlockId, removeTrailingDoubleSpaces } from '../../utils/markdown';
import { getAppSettings } from '../../shared/utils/settingsUtils';
import remarkDisableConstructs from '../../utils/remarkDisableConstructs';
import MarkdownCodeBlock from './blocks/MarkdownCodeBlock';
import AdvancedImagePreview from './blocks/AdvancedImagePreview';
import CitationTooltip from './CitationTooltip';
import { findCitationInChildren, parseCitationData } from '../../shared/utils/citation';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('Markdown');

const ALLOWED_ELEMENTS = /<(style|p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody|h[1-6]|blockquote|pre|code|br|hr|svg|path|circle|rect|line|polyline|polygon|text|g|defs|title|desc|tspan|sub|sup)/i;
const DISALLOWED_ELEMENTS = ['iframe'];

// 在 Markdown 组件中传递角色信息
interface Props {
  block?: MainTextMessageBlock | TranslationMessageBlock | ThinkingMessageBlock;
  content?: string;
  allowHtml?: boolean;
  // 新增：消息角色
  messageRole?: 'user' | 'assistant' | 'system';
  // 新增：是否正在流式输出
  isStreaming?: boolean;
  // 新增：内容后处理函数（用于引用转换等）
  postProcess?: (content: string) => string;
}

const Markdown: React.FC<Props> = ({ block, content, allowHtml = false, messageRole, isStreaming = false, postProcess }) => {
  // 从用户设置获取数学引擎配置
  // 使用 useState 和 useEffect 来监听设置变化
  const [mathEngine, setMathEngine] = React.useState<string>('KaTeX');
  const [mathEnableSingleDollar, setMathEnableSingleDollar] = React.useState<boolean>(true);

  React.useEffect(() => {
    const updateMathSettings = () => {
      const settings = getAppSettings();
      setMathEngine(settings.mathRenderer || 'KaTeX');
      setMathEnableSingleDollar(settings.mathEnableSingleDollar !== undefined ? settings.mathEnableSingleDollar : true);
    };

    // 初始加载
    updateMathSettings();

    // 监听 localStorage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        updateMathSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 监听自定义事件（同一页面内的设置变化）
    const handleSettingsChange = () => {
      updateMathSettings();
    };

    window.addEventListener('appSettingsChanged', handleSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
    };
  }, []);

  const remarkPlugins = useMemo((): PluggableList => {
    const plugins: PluggableList = [
      remarkGfm,
      remarkCjkFriendly,
      // 禁用缩进代码块，防止带缩进的普通文本被误识别为代码块
      remarkDisableConstructs(['codeIndented'])
    ];
    // 只有当数学引擎不是 'none' 时才添加数学支持
    if (mathEngine !== 'none') {
      // 配置 remark-math 插件
      // singleDollarTextMath: true 表示启用单美元符号 $...$
      plugins.push([remarkMath, { singleDollarTextMath: mathEnableSingleDollar }]);
    }
    return plugins;
  }, [mathEngine, mathEnableSingleDollar]);

  const messageContent = useMemo(() => {
    let processedContent = '';

    // 优先使用 content 参数（兼容旧接口）
    if (content !== undefined) {
      processedContent = content || '';
    } else {
      // 使用 block 参数（新接口）
      if (!block) return '';

      const empty = isEmpty(block.content);
      const paused = block.status === 'paused';
      processedContent = empty && paused ? '消息已暂停' : block.content || '';
    }

    // 应用所有转换：移除行末双空格 -> LaTeX括号转换（保护代码块） -> 移除SVG空行
    processedContent = removeTrailingDoubleSpaces(processedContent);
    processedContent = processLatexBrackets(processedContent);
    processedContent = removeSvgEmptyLines(processedContent);
    
    // 应用自定义后处理（如引用转换）
    if (postProcess) {
      processedContent = postProcess(processedContent);
    }

    return processedContent;
  }, [block, content, postProcess]);

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (allowHtml && ALLOWED_ELEMENTS.test(messageContent)) {
      plugins.push(rehypeRaw);
    }
    if (mathEngine === 'KaTeX') {
      plugins.push(rehypeKatex as any);
    } else if (mathEngine === 'MathJax') {
      plugins.push(rehypeMathjax as any);
    }
    return plugins;
  }, [mathEngine, messageContent, allowHtml]);

  const onSaveCodeBlock = useCallback(
    (id: string, newContent: string) => {
      // TODO: 实现代码块保存逻辑
      logger.info('保存代码块:', id, newContent);
    },
    []
  );

  const components = useMemo(() => {
    return {
      // 自定义链接渲染：检测引用链接并包装 CitationTooltip
      a: (props: any) => {
        // 检查子元素中是否包含 <sup> 标签（引用格式）
        const isCitation = React.Children.toArray(props.children).some((child: any) => {
          if (typeof child === 'object' && child !== null && 'type' in child) {
            return child.type === 'sup';
          }
          return false;
        });
        
        // 查找引用数据
        const citationDataStr = findCitationInChildren(props.children);
        const citationData = citationDataStr ? parseCitationData(citationDataStr) : null;
        
        // 如果是引用链接且有引用数据，使用 CitationTooltip 包装
        // 注意：移除 href 和默认点击行为，由 CitationTooltip 控制
        if (isCitation && citationData) {
          return (
            <CitationTooltip citation={citationData}>
              <span
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                {props.children}
              </span>
            </CitationTooltip>
          );
        }
        
        // 普通链接
        return <Link {...omit(props, ['node'])} target="_blank" rel="noopener noreferrer" />;
      },
      code: (props: any) => (
        <MarkdownCodeBlock
          {...props}
          id={getCodeBlockId(props?.node?.position?.start)}
          onSave={onSaveCodeBlock}
          messageRole={messageRole}
          isStreaming={isStreaming}
        />
      ),
      img: AdvancedImagePreview,
      video: (props: any) => (
        <video
          {...props}
          controls
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            borderRadius: '8px',
            backgroundColor: '#000'
          }}
          preload="metadata"
        />
      ),
      pre: (props: any) => <pre style={{ overflow: 'visible' }} {...props} />,
      table: (props: any) => (
        <div className="markdown-table-container">
          <table {...props} />
        </div>
      )
    } as Partial<Components>;
  }, [onSaveCodeBlock, messageRole, isStreaming]);

  return (
    <div className="markdown">
      <ReactMarkdown
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        components={components}
        disallowedElements={DISALLOWED_ELEMENTS}
        remarkRehypeOptions={{
          footnoteLabel: '脚注',
          footnoteLabelTagName: 'h4',
          footnoteBackContent: ' '
        }}
      >
        {messageContent}
      </ReactMarkdown>
    </div>
  );
};

export default memo(Markdown);