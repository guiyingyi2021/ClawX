# Dclaw 与 ClawX 同步操作手册

> 让 Dclaw 始终跟随 ClawX 上游更新，同时保留品牌定制功能

---

## 📁 目录结构

```
dclaw-brand/                      # 品牌定制包（放在 ClawX 仓库外）
├── rebrand-clawx.py              # 品牌定制脚本
├── icons/                        # Dclaw 图标文件
│   ├── icon.png
│   ├── icon.ico
│   └── ...
├── backup/
│   └── clawx_original/           # 自动备份的原始文件
└── manifest.json                  # 自动生成，记录定制状态
```

---

## 🚀 首次设置

### 1. Fork ClawX

```bash
# 在 GitHub 上 Fork https://github.com/ValueCell-ai/ClawX
# 克隆到本地
git clone https://github.com/你的用户名/ClawX.git E:/ClawX
cd E:/ClawX
```

### 2. 添加上游仓库

```bash
# 添加上游为 remote
git remote add upstream https://github.com/ValueCell-ai/ClawX.git

# 验证
git remote -v
# 输出应该类似：
#   origin    https://github.com/你的用户名/ClawX.git (fetch)
#   upstream  https://github.com/ValueCell-ai/ClawX.git (fetch)
```

### 3. 应用品牌定制

```bash
# 在 ClawX 目录执行定制脚本
cd E:/ClawX
python c:/Users/40832/WorkBuddy/20260429101446/dclaw-brand/rebrand-clawx.py apply --project-dir E:/ClawX
```

### 4. 提交你的定制

```bash
git add .
git commit -m "feat: add Dclaw brand customization"
git push origin master
```

---

## 🔄 日常同步流程

### 每次同步前，先确保工作区干净

```bash
cd E:/ClawX

# 1. 提交或暂存你的本地改动
git status
git add .
git commit -m "chore: working commit before sync"
```

### 同步上游更新

```bash
# 2. 拉取上游最新代码
git fetch upstream

# 3. 切换到 master，合并上游更新
git checkout master
git merge upstream/v0.3.11   # 或 upstream/master
# 如果有冲突，解决冲突后：
git add .
git commit -m "merge: resolve conflicts from upstream"
```

### 应用品牌定制

```bash
# 4. 重新应用品牌定制
python c:/Users/40832/WorkBuddy/20260429101446/dclaw-brand/rebrand-clawx.py apply --project-dir E:/ClawX

# 5. 提交定制更新
git add .
git commit -m "feat: reapply Dclaw brand after upstream sync"
git push origin master
```

### 测试

```bash
# 6. 构建测试
pnpm install
SKIP_PREINSTALLED_SKILLS=1 pnpm run build

# 7. 运行测试版本
E:/ClawX/release/win-unpacked/Dclaw.exe
```

---

## ✅ 上游同步规范流程（推荐）

> 原则：更新和依赖下载完成后，先检查冲突/覆盖，再打包

```
1. 备份当前分支
   git stash push -m "backup before sync"

2. 合并上游
   git fetch upstream
   git merge upstream/main --no-edit

3. 检查冲突
   - 有冲突 → 手动解决，逐一确认关键定制是否保留
   - 无冲突 → 检查是否覆盖（diff 对比关键文件）

4. 关键检查点（必须确认存在的文件/代码）
   ✓ resources/icons/icon.ico   → Dclaw 图标（需从桌面1文件夹恢复，否则打包报错"must be at least 256x256"）
   ✓ resources/icons/*.png      → Dclaw PNG 图标
   ✓ src/i18n/locales/        → 中文翻译
   ✓ electron/main/tray.ts     → 托盘中文化
   ✓ package.json              → name: dclaw, version: 1.0.0
   ✓ scripts/after-pack.cjs    → kimi 去重代码（合并上游后可能需要删除 stageOpenClawRuntimeForPackagedApp 调用）
   ✓ electron/main/aigc-panel.ts → AIGC 面板

**icon.ico 恢复命令**：
```bash
cp /c/Users/40832/Desktop/1/icon.ico E:/ClawX/resources/icons/icon.ico
```

5. 确认无误后打包
   SKIP_PREINSTALLED_SKILLS=1 pnpm run build

6. 推送前再次确认无冲突
   git status
```

---

## 🔧 同步策略建议

### 按更新频率选择策略

| 场景 | 建议策略 |
|------|---------|
| ClawX 小版本更新（bug修复） | 每周同步一次 |
| ClawX 大版本更新（v0.3→v0.4） | 先在测试分支验证 |
| ClawX 新功能重要更新 | 等 1-2 周看社区反馈 |

### 处理冲突的原则

```
冲突文件分为两类：

1. 你的定制文件（品牌相关）
   - resources/icons/*         → 保留你的（不需要合并）
   - src/assets/logo.svg       → 保留你的（不需要合并）
   - src/Sidebar.tsx          → 需要手动合并，保留你的品牌名 + 合并上游新功能

2. 核心代码文件（上游更新）
   - src/App.tsx              → 优先使用上游版本（可能有安全修复）
   - package.json             → 保留你的 name/description，合并上游的 dependencies
```

---

## 📋 常用 Git 命令速查

```bash
# 查看当前状态
git status

# 查看有哪些上游更新
git log upstream/master --oneline -10

# 查看改动差异
git diff upstream/master

# 查看特定文件的改动
git diff upstream/master -- src/App.tsx

# 临时藏起本地改动（同步时用）
git stash
# 同步完成后恢复
git stash pop

# 查看分支
git branch -a

# 创建同步专用分支
git checkout -b sync-test
# 测试完后删掉
git branch -d sync-test
```

---

## ⚠️ 注意事项

1. **打包命令** - 必须使用 `SKIP_PREINSTALLED_SKILLS=1 pnpm run build`，否则 app.asar 文件可能被占用导致打包失败
2. **不要直接修改 `node_modules/`** - 这些是依赖，重装就没了
3. **图标文件** - 上游更新时图标结构可能变，定制后要验证
4. **electron-builder.yml** - 上游可能改变配置结构，要手动检查
5. **package.json scripts** - 上游可能新增构建命令，rebrand.py 会自动处理
6. **版本号** - 如果上游改了 OpenClaw 版本，参考本文档顶部的版本兼容性说明

---

## 📌 版本兼容性提醒

| ClawX 版本 | OpenClaw 版本 | 备注 |
|-----------|--------------|------|
| v0.3.11 | 4.15 | ✅ 稳定，无已知 Bug |
| v0.4.0-alpha | 4.26 | ⚠️ 有性能 Bug（2026.4.26 已知问题） |
| v0.4.x (预计) | ? | 等待上游修复 |

**建议**：同步时优先使用 `upstream/v0.3.11` 或 `upstream/master`，避免 alpha 版本。

---

## 🎯 推荐的工作流

```
1. 平时在 master 分支开发
2. 上游有大更新时：
   - 创建 sync-test 分支
   - 在测试分支合并上游
   - 应用定制，测试
   - 没问题再合并回 master
```

---

## 🆘 出问题怎么办

### 还原到上游原始状态

```bash
git checkout upstream/master -- .
git commit -m "chore: reset to upstream state"
```

### 还原品牌定制

```bash
python rebrand-clawx.py revert --project-dir E:/ClawX
```

### 彻底重来

```bash
# 删掉本地克隆，重新 Fork
rm -rf E:/ClawX
# 重新 clone，重新 apply
```
