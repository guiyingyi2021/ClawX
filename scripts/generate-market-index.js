/**
 * 生成市场专家索引文件
 * 运行方式: node scripts/generate-market-index.js
 *
 * 从 github.com/guiyingyi2021/agency-agents-zh 拉取所有智能体目录
 * 生成 market-experts-index.json，包含所有专家的元数据
 *
 * 注意：GitHub API 有 60次/小时 限制，如遇限流请等待后重试
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'guiyingyi2021/agency-agents-zh';
const BRANCH = 'main';
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

// 分类映射：agency目录 → Dclaw分类
const CATEGORY_MAP = {
  'academic': '行业顾问',
  'design': '产品设计',
  'engineering': '技术工程',
  'examples': '其他',
  'finance': '金融投资运营人力',
  'game-development': '游戏空间',
  'hr': '金融投资运营人力',
  'integrations': '行业顾问',
  'legal': '法务安全',
  'marketing': '营销增长',
  'paid-media': '营销增长',
  'product': '产品设计',
  'project-management': '项目质量',
  'sales': '销售商务',
  'spatial-computing': '行业顾问',
  'specialized': '行业顾问',
  'strategy': '其他',
  'supply-chain': '金融投资运营人力',
  'support': '销售商务',
  'testing': '技术工程',
};

// Dclaw 12个固定分类（按优先级排序）
const FIXED_CATEGORIES = [
  '销售商务',
  '营销增长',
  '产品设计',
  '技术工程',
  '游戏空间',
  '数据智能',
  '内容创作',
  '金融投资运营人力',
  '项目质量',
  '法务安全',
  '行业顾问',
];

// GitHub API 请求封装
function githubGet(apiPath) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${apiPath}`;
    https.get(url, {
      headers: {
        'User-Agent': 'Dclaw-MarketIndexGenerator/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 403 || res.statusCode === 429) {
          reject(new Error(`API限流: ${res.statusCode} - ${data}`));
        } else if (res.statusCode !== 200) {
          reject(new Error(`API错误: ${res.statusCode} - ${data}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        }
      });
    }).on('error', reject);
  });
}

// 从 markdown 内容中提取 frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });
  return fm;
}

// 颜色关键字到 hex 的映射
const COLOR_MAP = {
  purple: '#8B5CF6',
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#F97316',
  pink: '#EC4899',
  teal: '#14B8A6',
  indigo: '#6366F1',
  gray: '#6B7280',
  grey: '#6B7280',
};

// 主函数
async function main() {
  console.log('🔍 开始生成市场专家索引...\n');

  const allExperts = [];
  const categoryGroups = {};

  // 1. 获取顶层目录列表
  console.log('📡 获取目录列表...');
  let rootItems;
  try {
    rootItems = await githubGet('/contents/');
  } catch (e) {
    console.error('❌ 获取目录列表失败:', e.message);
    process.exit(1);
  }

  // 过滤出目录
  const dirs = rootItems.filter(item => item.type === 'dir' && !item.name.startsWith('.'));

  // 2. 遍历每个目录
  for (const dir of dirs) {
    const mappedCategory = CATEGORY_MAP[dir.name] || '其他';
    console.log(`📂 ${dir.name}/ → ${mappedCategory} (${mappedCategory === '其他' ? '其他' : '已映射'})`);

    // 获取目录内容
    let dirItems;
    try {
      dirItems = await githubGet(`/contents/${dir.name}`);
    } catch (e) {
      console.warn(`  ⚠️  获取 ${dir.name} 目录失败: ${e.message}`);
      continue;
    }

    // 找出所有 .md 文件
    const mdFiles = Array.isArray(dirItems)
      ? dirItems.filter(item => item.type === 'file' && item.name.endsWith('.md'))
      : [];

    for (const file of mdFiles) {
        // 获取文件内容（通过 GitHub Contents API，base64 编码）
        try {
          const rawContent = await fetchFileContent(`${dir.name}/${file.name}`, file.name);
        const fm = parseFrontmatter(rawContent);

        if (fm && fm.name) {
          const expert = {
            id: `market-${dir.name}-${file.name.replace('.md', '')}`,
            name: fm.name,
            role: fm.name,
            emoji: getEmoji(mappedCategory, fm.name),
            color: COLOR_MAP[fm.color?.toLowerCase()] || '#8B5CF6',
            category: mappedCategory,
            description: fm.description || '',
            sourceDir: dir.name,
            sourcePath: `${dir.name}/${file.name}`,
            downloadUrl: `${RAW_BASE}/${dir.name}/${file.name}`,
            hasIdentity: false,
            hasSoul: true,
          };
          allExperts.push(expert);
        }
      } catch (e) {
        console.warn(`  ⚠️  获取 ${file.name} 失败: ${e.message}`);
      }
    }
  }

  // 3. 按分类分组
  for (const cat of FIXED_CATEGORIES) {
    categoryGroups[cat] = allExperts.filter(e => e.category === cat);
  }
  // 其他
  categoryGroups['其他'] = allExperts.filter(e => !FIXED_CATEGORIES.includes(e.category));

  // 4. 输出结果
  const output = {
    version: new Date().toISOString().split('T')[0],
    total: allExperts.length,
    categories: categoryGroups,
    _flat: allExperts, // 方便调试
  };

  const outputPath = path.join(__dirname, '..', 'src', 'data', 'market-experts-index.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✅ 索引生成完成！`);
  console.log(`📊 总计: ${allExperts.length} 个专家`);
  for (const [cat, experts] of Object.entries(categoryGroups)) {
    if (experts.length > 0) {
      console.log(`   ${cat}: ${experts.length} 个`);
    }
  }
  console.log(`\n💾 已保存到: ${outputPath}`);
}

// 根据分类和名称返回合适的 emoji
function getEmoji(category, name) {
  const emojiMap = {
    '销售商务': '💼',
    '营销增长': '📈',
    '产品设计': '🎨',
    '技术工程': '⚙️',
    '游戏空间': '🎮',
    '数据智能': '📊',
    '内容创作': '✍️',
    '金融投资运营人力': '💰',
    '项目质量': '📋',
    '法务安全': '⚖️',
    '行业顾问': '🏢',
    '其他': '📁',
  };
  return emojiMap[category] || '🤖';
}

// 获取原始文件内容（使用 GitHub Contents API，返回 base64）
function fetchFileContent(apiPath, fileName) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/contents/${apiPath}`;
    https.get(url, { headers: { 'User-Agent': 'Dclaw/1.0', 'Accept': 'application/vnd.github.v3+json' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Contents API 返回 base64 编码的内容
          if (json.content) {
            const content = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf8');
            resolve(content);
          } else {
            resolve('');
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

main().catch(console.error);
