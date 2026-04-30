/**
 * ConfigPreview - 配置文件预览
 * 实时展示生成的 OpenClaw 配置
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { ConfigFiles } from '@/types/onboarding';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfigPreviewProps {
  configFiles: ConfigFiles;
}

type ConfigKey = keyof ConfigFiles;

export function ConfigPreview({ configFiles }: ConfigPreviewProps) {
  const [activeTab, setActiveTab] = useState<ConfigKey>('SOUL.md');

  const configOrder: ConfigKey[] = ['IDENTITY.md', 'SOUL.md', 'USER.md', 'AGENTS.md'];
  const availableTabs = configOrder.filter((key) => configFiles[key]);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b bg-muted/50">
        {availableTabs.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-background border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {key.replace('.md', '')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {configFiles[activeTab] && (
          <ConfigFileView
            filename={activeTab}
            content={configFiles[activeTab]}
          />
        )}
      </div>

      {/* 提示 */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground">
          这些配置将写入你的 Agent workspace，与 OpenClaw 完全兼容
        </p>
      </div>
    </div>
  );
}

/** 单个配置文件视图 */
function ConfigFileView({ filename, content }: { filename: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 高亮 Markdown 标题
  const highlightedContent = content.split('\n').map((line, i) => {
    if (line.startsWith('# ')) {
      return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h2>;
    }
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-base font-semibold mt-3 mb-2">{line.slice(3)}</h3>;
    }
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-sm font-medium mt-2 mb-1">{line.slice(4)}</h4>;
    }
    if (line.startsWith('- **')) {
      return <p key={i} className="ml-4 my-1">{line}</p>;
    }
    if (line.trim() === '') {
      return <br key={i} />;
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="ml-4">{line.slice(2)}</li>;
    }
    if (line.startsWith('|')) {
      return <p key={i} className="font-mono text-xs">{line}</p>;
    }
    if (line.startsWith('```')) {
      return null;
    }
    return (
      <p key={i} className="text-sm text-muted-foreground">
        {line}
      </p>
    );
  });

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <FileText className="w-4 h-4" />
          {filename}
        </button>
        <Button size="icon" variant="ghost" onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-muted/50 rounded-lg p-3 font-mono text-xs overflow-auto max-h-[60vh]"
        >
          {highlightedContent}
        </motion.div>
      )}
    </div>
  );
}
