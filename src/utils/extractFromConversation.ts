/**
 * Conversation Extractor
 * 从对话中提取关键信息用于生成配置
 */

import type { OnboardingAnswers, GeneratedConfig } from '@/types/onboarding';

/**
 * 从对话历史中提取用户偏好
 */
export function extractPreferencesFromConversation(
  messages: Array<{ role: string; content: string }>
): Partial<GeneratedConfig> {
  const result: Partial<GeneratedConfig> = {};

  // 合并所有用户消息
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase())
    .join(' ');

  // 提取域名关键词
  const domainKeywords: Record<string, string[]> = {
    work: ['工作', '项目', '邮件', '会议', '汇报', '职场', 'office', 'project'],
    study: ['学习', '课程', '论文', '研究', '考试', '作业', 'study', 'learn'],
    life: ['生活', '旅行', '购物', '做饭', '健身', 'life', 'daily'],
    development: ['代码', '编程', '开发', '调试', 'git', '部署', 'code', 'programming'],
  };

  const detectedDomains: string[] = [];
  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(kw => userMessages.includes(kw))) {
      detectedDomains.push(domain);
    }
  }

  if (detectedDomains.length > 0) {
    result.userDomain = detectedDomains;
  }

  // 提取语气偏好
  const toneKeywords: Record<string, string[]> = {
    formal: ['正式', '专业', '严谨', '尊敬', '礼貌', 'formal', 'professional'],
    casual: ['随意', '轻松', '朋友', '聊天', 'casual', 'relaxed'],
    humorous: ['幽默', '有趣', '搞笑', '开玩笑', 'humor', 'funny'],
  };

  for (const [tone, keywords] of Object.entries(toneKeywords)) {
    if (keywords.some((kw: string) => userMessages.includes(kw))) {
      result.expressionStyle = tone as string;
      break;
    }
  }

  return result;
}

/**
 * 验证回答是否有效
 */
export function validateAnswers(answers: OnboardingAnswers): {
  valid: boolean;
  missingRequired: string[];
} {
  const missingRequired: string[] = [];

  // 这里是简化的验证逻辑
  // 实际可以根据问题定义进行验证
  for (const [key, answer] of Object.entries(answers)) {
    if (!answer.value || (Array.isArray(answer.value) && answer.value.length === 0)) {
      missingRequired.push(key);
    }
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
  };
}

/**
 * 从回答中提取名字
 */
export function extractName(answers: OnboardingAnswers): string {
  const nameAnswer = answers['agentName'];
  if (!nameAnswer) return 'AI助手';

  const name = nameAnswer.value;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  return 'AI助手';
}

/**
 * 从回答中提取用户名
 */
export function extractUserName(answers: OnboardingAnswers): string {
  const userAnswer = answers['userName'];
  if (!userAnswer) return '用户';

  const name = userAnswer.value;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  return '用户';
}
