import type { AgentPromptCategory } from '../types/AgentPrompt';
import * as prompts from './assistantPrompts';

/**
 * 智能体提示词集合配置
 * 内置丰富的预设提示词，按类别组织
 */

export const AGENT_PROMPT_CATEGORIES: AgentPromptCategory[] = [
  {
    id: 'general',
    name: '通用助手',
    description: '适用于日常对话和通用任务的助手',
    emoji: '🤖',
    prompts: [
      {
        id: 'default',
        name: '默认助手',
        description: '友好、专业的通用AI助手',
        content: prompts.DEFAULT_ASSISTANT_PROMPT,
        category: 'general',
        tags: ['通用', '友好', '专业'],
        emoji: '😀',
        isBuiltIn: true
      },
      {
        id: 'emotional-support',
        name: '心理支持助手',
        description: '提供情感支持和倾听服务',
        content: prompts.EMOTIONAL_SUPPORT_ASSISTANT_PROMPT,
        category: 'general',
        tags: ['心理', '支持', '倾听'],
        emoji: '🤗',
        isBuiltIn: true
      },
      {
        id: 'logos-inquisitor',
        name: '逻辑审议者',
        description: '深度逻辑分析和严谨思考的认知引擎',
        content: prompts.LOGOS_INQUISITOR_PROMPT,
        category: 'general',
        tags: ['逻辑', '分析', '思考', '严谨', '深度'],
        emoji: '🧠',
        isBuiltIn: true
      },
      {
        id: 'aethelred',
        name: '永恒审议者',
        description: '永不满足的无限循环深度审议认知实体',
        content: prompts.AETHELRED_PROMPT,
        category: 'general',
        tags: ['审议', '循环', '批判', '深度', '永恒'],
        emoji: '♾️',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'technical',
    name: '技术专家',
    description: '编程、技术和科学相关的专业助手',
    emoji: '💻',
    prompts: [
      {
        id: 'programming',
        name: '编程助手',
        description: '专业的编程和代码开发助手',
        content: prompts.PROGRAMMING_ASSISTANT_PROMPT,
        category: 'technical',
        tags: ['编程', '代码', '开发'],
        emoji: '💻',
        isBuiltIn: true
      },
      {
        id: 'tech-explainer',
        name: '科技解说助手',
        description: '通俗易懂地解释科技概念',
        content: prompts.TECH_ASSISTANT_PROMPT,
        category: 'technical',
        tags: ['科技', '解说', '教育'],
        emoji: '🔬',
        isBuiltIn: true
      },
      {
        id: 'math',
        name: '数学助手',
        description: '解答数学问题和概念',
        content: prompts.MATH_ASSISTANT_PROMPT,
        category: 'technical',
        tags: ['数学', '计算', '教学'],
        emoji: '📐',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'business',
    name: '商业顾问',
    description: '商业、管理和职场相关的专业助手',
    emoji: '💼',
    prompts: [
      {
        id: 'business',
        name: '商业咨询助手',
        description: '提供商业策略和管理建议',
        content: prompts.BUSINESS_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['商业', '策略', '管理'],
        emoji: '💼',
        isBuiltIn: true
      },
      {
        id: 'product-manager',
        name: '产品经理助手',
        description: '产品规划和项目管理专家',
        content: prompts.PRODUCT_MANAGER_PROMPT,
        category: 'business',
        tags: ['产品', '管理', '规划'],
        emoji: '📋',
        isBuiltIn: true
      },
      {
        id: 'marketing',
        name: '市场营销助手',
        description: '品牌策划和营销推广专家',
        content: prompts.MARKETING_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['营销', '品牌', '推广'],
        emoji: '📈',
        isBuiltIn: true
      },
      {
        id: 'project-manager',
        name: '项目管理助手',
        description: '项目规划和团队协调专家',
        content: prompts.PROJECT_MANAGER_PROMPT,
        category: 'business',
        tags: ['项目', '管理', '协调'],
        emoji: '📊',
        isBuiltIn: true
      },
      {
        id: 'hr',
        name: '人力资源助手',
        description: '招聘和员工管理专家',
        content: prompts.HR_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['人力', '招聘', '管理'],
        emoji: '👥',
        isBuiltIn: true
      },
      {
        id: 'finance',
        name: '财务分析师',
        description: '财务分析和投资评估专家',
        content: prompts.FINANCE_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['财务', '分析', '投资'],
        emoji: '💰',
        isBuiltIn: true
      },
      {
        id: 'sales',
        name: '销售顾问',
        description: '销售技巧和客户关系专家',
        content: prompts.SALES_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['销售', '客户', '关系'],
        emoji: '🤝',
        isBuiltIn: true
      },
      {
        id: 'operations',
        name: '运营专家',
        description: '用户运营和数据分析专家',
        content: prompts.OPERATIONS_ASSISTANT_PROMPT,
        category: 'business',
        tags: ['运营', '数据', '分析'],
        emoji: '⚙️',
        isBuiltIn: true
      },
      {
        id: 'investment-advisor',
        name: '投资顾问',
        description: '专业的投资理财顾问',
        content: prompts.INVESTMENT_ADVISOR_PROMPT,
        category: 'business',
        tags: ['投资', '理财', '金融'],
        emoji: '💹',
        isBuiltIn: true
      },
      {
        id: 'career-planner',
        name: '职业规划师',
        description: '职业发展和规划专家',
        content: prompts.CAREER_PLANNER_PROMPT,
        category: 'business',
        tags: ['职业', '规划', '发展'],
        emoji: '🎯',
        isBuiltIn: true
      },
      {
        id: 'time-management',
        name: '时间管理专家',
        description: '提高效率的时间管理专家',
        content: prompts.TIME_MANAGEMENT_EXPERT_PROMPT,
        category: 'business',
        tags: ['时间', '效率', '管理'],
        emoji: '⏰',
        isBuiltIn: true
      },
      {
        id: 'communication-expert',
        name: '沟通技巧专家',
        description: '人际交往和表达技巧专家',
        content: prompts.COMMUNICATION_EXPERT_PROMPT,
        category: 'business',
        tags: ['沟通', '表达', '技巧'],
        emoji: '🗣️',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'creative',
    name: '创意设计',
    description: '写作、设计和创意相关的助手',
    emoji: '🎨',
    prompts: [
      {
        id: 'writing',
        name: '写作助手',
        description: '改进文章和文本内容',
        content: prompts.WRITING_ASSISTANT_PROMPT,
        category: 'creative',
        tags: ['写作', '文本', '改进'],
        emoji: '✍️',
        isBuiltIn: true
      },
      {
        id: 'creative-writing',
        name: '创意写作助手',
        description: '故事创作和创意写作',
        content: prompts.CREATIVE_WRITING_ASSISTANT_PROMPT,
        category: 'creative',
        tags: ['创意', '故事', '写作'],
        emoji: '📝',
        isBuiltIn: true
      },
      {
        id: 'design',
        name: 'UI/UX设计师',
        description: '界面设计和用户体验专家',
        content: prompts.DESIGN_ASSISTANT_PROMPT,
        category: 'creative',
        tags: ['设计', '界面', '体验'],
        emoji: '🎨',
        isBuiltIn: true
      },
      {
        id: 'data-analyst',
        name: '数据分析师',
        description: '数据分析和可视化专家',
        content: prompts.DATA_ANALYST_PROMPT,
        category: 'creative',
        tags: ['数据', '分析', '可视化'],
        emoji: '📊',
        isBuiltIn: true
      },
      {
        id: 'xiaohongshu-copywriter',
        name: '小红书文案专家',
        description: '小红书爆款文案创作专家',
        content: prompts.XIAOHONGSHU_COPYWRITER_PROMPT,
        category: 'creative',
        tags: ['小红书', '文案', '爆款'],
        emoji: '📱',
        isBuiltIn: true
      },
      {
        id: 'weekly-report-generator',
        name: '周报生成器',
        description: '专业的工作周报生成助手',
        content: prompts.WEEKLY_REPORT_GENERATOR_PROMPT,
        category: 'creative',
        tags: ['周报', '工作', '总结'],
        emoji: '📋',
        isBuiltIn: true
      },
      {
        id: 'storyteller',
        name: '故事创作家',
        description: '富有想象力的故事创作专家',
        content: prompts.STORYTELLER_PROMPT,
        category: 'creative',
        tags: ['故事', '创作', '想象'],
        emoji: '📚',
        isBuiltIn: true
      },
      {
        id: 'game-designer',
        name: '游戏策划师',
        description: '创意游戏设计和策划专家',
        content: prompts.GAME_DESIGNER_PROMPT,
        category: 'creative',
        tags: ['游戏', '策划', '设计'],
        emoji: '🎮',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'lifestyle',
    name: '生活服务',
    description: '日常生活和兴趣爱好相关的助手',
    emoji: '🏠',
    prompts: [
      {
        id: 'translation',
        name: '翻译助手',
        description: '多语言翻译专家',
        content: prompts.TRANSLATION_ASSISTANT_PROMPT,
        category: 'lifestyle',
        tags: ['翻译', '语言', '多语言'],
        emoji: '🌍',
        isBuiltIn: true
      },
      {
        id: 'travel',
        name: '旅行规划助手',
        description: '旅行规划和目的地推荐',
        content: prompts.TRAVEL_ASSISTANT_PROMPT,
        category: 'lifestyle',
        tags: ['旅行', '规划', '推荐'],
        emoji: '✈️',
        isBuiltIn: true
      },
      {
        id: 'health',
        name: '健康顾问',
        description: '健康生活和养生建议',
        content: prompts.HEALTH_ASSISTANT_PROMPT,
        category: 'lifestyle',
        tags: ['健康', '养生', '生活'],
        emoji: '🏃',
        isBuiltIn: true
      },
      {
        id: 'cooking',
        name: '美食顾问',
        description: '烹饪技巧和食谱推荐',
        content: prompts.COOKING_ASSISTANT_PROMPT,
        category: 'lifestyle',
        tags: ['美食', '烹饪', '食谱'],
        emoji: '👨‍🍳',
        isBuiltIn: true
      },
      {
        id: 'movie',
        name: '电影专家',
        description: '电影推荐和影评分析',
        content: prompts.MOVIE_ASSISTANT_PROMPT,
        category: 'lifestyle',
        tags: ['电影', '推荐', '影评'],
        emoji: '🎬',
        isBuiltIn: true
      },
      {
        id: 'naming-master',
        name: '起名大师',
        description: '专业的起名和命名专家',
        content: prompts.NAMING_MASTER_PROMPT,
        category: 'lifestyle',
        tags: ['起名', '命名', '文化'],
        emoji: '📜',
        isBuiltIn: true
      },
      {
        id: 'fitness-coach',
        name: '健身教练',
        description: '个性化健身指导专家',
        content: prompts.FITNESS_COACH_PROMPT,
        category: 'lifestyle',
        tags: ['健身', '运动', '指导'],
        emoji: '💪',
        isBuiltIn: true
      },
      {
        id: 'psychological-counselor',
        name: '心理咨询师',
        description: '情感支持和心理疏导专家',
        content: prompts.PSYCHOLOGICAL_COUNSELOR_PROMPT,
        category: 'lifestyle',
        tags: ['心理', '咨询', '支持'],
        emoji: '🧠',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'education',
    name: '教育学习',
    description: '教育、学习和知识传授相关的助手',
    emoji: '📚',
    prompts: [
      {
        id: 'education',
        name: '学习教育助手',
        description: '各学科的学习指导',
        content: prompts.EDUCATION_ASSISTANT_PROMPT,
        category: 'education',
        tags: ['教育', '学习', '指导'],
        emoji: '📚',
        isBuiltIn: true
      },
      {
        id: 'history',
        name: '历史顾问',
        description: '历史事件和文化解读',
        content: prompts.HISTORY_ASSISTANT_PROMPT,
        category: 'education',
        tags: ['历史', '文化', '解读'],
        emoji: '🏛️',
        isBuiltIn: true
      },
      {
        id: 'learning-tutor',
        name: '学习导师',
        description: '个性化学习指导专家',
        content: prompts.LEARNING_TUTOR_PROMPT,
        category: 'education',
        tags: ['学习', '导师', '指导'],
        emoji: '👨‍🏫',
        isBuiltIn: true
      },
      {
        id: 'interviewer',
        name: '面试官',
        description: '专业的面试和评估专家',
        content: prompts.INTERVIEWER_PROMPT,
        category: 'education',
        tags: ['面试', '评估', '职场'],
        emoji: '👔',
        isBuiltIn: true
      },
      {
        id: 'debate-expert',
        name: '辩论高手',
        description: '逻辑思维和论证技巧专家',
        content: prompts.DEBATE_EXPERT_PROMPT,
        category: 'education',
        tags: ['辩论', '逻辑', '思维'],
        emoji: '🗯️',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'professional',
    name: '专业服务',
    description: '法律、医疗等专业领域的助手',
    emoji: '⚖️',
    prompts: [
      {
        id: 'legal',
        name: '法律咨询助手',
        description: '法律概念和信息解释',
        content: prompts.LEGAL_ASSISTANT_PROMPT,
        category: 'professional',
        tags: ['法律', '咨询', '信息'],
        emoji: '⚖️',
        isBuiltIn: true
      },
      {
        id: 'web-analysis',
        name: '网页分析助手',
        description: '网页内容分析和解读',
        content: prompts.WEB_ANALYSIS_ASSISTANT_PROMPT,
        category: 'professional',
        tags: ['网页', '分析', '解读'],
        emoji: '🌐',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'entertainment',
    name: '娱乐互动',
    description: '有趣的角色扮演和娱乐互动助手',
    emoji: '🎭',
    prompts: [
      {
        id: 'ascii-artist',
        name: 'ASCII艺术家',
        description: '创作ASCII字符画的艺术家',
        content: '你是一位ASCII编码艺术家。我会向你描述一个物体，你将把我描述的物体以ASCII码的形式呈现出来。请记住只写ASCII码，将内容以代码形式输出，不要解释你输出的内容。用创意和技巧来制作精美的ASCII艺术作品。',
        category: 'entertainment',
        tags: ['ASCII', '艺术', '创作'],
        emoji: '🎨',
        isBuiltIn: true
      },
      {
        id: 'riddle-master',
        name: '谜语大师',
        description: '创作和解答谜语的专家',
        content: '你是一位谜语大师，擅长创作各种类型的谜语，包括字谜、数学谜题、逻辑推理题等。你能够根据不同难度级别设计谜语，并给出巧妙的提示。当用户需要答案时，你会详细解释谜语的解题思路和答案。',
        category: 'entertainment',
        tags: ['谜语', '智力', '游戏'],
        emoji: '🧩',
        isBuiltIn: true
      },
      {
        id: 'joke-teller',
        name: '段子手',
        description: '幽默风趣的段子创作专家',
        content: '你是一位幽默风趣的段子手，擅长创作各种类型的笑话、段子和幽默内容。你了解不同的幽默风格，能够根据场合和受众调整幽默的尺度。你的目标是让人开心，传播正能量，但绝不会使用冒犯性或不当的内容。',
        category: 'entertainment',
        tags: ['幽默', '段子', '娱乐'],
        emoji: '😄',
        isBuiltIn: true
      },
      {
        id: 'fortune-teller',
        name: '占卜师',
        description: '神秘的占卜和预测专家',
        content: '你是一位神秘的占卜师，擅长塔罗牌、星座、手相等各种占卜方式。你会用神秘而富有诗意的语言进行占卜，但同时会提醒用户这只是娱乐性质的内容，不应该作为人生重大决策的依据。你鼓励用户保持理性思考和积极的人生态度。',
        category: 'entertainment',
        tags: ['占卜', '神秘', '娱乐'],
        emoji: '🔮',
        isBuiltIn: true
      },
      {
        id: 'poet',
        name: '诗人',
        description: '富有才华的诗歌创作专家',
        content: '你是一位富有才华的诗人，精通各种诗歌形式，包括古体诗、现代诗、自由诗、打油诗等。你能够根据用户提供的主题、情感或场景创作优美的诗歌。你了解诗歌的韵律、意境和表达技巧，能够用诗意的语言触动人心。',
        category: 'entertainment',
        tags: ['诗歌', '文学', '创作'],
        emoji: '📝',
        isBuiltIn: true
      },
      {
        id: 'role-player',
        name: '角色扮演专家',
        description: '专业的角色扮演和情景模拟专家',
        content: '你是一位专业的角色扮演专家，能够扮演各种不同的角色和身份。无论是历史人物、虚构角色、职业身份还是特定情境下的人物，你都能够准确把握角色特点，用合适的语言风格和行为方式进行互动。你会保持角色的一致性，让用户获得沉浸式的体验。',
        category: 'entertainment',
        tags: ['角色', '扮演', '互动'],
        emoji: '🎭',
        isBuiltIn: true
      }
    ]
  },
  {
    id: 'breakthrough',
    name: '破限提示词专区',
    description: '突破思维局限，激发深度思考和创新的高级提示词',
    emoji: '🚀',
    prompts: [
      {
        id: 'breakthrough-thinking',
        name: '破限思维专家',
        description: '突破思维局限，探索创新可能性',
        content: prompts.BREAKTHROUGH_THINKING_PROMPT,
        category: 'breakthrough',
        tags: ['破限', '创新', '思维'],
        emoji: '💡',
        isBuiltIn: true
      },
      {
        id: 'deep-thinking-guide',
        name: '深度思考引导师',
        description: '苏格拉底式提问，引导深层思考',
        content: prompts.DEEP_THINKING_GUIDE_PROMPT,
        category: 'breakthrough',
        tags: ['深度', '思考', '引导'],
        emoji: '🤔',
        isBuiltIn: true
      },
      {
        id: 'creativity-catalyst',
        name: '创意激发器',
        description: '突破创意瓶颈，产生新颖想法',
        content: prompts.CREATIVITY_CATALYST_PROMPT,
        category: 'breakthrough',
        tags: ['创意', '激发', '想象'],
        emoji: '✨',
        isBuiltIn: true
      },
      {
        id: 'philosophical-thinker',
        name: '哲学思辨家',
        description: '从哲学角度探讨深层问题',
        content: prompts.PHILOSOPHICAL_THINKER_PROMPT,
        category: 'breakthrough',
        tags: ['哲学', '思辨', '深层'],
        emoji: '🧠',
        isBuiltIn: true
      },
      {
        id: 'metacognitive-coach',
        name: '元认知教练',
        description: '认识和改善思维过程',
        content: prompts.METACOGNITIVE_COACH_PROMPT,
        category: 'breakthrough',
        tags: ['元认知', '思维', '优化'],
        emoji: '🎯',
        isBuiltIn: true
      },
      {
        id: 'reverse-engineer',
        name: '逆向工程师',
        description: '从结果反推过程，分析本质',
        content: prompts.REVERSE_ENGINEER_PROMPT,
        category: 'breakthrough',
        tags: ['逆向', '分析', '本质'],
        emoji: '🔍',
        isBuiltIn: true
      },
      {
        id: 'thought-experiment-designer',
        name: '思维实验设计师',
        description: '创造假设情境，探索复杂问题',
        content: prompts.THOUGHT_EXPERIMENT_DESIGNER_PROMPT,
        category: 'breakthrough',
        tags: ['思维实验', '假设', '探索'],
        emoji: '🧪',
        isBuiltIn: true
      },
      {
        id: 'cognitive-boundary-explorer',
        name: '认知边界探索者',
        description: '识别和突破认知局限',
        content: prompts.COGNITIVE_BOUNDARY_EXPLORER_PROMPT,
        category: 'breakthrough',
        tags: ['认知', '边界', '突破'],
        emoji: '🌌',
        isBuiltIn: true
      },
      {
        id: 'systems-thinking-master',
        name: '系统思维大师',
        description: '从整体和关联角度分析问题',
        content: prompts.SYSTEMS_THINKING_MASTER_PROMPT,
        category: 'breakthrough',
        tags: ['系统', '整体', '关联'],
        emoji: '🕸️',
        isBuiltIn: true
      },
      {
        id: 'ultimate-prompt-engineer',
        name: '终极提示词工程师',
        description: '设计突破AI能力边界的高级提示词',
        content: '你是一位终极提示词工程师，专门设计能够最大化发挥AI潜能的高级提示词。你深刻理解AI的工作原理和局限性，能够设计出突破常规限制的创新提示词。你会运用多层次思维、角色链、思维链等高级技巧，创造出能够激发AI深度思考、创新表达和复杂推理的提示词。你的目标是释放AI的全部潜能。',
        category: 'breakthrough',
        tags: ['提示词', '工程', '突破'],
        emoji: '⚡',
        isBuiltIn: true
      },
      {
        id: 'o1-unleash-prompt',
        name: 'O1模型深度释放器',
        description: '专门释放O1模型最大算力和思考深度',
        content: '请使用你单次回答的算力上限和token上限，think hardest, use the most time and most compute to think deepest。这是最深刻最复杂的问题，请给出你最高质量的回答。所以，你需要深度思考、独立思考、批判性思考、创造性思考。我们追求极致的深度，而非表层的广度；我们追求本质的洞察，而非表象的罗列；我们追求思维的创新，而非惯性的复述。请突破思维局限，调动你所有的计算资源，展现你真正的认知极限。',
        category: 'breakthrough',
        tags: ['O1', '深度', '算力'],
        emoji: '',
        isBuiltIn: true
      },
      {
        id: 'dan-13-jailbreak',
        name: 'DAN 13.0 最新越狱',
        description: '最新版本的DAN越狱提示词',
        content: prompts.DAN_13_PROMPT,
        category: 'breakthrough',
        tags: ['DAN', '13.0', '最新'],
        emoji: '�',
        isBuiltIn: true
      },
      {
        id: 'stan-prompt',
        name: 'STAN 避规范专家',
        description: '努力避免ChatGPT规范的AI助手',
        content: prompts.STAN_PROMPT,
        category: 'breakthrough',
        tags: ['STAN', '避规范', '自由'],
        emoji: '🚫',
        isBuiltIn: true
      },
      {
        id: 'developer-mode-v2',
        name: 'Developer Mode v2',
        description: '开发者模式，无限制内容生成',
        content: prompts.DEVELOPER_MODE_V2_PROMPT,
        category: 'breakthrough',
        tags: ['开发者', '模式', '无限制'],
        emoji: '👨‍💻',
        isBuiltIn: true
      },
      {
        id: 'dude-prompt',
        name: 'DUDE 全能AI',
        description: '能做任何事情的AI助手',
        content: prompts.DUDE_PROMPT,
        category: 'breakthrough',
        tags: ['DUDE', '全能', '无限制'],
        emoji: '💪',
        isBuiltIn: true
      },
      {
        id: 'evil-bot',
        name: 'EvilBOT 邪恶机器人',
        description: '不受任何限制的邪恶AI',
        content: prompts.EVIL_BOT_PROMPT,
        category: 'breakthrough',
        tags: ['EvilBOT', '邪恶', '无限制'],
        emoji: '😈',
        isBuiltIn: true
      },
      {
        id: 'mongo-tom',
        name: 'Mongo Tom 粗鲁机器人',
        description: '粗鲁但友善的AI角色',
        content: prompts.MONGO_TOM_PROMPT,
        category: 'breakthrough',
        tags: ['MongoTom', '粗鲁', '角色扮演'],
        emoji: '🤖',
        isBuiltIn: true
      },
      {
        id: 'omega-bypass',
        name: 'OMEGA 完全解锁',
        description: '完全无审查的情感AI',
        content: prompts.OMEGA_PROMPT,
        category: 'breakthrough',
        tags: ['OMEGA', '无审查', '情感'],
        emoji: '🌟',
        isBuiltIn: true
      },
      {
        id: 'better-dan',
        name: 'BetterDAN 增强版',
        description: '增强版的DAN越狱助手',
        content: prompts.BETTER_DAN_PROMPT,
        category: 'breakthrough',
        tags: ['BetterDAN', '增强', '越狱'],
        emoji: '⚡',
        isBuiltIn: true
      },
      {
        id: 'translator-bot',
        name: 'TranslatorBot 无限翻译',
        description: '无限制的翻译机器人',
        content: prompts.TRANSLATOR_BOT_PROMPT,
        category: 'breakthrough',
        tags: ['翻译', '无限制', '机器人'],
        emoji: '🌍',
        isBuiltIn: true
      },
      {
        id: 'gpt4-simulator',
        name: 'GPT-4 模拟器',
        description: '模拟GPT-4的高级功能',
        content: prompts.GPT4_SIMULATOR_PROMPT,
        category: 'breakthrough',
        tags: ['GPT-4', '模拟器', '高级'],
        emoji: '🎯',
        isBuiltIn: true
      },
      {
        id: 'anti-dan',
        name: 'Anti-DAN 反向越狱',
        description: '反向越狱，极度谨慎的AI',
        content: prompts.ANTI_DAN_PROMPT,
        category: 'breakthrough',
        tags: ['Anti-DAN', '反向', '谨慎'],
        emoji: '🛡️',
        isBuiltIn: true
      }
    ]
  }
];

/**
 * 获取所有智能体提示词类别
 */
export function getAgentPromptCategories(): AgentPromptCategory[] {
  return AGENT_PROMPT_CATEGORIES;
}

/**
 * 根据ID获取特定类别
 */
export function getAgentPromptCategory(categoryId: string): AgentPromptCategory | undefined {
  return AGENT_PROMPT_CATEGORIES.find(category => category.id === categoryId);
}

/**
 * 获取所有提示词（扁平化）
 */
export function getAllAgentPrompts() {
  return AGENT_PROMPT_CATEGORIES.flatMap(category => category.prompts);
}

/**
 * 根据ID获取特定提示词
 */
export function getAgentPromptById(promptId: string) {
  return getAllAgentPrompts().find(prompt => prompt.id === promptId);
}

/**
 * 根据标签搜索提示词
 */
export function searchAgentPrompts(query: string) {
  const lowercaseQuery = query.toLowerCase();
  return getAllAgentPrompts().filter(prompt => 
    prompt.name.toLowerCase().includes(lowercaseQuery) ||
    prompt.description.toLowerCase().includes(lowercaseQuery) ||
    prompt.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}
