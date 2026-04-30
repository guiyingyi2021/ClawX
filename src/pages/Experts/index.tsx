/**
 * ExpertCenter - 专家中心页面
 * 展示预设专家角色卡片，用户点击"召唤"后切换到对应 Agent 对话
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPERTS } from './experts.config';
import type { Expert } from '@/types/expert';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useState } from 'react';
import { toast } from 'sonner';
import { hostApiFetch } from '@/lib/host-api';
import type { AgentsSnapshot } from '@/types/agent';

interface ExpertCardProps {
  expert: Expert;
  onSummon: (expert: Expert) => void;
  loading: boolean;
}

function ExpertCard({ expert, onSummon, loading }: ExpertCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
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
        {expert.specialties.map((s) => (
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
          expert.color,
          'hover:shadow-lg hover:opacity-95 active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span>立即召唤</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </div>
  );
}

export function ExpertCenter() {
  const navigate = useNavigate();
  const { agents, fetchAgents } = useAgentsStore();
  const { switchSession } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSummon = async (expert: Expert) => {
    setLoading(true);
    setLoadingId(expert.id);
    try {
      // 检查是否已有该专家 Agent
      let agent = agents.find((a) => a.id === expert.id);
      if (!agent) {
        // 通过专门的 API 创建专家 Agent，同时写入 SOUL.md 和 IDENTITY.md
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
        // The created agent's ID may differ from expert.id due to slugification
        // (e.g. "Kai ✍️" → "kai", not "expert-kai"). Use the agentId returned by API.
        const createdAgentId = (snapshot as unknown as { agentId?: string }).agentId;
        agent = useAgentsStore.getState().agents.find(
          (a) => a.id === createdAgentId || a.name === expert.name
        );
      }
      if (!agent) {
        toast.error('创建专家失败');
        return;
      }
      // 切换到该 Agent 的主会话
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
    <div className="mx-auto max-w-5xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-3">
          <Zap className="h-3.5 w-3.5" />
          <span>专业角色 · 开箱即用</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">专家中心</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          选择一位专业顾问，切换到对应的 AI 人格。每一个专家都经过深度配置，专注于特定领域的思维和方法。
        </p>
      </div>

      {/* 专家卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPERTS.map((expert) => (
          <ExpertCard
            key={expert.id}
            expert={expert}
            onSummon={handleSummon}
            loading={loading && loadingId === expert.id}
          />
        ))}
      </div>

      {/* 底部说明 */}
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
    </div>
  );
}
