import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import type { Editor } from '@tiptap/core'
import type { MentionNodeAttrs } from '@tiptap/extension-mention'
import { posToDOMRect, ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { LucideIcon } from 'lucide-react'
import {
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Type,
  Underline,
  Undo,
  X
} from 'lucide-react'
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('command');

export interface Command {
  id: string
  title: string
  description: string
  category: CommandCategory
  icon: LucideIcon
  keywords: string[]
  handler: (editor: Editor) => void
  isAvailable?: (editor: Editor) => boolean
  showInToolbar?: boolean
  toolbarGroup?: 'text' | 'formatting' | 'blocks' | 'media' | 'structure' | 'history'
  formattingCommand?: string
}

export enum CommandCategory {
  TEXT = 'text',
  LISTS = 'lists',
  BLOCKS = 'blocks',
  MEDIA = 'media',
  STRUCTURE = 'structure',
  SPECIAL = 'special'
}

export interface CommandSuggestion {
  query: string
  range: any
  clientRect?: () => DOMRect | null
}

// 命令注册表
const commandRegistry = new Map<string, Command>()

export function registerCommand(cmd: Command): void {
  commandRegistry.set(cmd.id, cmd)
}

export function unregisterCommand(id: string): void {
  commandRegistry.delete(id)
}

export function getCommand(id: string): Command | undefined {
  return commandRegistry.get(id)
}

export function getAllCommands(): Command[] {
  return Array.from(commandRegistry.values())
}

export function getToolbarCommands(): Command[] {
  return getAllCommands().filter((cmd) => cmd.showInToolbar)
}

export function getCommandsByGroup(group: string): Command[] {
  return getAllCommands().filter((cmd) => cmd.toolbarGroup === group)
}

// 默认命令定义
const DEFAULT_COMMANDS: Command[] = [
  {
    id: 'bold',
    title: '粗体',
    description: '使文本加粗',
    category: CommandCategory.TEXT,
    icon: Bold,
    keywords: ['bold', 'strong', 'b', '粗体', '加粗'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleBold().run()
    },
    showInToolbar: true,
    toolbarGroup: 'formatting',
    formattingCommand: 'bold'
  },
  {
    id: 'italic',
    title: '斜体',
    description: '使文本倾斜',
    category: CommandCategory.TEXT,
    icon: Italic,
    keywords: ['italic', 'emphasis', 'i', '斜体', '倾斜'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleItalic().run()
    },
    showInToolbar: true,
    toolbarGroup: 'formatting',
    formattingCommand: 'italic'
  },
  {
    id: 'underline',
    title: '下划线',
    description: '给文本添加下划线',
    category: CommandCategory.TEXT,
    icon: Underline,
    keywords: ['underline', 'u', '下划线'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleUnderline().run()
    },
    showInToolbar: true,
    toolbarGroup: 'formatting',
    formattingCommand: 'underline'
  },
  {
    id: 'strike',
    title: '删除线',
    description: '给文本添加删除线',
    category: CommandCategory.TEXT,
    icon: Strikethrough,
    keywords: ['strikethrough', 'strike', 's', '删除线'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleStrike().run()
    },
    showInToolbar: true,
    toolbarGroup: 'formatting',
    formattingCommand: 'strike'
  },
  {
    id: 'inlineCode',
    title: '行内代码',
    description: '添加行内代码',
    category: CommandCategory.SPECIAL,
    icon: Code,
    keywords: ['code', 'inline', 'monospace', '代码', '行内'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleCode().run()
    },
    showInToolbar: true,
    toolbarGroup: 'formatting',
    formattingCommand: 'code'
  },
  {
    id: 'paragraph',
    title: '正文',
    description: '普通文本段落',
    category: CommandCategory.TEXT,
    icon: Type,
    keywords: ['text', 'paragraph', 'p', '正文', '段落'],
    handler: (editor: Editor) => {
      editor.chain().focus().setParagraph().run()
    },
    showInToolbar: true,
    toolbarGroup: 'text',
    formattingCommand: 'paragraph'
  },
  {
    id: 'heading1',
    title: '一级标题',
    description: '大型章节标题',
    category: CommandCategory.TEXT,
    icon: Heading1,
    keywords: ['heading', 'h1', 'title', 'big', '标题', '一级'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    showInToolbar: true,
    toolbarGroup: 'text',
    formattingCommand: 'heading1'
  },
  {
    id: 'heading2',
    title: '二级标题',
    description: '中型章节标题',
    category: CommandCategory.TEXT,
    icon: Heading2,
    keywords: ['heading', 'h2', 'subtitle', 'medium', '标题', '二级'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    showInToolbar: true,
    toolbarGroup: 'text',
    formattingCommand: 'heading2'
  },
  {
    id: 'heading3',
    title: '三级标题',
    description: '小型章节标题',
    category: CommandCategory.TEXT,
    icon: Heading3,
    keywords: ['heading', 'h3', 'small', '标题', '三级'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    showInToolbar: true,
    toolbarGroup: 'text',
    formattingCommand: 'heading3'
  },
  {
    id: 'bulletList',
    title: '无序列表',
    description: '创建项目符号列表',
    category: CommandCategory.LISTS,
    icon: List,
    keywords: ['bullet', 'list', 'ul', 'unordered', '列表', '无序'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleBulletList().run()
    },
    showInToolbar: true,
    toolbarGroup: 'blocks',
    formattingCommand: 'bulletList'
  },
  {
    id: 'orderedList',
    title: '有序列表',
    description: '创建带编号的列表',
    category: CommandCategory.LISTS,
    icon: ListOrdered,
    keywords: ['number', 'list', 'ol', 'ordered', '列表', '有序', '编号'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleOrderedList().run()
    },
    showInToolbar: true,
    toolbarGroup: 'blocks',
    formattingCommand: 'orderedList'
  },
  {
    id: 'codeBlock',
    title: '代码块',
    description: '插入代码片段',
    category: CommandCategory.BLOCKS,
    icon: FileCode,
    keywords: ['code', 'block', 'snippet', 'programming', '代码', '代码块'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleCodeBlock().run()
    },
    showInToolbar: true,
    toolbarGroup: 'blocks',
    formattingCommand: 'codeBlock'
  },
  {
    id: 'blockquote',
    title: '引用',
    description: '插入引用块',
    category: CommandCategory.BLOCKS,
    icon: Quote,
    keywords: ['quote', 'blockquote', 'citation', '引用', '引述'],
    handler: (editor: Editor) => {
      editor.chain().focus().toggleBlockquote().run()
    },
    showInToolbar: true,
    toolbarGroup: 'blocks',
    formattingCommand: 'blockquote'
  },
  {
    id: 'divider',
    title: '分割线',
    description: '添加水平分割线',
    category: CommandCategory.STRUCTURE,
    icon: Minus,
    keywords: ['divider', 'hr', 'line', 'separator', '分割线', '分隔符'],
    handler: (editor: Editor) => {
      editor.chain().focus().setHorizontalRule().run()
    }
  },
  {
    id: 'image',
    title: '图片',
    description: '插入图片',
    category: CommandCategory.MEDIA,
    icon: Image,
    keywords: ['image', 'img', 'picture', 'photo', '图片', '图像'],
    handler: (editor: Editor) => {
      const url = prompt('请输入图片URL:')
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    },
    showInToolbar: true,
    toolbarGroup: 'media',
    formattingCommand: 'image'
  },
  {
    id: 'hardBreak',
    title: '换行',
    description: '插入换行符',
    category: CommandCategory.STRUCTURE,
    icon: X,
    keywords: ['break', 'br', 'newline', '换行'],
    handler: (editor: Editor) => {
      editor.chain().focus().setHardBreak().run()
    }
  },
  {
    id: 'undo',
    title: '撤销',
    description: '撤销上一步操作',
    category: CommandCategory.SPECIAL,
    icon: Undo,
    keywords: ['undo', 'revert', '撤销', '回退'],
    handler: (editor: Editor) => {
      editor.chain().focus().undo().run()
    },
    showInToolbar: true,
    toolbarGroup: 'history',
    formattingCommand: 'undo'
  },
  {
    id: 'redo',
    title: '重做',
    description: '重做上一步操作',
    category: CommandCategory.SPECIAL,
    icon: Redo,
    keywords: ['redo', 'repeat', '重做', '恢复'],
    handler: (editor: Editor) => {
      editor.chain().focus().redo().run()
    },
    showInToolbar: true,
    toolbarGroup: 'history',
    formattingCommand: 'redo'
  }
]

export interface CommandFilterOptions {
  query?: string
  category?: CommandCategory
  maxResults?: number
}

// 根据搜索查询和类别过滤命令
export function filterCommands(options: CommandFilterOptions = {}): Command[] {
  const { query = '', category } = options

  let filtered = getAllCommands()

  // 按类别过滤
  if (category) {
    filtered = filtered.filter((cmd) => cmd.category === category)
  }

  // 按搜索查询过滤
  if (query) {
    const searchTerm = query.toLowerCase().trim()
    filtered = filtered.filter((cmd) => {
      const searchableText = [cmd.title, cmd.description, ...cmd.keywords].join(' ').toLowerCase()
      return searchableText.includes(searchTerm)
    })

    // 按相关性排序
    filtered.sort((a, b) => {
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      const aExactMatch = aTitle === searchTerm
      const bExactMatch = bTitle === searchTerm
      const aTitleMatch = aTitle.includes(searchTerm)
      const bTitleMatch = bTitle.includes(searchTerm)

      if (aExactMatch && !bExactMatch) return -1
      if (bExactMatch && !aExactMatch) return 1
      if (aTitleMatch && !bTitleMatch) return -1
      if (bTitleMatch && !aTitleMatch) return 1

      return a.title.localeCompare(b.title)
    })
  }

  return filtered
}

const updatePosition = (editor: Editor, element: HTMLElement) => {
  const virtualElement = {
    getBoundingClientRect: () => posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to)
  }

  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(4),
      flip({
        fallbackPlacements: ['top-start', 'bottom-end', 'top-end', 'bottom-start'],
        padding: 8
      }),
      shift({
        padding: 8
      }),
      size({
        apply({ availableWidth, availableHeight, elements }) {
          const maxHeight = Math.min(400, availableHeight - 16)
          const maxWidth = Math.min(320, availableWidth - 16)

          Object.assign(elements.floating.style, {
            maxHeight: `${maxHeight}px`,
            maxWidth: `${maxWidth}px`,
            minWidth: '240px'
          })
        }
      })
    ]
  })
    .then(({ x, y, strategy, placement }) => {
      Object.assign(element.style, {
        position: strategy,
        left: `${x}px`,
        top: `${y}px`,
        width: 'max-content'
      })

      element.setAttribute('data-placement', placement)
    })
    .catch((error) => {
      logger.error('Error positioning command list:', error)
    })
}

// 初始化默认命令（使用单例模式确保只执行一次）
function initializeDefaultCommands() {
  if (commandRegistry.size === 0) {
    DEFAULT_COMMANDS.forEach(registerCommand)
  }
}

// 立即初始化
initializeDefaultCommands()

// TipTap suggestion 配置
export const commandSuggestion: Omit<SuggestionOptions<Command, MentionNodeAttrs>, 'editor'> = {
  char: '/',
  startOfLine: true,
  items: ({ query }: { query: string }) => {
    try {
      return filterCommands({ query })
    } catch (error) {
      logger.error('Error filtering commands:', error)
      return []
    }
  },
  command: ({ editor, range, props }) => {
    editor.chain().focus().deleteRange(range).run()

    if (props.id) {
      const command = getCommand(props.id)
      if (command) {
        command.handler(editor)
      }
    }
  },

  render: () => {
    let component: ReactRenderer<any, any>
    let cleanup: (() => void) | undefined

    return {
      onStart: async (props) => {
        if (!props?.items || !props?.clientRect) {
          logger.warn('Invalid props in command suggestion onStart')
          return
        }

        // 动态导入 CommandListPopover 以提升首次加载性能
        const { default: CommandListPopover } = await import('./CommandListPopover')

        component = new ReactRenderer(CommandListPopover, {
          props,
          editor: props.editor
        })
        const element = component.element as HTMLElement
        element.style.zIndex = '1001'

        document.body.appendChild(element)

        const virtualElement = {
          getBoundingClientRect: () =>
            posToDOMRect(props.editor.view, props.editor.state.selection.from, props.editor.state.selection.to)
        }

        cleanup = autoUpdate(virtualElement, element, () => {
          updatePosition(props.editor, element)
        })

        updatePosition(props.editor, element)
      },

      onUpdate: (props) => {
        if (!props?.items || !props.clientRect) return

        component.updateProps(props)

        if (component.element) {
          setTimeout(() => {
            updatePosition(props.editor, component.element as HTMLElement)
          }, 0)
        }
      },

      onKeyDown: (props) => {
        const popoverHandled = component.ref?.onKeyDown?.(props.event)
        if (popoverHandled) {
          return true
        }

        if (props.event.key === 'Enter' && props.event.shiftKey) {
          props.event.preventDefault()
          if (cleanup) cleanup()
          component.destroy()
          const { view } = props
          const { state, dispatch } = view
          const { tr } = state
          tr.insertText('\n')
          dispatch(tr)
          return true
        }

        if (props.event.key === 'Escape') {
          if (cleanup) cleanup()
          component.destroy()
          return true
        }

        return false
      },

      onExit: () => {
        if (cleanup) cleanup()
        const element = component.element as HTMLElement
        element.remove()
        component.destroy()
      }
    }
  }
}
