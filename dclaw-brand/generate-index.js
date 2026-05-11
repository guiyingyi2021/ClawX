/**
 * generate-index.js
 * 扫描 agents/ 目录，解析每个子文件夹的 SOUL.md frontmatter，
 * 自动生成 agents/index.json（无需手写）
 *
 * 用法：node generate-index.js
 *
 * 目录规范：
 *   agents/
 *     ├── index.json          <- 自动生成
 *     ├── 内容创作/
 *     │   └── kai/
 *     │       ├── SOUL.md     <- 必需，含 YAML frontmatter
 *     │       ├── IDENTITY.md <- 可选
 *     │       └── package.tar.gz <- 召唤时下载的安装包
 *     └── 数据智能/
 *         └── phoebe/
 *
 * SOUL.md frontmatter 规范（必须包含）：
 *   ---
 *   role: 内容创作专家
 *   emoji: ✍️
 *   color: "#FF6B6B"
 *   summary: 专业的内容创作助手，擅长文案写作和创意发散。
 *   ---
 */

const fs = require('fs');
const path = require('path');

// 12 个固定分类（文件夹名必须完全匹配其中之一）
const CATEGORIES = [
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

/**
 * 解析 SOUL.md 的 YAML frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    // 去掉首尾引号
    fm[key] = val.replace(/^["']|["']$/g, '');
  }
  return fm;
}

/**
 * 从 SOUL.md 标题行提取 name（兜底用）
 * 标题格式：# SOUL.md - 内容创作专家 Kai
 */
function extractNameFromTitle(content) {
  const match = content.match(/^#\s+SOUL\.md\s*-\s*.+\s+(\S+)/m);
  return match ? match[1] : '';
}

/** 把文件夹名转为展示名（首字母大写） */
function toDisplayName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * 扫描 agents/ 目录，生成索引
 */
function generateIndex() {
  const agentsDir = path.join(__dirname, 'agents');
  const index = {};

  // 只扫描固定分类下的子文件夹
  for (const cat of CATEGORIES) {
    if (cat === '全部') continue; // "全部"不是真实文件夹
    const catDir = path.join(agentsDir, cat);
    if (!fs.existsSync(catDir)) continue;

    const experts = [];
    const entries = fs.readdirSync(catDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const expertDir = path.join(catDir, id);

      // 读取 SOUL.md
      const soulPath = path.join(expertDir, 'SOUL.md');
      let fm = {};
      let soulContent = '';
      if (fs.existsSync(soulPath)) {
        soulContent = fs.readFileSync(soulPath, 'utf8');
        fm = parseFrontmatter(soulContent);
      }

      // 读取 IDENTITY.md（可选）
      const identityPath = path.join(expertDir, 'IDENTITY.md');
      const hasIdentity = fs.existsSync(identityPath);

      // 检查是否有安装包
      const pkgPath = path.join(expertDir, 'package.tar.gz');
      const hasPackage = fs.existsSync(pkgPath);
      const downloadUrl = hasPackage
        ? `https://raw.githubusercontent.com/guiyingyi2021/ClawX/main/agents/${encodeURIComponent(cat)}/${encodeURIComponent(id)}/package.tar.gz`
        : '';

      experts.push({
        id: `remote-${id}`,
        name: fm.name || toDisplayName(id),
        role: fm.role || '',
        emoji: fm.emoji || '🤖',
        color: fm.color || '#666666',
        category: cat,
        description: fm.summary || fm.description || '',
        downloadUrl,
        hasIdentity: hasIdentity,
        hasSoul: !!soulContent,
      });
    }

    if (experts.length > 0) {
      index[cat] = experts;
    }
  }

  // 写入 index.json
  const indexPath = path.join(agentsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✅ index.json 生成完成，共 ${Object.keys(index).length} 个分类`);

  // 打印摘要
  for (const [cat, experts] of Object.entries(index)) {
    console.log(`   ${cat}: ${experts.length} 个专家`);
  }
}

generateIndex();
