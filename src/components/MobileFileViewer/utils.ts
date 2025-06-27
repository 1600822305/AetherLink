import type { FileType } from './types';

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 获取文件类型
export const getFileType = (fileName: string): FileType => {
  // 处理特殊的无扩展名文件
  const specialTextFiles = [
    // Git相关
    '.gitignore', '.gitattributes', '.gitmodules', '.gitkeep',
    // Docker相关
    '.dockerignore', 'Dockerfile',
    // 配置文件
    '.eslintrc', '.prettierrc', '.babelrc', '.npmrc', '.yarnrc', '.editorconfig',
    // 环境变量文件
    '.env', '.env.local', '.env.development', '.env.production', '.env.test',
    '.env.example', '.env.sample',
    // Shell配置文件
    '.vimrc', '.zshrc', '.bashrc', '.profile', '.bash_profile',
    // 构建文件
    'Makefile', 'Rakefile', 'Gemfile', 'Procfile', 'Vagrantfile', 'Jenkinsfile', 'Caddyfile',
    // 依赖文件
    'requirements.txt', 'Pipfile',
    // 文档文件
    'LICENSE', 'README', 'CHANGELOG', 'CONTRIBUTING', 'AUTHORS',
    'COPYING', 'INSTALL', 'NEWS', 'TODO', 'VERSION'
  ];

  // 检查是否是特殊文件
  const baseName = fileName.split('/').pop() || fileName;
  if (specialTextFiles.includes(baseName)) {
    return 'text';
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || ext === fileName.toLowerCase()) {
    // 没有扩展名，检查是否是已知的文本文件
    return specialTextFiles.includes(fileName) ? 'text' : 'unknown';
  }

  const textExts = [
    // 基础文本文件
    'txt', 'md', 'json', 'xml', 'csv', 'log', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'properties',
    // 配置文件
    'toml', 'htaccess',
    // 数据文件
    'tsv', 'jsonl', 'ndjson', 'geojson',
    // 标记语言
    'rst', 'tex', 'adoc', 'asciidoc',
    // 补丁文件
    'patch', 'diff',
    // 锁文件
    'lock'
  ];

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];

  const codeExts = [
    // Web前端
    'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'sass', 'less',
    'vue', 'svelte', 'astro', 'coffee',
    // 模板引擎
    'pug', 'jade', 'ejs', 'hbs', 'handlebars', 'liquid', 'jinja', 'j2',
    // 后端语言
    'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go',
    'rs', 'swift', 'kt', 'scala', 'sh', 'bash', 'ps1', 'sql', 'r',
    // 其他编程语言
    'm', 'jl', 'ex', 'exs', 'clj', 'cljs', 'fs', 'fsx', 'nim', 'zig',
    // 脚本和其他
    'dart', 'lua', 'perl', 'pl',
    // 构建文件
    'gradle'
  ];
  const pdfExts = ['pdf'];

  if (textExts.includes(ext)) return 'text';
  if (imageExts.includes(ext)) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (pdfExts.includes(ext)) return 'pdf';

  return 'unknown';
};

// 获取编程语言
export const getLanguage = (fileName: string): string => {
  // 处理特殊的无扩展名文件
  const baseName = fileName.split('/').pop() || fileName;
  const specialFileLanguages: Record<string, string> = {
    // Git相关
    '.gitignore': 'gitignore',
    '.gitattributes': 'gitattributes',
    // Docker相关
    '.dockerignore': 'dockerignore',
    'Dockerfile': 'dockerfile',
    // 配置文件
    '.eslintrc': 'json',
    '.prettierrc': 'json',
    '.babelrc': 'json',
    '.npmrc': 'ini',
    '.yarnrc': 'yaml',
    '.editorconfig': 'ini',
    '.vimrc': 'vim',
    '.zshrc': 'shell',
    '.bashrc': 'shell',
    '.profile': 'shell',
    '.bash_profile': 'shell',
    // 环境变量文件
    '.env': 'properties',
    '.env.local': 'properties',
    '.env.development': 'properties',
    '.env.production': 'properties',
    '.env.test': 'properties',
    '.env.example': 'properties',
    '.env.sample': 'properties',
    // 构建文件
    'Makefile': 'makefile',
    'Rakefile': 'ruby',
    'Gemfile': 'ruby',
    'Procfile': 'yaml',
    'Vagrantfile': 'ruby',
    'Jenkinsfile': 'groovy',
    'Caddyfile': 'caddyfile',
    'build.gradle': 'gradle',
    // 依赖文件
    'requirements.txt': 'text',
    'Pipfile': 'toml',
    'package.json': 'json',
    'composer.json': 'json',
    'package-lock.json': 'json',
    'yarn.lock': 'yaml',
    'Gemfile.lock': 'text',
    // 文档文件
    'LICENSE': 'text',
    'README': 'markdown',
    'CHANGELOG': 'markdown',
    'CONTRIBUTING': 'markdown',
    'AUTHORS': 'text',
    'COPYING': 'text',
    'INSTALL': 'text',
    'NEWS': 'text',
    'TODO': 'text',
    'VERSION': 'text',
    // CI/CD配置
    '.travis.yml': 'yaml',
    'docker-compose.yml': 'yaml',
    'docker-compose.yaml': 'yaml'
  };

  if (specialFileLanguages[baseName]) {
    return specialFileLanguages[baseName];
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || ext === fileName.toLowerCase()) {
    return 'text';
  }

  const langMap: Record<string, string> = {
    // Web前端
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    'less': 'css',
    'vue': 'vue',
    'svelte': 'svelte',
    'astro': 'astro',
    'coffee': 'coffeescript',
    // 模板引擎
    'pug': 'pug',
    'jade': 'pug',
    'ejs': 'ejs',
    'hbs': 'handlebars',
    'handlebars': 'handlebars',
    'liquid': 'liquid',
    'jinja': 'jinja2',
    'j2': 'jinja2',
    // 后端语言
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'shell',
    'bash': 'shell',
    'ps1': 'powershell',
    'sql': 'sql',
    'r': 'r',
    // 其他编程语言
    'm': 'matlab',
    'jl': 'julia',
    'ex': 'elixir',
    'exs': 'elixir',
    'clj': 'clojure',
    'cljs': 'clojure',
    'fs': 'fsharp',
    'fsx': 'fsharp',
    'nim': 'nim',
    'zig': 'zig',
    'dart': 'dart',
    'lua': 'lua',
    'perl': 'perl',
    'pl': 'perl',
    // 数据和配置
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'nginx',
    'cfg': 'ini',
    'properties': 'properties',
    'csv': 'csv',
    'tsv': 'csv',
    'jsonl': 'json',
    'ndjson': 'json',
    'geojson': 'json',
    // 标记语言
    'md': 'markdown',
    'rst': 'restructuredtext',
    'tex': 'latex',
    'adoc': 'asciidoc',
    'asciidoc': 'asciidoc',
    // 构建文件
    'gradle': 'gradle',
    // 补丁文件
    'patch': 'diff',
    'diff': 'diff',
    // 其他
    'lock': 'text',
    'log': 'log',
    'htaccess': 'apache'
  };

  return langMap[ext] || 'text';
};

// 判断文件是否可编辑
export const isEditableFile = (fileName: string): boolean => {
  const fileType = getFileType(fileName);
  return fileType === 'text' || fileType === 'code';
};


