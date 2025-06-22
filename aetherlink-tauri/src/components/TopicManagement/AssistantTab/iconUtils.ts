import React from 'react';
import {
  User, Bot, Brain, Rocket, Search, BookOpen, Lightbulb,
  Target, Palette, Gamepad2, Globe, Laptop, FileText, BarChart,
  Puzzle, Settings, Wrench, TestTube, Microscope, Trophy, GraduationCap,
  Briefcase, TrendingUp, DollarSign, ShoppingCart, Handshake, Smartphone,
  MessageCircle, Mail, Calendar, Lock, Key, Shield, Folder, Clipboard,
  Pin, Magnet, Heart, Star, Zap, Coffee, Music, Camera, Video, Headphones,
  Code, Database, Server, Cloud, Wifi, Download, Upload, Share, Link,
  Edit, Trash2, Plus, Minus, Check, X, ArrowRight, ArrowLeft, Home, Menu
} from 'lucide-react';

// 图标映射表
export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  User, Bot, Brain, Rocket, Search, BookOpen, Lightbulb,
  Target, Palette, Gamepad2, Globe, Laptop, FileText, BarChart,
  Puzzle, Settings, Wrench, TestTube, Microscope, Trophy, GraduationCap,
  Briefcase, TrendingUp, DollarSign, ShoppingCart, Handshake, Smartphone,
  MessageCircle, Mail, Calendar, Lock, Key, Shield, Folder, Clipboard,
  Pin, Magnet, Heart, Star, Zap, Coffee, Music, Camera, Video, Headphones,
  Code, Database, Server, Cloud, Wifi, Download, Upload, Share, Link,
  Edit, Trash2, Plus, Minus, Check, X, ArrowRight, ArrowLeft, Home, Menu
};

// 现代化图标分类
export const LUCIDE_ICON_CATEGORIES = {
  people: [
    { icon: User, name: 'User' },
    { icon: Bot, name: 'Bot' },
    { icon: Brain, name: 'Brain' },
    { icon: GraduationCap, name: 'GraduationCap' },
    { icon: Briefcase, name: 'Briefcase' }
  ],
  tech: [
    { icon: Laptop, name: 'Laptop' },
    { icon: Smartphone, name: 'Smartphone' },
    { icon: Code, name: 'Code' },
    { icon: Database, name: 'Database' },
    { icon: Server, name: 'Server' },
    { icon: Cloud, name: 'Cloud' },
    { icon: Wifi, name: 'Wifi' }
  ],
  tools: [
    { icon: Settings, name: 'Settings' },
    { icon: Wrench, name: 'Wrench' },
    { icon: TestTube, name: 'TestTube' },
    { icon: Microscope, name: 'Microscope' },
    { icon: Search, name: 'Search' },
    { icon: Edit, name: 'Edit' },
    { icon: Puzzle, name: 'Puzzle' }
  ],
  business: [
    { icon: Target, name: 'Target' },
    { icon: TrendingUp, name: 'TrendingUp' },
    { icon: BarChart, name: 'BarChart' },
    { icon: DollarSign, name: 'DollarSign' },
    { icon: ShoppingCart, name: 'ShoppingCart' },
    { icon: Handshake, name: 'Handshake' },
    { icon: Trophy, name: 'Trophy' }
  ],
  creative: [
    { icon: Palette, name: 'Palette' },
    { icon: Camera, name: 'Camera' },
    { icon: Video, name: 'Video' },
    { icon: Music, name: 'Music' },
    { icon: Headphones, name: 'Headphones' },
    { icon: Gamepad2, name: 'Gamepad2' },
    { icon: Lightbulb, name: 'Lightbulb' }
  ],
  general: [
    { icon: Heart, name: 'Heart' },
    { icon: Star, name: 'Star' },
    { icon: Zap, name: 'Zap' },
    { icon: Coffee, name: 'Coffee' },
    { icon: Rocket, name: 'Rocket' },
    { icon: Globe, name: 'Globe' },
    { icon: BookOpen, name: 'BookOpen' },
    { icon: FileText, name: 'FileText' },
    { icon: MessageCircle, name: 'MessageCircle' },
    { icon: Mail, name: 'Mail' },
    { icon: Calendar, name: 'Calendar' },
    { icon: Folder, name: 'Folder' },
    { icon: Home, name: 'Home' }
  ]
};

// 保持向后兼容的emoji列表
export const COMMON_EMOJIS = [
  '😀', '😊', '🤖', '👨‍💻', '👩‍💻', '🧠', '🚀', '🔍', '📚', '💡',
  '🎯', '🎨', '🎮', '🌍', '💻', '📝', '📊', '🧩', '⚙️', '🔧',
  '🧪', '🔬', '🏆', '🎓', '💼', '📈', '💰', '🛒', '🤝', '📱',
  '💬', '📧', '📅', '🔐', '🔑', '🛡️', '📁', '📋', '📌', '🧲'
];

/**
 * 检查是否为Lucide图标名称
 */
export function isLucideIcon(iconName: string): boolean {
  return iconName in ICON_MAP;
}

/**
 * 获取所有可用的Lucide图标名称
 */
export function getAllLucideIconNames(): string[] {
  return Object.keys(ICON_MAP);
} 