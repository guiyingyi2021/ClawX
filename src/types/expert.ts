/**
 * 专家中心类型定义
 */
export interface ExpertSpecialty {
  label: string;
  emoji: string;
}

export interface Expert {
  id: string;
  name: string;
  role: string;
  description: string;
  emoji: string;
  color: string; // 主题色，用于卡片渐变
  specialties: ExpertSpecialty[];
  /** 专家的 SOUL.md 核心人格内容 */
  soulContent: string;
  /** 专家的 IDENTITY.md 身份内容 */
  identityContent: string;
  /** 默认称呼用户的名字 */
  userName: string;
}
