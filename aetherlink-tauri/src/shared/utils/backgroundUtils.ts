/**
 * 聊天背景管理工具函数
 */

// 支持的图片格式
export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// 最大文件大小 (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * 验证上传的图片文件
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // 检查文件类型
  if (!SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: '不支持的图片格式。请上传 JPG、PNG、GIF 或 WebP 格式的图片。'
    };
  }

  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: '图片文件过大。请上传小于 5MB 的图片。'
    };
  }

  return { valid: true };
};

/**
 * 将文件转换为Base64数据URL
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * 压缩图片（如果需要）
 */
export const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 计算压缩后的尺寸
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height);

      // 转换为数据URL
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * 生成背景样式对象
 */
export const generateBackgroundStyle = (background: {
  enabled: boolean;
  imageUrl: string;
  opacity: number;
  size: string;
  position: string;
  repeat: string;
}): Record<string, any> => {
  if (!background.enabled || !background.imageUrl) {
    return {};
  }

  return {
    backgroundImage: `url(${background.imageUrl})`,
    backgroundSize: background.size,
    backgroundPosition: background.position,
    backgroundRepeat: background.repeat,
    backgroundAttachment: 'local', // 使用local而不是fixed，避免在移动端的问题
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: `rgba(255, 255, 255, ${1 - background.opacity})`,
      pointerEvents: 'none',
      zIndex: 1
    },
    '& > *': {
      position: 'relative',
      zIndex: 2
    }
  };
};

/**
 * 清理背景图片资源
 */
export const cleanupBackgroundImage = (imageUrl: string) => {
  if (imageUrl && imageUrl.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl);
  }
};

/**
 * 获取背景预设选项
 */
export const getBackgroundPresets = () => [
  { label: '覆盖', value: 'cover', description: '图片覆盖整个区域，可能会裁剪' },
  { label: '包含', value: 'contain', description: '图片完整显示，可能有空白区域' },
  { label: '原始大小', value: 'auto', description: '图片按原始大小显示' }
];

export const getBackgroundPositions = () => [
  { label: '居中', value: 'center' },
  { label: '顶部', value: 'top' },
  { label: '底部', value: 'bottom' },
  { label: '左侧', value: 'left' },
  { label: '右侧', value: 'right' }
];

export const getBackgroundRepeats = () => [
  { label: '不重复', value: 'no-repeat' },
  { label: '重复', value: 'repeat' },
  { label: '水平重复', value: 'repeat-x' },
  { label: '垂直重复', value: 'repeat-y' }
];
