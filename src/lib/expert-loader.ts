/**
 * 专家配置加载器 - 混合模式
 * 策略：立即返回缓存/内置数据，后台异步检查远程更新
 * 
 * 远程源：GitHub Raw CDN（主要）
 * 备用源：aigc.dayunzhonglian.com（已注释，需要时启用）
 */
import type { Expert } from '@/types/expert';

const CACHE_KEY = 'dclaw-experts-cache';

// ============================================================
// 远程配置 URL 配置
// ============================================================

// 主要源：GitHub Raw CDN（dclaw-private 分支）
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/guiyingyi2021/ClawX/dclaw-private';
// 新的 index.json 格式：按分类组织的专家列表
const DEFAULT_REMOTE_URL = `${GITHUB_RAW_BASE}/agents/index.json`;

// 备用源：自建服务器（已注释，需要时启用）
// const SERVER_BASE = 'https://aigc.dayunzhonglian.com';
// const DEFAULT_REMOTE_URL = `${SERVER_BASE}/experts.json`;

// ============================================================
// 缓存管理
// ============================================================

interface CacheData {
  data: Expert[];
  timestamp: number;
  version: string;
}

/**
 * 从 localStorage 读取缓存
 */
function getCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheData;
    // 清除旧缓存：如果任何专家的 name 包含英文字母（说明是旧版英文名），丢弃缓存
    const hasOldNaming = parsed.data.some(e => /[a-zA-Z]/.test(e.name));
    if (hasOldNaming) {
      console.log('[expert-loader] 检测到旧版英文名缓存，已自动清除');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * 写入 localStorage 缓存
 */
function setCache(data: Expert[], version: string): void {
  try {
    const cache: CacheData = {
      data,
      timestamp: Date.now(),
      version,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 不可用时忽略
  }
}

/**
 * 清除缓存
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ============================================================
// 远程获取
// ============================================================

/**
 * 从远程 URL 获取专家配置
 */
interface RemoteExpertConfig {
  // 旧格式（兼容）：{ version, experts: [] }
  version?: string;
  experts?: Expert[];
  // 新格式：按分类组织的专家列表 { "数据智能": [...], "营销增长": [...] }
  [category: string]: Expert[] | string | undefined;
}

/**
 * 从远程 URL 获取专家配置
 * 支持两种格式：
 * 1. 新格式：{ "数据智能": [...], "营销增长": [...] }
 * 2. 旧格式：{ version: "1.0", experts: [...] }
 */
async function fetchRemoteExperts(url: string): Promise<{ experts: Expert[]; version: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json: RemoteExpertConfig = await res.json();

    // 检测格式类型
    if (json.experts && Array.isArray(json.experts)) {
      // 旧格式：直接返回 experts 数组
      return { experts: json.experts, version: json.version ?? '1.0' };
    }

    // 新格式：按分类组织的专家列表
    const flatExperts: Expert[] = [];
    for (const [category, experts] of Object.entries(json)) {
      if (category === 'version') continue; // 跳过 version 字段
      if (!Array.isArray(experts)) continue;
      for (const expert of experts) {
        // 标记为远程专家，并添加默认值
        const basePath = `agents/${category}/${expert.id}`;
        const soulUrl = expert.hasSoul
          ? `${GITHUB_RAW_BASE}/${basePath}/SOUL.md`
          : undefined;
        flatExperts.push({
          ...expert,
          color: hexToTailwindGradient(expert.color), // 转换十六进制为 Tailwind 渐变类
          category, // 使用分类键作为 category
          isRemote: true,
          soulUrl, // SOUL.md 下载地址
          downloadUrl: soulUrl || `${GITHUB_RAW_BASE}/${basePath}/package.tar.gz`,
          // 保留远程数据中的 specialties，如果没有则默认为空数组
          specialties: expert.specialties || [],
          soulContent: expert.hasSoul ? undefined : '',
          identityContent: expert.hasIdentity ? undefined : '',
          userName: '用户',
        });
      }
    }

    if (flatExperts.length === 0) return null;
    return { experts: flatExperts, version: json.version ?? '1.0' };
  } catch {
    return null;
  }
}

/**
 * 获取远程配置 URL
 */
export function getRemoteUrl(): string {
  return DEFAULT_REMOTE_URL;
}

// ============================================================
// 主加载逻辑
// ============================================================

/**
 * 加载专家配置（混合模式）
 * 策略：立即返回内置+缓存合并数据，后台异步检查远程更新
 * @param onRemoteUpdate - 远程有更新时的回调（传入合并后的完整列表）
 */
export async function loadExperts(
  builtInExperts: Expert[],
  remoteUrl?: string,
  onRemoteUpdate?: (experts: Expert[]) => void
): Promise<Expert[]> {
  const url = remoteUrl ?? DEFAULT_REMOTE_URL;

  // 1. 立即返回：内置专家 + 缓存（无论缓存是否存在，始终包含内置）
  const cache = getCache();
  const builtInIds = new Set(builtInExperts.map(e => e.id));
  const immediateData = cache?.data
    ? [...builtInExperts, ...cache.data.filter(e => !builtInIds.has(e.id))]
    : builtInExperts;

  // 2. 后台异步检查远程是否有更新
  fetchRemoteExperts(url)
    .then(remote => {
      if (!remote) return;

      // 基于内置 + 缓存判断是否有新专家
      const existingIds = new Set(immediateData.map(e => e.id));
      const hasNewExperts = remote.experts.some(e => !existingIds.has(e.id));
      const hasMoreExperts = remote.experts.length !== immediateData.length ||
        remote.experts.some(e => !existingIds.has(e.id));

      if (!hasNewExperts && !hasMoreExperts) return;

      // 合并：内置优先，远程补充内置没有的
      const merged = [
        ...builtInExperts,
        ...remote.experts.filter(e => !builtInIds.has(e.id)),
      ];
      setCache(merged, remote.version);

      if (onRemoteUpdate) {
        onRemoteUpdate(merged);
      }
    })
    .catch(() => {
      // 后台检查失败不影响已返回的本地数据
    });

  return immediateData;
}

/**
 * 强制刷新远程配置
 */
export async function refreshExperts(
  builtInExperts: Expert[],
  remoteUrl?: string
): Promise<Expert[]> {
  const url = remoteUrl ?? DEFAULT_REMOTE_URL;
  const remote = await fetchRemoteExperts(url);
  if (remote) {
    setCache(remote.experts, remote.version);
    return remote.experts;
  }
  // 刷新失败，返回当前可用配置
  const cache = getCache();
  return cache?.data ?? builtInExperts;
}

/**
 * 获取最后更新时间
 */
export function getLastUpdateTime(): number | null {
  const cache = getCache();
  return cache?.timestamp ?? null;
}

/**
 * 获取缓存版本
 */
export function getCacheVersion(): string | null {
  const cache = getCache();
  return cache?.version ?? null;
}

// ============================================================
// Agent 下载相关
// ============================================================

/**
 * 获取 Agent 下载 URL（兼容新旧格式）
 * - 新格式：专家对象自带 downloadUrl 字段（优先使用）
 * - 旧格式兜底：按 agentId 生成 URL
 */

// ============================================================
// 颜色格式转换（远程专家 color 为十六进制，需转为 Tailwind 渐变类）
// ============================================================

/**
 * 将十六进制颜色转为最接近的 Tailwind 500 级渐变类
 * 远程专家 color 字段为 "#10B981" 格式，需要转为 "from-green-500 to-emerald-500" 格式
 */
export function hexToTailwindGradient(hex: string | undefined): string {
  if (!hex || !hex.startsWith('#')) {
    // 已经是 Tailwind 类格式，直接返回
    return hex || 'from-gray-500 to-gray-600';
  }

  // 标准化十六进制格式（大写，6位）
  const normalized = hex.toUpperCase();
  
  // 常见颜色映射表（匹配到最接近的 Tailwind 500 级）
  const colorMap: Record<string, string> = {
    '#10B981': 'from-green-500 to-emerald-500',
    '#059669': 'from-green-600 to-emerald-600',
    '#34D399': 'from-emerald-400 to-teal-400',
    '#6EE7B7': 'from-emerald-300 to-teal-300',
    '#A7F3D0': 'from-emerald-200 to-teal-200',
    '#3B82F6': 'from-blue-500 to-cyan-500',
    '#2563EB': 'from-blue-600 to-blue-500',
    '#60A5FA': 'from-blue-400 to-sky-400',
    '#93C5FD': 'from-blue-300 to-sky-300',
    '#F97316': 'from-orange-500 to-amber-500',
    '#EA580C': 'from-orange-600 to-orange-500',
    '#FB923C': 'from-orange-400 to-amber-400',
    '#FDBA74': 'from-orange-300 to-amber-300',
    '#FF6B6B': 'from-pink-500 to-rose-500',
    '#E11D48': 'from-pink-600 to-rose-600',
    '#F87171': 'from-red-400 to-pink-400',
    '#EAB308': 'from-yellow-500 to-orange-500',
    '#CA8A04': 'from-yellow-600 to-yellow-500',
    '#FACC15': 'from-yellow-400 to-amber-400',
    '#8B5CF6': 'from-purple-500 to-violet-500',
    '#7C3AED': 'from-purple-600 to-violet-600',
    '#A78BFA': 'from-purple-400 to-violet-400',
    '#C4B5FD': 'from-purple-300 to-violet-300',
    '#EC4899': 'from-pink-500 to-fuchsia-500',
    '#D946EF': 'from-fuchsia-500 to-purple-500',
    '#F43F5E': 'from-rose-500 to-pink-500',
    '#FB7185': 'from-rose-400 to-pink-400',
  };

  return colorMap[normalized] || 'from-gray-500 to-gray-600';
}
export function getAgentDownloadUrl(agentId: string, downloadUrl?: string): string {
  // 新格式：使用专家对象自带的 downloadUrl
  if (downloadUrl) return downloadUrl;

  // 旧格式兜底：从 agentId 提取远程专家 ID（去掉 "remote-" 前缀）
  const remoteId = agentId.startsWith('remote-') ? agentId.slice(7) : agentId;
  return `${GITHUB_RAW_BASE}/agents/${remoteId}/package.tar.gz`;
}

/**
 * 检查是否为 GitHub CDN 源
 */
export function isGitHubSource(): boolean {
  return DEFAULT_REMOTE_URL.includes('raw.githubusercontent.com');
}
