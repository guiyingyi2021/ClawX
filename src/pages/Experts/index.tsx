/**
 * ExpertCenter - 专家中心页面 v7（三 Tab 布局，统一召唤逻辑）
 *
 * Tab 结构：
 * - 我的专家：内置6个专家 + 远程自建专家
 * - 使用中：所有已召唤的 Agent（内置+远程），点击继续对话
 * - 专家中心：远程精选市场专家
 *
 * 召唤 = 下载 SOUL.md + 创建 Agent + 切换对话，一键完成
 *
 * 固定分类（13个）：
 * 全部 / 产品设计 / 技术工程 / 游戏空间 / 数据智能 /
 * 营销增长 / 内容创作 / 销售商务 / 金融投资 / 运营人力 /
 * 项目质量 / 法务安全 / 行业顾问
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight, RefreshCw, Check, Search,
         Flame, Star, User, Globe, Package, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPERTS as BUILT_IN_EXPERTS } from './experts.config';
import type { Expert } from '@/types/expert';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { hostApiFetch } from '@/lib/host-api';
import type { AgentsSnapshot } from '@/types/agent';
import { loadExperts, refreshExperts, hexToTailwindGradient } from '@/lib/expert-loader';
import { convertOpenClaw } from '@/lib/convert-openclaw';
import {
  loadMarketExperts,
  refreshMarketExperts,
  MARKET_ALL_CATEGORIES,
  downloadSoulContent,
  getLastDownloadError,
} from '@/lib/market-loader';

// ============================================================
// 分类和常量
// ============================================================

const PAGE_SIZE = 12;

// ============================================================
// ExpertCard - 通用卡片（我的专家 & 使用中 共用）
// ============================================================

interface ExpertCardProps {
  expert: Expert;
  onAction: (expert: Expert) => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionClass?: string;
  loading: boolean;
  isInstalled?: boolean;
}

function ExpertCard({
  expert, onAction, actionLabel, actionIcon, actionClass, loading, isInstalled
}: ExpertCardProps) {
  const colorClass = typeof expert.color === 'string' && expert.color.startsWith('from-')
    ? expert.color
    : hexToTailwindGradient(expert.color as string);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* 已安装标记 */}
      {isInstalled && (
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md z-10">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}

      {/* 头部：头像 + 名字 */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-md',
            'bg-gradient-to-br',
            colorClass,
          )}
        >
          {expert.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground truncate">{expert.name}</h3>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">{expert.role}</p>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1 line-clamp-3">
        {expert.description}
      </p>

      {/* 擅长领域标签 */}
      {(expert.specialties || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {(expert.specialties || []).map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <button
        onClick={() => onAction(expert)}
        disabled={loading}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
          'bg-gradient-to-r text-white shadow-md',
          isInstalled
            ? 'from-green-500 to-emerald-500'
            : actionClass || colorClass,
          'hover:shadow-lg hover:opacity-95 active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>召唤中...</span>
          </>
        ) : (
          <>
            {actionIcon}
            <span>{actionLabel}</span>
            {!isInstalled && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================
// 市场专家卡片（特殊处理：已安装时不重复召唤）
// ============================================================

interface MarketCardProps {
  expert: Expert;
  onSummon: (expert: Expert) => void;
  loading: boolean;
  installedIds: Set<string>;
}

function MarketCard({ expert, onSummon, loading, installedIds }: MarketCardProps) {
  const isInstalled = installedIds.has(expert.id);

  const handleAction = () => {
    // 点"召唤中"按钮：走 handleSummon 的去重逻辑
    //（handleSummon 内部会检查已召唤则直接切换对话）
    onSummon(expert);
  };

  return (
    <ExpertCard
      expert={expert}
      onAction={handleAction}
      actionLabel={isInstalled ? '召唤中' : '召唤'}
      actionIcon={isInstalled ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      loading={loading && !isInstalled}
      isInstalled={isInstalled}
    />
  );
}

// ============================================================
// 主组件
// ============================================================

export function ExpertCenter() {
  const navigate = useNavigate();
  const { agents, fetchAgents } = useAgentsStore();
  const { switchSession, newSessionForAgent } = useChatStore();

  // 自动清理旧版内置 agent（只执行一次）
  // 旧版内置专家的英文 ID 前缀，新版已全部改为中文 ID
  const LEGACY_PREFIXES = [
    'content-creator',
    'data-analyst',
    'e-commerce-expert',
    'sales-coach',
    'douyin-strategist',
    'brand-strategist',
  ];
  const isLegacyAgent = (id: string) =>
    LEGACY_PREFIXES.some(p => id === p || id.startsWith(p + '-'));
  const cleanedRef = useRef(false);
  useEffect(() => {
    if (cleanedRef.current) return;
    const hasLegacy = agents.some(a => isLegacyAgent(a.id));
    if (!hasLegacy) {
      cleanedRef.current = true;
      return;
    }

    cleanedRef.current = true;
    (async () => {
      let cleaned = 0;
      for (const a of agents) {
        if (isLegacyAgent(a.id)) {
          try {
            await hostApiFetch(`/api/agents/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
            cleaned++;
          } catch { /* ignore */ }
        }
      }
      if (cleaned > 0) {
        toast.info(`已清理 ${cleaned} 个旧版 agent，正在刷新...`);
        await fetchAgents();
      }
    })();
  }, [agents]);

  // ── Tab 状态（三个 Tab）──
  const [activeTab, setActiveTab] = useState<'my' | 'summoned' | 'market'>('my');

  // ── 通用状态 ──
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ── 我的专家 Tab 状态 ──
  const [experts, setExperts] = useState<Expert[]>(BUILT_IN_EXPERTS);
  const [loadingExperts, setLoadingExperts] = useState(true);
  const installedAgents = useMemo(() => {
    const ids = new Set<string>();
    agents.forEach(a => {
      ids.add(a.id);
    });
    return ids;
  }, [agents]);
  const updateAppliedRef = useRef(false);
  const expertsRef = useRef<Expert[]>(experts);
  expertsRef.current = experts;

  // ── 专家中心 Tab 状态 ──
  const [marketExperts, setMarketExperts] = useState<Expert[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const marketUpdateAppliedRef = useRef(false);
  const marketExpertsRef = useRef<Expert[]>([]);
  marketExpertsRef.current = marketExperts;

  // ── 追踪已召唤的 agent ID 和召唤时间 ──
  const [summonedAgentIds, setSummonedAgentIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dclaw-summoned-agents');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [summonedTimestamps, setSummonedTimestamps] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dclaw-summoned-timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // 持久化
  const saveSummonedData = useCallback((ids: Set<string>, timestamps: Record<string, number>) => {
    try {
      localStorage.setItem('dclaw-summoned-agents', JSON.stringify([...ids]));
      localStorage.setItem('dclaw-summoned-timestamps', JSON.stringify(timestamps));
    } catch {}
  }, []);

  // ── 使用中 Tab：只显示真正被召唤过的 agent，按召唤时间倒序 ──
  const summonedExperts = useMemo<Expert[]>(() => {
    const list = agents
      .filter(agent => summonedAgentIds.has(agent.id))
      .sort((a, b) => {
        // 按召唤时间戳倒序（最近召唤的排前面）
        const ta = summonedTimestamps[a.id] || 0;
        const tb = summonedTimestamps[b.id] || 0;
        return tb - ta;
      })
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        role: '专家',
        category: '使用中',
        description: '已召唤的专家，点击继续对话',
        emoji: '🤖',
        color: '#6366f1',
        userName: agent.name,
        soulContent: '',
        identityContent: '',
      }));
    return list;
  }, [agents, summonedAgentIds, summonedTimestamps]);

  // ── 分类和搜索（三个 Tab 共用一套状态）──
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('hot');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ── 固定分类（不含"我的专家"，使用中 tab 展示所有已召唤）──
  const ALL_CATEGORIES = MARKET_ALL_CATEGORIES;

  // ── 过滤后的专家列表 ──
  const filteredExperts = useMemo(() => {
    let result: Expert[];

    if (activeTab === 'summoned') {
      // 使用中 Tab：展示所有已召唤的 Agent
      result = summonedExperts;
    } else {
      result = activeTab === 'market' ? marketExperts : experts;
    }

    // 分类过滤（使用中 Tab 不过滤分类，展示所有已召唤）
    if (activeTab !== 'summoned') {
      if (activeCategory === '全部') {
        // 不过滤
      } else if (activeCategory === '更多') {
        result = result.filter(e =>
          !ALL_CATEGORIES.slice(0, -2).includes(e.category as any)
        );
      } else {
        result = result.filter(e => e.category === activeCategory);
      }
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.role.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        (e.specialties || []).some(s =>
          s.label.toLowerCase().includes(query) ||
          s.emoji.includes(query)
        )
      );
    }

    // 排序
    if (sortBy === 'latest') {
      result = [...result].sort((a, b) => b.id.localeCompare(a.id));
    }

    return result;
  }, [activeTab, summonedExperts, marketExperts, experts, activeCategory, searchQuery, sortBy, ALL_CATEGORIES]);

  const visibleExperts = useMemo(() => {
    return filteredExperts.slice(0, visibleCount);
  }, [filteredExperts, visibleCount]);

  // ── 无限滚动 ──
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < filteredExperts.length) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredExperts.length));
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [filteredExperts.length, visibleCount]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, activeCategory, searchQuery, sortBy]);

  // ── 我的专家：远程更新回调 ──
  const handleLocalUpdate = useCallback((newExperts: Expert[]) => {
    if (updateAppliedRef.current) return;
    updateAppliedRef.current = true;
    // 合并：内置专家优先（保留中文名），远程专家补充内置没有的
    const builtInIds = new Set(BUILT_IN_EXPERTS.map(e => e.id));
    const remoteOnly = newExperts.filter(e => !builtInIds.has(e.id));
    setExperts([...BUILT_IN_EXPERTS, ...remoteOnly]);
  }, []);

  // ── 加载我的专家 ──
  const loadLocalExperts = useCallback(async (forceRefresh?: boolean) => {
    if (forceRefresh) {
      setLoadingExperts(true);
      try {
        const data = await refreshExperts(BUILT_IN_EXPERTS);
        setExperts(data);
        toast.success('专家列表已更新');
      } catch {
        toast.error('加载失败，使用内置默认配置');
      } finally {
        setLoadingExperts(false);
      }
    } else {
      // 重置 ref，允许新的远程更新回调触发
      updateAppliedRef.current = false;
      setLoadingExperts(true);
      try {
        const data = await loadExperts(BUILT_IN_EXPERTS, undefined, handleLocalUpdate);
        setExperts(data);
      } finally {
        setLoadingExperts(false);
      }
    }
  }, [handleLocalUpdate]);

  // ── 加载专家中心 ──
  const handleMarketUpdate = useCallback((newExperts: Expert[]) => {
    if (marketUpdateAppliedRef.current) return;
    marketUpdateAppliedRef.current = true;
    setMarketExperts(newExperts);
  }, []);

  const loadMarketData = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const data = await loadMarketExperts(handleMarketUpdate);
      setMarketExperts(data);
    } finally {
      setLoadingMarket(false);
    }
  }, [handleMarketUpdate]);

  // ── 初始化加载 ──
  useEffect(() => {
    if (activeTab === 'my') {
      loadLocalExperts();
    } else if (activeTab === 'market') {
      loadMarketData();
    }
    // activeTab === 'summoned' 时无需加载，数据来自 agents store
  }, [activeTab, loadLocalExperts, loadMarketData]);

  // ── 召唤专家（统一逻辑：本地 + 市场 + 远程）──
  const handleSummon = useCallback(async (expert: Expert) => {
    setLoading(true);
    setLoadingId(expert.id);
    try {
      // 市场专家 or 远程专家：下载 SOUL.md → 拆分 → API 路径
      if ((expert.isMarket || expert.isRemote) && (expert.downloadUrl || expert.soulUrl)) {
        // 去重：已召唤过 → 为该 agent 新建一个对话线程
        if (summonedAgentIds.has(expert.id)) {
          const existing = agents.find(a => a.id === expert.id || a.name === expert.name);
          if (existing) {
            newSessionForAgent(existing);
            navigate('/');
            setLoading(false);
            setLoadingId(null);
            return;
          }
        }
        const url = expert.downloadUrl || expert.soulUrl;
        console.log(`[handleSummon] 开始下载专家 ${expert.name} 配置: ${url}`);
        const soulContent = await downloadSoulContent(url!);
        if (!soulContent) {
          const errReason = getLastDownloadError();
          console.error(`[handleSummon] 下载失败: ${expert.name} → ${url}`, errReason);
          toast.error(`下载 ${expert.name} 失败。${errReason || '请检查网络'}\nURL: ${url}`);
          return;
        }
        console.log(`[handleSummon] 下载成功，内容长度: ${soulContent.length}`);
        const { soulContent: soul, agentsContent, identityContent } = convertOpenClaw(
          soulContent,
          expert.name
        );
        const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean; agentId?: string }>(
          '/api/experts/summon',
          {
            method: 'POST',
            body: JSON.stringify({
              expertId: expert.id,
              expertName: expert.name,
              soulContent: soul,
              agentsContent,
              identityContent,
            }),
          }
        );
        if (!snapshot.success) throw new Error('召唤专家失败');
        await fetchAgents();
        // 获取后端返回的真实 agentId，用于精确匹配
        const agentId = snapshot.agentId;
        const createdAgent = agentId
          ? useAgentsStore.getState().agents.find(a => a.id === agentId)
          : undefined;
        const realAgentId = createdAgent?.id || agentId;
        // 记录已召唤（含时间戳）：同时存 expert.id 和真实 agentId
        const now = Date.now();
        const newIds = new Set(
          [...summonedAgentIds, expert.id, realAgentId].filter(Boolean) as string[]
        );
        const newTs = { ...summonedTimestamps, [expert.id]: now };
        setSummonedAgentIds(newIds);
        setSummonedTimestamps(newTs);
        saveSummonedData(newIds, newTs);
        toast.success(`已召唤 ${expert.name}，正在切换...`);
        if (createdAgent) {
          switchSession(createdAgent.mainSessionKey);
          navigate('/');
        }
        return;
      }

      // 本地专家：有 tar.gz downloadUrl → IPC 路径
      if (expert.downloadUrl && !expert.downloadUrl.startsWith('http')) {
        const result = await window.electron.ipcRenderer.invoke(
          'agent:summon', expert.id, expert.downloadUrl
        ) as { success: boolean; message: string };
        if (result.success) {
          toast.success(result.message);
          await fetchAgents();
          const agent = agents.find(a => a.id === expert.id) ||
            useAgentsStore.getState().agents.find(a => a.name === expert.name);
          // 记录已召唤（含时间戳）：同时存 expert.id 和真实 agent.id
          const now = Date.now();
          const newIds = new Set(
            [...summonedAgentIds, expert.id, agent?.id].filter(Boolean) as string[]
          );
          const newTs = { ...summonedTimestamps, [expert.id]: now };
          setSummonedAgentIds(newIds);
          setSummonedTimestamps(newTs);
          saveSummonedData(newIds, newTs);
          if (agent) {
            switchSession(agent.mainSessionKey);
            navigate('/');
          }
          return;
        } else {
          toast.error(result.message);
        }
      }

      // 兜底：直接用本地 soulContent 创建（内置专家，无 downloadUrl）
      let agent = agents.find(a => a.id === expert.id || a.name === expert.name);
      if (!agent) {
        const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
          '/api/experts/summon',
          {
            method: 'POST',
            body: JSON.stringify({
              expertId: expert.id,
              expertName: expert.name,
              soulContent: expert.soulContent,
              identityContent: expert.identityContent,
            }),
          }
        );
        if (!snapshot.success) throw new Error('召唤专家失败');
        await fetchAgents();
        const createdAgentId = (snapshot as any).agentId;
        agent = useAgentsStore.getState().agents.find(
          a => a.id === createdAgentId || a.name === expert.name
        );
        // 记录已召唤（含时间戳）：同时存 expert.id 和真实 agent.id
        const now = Date.now();
        const newIds3 = new Set(
          [...summonedAgentIds, expert.id, createdAgentId].filter(Boolean) as string[]
        );
        const newTs3 = { ...summonedTimestamps, [expert.id]: now };
        setSummonedAgentIds(newIds3);
        setSummonedTimestamps(newTs3);
        saveSummonedData(newIds3, newTs3);
      }
      if (!agent) {
        toast.error('创建专家失败');
        return;
      }
      switchSession(agent.mainSessionKey);
      toast.success(`已切换到 ${expert.name} · ${expert.role}`);
      navigate('/');
    } catch (err) {
      console.error('召唤专家失败:', err);
      toast.error('召唤失败，请重试');
    } finally {
      setLoading(false);
      setLoadingId(null);
    }
  }, [agents, fetchAgents, switchSession, navigate]);

  // ── 使用中 Tab：为该 agent 新建一个对话线程 ──
  const handleUseAgent = useCallback(async (expert: Expert) => {
    const agent = agents.find(a => a.id === expert.id || a.name === expert.name);
    if (!agent) {
      toast.error('未找到该专家，请重新召唤');
      return;
    }
    newSessionForAgent(agent);
    navigate('/');
  }, [agents, newSessionForAgent, navigate]);

  // ── 计算各分类的专家数量 ──
  const getCategoryCount = useCallback((category: string): number => {
    if (activeTab === 'summoned') {
      return category === '全部' ? summonedExperts.length : 0;
    }
    const sourceList = activeTab === 'market' ? marketExperts : experts;
    if (category === '全部') return sourceList.length;
    if (category === '更多') {
      return sourceList.filter(e =>
        !ALL_CATEGORIES.slice(0, -2).includes(e.category as any)
      ).length;
    }
    return sourceList.filter(e => e.category === category).length;
  }, [activeTab, summonedExperts, marketExperts, experts, ALL_CATEGORIES]);

  // ── 判断当前 Tab 的加载状态 ──
  const isCurrentTabLoading = activeTab === 'market'
    ? loadingMarket
    : activeTab === 'my'
      ? loadingExperts
      : false; // 使用中 Tab 不需要加载

  // ── 当前 Tab 的标题 ──
  const tabTitle = activeTab === 'market' ? '专家中心'
    : activeTab === 'summoned' ? '使用中'
      : '我的专家';

  const tabSubtitle = activeTab === 'market' ? '专业角色市场 · 开箱即用'
    : activeTab === 'summoned' ? '已召唤专家 · 继续对话'
      : '我的专属专家';

  // ── 判断专家是否已安装（用于按钮状态）──
  // 检查两个来源：
  // 1. summonedAgentIds：召唤成功后同步更新，优先使用
  // 2. installedAgents：agents store 异步更新，作为持久化状态的兜底
  const isExpertInstalled = useCallback((expert: Expert): boolean => {
    return summonedAgentIds.has(expert.id) || installedAgents.has(expert.id);
  }, [summonedAgentIds, installedAgents]);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部固定区域 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 border-b border-border mb-6">

        {/* Tab 切换（三 Tab） */}
        <div className="flex items-center gap-1 mb-4 bg-muted rounded-xl p-1 w-fit">
          {/* 我的专家 Tab */}
          <button
            onClick={() => setActiveTab('my')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'my'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Package className="h-4 w-4" />
            <span>我的专家</span>
          </button>
          {/* 使用中 Tab */}
          <button
            onClick={() => setActiveTab('summoned')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'summoned'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserCheck className="h-4 w-4" />
            <span>使用中</span>
            {summonedExperts.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {summonedExperts.length}
              </span>
            )}
          </button>
          {/* 专家中心 Tab */}
          <button
            onClick={() => setActiveTab('market')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'market'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe className="h-4 w-4" />
            <span>专家中心</span>
            {marketExperts.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {marketExperts.length}
              </span>
            )}
          </button>
        </div>

        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <Zap className="h-3 w-3" />
              <span>{tabSubtitle}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {tabTitle}
            </h1>
          </div>

          {/* 刷新按钮（当前 Tab） */}
          {activeTab === 'market' ? (
            <button
              onClick={() => refreshMarketExperts().then(d => { setMarketExperts(d); toast.success('索引已刷新'); }).catch(() => toast.error('刷新失败'))}
              disabled={loadingMarket}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingMarket && 'animate-spin')} />
              <span>{loadingMarket ? '加载中...' : '刷新索引'}</span>
            </button>
          ) : activeTab === 'my' ? (
            <button
              onClick={() => loadLocalExperts(true)}
              disabled={loadingExperts}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingExperts && 'animate-spin')} />
              <span>{loadingExperts ? '更新中...' : '检查更新'}</span>
            </button>
          ) : (
            // 使用中 Tab 无刷新按钮
            <div />
          )}
        </div>

        {/* 分类标签（使用中 Tab 不显示分类） */}
        {activeTab !== 'summoned' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mt-4 scrollbar-hide">
            {ALL_CATEGORIES.map(cat => {
              const count = getCategoryCount(cat);
              const isActive = activeCategory === cat;
              const isEmpty = count === 0 && cat !== '全部';
              if (isEmpty) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <span>{cat}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      isActive ? 'bg-primary-foreground/20' : 'bg-background'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 搜索和排序 */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={
                activeTab === 'market' ? '搜索市场专家...'
                  : activeTab === 'summoned' ? '搜索已召唤的专家...'
                    : '搜索我的专家...'
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {activeTab !== 'summoned' && (
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setSortBy('hot')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  sortBy === 'hot'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Flame className="h-4 w-4" /><span>最热</span>
              </button>
              <button
                onClick={() => setSortBy('latest')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  sortBy === 'latest'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Star className="h-4 w-4" /><span>最新</span>
              </button>
            </div>
          )}
        </div>

        {/* 筛选结果提示 */}
        {(activeCategory !== '全部' || searchQuery) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{activeCategory}</span>
            {searchQuery && <><span>·</span><span>搜索 "{searchQuery}"</span></>}
            <span>·</span><span>{filteredExperts.length} 个专家</span>
          </div>
        )}
      </div>

      {/* 加载骨架屏 */}
      {isCurrentTabLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-muted" />
                <div className="flex-1"><div className="h-4 w-20 rounded bg-muted mb-2" /><div className="h-3 w-32 rounded bg-muted" /></div>
              </div>
              <div className="h-3 w-full rounded bg-muted mb-2" /><div className="h-3 w-3/4 rounded bg-muted mb-4" />
              <div className="flex gap-1.5 mb-5"><div className="h-6 w-16 rounded-full bg-muted" /><div className="h-6 w-16 rounded-full bg-muted" /></div>
              <div className="h-10 w-full rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* 专家卡片网格 */}
      {!isCurrentTabLoading && (
        <>
          {visibleExperts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleExperts.map(expert => {
                if (activeTab === 'market') {
                  // 专家中心 Tab
                  return (
                    <MarketCard
                      key={expert.id}
                      expert={expert}
                      onSummon={handleSummon}
                      loading={loading && loadingId === expert.id}
                      installedIds={installedAgents}
                    />
                  );
                } else if (activeTab === 'summoned') {
                  // 使用中 Tab：按钮固定为"召唤中"，点击继续对话
                  return (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      onAction={handleUseAgent}
                      actionLabel="召唤中"
                      actionIcon={<Check className="h-4 w-4" />}
                      loading={false}
                      isInstalled={true}
                    />
                  );
                } else {
                  // 我的专家 Tab
                  const installed = isExpertInstalled(expert);
                  return (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      onAction={handleSummon}
                      actionLabel={installed ? '召唤中' : '召唤'}
                      actionIcon={installed ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      loading={loading && loadingId === expert.id}
                      isInstalled={installed}
                    />
                  );
                }
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? '未找到匹配的专家' : '该分类下暂无专家'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {searchQuery
                  ? `没有找到与 "${searchQuery}" 相关的专家`
                  : activeTab === 'summoned'
                    ? '你还没有召唤任何专家，去专家中心找一个吧'
                    : activeTab === 'my'
                      ? '你还没有召唤任何专家，去专家中心找一个吧'
                      : '敬请期待更多专家入驻'}
              </p>
            </div>
          )}

          {/* 无限滚动触发 */}
          {visibleExperts.length < filteredExperts.length && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>加载更多...</span>
              </div>
            </div>
          )}

          {/* 已加载全部 */}
          {!isCurrentTabLoading && visibleExperts.length > 0 && visibleExperts.length >= filteredExperts.length && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              已展示全部 {filteredExperts.length} 个专家
            </div>
          )}
        </>
      )}

      {/* 底部说明 */}
      {!isCurrentTabLoading && visibleExperts.length > 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-5">
          <h4 className="text-sm font-semibold text-foreground mb-2">💡 {tabTitle} 使用说明</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">{tabTitle}</p>
              <p className="text-xs text-muted-foreground/80">
                {activeTab === 'summoned'
                  ? '已召唤的专家，点击即可继续对话，深入探讨你的问题'
                  : activeTab === 'my'
                    ? '你已召唤的专属专家，可以继续与其对话，深度定制你的工作流'
                    : '来自开源社区的专业角色，一键召唤即可使用，适合探索和发现新场景'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">普通对话</p>
              <p className="text-xs text-muted-foreground/80">
                通用 AI 助手，回答各类问题，适合日常咨询
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
