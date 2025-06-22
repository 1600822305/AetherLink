import 'katex/dist/katex.min.css';
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
import { Link } from '@mui/material';
import { isEmpty } from 'lodash';
import type { MainTextMessageBlock, TranslationMessageBlock, ThinkingMessageBlock } from '../../shared/types/newMessage';
import { escapeBrackets, removeSvgEmptyLines, convertMathFormula } from '../../utils/formats';
import { getCodeBlockId } from '../../utils/markdown';
import { getAppSettings } from '../../shared/utils/settingsUtils';
import MarkdownCodeBlock from './blocks/MarkdownCodeBlock';
import AdvancedImagePreview from './blocks/AdvancedImagePreview';

const ALLOWED_ELEMENTS = /<(style|p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody|h[1-6]|blockquote|pre|code|br|hr|svg|path|circle|rect|line|polyline|polygon|text|g|defs|title|desc|tspan|sub|sup)/i;
const DISALLOWED_ELEMENTS = ['iframe'];

// 在 Markdown 组件中传递角色信息
interface Props {
  block?: MainTextMessageBlock | TranslationMessageBlock | ThinkingMessageBlock;
  content?: string;
  allowHtml?: boolean;
  // 新增：消息角色
  messageRole?: 'user' | 'assistant' | 'system';
}

const Markdown: React.FC<Props> = ({ block, content, allowHtml = false, messageRole }) => {
  // 从用户设置获取数学引擎配置
  // 使用 useState 和 useEffect 来监听设置变化
  const [mathEngine, setMathEngine] = React.useState<string>('KaTeX');

  React.useEffect(() => {
    const updateMathEngine = () => {
      const settings = getAppSettings();
      setMathEngine(settings.mathRenderer || 'KaTeX');
    };

    // 初始加载
    updateMathEngine();

    // 监听 localStorage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appSettings') {
        updateMathEngine();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 监听自定义事件（同一页面内的设置变化）
    const handleSettingsChange = () => {
      updateMathEngine();
    };

    window.addEventListener('appSettingsChanged', handleSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
    };
  }, []);

  const remarkPlugins = useMemo(() => {
    const plugins = [remarkGfm, remarkCjkFriendly];
    // 只有当数学引擎不是 'none' 时才添加数学支持
    if (mathEngine !== 'none') {
      plugins.push(remarkMath);
    }
    return plugins;
  }, [mathEngine]);

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

    // 应用所有转换：数学公式 -> 转义括号 -> 移除SVG空行
    processedContent = convertMathFormula(processedContent);
    processedContent = escapeBrackets(processedContent);
    processedContent = removeSvgEmptyLines(processedContent);

    return processedContent;
  }, [block, content]);

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
      console.log('保存代码块:', id, newContent);
    },
    []
  );

  const components = useMemo(() => {
    return {
      a: (props: any) => <Link {...props} target="_blank" rel="noopener noreferrer" />,
      code: (props: any) => (
        <MarkdownCodeBlock
          {...props}
          id={getCodeBlockId(props?.node?.position?.start)}
          onSave={onSaveCodeBlock}
          messageRole={messageRole}
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
  }, [onSaveCodeBlock, messageRole]);

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