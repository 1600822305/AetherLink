import type { Area } from 'react-easy-crop';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('cropImage');

/**
 * 创建裁剪后的图片
 * @param imageSrc 原始图片的 data URL
 * @param pixelCrop 裁剪区域的像素坐标
 * @param rotation 旋转角度（暂不支持，保留为0）
 * @returns 裁剪后的圆形头像 data URL
 */
export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<string> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // 设置输出尺寸为 200x200
  const outputSize = 200;
  canvas.width = outputSize;
  canvas.height = outputSize;

  // 计算缩放比例
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // 创建圆形裁剪路径
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.clip();

  // 保存当前状态
  ctx.save();

  // 移动到画布中心
  ctx.translate(outputSize / 2, outputSize / 2);
  
  // 应用旋转（如果需要）
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  // 绘制裁剪后的图片
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    -outputSize / 2,
    -outputSize / 2,
    outputSize,
    outputSize
  );

  // 恢复状态
  ctx.restore();

  // 返回裁剪后的 data URL
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        logger.error('Canvas is empty');
        return resolve('');
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
};

/**
 * 从 URL 创建图片对象
 * @param url 图片 URL
 * @returns Promise<HTMLImageElement>
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // 避免跨域问题
    image.src = url;
  });
