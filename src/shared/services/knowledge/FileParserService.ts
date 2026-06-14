/**
 * 文件解析服务
 * 支持多种文件格式解析为纯文本，用于知识库向量化
 * 兼容 Web、Capacitor 移动端、Tauri 桌面端
 */

import { getPlatformInfo } from '../../utils/platformDetection';
import type { PreprocessProviderConfig, PreprocessProgressCallback } from './preprocess/types';
import { createLogger } from '../infra/logger';

const logger = createLogger('FileParser');

// 平台特定限制
const PLATFORM_LIMITS = {
  // 移动端限制（内存和性能考虑）
  mobile: {
    maxPdfSize: 10 * 1024 * 1024,      // 10MB
    maxExcelSize: 5 * 1024 * 1024,      // 5MB
    maxDocxSize: 20 * 1024 * 1024,      // 20MB
    pdfSupported: false,                 // 移动端禁用 pdfjs（性能问题）
  },
  // 桌面端限制
  desktop: {
    maxPdfSize: 100 * 1024 * 1024,     // 100MB
    maxExcelSize: 50 * 1024 * 1024,     // 50MB
    maxDocxSize: 100 * 1024 * 1024,     // 100MB
    pdfSupported: true,
  },
  // Web 限制
  web: {
    maxPdfSize: 50 * 1024 * 1024,      // 50MB
    maxExcelSize: 20 * 1024 * 1024,     // 20MB
    maxDocxSize: 50 * 1024 * 1024,      // 50MB
    pdfSupported: true,
  },
};


// 支持的文件格式
export const SUPPORTED_FILE_EXTENSIONS = {
  // 文本格式
  text: ['.txt', '.md', '.markdown', '.csv', '.json', '.xml', '.yaml', '.yml', '.ini', '.conf', '.log'],
  // 代码格式
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.vue', '.svelte'],
  // 文档格式
  document: ['.html', '.htm', '.pdf', '.docx', '.doc', '.rtf', '.odt'],
  // 表格格式
  spreadsheet: ['.xlsx', '.xls', '.ods'],
  // 演示文稿
  presentation: ['.pptx', '.ppt', '.odp'],
  // 电子书
  ebook: ['.epub'],
};

// 所有支持的扩展名
export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_FILE_EXTENSIONS.text,
  ...SUPPORTED_FILE_EXTENSIONS.code,
  ...SUPPORTED_FILE_EXTENSIONS.document,
  ...SUPPORTED_FILE_EXTENSIONS.spreadsheet,
  ...SUPPORTED_FILE_EXTENSIONS.presentation,
  ...SUPPORTED_FILE_EXTENSIONS.ebook,
];

// 文件解析结果
export interface ParsedFile {
  content: string;
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
    mimeType?: string;
    pageCount?: number;
    wordCount?: number;
    parseMethod: 'native' | 'library' | 'api';
    parsedAt: number;
  };
}

// 解析选项
export interface ParseOptions {
  maxSize?: number; // 最大文件大小（字节）
  extractImages?: boolean; // 是否提取图片描述
  preserveFormatting?: boolean; // 是否保留格式
  language?: string; // OCR 语言
}

// 默认选项
const DEFAULT_OPTIONS: ParseOptions = {
  maxSize: 50 * 1024 * 1024, // 50MB
  extractImages: false,
  preserveFormatting: false,
  language: 'zh-CN',
};

/**
 * 文件解析服务类
 */
class FileParserService {
  private static instance: FileParserService;
  private platformInfo = getPlatformInfo();
  private limits: typeof PLATFORM_LIMITS.web;

  // 云端 PDF 预处理配置
  private cloudPreprocessConfig: PreprocessProviderConfig | null = null;
  private cloudProgressCallback?: PreprocessProgressCallback;
  // PDF 解析模式: 'local' 仅本地 | 'auto' 自动降级 | 'cloud' 强制云端
  private pdfParseMode: 'local' | 'auto' | 'cloud' = 'auto';

  private constructor() {
    // 根据平台设置限制
    if (this.platformInfo.isCapacitor && this.platformInfo.isMobile) {
      this.limits = PLATFORM_LIMITS.mobile;
    } else if (this.platformInfo.isTauri) {
      this.limits = PLATFORM_LIMITS.desktop;
    } else {
      this.limits = PLATFORM_LIMITS.web;
    }
  }

  public static getInstance(): FileParserService {
    if (!FileParserService.instance) {
      FileParserService.instance = new FileParserService();
    }
    return FileParserService.instance;
  }

  /**
   * 配置云端 PDF 预处理 Provider
   * 设置后，PDF 解析会在 pdfjs 失败/文本层不足时自动降级到云端
   */
  public setCloudPreprocessConfig(
    config: PreprocessProviderConfig | null,
    onProgress?: PreprocessProgressCallback
  ): void {
    this.cloudPreprocessConfig = config;
    this.cloudProgressCallback = onProgress;
  }

  /**
   * 设置 PDF 解析模式
   */
  public setPdfParseMode(mode: 'local' | 'auto' | 'cloud'): void {
    this.pdfParseMode = mode;
  }

  /**
   * 获取当前云端预处理配置
   */
  public getCloudPreprocessConfig(): PreprocessProviderConfig | null {
    return this.cloudPreprocessConfig;
  }

  /**
   * 解析文件
   */
  public async parseFile(
    file: File | ArrayBuffer,
    fileName: string,
    options: ParseOptions = {}
  ): Promise<ParsedFile> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const ext = this.getExtension(fileName).toLowerCase();
    const fileSize = file instanceof File ? file.size : file.byteLength;

    // 检查文件大小
    if (opts.maxSize && fileSize > opts.maxSize) {
      throw new Error(`文件大小超过限制: ${this.formatSize(fileSize)} > ${this.formatSize(opts.maxSize)}`);
    }

    // 检查是否支持
    if (!this.isSupported(fileName)) {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    let content: string;
    let parseMethod: 'native' | 'library' | 'api' = 'native';

    try {
      // 根据文件类型选择解析方法
      if (this.isTextFile(ext)) {
        content = await this.parseTextFile(file);
      } else if (this.isCodeFile(ext)) {
        content = await this.parseTextFile(file);
      } else if (ext === '.html' || ext === '.htm') {
        content = await this.parseHtmlFile(file);
      } else if (ext === '.pdf') {
        content = await this.parsePdfFile(file, opts);
        parseMethod = 'library';
      } else if (ext === '.docx') {
        content = await this.parseDocxFile(file);
        parseMethod = 'library';
      } else if (ext === '.xlsx' || ext === '.xls') {
        content = await this.parseSpreadsheetFile(file, ext);
        parseMethod = 'library';
      } else if (ext === '.pptx') {
        content = await this.parsePptxFile(file);
        parseMethod = 'library';
      } else if (ext === '.epub') {
        content = await this.parseEpubFile(file);
        parseMethod = 'library';
      } else {
        // 尝试作为文本解析
        content = await this.parseTextFile(file);
      }
    } catch (err) {
      logger.error(`解析文件失败: ${fileName}`, err);
      throw new Error(`解析文件失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }

    // 计算字数
    const wordCount = this.countWords(content);

    return {
      content,
      metadata: {
        fileName,
        fileSize,
        fileType: ext,
        parseMethod,
        wordCount,
        parsedAt: Date.now(),
      },
    };
  }

  /**
   * 解析纯文本文件
   */
  private async parseTextFile(file: File | ArrayBuffer): Promise<string> {
    if (file instanceof File) {
      return await file.text();
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(file);
  }

  /**
   * 解析 HTML 文件
   */
  private async parseHtmlFile(file: File | ArrayBuffer): Promise<string> {
    const html = await this.parseTextFile(file);
    return this.stripHtml(html);
  }

  /**
   * 解析 PDF 文件
   * 降级链：pdfjs（本地）→ 云端 Provider → 降级提示
   */
  private async parsePdfFile(file: File | ArrayBuffer, _options: ParseOptions): Promise<string> {
    const fileSize = file instanceof File ? file.size : file.byteLength;
    const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
    const mode = this.pdfParseMode;

    // 强制云端模式：跳过本地解析
    if (mode === 'cloud' && this.cloudPreprocessConfig) {
      try {
        logger.debug(`强制云端模式，使用 ${this.cloudPreprocessConfig.id} 解析 PDF`);
        const { preprocessPdfWithCloud } = await import('./preprocess');
        const result = await preprocessPdfWithCloud(
          arrayBuffer,
          'document.pdf',
          this.cloudPreprocessConfig,
          this.cloudProgressCallback
        );
        return result.content;
      } catch (err) {
        logger.error('云端 PDF 解析失败，降级到本地:', err);
        // 云端失败仍尝试本地
      }
    }

    // 1️⃣ 尝试 pdfjs 本地解析（仅桌面端/Web，且平台支持）
    if (this.limits.pdfSupported && fileSize <= this.limits.maxPdfSize) {
      try {
        const pdfjsLib = await this.loadPdfJs();
        if (pdfjsLib) {
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          const textParts: string[] = [];
          const numPages = pdf.numPages;

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            textParts.push(`--- 第 ${i} 页 ---\n${pageText}`);
          }

          const localResult = textParts.join('\n\n');

          // 检查文本层是否足够（扫描件 PDF 文本层为空或极少）
          const actualTextLength = localResult.replace(/---\s*第\s*\d+\s*页\s*---/g, '').trim().length;
          if (actualTextLength > 50) {
            // 文本层充足，直接返回
            return localResult;
          }

          logger.warn(`PDF 文本层过少 (${actualTextLength} 字符)，可能为扫描件`);
        }
      } catch (err) {
        logger.warn('pdfjs 解析失败:', err);
      }
    }

    // 2️⃣ 尝试云端 Provider 解析（仅 auto 模式）
    if (mode !== 'local' && this.cloudPreprocessConfig) {
      try {
        logger.debug(`使用云端 Provider (${this.cloudPreprocessConfig.id}) 解析 PDF`);
        const { preprocessPdfWithCloud } = await import('./preprocess');
        const result = await preprocessPdfWithCloud(
          arrayBuffer,
          'document.pdf',
          this.cloudPreprocessConfig,
          this.cloudProgressCallback
        );
        return result.content;
      } catch (err) {
        logger.error('云端 PDF 解析失败:', err);
      }
    }

    // 3️⃣ 降级提示
    if (!this.limits.pdfSupported) {
      return this.getMobilePdfMessage();
    }
    return this.getPdfFallbackMessage();
  }

  /**
   * 动态加载 pdf.js
   */
  private async loadPdfJs(): Promise<any> {
    try {
      // @ts-ignore - 动态导入
      const pdfjsLib = await import('pdfjs-dist');
      
      // 设置 worker（使用本地文件，避免 CDN 不可用）
      if (pdfjsLib.GlobalWorkerOptions) {
        // @ts-ignore - Vite ?url 导入返回资源 URL
        const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      }
      
      return pdfjsLib;
    } catch {
      return null;
    }
  }

  /**
   * PDF 降级消息
   */
  private getPdfFallbackMessage(): string {
    return `[PDF 文件]\n\n此 PDF 文件需要安装 pdfjs-dist 库才能解析内容。\n\n请运行: npm install pdfjs-dist\n\n或者您可以：\n1. 将 PDF 转换为文本格式后上传\n2. 复制 PDF 中的文本内容直接粘贴`;
  }

  /**
   * 移动端 PDF 提示
   */
  private getMobilePdfMessage(): string {
    return `[PDF 文件]\n\n移动端暂不支持直接解析 PDF 文件（性能和内存限制）。\n\n建议：\n1. 在电脑上将 PDF 转换为 TXT/MD 格式\n2. 或者复制 PDF 中的文本内容直接粘贴\n3. 使用桌面端上传 PDF 文件`;
  }

  /**
   * 解析 DOCX 文件
   * 使用 mammoth 或简单解析
   */
  private async parseDocxFile(file: File | ArrayBuffer): Promise<string> {
    try {
      // 尝试动态加载 mammoth
      const mammoth = await this.loadMammoth();
      
      if (!mammoth) {
        return this.getDocxFallbackParse(file);
      }

      const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value || '';
    } catch (err) {
      logger.warn('DOCX mammoth 解析失败，尝试简单解析:', err);
      return this.getDocxFallbackParse(file);
    }
  }

  /**
   * 动态加载 mammoth
   */
  private async loadMammoth(): Promise<any> {
    try {
      // @ts-ignore - 动态导入
      const mammoth = await import('mammoth');
      return mammoth;
    } catch {
      return null;
    }
  }

  /**
   * DOCX 简单解析（从 XML 中提取文本）
   */
  private async getDocxFallbackParse(file: File | ArrayBuffer): Promise<string> {
    try {
      // @ts-ignore
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // 获取 document.xml
      const documentXml = await zip.file('word/document.xml')?.async('text');
      if (!documentXml) {
        throw new Error('无法读取 DOCX 内容');
      }

      // 简单提取文本
      return this.stripXml(documentXml);
    } catch {
      return `[DOCX 文件]\n\n需要安装 mammoth 或 jszip 库才能解析 DOCX 文件。\n\n请运行: npm install mammoth`;
    }
  }

  /**
   * 解析电子表格
   */
  private async parseSpreadsheetFile(file: File | ArrayBuffer, _ext: string): Promise<string> {
    const fileSize = file instanceof File ? file.size : file.byteLength;
    
    // 检查平台限制
    if (fileSize > this.limits.maxExcelSize) {
      throw new Error(`Excel 文件过大: ${this.formatSize(fileSize)} > ${this.formatSize(this.limits.maxExcelSize)}，请拆分后上传`);
    }

    try {
      // @ts-ignore
      const XLSX = await import('xlsx');
      const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`=== 工作表: ${sheetName} ===\n${csv}`);
      }
      
      return sheets.join('\n\n');
    } catch {
      return `[Excel 文件]\n\n需要安装 xlsx 库才能解析电子表格。\n\n请运行: npm install xlsx`;
    }
  }

  /**
   * 解析 PPTX 文件
   */
  private async parsePptxFile(file: File | ArrayBuffer): Promise<string> {
    try {
      // @ts-ignore
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const slides: string[] = [];
      let slideIndex = 1;
      
      // 遍历幻灯片
      while (true) {
        const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
        if (!slideFile) break;
        
        const slideXml = await slideFile.async('text');
        const text = this.stripXml(slideXml);
        if (text.trim()) {
          slides.push(`--- 幻灯片 ${slideIndex} ---\n${text}`);
        }
        slideIndex++;
      }
      
      return slides.join('\n\n') || '[空白演示文稿]';
    } catch {
      return `[PPTX 文件]\n\n需要安装 jszip 库才能解析演示文稿。\n\n请运行: npm install jszip`;
    }
  }

  /**
   * 解析 EPUB 文件
   */
  private async parseEpubFile(file: File | ArrayBuffer): Promise<string> {
    try {
      // @ts-ignore
      const JSZip = (await import('jszip')).default;
      const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      const chapters: string[] = [];
      
      // 查找所有 HTML/XHTML 文件
      const htmlFiles = Object.keys(zip.files)
        .filter(name => name.endsWith('.html') || name.endsWith('.xhtml'))
        .sort();
      
      for (const htmlFile of htmlFiles) {
        const content = await zip.file(htmlFile)?.async('text');
        if (content) {
          const text = this.stripHtml(content);
          if (text.trim()) {
            chapters.push(text);
          }
        }
      }
      
      return chapters.join('\n\n---\n\n') || '[空白电子书]';
    } catch {
      return `[EPUB 文件]\n\n需要安装 jszip 库才能解析电子书。\n\n请运行: npm install jszip`;
    }
  }

  /**
   * 去除 HTML 标签
   */
  private stripHtml(html: string): string {
    // 移除 script 和 style
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // 替换常见块级元素为换行
    text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
    
    // 移除其他标签
    text = text.replace(/<[^>]+>/g, '');
    
    // 解码 HTML 实体
    text = this.decodeHtmlEntities(text);
    
    // 清理多余空白
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    
    return text;
  }

  /**
   * 去除 XML 标签
   */
  private stripXml(xml: string): string {
    // 提取文本节点
    const textMatches = xml.match(/>([^<]+)</g) || [];
    const texts = textMatches
      .map(m => m.slice(1, -1).trim())
      .filter(t => t.length > 0);
    return texts.join(' ');
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '...',
    };
    
    let decoded = text;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    
    // 处理数字实体
    decoded = decoded.replace(/&#(\d+);/g, (_, code) => 
      String.fromCharCode(parseInt(code, 10))
    );
    
    return decoded;
  }

  /**
   * 获取文件扩展名
   */
  private getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot >= 0 ? fileName.slice(lastDot) : '';
  }

  /**
   * 检查是否支持的文件
   */
  public isSupported(fileName: string): boolean {
    const ext = this.getExtension(fileName).toLowerCase();
    return ALL_SUPPORTED_EXTENSIONS.includes(ext);
  }

  /**
   * 检查是否文本文件
   */
  private isTextFile(ext: string): boolean {
    return SUPPORTED_FILE_EXTENSIONS.text.includes(ext);
  }

  /**
   * 检查是否代码文件
   */
  private isCodeFile(ext: string): boolean {
    return SUPPORTED_FILE_EXTENSIONS.code.includes(ext);
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * 统计字数
   */
  private countWords(text: string): number {
    // 中文按字符计数，英文按单词计数
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text
      .replace(/[\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0).length;
    return chineseCount + englishWords;
  }

  /**
   * 获取支持的文件格式描述
   */
  public getSupportedFormatsDescription(): string {
    return `支持格式：
• 文本: TXT, MD, CSV, JSON, XML, YAML
• 代码: JS, TS, Python, Java, C/C++, Go, Rust 等
• 文档: HTML, PDF*, DOCX*, RTF
• 表格: XLSX*, XLS*
• 演示: PPTX*
• 电子书: EPUB*

* 需要安装额外依赖`;
  }
}

export const fileParserService = FileParserService.getInstance();
export default FileParserService;
