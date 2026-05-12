/**
 * SkillHub Service (Built-in skill management)
 * Directly calls skillhub.cn APIs - NO external CLI dependency
 * Provides: search skills, install skills, check installed skills
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';
import os from 'os';

// Singleton instance
let skillHubInstance: SkillHubService | null = null;

// Factory function to get or create SkillHubService instance
export function getSkillHubService(): SkillHubService {
    if (!skillHubInstance) {
        skillHubInstance = new SkillHubService();
    }
    return skillHubInstance;
}

export interface SkillHubInstallParams {
    slug: string;
    version?: string;
    force?: boolean;
}

export interface SkillHubSearchResult {
    slug: string;
    name: string;
    description: string;
    version?: string;
}

export class SkillHubService {
    private readonly SEARCH_URL = 'https://lightmake.site/api/v1/search';
    private readonly DOWNLOAD_URL_TEMPLATE = 'https://lightmake.site/api/v1/download?slug={slug}';
    private readonly FALLBACK_DOWNLOAD_URL_TEMPLATE = 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills/{slug}.zip';
    private readonly DEFAULT_INSTALL_DIR: string;

    constructor() {
        // Default install directory: ~/.openclaw/skills
        this.DEFAULT_INSTALL_DIR = path.join(
            process.env.HOME || process.env.USERPROFILE || '',
            '.openclaw',
            'skills'
        );
    }

    /**
     * Check if skillhub service is available (always true - built-in)
     */
    isAvailable(): boolean {
        return true; // Built-in, always available
    }

    /**
     * Search skills via skillhub.cn API
     */
    async search(query: string, limit: number = 20): Promise<SkillHubSearchResult[]> {
        return new Promise((resolve, reject) => {
            const url = `${this.SEARCH_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
            
            console.log(`[SkillHub] Searching: ${query}`);

            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            client.get(url, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Search failed: HTTP ${res.statusCode}`));
                        return;
                    }

                    try {
                        const json = JSON.parse(data);
                        const results = (json.results || []).map((item: any) => ({
                            slug: item.slug || '',
                            name: item.displayName || item.name || item.slug || '',
                            description: item.summary || item.description || '',
                            version: item.version || '',
                        }));
                        console.log(`[SkillHub] Found ${results.length} skills`);
                        resolve(results);
                    } catch (error) {
                        reject(new Error(`Failed to parse search results: ${error}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Search request failed: ${error.message}`));
            });
        });
    }

    /**
     * Install a skill by slug
     */
    async install(params: SkillHubInstallParams, installDir?: string): Promise<void> {
        const targetDir = installDir || this.DEFAULT_INSTALL_DIR;
        const skillDir = path.join(targetDir, params.slug);

        // Check if already installed
        if (fs.existsSync(skillDir) && !params.force) {
            console.log(`[SkillHub] Skill "${params.slug}" already installed at ${skillDir}`);
            return;
        }

        console.log(`[SkillHub] Installing "${params.slug}" to ${targetDir}`);

        // Try primary download URL
        const primaryUrl = this.DOWNLOAD_URL_TEMPLATE.replace('{slug}', encodeURIComponent(params.slug));
        
        try {
            await this.downloadAndExtract(primaryUrl, skillDir, params.force);
            console.log(`[SkillHub] Successfully installed "${params.slug}"`);
        } catch (primaryError) {
            console.warn(`[SkillHub] Primary download failed, trying fallback: ${primaryError.message}`);
            
            // Try fallback URL
            const fallbackUrl = this.FALLBACK_DOWNLOAD_URL_TEMPLATE.replace('{slug}', encodeURIComponent(params.slug));
            
            try {
                await this.downloadAndExtract(fallbackUrl, skillDir, params.force);
                console.log(`[SkillHub] Successfully installed "${params.slug}" (from fallback)`);
            } catch (fallbackError) {
                throw new Error(`Failed to install "${params.slug}": ${fallbackError.message}`);
            }
        }
    }

    /**
     * Download ZIP and extract to target directory
     */
    private async downloadAndExtract(url: string, targetDir: string, force: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;

            client.get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                    return;
                }

                // Create temp directory for download
                const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'skillhub-'));
                const zipPath = path.join(tempDir, 'skill.zip');

                const fileStream = fs.createWriteStream(zipPath);
                res.pipe(fileStream);

                fileStream.on('finish', async () => {
                    fileStream.close();

                    try {
                        // Extract ZIP
                        await this.extractZip(zipPath, targetDir, force);
                        
                        // Cleanup temp directory
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        
                        resolve();
                    } catch (error) {
                        fs.rmSync(tempDir, { recursive: true, force: true });
                        reject(error);
                    }
                });

                fileStream.on('error', (error) => {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                    reject(error);
                });
            }).on('error', (error) => {
                reject(new Error(`Download request failed: ${error.message}`));
            });
        });
    }

    /**
     * Extract ZIP file to target directory
     */
    private async extractZip(zipPath: string, targetDir: string, force: boolean = false): Promise<void> {
        // Use system unzip command (cross-platform)
        return new Promise((resolve, reject) => {
            if (fs.existsSync(targetDir) && force) {
                fs.rmSync(targetDir, { recursive: true, force: true });
            }

            // Create target directory
            fs.mkdirSync(targetDir, { recursive: true });

            // Try to use unzip (Linux/macOS/Git Bash on Windows)
            const unzip = spawn('unzip', ['-o', zipPath, '-d', targetDir], {
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });

            let stderr = '';
            unzip.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            unzip.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    // Fallback: try PowerShell Expand-Archive (Windows)
                    this.extractZipPowerShell(zipPath, targetDir)
                        .then(resolve)
                        .catch(() => reject(new Error(`Failed to extract ZIP: ${stderr}`)));
                }
            });

            unzip.on('error', (error) => {
                // Fallback: try PowerShell Expand-Archive (Windows)
                this.extractZipPowerShell(zipPath, targetDir)
                    .then(resolve)
                    .catch(() => reject(error));
            });
        });
    }

    /**
     * Extract ZIP using PowerShell (Windows fallback)
     */
    private async extractZipPowerShell(zipPath: string, targetDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const ps = spawn('powershell', [
                '-Command',
                `Expand-Archive -Path "${zipPath}" -DestinationPath "${targetDir}" -Force`
            ], {
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });

            let stderr = '';
            ps.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            ps.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`PowerShell extraction failed: ${stderr}`));
                }
            });

            ps.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Check if a skill is installed
     */
    async checkInstalled(slug: string, installDir?: string): Promise<boolean> {
        const targetDir = installDir || this.DEFAULT_INSTALL_DIR;
        const skillDir = path.join(targetDir, slug);
        return fs.existsSync(skillDir);
    }

    /**
     * Batch check if multiple skills are installed
     */
    async batchCheckInstalled(slugs: string[], installDir?: string): Promise<Record<string, boolean>> {
        const results: Record<string, boolean> = {};
        for (const slug of slugs) {
            results[slug] = await this.checkInstalled(slug, installDir);
        }
        return results;
    }

    /**
     * Ensure multiple skills are installed
     */
    async ensureSkills(
        requiredSkills: Array<{ slug: string; required: boolean; reason: string }>,
        installDir?: string
    ): Promise<{
        results: Array<{ slug: string; status: 'installed' | 'failed' | 'skipped'; message?: string }>;
        allSuccess: boolean;
    }> {
        const results: Array<{ slug: string; status: 'installed' | 'failed' | 'skipped'; message?: string }> = [];

        for (const skill of requiredSkills) {
            try {
                const isInstalled = await this.checkInstalled(skill.slug, installDir);
                if (isInstalled) {
                    results.push({ slug: skill.slug, status: 'skipped', message: 'Already installed' });
                    continue;
                }

                await this.install({ slug: skill.slug }, installDir);
                results.push({ slug: skill.slug, status: 'installed' });
            } catch (error: any) {
                // 404 = 技能不存在，直接跳过（不报失败）
                const is404 = String(error.message || '').includes('HTTP 404');
                if (is404) {
                    console.warn(`[SkillHub] 技能不存在，已跳过: ${skill.slug}`);
                    results.push({ slug: skill.slug, status: 'skipped', message: 'Skill not found, skipped' });
                } else {
                    results.push({
                        slug: skill.slug,
                        status: 'failed',
                        message: error.message || 'Installation failed',
                    });
                }
            }
        }

        const allSuccess = results.every(r => r.status === 'installed' || r.status === 'skipped');
        return { results, allSuccess };
    }

    /**
     * List installed skills
     */
    async listInstalled(installDir?: string): Promise<string[]> {
        const targetDir = installDir || this.DEFAULT_INSTALL_DIR;
        
        if (!fs.existsSync(targetDir)) {
            return [];
        }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
    }

    /**
     * Get manual install instructions for a skill
     * Called when automatic installation fails
     */
    getManualInstallInstructions(slug: string): string {
        const downloadUrl = this.DOWNLOAD_URL_TEMPLATE.replace('{slug}', encodeURIComponent(slug));
        const fallbackUrl = this.FALLBACK_DOWNLOAD_URL_TEMPLATE.replace('{slug}', encodeURIComponent(slug));
        
        return [
            `技能「${slug}」自动安装失败，请尝试手动安装：`,
            ``,
            `方法1：下载 ZIP 包后解压到技能目录`,
            `  主下载地址：${downloadUrl}`,
            `  备用下载地址：${fallbackUrl}`,
            `  目标目录：${path.join(this.DEFAULT_INSTALL_DIR, slug)}`,
            ``,
            `方法2：使用命令行工具（如已安装）`,
            `  npx openclaw skill install ${slug}`,
            ``,
            `方法3：在技能管理页面点击「重试」按钮`,
        ].join('\n');
    }
}
