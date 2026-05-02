/**
 * ExpertCenter - 专家中心页面 v4
 * 
 * 布局：标题 + 固定分类标签 + 搜索排序 + 无限滚动卡片列表
 * 
 * 固定分类：全部 / 产品设计 / 技术工程 / 游戏空间 / 数据智能 / 
 *          营销增长 / 内容创作 / 销售商务 / 金融投资运营人力 / 
 *          项目质量 / 法务安全 / 行业顾问
 * 
 * 远程配置 URL: GitHub Raw CDN
 * https://raw.githubusercontent.com/guiyingyi2021/ClawX/dclaw-private/agents/experts.json
 * 
 * 召唤方式（优先级）：
 * 1. downloadUrl（GitHub CDN zip）→ 下载并安装 Agent
 * 2. soulContent + identityContent（API）→ 通过 API 创建 Agent
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight, RefreshCw, Check, Download, Search, Flame, Star, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPERTS as BUILT_IN_EXPERTS } from './experts.config';
import type { Expert } from '@/types/expert';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { hostApiFetch } from '@/lib/host-api';
import type { AgentsSnapshot } from '@/types/agent';
import { loadExperts, refreshExperts } from '@/lib/expert-loader';

// 固定分类列表（按你提供的顺序）
const FIXED_CATEGORIES = [
  '全部',
  '产品设计',
  '技术工程',
  '游戏空间',
  '数据智能',
  '营销增长',
  '内容创作',
  '销售商务',
  '金融投资运营人力',
  '项目质量',
  '法务安全',
  '行业顾问',
];

interface ExpertCardProps {
  expert: Expert;
  onSummon: (expert: Expert) => void;
  loading: boolean;
  isInstalled: boolean;
}

function ExpertCard({ expert, onSummon, loading, isInstalled }: ExpertCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* 已安装标记 */}
      {isInstalled && (
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}

      {/* 头部：头像 + 名字 */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-md',
            'bg-gradient-to-br',
            expert.color,
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
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
        {expert.description}
      </p>

      {/* 擅长领域标签 */}
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

      {/* 召唤按钮 */}
      <button
        onClick={() => onSummon(expert)}
        disabled={loading}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
          'bg-gradient-to-r text-white shadow-md',
          isInstalled ? 'from-green-500 to-emerald-500' : expert.color,
          'hover:shadow-lg hover:opacity-95 active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>召唤中...</span>
          </>
        ) : isInstalled ? (
          <>
            <Check className="h-4 w-4" />
            <span>已召唤 · 使用中</span>
          </>
        ) : expert.downloadUrl ? (
          <>
            <Download className="h-4 w-4" />
            <span>立即召唤</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>立即召唤</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </div>
  );
}

const PAGE_SIZE = 12;

export function ExpertCenter() {
  const navigate = useNavigate();
  const { agents, fetchAgents } = useAgentsStore();
  const { switchSession } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [experts, setExperts] = useState<Expert[]>(BUILT_IN_EXPERTS);
  const [loadingExperts, setLoadingExperts] = useState(true);
  const [installedAgents, setInstalledAgents] = useState<Set<string>>(new Set());

  // 远程更新相关状态
  const [hasUpdates, setHasUpdates] = useState(false);
  const [pendingExperts, setPendingExperts] = useState<Expert[]>([]);
  const [newExpertCount, setNewExpertCount] = useState(0);

  // 分类和搜索状态
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('hot');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 已安装的专家
  const installedExperts = useMemo(() => {
    return experts.filter(e => 
      installedAgents.has(e.id) || agents.some(a => a.name === e.name)
    );
  }, [experts, installedAgents, agents]);

  // 过滤后的专家列表（按固定分类过滤）
  const filteredExperts = useMemo(() => {
    let result = experts;

    // 分类过滤（使用 expert.category 字段）
    if (activeCategory === '我的专家') {
      result = installedExperts;
    } else if (activeCategory !== '全部') {
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
        ) ||
        e.category.toLowerCase().includes(query)  // 也可以搜索分类名
      );
    }

    // 排序
    if (sortBy === 'latest') {
      result = [...result].sort((a, b) => b.id.localeCompare(a.id));
    }

    return result;
  }, [experts, activeCategory, searchQuery, sortBy, installedExperts]);

  // 可见的专家（分页）
  const visibleExperts = useMemo(() => {
    return filteredExperts.slice(0, visibleCount);
  }, [filteredExperts, visibleCount]);

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredExperts.length) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredExperts.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [filteredExperts.length, visibleCount]);

  // 重置可见数量当筛选条件变化时
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, searchQuery, sortBy]);

  // 检查已安装的 Agent
  const checkInstalledAgents = useCallback(async () => {
    try {
      const installed = await window.electron.ipcRenderer.invoke('agent:getInstalled') as string[];
      setInstalledAgents(new Set(installed));
    } catch (e) {
      console.warn('检查已安装 Agent 失败:', e);
    }
  }, []);

  // 远程有更新时的回调
  const handleRemoteUpdate = useCallback((newExperts: Expert[]) => {
    const currentIds = new Set(experts.map(e => e.id));
    const newCount = newExperts.filter(e => !currentIds.has(e.id)).length;
    setPendingExperts(newExperts);
    setHasUpdates(true);
    setNewExpertCount(newCount > 0 ? newCount : newExperts.length - experts.length);
  }, [experts]);

  // 应用挂起的更新
  const applyUpdates = useCallback(() => {
    if (pendingExperts.length > 0) {
      setExperts(pendingExperts);
      setHasUpdates(false);
      setPendingExperts([]);
      setNewExpertCount(0);
      toast.success('专家列表已更新');
    }
  }, [pendingExperts]);

  const load = useCallback(async (forceRefresh?: boolean) => {
    if (forceRefresh) {
      // 手动刷新：阻塞式，直接应用结果
      setLoadingExperts(true);
      try {
        const data = await refreshExperts(BUILT_IN_EXPERTS);
        setExperts(data);
        setHasUpdates(false);
        setPendingExperts([]);
        toast.success('专家列表已更新');
      } catch (e) {
        toast.error('加载专家配置失败，使用内置默认配置');
      } finally {
        setLoadingExperts(false);
      }
    } else {
      // 初始加载：立即返回缓存，后台检测更新
      setLoadingExperts(true);
      try {
        const data = await loadExperts(BUILT_IN_EXPERTS, undefined, handleRemoteUpdate);
        setExperts(data);
      } finally {
        setLoadingExperts(false);
      }
    }
  }, [handleRemoteUpdate]);

  useEffect(() => {
    load();
    checkInstalledAgents();
  }, [load, checkInstalledAgents]);

  const handleSummon = async (expert: Expert) => {
    setLoading(true);
    setLoadingId(expert.id);
    try {
      // 方式1：优先使用 downloadUrl（下载 zip 安装）
      if (expert.downloadUrl) {
        const result = await window.electron.ipcRenderer.invoke(
          'agent:summon',
          expert.id,
          expert.downloadUrl
        ) as { success: boolean; message: string };
        if (result.success) {
          toast.success(result.message);
          await checkInstalledAgents();
          await fetchAgents();
          // 切换到该专家的对话
          const agent = agents.find((a) => a.id === expert.id) || 
            useAgentsStore.getState().agents.find((a) => a.name === expert.name);
          if (agent) {
            switchSession(agent.mainSessionKey);
            navigate('/');
          }
          return;
        } else {
          toast.error(result.message);
          // downloadUrl 失败，回退到 API 方式
        }
      }

      // 方式2：使用 soulContent + identityContent（API 创建）
      let agent = agents.find((a) => a.id === expert.id || a.name === expert.name);
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
        const createdAgentId = (snapshot as unknown as { agentId?: string }).agentId;
        agent = useAgentsStore.getState().agents.find(
          (a) => a.id === createdAgentId || a.name === expert.name
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
      toast.error('召唤专家失败，请重试');
    } finally {
      setLoading(false);
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部固定区域：标题 + 分类标签 + 搜索排序 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 border-b border-border mb-6">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <Zap className="h-3 w-3" />
              <span>专业角色 · 开箱即用</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">专家中心</h1>
          </div>
          <button
            onClick={() => hasUpdates ? applyUpdates() : load(true)}
            disabled={loadingExperts}
            className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loadingExperts && 'animate-spin')} />
            <span>{loadingExperts ? '更新中...' : hasUpdates ? '有更新' : '检查更新'}</span>
            {hasUpdates && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
                {newExpertCount > 0 ? newExpertCount : '!'}
              </span>
            )}
          </button>
        </div>

        {/* 分类标签（横向滚动） */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {FIXED_CATEGORIES.map((category) => {
            // 计算该分类下的专家数量
            const count = category === '全部' ? experts.length 
              : experts.filter(e => e.category === category).length;
            
            const isActive = activeCategory === category;
            
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <span>{category}</span>
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
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索专家..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* 排序切换 */}
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
              <Flame className="h-4 w-4" />
              <span>最热</span>
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
              <Star className="h-4 w-4" />
              <span>最新</span>
            </button>
          </div>
        </div>

        {/* 当前筛选结果提示 */}
        {(activeCategory !== '全部' || searchQuery) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{activeCategory === '全部' ? '全部专家' : activeCategory}</span>
            {searchQuery && (
              <>
                <span>·</span>
                <span>搜索 "{searchQuery}"</span>
              </>
            )}
            <span>·</span>
            <span>{filteredExperts.length} 个专家</span>
          </div>
        )}
      </div>

      {/* 加载中骨架屏 */}
      {loadingExperts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-20 rounded bg-muted mb-2" />
                  <div className="h-3 w-32 rounded bg-muted" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-muted mb-2" />
              <div className="h-3 w-3/4 rounded bg-muted mb-4" />
              <div className="flex gap-1.5 mb-5">
                <div className="h-6 w-16 rounded-full bg-muted" />
                <div className="h-6 w-16 rounded-full bg-muted" />
              </div>
              <div className="h-10 w-full rounded-xl bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* 专家卡片网格 */}
      {!loadingExperts && (
        <>
          {visibleExperts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleExperts.map((expert) => (
                <ExpertCard
                  key={expert.id}
                  expert={expert}
                  onSummon={handleSummon}
                  loading={loading && loadingId === expert.id}
                  isInstalled={installedAgents.has(expert.id) || agents.some(a => a.name === expert.name)}
                />
              ))}
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
                  ? `没有找到与 "${searchQuery}" 相关的专家，试试其他关键词`
                  : activeCategory === '我的专家'
                  ? '你还没有召唤任何专家，去广场召唤一个吧'
                  : '敬请期待更多专家入驻'}
              </p>
            </div>
          )}

          {/* 无限滚动触发器 */}
          {visibleExperts.length < filteredExperts.length && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>加载更多...</span>
              </div>
            </div>
          )}

          {/* 已加载全部 */}
          {!loadingExperts && visibleExperts.length > 0 && visibleExperts.length >= filteredExperts.length && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              已展示全部 {filteredExperts.length} 个专家
            </div>
          )}
        </>
      )}

      {/* 底部说明 */}
      {!loadingExperts && visibleExperts.length > 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-5">
          <h4 className="text-sm font-semibold text-foreground mb-2">💡 专家 vs 普通对话</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">普通对话</p>
              <p className="text-xs text-muted-foreground/80">
                通用 AI 助手，回答各类问题，适合日常咨询
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">专家对话</p>
              <p className="text-xs text-muted-foreground/80">
                切换专业人格，提供领域深度洞察和方法论
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
