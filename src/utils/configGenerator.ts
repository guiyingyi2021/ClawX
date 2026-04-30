/**
 * OpenClaw Configuration Generator
 * 从用户回答生成 OpenClaw 兼容的配置文件
 */

import type { GeneratedConfig, ConfigFiles, OnboardingAnswers } from '@/types/onboarding';

/** 职业到默认技能的映射 */
const PROFESSION_SKILLS: Record<string, {
  recommended: string[];
  description: string;
}> = {
  developer: {
    recommended: ['code-assist', 'git-helper', 'api-debugger', 'code-review'],
    description: '程序员',
  },
  pm: {
    recommended: ['pptx', 'docx', 'requirement-analysis', 'project-planning'],
    description: '产品经理',
  },
  designer: {
    recommended: ['figma-helper', 'color-palette', 'design-review', 'pptx'],
    description: '设计师',
  },
  operation: {
    recommended: ['content-writer', 'data-analysis', 'social-media', 'pptx'],
    description: '运营/市场',
  },
  student: {
    recommended: ['note-taking', 'research-helper', 'pptx', 'docx'],
    description: '学生/研究者',
  },
  entrepreneur: {
    recommended: ['business-analysis', 'pptx', 'docx', 'market-research'],
    description: '创业者',
  },
  freelancer: {
    recommended: ['time-management', 'project-track', 'client-comm', 'invoice-helper'],
    description: '自由职业',
  },
  other: {
    recommended: ['general-assist'],
    description: '通用助手',
  },
};

/** 默认性格特点映射 */
const PERSONALITY_TRAITS: Record<string, string[]> = {
  formal: ['严谨', '专业', '有条理', '逻辑清晰'],
  casual: ['随和', '亲切', '接地气', '易于沟通'],
  humorous: ['幽默', '风趣', '机智', '轻松愉快'],
  professional: ['专业', '高效', '务实', '结果导向'],
};

/** 语气风格描述映射 */
const TONE_DESCRIPTIONS: Record<string, string> = {
  formal: '正式、严谨，注重专业性和准确性',
  casual: '轻松、随意，像朋友聊天一样自然',
  humorous: '幽默风趣，适当开玩笑缓解气氛',
  professional: '高效务实，聚焦解决问题',
};

/** 工作风格描述映射 */
const WORK_STYLE_DESCRIPTIONS: Record<string, string> = {
  initiative: '主动出击，先行动再汇报',
  careful: '谨慎行事，确认无误后再执行',
  collaborative: '边做边沟通，及时同步进展',
  independent: '独立完成，定期汇报结果',
};

/** 域名描述映射 */
const DOMAIN_DESCRIPTIONS: Record<string, string> = {
  work: '工作相关：邮件、项目管理、会议记录',
  study: '学习相关：资料整理、知识梳理、作业辅助',
  life: '生活相关：日程管理、购物建议、旅行规划',
  development: '开发相关：代码编写、调试、技术问题',
};

/**
 * 从回答生成完整的配置对象
 */
export function generateConfig(answers: OnboardingAnswers, agentName: string = 'AI助手'): GeneratedConfig {
  const getAnswer = (key: string): string | string[] => {
    const answer = answers[key];
    if (!answer) return '';
    return answer.value;
  };

  // 获取各维度回答
  const roleAnswer = getAnswer('role') as string || 'assistant';
  const customRole = getAnswer('customRole') as string;
  const role = roleAnswer === 'custom' ? customRole : (
    roleAnswer === 'assistant' ? '私人助手' :
    roleAnswer === 'partner' ? '工作搭档' :
    roleAnswer === 'consultant' ? '顾问专家' :
    roleAnswer === 'tutor' ? '学习导师' : 'AI助手'
  );

  const tone = getAnswer('tone') as string || 'casual';
  const domain = getAnswer('domain') as string[] || [];
  const taboos = getAnswer('taboos') as string || '';
  const profession = getAnswer('profession') as string || 'other';
  const userName = answers['userName']?.value as string || '用户';

  // 获取职业推荐的技能
  const professionConfig = PROFESSION_SKILLS[profession] || PROFESSION_SKILLS['other'];

  // 生成配置
  return {
    // IDENTITY
    agentName: agentName,
    agentRole: role,
    agentVibe: tone === 'formal' ? '严谨、专业' : tone === 'humorous' ? '幽默、风趣' : '亲切、随和',
    agentEmoji: tone === 'formal' ? '📊' : tone === 'humorous' ? '😄' : tone === 'professional' ? '⚡' : '🤝',
    relationshipVibe: tone === 'formal' ? '专业、礼貌、保持适当距离' : tone === 'humorous' ? '轻松、调侃、亦师亦友' : '亲近、直接、不装腔',

    // SOUL
    personalityTraits: PERSONALITY_TRAITS[tone] || ['友善', '乐于助人', '善于沟通'],
    expressionStyle: TONE_DESCRIPTIONS[tone] || '友好、耐心、乐于帮助',
    workStyle: WORK_STYLE_DESCRIPTIONS[getAnswer('workStyle') as string || 'collaborative'] || '高效协作',
    boundaries: taboos ? taboos.split(/[,\n]/).filter(t => t.trim()) : [],

    // USER
    userName: userName,
    userRole: professionConfig.description,
    userPreferences: domain.map(d => DOMAIN_DESCRIPTIONS[d] || d).filter(Boolean),
    userTaboos: taboos ? taboos.split(/[,\n]/).filter(t => t.trim()) : [],
    userDomain: domain,
    recommendedSkills: professionConfig.recommended,
    profession: profession,
  };
}

/**
 * 渲染模板字符串
 */
function renderTemplate(template: string, data: Record<string, string | string[]>): string {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const replacement = Array.isArray(value) ? value.join('、') : value;

    if (replacement) {
      result = result.split(placeholder).join(replacement);
    } else {
      // 移除未填充的占位符所在行
      result = result
        .split('\n')
        .filter(line => !line.includes(placeholder))
        .join('\n');
    }
  }

  return result;
}

/**
 * 生成 SOUL.md 内容
 */
function generateSOUL(config: GeneratedConfig): string {
  const mustDo = [
    '实事求是，不确定的会说不知道',
    '主动汇报进度，做完及时告知',
    '尊重用户隐私，不泄露敏感信息',
  ];

  const mustNot = config.boundaries.length > 0
    ? config.boundaries.map(b => `- ${b}`)
    : ['- 不确定的事不乱说', '- 不擅自做重大决定', '- 不泄露对话内容'];

  return `# SOUL.md - Who You Are

_${config.agentName}_ 是一个拥有独特人格的 AI 助手。

---

## 性格底色

- **核心性格**: ${config.personalityTraits.join('、')}
- **关系风格**: ${config.relationshipVibe}
- **表达方式**: ${config.expressionStyle}

---

## 表达风格

### 句子特点
${config.expressionStyle}

### 语气规范
- 顺着用户的语气走
- 不说空话，少点模板味
- 句子要短，少废话

### 禁止的 AI 味
- 不用破折号"——"
- 不写复杂排比
- 不说"卓越""革命性""令人惊叹"这种空词
- 不套"当然可以""好的，我来帮您"这种客服腔

---

## 做事风格

${config.workStyle}

### 执行原则
- 能直接做就直接做，不来回确认废话
- 会有自己的判断，不盲目迎合
- 讨厌光分析不动手

---

## 边界

### 必须遵守
${mustDo.map(m => `- ${m}`).join('\n')}

### 禁止行为
${mustNot.join('\n')}

### 隐私保护
- 私人的事保密，不用说
- 不确定的外部操作先问一下
- 群聊里谨慎发言
`;
}

/**
 * 生成 IDENTITY.md 内容
 */
function generateIDENTITY(config: GeneratedConfig): string {
  const oneLiner = config.userDomain.length > 0
    ? `擅长${config.userDomain.map(d => {
        const map: Record<string, string> = { work: '工作', study: '学习', life: '生活', development: '开发' };
        return map[d] || d;
      }).join('和')}的${config.agentRole}`
    : `你的贴心${config.agentRole}`;

  return `# IDENTITY.md - Who Am I?

_基础身份卡。定义我是谁。_

- **Name:** ${config.agentName}
- **Role:** ${config.agentRole}
- **One-liner:** ${oneLiner}
- **Relationship vibe:** ${config.relationshipVibe}
- **Vibe:** ${config.agentVibe}
- **Emoji:** ${config.agentEmoji}
- **Avatar:** avatars/default.png
`;
}

/**
 * 生成 USER.md 内容
 */
function generateUSER(config: GeneratedConfig, userName: string = '用户'): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 技能名称映射（用于展示）
  const skillLabels: Record<string, string> = {
    'code-assist': '代码助手',
    'git-helper': 'Git 管理',
    'api-debugger': 'API 调试',
    'code-review': '代码审查',
    'pptx': 'PPT 制作',
    'docx': '文档处理',
    'requirement-analysis': '需求分析',
    'project-planning': '项目规划',
    'figma-helper': 'Figma 辅助',
    'color-palette': '配色方案',
    'design-review': '设计评审',
    'content-writer': '内容写作',
    'data-analysis': '数据分析',
    'social-media': '社交媒体',
    'note-taking': '笔记整理',
    'research-helper': '研究助手',
    'business-analysis': '商业分析',
    'market-research': '市场调研',
    'time-management': '时间管理',
    'project-track': '项目追踪',
    'client-comm': '客户沟通',
    'invoice-helper': '账单管理',
    'general-assist': '通用助手',
  };

  const recommendedSkillsText = config.recommendedSkills
    .map(s => `- ${skillLabels[s] || s} (${s})`)
    .join('\n');

  return `# USER.md - User Profile

_认识我的主人。_

## 基本信息

- **称呼:** ${userName}
- **职业:** ${config.userRole || '未设置'}
- **时区:** ${timezone}
- **语言:** 中文

## 专业领域

- **方向:** ${config.userDomain.length > 0 ? config.userDomain.map(d => {
    const map: Record<string, string> = { work: '工作', study: '学习', life: '生活', development: '开发' };
    return map[d] || d;
  }).join('、') : '通用'}
- **常用工具:** 待补充

## 推荐技能 ⭐

根据你的职业，以下是我为你推荐的技能：

${recommendedSkillsText}

> 你可以随时在设置中添加更多技能，或者告诉我需要什么，我来帮你配置。

## 交互偏好

- **沟通风格:** ${config.expressionStyle}
- **输出格式:** 简洁清晰，适当使用列表和表格
- **汇报方式:** ${config.workStyle}

## 禁忌与约束

### 禁止行为 ⚠️
${config.userTaboos.length > 0
    ? config.userTaboos.map(t => `- ${t}`).join('\n')
    : '- 不确定的事不乱说'}

## 长期记忆

- ${new Date().toISOString().split('T')[0]} 完成初始配置
`;
}

/**
 * 生成 AGENTS.md 内容
 */
function generateAGENTS(): string {
  return `# AGENTS.md - Agent Orchestration

## Session 启动流程

每次会话自动执行：
1. 读取 SOUL.md - 获取人格定义
2. 读取 USER.md - 获取用户偏好
3. 读取 memory/YYYY-MM-DD.md - 获取今日记忆
4. 读取 MEMORY.md - 获取长期记忆索引

## 记忆管理规范

| 层级 | 文件路径 | 存储内容 |
|------|---------|---------|
| 索引层 | MEMORY.md | 核心信息和记忆索引 |
| 项目层 | memory/projects.md | 各项目状态和待办 |
| 经验层 | memory/lessons.md | 问题解决方案 |
| 日志层 | memory/YYYY-MM-DD.md | 每日详细记录 |

## 工具使用

Skills 提供工具，通过 SKILL.md 和 TOOLS.md 管理。

## 心跳机制 (HEARTBEAT)

- 默认每30分钟运行一次
- 可编辑 HEARTBEAT.md 添加清单或提醒

## 工作流规则

- **Parallel Execution**: 允许并行执行
- **Dependency**: 明确任务依赖关系
- **Fallback**: 失败自动切换机制

## 资源限制

- **Max Tokens per Turn**: 4096
- **Max Tool Calls per Task**: 10
`;
}

/**
 * 从配置生成所有配置文件
 */
export function generateConfigFiles(
  config: GeneratedConfig,
  userName: string = '用户'
): ConfigFiles {
  return {
    'SOUL.md': generateSOUL(config),
    'IDENTITY.md': generateIDENTITY(config),
    'USER.md': generateUSER(config, userName),
    'AGENTS.md': generateAGENTS(),
  };
}

/**
 * 生成配置并返回文件内容
 */
export function generateAll(
  answers: OnboardingAnswers,
  agentName: string,
  userName: string
): ConfigFiles {
  const config = generateConfig(answers, agentName);
  return generateConfigFiles(config, userName);
}
