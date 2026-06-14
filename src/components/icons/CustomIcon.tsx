import React from 'react';
import { iconData, type IconName } from './iconData';
import { createLogger } from '../../shared/services/infra/logger';

const logger = createLogger('CustomIcon');

interface CustomIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

/**
 * 统一的自定义图标组件
 * 通过 name 属性选择不同的图标
 */
export const CustomIcon: React.FC<CustomIconProps> = ({ 
  name,
  size = 16, 
  color = 'currentColor',
  className 
}) => {
  const icon = iconData[name];
  
  if (!icon) {
    logger.warn(`CustomIcon: 未找到名为 "${name}" 的图标`);
    return null;
  }

  // 渲染多个 path（stroke 模式）
  if (icon.paths && icon.strokeBased) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={icon.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label={icon.description}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon.paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    );
  }

  // 渲染单个 path（fill 模式）
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={icon.description}
    >
      <path
        fill={color}
        fillRule="evenodd"
        d={icon.path}
        clipRule="evenodd"
      />
    </svg>
  );
};

export default CustomIcon;
