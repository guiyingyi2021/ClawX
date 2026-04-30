/**
 * OnboardingChat - 对话式引导界面
 * 像朋友聊天一样自然流畅
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Check, Sparkles } from 'lucide-react';
import { useOnboardingStore, ONBOARDING_QUESTIONS } from '@/hooks/useOnboarding';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingQuestion } from '@/types/onboarding';

/** 渲染问题文本 */
function renderQuestionText(question: OnboardingQuestion, agentName?: string): string {
  if (!question) return '';
  if (typeof question.question === 'function') {
    return question.question(agentName);
  }
  return question.question;
}

export function OnboardingChat() {
  const {
    answers,
    setAnswer,
    getCurrentQuestion,
  } = useOnboardingStore();

  const currentQuestion = getCurrentQuestion();

  // 获取已填写的名字（问题 ID 是 'greeting'，key 是 'agentName'）
  const agentNameAnswer = answers['greeting']?.value as string | undefined;
  const agentName = typeof agentNameAnswer === 'string' ? agentNameAnswer : undefined;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentQuestion?.id]);

  if (!currentQuestion) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        正在准备问题...
      </div>
    );
  }

  const questionText = renderQuestionText(currentQuestion, agentName);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* 问题列表 */}
      <div className="flex-1 overflow-auto space-y-4">
        {/* 当前问题 */}
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-muted rounded-2xl rounded-tl-none p-4 max-w-[85%] shadow-sm">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{questionText}</p>
            </div>
          </div>
        </motion.div>

        {/* 回答 */}
        {answers[currentQuestion.id] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-3 justify-end"
          >
            <div className="flex-1 flex flex-col items-end">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg text-white rounded-2xl rounded-tr-none p-4 max-w-[85%]">
                <QuestionAnswer
                  question={currentQuestion}
                  value={answers[currentQuestion.id].value}
                />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="mt-4">
        <QuestionInput
          question={currentQuestion}
          value={answers[currentQuestion.id]?.value}
          onChange={(value) => setAnswer(currentQuestion.id, value)}
        />
      </div>
    </div>
  );
}

/** 问题答案展示 */
function QuestionAnswer({
  question,
  value,
}: {
  question: OnboardingQuestion;
  value: string | string[];
}) {
  if (!question || !value) return null;

  if (question.type === 'single' && typeof value === 'string') {
    const option = question.options?.find((o) => o.id === value);
    return (
      <div className="flex items-center gap-2">
        {option?.emoji && <span>{option.emoji}</span>}
        <span>{option?.label || value}</span>
        <Check className="w-4 h-4 ml-2" />
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
        <Check className="w-4 h-4 ml-2" />
      </div>
    );
  }

  return <p className="whitespace-pre-wrap">{String(value)}</p>;
}

/** 问题输入组件 */
function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: OnboardingQuestion;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  // 单选/多选
  if (question.type === 'single' || question.type === 'multiple') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {question.options?.map((option) => {
          const isSelected = question.type === 'multiple'
            ? Array.isArray(value) && value.includes(option.id)
            : value === option.id;

          return (
            <Button
              key={option.id}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'justify-start h-auto py-3 px-4',
                isSelected && 'ring-2 ring-blue-500'
              )}
              onClick={() => {
                if (question.type === 'multiple') {
                  const current = Array.isArray(value) ? value : [];
                  if (current.includes(option.id)) {
                    onChange(current.filter((v) => v !== option.id));
                  } else {
                    onChange([...current, option.id]);
                  }
                } else {
                  onChange(option.id);
                }
              }}
            >
              <div className="flex items-center gap-2">
                {option.emoji && <span>{option.emoji}</span>}
                <div className="text-left">
                  <p className="font-medium">{option.label}</p>
                  {option.description && (
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  )}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    );
  }

  // 文本输入
  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputValue.trim()) {
            onChange(inputValue.trim());
            setInputValue('');
          }
        }}
        placeholder={question.placeholder || '输入你的回答...'}
        className="w-full px-4 py-3 pr-12 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {inputValue.trim() && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-accent rounded-full"
          onClick={() => {
            if (inputValue.trim()) {
              onChange(inputValue.trim());
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
