# 上游同步后的Dclaw改造流程

> **目的**：在每次从上游（ClawX）同步代码后，系统地将ClawX品牌改造为Dclaw品牌。
> **适用**：从 `upstream/main` 合并到 `sync-test` 或 `dclaw-private` 分支后。

---

## 🔰 前置准备

### 1. 确认当前状态
```bash
cd E:/ClawX
git status                    # 应该clean
git branch                    # 确认在正确的分支（sync-test/dclaw-private）
git log --oneline -3          # 确认当前位置
```

### 2. 创建备份
```bash
# 创建时间戳备份分支
git checkout -b backup/before-dclaw-transform-$(date +%Y-%m-%d-%H%M%S)

# 切回工作分支
git checkout sync-test   # 或 dclaw-private
```

**⚠️ 关键**：永远在修改前创建备份！

---

## 🔄 上游同步

### 3. 合并上游代码
```bash
git fetch upstream
git merge upstream/main --no-edit
```

### 4. 解决冲突（如果有）
```bash
# 检查冲突文件
git status

# 手动解决冲突后
git add <resolved-files>
git commit --no-edit
```

---

## 🔧 Dclaw品牌改造

### 5. 系统批量替换（三遍扫描法）

#### 第一遍：批量替换（自动）
```bash
# 替换所有 .ts, .tsx, .js, .json 文件中的 ClawX → Dclaw
cd E:/ClawX
grep -rn "ClawX\|clawx" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" | \
  grep -v "node_modules\|\.git\|backup\|dist\|build" > /tmp/clawx-refs.txt

# 查看有多少处需要修改
wc -l /tmp/clawx-refs.txt

# 批量替换（使用PowerShell，更可靠）
powershell -Command "
\$files = Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js,*.json | \
  Where-Object { \$_.FullName -notmatch 'node_modules|\.git|backup|dist|build' }
foreach (\$file in \$files) {
  (Get-Content \$file.FullName -Encoding UTF8) -replace 'ClawX', 'Dclaw' -replace 'clawx', 'dclaw' | \
    Set-Content \$file.FullName -Encoding UTF8
}
"
```

#### 第二遍：手动检查关键文件（防止语法错误）
```bash
# 检查是否有语法错误（重点检查 .ts/.tsx 文件）
find . -name "*.ts" -o -name "*.tsx" | \
  grep -v "node_modules\|\.git\|backup\|dist\|build" | \
  xargs grep -l "''\|'''\|' '" | head -20
```

**⚠️ 常见错误**：
- 替换时引入多余引号：`'dclaw''` → 应该是 `'dclaw'`
- 替换注释时破坏代码：`path.join('dclaw', 'file')` 被改成 `path.join('dclaw', 'file')`（无变化，但要检查）

#### 第三遍：验证替换结果
```bash
# 再次搜索，确认无遗漏
grep -rn "ClawX\|clawx" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" | \
  grep -v "node_modules\|\.git\|backup\|dist\|build\|ValueCell-ai\|ClawX/"
```

---

### 6. 分类修改清单（按优先级）

#### 🔴 高优先级（用户界面会看到）
- [ ] `src/components/file-preview/FilePreviewBody.tsx` - 用户提示文本
- [ ] `src/components/file-preview/WorkspaceBrowserBody.tsx` - 用户提示文本
- [ ] `src/pages/Dreams/index.tsx` - Dreams功能文本
- [ ] `src/pages/**/*.tsx` - 所有页面标题、提示文本

#### 🟡 中优先级（配置文件）
- [ ] `package.json` - 应用名称、描述
- [ ] `electron-builder.yml` / `package.json` (build字段) - 打包配置
- [ ] `tailwind.config.js` - 注释中的品牌引用
- [ ] `dclaw-brand/manifest.json` - 品牌配置

#### 🟢 低优先级（注释和文档）
- [ ] `electron/utils/*.ts` - 代码注释
- [ ] `src/**/*.ts`, `*.tsx` - 代码注释
- [ ] `README.md`, `docs/**` - 文档

#### 🔵 特殊文件（需要手动检查）
- [ ] `electron/main/index.ts` - 应用主入口，窗口标题
- [ ] `electron/gateway/manager.ts` - Gateway配置
- [ ] `electron/utils/paths.ts` - 路径配置
- [ ] `electron/utils/config.ts` - 配置路径

---

## ✅ 回归测试

### 7. 打包应用
```bash
cd E:/ClawX
SKIP_PREINSTALLED_SKILLS=1 pnpm run build
```

**⚠️ 如果打包失败**：
1. 检查错误信息（通常是语法错误）
2. 定位问题文件：`grep -n "syntax error" build.log`
3. 修复后重新打包

### 8. 启动测试
```bash
# 启动Dclaw
Start-Process -FilePath "E:\ClawX\release\win-unpacked\Dclaw.exe" -WindowStyle Normal

# 等待5秒让应用初始化
Start-Sleep -Seconds 5

# 检查进程
tasklist | Select-String "Dclaw"
```

### 9. 日志检查
```bash
# 查看最新日志
tail -100 ~/AppData/Roaming/Dclaw/logs/dclaw-$(Get-Date -Format "yyyy-MM-dd").log

# 搜索错误
Select-String "ERROR\|Failed\|Exception" ~/AppData/Roaming/Dclaw/logs/dclaw-*.log -Context 2,2
```

**✅ 通过标准**：
- 应用正常启动（5个进程）
- 日志文件名：`dclaw-YYYY-MM-DD.log`（不是clawx-）
- 无ERROR（WARN可接受，如Gateway握手超时）
- 无`ensureClawXIdentityFile`错误

### 10. 功能验证（手动）
- [ ] 打开应用，检查窗口标题是否为"Dclaw"
- [ ] 打开文件预览，检查提示文本是否显示"Dclaw"
- [ ] 检查设置页面，确认应用名称为"Dclaw"
- [ ] 测试AIGC功能（如果适用）
- [ ] 测试专家中心功能（如果适用）

---

## 📝 提交代码

### 11. 检查修改内容
```bash
git status
git diff --stat
```

### 12. 分批次提交（推荐）
```bash
# 第一批：核心文件（electron/ + package.json）
git add electron/ package.json electron-builder.yml
git commit -m "rebrand: core Dclaw transformation (electron main process)"

# 第二批：前端文件（src/）
git add src/
git commit -m "rebrand: frontend Dclaw transformation (UI text + components)"

# 第三批：配置和注释
git add tailwind.config.js dclaw-brand/ docs/
git commit -m "rebrand: config and comments Dclaw transformation"
```

**⚠️ 或者原子提交**（如果修改较少）：
```bash
git add .
git commit -m "rebrand: complete ClawX→Dclaw rename (N files)"
```

### 13. 推送代码
```bash
git push origin sync-test   # 或 dclaw-private
```

---

## 🔍 验证清单（提交后）

### 14. 最终检查
- [ ] GitHub上查看提交，确认修改正确
- [ ] 从GitHub下载打包好的安装包，重新安装测试
- [ ] 检查安装目录名称：`C:\Users\40832\AppData\Local\Dclaw\`
- [ ] 检查开始菜单/桌面快捷方式名称：Dclaw
- [ ] 检查卸载程序名称：Dclaw

---

## 🆘 回滚方案

### 如果发现问题需要回滚
```bash
# 查看备份分支
git branch | Select-String "backup/before"

# 重置到备份分支
git reset --hard backup/before-dclaw-transform-<timestamp>

# 或撤销某次提交
git revert <commit-hash> --no-edit
```

---

## 📋 快速检查表（每次同步后必做）

```
□ 1. 创建备份分支
□ 2. 合并上游代码 (git merge upstream/main)
□ 3. 批量替换 ClawX → Dclaw（三遍扫描法）
□ 4. 检查语法错误（重点检查 .ts/.tsx）
□ 5. 打包应用（SKIP_PREINSTALLED_SKILLS=1 pnpm run build）
□ 6. 启动测试（检查进程和日志）
□ 7. 功能验证（手动测试UI）
□ 8. 提交代码（分批次或原子提交）
□ 9. 推送代码（git push origin sync-test）
□ 10. 最终验证（安装包测试）
```

---

## 📝 记录模板

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

---

## 🔗 相关文档

- [Dclaw品牌规范](./dclaw-brand-spec.md)（待创建）
- [上游同步记录](./upstream-sync-log.md)（待创建）
- [回归测试检查表](./regression-test-checklist.md)（待创建）

---

**版本**：v1.0  
**创建时间**：2026-05-16  
**更新时间**：2026-05-16  
**维护者**：Dclaw Team
