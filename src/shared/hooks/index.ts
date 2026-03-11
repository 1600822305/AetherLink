// 导出所有钩子函数

// 助手相关
export { useAssistant } from './useAssistant';

// 输入框相关 - 重构后的统一hooks
export { useChatInputLogic } from './useChatInputLogic';
export { useInputState } from './useInputState';
export { useInputStyles } from './useInputStyles';
export { useKnowledgeContext } from './useKnowledgeContext';

// 长文本粘贴
export { useLongTextPaste, type UseLongTextPasteOptions, type UseLongTextPasteReturn } from './useLongTextPaste';

// 文件上传
export { useFileUpload } from './useFileUpload';

// 语音识别
export { useVoiceRecognition } from './useVoiceRecognition';

// 应用状态
export { useAppState } from './useAppState';

// 返回按钮
export { useBackButton } from './useBackButton';

// 键盘管理
export { useKeyboard } from './useKeyboard';
export type { UseKeyboardOptions, UseKeyboardResult } from './useKeyboard';

// 模型组合同步
export { useModelComboSync } from './useModelComboSync';

// 笔记搜索
export { useNotesSearch } from './useNotesSearch';

// 话题管理
export { useTopicManagement } from './useTopicManagement';

// 视觉视口
export { useVisualViewport } from './useVisualViewport';