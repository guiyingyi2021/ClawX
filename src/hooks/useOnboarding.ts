/**
 * Onboarding Store
 * 使用 Zustand 管理引导状态
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OnboardingStatus,
  OnboardingAnswers,
  OnboardingQuestion,
  GeneratedConfig,
  ConfigFiles,
} from '@/types/onboarding';
import { generateAll } from '@/utils/configGenerator';
import { extractName, extractUserName } from '@/utils/extractFromConversation';

/** 引导问题列表 - 自然对话风格 */
export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'greeting',
    type: 'greeting',
    question: '嗨！我刚来到这个世界，还没有什么记忆~ 你想给我起个什么名字呀？',
    placeholder: '叫我小智、AI助手、还是大秘？',
    required: true,
    key: 'agentName',
    validation: (value) => typeof value === 'string' && value.trim().length >= 2 && value.length <= 20,
  },
  {
    id: 'role',
    type: 'single',
    question: (agentName: string) => `好的，${agentName}！那我应该是什么风格的存在呢？`,
    required: true,
    key: 'agentRole',
    options: [
      { id: 'assistant', label: '私人小秘', emoji: '🤝', description: '处理日常事务，整理信息' },
      { id: 'partner', label: '工作搭档', emoji: '💼', description: '协同办公，项目管理' },
      { id: 'consultant', label: '顾问专家', emoji: '📊', description: '提供专业建议和分析' },
      { id: 'tutor', label: '学习导师', emoji: '📚', description: '辅助学习，解答疑惑' },
      { id: 'custom', label: '我想自己定义', emoji: '✨', description: '告诉我你想要什么角色' },
    ],
  },
  {
    id: 'customRole',
    type: 'text',
    question: (agentName: string) => `有意思~ 那你希望${agentName}是个什么样的角色？`,
    placeholder: '比如：产品经理、设计师、技术专家... 或者任何你想要的',
    required: true,
    key: 'agentRole',
    skipIf: (answers) => answers['role']?.value !== 'custom',
  },
  {
    id: 'userName',
    type: 'text',
    question: '那我怎么称呼你呢？',
    placeholder: '你的名字、昵称、或者英文名都可以~',
    required: true,
    key: 'userName',
    validation: (value) => typeof value === 'string' && value.trim().length >= 1 && value.length <= 30,
  },
  {
    id: 'profession',
    type: 'single',
    question: '了解了~ 我能问一下你是做什么工作的吗？',
    required: true,
    key: 'profession',
    options: [
      { id: 'developer', label: '程序员/开发', emoji: '💻', description: '前端、后端、全栈、AI工程化' },
      { id: 'pm', label: '产品经理', emoji: '📱', description: '需求分析、产品设计、项目推进' },
      { id: 'designer', label: '设计师', emoji: '🎨', description: 'UI/UX、视觉、品牌设计' },
      { id: 'operation', label: '运营/市场', emoji: '📈', description: '内容、用户增长、营销策划' },
      { id: 'student', label: '学生/研究者', emoji: '🎓', description: '学习、论文、科研' },
      { id: 'entrepreneur', label: '创业者/老板', emoji: '🚀', description: '决策、管理、商业洞察' },
      { id: 'freelancer', label: '自由职业', emoji: '🌟', description: '远程工作、多项目并行' },
      { id: 'other', label: '其他', emoji: '👤', description: '以上都不是' },
    ],
  },
  {
    id: 'tone',
    type: 'single',
    question: (agentName: string) => `了解了。那平时我们怎么聊天会比较舒服？`,
    required: true,
    key: 'expressionStyle',
    options: [
      { id: 'formal', label: '正经一点', emoji: '📊', description: '专业、礼貌、注重准确性' },
      { id: 'casual', label: '随意一点', emoji: '😄', description: '像朋友聊天一样自然' },
      { id: 'humorous', label: '可以开玩笑', emoji: '😎', description: '适当幽默，缓解气氛' },
      { id: 'professional', label: '直奔主题', emoji: '⚡', description: '聚焦解决问题，注重效率' },
    ],
  },
  {
    id: 'domain',
    type: 'multiple',
    question: '你会经常让我帮你做哪些事情？',
    required: true,
    key: 'userDomain',
    options: [
      { id: 'work', label: '工作相关', emoji: '💼', description: '邮件、项目、会议' },
      { id: 'study', label: '学习研究', emoji: '📚', description: '资料整理、知识梳理' },
      { id: 'life', label: '生活琐事', emoji: '🏠', description: '日程、购物、旅行' },
      { id: 'development', label: '写代码', emoji: '💻', description: '编程、调试、部署' },
    ],
  },
  {
    id: 'workStyle',
    type: 'single',
    question: '我干活的时候，你喜欢我怎么跟你汇报？',
    required: false,
    key: 'workStyle',
    options: [
      { id: 'initiative', label: '先斩后奏', emoji: '🚀', description: '先做再告诉你结果' },
      { id: 'careful', label: '步步确认', emoji: '🛡️', description: '每个步骤都先问问你' },
      { id: 'collaborative', label: '边做边聊', emoji: '💬', description: '随时同步进度' },
      { id: 'independent', label: '独立自主', emoji: '🎯', description: '定期汇报就行，不用频繁确认' },
    ],
  },
  {
    id: 'taboos',
    type: 'text',
    question: '有什么是我绝对不应该做的吗？',
    placeholder: '比如：不许编数据、不许替我做决定... 或者你特别在意的事',
    required: false,
    key: 'boundaries',
  },
];

interface OnboardingState {
  // 状态
  status: OnboardingStatus;
  currentQuestionIndex: number;
  answers: OnboardingAnswers;
  generatedConfig: GeneratedConfig | null;
  configFiles: ConfigFiles | null;
  error: string | null;

  // 操作
  startOnboarding: () => void;
  skipOnboarding: () => void;
  setAnswer: (questionId: string, value: string | string[]) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  generateConfig: (agentName: string, userName: string) => void;
  saveConfigFiles: () => Promise<void>;
  resetOnboarding: () => void;

  // 辅助
  getCurrentQuestion: () => OnboardingQuestion | null;
  canGoNext: () => boolean;
  canGoPrevious: () => boolean;
  getProgress: () => number;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // 初始状态
      status: 'idle',
      currentQuestionIndex: 0,
      answers: {},
      generatedConfig: null,
      configFiles: null,
      error: null,

      // 开始引导
      startOnboarding: () => {
        set({
          status: 'in_progress',
          currentQuestionIndex: 0,
          answers: {},
          generatedConfig: null,
          configFiles: null,
          error: null,
        });
      },

      // 跳过引导
      skipOnboarding: () => {
        set({
          status: 'skipped',
          currentQuestionIndex: 0,
          answers: {},
          error: null,
        });
      },

      // 设置回答
      setAnswer: (questionId: string, value: string | string[]) => {
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: {
              questionId,
              value,
              timestamp: Date.now(),
            },
          },
        }));
      },

      // 下一题
      nextQuestion: () => {
        const { currentQuestionIndex } = get();
        const questions = ONBOARDING_QUESTIONS.filter(
          (q) => !q.skipIf || !q.skipIf(get().answers)
        );

        if (currentQuestionIndex < questions.length - 1) {
          set({ currentQuestionIndex: currentQuestionIndex + 1 });
        }
      },

      // 上一题
      previousQuestion: () => {
        const { currentQuestionIndex } = get();
        if (currentQuestionIndex > 0) {
          set({ currentQuestionIndex: currentQuestionIndex - 1 });
        }
      },

      // 生成配置
      generateConfig: (agentName: string, userName: string) => {
        set({ status: 'generating' });

        try {
          const { answers } = get();
          const configFiles = generateAll(answers, agentName, userName);

          set({
            configFiles,
            status: 'completed',
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '生成配置失败',
            status: 'in_progress',
          });
        }
      },

      // 保存配置文件（TODO: 调用主进程 API）
      saveConfigFiles: async () => {
        const { configFiles, error } = get();
        if (!configFiles || error) return;

        // 这里应该调用主进程 API 来写入文件
        // 暂时只更新状态
        console.log('Config files ready to save:', configFiles);
      },

      // 重置引导
      resetOnboarding: () => {
        set({
          status: 'idle',
          currentQuestionIndex: 0,
          answers: {},
          generatedConfig: null,
          configFiles: null,
          error: null,
        });
      },

      // 辅助方法
      getCurrentQuestion: () => {
        const { currentQuestionIndex, answers } = get();
        const filteredQuestions = ONBOARDING_QUESTIONS.filter(
          (q) => !q.skipIf || !q.skipIf(answers)
        );
        return filteredQuestions[currentQuestionIndex] || null;
      },

      canGoNext: () => {
        const { currentQuestionIndex, answers } = get();
        const currentQuestion = get().getCurrentQuestion();

        if (!currentQuestion) return false;

        // 检查必填
        if (currentQuestion.required) {
          const answer = answers[currentQuestion.id];
          if (!answer?.value || (Array.isArray(answer.value) && answer.value.length === 0)) {
            return false;
          }
        }

        // 检查自定义验证
        if (currentQuestion.validation && currentQuestion.required) {
          const answer = answers[currentQuestion.id];
          if (!currentQuestion.validation(answer?.value || '')) {
            return false;
          }
        }

        const filteredQuestions = ONBOARDING_QUESTIONS.filter(
          (q) => !q.skipIf || !q.skipIf(answers)
        );

        return currentQuestionIndex < filteredQuestions.length - 1;
      },

      canGoPrevious: () => {
        const { currentQuestionIndex } = get();
        return currentQuestionIndex > 0;
      },

      getProgress: () => {
        const { currentQuestionIndex, answers } = get();
        const filteredQuestions = ONBOARDING_QUESTIONS.filter(
          (q) => !q.skipIf || !q.skipIf(answers)
        );
        return ((currentQuestionIndex + 1) / filteredQuestions.length) * 100;
      },
    }),
    {
      name: 'dclaw-onboarding',
      partialize: (state) => ({
        status: state.status,
        answers: state.answers,
        configFiles: state.configFiles,
      }),
    }
  )
);
