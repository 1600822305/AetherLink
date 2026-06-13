/**
 * EditModelForm - SolidJS 版本
 * 编辑/添加模型的表单主体（受控组件）
 * - 所有状态由 React 外壳通过 props 下发
 * - 变更通过回调上报给 React，保证保存时数据最新
 * - 复杂的头像裁剪、模型类型规则管理仍由 React 弹窗承担（通过回调触发）
 * 使用原生 HTML + CSS，不依赖 Material-UI
 */
import { For, Show, splitProps } from 'solid-js';
import { ModelType } from '../../../shared/types';
import { getModelTypeDisplayName } from '../../../shared/data/modelTypeRules';
import './EditModelForm.solid.css';

export interface EditModelFormProviderOption {
  id: string;
  name: string;
}

export interface EditModelFormProps {
  name: string;
  modelId: string;
  provider: string;
  avatar: string;
  modelTypes: string[];
  autoDetect: boolean;
  nameError?: string;
  providerOptions: EditModelFormProviderOption[];
  themeMode: 'light' | 'dark';
  onNameChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onToggleType: (type: string) => void;
  onAutoDetectChange: (autoDetect: boolean) => void;
  onOpenAvatar: () => void;
  onOpenTypeManagement: () => void;
}

// 模型类型分组（与 EnhancedModelTypeSelector 保持一致）
const MODEL_TYPE_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: 'basic', label: '基础功能', types: ['chat'] },
  { key: 'input', label: '输入能力', types: ['vision', 'audio'] },
  { key: 'output', label: '输出能力', types: ['image_gen', 'video_gen', 'transcription', 'translation'] },
  { key: 'advanced', label: '高级功能', types: ['reasoning', 'function_calling', 'web_search', 'tool', 'code_gen'] },
  { key: 'data', label: '数据处理', types: ['embedding', 'rerank'] },
];

function PhotoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}

export function EditModelForm(props: EditModelFormProps) {
  const [local, handlers] = splitProps(props, [
    'name', 'modelId', 'provider', 'avatar', 'modelTypes',
    'autoDetect', 'nameError', 'providerOptions', 'themeMode',
  ]);

  const isTypeSelected = (type: string) => local.modelTypes.includes(type);
  const avatarFallback = () => (local.name ? local.name.charAt(0).toUpperCase() : 'M');

  return (
    <div class="emdl-form">
      {/* 头像设置区域 */}
      <div class="emdl-avatar-card">
        <div class="emdl-avatar-left">
          <div class="emdl-avatar">
            <Show when={local.avatar} fallback={<span class="emdl-avatar-fallback">{avatarFallback()}</span>}>
              <img src={local.avatar} alt="model avatar" />
            </Show>
          </div>
          <div class="emdl-avatar-text">
            <div class="emdl-avatar-title">模型头像</div>
            <div class="emdl-avatar-desc">为此模型设置自定义头像</div>
          </div>
        </div>
        <button type="button" class="emdl-icon-btn emdl-icon-btn-primary" title="设置头像" onClick={() => handlers.onOpenAvatar()}>
          <PhotoIcon />
        </button>
      </div>

      {/* 模型名称 */}
      <div class="emdl-field">
        <label class="emdl-label">
          模型名称 <span class="emdl-required">*</span>
        </label>
        <input
          type="text"
          class="emdl-input"
          classList={{ 'emdl-input-error': !!local.nameError }}
          value={local.name}
          onInput={(e) => handlers.onNameChange(e.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
        />
        <Show when={local.nameError}>
          <div class="emdl-helper emdl-helper-error">{local.nameError}</div>
        </Show>
      </div>

      {/* 提供商 */}
      <div class="emdl-field">
        <label class="emdl-label">提供商</label>
        <div class="emdl-select-wrapper">
          <select
            class="emdl-select"
            value={local.provider}
            onChange={(e) => handlers.onProviderChange(e.currentTarget.value)}
          >
            <For each={local.providerOptions}>
              {(opt) => <option value={opt.id}>{opt.name}</option>}
            </For>
            <option value="custom">自定义</option>
          </select>
          <svg class="emdl-select-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="emdl-helper">选择API提供商，可以与模型ID自由组合</div>
      </div>

      {/* 模型ID */}
      <div class="emdl-field">
        <label class="emdl-label">模型ID</label>
        <input
          type="text"
          class="emdl-input"
          value={local.modelId}
          onInput={(e) => handlers.onModelIdChange(e.currentTarget.value)}
          autocomplete="off"
          spellcheck={false}
        />
        <div class="emdl-helper">模型的唯一标识符，例如：gpt-4、claude-3-opus</div>
      </div>

      {/* 模型类型 */}
      <div class="emdl-field">
        <div class="emdl-type-header">
          <div class="emdl-type-header-left">
            <span class="emdl-label emdl-label-inline">模型类型</span>
            <span class="emdl-info-hint" title="模型类型决定了模型的能力和适用场景。您可以根据需要选择多种类型。">
              <InfoIcon />
            </span>
          </div>
          <div class="emdl-type-header-right">
            <label class="emdl-switch-label">
              <span class="emdl-switch">
                <input
                  type="checkbox"
                  checked={local.autoDetect}
                  onChange={(e) => handlers.onAutoDetectChange(e.currentTarget.checked)}
                />
                <span class="emdl-switch-slider"></span>
              </span>
              <span>自动检测</span>
            </label>
            <button type="button" class="emdl-icon-btn" title="管理模型类型规则" onClick={() => handlers.onOpenTypeManagement()}>
              <SettingsIcon />
            </button>
          </div>
        </div>

        <div class="emdl-type-panel">
          <For each={MODEL_TYPE_GROUPS}>
            {(group) => (
              <div class="emdl-type-group">
                <div class="emdl-type-group-title">{group.label}</div>
                <div class="emdl-type-chips">
                  <For each={group.types}>
                    {(type) => (
                      <button
                        type="button"
                        class="emdl-chip"
                        classList={{
                          'emdl-chip-active': isTypeSelected(type),
                          'emdl-chip-disabled': local.autoDetect,
                        }}
                        disabled={local.autoDetect}
                        onClick={() => !local.autoDetect && handlers.onToggleType(type)}
                      >
                        {getModelTypeDisplayName(type as typeof ModelType[keyof typeof ModelType])}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>

        <div class="emdl-helper">
          {local.autoDetect ? '根据模型ID和提供商自动检测模型类型' : '点击类型标签来添加或移除'}
        </div>
      </div>
    </div>
  );
}
