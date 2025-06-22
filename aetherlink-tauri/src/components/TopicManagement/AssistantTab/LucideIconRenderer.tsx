import React from 'react';
import { Bot } from 'lucide-react';
import { ICON_MAP } from './iconUtils';

interface LucideIconRendererProps {
  iconName: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lucide图标渲染器 - 根据图标名称渲染对应的Lucide图标
 */
export default function LucideIconRenderer({ 
  iconName, 
  size = 20, 
  color, 
  className,
  style 
}: LucideIconRendererProps) {
  const IconComponent = ICON_MAP[iconName];
  
  if (!IconComponent) {
    // 如果找不到图标，显示默认的Bot图标
    return <Bot size={size} color={color} className={className} style={style} />;
  }
  
  return <IconComponent size={size} color={color} className={className} style={style} />;
}