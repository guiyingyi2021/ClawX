/**
 * SkillConfigDialog - 专家技能配置对话框
 *
 * 功能：
 * 1. 加载已安装技能（gateway status + clawhub list）
 * 2. 搜索技能（skillhub.cn + clawhub，替换列表）
 * 3. 支持多选、保存用户手动配置
 * 4. 清除手动配置（恢复自动匹配）
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Search, Check, Trash2 } from 'lucide-react';
import { hostApiFetch } from '@/lib/host-api';
import { useGatewayStore } from '@/stores/gateway';

// localStorage 专家技能配置 helpers（内联，避免循环依赖）
const SKILL_STORAGE_KEY_PREFIX = 'dclaw-expert-skills-';

const saveExpertSkillsToLocalStorage = (expertId: string, skills: string[]) => {
  try {
    localStorage.setItem(SKILL_STORAGE_KEY_PREFIX + expertId, JSON.stringify(skills));
    console.log(`[SkillConfigDialog] 已保存用户配置: ${expertId} →`, skills);
  } catch (error) {
    console.warn('[SkillConfigDialog] 保存用户配置失败:', error);
  }
};

const clearExpertSkillsFromLocalStorage = (expertId: string) => {
  try {
    localStorage.removeItem(SKILL_STORAGE_KEY_PREFIX + expertId);
    console.log(`[SkillConfigDialog] 已清除用户配置: ${expertId}`);
  } catch (error) {
    console.warn('[SkillConfigDialog] 清除用户配置失败:', error);
  }
};

interface SkillInfo {
  slug: string;
  name: string;
  description: string;
  installed: boolean;
  source?: string;
  version?: string;
}

interface SkillConfigDialogProps {
  expertId: string;
  expertName: string;
  open: boolean;
  onClose: () => void;
  onSave?: (skills: string[]) => void;
}

export function SkillConfigDialog({
  expertId,
  expertName,
  open,
  onClose,
  onSave,
}: SkillConfigDialogProps) {
  // installedSkills: 已安装技能（来自 gateway + clawhub）
  const [installedSkills, setInstalledSkills] = useState<SkillInfo[]>([]);
  // searchResults: 远程搜索结果（来自 skillhub.cn + clawhub 搜索）
  const [searchResults, setSearchResults] = useState<SkillInfo[] | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchAbortRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当前展示的列表：搜索时有结果用搜索结果，否则用已安装列表
  const displayedSkills: SkillInfo[] = searchResults !== null ? searchResults : installedSkills;

  // 本地过滤（在 displayedSkills 基础上按搜索词过滤，搜索模式下搜索词为空时显示搜索结果）
  const filteredSkills = useMemo(() => {
    if (searchResults === null && !searchQuery.trim()) return installedSkills;
    if (searchResults !== null && !searchQuery.trim()) return searchResults;
    const q = searchQuery.toLowerCase();
    const list = searchResults !== null ? searchResults : installedSkills;
    return list.filter(s =>
      s.slug.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }, [installedSkills, searchResults, searchQuery]);

  // 加载已安装技能（gateway + clawhub）
  const loadInstalledSkills = useCallback(async () => {
    setLoading(true);
    try {
      const skillMap = new Map<string, SkillInfo>();

      // 1. 从 gateway RPC 获取运行时已加载的技能
      try {
        const gatewayResult = await useGatewayStore.getState().rpc<{
          skills?: Array<{
            skillKey: string;
            slug?: string;
            name?: string;
            description?: string;
            disabled?: boolean;
          }>;
        }>('skills.status');
        if (gatewayResult?.skills) {
          for (const s of gatewayResult.skills) {
            const slug = s.slug || s.skillKey;
            skillMap.set(slug, {
              slug,
              name: s.name || slug,
              description: s.description || '',
              installed: !s.disabled,
              source: 'gateway',
            });
          }
        }
      } catch (err) {
        console.warn('[SkillConfigDialog] gateway skills.status failed:', err);
      }

      // 2. 从 clawhub API 获取已安装的技能列表
      try {
        const clawhubResult = await hostApiFetch<{
          success: boolean;
          results?: Array<{ slug: string; version?: string; source?: string }>;
        }>('/api/clawhub/list');
        if (clawhubResult?.success && clawhubResult.results) {
          for (const cs of clawhubResult.results) {
            const existing = skillMap.get(cs.slug);
            if (existing) {
              existing.source = 'gateway+clawhub';
              existing.version = cs.version || existing.version;
              existing.installed = true;
            } else {
              skillMap.set(cs.slug, {
                slug: cs.slug,
                name: cs.slug,
                description: '',
                installed: true,
                source: 'clawhub',
                version: cs.version,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[SkillConfigDialog] clawhub/list failed:', err);
      }

      setInstalledSkills(Array.from(skillMap.values()));
    } catch (error) {
      console.error('[SkillConfigDialog] 加载技能列表失败:', error);
      setInstalledSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载专家已配置的技能（优先读后端，兜底读 localStorage）
  const loadExpertSkills = useCallback(async () => {
    let saved: string[] | null = null;
    try {
      const config = await hostApiFetch<{ skills: string[] }>(
        `/api/expert-skill-config/${encodeURIComponent(expertId)}`
      );
      if (config && config.skills) {
        saved = config.skills;
      }
    } catch {
      // 后端无记录，尝试 localStorage
      try {
        const raw = localStorage.getItem('dclaw-expert-skills-' + expertId);
        if (raw) saved = JSON.parse(raw);
      } catch {}
    }
    setSelectedSkills(saved ? new Set(saved) : new Set());
  }, [expertId]);

  // 搜索技能（skillhub.cn + clawhub 并行搜索，替换当前列表）
  const searchSkillsRemote = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const [skillhubResult, clawhubResult] = await Promise.allSettled([
        hostApiFetch<{ success: boolean; results?: Array<{ slug: string; name: string; description: string }> }>(
          '/api/skillhub/search', { method: 'POST', body: JSON.stringify({ query, limit: 20 }) }
        ),
        hostApiFetch<{ success: boolean; results?: Array<{ slug: string; name: string; description: string }> }>(
          '/api/clawhub/search', { method: 'POST', body: JSON.stringify({ query, limit: 20 }) }
        ),
      ]);

      const seen = new Set<string>();
      const results: SkillInfo[] = [];

      // 合并 skillhub.cn 结果
      if (skillhubResult.status === 'fulfilled' && skillhubResult.value?.success) {
        for (const r of skillhubResult.value.results || []) {
          if (!seen.has(r.slug)) {
            seen.add(r.slug);
            results.push({
              slug: r.slug,
              name: r.name || r.slug,
              description: r.description || '',
              installed: false,
              source: 'skillhub.cn',
            });
          }
        }
      }

      // 合并 clawhub 结果
      if (clawhubResult.status === 'fulfilled' && clawhubResult.value?.success) {
        for (const r of clawhubResult.value.results || []) {
          if (!seen.has(r.slug)) {
            seen.add(r.slug);
            results.push({
              slug: r.slug,
              name: r.name || r.slug,
              description: r.description || '',
              installed: false,
              source: 'clawhub',
            });
          }
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('[SkillConfigDialog] 搜索技能失败:', error);
    } finally {
      setSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索防抖
  useEffect(() => {
    if (searchAbortRef.current) clearTimeout(searchAbortRef.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    searchAbortRef.current = setTimeout(() => {
      searchSkillsRemote(searchQuery);
    }, 400);
    return () => {
      if (searchAbortRef.current) clearTimeout(searchAbortRef.current);
    };
  }, [searchQuery, searchSkillsRemote]);

  // 初始化加载（对话框打开时）
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSearchResults(null);
      loadInstalledSkills();
      loadExpertSkills();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 切换技能选择
  const toggleSkill = (slug: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (selectedSkills.size === filteredSkills.length) {
      setSelectedSkills(new Set());
    } else {
      setSelectedSkills(new Set(filteredSkills.map(s => s.slug)));
    }
  };

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    const skillsArray = Array.from(selectedSkills);

    // 乐观更新：先更新 localStorage
    saveExpertSkillsToLocalStorage(expertId, skillsArray);

    try {
      await hostApiFetch(`/api/expert-skill-config/${encodeURIComponent(expertId)}`, {
        method: 'POST',
        body: JSON.stringify({ skills: skillsArray }),
      });

      onSave?.(skillsArray);
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      // 回滚 localStorage
      if (skillsArray.length === 0) {
        clearExpertSkillsFromLocalStorage(expertId);
      }
      // 重新加载后端配置到 localStorage
      try {
        const config = await hostApiFetch<{ skills: string[] }>(
          `/api/expert-skill-config/${encodeURIComponent(expertId)}`
        );
        if (config && config.skills) {
          saveExpertSkillsToLocalStorage(expertId, config.skills);
        }
      } catch {
        clearExpertSkillsFromLocalStorage(expertId);
      }
    } finally {
      setSaving(false);
    }
  };

  // 清除手动配置
  const handleClear = async () => {
    setSaving(true);

    // 乐观更新：先清除 localStorage
    clearExpertSkillsFromLocalStorage(expertId);
    setSelectedSkills(new Set());

    try {
      await hostApiFetch(`/api/expert-skill-config/${encodeURIComponent(expertId)}`, {
        method: 'DELETE',
      });

      onSave?.([]);
      onClose();
    } catch (error) {
      console.error('清除失败:', error);
      // 回滚：重新从后端加载配置
      try {
        const config = await hostApiFetch<{ skills: string[] }>(
          `/api/expert-skill-config/${encodeURIComponent(expertId)}`
        );
        if (config && config.skills) {
          saveExpertSkillsToLocalStorage(expertId, config.skills);
          setSelectedSkills(new Set(config.skills));
        }
      } catch {
        setSelectedSkills(new Set());
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              配置专家技能
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {expertName} · 选择该专家需要的技能
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索技能（skillhub.cn / clawhub）..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/50 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
              </div>
            )}
          </div>
        </div>

        {/* 已选中的技能 */}
        {selectedSkills.size > 0 && (
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              已选中 {selectedSkills.size} 个技能（将覆盖自动匹配）
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedSkills).map(slug => {
                const skill = displayedSkills.find(s => s.slug === slug);
                return (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                  >
                    {skill?.name || slug}
                    <button
                      onClick={() => toggleSkill(slug)}
                      className="hover:text-primary/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 技能列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* 全选 */}
              {filteredSkills.length > 0 && (
                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedSkills.size === filteredSkills.length && filteredSkills.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border"
                  />
                  <span className="text-sm font-medium text-foreground">
                    全选 ({filteredSkills.length})
                  </span>
                </label>
              )}

              {/* 技能列表 */}
              <div className="space-y-1 mt-2">
                {filteredSkills.map(skill => (
                  <label
                    key={skill.slug}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkills.has(skill.slug)}
                      onChange={() => toggleSkill(skill.slug)}
                      className="mt-0.5 rounded border-border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {skill.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {skill.slug}
                        </span>
                        {skill.installed && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500">
                            已安装
                          </span>
                        )}
                        {skill.source && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {skill.source}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {skill.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {filteredSkills.length === 0 && !loading && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {searchQuery.trim()
                    ? `没有找到与"${searchQuery}"相关的技能`
                    : '没有已安装的技能，试试搜索安装新技能'}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <button
            onClick={handleClear}
            disabled={saving || selectedSkills.size === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            清除手动配置
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  保存配置
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
