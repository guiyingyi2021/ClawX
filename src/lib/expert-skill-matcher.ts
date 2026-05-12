/**
 * 专家技能智能匹配（优化版）
 * 
 * 匹配策略（按优先级）：
 * 1. 用户手动配置（localStorage，最高优先级）
 * 2. 专家ID映射表（预配置）
 * 3. 专家SOUL.md分析（如果有SOUL文件）
 * 4. 增强的语义匹配（基于角色、描述、专长）
 * 5. 兜底策略（分类推断）
 */

import type { Expert } from '@/types/expert';

// ==================== 用户手动配置（localStorage）====================

const STORAGE_KEY_PREFIX = 'dclaw-expert-skills-';

/**
 * 从 localStorage 读取用户手动配置的技能
 */
function loadUserConfig(expertId: string): string[] | null {
  try {
    const key = STORAGE_KEY_PREFIX + expertId;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('[ExpertSkillMatcher] 读取用户配置失败:', error);
  }
  return null;
}

/**
 * 保存用户手动配置的技能到 localStorage
 */
export function saveUserConfig(expertId: string, skills: string[]): void {
  try {
    const key = STORAGE_KEY_PREFIX + expertId;
    localStorage.setItem(key, JSON.stringify(skills));
    console.log(`[ExpertSkillMatcher] 已保存用户配置: ${expertId} →`, skills);
  } catch (error) {
    console.warn('[ExpertSkillMatcher] 保存用户配置失败:', error);
  }
}

/**
 * 清除用户手动配置
 */
export function clearUserConfig(expertId: string): void {
  try {
    const key = STORAGE_KEY_PREFIX + expertId;
    localStorage.removeItem(key);
    console.log(`[ExpertSkillMatcher] 已清除用户配置: ${expertId}`);
  } catch (error) {
    console.warn('[ExpertSkillMatcher] 清除用户配置失败:', error);
  }
}

/**
 * 专家ID → 技能映射表
 * 这是最精准的配置，会覆盖其他所有匹配逻辑
 * 
 * 如何维护：
 * 1. 新专家加入时，在这里添加映射
 * 2. 如果专家的技能需求变化，更新这里
 * 3. 如果某个专家不需要特殊技能，可以省略或设为空数组
 */
const EXPERT_SKILL_MAP: Record<string, string[]> = {
  // ========== 数据智能 ==========
  'remote-phoebe': ['xlsx', 'pptx'],  // 数据分析师：数据处理 + 可视化
  
  // ========== 营销增长 ==========
  'remote-ben': ['docx', 'pptx', 'pdf'],  // 品牌策略师：方案 + 演示 + 导出
  'remote-jude': ['xlsx', 'docx', 'pptx'],  // 电商运营：数据 + 方案 + 汇报
  
  // ========== 内容创作 ==========
  'remote-kai': ['docx', 'pptx'],  // 内容创作：文章 + 演示
  'remote-maya': ['docx', 'pptx', 'pdf'],  // 抖音策略：方案 + 演示 + 导出
  
  // ========== 销售商务 ==========
  'remote-ulla': ['docx', 'pptx', 'pdf'],  // 销售教练：方案 + 演示 + 合同
  
  // ========== 设计/UX ==========
  'design-ux-architect': ['pdf', 'docx'],  // UX架构师（移除不存在的 ui-ux-pro-max）
  'design-creative-director': ['pdf', 'pptx'],  // 创意总监（移除不存在的 ui-ux-pro-max）
  
  // ========== 技术开发 ==========
  'dev-senior-fullstack': ['xlsx', 'docx', 'pdf'],  // 全栈开发：文档 + 报表
  'dev-ai-engineer': ['xlsx', 'docx'],  // AI工程师：数据处理 + 文档
  
  // ========== 行业顾问 ==========
  'biz-strategy-consultant': ['docx', 'pptx', 'xlsx', 'pdf'],  // 战略咨询：全技能
  'finance-advisor': ['xlsx', 'pdf', 'docx'],  // 财务顾问：数据 + 报告
  
  // ========== 学习成长 ==========
  'edu-skills-mentor': ['docx', 'pdf', 'pptx'],  // 技能导师：教材 + 演示
  'career-coach': ['docx', 'pdf'],  // 职业规划：简历 + 报告
};

/**
 * 技能关键词库（增强版）
 * 每个技能都有一组精准的触发关键词
 */
const SKILL_KEYWORDS: Record<string, {
  primary: string[];    // 强触发词（命中即匹配）
  secondary: string[];  // 弱触发词（需要多个命中或组合命中）
  exclude?: string[];    // 排除词（命中则不匹配）
}> = {
  'xlsx': {
    primary: ['excel', 'xlsx', 'csv', '数据分析', '数据处理', '报表', '统计', '数据可视化'],
    secondary: ['数据', '表格', '计算', '公式', '图表', '财务', '销售数据', '运营数据'],
    exclude: ['文档', 'ppt', '演示'],
  },
  
  'docx': {
    primary: ['word', 'docx', '文档', '文章', '写作', '报告', '方案', '简历', '合同'],
    secondary: ['文字', '编辑', '撰写', '起草', '说明书', '手册', '计划书'],
    exclude: ['excel', '数据', 'ppt'],
  },
  
  'pptx': {
    primary: ['ppt', 'pptx', '演示', '幻灯片', '汇报', '路演', '提案', '演讲'],
    secondary: ['展示', 'presentation', ' pitches', 'demo', '可视化演示'],
    exclude: ['excel', '数据分析'],
  },
  
  'pdf': {
    primary: ['pdf', '打印', '导出', '归档', '电子书', '合同签署'],
    secondary: ['文档转换', '格式固定', '不可编辑', '正式文档'],
    exclude: ['excel', '数据分析'],
  },
  
};

/**
 * 根据专家ID从映射表获取技能（最高优先级）
 */
function getSkillsFromMapping(expertId: string): string[] | null {
  return EXPERT_SKILL_MAP[expertId] || null;
}

/**
 * 分析专家的SOUL.md文件（如果有）
 * TODO: 实现SOUL.md解析逻辑
 */
async function analyzeSoulFile(expertId: string): Promise<string[] | null> {
  // TODO: 读取专家的SOUL.md，分析其中的技能描述
  // 示例：如果SOUL.md中包含"我擅长处理Excel数据"，则匹配xlsx技能
  return null;
}

/**
 * 增强的语义匹配算法
 * 基于关键词库进行精准匹配
 */
function matchSkillsBySemanticAnalysis(expert: Expert): string[] {
  const matchedSkills: Set<string> = new Set();
  
  // 构建专家的完整文本（用于关键词匹配）
  const fullText = [
    expert.role || '',
    expert.category || '',
    expert.description || '',
    ...(expert.specialties?.map(s => s.label) || []),
  ].join(' ').toLowerCase();
  
  // 对每个技能进行匹配
  for (const [skillSlug, keywords] of Object.entries(SKILL_KEYWORDS)) {
    let score = 0;
    
    // 1. 检查强触发词（命中+2分）
    for (const keyword of keywords.primary) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }
    
    // 2. 检查弱触发词（命中+1分）
    for (const keyword of keywords.secondary) {
      if (fullText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    // 3. 检查排除词（命中-3分）
    if (keywords.exclude) {
      for (const keyword of keywords.exclude) {
        if (fullText.includes(keyword.toLowerCase())) {
          score -= 3;
        }
      }
    }
    
    // 4. 判断是否匹配（得分>0且没有被排除）
    if (score > 0) {
      matchedSkills.add(skillSlug);
    }
  }
  
  return Array.from(matchedSkills);
}

/**
 * 兜底策略：根据专家分类推断技能
 */
function inferSkillsByCategory(expert: Expert): string[] {
  const category = expert.category?.toLowerCase() || '';
  const skills: Set<string> = new Set();
  
  // 根据分类推断
  if (category.includes('数据')) {
    skills.add('xlsx');
  }
  
  if (category.includes('营销') || category.includes('内容')) {
    skills.add('docx');
    skills.add('pptx');
  }
  
  if (category.includes('设计')) {
    skills.add('figma'); // 设计类专家匹配 figma 技能
  }
  
  if (category.includes('销售') || category.includes('商务')) {
    skills.add('docx');
    skills.add('pdf');
  }
  
  return Array.from(skills);
}

/**
 * 主函数：根据专家信息智能匹配需要的技能
 * 
 * @param expert 专家对象
 * @returns 需要的技能 slug 数组
 * 匹配优先级：
 * 1. 用户手动配置（localStorage + 后端，最高优先级）
 * 2. 专家ID映射表（预配置）
 * 3. SOUL.md分析（如果有）
 * 4. 增强的语义匹配（基于关键词库）
 * 5. 分类推断（兜底）
 */
export async function getRequiredSkillsForExpert(expert: Expert): Promise<string[]> {
  // 策略0：读取用户手动配置（最高优先级）
  const userConfig = loadUserConfig(expert.id);
  if (userConfig !== null) {
    console.log(`[ExpertSkillMatcher] 从用户配置匹配到技能: ${expert.id} →`, userConfig);
    return userConfig;
  }
  
  // 策略1：从映射表获取
  const mappedSkills = getSkillsFromMapping(expert.id);
  if (mappedSkills !== null) {
    console.log(`[ExpertSkillMatcher] 从映射表匹配到技能: ${expert.id} →`, mappedSkills);
    return mappedSkills;
  }
  
  // 策略2：分析SOUL.md（未来实现）
  // const soulSkills = await analyzeSoulFile(expert.id);
  // if (soulSkills !== null) {
  //   console.log(`[ExpertSkillMatcher] 从SOUL.md匹配到技能: ${expert.id} →`, soulSkills);
  //   return soulSkills;
  // }
  
  // 策略3：增强的语义匹配
  const semanticSkills = matchSkillsBySemanticAnalysis(expert);
  if (semanticSkills.length > 0) {
    console.log(`[ExpertSkillMatcher] 语义匹配到技能: ${expert.id} →`, semanticSkills);
    return semanticSkills;
  }
  
  // 策略4：兜底策略（分类推断）
  const inferredSkills = inferSkillsByCategory(expert);
  console.log(`[ExpertSkillMatcher] 分类推断技能: ${expert.id} →`, inferredSkills);
  return inferredSkills;
}

/**
 * 同步版本（用于无法使用async的场景）
 * 
 * 匹配优先级：
 * 1. 用户手动配置（localStorage，最高优先级）
 * 2. 专家ID映射表
 * 3. 增强的语义匹配
 * 4. 分类推断（兜底）
 */
export function getRequiredSkillsForExpertSync(expert: Expert): string[] {
  // 策略0：读取用户手动配置（最高优先级）
  const userConfig = loadUserConfig(expert.id);
  if (userConfig !== null) {
    console.log(`[ExpertSkillMatcher] 从用户配置匹配到技能: ${expert.id} →`, userConfig);
    return userConfig;
  }
  
  // 策略1：从映射表获取
  const mappedSkills = getSkillsFromMapping(expert.id);
  if (mappedSkills !== null) {
    return mappedSkills;
  }
  
  // 策略3：增强的语义匹配
  const semanticSkills = matchSkillsBySemanticAnalysis(expert);
  if (semanticSkills.length > 0) {
    return semanticSkills;
  }
  
  // 策略4：兜底策略（分类推断）
  return inferSkillsByCategory(expert);
}

/**
 * 手动注册专家技能映射（运行时动态添加）
 */
export function registerExpertSkills(expertId: string, skills: string[]): void {
  EXPERT_SKILL_MAP[expertId] = skills;
  console.log(`[ExpertSkillMatcher] 已注册专家技能映射: ${expertId} →`, skills);
}

/**
 * 调试工具：打印所有专家技能映射
 */
export function debugPrintAllMappings(): void {
  console.log('[ExpertSkillMatcher] 当前所有专家技能映射:');
  for (const [expertId, skills] of Object.entries(EXPERT_SKILL_MAP)) {
    console.log(`  ${expertId} →`, skills);
  }
}
