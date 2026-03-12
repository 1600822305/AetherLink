/**
 * 文件编辑相关工具定义
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const INSERT_CONTENT_TOOL: Tool = {
  name: 'insert_content',
  description: '在文件的指定行插入内容。内容将插入到指定行之前。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件的完整路径'
      },
      line: {
        type: 'number',
        description: '插入位置的行号 (1-based)。内容将插入到该行之前。使用 1 在文件开头插入。'
      },
      content: {
        type: 'string',
        description: '要插入的内容'
      }
    },
    required: ['path', 'line', 'content']
  }
};

export const APPLY_DIFF_TOOL: Tool = {
  name: 'apply_diff',
  description: '对文件应用精确编辑。支持 unified diff 和 SEARCH/REPLACE 格式（推荐）。可包含多个替换块，支持模糊匹配。编辑前先用 read_file 获取最新内容。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要修改的文件的完整路径'
      },
      diff: {
        type: 'string',
        description: 'Diff 内容 (unified diff 或 SEARCH/REPLACE 格式)'
      },
      strategy: {
        type: 'string',
        enum: ['unified', 'search-replace', 'auto'],
        description: 'Diff 策略: unified(传统), search-replace(推荐), auto(自动检测)。默认 auto'
      },
      fuzzy_threshold: {
        type: 'number',
        description: '模糊匹配阈值 (0-1)，默认 0.9。值越高要求越精确'
      }
    },
    required: ['path', 'diff']
  }
};

export const REPLACE_IN_FILE_TOOL: Tool = {
  name: 'replace_in_file',
  description: '在文件中查找并替换内容。支持正则表达式。',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件的完整路径'
      },
      search: {
        type: 'string',
        description: '要查找的字符串或正则表达式'
      },
      replace: {
        type: 'string',
        description: '替换为的内容'
      },
      is_regex: {
        type: 'boolean',
        description: '是否使用正则表达式，默认 false'
      },
      replace_all: {
        type: 'boolean',
        description: '是否替换所有匹配项，默认 true'
      }
    },
    required: ['path', 'search', 'replace']
  }
};
