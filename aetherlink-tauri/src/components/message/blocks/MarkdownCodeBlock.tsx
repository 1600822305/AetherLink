import React, { useMemo, memo } from 'react';
import { useTheme } from '@mui/material';
import { useAppSelector } from '../../../shared/store';
import CodeBlock from './CodeBlock';
import EnhancedCodeBlock from './EnhancedCodeBlock';
import MermaidBlock from './MermaidBlock';
import Markdown from '../Markdown';
import type { CodeMessageBlock } from '../../../shared/types/newMessage';

// 需要接收并传递 messageRole
interface MarkdownCodeBlockProps {
  children: string;
  className?: string;
  id?: string;
  onSave?: (id: string, newContent: string) => void;
  [key: string]: any;
  messageRole?: 'user' | 'assistant' | 'system';
}

/**
 * Markdown 中的代码块组件
 * 将 Markdown 的 props 适配到我们的 CodeBlock 组件
 */
const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  children,
  className,
  id,
  messageRole 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // 从 Redux store 获取代码块设置
  const { codeEditor, codeShowLineNumbers, codeCollapsible, codeWrappable } = useAppSelector(state => state.settings);

  // 判断是否使用增强版代码块（当启用了任何高级功能时）
  const useEnhancedCodeBlock = codeEditor || codeShowLineNumbers || codeCollapsible || codeWrappable;

  // 解析语言
  const match = /language-([\w-+]+)/.exec(className || '');
  const language = match?.[1] ?? 'text';
  const isCodeBlock = !!match || children?.includes('\n');

  // 创建适配的代码块对象 - 使用 useMemo 来稳定对象引用
  // 注意：必须在所有条件判断之前调用 Hook
  const codeBlock: CodeMessageBlock = useMemo(() => ({
    id: id || `code-${children.slice(0, 50).replace(/\W/g, '')}-${language}`,
    messageId: 'markdown',
    type: 'code' as const,
    content: children,
    language: language,
    createdAt: new Date().toISOString(),
    status: 'success' as const
  }), [id, children, language]);

  // **检测 Mermaid 图表时传递角色**
  if (language === 'mermaid') {
    return <MermaidBlock code={children} id={id} messageRole={messageRole} />;
  }

  /**
   * 🔧 表格检测和自动转换功能
   *
   * 问题背景：
   * AI有时会错误地将Markdown表格包裹在代码块中，例如：
   * ```
   * | 列1 | 列2 | 列3 |
   * |-----|-----|-----|
   * | 数据1 | 数据2 | 数据3 |
   * ```
   *
   * 这会导致表格被显示为代码块（带有"TEXT"标签），而不是正确的表格格式。
   *
   * 解决方案：
   * 当检测到代码块语言为'text'且内容符合Markdown表格语法时，
   * 自动将其转换为Markdown渲染，从而正确显示为表格。
   *
   * 检测条件：
   * 1. 语言标识为'text'或空字符串
   * 2. 包含表格分隔行（如 |---|---|---| 或 |:---:|:---:|---:|）
   * 3. 至少有2行包含管道符分隔的内容
   *
   * 注意：此功能是为了修复AI输出格式问题，如果未来AI输出格式改善，可以考虑移除。
   */
  const isTableContent = useMemo(() => {
    // 只处理text类型的代码块
    if (language !== 'text' && language !== '') return false;

    // 分割并过滤空行
    const lines = children.split('\n').filter(line => line.trim());
    if (lines.length < 2) return false;

    // 检查是否有表格分隔行（包含 --- 或 :---: 等对齐语法）
    const hasSeparatorRow = lines.some(line =>
      /^\s*\|?[\s\-:]+\|[\s\-:|]*\|?\s*$/.test(line)
    );

    // 检查是否有多行包含管道符分隔的内容（至少3列）
    const tableRows = lines.filter(line =>
      line.includes('|') && line.split('|').length >= 3
    );

    // 必须同时满足：有分隔行 + 至少2行表格数据
    return hasSeparatorRow && tableRows.length >= 2;
  }, [children, language]);

  // 如果检测到表格内容，使用Markdown组件渲染而不是代码块
  if (isTableContent) {
    return (
      <div style={{ margin: '16px 0' }}>
        <Markdown content={children} allowHtml={false} />
      </div>
    );
  }

  // 注意：数学公式由 Markdown 层面的插件处理
  // CodeBlock 专注于代码渲染

  // 如果不是代码块，返回行内代码
  if (!isCodeBlock) {
    return (
      <code
        className={className}
        style={{
          textWrap: 'wrap',
          fontFamily: 'monospace',
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          padding: '2px 4px',
          borderRadius: '4px'
        }}
      >
        {children}
      </code>
    );
  }

  // 移除数学公式特殊处理，统一由 Markdown 层面处理

  // 根据设置选择使用哪个代码块组件
  if (useEnhancedCodeBlock) {
    return <EnhancedCodeBlock block={codeBlock} />;
  } else {
    return <CodeBlock block={codeBlock} />;
  }
};

export default memo(MarkdownCodeBlock);
