/**
 * Shiki 代码高亮工具函数
 * 参考 Cherry Studio 实现
 */
import type { SpecialLanguage, ThemedToken } from 'shiki/core';
import { getTokenStyleObject, type HighlighterGeneric } from 'shiki/core';
import { AsyncInitializer } from './asyncInitializer';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('Shiki');

export const DEFAULT_LANGUAGES = ['text', 'javascript', 'typescript', 'python', 'java', 'markdown', 'json', 'html', 'css', 'shell', 'sql'];
export const DEFAULT_THEMES = ['one-light', 'material-theme-darker', 'github-dark', 'github-light', 'vitesse-dark', 'vitesse-light'];

/**
 * shiki 初始化器，避免并发问题
 */
const shikiInitializer = new AsyncInitializer(async () => {
  const shiki = await import('shiki');
  return shiki;
});

/**
 * 获取 shiki package
 */
export async function getShiki() {
  return shikiInitializer.get();
}

/**
 * shiki highlighter 初始化器，避免并发问题
 */
const highlighterInitializer = new AsyncInitializer(async (langs?: string[], themes?: string[]) => {
  const shiki = await getShiki();
  return shiki.createHighlighter({
    langs: langs || DEFAULT_LANGUAGES,
    themes: themes || DEFAULT_THEMES
  });
});

/**
 * 获取 shiki highlighter
 */
export async function getHighlighter(langs?: string[], themes?: string[]) {
  return highlighterInitializer.get(langs, themes);
}

/**
 * 加载语言
 * @param highlighter - shiki highlighter
 * @param language - 语言
 * @returns 实际加载的语言
 */
export async function loadLanguageIfNeeded(
  highlighter: HighlighterGeneric<any, any>,
  language: string
): Promise<string> {
  const shiki = await getShiki();

  let loadedLanguage = language;
  if (!highlighter.getLoadedLanguages().includes(language)) {
    try {
      if (['text', 'ansi'].includes(language)) {
        await highlighter.loadLanguage(language as SpecialLanguage);
      } else {
        const languageImportFn = (shiki as any).bundledLanguages[language];
        if (languageImportFn) {
          const langData = await languageImportFn();
          await highlighter.loadLanguage(langData);
        } else {
          await highlighter.loadLanguage('text');
          loadedLanguage = 'text';
        }
      }
    } catch (error) {
      logger.warn(`Failed to load language '${language}', falling back to 'text':`, error);
      await highlighter.loadLanguage('text');
      loadedLanguage = 'text';
    }
  }

  return loadedLanguage;
}

/**
 * 加载主题
 * @param highlighter - shiki highlighter
 * @param theme - 主题
 * @returns 实际加载的主题
 */
export async function loadThemeIfNeeded(highlighter: HighlighterGeneric<any, any>, theme: string): Promise<string> {
  const shiki = await getShiki();

  let loadedTheme = theme;
  if (!highlighter.getLoadedThemes().includes(theme)) {
    try {
      const themeImportFn = (shiki as any).bundledThemes[theme];
      if (themeImportFn) {
        const themeData = await themeImportFn();
        await highlighter.loadTheme(themeData);
      } else {
        // 回退到 one-light
        logger.warn(`Theme '${theme}' not found, falling back to 'one-light'`);
        const oneLightTheme = await (shiki as any).bundledThemes['one-light']();
        await highlighter.loadTheme(oneLightTheme);
        loadedTheme = 'one-light';
      }
    } catch (error) {
      // 回退到 one-light
      logger.warn(`Failed to load theme '${theme}', falling back to 'one-light':`, error);
      const oneLightTheme = await (shiki as any).bundledThemes['one-light']();
      await highlighter.loadTheme(oneLightTheme);
      loadedTheme = 'one-light';
    }
  }

  return loadedTheme;
}

/**
 * Shiki token 样式转换为 React 样式对象
 *
 * @param token Shiki themed token
 * @returns React 样式对象
 */
export function getReactStyleFromToken(token: ThemedToken): Record<string, string> {
  const style = token.htmlStyle || getTokenStyleObject(token);
  const reactStyle: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    switch (key) {
      case 'font-style':
        reactStyle.fontStyle = value;
        break;
      case 'font-weight':
        reactStyle.fontWeight = value;
        break;
      case 'background-color':
        reactStyle.backgroundColor = value;
        break;
      case 'text-decoration':
        reactStyle.textDecoration = value;
        break;
      default:
        reactStyle[key] = value;
    }
  }
  return reactStyle;
}
