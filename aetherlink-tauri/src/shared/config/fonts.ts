// 字体配置文件
export interface FontOption {
  id: string;
  name: string;
  description: string;
  fontFamily: string[];
  preview: string;
  category: 'system' | 'chinese' | 'english' | 'monospace';
}

// 预设字体选项
export const fontOptions: FontOption[] = [
  {
    id: 'system',
    name: '系统默认',
    description: '跟随系统字体设置，兼容性最佳',
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ],
    preview: '系统默认字体 System Font',
    category: 'system',
  },
  {
    id: 'pingfang',
    name: '苹方',
    description: '苹果设计的中文字体，现代简洁',
    fontFamily: [
      '"PingFang SC"',
      '"PingFang TC"',
      '"PingFang HK"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ],
    preview: '苹方字体 PingFang Font',
    category: 'chinese',
  },
  {
    id: 'noto-sans',
    name: '思源黑体',
    description: 'Google设计的开源中文字体',
    fontFamily: [
      '"Noto Sans SC"',
      '"Noto Sans TC"',
      '"Noto Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      'sans-serif',
    ],
    preview: '思源黑体 Noto Sans',
    category: 'chinese',
  },
  {
    id: 'microsoft-yahei',
    name: '微软雅黑',
    description: '微软设计的中文字体，Windows系统常用',
    fontFamily: [
      '"Microsoft YaHei"',
      '"Microsoft YaHei UI"',
      '"Segoe UI"',
      'Tahoma',
      'Arial',
      'sans-serif',
    ],
    preview: '微软雅黑 Microsoft YaHei',
    category: 'chinese',
  },
  {
    id: 'source-han-sans',
    name: '思源黑体',
    description: 'Adobe与Google合作开发的开源字体',
    fontFamily: [
      '"Source Han Sans SC"',
      '"Source Han Sans TC"',
      '"Source Han Sans"',
      '"Noto Sans SC"',
      'sans-serif',
    ],
    preview: '思源黑体 Source Han Sans',
    category: 'chinese',
  },
  {
    id: 'harmonyos-sans',
    name: 'HarmonyOS Sans',
    description: '华为鸿蒙系统字体，现代简洁',
    fontFamily: [
      '"HarmonyOS Sans SC"',
      '"HarmonyOS Sans"',
      '"PingFang SC"',
      '-apple-system',
      'BlinkMacSystemFont',
      'sans-serif',
    ],
    preview: 'HarmonyOS Sans 鸿蒙字体',
    category: 'chinese',
  },
  {
    id: 'alibaba-puhuiti',
    name: '阿里巴巴普惠体',
    description: '阿里巴巴设计的免费商用字体',
    fontFamily: [
      '"Alibaba PuHuiTi"',
      '"PingFang SC"',
      '"Microsoft YaHei"',
      'sans-serif',
    ],
    preview: '阿里巴巴普惠体 Alibaba PuHuiTi',
    category: 'chinese',
  },
  {
    id: 'oppo-sans',
    name: 'OPPO Sans',
    description: 'OPPO设计的现代字体',
    fontFamily: [
      '"OPPO Sans"',
      '"PingFang SC"',
      '"Microsoft YaHei"',
      'sans-serif',
    ],
    preview: 'OPPO Sans 现代设计',
    category: 'chinese',
  },
  {
    id: 'inter',
    name: 'Inter',
    description: '专为屏幕显示优化的现代字体，UI设计首选',
    fontFamily: [
      '"Inter"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ],
    preview: 'Inter Font Family - Modern UI Design',
    category: 'english',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    description: '几何风格的现代字体，清晰易读',
    fontFamily: [
      '"Poppins"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Poppins - Geometric Sans Serif',
    category: 'english',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    description: '低对比度几何字体，适合现代界面',
    fontFamily: [
      '"DM Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'DM Sans - Clean & Modern',
    category: 'english',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    description: '开源现代字体，平衡的字母形状',
    fontFamily: [
      '"Manrope"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Manrope - Balanced Modern Font',
    category: 'english',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    description: '提高阅读效率的现代字体',
    fontFamily: [
      '"Lexend"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Lexend - Reading Proficiency',
    category: 'english',
  },
  {
    id: 'public-sans',
    name: 'Public Sans',
    description: '美国政府开源的现代字体',
    fontFamily: [
      '"Public Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Public Sans - Government Grade',
    category: 'english',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    description: '圆润友好的现代字体',
    fontFamily: [
      '"Nunito"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Nunito - Rounded & Friendly',
    category: 'english',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    description: '现代几何字体，适合标题和正文',
    fontFamily: [
      '"Outfit"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    preview: 'Outfit - Modern Geometric',
    category: 'english',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    description: 'Google设计的经典现代字体',
    fontFamily: [
      '"Roboto"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ],
    preview: 'Roboto - Google Material Design',
    category: 'english',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    description: '人文主义字体，友好易读',
    fontFamily: [
      '"Open Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ],
    preview: 'Open Sans - Humanist Sans',
    category: 'english',
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    description: '支持连字的等宽编程字体',
    fontFamily: [
      '"Fira Code"',
      '"Cascadia Code"',
      '"JetBrains Mono"',
      '"Source Code Pro"',
      'Consolas',
      'Monaco',
      'monospace',
    ],
    preview: 'Fira Code => != === </>',
    category: 'monospace',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    description: 'JetBrains设计的现代编程字体',
    fontFamily: [
      '"JetBrains Mono"',
      '"Fira Code"',
      '"Source Code Pro"',
      'Consolas',
      'Monaco',
      'monospace',
    ],
    preview: 'JetBrains Mono => != === </>',
    category: 'monospace',
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    description: '微软开发的现代编程字体',
    fontFamily: [
      '"Cascadia Code"',
      '"Cascadia Mono"',
      '"JetBrains Mono"',
      '"Fira Code"',
      'Consolas',
      'monospace',
    ],
    preview: 'Cascadia Code => != === </>',
    category: 'monospace',
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    description: 'Adobe设计的开源编程字体',
    fontFamily: [
      '"Source Code Pro"',
      '"JetBrains Mono"',
      '"Fira Code"',
      'Consolas',
      'Monaco',
      'monospace',
    ],
    preview: 'Source Code Pro => != ===',
    category: 'monospace',
  },
  {
    id: 'victor-mono',
    name: 'Victor Mono',
    description: '支持斜体和连字的现代编程字体',
    fontFamily: [
      '"Victor Mono"',
      '"JetBrains Mono"',
      '"Fira Code"',
      'Consolas',
      'monospace',
    ],
    preview: 'Victor Mono => != === </>',
    category: 'monospace',
  },
];

// 按分类获取字体选项
export const getFontsByCategory = (category: FontOption['category']) => {
  return fontOptions.filter(font => font.category === category);
};

// 根据ID获取字体选项
export const getFontById = (id: string): FontOption | undefined => {
  return fontOptions.find(font => font.id === id);
};

// 获取字体的CSS字符串
export const getFontFamilyString = (fontId: string): string => {
  const font = getFontById(fontId);
  return font ? font.fontFamily.join(', ') : fontOptions[0].fontFamily.join(', ');
};

// 字体分类标签
export const fontCategoryLabels = {
  system: '系统字体',
  chinese: '中文字体',
  english: '英文字体',
  monospace: '等宽字体',
};

// 默认字体ID
export const DEFAULT_FONT_ID = 'system';
