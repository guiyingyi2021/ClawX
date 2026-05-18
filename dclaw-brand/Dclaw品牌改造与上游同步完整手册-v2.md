# Dclaw 品牌改造与上游同步完整手册

> **版本**: v2.0 (合并完整版)  
> **创建时间**: 2026-05-16  
> **维护者**: Dclaw Team  
> **目的**: 统一所有Dclaw品牌改造和上游同步的文档，避免重复

---

## 📋 目录

1. [快速开始](#快速开始)
2. [上游同步流程](#上游同步流程)
3. [Dclaw品牌改造](#dclaw品牌改造)
4. [验证与测试](#验证与测试)
5. [Git提交规范](#git提交规范)
6. [问题排查](#问题排查)
7. [专家广场改造](#专家广场改造)
8. [AIGC网站集成](#aigc网站集成)
9. [专家召唤功能统一](#专家召唤功能统一)
10. [专家状态判断Bug修复](#专家状态判断bug修复)
11. [三Tab召唤逻辑优化](#三tab召唤逻辑优化)
12. [模型配置帮助文档链接替换](#模型配置帮助文档链接替换)
13. [我的专家Tab本地索引兜底](#我的专家tab本地索引兜底)
14. [专家中心Tab切换空白修复](#专家中心tab切换空白修复)
15. [内置Skills扩展](#内置skills扩展)
16. [附录](#附录)

---

## 🚀 快速开始

### 首次设置（只需一次）

```bash
# 1. Fork ClawX仓库
# 在 GitHub 上 Fork https://github.com/ValueCell-ai/ClawX

# 2. 克隆到本地
git clone https://github.com/你的用户名/ClawX.git E:/ClawX
cd E:/ClawX

# 3. 添加上游仓库
git remote add upstream https://github.com/ValueCell-ai/ClawX.git

# 4. 验证remote配置
git remote -v
# 应该看到：
#   origin    https://github.com/你的用户名/ClawX.git (fetch)
#   upstream  https://github.com/ValueCell-ai/ClawX.git (fetch)

# 5. 创建Dclaw品牌分支
git checkout -b dclaw-private
```

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

### 日常同步快捷命令

```bash
# 一键同步脚本（保存为 sync-dclaw.sh）
#!/bin/bash
cd E:/ClawX

echo "=== Dclaw 上游同步开始 ==="

# 1. 备份当前状态
git stash push -m "backup before sync $(date)"

# 2. 获取上游更新
git fetch upstream

# 3. 合并上游代码
git merge upstream/main --no-edit

# 4. 执行Dclaw品牌改造
echo "请手动执行品牌改造脚本..."

# 5. 打包测试
SKIP_PREINSTALLED_SKILLS=1 pnpm run build

echo "=== 同步完成 ==="
```

---

## 🔄 上游同步流程

### 标准流程（推荐）

```
开始
  ↓
[1. 备份当前分支]
  ↓
[2. 获取上游更新]  git fetch upstream
  ↓
[3. 合并上游代码]  git merge upstream/main
  ↓
[4. 解决冲突]     保留Dclaw定制 + 合并上游修复
  ↓
[5. 执行品牌改造]  见"Dclaw品牌改造"章节
  ↓
[6. 打包测试]      SKIP_PREINSTALLED_SKILLS=1 pnpm run build
  ↓
[7. 验证]          见"验证与测试"章节
  ↓
[8. 提交代码]      见"Git提交规范"章节
  ↓
完成
```

### 详细步骤

#### 步骤1：备份当前分支（强制）

```bash
# 方法A：使用git stash（推荐）
git stash push -m "backup before sync $(date +%Y-%m-%d-%H%M%S)"

# 方法B：创建备份分支
git checkout -b backup/before-sync-$(date +%Y-%m-%d-%H%M%S)
git checkout sync-test  # 切回工作分支

# 方法C：直接提交当前工作
git add .
git commit -m "chore: working commit before sync"
```

**⚠️ 关键**：永远在同步前备份！

#### 步骤2：获取上游更新

```bash
cd E:/ClawX
git fetch upstream

# 查看上游有哪些更新
git log upstream/main --oneline -10

# 查看上游改动了哪些文件
git diff HEAD upstream/main --stat
```

#### 步骤3：合并上游代码

```bash
# 合并上游main分支
git merge upstream/main --no-edit

# 如果有冲突，Git会提示：
# CONFLICT (content): Merge conflict in <file>
```

#### 步骤4：解决冲突

**冲突文件分类处理**：

| 文件类型 | 处理方式 | 命令示例 |
|---------|---------|---------|
| Dclaw特有文件 | 保留ours版本 | `git checkout --ours <file>` |
| 品牌相关文件 | 保留ours版本 | `git checkout --ours package.json` |
| 需要合并的文件 | 手动合并 | 编辑文件，保留双方改动 |
| 上游Bug修复 | 接受上游版本 | `git checkout --theirs <file>` |

**Dclaw特有文件清单**（必须保留ours版本）：

- [ ] `package.json` - name: "dclaw", productName: "Dclaw"
- [ ] `electron/main/index.ts` - 使用 `ensureDclawContext`
- [ ] `electron/utils/openclaw-workspace.ts` - Dclaw工作区管理
- [ ] `src/components/layout/Sidebar.tsx` - 专家中心、AIGC导航
- [ ] `src/stores/chat.ts` - `newSessionForAgent` 函数
- [ ] `electron/main/tray.ts` - 托盘中文化
- [ ] `src/i18n/locales/` - 中文翻译

**手动合并示例**（以 `src/stores/chat.ts` 为例）：

```bash
# 1. 查看冲突内容
cat src/stores/chat.ts

# 2. 手动编辑文件，保留Dclaw函数 + 添加上游新函数
# 保留：
#   - newSessionForAgent 函数
#   - Dclaw特有的session管理逻辑
# 添加：
#   - 上游新增的 renameSession 函数
#   - 上游修复的bug

# 3. 标记冲突已解决
git add src/stores/chat.ts
```

**提交合并**：

```bash
git add .
git commit -m "merge: upstream/main into sync-test (vX.Y.Z)

- 保留Dclaw品牌定制
- 合并上游bug修复和新功能
- 解决冲突：<列出冲突文件>

Co-authored-by: Dclaw Team <dclaw@dclaw.com>"
```

### 同步策略建议

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

## 🎨 Dclaw品牌改造

### 三遍扫描法（推荐）

#### 第一遍：批量替换（自动）

```bash
cd E:/ClawX

# 1. 搜索所有需要替换的引用
grep -rn "ClawX\|clawx" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.json" \
  | grep -v "node_modules\|\.git\|backup\|dist\|build\|ValueCell-ai\|ClawX/" \
  > /tmp/dclaw-replace-list.txt

# 2. 查看有多少处需要修改
wc -l /tmp/dclaw-replace-list.txt

# 3. 使用PowerShell批量替换（更可靠）
powershell -Command "
\$files = Get-ChildItem -Path 'E:\ClawX' -Recurse -Include *.ts,*.tsx,*.js,*.json | 
    Where-Object { \$_.FullName -notmatch 'node_modules|\.git|backup|dist|build' }
foreach (\$file in \$files) {
    (Get-Content \$file.FullName -Encoding UTF8) -replace 'ClawX', 'Dclaw' -replace 'clawx', 'dclaw' | 
        Set-Content \$file.FullName -Encoding UTF8
}
"

# 4. 验证替换结果
grep -rn "ClawX\|clawx" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.json" \
  | grep -v "node_modules\|\.git\|backup\|dist\|build\|ValueCell-ai\|ClawX/" \
  || echo "✅ 所有ClawX引用已替换"
```

#### 第二遍：手动检查关键文件（防止语法错误）

```bash
# 1. 检查是否有语法错误（重点检查 .ts/.tsx 文件）
find . -name "*.ts" -o -name "*.tsx" | \
  grep -v "node_modules\|\.git\|backup\|dist\|build" | \
  xargs grep -l "''\|'''\|' '" | head -20

# 2. 重点检查之前出过问题的文件
cat electron/utils/uv-env.ts | grep -n "dclaw\|clawx"

# 3. 检查JSON文件格式
for file in $(find . -name "*.json" | grep -v "node_modules\|\.git\|backup\|dist\|build"); do
  python -m json.tool "$file" > /dev/null 2>&1 || echo "❌ JSON格式错误: $file"
done
```

**⚠️ 常见错误**：

| 错误 | 原因 | 修复 |
|------|------|------|
| `syntax error: Unterminated string literal` | 替换时引入多余引号 | 检查 `'dclaw''` → 应该是 `'dclaw'` |
| `JSON parse error` | 替换破坏JSON结构 | 手动检查JSON文件 |
| `module not found` | 替换了不该替换的路径 | 恢复备份，重新替换 |

#### 第三遍：验证替换结果

```bash
# 1. 再次搜索，确认无遗漏
grep -rn "ClawX\|clawx" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.json" \
  | grep -v "node_modules\|\.git\|backup\|dist\|build\|ValueCell-ai\|ClawX/"

# 2. 检查关键文件
[ -f "electron/main/index.ts" ] && echo "✅ 主进程文件存在"
[ -f "package.json" ] && echo "✅ package.json存在"

# 3. 验证package.json中的Dclaw配置
grep '"name": "dclaw"' package.json || echo "❌ package.json name错误"
grep '"productName": "Dclaw"' package.json || echo "❌ package.json productName错误"
```

### 分类修改清单（按优先级）

#### 🔴 高优先级（用户界面会看到）

- [ ] `src/components/file-preview/FilePreviewBody.tsx` - 用户提示文本
- [ ] `src/components/file-preview/WorkspaceBrowserBody.tsx` - 用户提示文本
- [ ] `src/pages/Dreams/index.tsx` - Dreams功能文本
- [ ] `src/pages/**/*.tsx` - 所有页面标题、提示文本
- [ ] `src/components/layout/Sidebar.tsx` - 侧边栏导航

#### 🟡 中优先级（配置文件）

- [ ] `package.json` - 应用名称、描述
- [ ] `electron-builder.yml` / `package.json` (build字段) - 打包配置
- [ ] `tailwind.config.js` - 注释中的品牌引用
- [ ] `dclaw-brand/manifest.json` - 品牌配置
- [ ] `src/i18n/locales/` - 中文翻译文件

#### 🟢 低优先级（注释和文档）

- [ ] `electron/utils/*.ts` - 代码注释
- [ ] `src/**/*.ts`, `*.tsx` - 代码注释
- [ ] `README.md`, `docs/**` - 文档

#### 🔵 特殊文件（需要手动检查）

- [ ] `electron/main/index.ts` - 应用主入口，窗口标题
- [ ] `electron/gateway/manager.ts` - Gateway配置
- [ ] `electron/utils/paths.ts` - 路径配置
- [ ] `electron/utils/config.ts` - 配置路径

### 使用脚本自动改造（可选）

```bash
# 使用dclaw-brand/rebrand-clawx.py脚本
cd E:/ClawX
python c:/Users/40832/WorkBuddy/20260429101446/dclaw-brand/rebrand-clawx.py apply --project-dir E:/ClawX
```

**脚本自动完成**：
- ✅ `package.json` → name/productName 改为 Dclaw
- ✅ `electron-builder.json` → appId/copyright 更新
- ✅ `build/` 图标文件替换
- ✅ 源码中所有 "ClawX" 字符串替换为 "Dclaw"
- ✅ 默认模型设置为 DeepSeek

### 一键品牌替换（自动）

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

### 手动检查项（脚本跑完后）

#### About 页版权声明
找到 About/关于 页面组件（通常在 `src/pages/` 或 `src/components/`），
确认包含如下声明（Apache-2.0 要求）：

```
Built on Qclaw (github.com/qiuzhi2046/Qclaw)
Copyright (C) 秋芝2046 Team — Apache-2.0 License
```

可以放在页脚小字里，不影响品牌观感。

#### macOS 图标（icns 格式）
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

#### DeepSeek API Key 引导
在用户首次启动界面（Onboarding），将 API Key 输入框的说明改为：

```
请输入您的 DeepSeek API Key
获取地址：platform.deepseek.com/api_keys
格式：sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ✅ 验证与测试

### 回归测试清单（强制）

**⚠️ 这是最关键的步骤！** 不能假设脚本执行成功，必须逐项验证。

#### 1. 打包应用

```bash
cd E:/ClawX
SKIP_PREINSTALLED_SKILLS=1 pnpm run build
```

**⚠️ 如果打包失败**：
1. 检查错误信息（通常是语法错误）
2. 定位问题文件：`grep -n "syntax error" build.log`
3. 修复后重新打包

#### 2. 启动测试

```bash
# 启动Dclaw
Start-Process -FilePath "E:\ClawX\release\win-unpacked\Dclaw.exe" -WindowStyle Normal

# 等待5秒让应用初始化
Start-Sleep -Seconds 5

# 检查进程
tasklist | Select-String "Dclaw"
```

**✅ 通过标准**：
- 应用正常启动（5个进程）
- 无崩溃或无响应

#### 3. 日志检查

```bash
# 查看最新日志
tail -100 ~/AppData/Roaming/Dclaw/logs/dclaw-$(Get-Date -Format "yyyy-MM-dd").log

# 搜索错误
Select-String "ERROR|Failed|Exception" ~/AppData/Roaming/Dclaw/logs/dclaw-*.log -Context 2,2
```

**✅ 通过标准**：
- 日志文件名：`dclaw-YYYY-MM-DD.log`（不是clawx-）
- 无FATAL ERROR
- 无 `ensureClawXIdentityFile` 错误
- ⚠️ WARN可接受（如Gateway握手超时）

#### 4. 功能验证（手动）

- [ ] 打开应用，检查窗口标题是否为"Dclaw"
- [ ] 打开文件预览，检查提示文本是否显示"Dclaw"
- [ ] 检查设置页面，确认应用名称为"Dclaw"
- [ ] 测试AIGC功能（如果适用）
- [ ] 测试专家中心功能（如果适用）
- [ ] 检查托盘图标和菜单是否中文化
- [ ] 检查关于页面版权声明是否包含 Apache-2.0

### 自动化验证脚本（可选）

保存为 `verify-dclaw-transformation.sh`：

```bash
#!/bin/bash
# Dclaw 改造验证脚本
cd E:/ClawX

echo "=== Dclaw 改造验证 ==="
echo ""

# 1. package.json
echo "✓ 检查 package.json..."
grep '"name": "dclaw"' package.json || echo "  ❌ name 不是 dclaw"
grep '"productName": "Dclaw"' package.json || echo "  ❌ productName 不是 Dclaw"
echo ""

# 2. 主进程
echo "✓ 检查 electron/main/index.ts..."
grep "ensureDclawContext" electron/main/index.ts || echo "  ❌ 没有 ensureDclawContext"
echo ""

# 3. 侧边栏品牌
echo "✓ 检查 Sidebar.tsx..."
grep "Dclaw" src/components/layout/Sidebar.tsx || echo "  ❌ 侧边栏没有 Dclaw 品牌"
echo ""

# 4. 图标文件
echo "✓ 检查图标文件..."
test -f build/icon.ico && echo "  ✅ icon.ico 存在" || echo "  ❌ icon.ico 缺失"
test -f build/icon.png && echo "  ✅ icon.png 存在" || echo "  ❌ icon.png 缺失"
echo ""

# 5. Dclaw 特有功能
echo "✓ 检查 Dclaw 特有功能..."
grep "newSessionForAgent" src/stores/chat.ts || echo "  ❌ newSessionForAgent 缺失"
grep "/experts" src/components/layout/Sidebar.tsx || echo "  ❌ 专家中心导航缺失"
grep "/aigc" src/components/layout/Sidebar.tsx || echo "  ❌ AIGC 导航缺失"
echo ""

echo "=== 验证完成 ==="
```

执行验证：

```bash
bash verify-dclaw-transformation.sh
```

**所有检查必须通过**，否则重新执行改造。

---

## 📝 Git提交规范

### 检查修改内容

```bash
cd E:/ClawX
git status
git diff --stat
```

### 提交策略

#### 方案A：分批次提交（推荐）

```bash
# 第一批：核心文件（electron/ + package.json）
git add electron/ package.json electron-builder.yml
git commit -m "rebrand: core Dclaw transformation (electron main process)

- Replace ClawX with Dclaw in electron/main/
- Update package.json name and productName
- Modify tray.ts and menu.ts for Chinese localization

Co-authored-by: Dclaw Team <dclaw@dclaw.com>"

# 第二批：前端文件（src/）
git add src/
git commit -m "rebrand: frontend Dclaw transformation (UI text + components)

- Update all UI text from ClawX to Dclaw
- Modify Sidebar.tsx for experts center and AIGC navigation
- Update i18n locales for Chinese translation

Co-authored-by: Dclaw Team <dclaw@dclaw.com>"

# 第三批：配置和注释
git add tailwind.config.js dclaw-brand/ docs/
git commit -m "rebrand: config and comments Dclaw transformation

- Update comments in utils/
- Modify tailwind config comments
- Update brand manifest

Co-authored-by: Dclaw Team <dclaw@dclaw.com>"
```

**优点**：便于回滚，每次提交都是完整的功能单元

#### 方案B：原子提交（如果修改较少）

```bash
git add .
git commit -m "rebrand: complete ClawX→Dclaw rename (N files)

- Replace all 'ClawX' references with 'Dclaw' in source code
- Update UI text, comments, and configuration files
- Fix uv-env.ts syntax error introduced in previous commit

Co-authored-by: Dclaw Team <dclaw@dclaw.com>"
```

### 推送代码

```bash
git push origin sync-test   # 或 dclaw-private
```

---

## 🔧 问题排查

### 常见问题

#### 问题1：打包失败（语法错误）

**症状**：
```
error during build:
[vite:esbuild] Transform failed with 1 error:
E:/ClawX/electron/utils/uv-env.ts:31:64: ERROR: Unterminated string literal
```

**原因**：批量替换时引入多余引号

**解决**：
```bash
# 1. 定位问题文件
cat electron/utils/uv-env.ts | grep -n "dclaw\|clawx"

# 2. 手动修复（如第31行）
# 错误：return path.join(getOpenClawConfigDir(), 'dclaw', 'uv.toml'');
# 正确：return path.join(getOpenClawConfigDir(), 'dclaw', 'uv.toml');

# 3. 重新打包
SKIP_PREINSTALLED_SKILLS=1 pnpm run build
```

#### 问题2：应用启动后崩溃

**症状**：Dclaw进程启动后立即崩溃

**排查**：
```bash
# 查看日志
cat ~/AppData/Roaming/Dclaw/logs/dclaw-$(Get-Date -Format "yyyy-MM-dd").log | grep -A 5 -B 5 "ERROR\|Exception\|Crash"
```

**常见原因**：
- 图标文件缺失或格式错误
- package.json 格式错误
- 主进程代码语法错误

#### 问题3：Git合并冲突无法解决

**症状**：冲突文件太多，不知道该保留哪个版本

**解决**：
```bash
# 1. 查看所有冲突文件
git status | grep "both modified"

# 2. 批量保留Dclaw版本（谨慎使用！）
git checkout --ours electron/main/index.ts
git checkout --ours package.json
git checkout --ours src/components/layout/Sidebar.tsx

# 3. 需要合并的文件，手动编辑后标记为解决
git add <file>
git commit --no-edit
```

#### 问题4：上游同步后Dclaw定制丢失

**症状**：同步后发现托盘菜单变回英文，专家中心消失

**原因**：没有正确保留Dclaw特有文件

**解决**：
```bash
# 1. 查看之前的Dclaw定制提交
git log --oneline | grep "dclaw\|rebrand"

# 2. 从之前的提交中恢复Dclaw特有文件
git checkout <dclaw-commit-hash> -- electron/main/tray.ts
git checkout <dclaw-commit-hash> -- src/components/layout/Sidebar.tsx

# 3. 重新提交
git add .
git commit -m "fix: restore Dclaw customizations after upstream sync"
```

### 回滚方案

#### 如果发现问题需要回滚

```bash
# 方法A：重置到备份分支
git reset --hard backup/before-sync-<timestamp>

# 方法B：撤销某次提交
git revert <commit-hash> --no-edit

# 方法C：强制回滚到某个提交
git reset --hard <commit-hash>
```

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

---

## 🎯 专家广场改造（2026-05-01）

### 改造背景

- 原版专家广场 @ 专家时显示英文原名（如 "Kai"），用户无法快速识别功能
- 专家列表硬编码在前端，每天更新需要重新打包，效率低下
- 需要实现远程动态更新专家配置，无需重新打包

### @ 显示中文角色名

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

### 专家配置混合模式（远程动态更新）

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

### 远程配置格式

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

### 新增专家流程（推荐）

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
`全部` `产品设计` `技术工程` `游戏空间` `数据智能` `营销增长` `内容创作` `销售商务` `金融投资` `运营人力` `项目质量` `法务安全` `行业顾问`

**新增专家步骤**：
1. 创建文件夹：`agents/{分类}/{专家ID}/`
2. 放入 `SOUL.md`（必须）+ `package.tar.gz`（必须）+ `IDENTITY.md`（可选）
3. 运行 `node generate-index.js` → 自动生成 `index.json`
4. `git push` 推送到 GitHub

**无需手动编辑任何 JSON 文件！**

### 旧版手动更新（已废弃）

~~编辑 `experts-remote-example.json` 并上传到服务器~~

请改用上述 `agents/` 目录结构。

**缓存策略**：
- 有效期：30 分钟
- 自动失效：超时后自动重新拉取
- 手动刷新：点击"检查更新"立即刷新

### 文件清单

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

### 验收标准

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

## 🌐 AIGC网站集成（2026-05-01）

### 集成方式
- **内嵌方案**：BrowserView 直接内嵌 AIGC 站点
- **Skill 方案**：`/aigc` 命令调用 AIGC API

### 关键参数
- **API Base**：https://aigc.dayunzhonglian.com
- **site_id**：100000
- **channel**：pc
- **Token 获取**：浏览器 Cookie → `token` 字段（JWT，有效期至 2026-05-31）

### 网站信息

| 项目 | 值 |
|------|-----|
| 前端地址 | https://aigc.dayunzhonglian.com/hthotpc/100000 |
| API Base | https://aigc.dayunzhonglian.com |
| site_id | 100000 |
| channel | pc |

### 核心 API

```bash
# 生成接口
POST /api/ht_hot/hthotwork
Body: {"app":"image","key":"duomi_gpt-image-2-2K","input":{"prompt":"...","size":"1K"}}

# 查询接口
GET /api/ht_hot/hthotwork?app=image&type=to_image&page=1&limit=20

# 认证方式
Authorization: Bearer {token}
```

### Token 获取

- **来源**：AIGC 网站 Cookie 中的 `token` 字段
- **格式**：JWT，有效期至 2026-05-31
- **获取方法**：
  1. 浏览器打开 https://aigc.dayunzhonglian.com/hthotpc/100000
  2. F12 → Application → Cookies → 复制 `token` 值

### Token 配置

配置路径：`~/.dclaw/aigc-config.json`

```json
{
  "token": "your-jwt-token-here",
  "site_id": "100000",
  "channel": "pc"
}
```

### 支持模型（112个）

| 类型 | 数量 | 示例 |
|------|------|------|
| 图片生成 | 35 | gpt-image-2, wan2.7-image, cogview3 |
| 视频生成 | 71 | kling-v3, sora2, jimeng, viduq3, veo-3 |
| 语音/克隆 | 6 | cosyvoice, clone-voice |
| AI 助手 | 18 | image-to-prompt, gpt-chat |

### 使用方式

```
/aigc 生成一只可爱的橘猫
/aigc 赛博朋克城市夜景 --size=2K
/aigc 日出动画 --type=video
/aigc 山水画 --model=wan2.7-image
```

### Skill 文件位置

```
dclaw-skills/aigc/
├── SKILL.md           # Skill 定义文档
└── scripts/
    ├── aigc.js        # 主脚本（文生图/图生图/视频生成）
    └── config.js      # 模型配置获取（112 个模型）
```

---

## 🔮 专家召唤功能统一（2026-05-02）

### 改造背景

- 原版专家中心（市场专家）和我的专家（本地专家）使用不同的召唤逻辑
- 市场专家：下载 SOUL.md → API 召唤
- 本地专家：IPC 召唤（需要本地 tar.gz 路径）
- **问题**：远程加载的专家（`isRemote: true`）缺少 `soulUrl` 字段，召唤时无法下载 SOUL.md，导致失败

### 核心改造：统一召唤逻辑

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

### 远程专家 soulUrl 自动生成

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

### 市场专家加载器

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

### 验收标准

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

### 文件清单

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

### 使用说明

**用户视角**：
1. 打开专家中心 → 浏览市场专家 → 点击「召唤」
2. 打开我的专家 → 浏览已安装专家 → 点击「召唤」
3. 所有专家都是一键召唤，无需手动配置

**开发者视角**：
- 新增专家：放入 `agents/{分类}/{专家ID}/` → 写 SOUL.md → 运行 `generate-index.js` → push
- 市场专家：自动从 `agency-agents-zh` 仓库同步
- 召唤逻辑：无需区分专家类型，统一走 `handleSummon`

---

## 🐛 专家状态判断Bug修复（2026-05-03）

### 问题描述

**现象**：
- "市场专家" Tab：未召唤的专家显示"使用中"
- "我的专家" Tab：同样的问题

**根本原因**：`installedAgents` 通过 `useCallback` + `useEffect` 间接更新，存在异步时机问题
- `checkInstalledAgents` 依赖 `[agents]`，但在 `useEffect` 的依赖数组中还耦合了 `activeTab`、`loadLocalExperts`、`loadMarketData`
- 逻辑复杂且同步不可靠，导致状态判断错误

### 修复方案

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

### 效果

- `installedAgents` 与 `agents` **严格同步**，无异步时机问题
- 未召唤的专家 → 显示「召唤」
- 已召唤的专家 → 显示「使用中」
- 编译验证：`pnpm run build:vite` ✅ 通过

### 涉及文件

**修改文件**：`src/pages/Experts/index.tsx`

| 改动 | 说明 |
|------|------|
| `useState` → `useMemo` | 直接从 `agents` 同步计算 `installedAgents` |
| 删除 `checkInstalledAgents` 函数 | 功能已被 `useMemo` 替代 |
| 删除所有 `checkInstalledAgents()` 调用 | 不再需要手动刷新 |
| 清理依赖数组 | 移除过时的 `checkInstalledAgents` 引用 |

**备份**：`E:/backup/index.tsx.20260503.bak`

### 验证

- 编译验证：`pnpm run build:vite` ✅ 通过
- UI 验证：待用户打包后验证状态显示是否正确

---

## 🔀 三Tab召唤逻辑优化与远程专家修复（2026-05-03）

### 三Tab"召唤中"按钮逻辑重构

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

### 引导文件英文默认值修复

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

### 远程专家召唤失败根因排查与修复

**问题现象**：
1. 从"我的专家"Tab召唤远程专家后，状态未更新
2. 只有历史学家的显示是"召唤中"，其他远程专家状态不变
3. 使用中Tab无法正常显示所有召唤的专家

**排查过程**（已记入 `docs/expert-square-debug.log`）：

| 阶段 | 发现 | 结论 |
|------|------|------|
| 第1轮 | 只有历史学家能显示 | `slugifyAgentId` 把中文ID转成空字符串 |
| 第2轮 | 修复后仍失败 | 需要同时存 `expert.id` 和 `expert.name` 到 `summonedAgentIds` |
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

### 专家广场工作日志建立

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

### 文件清单

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

### 验证状态

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

### 关键代码段

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

## 🔗 模型配置帮助文档链接替换（2026-05-07）

### 改造背景

- 设置页"模型配置"中 Custom Provider 的"飞书帮助文档"链接指向旧的飞书文档地址
- 需要替换为 Dclaw 自己的飞书帮助文档

### 修改内容

**修改文件**：`src/lib/providers.ts`

| 字段 | 旧值 | 新值 |
|------|------|------|
| `docsUrl` | `https://...feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#...` | `https://my.feishu.cn/wiki/VNuAweEcDixl5JkHDoycGNsLnDe` |
| `docsUrlZh` | `https://...feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#...` | `https://my.feishu.cn/wiki/VNuAweEcDixl5JkHDoycGNsLnDe` |

**涉及位置**：Custom Provider 配置定义（第195-196行）

**效果**：用户在模型配置页面点击"帮助文档"链接后，跳转至 Dclaw 飞书帮助文档

---

## 📚 我的专家Tab本地索引兜底+缓存策略优化（2026-05-08 ~ 2026-05-09）

### 改造背景

- "我的专家" Tab 中的远程自建专家每次都需要手动"检查更新"才能显示
- "专家中心" Tab 已有完善的缓存机制（localStorage + 30 分钟 TTL），启动即显示
- 需要让"我的专家"使用同样的缓存策略

### 本次核心成果（2026-05-09）

**问题根因**：`expert-loader.ts` 没有本地索引兜底，网络不好时远程专家加载失败。

**修改内容**：

| 文件 | 修改内容 |
|------|----------|
| `src/data/experts-index.json` | **新增**，从 `agents/index.json` 复制，作为本地索引兜底 |
| `src/lib/expert-loader.ts` | 引入本地索引，`loadExperts()` 优先同步返回本地数据 |
| `scripts/sync-experts-index.mjs` | **新增**，build 前自动同步最新索引到 `src/data/` |
| `package.json` | build 命令加入索引同步步骤 |

**效果**：现在"我的专家"Tab 即使完全断网，也能从本地索引显示远程专家列表。网络恢复后后台异步更新。

### 核心改造：与专家中心缓存策略统一

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

### 缓存策略对比

| 场景 | 旧行为 | 新行为 |
|------|--------|--------|
| 首次启动（无缓存） | 仅显示内置6个专家 | 立即显示内置 + 本地索引，后台异步拉取远程 |
| 再次启动（缓存未过期） | 每次后台拉取 | 直接读缓存，不发起网络请求 |
| 缓存已过期（30分钟后） | 每次后台拉取 | 返回缓存 → 后台异步刷新 |
| 点击"检查更新" | 强制拉取 | 强制拉取（不变） |

### 本地索引同步机制

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

### 文件清单

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

## 🔧 专家中心/我的专家Tab切换空白修复（2026-05-09）

### 问题描述

**现象**：
- 首次打开"专家中心"Tab → 页面空白，点击"刷新索引"后才显示
- 在"专家中心"Tab 点击某分类后，切换回"我的专家"Tab → 页面空白
- 关闭 Dclaw 重新打开后问题不再复现（与缓存状态强相关）

### 根因分析

**根因1（确定）：** `market-loader.ts` 的 `transformMarketExperts()` 只读取 `_flat` 字段，但 `market-experts-index.json` 的实际格式是 `{ "version": "...", "total": 196, "categories": {...} }`，**没有 `_flat` 字段**，导致首次加载返回空数组。

**根因2（高概率）：** 三个 Tab 共用 `activeCategory` 状态。在"专家中心"Tab 点击某分类（如"产品设计"）后切换回"我的专家"Tab 时，`activeCategory` 仍为该分类值，"我的专家"中对应分类的专家可能为空，过滤后显示空白。

### 修复内容

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

### 文件清单

**修改文件**：
```
src/lib/market-loader.ts     ← transformMarketExperts() + getMarketStats() 兼容无 _flat 格式
src/pages/Experts/index.tsx ← Tab 切换时重置 activeCategory 为"全部"
```

**无备份**（两处均为新增兼容逻辑，非破坏性修改）

### 验证方式

1. 删除 `localStorage` 中的 `dclaw-market-cache` 和 `dclaw-experts-cache`
2. 重新打开 Dclaw → 进入"专家中心"Tab → 应立即显示专家列表（不再空白）
3. 在"专家中心"点击任意分类 → 切换到"我的专家"Tab → 应显示"我的专家"列表（不再空白）
4. 切换回"专家中心"Tab → 分类应重置为"全部"

---

## 📦 内置Skills扩展（2026-05-11）

### 改造背景

Dclaw 需要更多内置 skills 来增强功能，但必须避免外部依赖（如 QClaw 专有 API）。

**用户需求**：
- 添加无外部依赖的实用 skills
- 优先级：高（核心功能）> 中（增强能力）> 低（便利功能）
- 有依赖的先不考虑，无依赖的安装为内置

### 依赖分析结果

**待评估 Skills**（来自 QClaw 内置 + WorkBuddy Marketplace）：

| Skill | 功能 | 优先级 | 依赖分析 | 结论 |
|-------|------|--------|----------|------|
| `online-search` | 在线搜索 | 🔴 高 | 依赖 QClaw API (`/proxy/prosearch`, `AUTH_GATEWAY_PORT`) | ❌ 跳过，需适配 |
| `qclaw-skill-creator` | Skill 创建向导 | 🔴 高 | 未找到（QClaw 专有） | ❌ 跳过 |
| `skill-creator` | Skill 创建工具 | 🔴 高 | 无外部依赖（指南类） | ✅ 安装 |
| `multi-search-engine` | 多搜索引擎 | 🟡 中 | 无 API key 需求（直接爬取） | ✅ 安装 |
| `skill-vetter` | Skill 质量检查 | 🟡 中 | 无外部依赖（代码审查工具） | ✅ 安装 |
| `ui-ux-pro-max` | UI/UX 设计专家 | 🟢 低 | 无外部依赖（bundled assets） | ✅ 安装 |
| `imap-smtp-email` | 邮件收发 | 🟢 低 | 需要用户配置邮箱凭证（非外部 API） | ✅ 安装 |
| `bdpan-storage` | 百度网盘集成 | 🟢 低 | 未找到 | ❌ 跳过 |

### 安装的 5 个 Skills

#### 1. `multi-search-engine` (v2.1.3)
- **来源**：`/c/Users/40832/.workbuddy/skills-marketplace/skills/multi-search-engine/`
- **功能**：集成 17 个搜索引擎（8 国内 + 9 国际），无需 API key
- **依赖**：仅需 `web_fetch` 工具（OpenClaw 内置）
- **文件数**：11 个（含 references/）

#### 2. `skill-vetter` (v1.0.0)
- **来源**：`/c/Users/40832/.workbuddy/skills-marketplace/skills/skill-vetter/`
- **功能**：Skill 安全审查工具，安装前检查 red flags
- **依赖**：无（纯审查指南）
- **文件数**：2 个

#### 3. `skill-creator` (v0.1.0)
- **来源**：`/c/Users/40832/.workbuddy/skills-marketplace/skills/skill-creator/`
- **功能**：创建和维护自定义 skills 的指南
- **依赖**：无（含 Python 脚本 `init_skill.py`、`package_skill.py`）
- **文件数**：7 个

#### 4. `ui-ux-pro-max`
- **来源**：`/c/Users/40832/.workbuddy/plugins/marketplaces/codebuddy-plugins-official/external_plugins/ui-ux-max-skill/skills/ui-ux-pro-max/`
- **功能**：UI/UX 设计专家，生成设计系统 tokens 和代码
- **依赖**：可选 `python3`（设计系统生成脚本）
- **文件数**：39 个（含 data/stacks/）

#### 5. `imap-smtp-email`
- **来源**：`/c/Users/40832/.workbuddy/skills-marketplace/skills/imap-smtp-email/`
- **功能**：通过 IMAP/SMTP 收发邮件
- **依赖**：需要用户配置邮箱凭证（`IMAP_HOST`, `IMAP_USER`, etc.）
- **文件数**：4 个（含 `setup.sh`, `package.json`）

### 安装步骤

**Step 1：复制 Skills 到内置目录**

```bash
# 工作目录：E:\ClawX

# 1. multi-search-engine
cp -r /c/Users/40832/.workbuddy/skills-marketplace/skills/multi-search-engine resources/openclaw/skills/

# 2. skill-vetter
cp -r /c/Users/40832/.workbuddy/skills-marketplace/skills/skill-vetter resources/openclaw/skills/

# 3. skill-creator
cp -r /c/Users/40832/.workbuddy/skills-marketplace/skills/skill-creator resources/openclaw/skills/

# 4. ui-ux-pro-max (从 WorkBuddy 官方插件复制，避免 QClaw 特定功能)
cp -r /c/Users/40832/.workbuddy/plugins/marketplaces/codebuddy-plugins-official/external_plugins/ui-ux-max-skill/skills/ui-ux-pro-max resources/openclaw/skills/

# 5. imap-smtp-email
cp -r /c/Users/40832/.workbuddy/skills-marketplace/skills/imap-smtp-email resources/openclaw/skills/
```

**Step 2：检查 QClaw 引用**

```bash
# 搜索是否有 QClaw 特定引用
grep -r "qclaw\|QClaw" "E:/ClawX/resources/openclaw/skills/" 2>/dev/null
```

**结果**：仅在旧的 DClaw 内置 skills（`dclaw-env`, `dclaw-rules`）的参考文档中发现 QClaw 引用，新复制的 5 个 skills 无 QClaw 引用。

**Step 3：提交到 Git**

```bash
cd E:/ClawX
git add resources/openclaw/skills/
git commit -m "feat: 添加 5 个无依赖内置 skills

- multi-search-engine: 17 个搜索引擎集成，无需 API key
- skill-vetter: Skill 安全审查工具
- skill-creator: Skill 创建指南
- ui-ux-pro-max: UI/UX 设计专家
- imap-smtp-email: 邮件收发（需用户配置）

来源: WorkBuddy skills-marketplace"
```

**Commit**：`36c1716` (branch: `sync-test`)

### 验证方法

**构建验证**：

```bash
cd E:\ClawX
SKIP_PREINSTALLED_SKILLS=1 pnpm run build
```

**检查输出**：

构建完成后，检查 `build/openclaw/skills/` 目录是否包含新增的 5 个 skills。

**运行验证**：

安装 Dclaw 后，在设置页 → Skills 管理，确认：
- ✅ `multi-search-engine` 显示在内置 Skills 列表
- ✅ `skill-vetter` 显示在内置 Skills 列表
- ✅ `skill-creator` 显示在内置 Skills 列表
- ✅ `ui-ux-pro-max` 显示在内置 Skills 列表
- ✅ `imap-smtp-email` 显示在内置 Skills 列表

### 文件清单

**新增文件**（相对于 `resources/openclaw/skills/`）：

```
resources/openclaw/skills/
├── multi-search-engine/
│   ├── SKILL.md
│   ├── CHANGELOG.md
│   ├── CHANNELLOG.md
│   ├── _skillhub_meta.json
│   ├── config.json
│   ├── metadata.json
│   └── references/
│       ├── advanced-search.md
│       └── international-search.md
├── skill-vetter/
│   ├── SKILL.md
│   └── _skillhub_meta.json
├── skill-creator/
│   ├── SKILL.md
│   ├── LICENSE.txt
│   ├── _skillhub_meta.json
│   ├── references/
│   │   ├── output-patterns.md
│   │   └── workflows.md
│   └── scripts/
│       ├── init_skill.py
│       ├── package_skill.py
│       └── quick_validate.py
├── ui-ux-pro-max/
│   ├── SKILL.md
│   ├── data/
│   │   ├── charts.csv
│   │   ├── colors.csv
│   │   ├── icons.csv
│   │   ├── landing.csv
│   │   ├── products.csv
│   │   ├── prompts.csv
│   │   ├── react-performance.csv
│   │   ├── styles.csv
│   │   ├── typography.csv
│   │   ├── ui-reasoning.csv
│   │   ├── ux-guidelines.csv
│   │   ├── web-interface.csv
│   │   └── stacks/
│   │       ├── flutter.csv
│   │       ├── html-tailwind.csv
│   │       ├── jetpack-compose.csv
│   │       ├── nextjs.csv
│   │       ├── nuxt-ui.csv
│   │       ├── nuxtjs.csv
│   │       ├── react-native.csv
│   │       ├── react.csv
│   │       ├── shadcn.csv
│   │       ├── svelte.csv
│   │       ├── swiftui.csv
│   │       └── vue.csv
│   └── scripts/
│       ├── core.py
│       ├── design_system.py
│       └── search.py
└── imap-smtp-email/
    ├── SKILL.md
    ├── _skillhub_meta.json
    ├── package.json
    └── setup.sh
```

**总计**：5 个 skills，50 个文件。

### 待完成事项

| 事项 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| `online-search` 适配 | 🔴 高 | ⏳ 待处理 | 需要替换 QClaw API 为 Dclaw 实现的搜索接口 |
| `qclaw-skill-creator` 替代 | 🔴 高 | ⏳ 待处理 | 可用 `skill-creator` 替代，或自行开发 |
| `bdpan-storage` 寻找 | 🟢 低 | ⏳ 待处理 | 可能在其他 marketplace 或需要自行开发 |
| `imap-smtp-email` 依赖安装 | 🟢 低 | ⏳ 待验证 | 构建时是否需要运行 `npm install` |

### 经验总结

**Skills 来源优先级**：

1. ✅ **WorkBuddy skills-marketplace**（`/c/Users/40832/.workbuddy/skills-marketplace/skills/`）- 推荐
2. ✅ **WorkBuddy 官方插件**（`/c/Users/40832/.workbuddy/plugins/marketplaces/codebuddy-plugins-official/`）- 推荐
3. ⚠️ **QClaw workspace**（`/c/Users/40832/.qclaw/workspace/skills/`）- 可能含 QClaw 特定功能
4. ❌ **QClaw 内置**（`backup/ClawX-20260501-110625/resources/skills/`）- 含 QClaw API 依赖

**依赖检查清单**：

- [ ] 是否引用 QClaw API（如 `/proxy/prosearch`, `AUTH_GATEWAY_PORT`）
- [ ] 是否需要外部 API key（如 WolframAlpha, Google Custom Search）
- [ ] 是否依赖特定环境变量（非用户配置类）
- [ ] 是否需要额外 `npm install`（Node.js 依赖）
- [ ] 脚本是否调用 QClaw 专有工具

**安全检查**：

```bash
# 检查恶意代码特征
grep -r "eval\|exec\|base64\|curl.*http" "resources/openclaw/skills/<skill-name>/" 2>/dev/null
```

---

## 📋 附录

### A. 完整检查清单（每次同步后必做）

```
□ 1. 创建备份分支
□ 2. 合并上游代码 (git merge upstream/main)
□ 3. 解决冲突（保留Dclaw定制）
□ 4. 批量替换 ClawX → Dclaw（三遍扫描法）
□ 5. 检查语法错误（重点检查 .ts/.tsx）
□ 6. 打包应用（SKIP_PREINSTALLED_SKILLS=1 pnpm run build）
□ 7. 启动测试（检查进程和日志）
□ 8. 功能验证（手动测试UI）
□ 9. 提交代码（分批次或原子提交）
□ 10. 推送代码（git push origin sync-test）
□ 11. 最终验证（安装包测试）
```

### B. 记录模板

```
## Dclaw改造记录 - YYYY-MM-DD

### 上游同步
- 上游版本：ClawX vX.X.X
- 同步时间：YYYY-MM-DD HH:MM
- 冲突文件：<列出冲突文件>

### 改造内容
- 修改文件数：X 个
- 高优先级：X 处（UI文本）
- 中优先级：X 处（配置）
- 低优先级：X 处（注释）

### 回归测试
- 打包：✅ 成功 / ❌ 失败（原因：xxx）
- 启动：✅ 正常 / ❌ 异常（原因：xxx）
- 日志：✅ 无ERROR / ⚠️ 有WARN（原因：xxx）
- 功能：✅ 全部通过 / ❌ 部分失败（原因：xxx）

### 提交记录
- Commit 1: <hash> - <message>
- Commit 2: <hash> - <message>
- Push: ✅ 成功 / ❌ 失败

### 问题与解决
- 问题1：<描述>
  - 原因：<分析>
  - 解决：<方法>

### 下次改进
- <改进点1>
- <改进点2>
```

### C. 相关文档

- [Dclaw品牌规范](./Dclaw品牌规范.md)（待创建）
- [上游同步记录](./upstream-sync-log.md)（待创建）
- [回归测试检查表](./regression-test-checklist.md)（待创建）
- [AIGC集成文档](./AIGC集成文档.md)（待创建）
- [专家中心配置](./专家中心配置.md)（待创建）

### D. 版本兼容性提醒

| ClawX 版本 | OpenClaw 版本 | 备注 |
|-----------|--------------|------|
| v0.3.11 | 4.15 | ✅ 稳定，无已知 Bug |
| v0.4.0-alpha | 4.26 | ⚠️ 有性能 Bug（2026.4.26 已知问题） |
| v0.4.x (预计) | ? | 等待上游修复 |

**建议**：同步时优先使用 `upstream/v0.3.11` 或 `upstream/main`，避免 alpha 版本。

### E. 常用 Git 命令速查

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

### F. 文件清单

```
dclaw-brand/
├── icons/
│   ├── icon.png          ← 1024x1024 通用图标
│   ├── icon.ico          ← Windows 图标（多尺寸）
│   ├── 16x16.png ~ 512x512.png   ← Linux 图标集
│   └── logo-64/128/256/512.png   ← UI 内嵌用
├── rebrand.py            ← 一键品牌替换脚本
├── rebrand-clawx.py     ← 品牌定制脚本
├── generate_icons.py     ← 图标生成脚本
├── generate-index.js     ← 自动生成 index.json 脚本
├── Dclaw改造手册.md      ← 完整改造手册
├── Dclaw与ClawX同步手册.md ← 同步操作手册
├── Dclaw品牌定制完整文档.md ← 品牌定制文档
├── upstream-sync-dclaw-transform-process.md ← 同步改造流程
├── experts.json          ← 新格式远程配置
├── experts-remote-example.json  ← 配置示例
└── manifest.json                  ← 品牌配置
```

### G. 注意事项

| 事项 | 说明 |
|---|---|
| 协议合规 | Apache-2.0：保留 About 页原版权声明即可 |
| 商标 | 不可叫 "OpenClaw Pro"，Dclaw 完全没问题 |
| 升级策略 | 锁定 Qclaw 上游版本 Tag，不要跟随 latest |
| Windows 签名 | 分发安装包建议申请代码签名证书，避免杀毒软件误报 |
| macOS 公证 | Mac 版上架或分发需要 Apple Developer 账号公证 |

---

## 🔄 循环改进

每次执行此流程后：

1. **记录问题** - 哪些步骤失败了？为什么？
2. **更新脚本** - 把手动检查变成自动化
3. **更新文档** - 把新发现的问题加入检查清单
4. **分享经验** - 告诉团队其他成员

---

**文档版本**: v2.0 (合并完整版)  
**合并日期**: 2026-05-16  
**合并内容**:
- ClawX同步后Dclaw改造标准流程.md
- Dclaw与ClawX同步手册.md
- Dclaw品牌定制完整文档.md
- Dclaw改造手册.md（完整版，含第十至十八章）
- upstream-sync-dclaw-transform-process.md

**下一步**:
1. 删除重复文档
2. 更新索引
3. 通知团队成员使用新文档
