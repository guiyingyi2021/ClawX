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
  '工程部',
  '设计部',
  '营销部',
  '付费媒体部',
  '销售部',
  '金融部',
  '人力资源部',
  '法务部',
  '供应链部',
  '产品部',
  '项目管理部',
  '测试部',
  '支持部',
  '专项部',
  '空间计算部',
  '游戏开发部',
  '学术部',
  '战略部',
] as const;

// 旧分类到新部门分类的映射
export const LEGACY_CATEGORY_MAPPING: Record<string, string> = {
  '销售商务': '销售部',
  '营销增长': '营销部',
  '产品设计': '产品部', // 产品设计可能涉及产品和设计，暂归产品部
  '技术工程': '工程部',
  '游戏空间': '游戏开发部',
  '数据智能': '专项部', // 数据智能属于专项领域
  '内容创作': '营销部', // 内容创作属于营销范畴
  '金融投资': '金融部',
  '运营人力': '人力资源部',
  '项目质量': '项目管理部',
  '法务安全': '法务部',
  '行业顾问': '战略部', // 行业顾问属于战略规划
};

// 将专家分类映射到新的部门分类
export function mapExpertCategory(category: string): string {
  return LEGACY_CATEGORY_MAPPING[category] || category;
}

export type MarketCategory = typeof MARKET_FIXED_CATEGORIES[number] | '更多' | '其他' | '全部';

// 用于展示的完整分类列表（固定分类 + 更多 + 其他 + 全部）
export const MARKET_ALL_CATEGORIES = [
  '全部',
  ...MARKET_FIXED_CATEGORIES,
  '更多',
  '其他',
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
  // 优先用 _flat（新格式，由 agency-agents-zh 生成脚本产生）
  const raw = MARKET_INDEX_DATA as any;
  if (raw._flat && Array.isArray(raw._flat) && raw._flat.length > 0) {
    return raw._flat.map((e: any) => ({
      ...e,
      id: `market-${e.remoteId}`,
      downloadUrl: e.soulUrl || e.downloadUrl,
      color: hexToTailwindGradient(e.color),
      isMarket: true,
      specialties: [],
      soulContent: undefined,
      identityContent: undefined,
      userName: '用户',
    }));
  }

  // 兜底：从 categories 字段提取（当前 GitHub 上的实际格式）
  const categories = raw.categories;
  if (!categories || typeof categories !== 'object') return [];
  const result: Expert[] = [];
  for (const [category, experts] of Object.entries(categories) as any) {
    if (!Array.isArray(experts)) continue;
    for (const e of experts) {
      result.push({
        ...e,
        id: `market-${e.remoteId}`,
        downloadUrl: e.soulUrl || e.downloadUrl,
        color: hexToTailwindGradient(e.color),
        isMarket: true,
        specialties: [],
        soulContent: undefined,
        identityContent: undefined,
        userName: '用户',
        category,
      });
    }
  }
  return result;
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
  const raw = MARKET_INDEX_DATA as any;
  // 新格式：有 _flat
  if (raw._flat && Array.isArray(raw._flat)) {
    const cats: Record<string, number> = {};
    raw._flat.forEach((e: any) => {
      cats[e.category] = (cats[e.category] || 0) + 1;
    });
    return { total: raw._flat.length, categories: cats };
  }
  // 当前格式：只有 categories
  const cats: Record<string, number> = {};
  const categories = raw.categories || {};
  let total = 0;
  for (const [cat, experts] of Object.entries(categories) as any) {
    const len = Array.isArray(experts) ? experts.length : 0;
    cats[cat] = len;
    total += len;
  }
  return { total, categories: cats };
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
      id: `market-${e.remoteId}`,
      downloadUrl: e.soulUrl || e.downloadUrl,
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

let lastDownloadError = '';

export function getLastDownloadError(): string {
  return lastDownloadError;
}

/**
 * 下载单个专家的 SOUL.md 内容
 * 策略：优先用 GitHub Contents API（国内更稳定），失败再试 raw
 */
export async function downloadSoulContent(downloadUrl: string): Promise<string | null> {
  lastDownloadError = '';
  // 提取仓库内路径（去掉域名和 owner/repo/branch/ 前缀）
  const path = downloadUrl
    .replace('https://raw.githubusercontent.com/', '')
    .replace(/^[^/]+\/[^/]+\/[^/]+\//, '');

  // 优先尝试 GitHub Contents API（国内访问更稳定）
  console.log(`[downloadSoulContent] 尝试 GitHub API: ${path}`);
  let apiResult = await downloadViaGitHubAPI(path, downloadUrl);
  if (apiResult) {
    console.log(`[downloadSoulContent] GitHub API 成功，内容长度: ${apiResult.length}`);
    return apiResult;
  }

  // 回退：尝试 raw.githubusercontent.com
  console.log(`[downloadSoulContent] API 失败，尝试 raw: ${downloadUrl}`);
  try {
    const res = await fetch(downloadUrl, { cache: 'no-cache' });
    console.log(`[downloadSoulContent] raw → ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      console.log(`[downloadSoulContent] raw 成功，内容长度: ${text.length}`);
      return text;
    }
    lastDownloadError = `raw 返回 HTTP ${res.status}`;
  } catch (err: any) {
    lastDownloadError = `网络异常: ${err?.message || err}`;
    console.error(`[downloadSoulContent] raw 异常:`, err);
  }

  console.error(`[downloadSoulContent] 所有方式都失败: ${path}，原因: ${lastDownloadError}`);
  return null;
}

/**
 * 通过 GitHub API 下载文件（base64 解码）
 * 自动从原始 URL 中解析 owner/repo，不硬编码
 */
async function downloadViaGitHubAPI(
  filePath: string,
  sourceUrl?: string
): Promise<string | null> {
  // 从 sourceUrl 解析 owner/repo/ref，兜底用 agency-agents-zh + main
  let owner = 'guiyingyi2021';
  let repo = 'agency-agents-zh';
  let ref = 'main';
  if (sourceUrl) {
    // raw.githubusercontent.com 格式：/{owner}/{repo}/{ref}/{path}
    const m = sourceUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//);
    if (m) {
      owner = m[1];
      repo = m[2];
      ref = m[3];
    } else {
      // api.github.com 格式：/repos/{owner}/{repo}/...
      const m2 = sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (m2) { owner = m2[1]; repo = m2[2]; }
    }
  }
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`;
  console.log(`[downloadViaGitHubAPI] ${apiUrl}`);
  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    console.log(`[downloadViaGitHubAPI] → ${res.status}`);
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
