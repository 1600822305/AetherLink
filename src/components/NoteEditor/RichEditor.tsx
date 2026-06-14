import { useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import { useEditor, EditorContent } from '@tiptap/react';
import { getEditorExtensions } from './extensions';
import Toolbar from './Toolbar';
import type { RichEditorProps, RichEditorRef } from './types';
import { htmlToMarkdown, markdownToHtml } from './utils/markdown';
import { createLogger } from '../../shared/services/infra/logger';
import './styles.css';

const logger = createLogger('RichEditor');

const RichEditor = forwardRef<RichEditorRef, RichEditorProps>((props, ref) => {
  const {
    initialContent,
    onMarkdownChange,
    showToolbar = true,
    editable = true,
    className = '',
    isFullWidth = false,
    fontSize = 16,
    fontFamily = 'system-ui, -apple-system, sans-serif',
    enableSpellCheck = false
  } = props;

  // 缓存扩展配置，避免重复创建
  const extensions = useMemo(() => getEditorExtensions(), []);

  const editor = useEditor({
    extensions,
    content: markdownToHtml(initialContent), // 将 Markdown 转换为 HTML
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none',
        spellcheck: enableSpellCheck ? 'true' : 'false'
      }
    },
    onUpdate: ({ editor }) => {
      // 获取 HTML 内容并转换为 Markdown
      const htmlContent = editor.getHTML();
      try {
        const markdown = htmlToMarkdown(htmlContent);
        onMarkdownChange(markdown);
      } catch (error) {
        logger.error('Error converting HTML to Markdown:', error);
        // 降级方案：保存纯文本
        onMarkdownChange(editor.getText());
      }
    }
  });

  useEffect(() => {
    if (editor) {
      const currentMarkdown = htmlToMarkdown(editor.getHTML());
      if (initialContent !== currentMarkdown) {
        editor.commands.setContent(markdownToHtml(initialContent));
      }
    }
  }, [initialContent, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  const getMarkdown = useCallback(() => {
    if (!editor) return '';
    try {
      return htmlToMarkdown(editor.getHTML());
    } catch (error) {
      logger.error('Error getting markdown:', error);
      return editor.getText();
    }
  }, [editor]);

  const setMarkdown = useCallback(
    (markdown: string) => {
      if (!editor) return;
      try {
        editor.commands.setContent(markdownToHtml(markdown));
      } catch (error) {
        logger.error('Error setting markdown:', error);
        editor.commands.setContent(markdown);
      }
    },
    [editor]
  );

  const getContent = useCallback(() => {
    return editor?.getHTML() || '';
  }, [editor]);

  const clear = useCallback(() => {
    editor?.commands.clearContent();
  }, [editor]);

  useImperativeHandle(ref, () => ({
    getMarkdown,
    setMarkdown,
    getContent,
    clear
  }));

  if (!editor) {
    return null;
  }

  return (
    <Box
      className={`rich-editor-container ${className}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: 'background.paper'
      }}
    >
      {showToolbar && <Toolbar editor={editor} />}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          width: isFullWidth ? '100%' : '60%',
          maxWidth: isFullWidth ? '100%' : '900px',
          margin: isFullWidth ? 0 : '0 auto',
          fontSize: `${fontSize}px`,
          fontFamily: fontFamily,
          '& .ProseMirror': {
            minHeight: '100%',
            outline: 'none',
            '& p': {
              margin: '0.5em 0'
            },
            '& h1': {
              fontSize: '2em',
              fontWeight: 'bold',
              margin: '0.67em 0'
            },
            '& h2': {
              fontSize: '1.5em',
              fontWeight: 'bold',
              margin: '0.75em 0'
            },
            '& h3': {
              fontSize: '1.17em',
              fontWeight: 'bold',
              margin: '0.83em 0'
            },
            '& ul, & ol': {
              paddingLeft: '2em',
              margin: '0.5em 0'
            },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'divider',
              paddingLeft: '1em',
              margin: '1em 0',
              color: 'text.secondary'
            },
            '& code': {
              backgroundColor: 'action.hover',
              padding: '0.2em 0.4em',
              borderRadius: '3px',
              fontSize: '0.9em',
              fontFamily: 'monospace'
            },
            '& pre': {
              backgroundColor: 'action.hover',
              padding: '1em',
              borderRadius: '4px',
              overflow: 'auto',
              '& code': {
                backgroundColor: 'transparent',
                padding: 0
              }
            },
            '& hr': {
              border: 'none',
              borderTop: '2px solid',
              borderColor: 'divider',
              margin: '2em 0'
            }
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
});

RichEditor.displayName = 'RichEditor';

export default RichEditor;
