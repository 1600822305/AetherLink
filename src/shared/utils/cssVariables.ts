/**
 * CSS Variables 注入工具
 * 
 * 这个文件负责将 Design Tokens 注入到 DOM 的 CSS Variables 中
 */

import { designTokens, type ThemeStyle, type ColorMode } from '../design-tokens';
import { createLogger } from '../services/infra/logger';
const logger = createLogger('CSSVariables');

/**
 * CSS 变量名称前缀
 */
const CSS_VAR_PREFIX = '--theme';

/**
 * 获取 CSS 变量名称
 */
const getCSSVarName = (name: string): string => {
  return `${CSS_VAR_PREFIX}-${name}`;
};

/**
 * 设置 CSS 变量
 */
const setCSSVariable = (name: string, value: string, element: HTMLElement = document.documentElement): void => {
  element.style.setProperty(getCSSVarName(name), value);
};

/**
 * 获取 CSS 变量
 */
export const getCSSVariable = (name: string, element: HTMLElement = document.documentElement): string => {
  return getComputedStyle(element).getPropertyValue(getCSSVarName(name)).trim();
};

/**
 * 移除 CSS 变量
 */
const removeCSSVariable = (name: string, element: HTMLElement = document.documentElement): void => {
  element.style.removeProperty(getCSSVarName(name));
};

/**
 * 应用主题的 CSS Variables
 * 
 * @param themeStyle - 主题风格
 * @param mode - 颜色模式（亮色/暗色）
 * @param element - 要应用 CSS Variables 的元素（默认为 document.documentElement）
 */
export const applyCSSVariables = (
  themeStyle: ThemeStyle,
  mode: ColorMode,
  element: HTMLElement = document.documentElement
): void => {
  const tokens = designTokens[themeStyle];
  
  if (!tokens) {
    logger.error(`Theme style not found: ${themeStyle}`);
    return;
  }
  
  // 品牌颜色
  setCSSVariable('primary', tokens.primary.value, element);
  setCSSVariable('secondary', tokens.secondary.value, element);
  if (tokens.accent) {
    setCSSVariable('accent', tokens.accent.value, element);
  }
  
  // 背景颜色
  setCSSVariable('bg-default', tokens.background.default[mode], element);
  setCSSVariable('bg-paper', tokens.background.paper[mode], element);
  setCSSVariable('bg-elevated', tokens.background.elevated[mode], element);
  
  // 文字颜色
  setCSSVariable('text-primary', tokens.text.primary[mode], element);
  setCSSVariable('text-secondary', tokens.text.secondary[mode], element);
  setCSSVariable('text-disabled', tokens.text.disabled[mode], element);
  setCSSVariable('text-hint', tokens.text.hint[mode], element);
  
  // 边框颜色
  setCSSVariable('border-default', tokens.border.default[mode], element);
  setCSSVariable('border-subtle', tokens.border.subtle[mode], element);
  setCSSVariable('border-strong', tokens.border.strong[mode], element);
  setCSSVariable('border-focus', tokens.border.focus[mode], element);
  
  // 交互状态
  setCSSVariable('hover-bg', tokens.interaction.hover[mode], element);
  setCSSVariable('active-bg', tokens.interaction.active[mode], element);
  setCSSVariable('selected-bg', tokens.interaction.selected[mode], element);
  setCSSVariable('disabled-bg', tokens.interaction.disabled[mode], element);
  
  // 消息气泡 - AI
  setCSSVariable('msg-ai-bg', tokens.message.ai.background[mode], element);
  setCSSVariable('msg-ai-bg-active', tokens.message.ai.backgroundActive[mode], element);
  setCSSVariable('msg-ai-text', tokens.message.ai.text[mode], element);
  setCSSVariable('msg-ai-border', tokens.message.ai.border[mode], element);
  
  // 消息气泡 - User
  setCSSVariable('msg-user-bg', tokens.message.user.background[mode], element);
  setCSSVariable('msg-user-bg-active', tokens.message.user.backgroundActive[mode], element);
  setCSSVariable('msg-user-text', tokens.message.user.text[mode], element);
  setCSSVariable('msg-user-border', tokens.message.user.border[mode], element);
  
  // 消息气泡 - System
  setCSSVariable('msg-system-bg', tokens.message.system.background[mode], element);
  setCSSVariable('msg-system-text', tokens.message.system.text[mode], element);
  setCSSVariable('msg-system-border', tokens.message.system.border[mode], element);
  
  // 按钮 - Primary
  setCSSVariable('btn-primary-bg', tokens.button.primary.background[mode], element);
  setCSSVariable('btn-primary-text', tokens.button.primary.text[mode], element);
  setCSSVariable('btn-primary-border', tokens.button.primary.border[mode], element);
  setCSSVariable('btn-primary-hover', tokens.button.primary.hover[mode], element);
  
  // 按钮 - Secondary
  setCSSVariable('btn-secondary-bg', tokens.button.secondary.background[mode], element);
  setCSSVariable('btn-secondary-text', tokens.button.secondary.text[mode], element);
  setCSSVariable('btn-secondary-border', tokens.button.secondary.border[mode], element);
  setCSSVariable('btn-secondary-hover', tokens.button.secondary.hover[mode], element);
  
  // 输入框
  setCSSVariable('input-bg', tokens.input.background[mode], element);
  setCSSVariable('input-text', tokens.input.text[mode], element);
  setCSSVariable('input-placeholder', tokens.input.placeholder[mode], element);
  setCSSVariable('input-border', tokens.input.border[mode], element);
  setCSSVariable('input-border-hover', tokens.input.borderHover[mode], element);
  setCSSVariable('input-border-focus', tokens.input.borderFocus[mode], element);
  
  // 侧边栏
  setCSSVariable('sidebar-bg', tokens.sidebar.background[mode], element);
  setCSSVariable('sidebar-item-hover', tokens.sidebar.itemHover[mode], element);
  setCSSVariable('sidebar-item-selected', tokens.sidebar.itemSelected[mode], element);
  setCSSVariable('sidebar-item-selected-hover', tokens.sidebar.itemSelectedHover[mode], element);
  setCSSVariable('sidebar-border', tokens.sidebar.border[mode], element);
  
  // 图标
  setCSSVariable('icon-default', tokens.icon.default[mode], element);
  setCSSVariable('icon-success', tokens.icon.success.value, element);
  setCSSVariable('icon-warning', tokens.icon.warning.value, element);
  setCSSVariable('icon-error', tokens.icon.error.value, element);
  setCSSVariable('icon-info', tokens.icon.info.value, element);
  
  // 工具栏
  setCSSVariable('toolbar-bg', tokens.toolbar.background[mode], element);
  setCSSVariable('toolbar-border', tokens.toolbar.border[mode], element);
  setCSSVariable('toolbar-shadow', tokens.toolbar.shadow[mode], element);
  
  // 消息块
  setCSSVariable('msg-block-bg', tokens.messageBlock.background[mode], element);
  setCSSVariable('msg-block-bg-hover', tokens.messageBlock.backgroundHover[mode], element);
  setCSSVariable('msg-block-bg-content', tokens.messageBlock.backgroundContent[mode], element);
  setCSSVariable('msg-block-bg-header', tokens.messageBlock.backgroundHeader[mode], element);
  setCSSVariable('msg-block-code-bg', tokens.messageBlock.codeBackground[mode], element);
  setCSSVariable('msg-block-scrollbar-thumb', tokens.messageBlock.scrollbarThumb[mode], element);
  setCSSVariable('msg-block-scrollbar-track', tokens.messageBlock.scrollbarTrack[mode], element);
  
  // 渐变
  if (tokens.gradients) {
    setCSSVariable('gradient-primary', tokens.gradients.primary, element);
    if (tokens.gradients.secondary) {
      setCSSVariable('gradient-secondary', tokens.gradients.secondary, element);
    }
  }
};

/**
 * 移除所有主题相关的 CSS Variables
 */
export const removeCSSVariables = (element: HTMLElement = document.documentElement): void => {
  const variableNames = [
    // 品牌颜色
    'primary', 'secondary', 'accent',
    
    // 背景
    'bg-default', 'bg-paper', 'bg-elevated',
    
    // 文字
    'text-primary', 'text-secondary', 'text-disabled', 'text-hint',
    
    // 边框
    'border-default', 'border-subtle', 'border-strong', 'border-focus',
    
    // 交互
    'hover-bg', 'active-bg', 'selected-bg', 'disabled-bg',
    
    // 消息
    'msg-ai-bg', 'msg-ai-bg-active', 'msg-ai-text', 'msg-ai-border',
    'msg-user-bg', 'msg-user-bg-active', 'msg-user-text', 'msg-user-border',
    'msg-system-bg', 'msg-system-text', 'msg-system-border',
    
    // 按钮
    'btn-primary-bg', 'btn-primary-text', 'btn-primary-border', 'btn-primary-hover',
    'btn-secondary-bg', 'btn-secondary-text', 'btn-secondary-border', 'btn-secondary-hover',
    
    // 输入框
    'input-bg', 'input-text', 'input-placeholder', 'input-border',
    'input-border-hover', 'input-border-focus',
    
    // 侧边栏
    'sidebar-bg', 'sidebar-item-hover', 'sidebar-item-selected',
    'sidebar-item-selected-hover', 'sidebar-border',
    
    // 图标
    'icon-default', 'icon-success', 'icon-warning', 'icon-error', 'icon-info',
    
    // 工具栏
    'toolbar-bg', 'toolbar-border', 'toolbar-shadow',
    
    // 消息块
    'msg-block-bg', 'msg-block-bg-hover', 'msg-block-bg-content', 'msg-block-bg-header',
    'msg-block-code-bg', 'msg-block-scrollbar-thumb', 'msg-block-scrollbar-track',
    
    // 渐变
    'gradient-primary', 'gradient-secondary',
  ];
  
  variableNames.forEach(name => removeCSSVariable(name, element));
};

/**
 * 获取当前应用的主题颜色（从 CSS Variables 中读取）
 */
export const getCurrentThemeColors = () => {
  return {
    // 品牌颜色
    primary: getCSSVariable('primary'),
    secondary: getCSSVariable('secondary'),
    accent: getCSSVariable('accent'),
    
    // 背景
    bgDefault: getCSSVariable('bg-default'),
    bgPaper: getCSSVariable('bg-paper'),
    bgElevated: getCSSVariable('bg-elevated'),
    
    // 文字
    textPrimary: getCSSVariable('text-primary'),
    textSecondary: getCSSVariable('text-secondary'),
    textDisabled: getCSSVariable('text-disabled'),
    textHint: getCSSVariable('text-hint'),
    
    // 边框
    borderDefault: getCSSVariable('border-default'),
    borderSubtle: getCSSVariable('border-subtle'),
    borderStrong: getCSSVariable('border-strong'),
    borderFocus: getCSSVariable('border-focus'),
    
    // 交互
    hoverBg: getCSSVariable('hover-bg'),
    activeBg: getCSSVariable('active-bg'),
    selectedBg: getCSSVariable('selected-bg'),
    disabledBg: getCSSVariable('disabled-bg'),
    
    // 消息
    msgAiBg: getCSSVariable('msg-ai-bg'),
    msgAiBgActive: getCSSVariable('msg-ai-bg-active'),
    msgAiText: getCSSVariable('msg-ai-text'),
    msgAiBorder: getCSSVariable('msg-ai-border'),
    msgUserBg: getCSSVariable('msg-user-bg'),
    msgUserBgActive: getCSSVariable('msg-user-bg-active'),
    msgUserText: getCSSVariable('msg-user-text'),
    msgUserBorder: getCSSVariable('msg-user-border'),
    msgSystemBg: getCSSVariable('msg-system-bg'),
    msgSystemText: getCSSVariable('msg-system-text'),
    msgSystemBorder: getCSSVariable('msg-system-border'),
    
    // 按钮
    btnPrimaryBg: getCSSVariable('btn-primary-bg'),
    btnPrimaryText: getCSSVariable('btn-primary-text'),
    btnPrimaryBorder: getCSSVariable('btn-primary-border'),
    btnPrimaryHover: getCSSVariable('btn-primary-hover'),
    btnSecondaryBg: getCSSVariable('btn-secondary-bg'),
    btnSecondaryText: getCSSVariable('btn-secondary-text'),
    btnSecondaryBorder: getCSSVariable('btn-secondary-border'),
    btnSecondaryHover: getCSSVariable('btn-secondary-hover'),
    
    // 输入框
    inputBg: getCSSVariable('input-bg'),
    inputText: getCSSVariable('input-text'),
    inputPlaceholder: getCSSVariable('input-placeholder'),
    inputBorder: getCSSVariable('input-border'),
    inputBorderHover: getCSSVariable('input-border-hover'),
    inputBorderFocus: getCSSVariable('input-border-focus'),
    
    // 侧边栏
    sidebarBg: getCSSVariable('sidebar-bg'),
    sidebarItemHover: getCSSVariable('sidebar-item-hover'),
    sidebarItemSelected: getCSSVariable('sidebar-item-selected'),
    sidebarItemSelectedHover: getCSSVariable('sidebar-item-selected-hover'),
    sidebarBorder: getCSSVariable('sidebar-border'),
    
    // 图标
    iconDefault: getCSSVariable('icon-default'),
    iconSuccess: getCSSVariable('icon-success'),
    iconWarning: getCSSVariable('icon-warning'),
    iconError: getCSSVariable('icon-error'),
    iconInfo: getCSSVariable('icon-info'),
    
    // 工具栏
    toolbarBg: getCSSVariable('toolbar-bg'),
    toolbarBorder: getCSSVariable('toolbar-border'),
    toolbarShadow: getCSSVariable('toolbar-shadow'),
    
    // 渐变
    gradientPrimary: getCSSVariable('gradient-primary'),
    gradientSecondary: getCSSVariable('gradient-secondary'),
  };
};

/**
 * 帮助函数：获取 var() 引用
 */
export const cssVar = (name: string): string => {
  return `var(${getCSSVarName(name)})`;
};

/**
 * 帮助函数：带回退值的 var() 引用
 */
export const cssVarWithFallback = (name: string, fallback: string): string => {
  return `var(${getCSSVarName(name)}, ${fallback})`;
};

