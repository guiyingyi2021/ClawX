/**
 * Pre-build script: copy custom OpenClaw skills to build/openclaw/skills/
 * 
 * This ensures skills in resources/openclaw/skills/ are included in the package.
 * Run this before electron-builder.
 */

import { cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const srcDir = join(rootDir, 'resources', 'openclaw', 'skills');
const destDir = join(rootDir, 'build', 'openclaw', 'skills');

if (!existsSync(srcDir)) {
  console.log('[copy-openclaw-skills] No custom skills to copy.');
  process.exit(0);
}

console.log(`[copy-openclaw-skills] Copying ${srcDir} -> ${destDir} ...`);
cpSync(srcDir, destDir, { recursive: true, force: true });
console.log('[copy-openclaw-skills] ✅ Done.');
