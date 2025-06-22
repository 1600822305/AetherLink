// 模型组合相关类型定义

// 模型组合策略类型
export type ModelComboStrategy =
  | 'routing'      // 智能路由：根据查询类型选择最适合的模型
  | 'ensemble'     // 集成：多个模型协同工作
  | 'comparison'   // 对比：同时使用多个模型并展示结果
  | 'cascade'      // 级联：先用便宜模型，必要时升级到昂贵模型
  | 'sequential';  // 顺序：按顺序使用模型（如思考+生成）

// 路由条件类型
export interface RoutingCondition {
  id: string;
  name: string;
  description?: string;
  // 条件类型
  type: 'keyword' | 'length' | 'complexity' | 'language' | 'domain' | 'custom';
  // 条件值
  value: string | number | string[];
  // 操作符
  operator: 'contains' | 'equals' | 'greater' | 'less' | 'in' | 'regex';
}

// 模型组合配置
export interface ModelComboConfig {
  id: string;
  name: string;
  description?: string;
  strategy: ModelComboStrategy;
  enabled: boolean;

  // 参与组合的模型
  models: {
    id: string;
    modelId: string;
    role: 'primary' | 'secondary' | 'fallback' | 'thinking' | 'generating';
    weight?: number; // 用于集成策略
    priority?: number; // 用于级联策略
  }[];

  // 路由规则（仅用于routing策略）
  routingRules?: {
    id: string;
    conditions: RoutingCondition[];
    targetModelId: string;
    priority: number;
  }[];

  // 集成配置（仅用于ensemble策略）
  ensembleConfig?: {
    votingMethod: 'majority' | 'weighted' | 'confidence';
    confidenceThreshold?: number;
    maxModels?: number;
  };

  // 级联配置（仅用于cascade策略）
  cascadeConfig?: {
    triggerConditions: RoutingCondition[];
    costThreshold?: number;
    qualityThreshold?: number;
  };

  // 顺序配置（仅用于sequential策略）
  sequentialConfig?: {
    steps: {
      modelId: string;
      role: 'thinking' | 'generating' | 'refining';
      prompt?: string;
      maxTokens?: number;
    }[];
  };

  // 显示配置
  displayConfig?: {
    showThinking?: boolean;
    showComparison?: boolean;
    layout: 'horizontal' | 'vertical' | 'grid' | 'tabs';
  };

  // 创建和更新时间
  createdAt: string;
  updatedAt: string;
}

// 预设模型组合模板
export interface ModelComboTemplate {
  id: string;
  name: string;
  description: string;
  strategy: ModelComboStrategy;
  icon?: string;
  category: 'coding' | 'writing' | 'analysis' | 'creative' | 'general';

  // 模板配置
  template: Omit<ModelComboConfig, 'id' | 'name' | 'createdAt' | 'updatedAt'>;

  // 推荐的模型类型
  recommendedModels: {
    role: string;
    modelTypes: string[];
    description: string;
  }[];
}

// 模型组合执行结果
export interface ModelComboResult {
  comboId: string;
  strategy: ModelComboStrategy;

  // 各个模型的结果
  modelResults: {
    modelId: string;
    role: string;
    content: string;
    reasoning?: string;
    confidence?: number;
    cost?: number;
    latency?: number;
    status: 'success' | 'error' | 'timeout';
    error?: string;
  }[];

  // 最终结果
  finalResult?: {
    content: string;
    reasoning?: string; // 添加推理内容字段
    confidence?: number;
    explanation?: string;
  };

  // 执行统计
  stats: {
    totalCost: number;
    totalLatency: number;
    modelsUsed: number;
    strategy: string;
  };

  timestamp: string;

  // 对比策略特有数据
  comparisonData?: {
    allResults: ModelComboResult['modelResults'];
    selectedResult?: {
      modelId: string;
      content: string;
      reasoning?: string;
    } | null;
    userSelection?: boolean; // 用户是否已经做出选择
  };
}

// 模型组合状态
export interface ModelComboState {
  // 所有组合配置
  combos: ModelComboConfig[];

  // 当前活跃的组合
  activeCombos: string[];

  // 预设模板
  templates: ModelComboTemplate[];

  // 执行历史
  executionHistory: ModelComboResult[];

  // 设置
  settings: {
    enableAutoRouting: boolean;
    defaultStrategy: ModelComboStrategy;
    maxConcurrentModels: number;
    costLimit?: number;
  };
}

// 模型组合创建/编辑表单数据
export interface ModelComboFormData {
  name: string;
  description: string;
  strategy: ModelComboStrategy;
  enabled: boolean;
  models: {
    modelId: string;
    role: string;
    weight?: number;
    priority?: number;
  }[];
  routingRules?: any[];
  ensembleConfig?: any;
  cascadeConfig?: any;
  sequentialConfig?: any;
  displayConfig?: any;
}
