/**
 * useInChatOnboarding - 聊天内引导 Hook
 * 管理引导状态和用户第一条消息的暂存
 */

import { useCallback } from 'react';
import { useOnboardingStore } from './useOnboarding';

const ONBOARDING_COMPLETED_KEY = 'dclaw-onboarding-completed';

export function useInChatOnboarding() {
  const store = useOnboardingStore();

  // 检查是否已完成过引导
  const hasCompletedOnboarding = useCallback(() => {
    // 检查 localStorage
    const stored = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
    if (stored === 'true') return true;

    // 也检查 store 中的状态
    const storeStatus = store.status;
    return storeStatus === 'completed' || storeStatus === 'skipped';
  }, [store.status]);

  // 开始引导
  const startOnboarding = useCallback(() => {
    store.startOnboarding();
  }, [store]);

  // 完成引导
  const completeOnboarding = useCallback((agentName: string, userName: string) => {
    // 生成配置
    store.generateConfig(agentName, userName);

    // 标记完成
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');

    // 保存配置文件
    store.saveConfigFiles();
  }, [store]);

  // 重置引导（用于调试）
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    store.resetOnboarding();
  }, [store]);

  return {
    hasCompletedOnboarding,
    startOnboarding,
    completeOnboarding,
    resetOnboarding,
    isOnboardingActive: store.status === 'in_progress',
    onboardingStore: store,
  };
}
