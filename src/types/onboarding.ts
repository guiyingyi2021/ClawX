/**
 * Agent Onboarding Types
 * 定义对话式引导的类型系统
 */

/** 引导问题类型 */
export type QuestionType =
  | 'greeting'    // 开场白/打招呼
  | 'text'        // 自由文本输入
  | 'single'      // 单选
  | 'multiple'    // 多选
  | 'tone';       // 语气风格选择

/** 问题文本 - 支持静态字符串或动态函数 */
export type QuestionText = string | ((agentName?: string) => string);

/** 问题选项（用于单选/多选） */
export interface QuestionOption {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

/** 单个引导问题 */
export interface OnboardingQuestion {
  id: string;
  type: QuestionType;
  question: QuestionText;                    // 问题文本（支持动态函数）
  placeholder?: string;                     // 输入框占位符
  options?: QuestionOption[];               // 选项（单选/多选时）
  required: boolean;                         // 是否必填
  skipIf?: (answers: OnboardingAnswers) => boolean;  // 条件跳过
  validation?: (answer: string | string[]) => boolean; // 自定义验证
  key: keyof GeneratedConfig;               // 对应生成的配置键
}

/** 用户回答 */
export interface OnboardingAnswer {
  questionId: string;
  value: string | string[];
  timestamp: number;
}

/** 所有回答 */
export type OnboardingAnswers = Record<string, OnboardingAnswer>;

/** 生成的配置结构 */
export interface GeneratedConfig {
  agentName: string;           // IDENTITY: 名字
  agentRole: string;           // IDENTITY: 角色
  agentVibe: string;           // IDENTITY: 性格描述
  agentEmoji: string;          // IDENTITY: emoji
  relationshipVibe: string;    // IDENTITY: 关系风格

  // SOUL
  personalityTraits: string[]; // 性格特点
  expressionStyle: string;     // 表达风格
  workStyle: string;           // 做事风格
  boundaries: string[];        // 边界约束

  // USER
  userName: string;           // 用户称呼
  userRole: string;            // 用户职业/角色
  userPreferences: string[];    // 偏好
  userTaboos: string[];        // 禁忌
  userDomain: string[];        // 专业领域
  recommendedSkills: string[]; // 根据职业推荐的技能
  profession: string;          // 用户职业标识
}

/** 配置文件内容 */
export interface ConfigFiles {
  'SOUL.md': string;
  'IDENTITY.md': string;
  'USER.md': string;
  'AGENTS.md'?: string;
}

/** 引导状态 */
export type OnboardingStatus =
  | 'idle'           // 未开始
  | 'in_progress'   // 进行中
  | 'generating'     // 生成配置中
  | 'completed'      // 完成
  | 'skipped';       // 跳过

/** 引导上下文 */
export interface OnboardingContext {
  status: OnboardingStatus;
  currentQuestionIndex: number;
  answers: OnboardingAnswers;
  generatedConfig: GeneratedConfig | null;
  configFiles: ConfigFiles | null;
  error: string | null;
}

/** 引导配置 */
export interface OnboardingConfig {
  agentId: string;
  workspacePath: string;
  questions: OnboardingQuestion[];
}
