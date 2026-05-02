/**
 * ExpertCenter - 专家中心页面 v5（双 Tab 布局）
 *
 * Tab 结构：
 * - 专家中心（仓库）：agency-agents-zh 市场专家，可一键安装到「我的专家」
 * - 我的专家（本地）：已安装的专家，可召唤使用
 *
 * 固定分类（14个）：
 * 全部 / 销售商务 / 营销增长 / 产品设计 / 技术工程 / 游戏空间 /
 * 数据智能 / 内容创作 / 金融投资运营人力 / 项目质量 / 法务安全 /
 * 行业顾问 / 更多 / 其他
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight, RefreshCw, Check, Download, Search,
         Flame, Star, User, Globe, Package } from 'lucide-react';
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
import {
  loadMarketExperts,
  refreshMarketExperts,
  MARKET_ALL_CATEGORIES,
  downloadSoulContent,
  resolveNameConflict,
} from '@/lib/market-loader';

// ============================================================
// 分类和常量
// ============================================================

const PAGE_SIZE = 12;

// ============================================================
// ExpertCard - 通用卡片（复用）
// ============================================================

interface ExpertCardProps {
  expert: Expert;
  onAction: (expert: Expert) => void;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionClass?: string;
  loading: boolean;
  isInstalled?: boolean;
  isMarket?: boolean;
}

function ExpertCard({
  expert, onAction, actionLabel, actionIcon, actionClass, loading, isInstalled, isMarket
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
            <span>{isMarket ? '安装中...' : '召唤中...'}</span>
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
// 市场专家卡片（特殊处理）
// ============================================================

interface MarketCardProps {
  expert: Expert;
  onInstall: (expert: Expert) => void;
  loading: boolean;
  installedIds: Set<string>;
}

function MarketCard({ expert, onInstall, loading, installedIds }: MarketCardProps) {
  const isInstalled = installedIds.has(expert.id) ||
    installedIds.has(`market-${expert.id}`) ||
    installedIds.has(expert.name);

  return (
    <ExpertCard
      expert={expert}
      onAction={onInstall}
      actionLabel={isInstalled ? '已安装' : '安装'}
      actionIcon={isInstalled ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      loading={loading && !isInstalled}
      isInstalled={isInstalled}
      isMarket
    />
  );
}

// ============================================================
// 主组件
// ============================================================

export function ExpertCenter() {
  const navigate = useNavigate();
  const { agents, fetchAgents } = useAgentsStore();
  const { switchSession } = useChatStore();

  // ── Tab 状态 ──
  const [activeTab, setActiveTab] = useState<'market' | 'my'>('my');

  // ── 通用状态 ──
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ── 我的专家 Tab 状态 ──
  const [experts, setExperts] = useState<Expert[]>(BUILT_IN_EXPERTS);
  const [loadingExperts, setLoadingExperts] = useState(true);
  const [installedAgents, setInstalledAgents] = useState<Set<string>>(new Set());
  const updateAppliedRef = useRef(false);
  const expertsRef = useRef<Expert[]>(experts);
  expertsRef.current = experts;

  // ── 专家中心 Tab 状态 ──
  const [marketExperts, setMarketExperts] = useState<Expert[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const marketUpdateAppliedRef = useRef(false);
  const marketExpertsRef = useRef<Expert[]>([]);
  marketExpertsRef.current = marketExperts;

  // ── 分类和搜索（两个 Tab 共用一套状态）──
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('hot');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ── 过滤后的专家列表 ──
  const filteredExperts = useMemo(() => {
    const sourceList = activeTab === 'market' ? marketExperts : experts;
    const localNames = new Set(agents.map(a => a.name));

    let result = sourceList;

    // 分类过滤
    if (activeCategory === '我的专家') {
      result = result.filter(e =>
        installedAgents.has(e.id) || localNames.has(e.name)
      );
    } else if (activeCategory === '全部') {
      // 不过滤
    } else if (activeCategory === '更多') {
      // 更多：只显示固定分类之外的分类
      result = result.filter(e =>
        !MARKET_ALL_CATEGORIES.slice(0, -2).includes(e.category as any)
      );
    } else {
      result = result.filter(e => e.category === activeCategory);
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
  }, [activeTab, marketExperts, experts, activeCategory, searchQuery, sortBy, installedAgents, agents]);

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

  // ── 检查已安装 Agent ──
  const checkInstalledAgents = useCallback(async () => {
    try {
      const installed = await window.electron.ipcRenderer.invoke('agent:getInstalled') as string[];
      setInstalledAgents(new Set(installed));
    } catch (e) {
      console.warn('检查已安装 Agent 失败:', e);
    }
  }, []);

  // ── 我的专家：远程更新回调 ──
  const handleLocalUpdate = useCallback((newExperts: Expert[]) => {
    if (updateAppliedRef.current) return;
    updateAppliedRef.current = true;
    setExperts(newExperts);
  }, []);

  // ── 加载我的专家 ──
  const loadLocalExperts = useCallback(async (forceRefresh?: boolean) => {
    if (forceRefresh) {
      updateAppliedRef.current = false;
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
    checkInstalledAgents();
    if (activeTab === 'my') {
      loadLocalExperts();
    } else {
      loadMarketData();
    }
  }, [activeTab, checkInstalledAgents, loadLocalExperts, loadMarketData]);

  // ── 安装市场专家 ──
  const handleInstall = useCallback(async (expert: Expert) => {
    if (installedAgents.has(expert.id) || installedAgents.has(`market-${expert.id}`)) {
      toast.info('该专家已安装');
      return;
    }

    setLoading(true);
    setLoadingId(expert.id);
    try {
      // 1. 下载 SOUL.md
      let soulContent: string | null = null;
      if (expert.downloadUrl) {
        soulContent = await downloadSoulContent(expert.downloadUrl);
      }
      if (!soulContent) {
        toast.error('下载专家配置失败，请检查网络');
        return;
      }

      // 2. 生成不冲突的名字
      const existingNames = new Set(agents.map(a => a.name));
      const finalName = resolveNameConflict(expert.name, existingNames);

      // 3. 通过 API 创建 Agent
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean; agentId?: string }>(
        '/api/experts/summon',
        {
          method: 'POST',
          body: JSON.stringify({
            expertId: `market-${expert.id}`,
            expertName: finalName,
            soulContent,
            identityContent: '',
          }),
        }
      );
      if (!snapshot.success) throw new Error('创建专家失败');

      await fetchAgents();
      await checkInstalledAgents();

      toast.success(`已安装 ${finalName}，正在切换...`);

      // 4. 切换到该专家对话
      const createdAgent = useAgentsStore.getState().agents.find(
        a => a.name === finalName || a.id === `market-${expert.id}`
      );
      if (createdAgent) {
        switchSession(createdAgent.mainSessionKey);
        navigate('/');
      }
    } catch (err) {
      console.error('安装专家失败:', err);
      toast.error('安装失败，请重试');
    } finally {
      setLoading(false);
      setLoadingId(null);
    }
  }, [installedAgents, agents, fetchAgents, checkInstalledAgents, switchSession, navigate]);

  // ── 召唤本地专家 ──
  const handleSummon = useCallback(async (expert: Expert) => {
    setLoading(true);
    setLoadingId(expert.id);
    try {
      if (expert.downloadUrl) {
        const result = await window.electron.ipcRenderer.invoke(
          'agent:summon', expert.id, expert.downloadUrl
        ) as { success: boolean; message: string };
        if (result.success) {
          toast.success(result.message);
          await checkInstalledAgents();
          await fetchAgents();
          const agent = agents.find(a => a.id === expert.id) ||
            useAgentsStore.getState().agents.find(a => a.name === expert.name);
          if (agent) {
            switchSession(agent.mainSessionKey);
            navigate('/');
          }
          return;
        } else {
          toast.error(result.message);
        }
      }

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
  }, [agents, fetchAgents, checkInstalledAgents, switchSession, navigate]);

  // ── 计算各分类的专家数量 ──
  const getCategoryCount = useCallback((category: string): number => {
    const sourceList = activeTab === 'market' ? marketExperts : experts;
    if (category === '全部') return sourceList.length;
    if (category === '我的专家') {
      const localNames = new Set(agents.map(a => a.name));
      return sourceList.filter(e => installedAgents.has(e.id) || localNames.has(e.name)).length;
    }
    if (category === '更多') {
      return sourceList.filter(e =>
        !MARKET_ALL_CATEGORIES.slice(0, -2).includes(e.category as any)
      ).length;
    }
    return sourceList.filter(e => e.category === category).length;
  }, [activeTab, marketExperts, experts, installedAgents, agents]);

  // ── 判断当前 Tab 的加载状态 ──
  const isCurrentTabLoading = activeTab === 'market' ? loadingMarket : loadingExperts;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部固定区域 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 border-b border-border mb-6">

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 mb-4 bg-muted rounded-xl p-1 w-fit">
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
            {installedAgents.size > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {installedAgents.size}
              </span>
            )}
          </button>
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
              <span>{activeTab === 'market' ? '专业角色市场 · 开箱即用' : '我的专属专家'}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTab === 'market' ? '专家中心' : '我的专家'}
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
          ) : (
            <button
              onClick={() => loadLocalExperts(true)}
              disabled={loadingExperts}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loadingExperts && 'animate-spin')} />
              <span>{loadingExperts ? '更新中...' : '检查更新'}</span>
            </button>
          )}
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mt-4 scrollbar-hide">
          {MARKET_ALL_CATEGORIES.map(cat => {
            const count = getCategoryCount(cat);
            const isActive = activeCategory === cat;
            const isEmpty = count === 0 && cat !== '全部' && cat !== '我的专家';
            if (isEmpty) return null; // 隐藏空分类
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

        {/* 搜索和排序 */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === 'market' ? '搜索市场专家...' : '搜索我的专家...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
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
                  return (
                    <MarketCard
                      key={expert.id}
                      expert={expert}
                      onInstall={handleInstall}
                      loading={loading && loadingId === expert.id}
                      installedIds={installedAgents}
                    />
                  );
                } else {
                  return (
                    <ExpertCard
                      key={expert.id}
                      expert={expert}
                      onAction={handleSummon}
                      actionLabel={installedAgents.has(expert.id) || agents.some(a => a.name === expert.name) ? '使用中' : '召唤'}
                      actionIcon={installedAgents.has(expert.id) || agents.some(a => a.name === expert.name)
                        ? <Check className="h-4 w-4" />
                        : <Sparkles className="h-4 w-4" />}
                      loading={loading && loadingId === expert.id}
                      isInstalled={installedAgents.has(expert.id) || agents.some(a => a.name === expert.name)}
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
                  : activeCategory === '我的专家'
                    ? '你还没有安装任何专家，去专家中心找一个吧'
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
          <h4 className="text-sm font-semibold text-foreground mb-2">
            💡 {activeTab === 'market' ? '专家中心 vs 我的专家' : '我的专家 vs 普通对话'}
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {activeTab === 'market' ? '专家中心' : '我的专家'}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {activeTab === 'market'
                  ? '来自开源社区的专业角色，一键安装后即可使用，适合探索和发现新场景'
                  : '你已安装的专属专家，可以召唤并与其对话，深度定制你的工作流'}
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
