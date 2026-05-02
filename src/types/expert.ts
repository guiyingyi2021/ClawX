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
  category: string;  // 固定分类：内容创作 / 数据智能 / 营销增长 等
  description: string;
  emoji: string;
  color: string; // 主题色，用于卡片渐变
  /** 专长标签（内置专家有，远程专家可选） */
  specialties?: ExpertSpecialty[];
  /** 专家的 SOUL.md 核心人格内容（内置专家有，远程专家按需下载） */
  soulContent?: string;
  /** 专家的 IDENTITY.md 身份内容（内置专家有，远程专家按需下载） */
  identityContent?: string;
  /** 默认称呼用户的名字 */
  userName?: string;
  /** Agent 下载地址（tar.gz 包），用于召唤功能 */
  downloadUrl?: string;
  /** 是否有本地 SOUL.md（远程专家用） */
  hasSoul?: boolean;
  /** 是否有本地 IDENTITY.md（远程专家用） */
  hasIdentity?: boolean;
  /** 是否为远程专家 */
  isRemote?: boolean;
  /** 是否为市场专家（agency-agents-zh） */
  isMarket?: boolean;
}
