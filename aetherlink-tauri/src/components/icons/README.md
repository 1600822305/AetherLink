# 自定义图标组件

这个文件夹包含项目中使用的自定义图标组件。

## 使用方法

### 使用统一图标组件
```tsx
import { CustomIcon } from '@/components/icons';

// 使用不同的图标
<CustomIcon name="search" size={24} color="#3b82f6" />
<CustomIcon name="imageGenerate" size={20} color="#9c27b0" />
```

### 获取图标类型提示
```tsx
import { CustomIcon, type IconName } from '@/components/icons';

const iconName: IconName = 'search'; // 类型安全
<CustomIcon name={iconName} />
```

## 图标组件规范

每个图标组件应该：

1. **接受标准属性**：
   - `size?: number` - 图标大小，默认 16
   - `color?: string` - 图标颜色，默认 'currentColor'
   - `className?: string` - CSS 类名

2. **使用 SVG 格式**：
   - 使用 24x24 的 viewBox
   - 支持颜色自定义
   - 响应式大小

3. **导出规范**：
   - 默认导出和命名导出
   - 在 index.ts 中统一导出

## 现有图标

### search
带有星形装饰元素的搜索图标，用于替代标准的搜索图标。

**使用场景**：
- 工具栏搜索按钮
- 搜索输入框
- 网络搜索功能

### imageGenerate
带有星形装饰元素和图片框架的图片生成图标。

**使用场景**：
- 图片生成按钮
- AI 图片创建功能
- 图像工具栏

### documentPanel
带有文本行的双面板文档布局图标。

**使用场景**：
- 文档管理界面
- 双栏布局切换
- 内容预览面板
- 文档编辑器

### settingsPanel
带有星形装饰和网格布局的设置图标。

**使用场景**：
- 设置按钮
- 配置面板入口
- 工具栏设置
- 系统配置

### quickPhrase
对话气泡内包含多行文本的快捷短语图标。

**使用场景**：
- 快捷短语按钮
- 文本模板功能
- 预设文本输入
- 快速回复功能

### aiDebate
多层对话框表示多AI角色辩论功能。

**使用场景**：
- AI辩论按钮
- 多AI角色对话功能
- 辩论设置界面
- 智能讨论功能

**示例**：
```tsx
<CustomIcon name="search" size={16} color="rgba(59, 130, 246, 0.8)" />
<CustomIcon name="imageGenerate" size={16} color="rgba(156, 39, 176, 0.8)" />
<CustomIcon name="documentPanel" size={16} color="rgba(76, 175, 80, 0.8)" />
<CustomIcon name="settingsPanel" size={16} color="rgba(255, 152, 0, 0.8)" />
<CustomIcon name="quickPhrase" size={16} color="rgba(156, 39, 176, 0.8)" />
<CustomIcon name="aiDebate" size={16} color="rgba(33, 150, 243, 0.8)" />
```

## 添加新图标

1. 在 `iconData.ts` 中添加新的图标数据：
```tsx
export const iconData: Record<string, IconData> = {
  // 现有图标...

  // 新图标
  newIcon: {
    viewBox: "0 0 24 24",
    path: "你的SVG路径数据",
    description: "图标描述"
  }
};
```

2. 更新此 README 文档
3. 使用新图标：`<CustomIcon name="newIcon" />`

## 图标来源

- search: 来自用户提供的 SVG 路径，包含搜索放大镜和星形装饰元素的组合设计
- imageGenerate: 来自用户提供的 SVG 路径，包含图片框架和星形装饰元素的组合设计
