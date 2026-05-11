# Dclaw 品牌定制改造手册

> 基于 Qclaw (github.com/qiuzhi2046/Qclaw) Fork，Apache-2.0 协议

---

## 一、准备工作

### 环境要求
- Node.js 22+（必须，低版本无法运行）
- Git
- Python 3.x（用于执行品牌替换脚本）

### 安装 Node.js 22
```bash
# Windows 推荐用 nvm-windows
nvm install 22
nvm use 22
node -v  # 确认显示 v22.x.x
```

---

## 二、Fork 并克隆项目

```bash
# 1. 在 GitHub 上 Fork: github.com/qiuzhi2046/Qclaw
#    Fork 后仓库变为: github.com/你的账号/Dclaw

# 2. 克隆到本地
git clone https://github.com/你的账号/Dclaw.git
cd Dclaw
```

---

## 三、一键品牌替换（自动）

```bash
# 在 dclaw-brand 目录执行
python rebrand.py --project-dir C:\path\to\你的Dclaw目录
```

脚本会自动完成：
- ✅ `package.json` → name/productName 改为 Dclaw
- ✅ `electron-builder.json` → appId/copyright 更新
- ✅ `build/` 图标文件替换（Windows ico + 通用 png）
- ✅ 源码中所有 "Qclaw" 字符串替换为 "Dclaw"
- ✅ 默认模型设置为 DeepSeek

---

## 四、手动检查项（脚本跑完后）

### 4.1 About 页版权声明
找到 About/关于 页面组件（通常在 `src/pages/` 或 `src/components/`），
确认包含如下声明（Apache-2.0 要求）：

```
Built on Qclaw (github.com/qiuzhi2046/Qclaw)
Copyright (C) 秋芝2046 Team — Apache-2.0 License
```

可以放在页脚小字里，不影响品牌观感。

### 4.2 macOS 图标（icns 格式）
Windows 图标已自动替换，macOS 需要 `.icns` 格式：

**方法一（推荐）：** 在线转换
- 打开 https://cloudconvert.com/png-to-icns
- 上传 `dclaw-brand/icons/icon.png`
- 下载 `icon.icns`
- 放入项目 `build/icon.icns`

**方法二：** 在 macOS 上执行
```bash
mkdir Dclaw.iconset
sips -z 1024 1024 icon.png --out Dclaw.iconset/icon_512x512@2x.png
# ... 其他尺寸
iconutil -c icns Dclaw.iconset
```

### 4.3 DeepSeek API Key 引导
在用户首次启动界面（Onboarding），将 API Key 输入框的说明改为：

```
请输入您的 DeepSeek API Key
获取地址：platform.deepseek.com/api_keys
格式：sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 五、打包构建

### 5.1 跳过 skill 下载打包（推荐）
```bash
cd E:\ClawX
SKIP_PREINSTALLED_SKILLS=1 pnpm run build
```
**说明**：
- 跳过 `bundle:preinstalled-skills` 步骤，不重新下载 skill
- 保留其他所有构建步骤（vite build、openclaw 打包、plugins 打包、electron-builder）
- **不会下载 Node/uv 二进制文件**（与 `package:win` 不同）

### 5.2 全量打包
```bash
cd E:\ClawX
pnpm run build
```
**说明**：包含所有步骤，会重新下载 preinstalled skills

### 5.3 输出文件
- Windows：`dist/` 目录下的 `.exe` 安装包
- macOS：需要在 Mac 上执行 `pnpm run build`（或修改命令为 `--mac`）

---

---

## 六、用户拿到的安装包体验

```
1. 双击 Dclaw-Setup.exe
2. 安装完成，桌面出现 Dclaw 图标
3. 打开 → 看到 Dclaw 品牌界面
4. 输入 DeepSeek API Key（一个输入框）
5. 开始使用
```

---

## 七、DeepSeek API Key 获取指南（给你的用户）

```
1. 访问 platform.deepseek.com
2. 注册/登录账号
3. 进入「API Keys」页面
4. 点击「创建 API Key」
5. 复制 sk- 开头的密钥，粘贴到 Dclaw 配置框
```

> DeepSeek 当前定价极低（约 ¥1/百万 token），适合普通用户日常使用。

---

## 八、文件清单

```
dclaw-brand/
├── icons/
│   ├── icon.png          ← 1024x1024 通用图标
│   ├── icon.ico          ← Windows 图标（多尺寸）
│   ├── 16x16.png ~ 512x512.png   ← Linux 图标集
│   └── logo-64/128/256/512.png   ← UI 内嵌用
├── rebrand.py            ← 一键品牌替换脚本
├── generate_icons.py     ← 图标生成脚本
└── Dclaw改造手册.md      ← 本文档
```

---

## 九、注意事项

| 事项 | 说明 |
|---|---|
| 协议合规 | Apache-2.0：保留 About 页原版权声明即可 |
| 商标 | 不可叫 "OpenClaw Pro"，Dclaw 完全没问题 |
| 升级策略 | 锁定 Qclaw 上游版本 Tag，不要跟随 latest |
| Windows 签名 | 分发安装包建议申请代码签名证书，避免杀毒软件误报 |
| macOS 公证 | Mac 版上架或分发需要 Apple Developer 账号公证 |

---

## 十、专家广场改造（2026-05-01）

### 10.1 改造背景
- 原版专家广场 @ 专家时显示英文原名（如 "Kai"），用户无法快速识别功能
- 专家列表硬编码在前端，每天更新需要重新打包，效率低下
- 需要实现远程动态更新专家配置，无需重新打包

### 10.2 @ 显示中文角色名

**修改文件**：`src/pages/Chat/ChatInput.tsx`

**改动内容**：
```tsx
// 第22行：新增导入
import { EXPERT_MAP } from '@/pages/Experts/experts.config';

// 第679行：选中标签显示中文 role
{EXPERT_MAP[selectedTarget.id]?.role || 
 EXPERT_MAP[`expert-${selectedTarget.name.toLowerCase()}`]?.role || 
 selectedTarget.name}

// 第994行：选择列表显示中文 role
{EXPERT_MAP[agent.id]?.role || 
 EXPERT_MAP[`expert-${agent.name.toLowerCase()}`]?.role || 
 agent.name}
```

**效果**：
- @ 弹出选择器显示中文角色（如 "首席增长官"）
- 选中后标签显示中文角色
- 用户可快速识别专家功能

**ID 匹配逻辑**：
- 优先匹配：`EXPERT_MAP[agent.id]`（如 "expert-kai"）
- 兼容匹配：`EXPERT_MAP[\`expert-${agent.name.toLowerCase()}\`]`（兼容 ID 格式不一致的情况）
- 兜底显示：`agent.name`（原英文名）

### 10.3 专家配置混合模式（远程动态更新）

**核心思路**：支持远程更新专家列表，无需重新打包

**技术方案**：
1. **远程拉取**：从 `https://aigc.dayunzhonglian.com/api/experts.json` 获取最新配置
2. **本地缓存**：存储到 localStorage，有效期 30 分钟
3. **内置兜底**：远程失败时回退到 `experts.config.ts` 内置配置

**新增文件**：`src/lib/expert-loader.ts`

```typescript
// 混合模式加载模块
export async function loadExperts(): Promise<ExpertConfig[]> {
  // 1. 尝试从远程加载
  try {
    const response = await fetch('https://aigc.dayunzhonglian.com/api/experts.json');
    if (response.ok) {
      const data = await response.json();
      // 缓存到 localStorage（30分钟 TTL）
      localStorage.setItem('dclaw-experts-cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    }
  } catch (error) {
    console.warn('远程加载失败，使用缓存:', error);
  }

  // 2. 尝试从缓存加载
  const cached = localStorage.getItem('dclaw-experts-cache');
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 30 * 60 * 1000) { // 30分钟内有效
      return data;
    }
  }

  // 3. 兜底：使用内置配置
  return builtinExperts;
}

export function refreshExperts(): Promise<ExpertConfig[]> {
  // 强制刷新（跳过缓存）
  localStorage.removeItem('dclaw-experts-cache');
  return loadExperts();
}

export function getLastUpdateTime(): number | null {
  // 获取最后更新时间（Unix 时间戳）
  const cached = localStorage.getItem('dclaw-experts-cache');
  if (cached) {
    const { timestamp } = JSON.parse(cached);
    return timestamp;
  }
  return null;
}
```

**修改文件**：`src/pages/Experts/index.tsx`

**改动内容**：
```tsx
import { loadExperts, refreshExperts, getLastUpdateTime } from '@/lib/expert-loader';

// 组件加载时动态获取专家配置
const [experts, setExperts] = useState<ExpertConfig[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadExperts().then(data => {
    setExperts(data);
    setLoading(false);
  });
}, []);

// 新增"检查更新"按钮
<Button onClick={async () => {
  setLoading(true);
  const data = await refreshExperts();
  setExperts(data);
  setLoading(false);
}}>
  检查更新
</Button>

// 显示最后更新时间
{getLastUpdateTime() && (
  <Text>最后更新: {new Date(getLastUpdateTime()!).toLocaleString()}</Text>
)}
```

**UI 改进**：
- 加载时显示骨架屏（Skeleton）
- 显示最后更新时间
- 支持手动"检查更新"按钮

### 10.4 远程配置格式

**上传文件**：`https://aigc.dayunzhonglian.com/api/experts.json`

**格式示例**：
```json
[
  {
    "id": "expert-kai",
    "name": "Kai",
    "role": "首席增长官",
    "avatar": "🤖",
    "description": "增长战略与商业变现专家"
  },
  {
    "id": "expert-sarah",
    "name": "Sarah",
    "role": "数据分析师",
    "avatar": "📊",
    "description": "数据洞察与可视化专家"
  }
]
```

**字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 专家唯一标识（格式：`expert-xxx`） |
| `name` | string | 专家英文名（用于匹配 Agent） |
| `role` | string | 中文角色名（显示在 @ 选择器中） |
| `avatar` | string | 头像（emoji 或图片 URL） |
| `description` | string | 专家描述 |

**本地示例文件**：`dclaw-brand/experts-remote-example.json`

### 10.5 新增专家流程（推荐）

**目录结构**：将专家按固定分类放在 `agents/` 目录，无需手动编辑 JSON：

```
agents/
├── index.json              ← 自动生成（勿手动编辑）
├── 内容创作/
│   └── kai/
│       ├── SOUL.md         ← 必需（含 YAML frontmatter）
│       ├── IDENTITY.md      ← 可选
│       └── package.tar.gz   ← 召唤时下载的安装包
├── 数据智能/
│   └── phoebe/
└── ...
```

**SOUL.md 规范（必须包含 frontmatter）**：
```markdown
---
role: 内容创作专家
emoji: ✍️
color: "#FF6B6B"
summary: 一句话介绍
---
# SOUL.md - 内容创作专家 Kai

你叫 Kai，是一位资深内容创作者...
```

**12 个固定分类**（文件夹名必须完全匹配）：
`全部` `产品设计` `技术工程` `游戏空间` `数据智能` `营销增长` `内容创作` `销售商务` `金融投资运营人力` `项目质量` `法务安全` `行业顾问`

**新增专家步骤**：
1. 创建文件夹：`agents/{分类}/{专家ID}/`
2. 放入 `SOUL.md`（必须）+ `package.tar.gz`（必须）+ `IDENTITY.md`（可选）
3. 运行 `node generate-index.js` → 自动生成 `index.json`
4. `git push` 推送到 GitHub

**无需手动编辑任何 JSON 文件！**

### 10.6 旧版手动更新（已废弃）

~~编辑 `experts-remote-example.json` 并上传到服务器~~

请改用上述 `agents/` 目录结构。

**缓存策略**：
- 有效期：30 分钟
- 自动失效：超时后自动重新拉取
- 手动刷新：点击"检查更新"立即刷新

### 10.7 文件清单

**新增文件**：
```
src/lib/expert-loader.ts          ← 混合模式加载模块
generate-index.js                 ← 自动生成 index.json 脚本
agents/                          ← 专家包目录结构
dclaw-brand/experts.json         ← 新格式远程配置（按分类组织）
dclaw-brand/experts-remote-example.json  ← 配置示例
```

**修改文件**：
```
src/pages/Chat/ChatInput.tsx     ← @ 显示中文 role
src/pages/Experts/index.tsx      ← 动态加载 + 检查更新按钮
src/pages/Experts/experts.config.ts  ← 内置兜底配置
```

**备份位置**：
```
backup/ChatInput-20260501-*.tsx.bak
backup/Experts-index-20260501-*.tsx.bak
```

### 10.8 验收标准

**功能验收**：
- ✅ @ 弹出选择器显示中文 role
- ✅ 选中标签显示中文 role
- ✅ 远程配置加载成功
- ✅ 30 分钟缓存生效
- ✅ "检查更新"按钮正常工作
- ✅ 远程失败回退内置配置

**用户反馈**：
- "可以了" —— @ 显示中文功能符合预期
- 专家广场 UI 改进 accepted

---

## 十一、AIGC 网站集成（2026-05-01）

### 11.1 集成方式
- **内嵌方案**：BrowserView 直接内嵌 AIGC 站点
- **Skill 方案**：`/aigc` 命令调用 AIGC API

### 11.2 关键参数
- **API Base**：https://aigc.dayunzhonglian.com
- **site_id**：100000
- **channel**：pc
- **Token 获取**：浏览器 Cookie → `token` 字段（JWT，有效期至 2026-05-31）

### 11.3 详细文档
完整 AIGC 集成文档请参考：`dclaw-brand/Dclaw品牌定制完整文档.md`

---

## 十二、专家召唤功能统一（2026-05-02）

### 12.1 改造背景
- 原版专家中心（市场专家）和我的专家（本地专家）使用不同的召唤逻辑
- 市场专家：下载 SOUL.md → API 召唤
- 本地专家：IPC 召唤（需要本地 tar.gz 路径）
- **问题**：远程加载的专家（`isRemote: true`）缺少 `soulUrl` 字段，召唤时无法下载 SOUL.md，导致失败

### 12.2 核心改造：统一召唤逻辑

**目标**：无论是市场专家、远程专家、本地专家还是内置专家，都能一键召唤

**修改文件**：`src/pages/Experts/index.tsx`

**统一后的召唤流程**：
```typescript
const handleSummon = useCallback(async (expert: Expert) => {
  // 1. 市场专家 or 远程专家：下载 SOUL.md → API 路径
  if ((expert.isMarket || expert.isRemote) && (expert.downloadUrl || expert.soulUrl)) {
    const url = expert.downloadUrl || expert.soulUrl;
    const soulContent = await downloadSoulContent(url!);
    const snapshot = await hostApiFetch('/api/experts/summon', {
      method: 'POST',
      body: JSON.stringify({ expertId, expertName, soulContent, identityContent: '' })
    });
    // 创建成功 → 切换对话
    return;
  }

  // 2. 本地专家：有 tar.gz downloadUrl → IPC 路径（仅限本地文件路径）
  if (expert.downloadUrl && !expert.downloadUrl.startsWith('http')) {
    const result = await window.electron.ipcRenderer.invoke('agent:summon', expert.id, expert.downloadUrl);
    // 安装成功 → 切换对话
    return;
  }

  // 3. 兜底：直接用本地 soulContent 创建（内置专家）
  const snapshot = await hostApiFetch('/api/experts/summon', {
    method: 'POST',
    body: JSON.stringify({ expertId, expertName, soulContent, identityContent })
  });
  // 创建成功 → 切换对话
}, []);
```

**判断逻辑**：
| 专家类型 | 判断条件 | 召唤方式 |
|----------|-----------|----------|
| 市场专家 | `isMarket=true` | 下载 SOUL.md → API |
| 远程专家 | `isRemote=true` + `soulUrl` | 下载 SOUL.md → API |
| 本地专家 | `downloadUrl` 是本地路径 | `agent:summon` IPC |
| 内置专家 | 有 `soulContent` | 直接用 soulContent → API |

### 12.3 远程专家 soulUrl 自动生成

**修改文件**：`src/lib/expert-loader.ts`

**改动内容**：
```typescript
for (const expert of experts) {
  // 自动生成 soulUrl（指向 GitHub raw 的 SOUL.md）
  const soulUrl = expert.hasSoul
    ? `${GITHUB_RAW_BASE}/agents/${expert.id}/SOUL.md`
    : undefined;
  
  flatExperts.push({
    ...expert,
    soulUrl, // SOUL.md 下载地址
    downloadUrl: soulUrl || `${GITHUB_RAW_BASE}/agents/${expert.id}/package.tar.gz`,
    isRemote: true,
    // ...其他字段
  });
}
```

**效果**：
- 远程专家现在自动包含 `soulUrl` 字段
- 召唤时可以正确下载 SOUL.md
- 不再因为缺少下载地址而失败

### 12.4 市场专家加载器

**文件**：`src/lib/market-loader.ts`

**关键函数**：
- `loadMarketExperts(onUpdate)`：加载市场专家索引
- `refreshMarketExperts()`：强制刷新市场索引
- `downloadSoulContent(url)`：下载 SOUL.md 内容
- `transformMarketExperts()`：转换市场索引为 Expert 格式

**市场专家字段映射**：
```typescript
{
  ...marketExpert,
  id: `market-${e.remoteId}`,  // 补全 id 字段
  downloadUrl: e.soulUrl || e.downloadUrl,  // 映射 soulUrl 到 downloadUrl
  isMarket: true,
  // ...其他字段
}
```

### 12.5 验收标准

**功能验收**：
- ✅ 市场专家点击「召唤」→ 下载 SOUL.md → 创建 Agent → 切换对话
- ✅ 远程专家点击「召唤」→ 下载 SOUL.md → 创建 Agent → 切换对话
- ✅ 本地专家点击「召唤」→ IPC 安装 → 切换对话
- ✅ 内置专家点击「召唤」→ 直接用 soulContent → 创建 Agent → 切换对话
- ✅ 召唤按钮显示正确（已召唤/召唤）
- ✅ 召唤中显示加载状态

**代码验收**：
- ✅ `handleSummon` 统一处理所有专家类型
- ✅ 远程专家自动生成 `soulUrl`
- ✅ 市场专家正确映射 `downloadUrl`
- ✅ Vite 前端构建成功（3925 模块，37.57s）

### 12.6 文件清单

**修改文件**：
```
src/pages/Experts/index.tsx      ← 统一召唤逻辑
src/lib/expert-loader.ts          ← 远程专家 soulUrl 生成
src/lib/market-loader.ts          ← 市场专家字段映射
```

**备份位置**：
```
backup/2026-05-02/
├── index.tsx.bak                ← 原版专家中心组件
├── expert-loader.ts.bak         ← 原版专家加载器
└── market-loader.ts.bak         ← 原版市场加载器
```

### 12.7 使用说明

**用户视角**：
1. 打开专家中心 → 浏览市场专家 → 点击「召唤」
2. 打开我的专家 → 浏览已安装专家 → 点击「召唤」
3. 所有专家都是一键召唤，无需手动配置

**开发者视角**：
- 新增专家：放入 `agents/{分类}/{专家ID}/` → 写 SOUL.md → 运行 `generate-index.js` → push
- 市场专家：自动从 `agency-agents-zh` 仓库同步
- 召唤逻辑：无需区分专家类型，统一走 `handleSummon`

---

## 十三、专家状态判断 Bug 修复（2026-05-03）

### 13.1 问题描述

**现象**：
- "市场专家" Tab：未召唤的专家显示"使用中"
- "我的专家" Tab：同样的问题

**根本原因**：`installedAgents` 通过 `useCallback` + `useEffect` 间接更新，存在异步时机问题
- `checkInstalledAgents` 依赖 `[agents]`，但在 `useEffect` 的依赖数组中还耦合了 `activeTab`、`loadLocalExperts`、`loadMarketData`
- 逻辑复杂且同步不可靠，导致状态判断错误

### 13.2 修复方案

**用 `useMemo` 直接替代 `useState` + `useCallback` + `useEffect` 调用链**

✅ **第191行**：`useState<Set<string>>(new Set())` → 改为 `useMemo` 直接从 `agents` 同步计算
```typescript
const installedAgents = useMemo(() => {
  const ids = new Set<string>();
  agents.forEach(a => {
    ids.add(a.id);
    ids.add(a.name);
  });
  return ids;
}, [agents]);
```

✅ **删除 `checkInstalledAgents` 函数**（原第286-294行）

✅ **删除所有 `checkInstalledAgents()` 调用**：
- 初始化 useEffect 中的调用
- `handleSummon` 中的两次调用

✅ **清理依赖数组**：移除 `checkInstalledAgents` 引用

### 13.3 效果

- `installedAgents` 与 `agents` **严格同步**，无异步时机问题
- 未召唤的专家 → 显示「召唤」
- 已召唤的专家 → 显示「使用中」
- 编译验证：`pnpm run build:vite` ✅ 通过

### 13.4 涉及文件

**修改文件**：`src/pages/Experts/index.tsx`

| 改动 | 说明 |
|------|------|
| `useState` → `useMemo` | 直接从 `agents` 同步计算 `installedAgents` |
| 删除 `checkInstalledAgents` 函数 | 功能已被 `useMemo` 替代 |
| 删除所有 `checkInstalledAgents()` 调用 | 不再需要手动刷新 |
| 清理依赖数组 | 移除已过时的 `checkInstalledAgents` 引用 |

**备份**：`E:/backup/index.tsx.20260503.bak`

### 13.5 验证

- 编译验证：`pnpm run build:vite` ✅ 通过
- UI 验证：待用户打包后验证状态显示是否正确

---

## 第十四章、三Tab召唤逻辑优化与远程专家修复（2026-05-03）

### 14.1 三Tab"召唤中"按钮逻辑重构

**问题**：点击"召唤中"按钮跳转到历史对话，不符合用户期望

**用户需求**：
- "使用中"Tab的"召唤中"按钮 → 切换到已有对话（保持原逻辑）
- "我的专家"和"专家中心"Tab的"召唤中"按钮 → 新建对话线程（新逻辑）

**修复方案**：
1. 在 `chat.ts` store 中新增 `newSessionForAgent` 函数
2. 为三个Tab的"召唤中"按钮绑定不同逻辑

**修改文件**：`src/stores/chat.ts`

**新增代码**：
```typescript
newSessionForAgent: (agent: { mainSessionKey: string }) => {
  const prefix = getCanonicalPrefixFromSessionKey(agent.mainSessionKey);
  if (!prefix) {
    console.warn('[newSessionForAgent] 无法提取前缀:', agent.mainSessionKey);
    return;
  }
  const newKey = `${prefix}:session-${Date.now()}`;
  clearHistoryPoll();
  clearBaselines();
  set((s) => buildSessionSwitchPatch(s, newKey));
  get().loadHistory();
}
```

**修改文件**：`src/pages/Experts/index.tsx`

**改动内容**：
- `handleUseAgent`：切换到已有对话（用于"使用中"Tab）
- `handleSummon`：新建对话线程（用于"我的专家"和"专家中心"Tab）
- `MarketCard`：移除点击拦截，允许点击卡片触发召唤

---

### 14.2 引导文件英文默认值修复

**问题**：首次启动时的引导流程显示英文"AI助手"，不专业

**修复方案**：将引导文件中的 `'AI助手'` 替换为 `'Dclaw 助手'`

**修改文件**（共4处）：
1. `src/components/onboarding/AgentOnboarding/index.tsx`
2. `src/components/onboarding/InChatOnboarding.tsx`
3. `src/utils/configGenerator.ts`
4. 其他相关引导配置文件

**验证方式**：
- 首次启动 Dclaw → 引导流程 → 显示"Dclaw 助手"而非"AI助手"

---

### 14.3 远程专家召唤失败根因排查与修复

**问题现象**：
1. 从"我的专家"Tab召唤远程专家后，状态未更新
2. 只有历史学家的显示是"召唤中"，其他远程专家状态不变
3. 使用中Tab无法正常显示所有召唤的专家

**排查过程**（已记入 `docs/expert-square-debug.log`）：

| 阶段 | 发现 | 结论 |
|------|------|------|
| 第1轮 | 只有历史学家能显示 | `slugifyAgentId` 把中文ID转成空字符串 |
| 第2轮 | 修复后仍失败 | 需要同时存 `expert.id` 和 `expert.name` 双ID |
| 第3轮 | 本地专家正常，远程仍失败 | `createAgent` 返回的 agent 对象字段不匹配 |

**最终根因**：
`electron/utils/agent-config.ts` 中的 `slugifyAgentId` 函数会把中文ID（如 `阿创哥`）转换成不符合预期的格式，导致：
1. 专家安装后ID与预期不符
2. `isExpertInstalled` 检查失效
3. 使用中Tab无法匹配到对应agent

**修复方案1：修改 `slugifyAgentId` 支持Unicode**

**修改文件**：`electron/utils/agent-config.ts`

**改动内容**：
```typescript
function slugifyAgentId(name: string): string {
  // 如果包含非ASCII字符（中文等），保留原始格式，只做基本清理
  if (/[^\x00-\x7F]/.test(name)) {
    return name
      .normalize('NFKD')
      .replace(/\s+/g, '-')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  // 纯ASCII字符：使用原有逻辑
  const normalized = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized || /^\d+$/.test(normalized)) return 'agent';
  if (normalized === MAIN_AGENT_ID) return 'agent';
  return normalized;
}
```

**修复方案2：改进agent查找逻辑**

**修改文件**：`electron/api/routes/agents.ts`（第273-280行）

**改动内容**：
```typescript
const createdAgent = snapshot.agents.find(a => a.id === body.expertId)
  || snapshot.agents.find(a => a.name === body.expertName)
  || snapshot.agents[snapshot.agents.length - 1];
```

**修复方案3：双ID存储**

**修改文件**：`src/pages/Experts/index.tsx`

**改动内容**：
- 在 `handleSummon` 中同时存储 `expert.id` 和 `expert.name` 到 `summonedAgentIds`
- 确保 `isExpertInstalled` 能正确检查双ID

---

### 14.4 专家广场工作日志建立

**目的**：方便后续排查专家相关故障

**文件位置**：`E:\ClawX\docs\expert-square-debug.log`

**日志内容**：
- 问题现象记录
- 排查步骤与发现
- 根因分析
- 修复方案
- 待验证项

**使用方式**：
- 遇到专家相关问题时，先查看此日志
- 记录新的问题和排查过程
- 定期整理，删除已解决的问题

---

### 14.5 文件清单

**修改文件**：
```
src/stores/chat.ts                  ← 新增 newSessionForAgent 函数
src/pages/Experts/index.tsx          ← 三Tab召唤逻辑 + 双ID存储 + MarketCard点击修复
electron/utils/agent-config.ts       ← slugifyAgentId 支持中文
electron/api/routes/agents.ts        ← agent查找逻辑改进
src/components/onboarding/*          ← 引导文案中文化
docs/expert-square-debug.log         ← 新建工作日志
```

**备份位置**：
```
backup/2026-05-03/
├── chat.ts.bak                      ← 原版 chat store
├── index.tsx.bak                    ← 原版专家中心组件
├── agent-config.ts.bak              ← 原版 slugifyAgentId
└── agents.ts.bak                    ← 原版 agent 查找逻辑
```

---

### 14.6 验证状态

**用户测试通过 ✅**

| 验证项 | 状态 |
|--------|------|
| 三Tab"召唤中"按钮逻辑正确 | ✅ |
| "使用中"Tab → 切换到已有对话 | ✅ |
| "我的专家"和"专家中心"Tab → 新建对话线程 | ✅ |
| 引导文件显示"Dclaw 助手" | ✅ |
| 远程专家召唤成功且状态更新 | ✅ |
| 使用中Tab正常显示所有召唤的专家 | ✅ |
| 本地专家不受影响 | ✅ |

---

### 14.7 关键代码段

**newSessionForAgent 函数**（src/stores/chat.ts）：
```typescript
newSessionForAgent: (agent: { mainSessionKey: string }) => {
  const prefix = getCanonicalPrefixFromSessionKey(agent.mainSessionKey);
  if (!prefix) {
    console.warn('[newSessionForAgent] 无法提取前缀:', agent.mainSessionKey);
    return;
  }
  const newKey = `${prefix}:session-${Date.now()}`;
  clearHistoryPoll();
  clearBaselines();
  set((s) => buildSessionSwitchPatch(s, newKey));
  get().loadHistory();
}
```

**slugifyAgentId 支持中文**（electron/utils/agent-config.ts）：
```typescript
function slugifyAgentId(name: string): string {
  // 如果包含非ASCII字符（中文等），保留原始格式
  if (/[^\x00-\x7F]/.test(name)) {
    return name
      .normalize('NFKD')
      .replace(/\s+/g, '-')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  // 纯ASCII字符：使用原有逻辑
  // ...
}
```

**agent查找逻辑改进**（electron/api/routes/agents.ts）：
```typescript
const createdAgent = snapshot.agents.find(a => a.id === body.expertId)
  || snapshot.agents.find(a => a.name === body.expertName)
  || snapshot.agents[snapshot.agents.length - 1];
```

---

## 十五、模型配置帮助文档链接替换（2026-05-07）

### 15.1 改造背景
- 设置页"模型配置"中 Custom Provider 的"飞书帮助文档"链接指向旧的飞书文档地址
- 需要替换为 Dclaw 自己的飞书帮助文档

### 15.2 修改内容

**修改文件**：`src/lib/providers.ts`

| 字段 | 旧值 | 新值 |
|------|------|------|
| `docsUrl` | `https://icnnp7d0dymg.feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#...` | `https://my.feishu.cn/wiki/VNuAweEcDixl5JkHDoycGNsLnDe` |
| `docsUrlZh` | `https://icnnp7d0dymg.feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#...` | `https://my.feishu.cn/wiki/VNuAweEcDixl5JkHDoycGNsLnDe` |

**涉及位置**：Custom Provider 配置定义（第195-196行）

**效果**：用户在模型配置页面点击"帮助文档"链接后，跳转至 Dclaw 飞书帮助文档


---

## 十六、我的专家 Tab 本地索引兜底 + 缓存策略优化（2026-05-08 ~ 2026-05-09）

### 16.1 改造背景
- "我的专家" Tab 中的远程自建专家每次都需要手动"检查更新"才能显示
- "专家中心" Tab 已有完善的缓存机制（localStorage + 30 分钟 TTL），启动即显示
- 需要让"我的专家"使用同样的缓存策略

### 16.2 本次核心成果（2026-05-09）

**问题根因**：`expert-loader.ts` 没有本地索引兜底，网络不好时远程专家加载失败。

**修改内容**：

| 文件 | 修改内容 |
|------|----------|
| `src/data/experts-index.json` | **新增**，从 `agents/index.json` 复制，作为本地索引兜底 |
| `src/lib/expert-loader.ts` | 引入本地索引，`loadExperts()` 优先同步返回本地数据 |
| `scripts/sync-experts-index.mjs` | **新增**，build 前自动同步最新索引到 `src/data/` |
| `package.json` | build 命令加入索引同步步骤 |

**效果**：现在"我的专家"Tab 即使完全断网，也能从本地索引显示远程专家列表。网络恢复后后台异步更新。

### 16.3 核心改造：与专家中心缓存策略统一

**修改文件**：`src/lib/expert-loader.ts`

**改动1：新增缓存 TTL**
```typescript
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟，与专家中心缓存策略一致
```

**改动2：`getCache()` 增加 TTL 检查**
- 缓存超过 30 分钟视为"过期但可用"——仍然返回缓存数据，后台异步刷新
- 缓存未过期：直接返回，不触发远程请求
- 缓存未命中：返回内置，后台异步拉取

**改动3：`loadExperts()` 混合加载策略（同步本地 + 异步远程）**
```typescript
export async function loadExperts(...): Promise<Expert[]> {
  // 1. 立即返回：内置专家 + 本地索引（同步，无需网络）
  const localExperts = transformLocalExperts();
  const builtInIds = new Set(builtInExperts.map(e => e.id));
  const immediateData = [
    ...builtInExperts,
    ...localExperts.filter(e => !builtInIds.has(e.id)),
  ];

  // 2. 后台异步检查远程是否有更新（非阻塞）
  fetchRemoteExperts(url).then(...).catch(...);

  return immediateData;
}
```
> 本地索引文件：`src/data/experts-index.json`（由同步脚本自动生成，避免打包后首次加载网络请求失败）

**改动4：`transformLocalExperts()` 支持本地索引格式**
- 读取 `src/data/experts-index.json`（按分类组织：`{ "产品设计": [...], ... }`）
- 转换为 `Expert[]`，与 `market-loader.ts` 的 `transformMarketExperts()` 对齐

**修改文件**：`src/pages/Experts/index.tsx`

**改动5：`loadLocalExperts()` 每次调用重置 ref**
```typescript
// 非强制刷新时，重置 ref 允许新的远程更新回调触发
updateAppliedRef.current = false;
```

**改动6：`handleLocalUpdate()` 简化**
- 移除 `setExperts(prev => ...)` 中的未使用的 `prev` 参数
- 由 `loadLocalExperts` 控制 ref 重置时机

**改动7：按钮文案"刷新索引"改为"检查更新"**
- 文件：`src/pages/Experts/index.tsx`
- "我的专家"Tab 的刷新按钮文案从"刷新索引"改为"检查更新"

### 16.4 缓存策略对比

| 场景 | 旧行为 | 新行为 |
|------|--------|--------|
| 首次启动（无缓存） | 仅显示内置6个专家 | 立即显示内置 + 本地索引，后台异步拉取远程 |
| 再次启动（缓存未过期） | 每次后台拉取 | 直接读缓存，不发起网络请求 |
| 缓存已过期（30分钟后） | 每次后台拉取 | 返回缓存 → 后台异步刷新 |
| 点击"检查更新" | 强制拉取 | 强制拉取（不变） |

### 16.5 本地索引同步机制

**问题**：`loadExperts()` 需要读取本地索引文件立即返回数据，但不能每次打包都手动复制。

**方案**：创建同步脚本，在 `pnpm run build` 时自动执行。

**新增文件**：`scripts/sync-experts-index.mjs`
```javascript
// 将 agents/index.json 同步到 src/data/experts-index.json
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'agents/index.json');
const dest = resolve(root, 'src/data/experts-index.json');

// 如果 src 存在，复制到 dest；否则保留 dest（打包时 agents/ 可能不在）
try {
  copyFileSync(src, dest);
  console.log('[sync-experts-index] 已同步 agents/index.json → src/data/experts-index.json');
} catch {
  console.log('[sync-experts-index] agents/index.json 不存在，保留现有 src/data/experts-index.json');
}
```

**修改文件**：`package.json`
```json
"build": "zx scripts/sync-experts-index.mjs && node scripts/generate-ext-bridge.mjs && ..."
```

### 16.6 文件清单

**修改文件**：
```
src/lib/expert-loader.ts          ← CACHE_TTL + 混合加载策略 + transformLocalExperts()
src/pages/Experts/index.tsx        ← ref 重置优化 + handleLocalUpdate 简化 + 按钮文案"检查更新"
package.json                     ← build 脚本加入 sync-experts-index.mjs
```

**新增文件**：
```
scripts/sync-experts-index.mjs   ← 同步脚本（自动生成 src/data/experts-index.json）
src/data/experts-index.json     ← 本地索引（由同步脚本生成，提交到 git）
```

**备份**：
```
src/lib/expert-loader.ts.bak-20260507
```

---

## 十七、专家中心/我的专家 Tab 切换空白修复（2026-05-09）

### 17.1 问题描述

**现象**：
- 首次打开"专家中心"Tab → 页面空白，点击"刷新索引"后才显示
- 在"专家中心"Tab 点击某分类后，切换回"我的专家"Tab → 页面空白
- 关闭 Dclaw 重新打开后问题不再复现（与缓存状态强相关）

### 17.2 根因分析

**根因1（确定）：** `market-loader.ts` 的 `transformMarketExperts()` 只读取 `_flat` 字段，但 `market-experts-index.json` 的实际格式是 `{ "version": "...", "total": 196, "categories": {...} }`，**没有 `_flat` 字段**，导致首次加载返回空数组。

**根因2（高概率）：** 三个 Tab 共用 `activeCategory` 状态。在"专家中心"Tab 点击某分类（如"产品设计"）后切换回"我的专家"Tab 时，`activeCategory` 仍为该分类值，"我的专家"中对应分类的专家可能为空，过滤后显示空白。

### 17.3 修复内容

**修改文件1**：`src/lib/market-loader.ts`

**改动1：`transformMarketExperts()` 支持两种格式**
```typescript
function transformMarketExperts(): Expert[] {
  const raw = MARKET_INDEX_DATA as any;
  // 优先用 _flat（新格式，由 agency-agents-zh 生成脚本产生）
  if (raw._flat && Array.isArray(raw._flat) && raw._flat.length > 0) {
    return raw._flat.map((e: any) => ({ ... }));
  }
  // 兜底：从 categories 字段提取（当前 GitHub 上的实际格式）
  const categories = raw.categories;
  if (!categories || typeof categories !== 'object') return [];
  const result: Expert[] = [];
  for (const [category, experts] of Object.entries(categories) as any) {
    if (!Array.isArray(experts)) continue;
    for (const e of experts) {
      result.push({ ...e, id: `market-${e.remoteId}`, ... });
    }
  }
  return result;
}
```

**改动2：`getMarketStats()` 同理兼容两种格式**
```typescript
export function getMarketStats(): { total: number; categories: Record<string, number> } {
  const raw = MARKET_INDEX_DATA as any;
  if (raw._flat && Array.isArray(raw._flat)) { /* 新格式 */ }
  // 兜底：从 categories 提取
  const categories = raw.categories || {};
  ...
}
```

**修改文件2**：`src/pages/Experts/index.tsx`

**改动3：Tab 切换时重置分类为"全部"**
```typescript
useEffect(() => {
  setActiveCategory('全部');   // ← 新增：切换 Tab 时重置分类
  if (activeTab === 'my') {
    loadLocalExperts();
  } else if (activeTab === 'market') {
    loadMarketData();
  }
}, [activeTab, loadLocalExperts, loadMarketData]);
```

### 17.4 文件清单

**修改文件**：
```
src/lib/market-loader.ts     ← transformMarketExperts() + getMarketStats() 兼容无 _flat 格式
src/pages/Experts/index.tsx ← Tab 切换时重置 activeCategory 为"全部"
```

**无备份**（两处均为新增兼容逻辑，非破坏性修改）

### 17.5 验证方式

1. 删除 `localStorage` 中的 `dclaw-market-cache` 和 `dclaw-experts-cache`
2. 重新打开 Dclaw → 进入"专家中心"Tab → 应立即显示专家列表（不再空白）
3. 在"专家中心"点击任意分类 → 切换到"我的专家"Tab → 应显示"我的专家"列表（不再空白）
4. 切换回"专家中心"Tab → 分类应重置为"全部"
src/lib/expert-loader.ts.bak-20260507
