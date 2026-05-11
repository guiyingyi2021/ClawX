#!/usr/bin/env zx

/**
 * prebuild：同步 agents/index.json → src/data/experts-index.json
 * 确保"我的专家"本地索引与 E:/ClawX/agents/ 保持一致
 */

const AGENTS_INDEX = path.resolve('E:/ClawX/agents/index.json');
const DATA_INDEX = path.resolve('E:/ClawX/src/data/experts-index.json');

if (!fs.existsSync(AGENTS_INDEX)) {
  console.error('[sync-experts-index] agents/index.json not found, skipping.');
  process.exit(0);
}

const src = fs.readFileSync(AGENTS_INDEX, 'utf8');

// 简单比较内容，避免无变更时触发 webpack/vite 重编
if (fs.existsSync(DATA_INDEX)) {
  const existing = fs.readFileSync(DATA_INDEX, 'utf8');
  if (existing === src) {
    console.log('[sync-experts-index] up-to-date, skip.');
    process.exit(0);
  }
}

fs.writeFileSync(DATA_INDEX, src, 'utf8');
console.log(`[sync-experts-index] synced ${AGENTS_INDEX} → ${DATA_INDEX}`);
