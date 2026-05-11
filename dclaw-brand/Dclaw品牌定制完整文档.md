# Dclaw 品牌定制完整文档

> 最后更新：2026-05-01

---

## 1. 品牌资产

### 1.1 产品信息

| 项目 | 值 |
|------|-----|
| 产品名称 | Dclaw |
| App ID | com.dclaw.app |
| 默认模型 | DeepSeek (deepseek-chat) |
| API 地址 | api.deepseek.com/v1 |

### 1.2 图标文件

图标存放位置：`dclaw-brand/icons/`

| 文件 | 用途 |
|------|------|
| `icon.ico` | Windows 应用图标（打包必需，需 ≥256x256） |
| `icon.png` | 源文件（161KB） |
| `logo-*.png` | 各尺寸 Logo |
| `128x128.png` ~ `512x512.png` | 各尺寸图标 |

**重要**：`icon.ico` 必须存在且 ≥256x256，否则 electron-builder 打包报错

### 1.3 图标恢复命令

```bash
# 从桌面备份恢复图标
cp /c/Users/40832/Desktop/1/icon.ico /e/ClawX/resources/icons/icon.ico
```

---

## 2. AIGC 集成

### 2.1 网站信息

| 项目 | 值 |
|------|-----|
| 前端地址 | https://aigc.dayunzhonglian.com/hthotpc/100000 |
| API Base | https://aigc.dayunzhonglian.com |
| site_id | 100000 |
| channel | pc |

### 2.2 核心 API

```bash
# 生成接口
POST /api/ht_hot/hthotwork
Body: {"app":"image","key":"duomi_gpt-image-2-2K","input":{"prompt":"...","size":"1K"}}

# 查询接口
GET /api/ht_hot/hthotwork?app=image&type=to_image&page=1&limit=20

# 认证方式
Authorization: Bearer {token}
```

### 2.3 Token 获取

- **来源**：AIGC 网站 Cookie 中的 `token` 字段
- **格式**：JWT，有效期至 2026-05-31
- **获取方法**：
  1. 浏览器打开 https://aigc.dayunzhonglian.com/hthotpc/100000
  2. F12 → Application → Cookies → 复制 `token` 值

### 2.4 Token 配置

配置路径：`~/.dclaw/aigc-config.json`

```json
{
  "token": "your-jwt-token-here",
  "site_id": "100000",
  "channel": "pc"
}
```

### 2.5 支持模型（112个）

| 类型 | 数量 | 示例 |
|------|------|------|
| 图片生成 | 35 | gpt-image-2, wan2.7-image, cogview3 |
| 视频生成 | 71 | kling-v3, sora2, jimeng, viduq3, veo-3 |
| 语音/克隆 | 6 | cosyvoice, clone-voice |
| AI 助手 | 18 | image-to-prompt, gpt-chat |

### 2.6 使用方式

```
/aigc 生成一只可爱的橘猫
/aigc 赛博朋克城市夜景 --size=2K
/aigc 日出动画 --type=video
/aigc 山水画 --model=wan2.7-image
```

### 2.7 Skill 文件位置

```
dclaw-skills/aigc/
├── SKILL.md           # Skill 定义文档
└── scripts/
    ├── aigc.js        # 主脚本（文生图/图生图/视频生成）
    └── config.js      # 模型配置获取（112 个模型）
```

---

## 3. 模型 API 配置

### 3.1 DeepSeek

| 项目 | 值 |
|------|-----|
| 模型 | deepseek-chat |
| API 地址 | api.deepseek.com/v1 |
| 状态 | 默认模型 |

### 3.2 DeepSeek V4-Pro 支持

- **OpenClaw 版本要求**：4.27+ 才原生支持 `deepseek-v4-pro`
- **当前版本**：4.23（不支持）
- **已知问题**：reasoning_content 400 错误需等待官方修复
- **替代方案**：使用 Flash 模型 + 提示词引导推理过程

---

## 4. 技能商店镜像

### 4.1 镜像配置

| 优先级 | 镜像地址 |
|--------|----------|
| 主镜像 | cn.clawhub-mirror.com |
| 备用镜像 | lightmake.site/api/v1 |

### 4.2 热榜索引

```bash
https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills.json
```

### 4.3 搜索/下载 API

```bash
# 搜索
GET https://lightmake.site/api/v1/search?q={q}&limit={n}

# 下载
GET https://lightmake.site/api/v1/download?slug={slug}
```

---

## 5. 改造记录

### 5.1 已完成的改造

| 日期 | 改造项 | 文件 | 说明 |
|------|--------|------|------|
| 2026-04-29 | 托盘菜单中文化 | electron/main/tray.ts | 全部改为中文 |
| 2026-04-29 | 开机启动项 | electron/main/launch-at-startup.ts | 名称改为 Dclaw |
| 2026-04-29 | 网关显示名称 | electron/gateway/ws-client.ts | 显示 Dclaw |
| 2026-04-29 | 帮助菜单中文化 | electron/main/menu.ts | Documentation→使用文档等 |
| 2026-04-29 | 技能下载镜像 | electron/gateway/clawhub.ts | 切换为国内镜像 |
| 2026-04-29 | 技能页面翻译 | src/i18n/locales/zh/skills.json | 修复翻译缺失 |
| 2026-05-01 | @ 专家显示 | src/pages/Chat/ChatInput.tsx | 显示中文 role |
| 2026-05-01 | AIGC 内嵌面板 | electron/main/aigc-panel.ts | BrowserView 集成 |
| 2026-05-01 | AIGC 页面路由 | src/pages/Aigc/index.tsx | /aigc 路由 |
| 2026-05-01 | AIGC Skill | dclaw-skills/aigc/ | 内置文生图/视频生成 |

### 5.2 关键代码位置

#### 托盘中文化
```typescript
// electron/main/tray.ts
tooltip: "Dclaw - AI 助手"
菜单项: 显示窗口/网关状态/运行中/快捷操作/打开聊天/打开设置/检查更新/退出 Dclaw
```

#### @ 专家显示
```typescript
// src/pages/Chat/ChatInput.tsx (第994行)
// 优先显示专家 role，无匹配时 fallback 到原名
{EXPERT_MAP[agent.id]?.role || agent.name}
```

### 5.3 专家广场配置

```typescript
// src/pages/Experts/experts.config.ts
const EXPERTS = [
  { id: 'expert-kai',     name: 'Kai',     role: '内容创作专家' },
  { id: 'expert-phoebe',  name: 'Phoebe',  role: '数据分析报告师' },
  { id: 'expert-jude',    name: 'Jude',    role: '电商运营专家' },
  { id: 'expert-ulla',    name: 'Ula',     role: '销售教练' },
  { id: 'expert-maya',    name: 'Maya',    role: '抖音策略师' },
  { id: 'expert-ben',     name: 'Ben',     role: '品牌策略师' },
];
```

---

## 6. Git 与打包

### 6.1 Git 信息

| 项目 | 值 |
|------|-----|
| 源码路径 | E:\ClawX |
| GitHub Fork | https://github.com/guiyingyi2021/ClawX.git |
| 分支 | dclaw-private（品牌定制代码） |

### 6.2 打包命令

```bash
# 必须使用此命令（跳过预安装 skills，避免 app.asar 占用）
SKIP_PREINSTALLED_SKILLS=1 pnpm run build

# 打包输出
E:/ClawX/release/Dclaw-1.0.0-win-x64.exe
```

### 6.3 上游同步规范

1. 备份：`git stash push -m "backup before sync"`
2. 合并：`git fetch upstream && git merge upstream/main --no-edit`
3. 检查冲突，逐一确认关键定制
4. 确认图标存在：`resources/icons/icon.ico` ≥256x256
5. 打包：`SKIP_PREINSTALLED_SKILLS=1 pnpm run build`

### 6.4 关键检查点

同步上游后必须确认以下文件/代码存在：
- [ ] `resources/icons/icon.ico` - Dclaw 图标
- [ ] `src/i18n/locales/zh/` - 中文翻译
- [ ] `electron/main/tray.ts` - 托盘中文化
- [ ] `package.json` - name: dclaw, version: 1.0.0
- [ ] `electron/main/aigc-panel.ts` - AIGC 面板

---

## 7. 备份文件

| 文件 | 说明 |
|------|------|
| `dclaw-brand/icons/` | 所有图标源文件 |
| `dclaw-skills/aigc/` | AIGC Skill |
| `backup/ChatInput-*.tsx.bak` | ChatInput.tsx 备份 |
| `backup/ClawX-*/` | ClawX 完整备份 |

---

## 8. 联系人/资源

- **上游仓库**：ValueCell-ai/ClawX
- **Skill 市场**：cn.clawhub-mirror.com
- **AIGC 网站**：https://aigc.dayunzhonglian.com
