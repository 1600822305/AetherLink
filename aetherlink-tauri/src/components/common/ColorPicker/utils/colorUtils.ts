/**
 * 颜色转换工具函数
 * 支持 RGB、HSV、HEX 之间的相互转换
 */

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

/**
 * 将十六进制颜色转换为RGB
 */
export const hexToRgb = (hex: string): RGB => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

/**
 * 将RGB转换为十六进制颜色
 */
export const rgbToHex = (rgb: RGB): string => {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

/**
 * 将RGB转换为HSV
 */
export const rgbToHsv = (rgb: RGB): HSV => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const v = max;

  if (diff !== 0) {
    s = diff / max;

    switch (max) {
      case r:
        h = ((g - b) / diff) % 6;
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return {
    h,
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
};

/**
 * 将HSV转换为RGB
 */
export const hsvToRgb = (hsv: HSV): RGB => {
  const h = hsv.h / 60;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 1) {
    r = c; g = x; b = 0;
  } else if (h >= 1 && h < 2) {
    r = x; g = c; b = 0;
  } else if (h >= 2 && h < 3) {
    r = 0; g = c; b = x;
  } else if (h >= 3 && h < 4) {
    r = 0; g = x; b = c;
  } else if (h >= 4 && h < 5) {
    r = x; g = 0; b = c;
  } else if (h >= 5 && h < 6) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
};

/**
 * 将十六进制颜色转换为HSV
 */
export const hexToHsv = (hex: string): HSV => {
  return rgbToHsv(hexToRgb(hex));
};

/**
 * 将HSV转换为十六进制颜色
 */
export const hsvToHex = (hsv: HSV): string => {
  return rgbToHex(hsvToRgb(hsv));
};

/**
 * 验证十六进制颜色格式
 */
export const isValidHex = (hex: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
};

/**
 * 确保颜色值在有效范围内
 */
export const clampColor = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * 根据色相值生成纯色（饱和度和亮度为100%）
 */
export const getHueColor = (hue: number): string => {
  return hsvToHex({ h: hue, s: 100, v: 100 });
};

/**
 * 检测是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  const userAgent = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  return isMobileUA || (isTouchDevice && isSmallScreen);
};
