/**
 * 市场专家加载器
 *
 * 策略：读取本地索引文件 + 后台检测 GitHub 更新
 *
 * 本地索引：src/data/market-experts-index.json（由 GitHub Actions 每日自动更新）
 * GitHub 源：guiyingyi2021/agency-agents-zh
 */
import type { Expert } from '@/types/expert';
import MARKET_INDEX_DATA from '@/data/market-experts-index.json';

const MARKET_INDEX_URL = 'https://raw.githubusercontent.com/guiyingyi2021/agency-agents-zh/main/src/data/market-experts-index.json';
const CACHE_KEY = 'dclaw-market-cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

// ============================================================
// 分类配置
// ============================================================

export const MARKET_FIXED_CATEGORIES = [
  '销售商务',
  '营销增长',
  '产品设计',
  '技术工程',
  '游戏空间',
  '数据智能',
  '内容创作',
  '金融投资运营人力',
  '项目质量',
  '法务安全',
  '行业顾问',
] as const;

export type MarketCategory = typeof MARKET_FIXED_CATEGORIES[number] | '更多' | '其他' | '全部' | '我的专家';

// 用于展示的完整分类列表（固定分类 + 更多 + 其他 + 全部 + 我的专家）
export const MARKET_ALL_CATEGORIES = [
  '全部',
  ...MARKET_FIXED_CATEGORIES,
  '更多',
  '其他',
  '我的专家',
] as const;

// ============================================================
// 颜色转换
// ============================================================

function hexToTailwindGradient(hex: string | undefined): string {
  if (!hex || !hex.startsWith('#')) return hex || 'from-gray-500 to-gray-600';
  const colorMap: Record<string, string> = {
    '#10B981': 'from-green-500 to-emerald-500',
    '#3B82F6': 'from-blue-500 to-cyan-500',
    '#EF4444': 'from-red-500 to-rose-500',
    '#F59E0B': 'from-yellow-500 to-amber-500',
    '#F97316': 'from-orange-500 to-amber-500',
    '#8B5CF6': 'from-purple-500 to-violet-500',
    '#EC4899': 'from-pink-500 to-fuchsia-500',
    '#14B8A6': 'from-teal-500 to-cyan-500',
    '#6366F1': 'from-indigo-500 to-purple-500',
    '#6B7280': 'from-gray-500 to-slate-500',
  };
  return colorMap[hex.toUpperCase()] || 'from-gray-500 to-gray-600';
}

// ============================================================
// 缓存管理
// ============================================================

interface MarketCache {
  experts: Expert[];
  timestamp: number;
  version: string;
}

function getCache(): MarketCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as MarketCache;
    if (Date.now() - cache.timestamp > CACHE_TTL) return null;
    return cache;
  } catch {
    return null;
  }
}

function setCache(experts: Expert[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      experts,
      timestamp: Date.now(),
      version: (MARKET_INDEX_DATA as any).version || '1.0',
    }));
  } catch { /* ignore */ }
}

function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ============================================================
// 核心：本地索引 → Expert[]
// ============================================================

function transformMarketExperts(): Expert[] {
  const flat: Expert[] = (MARKET_INDEX_DATA as any)._flat || [];
  return flat.map((e: any) => ({
    ...e,
    color: hexToTailwindGradient(e.color),
    isMarket: true, // 标记为市场专家
    specialties: [], // 市场专家没有预定义 specialties
    soulContent: undefined,
    identityContent: undefined,
    userName: '用户',
  }));
}

// ============================================================
// 主加载函数
// ============================================================

/**
 * 加载市场专家（立即返回本地索引，后台异步检测远程更新）
 * @param onRemoteUpdate - 远程有更新时的回调
 */
export async function loadMarketExperts(
  onRemoteUpdate?: (experts: Expert[]) => void
): Promise<Expert[]> {
  // 1. 立即返回本地索引
  const localExperts = transformMarketExperts();
  const cache = getCache();
  const cachedExperts = cache?.experts || localExperts;

  // 2. 后台异步检测远程是否有新版本
  fetchRemoteIndex()
    .then(remote => {
      if (!remote) return;
      setCache(remote);
      if (remote.length !== cachedExperts.length && onRemoteUpdate) {
        onRemoteUpdate(remote);
      }
    })
    .catch(() => { /* 后台检查失败不影响已返回的本地数据 */ });

  return cachedExperts;
}

/**
 * 强制刷新市场专家索引
 */
export async function refreshMarketExperts(): Promise<Expert[]> {
  clearCache();
  return loadMarketExperts();
}

/**
 * 获取市场专家总数
 */
export function getMarketStats(): { total: number; categories: Record<string, number> } {
  const flat = (MARKET_INDEX_DATA as any)._flat || [];
  const cats: Record<string, number> = {};
  flat.forEach((e: any) => {
    cats[e.category] = (cats[e.category] || 0) + 1;
  });
  return { total: flat.length, categories: cats };
}

/**
 * 从远程获取最新索引（JSON 格式）
 */
async function fetchRemoteIndex(): Promise<Expert[] | null> {
  try {
    const res = await fetch(MARKET_INDEX_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    const json = await res.json();
    const flat: any[] = json._flat || [];
    return flat.map((e: any) => ({
      ...e,
      color: hexToTailwindGradient(e.color),
      isMarket: true,
      specialties: [],
      soulContent: undefined,
      identityContent: undefined,
      userName: '用户',
    }));
  } catch {
    return null;
  }
}

/**
 * 下载单个专家的 SOUL.md 内容
 */
export async function downloadSoulContent(downloadUrl: string): Promise<string | null> {
  try {
    // 尝试 raw.githubusercontent.com（国内可能不通）
    const res = await fetch(downloadUrl, { cache: 'no-cache' });
    if (res.ok) return res.text();

    // 回退：尝试 GitHub API 获取 base64 内容
    const path = downloadUrl
      .replace('https://raw.githubusercontent.com/', '')
      .replace(/^[^/]+\/[^/]+\/[^/]+\//, ''); // 去掉 owner/repo/branch/
    return downloadViaGitHubAPI(path);
  } catch {
    // 最后回退到 GitHub API
    const path = downloadUrl
      .replace('https://raw.githubusercontent.com/', '')
      .replace(/^[^/]+\/[^/]+\/[^/]+\//, '');
    return downloadViaGitHubAPI(path);
  }
}

/**
 * 通过 GitHub API 下载文件（base64 解码）
 */
async function downloadViaGitHubAPI(filePath: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/guiyingyi2021/agency-agents-zh/contents/${filePath}`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.content) {
      return Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 处理名称冲突：为专家生成一个不冲突的新名字
 * 策略：如果本地已有同名专家，加数字后缀
 */
export function resolveNameConflict(
  desiredName: string,
  existingNames: Set<string>
): string {
  if (!existingNames.has(desiredName)) return desiredName;
  let counter = 2;
  while (existingNames.has(`${desiredName}${counter}`)) {
    counter++;
  }
  return `${desiredName}${counter}`;
}
