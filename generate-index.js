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
 *   specialties:           <- 【必填】技能标签数组
 *     - label: 小红书种草   <- 标签名称
 *       emoji: 📕           <- 标签图标
 *     - label: 抖音短视频
 *       emoji: 🎬
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
 * parseFrontmatter - 解析 SOUL.md 的 YAML frontmatter
 * 支持简单字段和 specialties 嵌套数组
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  const lines = match[1].split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // 检查是否是数组项（以 "  - " 开头）
    if (line.match(/^\s+-\s+/)) {
      // 在 specialties 数组中
      if (fm.specialties && Array.isArray(fm.specialties)) {
        const item = {};
        // 解析数组项的属性
        while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
          const itemMatch = lines[i].match(/^\s+-\s+(\w+):\s*(.*)$/);
          if (itemMatch) {
            item[itemMatch[1]] = itemMatch[2].replace(/^["']|["']$/g, '');
          }
          i++;
          // 继续解析子属性（缩进的 key: value）
          while (i < lines.length && lines[i].match(/^\s+\w+:\s*.+$/)) {
            const subMatch = lines[i].match(/^\s+(\w+):\s*(.*)$/);
            if (subMatch) {
              item[subMatch[1]] = subMatch[2].replace(/^["']|["']$/g, '');
            }
            i++;
          }
        }
        if (Object.keys(item).length > 0) {
          fm.specialties.push(item);
        }
        continue;
      }
    }

    // 检查是否是 specialties 数组开始
    const specMatch = line.match(/^(\s*)specialties:\s*$/);
    if (specMatch) {
      fm.specialties = [];
      i++;
      // 继续解析数组项
      while (i < lines.length) {
        const itemLine = lines[i];
        // 检查是否是新的顶级字段（减少缩进）
        if (itemLine.match(/^[^\s]/) || itemLine.match(/^\w+:/)) {
          if (fm.specialties.length > 0) break;
        }
        if (itemLine.match(/^\s+-\s+\w+:/)) {
          const item = {};
          const itemHeaderMatch = itemLine.match(/^\s+-\s+(\w+):\s*(.*)$/);
          if (itemHeaderMatch) {
            item[itemHeaderMatch[1]] = itemHeaderMatch[2].replace(/^["']|["']$/g, '');
          }
          i++;
          // 解析对象属性
          while (i < lines.length && lines[i].match(/^\s+\w+:\s*.+$/)) {
            const propMatch = lines[i].match(/^\s+(\w+):\s*(.*)$/);
            if (propMatch) {
              item[propMatch[1]] = propMatch[2].replace(/^["']|["']$/g, '');
            }
            i++;
          }
          if (Object.keys(item).length > 0) {
            fm.specialties.push(item);
          }
        } else {
          i++;
        }
      }
      continue;
    }

    // 普通 key: value
    const idx = line.indexOf(':');
    if (idx === -1) { i++; continue; }
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    // 去掉首尾引号
    fm[key] = val.replace(/^["']|["']$/g, '');
    i++;
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
        id: id,
        name: fm.name || toDisplayName(id),
        role: fm.role || '',
        emoji: fm.emoji || '🤖',
        color: fm.color || '#666666',
        category: cat,
        description: fm.summary || fm.description || '',
        downloadUrl,
        hasIdentity: hasIdentity,
        hasSoul: !!soulContent,
        // 新增：specialties 标签（如果有的话）
        ...(fm.specialties && Array.isArray(fm.specialties) && fm.specialties.length > 0
          ? { specialties: fm.specialties }
          : {}),
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
