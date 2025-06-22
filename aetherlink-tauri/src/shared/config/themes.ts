import { createTheme, alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { getFontFamilyString } from './fonts';

// 主题风格类型
export type ThemeStyle = 'default' | 'claude' | 'minimal' | 'vibrant' | 'nature' | 'ocean' | 'sunset' | 'monochrome' | 'cyberpunk';

// 主题配置接口
export interface ThemeConfig {
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    background: {
      light: string;
      dark: string;
    };
    paper: {
      light: string;
      dark: string;
    };
    text: {
      primary: {
        light: string;
        dark: string;
      };
      secondary: {
        light: string;
        dark: string;
      };
    };
  };
  gradients?: {
    primary: string;
    secondary?: string;
  };
  shadows?: {
    light: string[];
    dark: string[];
  };
}

// 预定义主题配置
export const themeConfigs: Record<ThemeStyle, ThemeConfig> = {
  default: {
    name: '默认主题',
    description: '简洁现代的默认设计风格',
    colors: {
      primary: '#64748B',
      secondary: '#10B981',
      background: {
        light: '#FFFFFF',
        dark: '#1A1A1A', // 统一使用稍微柔和的深灰色
      },
      paper: {
        light: '#FFFFFF',
        dark: '#2A2A2A', // 改为更柔和的深灰色，提高可读性
      },
      text: {
        primary: {
          light: '#1E293B',
          dark: '#F0F0F0', // 改为稍微柔和的白色，提高舒适度
        },
        secondary: {
          light: '#64748B',
          dark: '#B0B0B0', // 提高次要文字的对比度
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(90deg, #9333EA, #754AB4)',
    },
  },

  claude: {
    name: 'Claude 风格',
    description: '温暖优雅的 Claude AI 设计风格',
    colors: {
      primary: '#D97706',
      secondary: '#059669',
      accent: '#DC2626',
      background: {
        light: '#FEF7ED',
        dark: '#1C1917',
      },
      paper: {
        light: '#FEF7ED', // 改为与背景色一致的米色
        dark: '#292524',
      },
      text: {
        primary: {
          light: '#1C1917',
          dark: '#F5F5F4',
        },
        secondary: {
          light: '#78716C',
          dark: '#A8A29E',
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #D97706, #EA580C)',
      secondary: 'linear-gradient(135deg, #059669, #047857)',
    },
  },

  minimal: {
    name: '极简风格',
    description: '纯净简约的极简主义设计',
    colors: {
      primary: '#000000',
      secondary: '#6B7280',
      background: {
        light: '#FFFFFF',
        dark: '#1A1A1A', // 改为稍微柔和的深灰色，避免纯黑色过于刺眼
      },
      paper: {
        light: '#FAFAFA',
        dark: '#2A2A2A', // 改为更柔和的深灰色
      },
      text: {
        primary: {
          light: '#000000',
          dark: '#F0F0F0', // 改为稍微柔和的白色，避免纯白色过于刺眼
        },
        secondary: {
          light: '#6B7280',
          dark: '#A0A0A0', // 调整次要文字颜色，提高可读性
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(90deg, #000000, #374151)',
    },
  },

  vibrant: {
    name: '活力风格',
    description: '充满活力的彩色设计风格',
    colors: {
      primary: '#8B5CF6',
      secondary: '#06B6D4',
      accent: '#F59E0B',
      background: {
        light: '#FAFBFF', // 改为更中性的浅色背景，提高文字对比度
        dark: '#0F172A',
      },
      paper: {
        light: '#FFFFFF',
        dark: '#1E293B',
      },
      text: {
        primary: {
          light: '#1E293B', // 改为更深的颜色，提高在浅色背景上的对比度
          dark: '#F1F5F9',
        },
        secondary: {
          light: '#334155', // 改为更深的颜色，提高可读性
          dark: '#CBD5E1',
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
      secondary: 'linear-gradient(135deg, #F59E0B, #EF4444)',
    },
  },

  nature: {
    name: '自然风格',
    description: '2025年流行的自然系大地色调设计',
    colors: {
      primary: '#2D5016', // 深森林绿
      secondary: '#8B7355', // 大地棕色
      accent: '#C7B299', // 温暖米色
      background: {
        light: '#F7F5F3', // 温暖的米白色背景
        dark: '#1A1F16', // 深绿黑色
      },
      paper: {
        light: '#F7F5F3', // 与背景一致的米白色
        dark: '#252B20', // 深绿灰色
      },
      text: {
        primary: {
          light: '#1A1F16', // 深绿黑色文字
          dark: '#E8E6E3', // 温暖的浅色文字
        },
        secondary: {
          light: '#5D6B47', // 橄榄绿色次要文字
          dark: '#B8B5B0', // 温暖的灰色次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #2D5016, #5D6B47)', // 森林绿渐变
      secondary: 'linear-gradient(135deg, #8B7355, #C7B299)', // 大地色渐变
    },
  },

  ocean: {
    name: '海洋风格',
    description: '深邃宁静的海洋蓝色调设计',
    colors: {
      primary: '#0F4C75', // 深海蓝
      secondary: '#3282B8', // 海洋蓝
      accent: '#BBE1FA', // 浅海蓝
      background: {
        light: '#F0F8FF', // 爱丽丝蓝背景
        dark: '#0A1929', // 深海夜色
      },
      paper: {
        light: '#FFFFFF', // 纯白纸张
        dark: '#1E293B', // 深蓝灰色
      },
      text: {
        primary: {
          light: '#0F172A', // 深蓝黑色文字
          dark: '#F1F5F9', // 浅色文字
        },
        secondary: {
          light: '#475569', // 蓝灰色次要文字
          dark: '#CBD5E1', // 浅蓝灰色次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #0F4C75, #3282B8)', // 海洋蓝渐变
      secondary: 'linear-gradient(135deg, #3282B8, #BBE1FA)', // 浅海蓝渐变
    },
  },

  sunset: {
    name: '日落风格',
    description: '温暖浪漫的日落橙色调设计',
    colors: {
      primary: '#FF6B35', // 日落橙
      secondary: '#F7931E', // 金橙色
      accent: '#FFD23F', // 金黄色
      background: {
        light: '#FFF8F0', // 温暖的奶白色背景
        dark: '#2D1B0E', // 深棕色夜晚
      },
      paper: {
        light: '#FFFFFF', // 纯白纸张
        dark: '#3C2415', // 深棕色
      },
      text: {
        primary: {
          light: '#2D1B0E', // 深棕色文字
          dark: '#F5E6D3', // 温暖的浅色文字
        },
        secondary: {
          light: '#8B4513', // 棕色次要文字
          dark: '#D2B48C', // 浅棕色次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #FF6B35, #F7931E)', // 日落渐变
      secondary: 'linear-gradient(135deg, #F7931E, #FFD23F)', // 金色渐变
    },
  },

  monochrome: {
    name: '单色风格',
    description: '极简高级的黑白灰色调设计',
    colors: {
      primary: '#000000', // 纯黑
      secondary: '#6B7280', // 中性灰
      accent: '#9CA3AF', // 浅灰
      background: {
        light: '#FFFFFF', // 纯白背景
        dark: '#000000', // 纯黑背景
      },
      paper: {
        light: '#F9FAFB', // 极浅灰纸张
        dark: '#111111', // 深黑纸张
      },
      text: {
        primary: {
          light: '#000000', // 纯黑文字
          dark: '#FFFFFF', // 纯白文字
        },
        secondary: {
          light: '#6B7280', // 中性灰次要文字
          dark: '#9CA3AF', // 浅灰次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #000000, #374151)', // 黑灰渐变
      secondary: 'linear-gradient(135deg, #6B7280, #D1D5DB)', // 灰色渐变
    },
  },

  cyberpunk: {
    name: '赛博朋克',
    description: '未来科技感的霓虹色调设计',
    colors: {
      primary: '#00FFFF', // 霓虹青色
      secondary: '#FF00FF', // 霓虹紫色
      accent: '#FFFF00', // 霓虹黄色
      background: {
        light: '#F0F0F0', // 浅灰背景
        dark: '#0A0A0A', // 深黑背景
      },
      paper: {
        light: '#FFFFFF', // 纯白纸张
        dark: '#1A1A1A', // 深灰纸张
      },
      text: {
        primary: {
          light: '#000000', // 黑色文字
          dark: '#00FFFF', // 霓虹青色文字
        },
        secondary: {
          light: '#666666', // 深灰次要文字
          dark: '#FF00FF', // 霓虹紫色次要文字
        },
      },
    },
    gradients: {
      primary: 'linear-gradient(135deg, #00FFFF, #FF00FF)', // 霓虹渐变
      secondary: 'linear-gradient(135deg, #FF00FF, #FFFF00)', // 彩虹霓虹渐变
    },
  },
};

// 创建主题函数
export const createCustomTheme = (
  mode: 'light' | 'dark',
  themeStyle: ThemeStyle,
  fontSize: number = 16,
  fontFamily: string = 'system'
): Theme => {
  const config = themeConfigs[themeStyle];
  const fontScale = fontSize / 16;
  const fontFamilyString = getFontFamilyString(fontFamily);

  return createTheme({
    palette: {
      mode,
      primary: {
        main: config.colors.primary,
        light: alpha(config.colors.primary, 0.7),
        dark: alpha(config.colors.primary, 0.9),
      },
      secondary: {
        main: config.colors.secondary,
        light: alpha(config.colors.secondary, 0.7),
        dark: alpha(config.colors.secondary, 0.9),
      },
      background: {
        default: config.colors.background[mode],
        paper: config.colors.paper[mode],
      },
      text: {
        primary: config.colors.text.primary[mode],
        secondary: config.colors.text.secondary[mode],
      },
      divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
      error: {
        main: '#EF4444',
      },
      warning: {
        main: '#F59E0B',
      },
      info: {
        main: '#38BDF8',
      },
      success: {
        main: '#10B981',
      },
    },
    typography: {
      fontSize: fontSize,
      fontFamily: fontFamilyString,
      h1: { fontSize: `${2.5 * fontScale}rem` },
      h2: { fontSize: `${2 * fontScale}rem` },
      h3: { fontSize: `${1.75 * fontScale}rem` },
      h4: { fontSize: `${1.5 * fontScale}rem` },
      h5: { fontSize: `${1.25 * fontScale}rem` },
      h6: { fontSize: `${1.125 * fontScale}rem` },
      body1: { fontSize: `${1 * fontScale}rem` },
      body2: { fontSize: `${0.875 * fontScale}rem` },
      caption: { fontSize: `${0.75 * fontScale}rem` },
    },
    shape: {
      borderRadius: themeStyle === 'minimal' ? 4 : 8,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            ...(themeStyle === 'claude' && {
              boxShadow: mode === 'light'
                ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                : '0 4px 6px rgba(0, 0, 0, 0.3)',
            }),
            ...(themeStyle === 'nature' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(45, 80, 22, 0.08), 0 1px 2px rgba(45, 80, 22, 0.04)'
                : '0 4px 8px rgba(0, 0, 0, 0.4)',
            }),
            ...(themeStyle === 'ocean' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(15, 76, 117, 0.08), 0 1px 2px rgba(15, 76, 117, 0.04)'
                : '0 4px 8px rgba(0, 0, 0, 0.4)',
            }),
            ...(themeStyle === 'sunset' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(255, 107, 53, 0.08), 0 1px 2px rgba(255, 107, 53, 0.04)'
                : '0 4px 8px rgba(0, 0, 0, 0.4)',
            }),
            ...(themeStyle === 'monochrome' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                : '0 4px 8px rgba(255, 255, 255, 0.1)',
            }),
            ...(themeStyle === 'cyberpunk' && {
              boxShadow: mode === 'light'
                ? '0 2px 4px rgba(0, 255, 255, 0.2), 0 1px 2px rgba(255, 0, 255, 0.1)'
                : '0 4px 8px rgba(0, 255, 255, 0.3), 0 2px 4px rgba(255, 0, 255, 0.2)',
            }),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            ...(config.gradients && {
              '&.MuiButton-contained': {
                background: config.gradients.primary,
                '&:hover': {
                  background: config.gradients.primary,
                  filter: 'brightness(0.9)',
                },
              },
            }),
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            ...(themeStyle === 'claude' && {
              background: mode === 'light'
                ? `rgba(254, 247, 237, 0.95)` // 使用Claude主题的米色背景
                : 'rgba(41, 37, 36, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
            ...(themeStyle === 'nature' && {
              background: mode === 'light'
                ? `rgba(247, 245, 243, 0.95)` // 使用自然主题的温暖米色背景
                : 'rgba(26, 31, 22, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
            ...(themeStyle === 'ocean' && {
              background: mode === 'light'
                ? `rgba(240, 248, 255, 0.95)` // 使用海洋主题的浅蓝背景
                : 'rgba(10, 25, 41, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
            ...(themeStyle === 'sunset' && {
              background: mode === 'light'
                ? `rgba(255, 248, 240, 0.95)` // 使用日落主题的温暖背景
                : 'rgba(45, 27, 14, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
            ...(themeStyle === 'monochrome' && {
              background: mode === 'light'
                ? `rgba(255, 255, 255, 0.95)` // 使用单色主题的纯白背景
                : 'rgba(0, 0, 0, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
            ...(themeStyle === 'cyberpunk' && {
              background: mode === 'light'
                ? `rgba(240, 240, 240, 0.95)` // 使用赛博朋克主题的浅灰背景
                : 'rgba(10, 10, 10, 0.95)',
              backdropFilter: 'blur(12px)',
            }),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            ...(themeStyle === 'claude' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(217, 119, 6, 0.1)'
                : '1px solid rgba(217, 119, 6, 0.2)',
            }),
            ...(themeStyle === 'nature' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(45, 80, 22, 0.1)'
                : '1px solid rgba(45, 80, 22, 0.2)',
            }),
            ...(themeStyle === 'ocean' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(15, 76, 117, 0.1)'
                : '1px solid rgba(15, 76, 117, 0.2)',
            }),
            ...(themeStyle === 'sunset' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(255, 107, 53, 0.1)'
                : '1px solid rgba(255, 107, 53, 0.2)',
            }),
            ...(themeStyle === 'monochrome' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(0, 0, 0, 0.1)'
                : '1px solid rgba(255, 255, 255, 0.1)',
            }),
            ...(themeStyle === 'cyberpunk' && {
              background: mode === 'light'
                ? config.colors.background.light
                : config.colors.background.dark,
              borderRight: mode === 'light'
                ? '1px solid rgba(0, 255, 255, 0.2)'
                : '1px solid rgba(0, 255, 255, 0.3)',
            }),
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            ...(themeStyle === 'claude' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(217, 119, 6, 0.08)'
                  : 'rgba(217, 119, 6, 0.12)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(217, 119, 6, 0.12)'
                  : 'rgba(217, 119, 6, 0.16)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(217, 119, 6, 0.16)'
                    : 'rgba(217, 119, 6, 0.20)',
                },
              },
            }),
            ...(themeStyle === 'nature' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(45, 80, 22, 0.08)'
                  : 'rgba(45, 80, 22, 0.12)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(45, 80, 22, 0.12)'
                  : 'rgba(45, 80, 22, 0.16)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(45, 80, 22, 0.16)'
                    : 'rgba(45, 80, 22, 0.20)',
                },
              },
            }),
            ...(themeStyle === 'ocean' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(15, 76, 117, 0.08)'
                  : 'rgba(15, 76, 117, 0.12)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(15, 76, 117, 0.12)'
                  : 'rgba(15, 76, 117, 0.16)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(15, 76, 117, 0.16)'
                    : 'rgba(15, 76, 117, 0.20)',
                },
              },
            }),
            ...(themeStyle === 'sunset' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(255, 107, 53, 0.08)'
                  : 'rgba(255, 107, 53, 0.12)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(255, 107, 53, 0.12)'
                  : 'rgba(255, 107, 53, 0.16)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(255, 107, 53, 0.16)'
                    : 'rgba(255, 107, 53, 0.20)',
                },
              },
            }),
            ...(themeStyle === 'monochrome' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(0, 0, 0, 0.04)'
                  : 'rgba(255, 255, 255, 0.08)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(0, 0, 0, 0.08)'
                  : 'rgba(255, 255, 255, 0.12)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(0, 0, 0, 0.12)'
                    : 'rgba(255, 255, 255, 0.16)',
                },
              },
            }),
            ...(themeStyle === 'cyberpunk' && {
              '&:hover': {
                backgroundColor: mode === 'light'
                  ? 'rgba(0, 255, 255, 0.08)'
                  : 'rgba(0, 255, 255, 0.12)',
              },
              '&.Mui-selected': {
                backgroundColor: mode === 'light'
                  ? 'rgba(0, 255, 255, 0.12)'
                  : 'rgba(0, 255, 255, 0.16)',
                '&:hover': {
                  backgroundColor: mode === 'light'
                    ? 'rgba(0, 255, 255, 0.16)'
                    : 'rgba(0, 255, 255, 0.20)',
                },
              },
            }),
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            ...(themeStyle === 'claude' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(217, 119, 6, 0.5)'
                    : 'rgba(217, 119, 6, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
            ...(themeStyle === 'nature' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(45, 80, 22, 0.5)'
                    : 'rgba(45, 80, 22, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
            ...(themeStyle === 'ocean' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(15, 76, 117, 0.5)'
                    : 'rgba(15, 76, 117, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
            ...(themeStyle === 'sunset' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(255, 107, 53, 0.5)'
                    : 'rgba(255, 107, 53, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
            ...(themeStyle === 'monochrome' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(0, 0, 0, 0.5)'
                    : 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
            ...(themeStyle === 'cyberpunk' && {
              '& .MuiOutlinedInput-root': {
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light'
                    ? 'rgba(0, 255, 255, 0.5)'
                    : 'rgba(0, 255, 255, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: config.colors.primary,
                },
              },
            }),
          },
        },
      },
      // 移除全局Box样式覆盖，避免影响消息内容
      // 添加全局CssBaseline样式覆盖
      MuiCssBaseline: {
        styleOverrides: {
          ...(themeStyle === 'claude' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
          ...(themeStyle === 'nature' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
          ...(themeStyle === 'ocean' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
          ...(themeStyle === 'sunset' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
          ...(themeStyle === 'monochrome' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
          ...(themeStyle === 'cyberpunk' && {
            body: {
              backgroundColor: config.colors.background[mode],
            },
            '#root': {
              backgroundColor: config.colors.background[mode],
            },
          }),
        },
      },
    },
  });
};

// 获取主题预览颜色
export const getThemePreviewColors = (themeStyle: ThemeStyle) => {
  const config = themeConfigs[themeStyle];
  return {
    primary: config.colors.primary,
    secondary: config.colors.secondary,
    background: config.colors.background.light,
    paper: config.colors.paper.light,
  };
};
