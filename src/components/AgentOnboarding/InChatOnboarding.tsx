/**
 * InChatOnboarding - 聊天内引导组件
 * 核心职责：渲染引导对话历史（作为真实聊天消息气泡）+ 当前问题的输入组件
 * 不再渲染 AI 问答的"自己包裹的"样式，而是像真正聊天那样：
 *   - AI 问题 → 左侧气泡
 *   - 用户回答 → 右侧气泡
 *   输入组件保持和 ChatInput 一样的样式
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Check, Sparkles } from 'lucide-react';
import { useOnboardingStore, ONBOARDING_QUESTIONS } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';
import type { OnboardingQuestion, OnboardingAnswers } from '@/types/onboarding';

interface InChatOnboardingProps {
  onComplete: (agentName: string, userName: string) => void;
}

/** 从 answers 推导出"已完成"的问答列表 */
function buildConversationHistory(answers: OnboardingAnswers) {
  const history: Array<{ question: OnboardingQuestion; answer: string | string[] }> = [];
  for (const q of ONBOARDING_QUESTIONS) {
    if (q.skipIf && q.skipIf(answers)) continue; // 跳过条件题
    const ans = answers[q.id];
    if (ans) {
      history.push({ question: q, answer: ans.value });
    }
  }
  return history;
}

export function InChatOnboarding({ onComplete }: InChatOnboardingProps) {
  const {
    answers,
    setAnswer,
    getCurrentQuestion,
    nextQuestion,
  } = useOnboardingStore();

  const currentQuestion = getCurrentQuestion();

  // 获取已填写的名字（问题 ID 是 'greeting'）
  const agentNameAnswer = answers['greeting']?.value as string | undefined;
  const agentName = typeof agentNameAnswer === 'string' ? agentNameAnswer : undefined;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentQuestion?.id]);

  // 当前问题文本
  const questionText = currentQuestion
    ? (typeof currentQuestion.question === 'function'
        ? currentQuestion.question(agentName || '我')
        : currentQuestion.question)
    : '';

  // 已完成的对话历史
  const history = buildConversationHistory(answers);

  const handleSubmit = (value: string | string[]) => {
    if (!currentQuestion) return;
    setAnswer(currentQuestion.id, value);
    setTimeout(() => {
      const { currentQuestionIndex: idx, answers: currentAnswers } = useOnboardingStore.getState();
      const filtered = ONBOARDING_QUESTIONS.filter(
        (q) => !q.skipIf || !q.skipIf(currentAnswers)
      );
      const isLast = idx >= filtered.length - 1;
      if (isLast) {
        // 最后一题：通过 onComplete 通知父组件，由父组件的 completeOnboarding 统一调用 generateConfig
        const name = (currentAnswers['greeting']?.value as string) || 'AI助手';
        const user = (currentAnswers['userName']?.value as string) || '你';
        onComplete(name, user);
      } else {
        nextQuestion();
      }
    }, 300);
  };

  return (
    <div className="w-full">
      {/* 完整对话历史：AI问 + 用户答 交替出现 */}
      {history.map((item) => (
        <ConversationPair
          key={item.question.id}
          question={item.question}
          answer={item.answer}
          agentName={agentName}
        />
      ))}

      {/* 当前问题的 AI 气泡（未回答时显示） */}
      {currentQuestion && (
        <motion.div
          key={`q-${currentQuestion.id}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex gap-3 mb-3"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{questionText}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 当前问题的输入区域：使用 ChatInput 的视觉风格 */}
      {currentQuestion && (
        <motion.div
          key={`input-${currentQuestion.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <OnboardingInput
            question={currentQuestion}
            onSubmit={handleSubmit}
          />
        </motion.div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

// ── 单个问答对：AI 气泡 + 用户气泡 ──────────────────────────────

function ConversationPair({
  question,
  answer,
  agentName,
}: {
  question: OnboardingQuestion;
  answer: string | string[];
  agentName?: string;
}) {
  const qText =
    typeof question.question === 'function'
      ? question.question(agentName || '我')
      : question.question;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="mb-3"
    >
      {/* AI 问题 */}
      <div className="flex gap-3 mb-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{qText}</p>
          </div>
        </div>
      </div>

      {/* 用户回答 */}
      <div className="flex gap-3 justify-end">
        <div className="flex-1 flex justify-end min-w-0">
          <div className="bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-md">
            <AnswerBubble question={question} value={answer} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── 答案气泡内容 ───────────────────────────────────────────────

function AnswerBubble({
  question,
  value,
}: {
  question: OnboardingQuestion;
  value: string | string[];
}) {
  if (question.type === 'single' && typeof value === 'string') {
    const option = question.options?.find((o) => o.id === value);
    return (
      <div className="flex items-center gap-2">
        {option?.emoji && <span>{option.emoji}</span>}
        <span>{option?.label || value}</span>
        <Check className="w-4 h-4 opacity-70" />
      </div>
    );
  }
  if (question.type === 'multiple' && Array.isArray(value)) {
    const labels = value
      .map((v) => question.options?.find((o) => o.id === v)?.label || v)
      .join('、');
    return (
      <div className="flex items-center gap-2">
        <span>{labels || value.join('、')}</span>
        <Check className="w-4 h-4 opacity-70" />
      </div>
    );
  }
  return <p className="whitespace-pre-wrap">{String(value)}</p>;
}

// ── 当前问题输入组件（视觉风格和 ChatInput 一致）───────────────

function OnboardingInput({
  question,
  onSubmit,
}: {
  question: OnboardingQuestion;
  onSubmit: (value: string | string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  // 单选/多选
  if (question.type === 'single' || question.type === 'multiple') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {question.options?.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              if (question.type === 'multiple') {
                // 多选暂不支持 toggle，只做单选确认
                onSubmit(option.id);
              } else {
                onSubmit(option.id);
              }
            }}
            className={cn(
              'flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-sm',
              'border-border hover:border-primary/50 hover:bg-muted/50',
              'focus:outline-none focus:ring-2 focus:ring-primary',
            )}
          >
            {option.emoji && <span>{option.emoji}</span>}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{option.label}</p>
              {option.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  }

  // 文本输入（模拟 ChatInput 样式）
  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputValue.trim()) {
            onSubmit(inputValue.trim());
            setInputValue('');
          }
        }}
        placeholder={question.placeholder || '输入你的回答...'}
        autoFocus
        className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
      />
      {inputValue.trim() && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-accent rounded-full transition-colors"
          onClick={() => {
            if (inputValue.trim()) {
              onSubmit(inputValue.trim());
              setInputValue('');
            }
          }}
        >
          <Send className="w-4 h-4 text-primary" />
        </button>
      )}
    </div>
  );
}
