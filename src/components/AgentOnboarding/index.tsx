/**
 * AgentOnboarding - 主引导组件
 * 全屏模态框形式的对话式引导
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useOnboardingStore, ONBOARDING_QUESTIONS } from '@/hooks/useOnboarding';
import { OnboardingChat } from './OnboardingChat';
import { ConfigPreview } from './ConfigPreview';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ConfigFiles } from '@/types/onboarding';

interface AgentOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (configFiles: ConfigFiles) => void;
}

export function AgentOnboarding({ isOpen, onClose, onComplete }: AgentOnboardingProps) {
  const {
    status,
    configFiles,
    startOnboarding,
    skipOnboarding,
    generateConfig,
    canGoPrevious,
    previousQuestion
  } = useOnboardingStore();

  useEffect(() => {
    if (isOpen && status === 'idle') {
      startOnboarding();
    }
  }, [isOpen, status, startOnboarding]);

  useEffect(() => {
    if (status === 'completed' && configFiles) {
      onComplete(configFiles);
    }
  }, [status, configFiles, onComplete]);

  const handleSkip = () => {
    skipOnboarding();
    onClose();
  };

  const handleGenerate = () => {
    const agentNameAnswer = useOnboardingStore.getState().answers['agentName']?.value;
    const agentName = typeof agentNameAnswer === 'string' && agentNameAnswer.trim()
      ? agentNameAnswer.trim()
      : 'Dclaw 助手';
    const userNameAnswer = useOnboardingStore.getState().answers['userName']?.value;
    const userName = typeof userNameAnswer === 'string' && userNameAnswer.trim()
      ? userNameAnswer.trim()
      : '用户';
    generateConfig(agentName, userName);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl h-[85vh] mx-4 bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden border"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-transparent dark:from-blue-900/20 dark:via-purple-900/10 dark:to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    欢迎来到 Dclaw
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    让我们花1分钟，让我更懂你 ✨
                  </p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="p-2 hover:bg-accent rounded-lg text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* 左侧：对话 */}
              <div className="flex-1 flex flex-col">
                <OnboardingChat />
              </div>

              {/* 右侧：预览（仅完成时显示） */}
              {status === 'completed' && configFiles && (
                <div className="w-96 border-l bg-muted/30 overflow-auto">
                  <ConfigPreview configFiles={configFiles} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-muted/30">
              <div className="flex items-center justify-between">
                <OnboardingProgress />

                <div className="flex gap-2">
                  {status !== 'completed' && (
                    <>
                      {canGoPrevious() && (
                        <Button
                          variant="outline"
                          onClick={previousQuestion}
                          className="text-muted-foreground"
                        >
                          ← 上一步
                        </Button>
                      )}
                      <OnboardingNavigation onGenerate={handleGenerate} />
                    </>
                  )}
                  {status === 'completed' && (
                    <Button
                      onClick={onClose}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                    >
                      准备好了 →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 进度指示器 */
function OnboardingProgress() {
  const { currentQuestionIndex, answers } = useOnboardingStore();

  const visibleQuestions = ONBOARDING_QUESTIONS.filter(
    (q) => !q.skipIf || !q.skipIf(answers)
  );

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {visibleQuestions.map((q, index) => {
          const isAnswered = answers[q.id]?.value;
          const isPast = index < currentQuestionIndex;
          const isCurrent = index === currentQuestionIndex;

          return (
            <div
              key={q.id}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                isCurrent ? 'w-4 bg-blue-500' : isPast || isAnswered ? 'bg-purple-400' : 'bg-muted-foreground/30'
              )}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground ml-1">
        {currentQuestionIndex + 1} / {visibleQuestions.length}
      </span>
    </div>
  );
}

/** 导航按钮 */
function OnboardingNavigation({ onGenerate }: { onGenerate: () => void }) {
  const { canGoNext, currentQuestionIndex, answers } = useOnboardingStore();

  const visibleQuestions = ONBOARDING_QUESTIONS.filter(
    (q) => !q.skipIf || !q.skipIf(answers)
  );
  const isLastQuestion = currentQuestionIndex >= visibleQuestions.length - 1;

  if (isLastQuestion) {
    return (
      <Button
        onClick={onGenerate}
        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
      >
        完成 ✓
      </Button>
    );
  }

  return (
    <Button
      onClick={() => {
        const store = useOnboardingStore.getState();
        if (store.canGoNext()) {
          store.nextQuestion();
        }
      }}
      disabled={!canGoNext()}
      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
    >
      下一题 →
    </Button>
  );
}
