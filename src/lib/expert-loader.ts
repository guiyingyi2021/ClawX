/**
 * 专家配置加载器 - 混合模式
 * 优先级：远程配置 > 本地缓存 > 内置配置
 * 
 * 远程源：GitHub Raw CDN（主要）
 * 备用源：aigc.dayunzhonglian.com（已注释，需要时启用）
 */
import type { Expert } from '@/types/expert';

interface RemoteExpertConfig {
  version: string;
  updated_at: string;
  experts: Expert[];
}

const CACHE_KEY = 'dclaw-experts-cache';
const CACHE_TTL = 1000 * 60 * 30; // 30 分钟缓存

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
    return JSON.parse(raw) as CacheData;
  } catch {
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
        flatExperts.push({
          ...expert,
          category, // 使用分类键作为 category
          isRemote: true,
          // 远程专家没有预加载的内容
          specialties: [],
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
 * 优先级：远程 > 缓存 > 内置
 */
export async function loadExperts(
  builtInExperts: Expert[],
  remoteUrl?: string
): Promise<Expert[]> {
  const url = remoteUrl ?? DEFAULT_REMOTE_URL;

  // 1. 尝试远程获取
  const remote = await fetchRemoteExperts(url);
  if (remote) {
    setCache(remote.experts, remote.version);
    return remote.experts;
  }

  // 2. 远程失败，尝试缓存
  const cache = getCache();
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  // 3. 都失败，返回内置
  return builtInExperts;
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
