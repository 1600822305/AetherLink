/**
 * Google Fonts 服务
 * 使用 google-fonts-complete 包获取完整字体列表
 * 类似 Flutter 的 google_fonts 包
 */

// 从 google-fonts-complete 包导入完整字体列表
import googleFontsData from 'google-fonts-complete/api-response.json';
import { createLogger } from '../infra/logger';
const logger = createLogger('GoogleFonts');

// 国内可用的 Google Fonts CDN 镜像（按稳定性排序）
const FONT_CDN_MIRRORS = [
  'https://fonts.googleapis.com',      // 官方（很多地区可用）
  'https://fonts.loli.net',            // loli.net 镜像
  'https://fonts.geekzu.org',          // geekzu 镜像
  'https://gfonts.nayist.cn',          // nayist 镜像
];

// 中文等宽字体 CDN 配置
const CHINESE_MONO_FONT_CDN: Record<string, string> = {
  // 更纱黑体 - 通过 jsDelivr CDN
  'Sarasa Mono SC': 'https://cdn.jsdelivr.net/npm/sarasa-gothic-mono-sc@1.0.8/Sarasa-Mono-SC-Regular.css',
  // 霞鹜文楷等宽 - 通过 jsDelivr CDN
  'LXGW WenKai Mono': 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-mono-webfont@1.0.0/style.css',
  // 思源等宽 - 通过 Adobe CDN
  'Source Han Mono SC': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wght@400;700&display=swap',
  // Maple Mono - 通过 Fontsource CDN
  'Maple Mono NF CN': 'https://cdn.jsdelivr.net/fontsource/fonts/maple-mono@latest/chinese-simplified-400-normal.woff2',
};

// 字体分类
export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

// Google Font 接口
export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: FontCategory;
  version: string;
  lastModified: string;
  popularity?: number;
}

// 字体列表缓存
interface FontCache {
  fonts: GoogleFont[];
  timestamp: number;
  cdnUrl: string;
}

// 内存缓存
let fontCache: FontCache | null = null;
const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<boolean>>();

/**
 * 检测 CDN 是否可用
 */
async function checkCDNAvailability(cdnUrl: string, timeout = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    await fetch(`${cdnUrl}/css2?family=Roboto&display=swap`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors'
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取可用的 CDN 地址
 */
async function getAvailableCDN(): Promise<string> {
  // 优先检查缓存
  const cached = sessionStorage.getItem('googleFontsCDN');
  if (cached && FONT_CDN_MIRRORS.includes(cached)) {
    return cached;
  }

  // 并行检测所有 CDN
  const results = await Promise.allSettled(
    FONT_CDN_MIRRORS.map(async (cdn) => {
      const available = await checkCDNAvailability(cdn);
      return { cdn, available };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.available) {
      sessionStorage.setItem('googleFontsCDN', result.value.cdn);
      return result.value.cdn;
    }
  }
  
  // 默认使用官方
  return FONT_CDN_MIRRORS[0];
}

/**
 * 获取 Google Fonts 列表
 * 直接从 google-fonts-complete 包获取，无需 API 调用
 */
export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  // 检查内存缓存
  if (fontCache && fontCache.fonts.length > 0) {
    return fontCache.fonts;
  }

  // 直接从导入的 JSON 数据获取
  const fonts: GoogleFont[] = (googleFontsData as any[]).map((item, index) => ({
    family: item.family,
    variants: item.variants || ['regular'],
    subsets: item.subsets || ['latin'],
    category: item.category as FontCategory,
    version: item.version || 'v1',
    lastModified: item.lastModified || '',
    popularity: index + 1,
  }));

  // 获取可用 CDN
  const cdnUrl = await getAvailableCDN();

  // 缓存结果
  fontCache = {
    fonts,
    timestamp: Date.now(),
    cdnUrl,
  };

  logger.debug(`已加载 ${fonts.length} 个字体（来自 google-fonts-complete 包）`);
  return fonts;
}

/**
 * 尝试从单个 CDN 加载字体
 */
async function tryLoadFontFromCDN(cdnUrl: string, fontFamily: string, variants: string[]): Promise<boolean> {
  const encodedFamily = encodeURIComponent(fontFamily);
  const weightsParam = variants.filter(v => /^\d+$/.test(v)).join(';');
  
  const cssUrl = weightsParam 
    ? `${cdnUrl}/css2?family=${encodedFamily}:wght@${weightsParam}&display=swap`
    : `${cdnUrl}/css2?family=${encodedFamily}&display=swap`;

  // 检查是否已存在
  const existing = document.querySelector(`link[href*="${encodedFamily}"]`);
  if (existing) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    
    const timeout = setTimeout(() => {
      link.remove();
      resolve(false);
    }, 5000); // 5秒超时
    
    link.onload = () => {
      clearTimeout(timeout);
      logger.debug(`字体加载成功: ${fontFamily} (${cdnUrl})`);
      resolve(true);
    };
    
    link.onerror = () => {
      clearTimeout(timeout);
      link.remove();
      resolve(false);
    };
    
    document.head.appendChild(link);
  });
}

/**
 * 加载中文等宽字体（专用 CDN）
 */
async function loadChineseMonoFont(fontFamily: string): Promise<boolean> {
  const cssUrl = CHINESE_MONO_FONT_CDN[fontFamily];
  if (!cssUrl) return false;

  // 检查是否已存在
  const existing = document.querySelector(`link[href="${cssUrl}"]`);
  if (existing) return true;

  return new Promise<boolean>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    
    const timeout = setTimeout(() => {
      link.remove();
      resolve(false);
    }, 8000); // 中文字体较大，给更长超时
    
    link.onload = () => {
      clearTimeout(timeout);
      logger.debug(`中文等宽字体加载成功: ${fontFamily}`);
      resolve(true);
    };
    
    link.onerror = () => {
      clearTimeout(timeout);
      link.remove();
      logger.warn(`中文等宽字体加载失败: ${fontFamily}`);
      resolve(false);
    };
    
    document.head.appendChild(link);
  });
}

/**
 * 加载指定字体（自动尝试多个 CDN）
 */
export async function loadFont(fontFamily: string, variants: string[] = ['400', '700']): Promise<boolean> {
  const fontKey = `${fontFamily}:${variants.join(',')}`;
  
  // 已加载
  if (loadedFonts.has(fontKey)) {
    return true;
  }

  // 正在加载
  if (loadingPromises.has(fontKey)) {
    return loadingPromises.get(fontKey)!;
  }

  const loadPromise = (async () => {
    // 首先检查是否是中文等宽字体
    if (CHINESE_MONO_FONT_CDN[fontFamily]) {
      const success = await loadChineseMonoFont(fontFamily);
      if (success) {
        loadedFonts.add(fontKey);
        return true;
      }
      return false;
    }

    // 依次尝试每个 Google Fonts CDN
    for (const cdnUrl of FONT_CDN_MIRRORS) {
      try {
        const success = await tryLoadFontFromCDN(cdnUrl, fontFamily, variants);
        if (success) {
          loadedFonts.add(fontKey);
          // 记住成功的 CDN
          if (fontCache) {
            fontCache.cdnUrl = cdnUrl;
          }
          return true;
        }
      } catch (e) {
        logger.warn(`CDN ${cdnUrl} 加载失败，尝试下一个...`);
      }
    }
    
    logger.warn(`所有 CDN 均无法加载字体: ${fontFamily}`);
    return false;
  })();

  loadingPromises.set(fontKey, loadPromise);
  const result = await loadPromise;
  loadingPromises.delete(fontKey);
  
  return result;
}

/**
 * 预加载字体（仅加载 CSS，用于预览）
 */
export async function preloadFontForPreview(fontFamily: string): Promise<void> {
  await loadFont(fontFamily, ['400']);
}

/**
 * 按分类获取字体
 */
export async function getFontsByCategory(category: FontCategory): Promise<GoogleFont[]> {
  const fonts = await fetchGoogleFonts();
  return fonts.filter(f => f.category === category);
}

/**
 * 搜索字体
 */
export async function searchFonts(query: string): Promise<GoogleFont[]> {
  const fonts = await fetchGoogleFonts();
  const q = query.toLowerCase().trim();
  if (!q) return fonts;
  return fonts.filter(f => f.family.toLowerCase().includes(q));
}

/**
 * 获取热门字体
 */
export async function getPopularFonts(limit = 50): Promise<GoogleFont[]> {
  const fonts = await fetchGoogleFonts();
  return fonts.slice(0, limit);
}

/**
 * 获取已加载的字体列表
 */
export function getLoadedFonts(): string[] {
  return Array.from(loadedFonts).map(key => key.split(':')[0]);
}

/**
 * 清除字体缓存
 */
export function clearFontCache(): void {
  fontCache = null;
  loadedFonts.clear();
  localStorage.removeItem('googleFontsCache');
  sessionStorage.removeItem('googleFontsCDN');
}

// ==================== 本地自定义字体功能 ====================
// 使用 IndexedDB 存储字体数据（避免 localStorage 5MB 限制）

// 自定义字体接口
export interface CustomFont {
  id: string;
  name: string;
  fontFamily: string;
  addedAt: number;
}

// 自定义字体（含数据）
interface CustomFontWithData extends CustomFont {
  fontData: ArrayBuffer; // 字体二进制数据
}

// 内存中已注册的自定义字体
const registeredCustomFonts = new Map<string, FontFace>();

// 内存缓存的字体元数据
let customFontsCache: CustomFont[] | null = null;

// 字体初始化标志
let fontsInitialized = false;
let fontsInitPromise: Promise<void> | null = null;

// IndexedDB 数据库名和表名
const FONT_DB_NAME = 'CustomFontsDB';
const FONT_STORE_NAME = 'fonts';
const FONT_DB_VERSION = 1;

/**
 * 打开 IndexedDB 数据库
 */
function openFontDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FONT_DB_NAME, FONT_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FONT_STORE_NAME)) {
        db.createObjectStore(FONT_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * 获取已保存的自定义字体列表（仅元数据，不含字体数据）
 */
export function getCustomFonts(): CustomFont[] {
  return customFontsCache || [];
}


/**
 * 从文件添加自定义字体
 * @param file 字体文件 (.ttf, .otf, .woff, .woff2)
 * @param fontName 可选的自定义名称
 */
export async function addCustomFontFromFile(file: File, fontName?: string): Promise<CustomFont | null> {
  // 验证文件类型
  const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!validExtensions.includes(ext)) {
    logger.error('不支持的字体格式:', ext);
    throw new Error(`不支持的字体格式: ${ext}，请使用 TTF, OTF, WOFF 或 WOFF2 格式`);
  }

  try {
    // 读取文件为 ArrayBuffer
    const fontData = await file.arrayBuffer();

    // 生成字体名称和 ID
    const baseName = fontName || file.name.replace(/\.[^.]+$/, '');
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fontFamily = `CustomFont_${id}`;

    // 注册字体
    const fontFace = new FontFace(fontFamily, fontData);
    await fontFace.load();
    document.fonts.add(fontFace);
    registeredCustomFonts.set(id, fontFace);

    // 创建自定义字体对象
    const customFontWithData: CustomFontWithData = {
      id,
      name: baseName,
      fontFamily,
      fontData,
      addedAt: Date.now(),
    };

    // 保存到 IndexedDB
    const db = await openFontDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FONT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(FONT_STORE_NAME);
      const request = store.put(customFontWithData);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // 更新缓存
    const customFont: CustomFont = {
      id,
      name: baseName,
      fontFamily,
      addedAt: customFontWithData.addedAt,
    };
    customFontsCache = [...(customFontsCache || []), customFont];

    logger.debug(`添加自定义字体成功: ${baseName}`);
    return customFont;
  } catch (error) {
    logger.error('添加自定义字体失败:', error);
    throw error;
  }
}

/**
 * 删除自定义字体
 */
export async function removeCustomFont(fontId: string): Promise<boolean> {
  try {
    // 从内存中移除
    const fontFace = registeredCustomFonts.get(fontId);
    if (fontFace) {
      document.fonts.delete(fontFace);
      registeredCustomFonts.delete(fontId);
    }

    // 从 IndexedDB 中移除
    const db = await openFontDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FONT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(FONT_STORE_NAME);
      const request = store.delete(fontId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // 更新缓存
    customFontsCache = (customFontsCache || []).filter(f => f.id !== fontId);

    // 从已加载集合中移除
    loadedFonts.forEach((_, key) => {
      if (key.includes(fontId)) {
        loadedFonts.delete(key);
      }
    });

    logger.debug(`删除自定义字体: ${fontId}`);
    return true;
  } catch (e) {
    logger.error('删除自定义字体失败:', e);
    return false;
  }
}

/**
 * 加载所有已保存的自定义字体（模块加载时自动调用，支持外部重复调用）
 */
export async function loadSavedCustomFonts(): Promise<void> {
  // 防止重复初始化，复用已有的 Promise
  if (fontsInitPromise) {
    return fontsInitPromise;
  }
  
  if (fontsInitialized) {
    return;
  }

  fontsInitPromise = (async () => {
    try {
      const db = await openFontDB();
      const fonts = await new Promise<CustomFontWithData[]>((resolve, reject) => {
        const transaction = db.transaction(FONT_STORE_NAME, 'readonly');
        const store = transaction.objectStore(FONT_STORE_NAME);
        const request = store.getAll();
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      // 更新缓存
      customFontsCache = fonts.map(f => ({
        id: f.id,
        name: f.name,
        fontFamily: f.fontFamily,
        addedAt: f.addedAt,
      }));

      // 注册所有字体
      for (const font of fonts) {
        try {
          if (!registeredCustomFonts.has(font.id)) {
            const fontFace = new FontFace(font.fontFamily, font.fontData);
            await fontFace.load();
            document.fonts.add(fontFace);
            registeredCustomFonts.set(font.id, fontFace);
            loadedFonts.add(`${font.fontFamily}:400`);
            logger.debug(`恢复自定义字体: ${font.name}`);
          }
        } catch (e) {
          logger.warn(`恢复自定义字体失败: ${font.name}`, e);
        }
      }
      
      fontsInitialized = true;
      logger.debug(`初始化完成，共 ${fonts.length} 个自定义字体`);
    } catch (e) {
      logger.error('加载自定义字体失败:', e);
    } finally {
      fontsInitPromise = null;
    }
  })();

  return fontsInitPromise;
}

/**
 * 检查是否是自定义字体
 */
export function isCustomFont(fontId: string): boolean {
  return fontId.startsWith('custom-') || getCustomFonts().some(f => f.id === fontId);
}

/**
 * 获取自定义字体的 CSS font-family 值
 */
export function getCustomFontFamily(fontId: string): string | null {
  const font = getCustomFonts().find(f => f.id === fontId);
  return font ? font.fontFamily : null;
}

// 模块加载时自动初始化自定义字体
loadSavedCustomFonts().catch((error) => logger.error('加载自定义字体失败:', error));

// 导出服务实例
export const googleFontsService = {
  fetchGoogleFonts,
  loadFont,
  preloadFontForPreview,
  getFontsByCategory,
  searchFonts,
  getPopularFonts,
  getLoadedFonts,
  clearFontCache,
  // 自定义字体
  getCustomFonts,
  addCustomFontFromFile,
  removeCustomFont,
  loadSavedCustomFonts,
  isCustomFont,
  getCustomFontFamily,
};

export default googleFontsService;
