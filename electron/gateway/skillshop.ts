/**
 * SkillShop Service (技能商店)
 * Manages interactions with skillhub.cn API for skills browsing and installation
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getOpenClawConfigDir, ensureDir, getClawHubCliBinPath, getClawHubCliEntryPath, quoteForCmd } from '../utils/paths';

// skillhub.cn API endpoints
const SKILLSHOP_API = {
    HOTLIST: 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills.json',
    SEARCH: 'https://lightmake.site/api/v1/search',
};

export interface SkillShopSkillResult {
    slug: string;
    name: string;
    description: string;
    version?: string;
    author?: string;
    downloads?: number;
    stars?: number;
    category?: string;
    tags?: string[];
    homepage?: string;
}

export interface SkillShopInstallParams {
    slug: string;
    version?: string;
    force?: boolean;
}

export class SkillShopService {
    private workDir: string;
    private cliPath: string;
    private cliEntryPath: string;
    private useNodeRunner: boolean;
    private ansiRegex: RegExp;
    private cachedHotlist: SkillShopSkillResult[] | null = null;
    private hotlistCacheTime: number = 0;
    private hotlistCacheTTL: number = 5 * 60 * 1000; // 5 minutes cache

    constructor() {
        this.workDir = getOpenClawConfigDir();
        ensureDir(this.workDir);

        const binPath = getClawHubCliBinPath();
        const entryPath = getClawHubCliEntryPath();

        this.cliEntryPath = entryPath;
        if (!app.isPackaged && fs.existsSync(binPath)) {
            this.cliPath = binPath;
            this.useNodeRunner = false;
        } else {
            this.cliPath = process.execPath;
            this.useNodeRunner = true;
        }
        const esc = String.fromCharCode(27);
        const csi = String.fromCharCode(155);
        const pattern = `(?:${esc}|${csi})[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`;
        this.ansiRegex = new RegExp(pattern, 'g');
    }

    private stripAnsi(line: string): string {
        return line.replace(this.ansiRegex, '').trim();
    }

    /**
     * Get capability information
     */
    async getCapability(): Promise<{ mode: string; canSearch: boolean; canInstall: boolean; reason?: string }> {
        return {
            mode: 'skillshop',
            canSearch: true,
            canInstall: true,
        };
    }

    /**
     * Fetch hotlist from skillhub.cn
     */
    async getHotlist(params: { limit?: number } = {}): Promise<SkillShopSkillResult[]> {
        // Return cached data if available
        if (this.cachedHotlist && Date.now() - this.hotlistCacheTime < this.hotlistCacheTTL) {
            return params.limit ? this.cachedHotlist.slice(0, params.limit) : this.cachedHotlist;
        }

        try {
            const response = await fetch(SKILLSHOP_API.HOTLIST, {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch hotlist: ${response.status}`);
            }

            const data = await response.json();

            // Parse the skills.json format
            const skills: SkillShopSkillResult[] = [];
            if (Array.isArray(data)) {
                for (const item of data) {
                    skills.push({
                        slug: item.slug || item.name,
                        name: item.name || item.slug,
                        description: item.description || '',
                        version: item.version || 'latest',
                        author: item.author,
                        downloads: item.downloads || item.download_count || 0,
                        stars: item.stars || item.star_count || 0,
                        category: item.category,
                        tags: item.tags || [],
                        homepage: item.homepage || `https://www.skillhub.cn/skills/${item.slug || item.name}`,
                    });
                }
            } else if (data.skills && Array.isArray(data.skills)) {
                // Alternative format: { skills: [...] }
                for (const item of data.skills) {
                    skills.push({
                        slug: item.slug || item.name,
                        name: item.name || item.slug,
                        description: item.description || '',
                        version: item.version || 'latest',
                        author: item.author,
                        downloads: item.downloads || item.download_count || 0,
                        stars: item.stars || item.star_count || 0,
                        category: item.category,
                        tags: item.tags || [],
                        homepage: item.homepage || `https://www.skillhub.cn/skills/${item.slug || item.name}`,
                    });
                }
            }

            this.cachedHotlist = skills;
            this.hotlistCacheTime = Date.now();

            return params.limit ? skills.slice(0, params.limit) : skills;
        } catch (error) {
            console.error('SkillShop getHotlist error:', error);
            // Return cached data if available, even if expired
            if (this.cachedHotlist) {
                return params.limit ? this.cachedHotlist.slice(0, params.limit) : this.cachedHotlist;
            }
            throw error;
        }
    }

    /**
     * Search skills via lightmake.site API
     */
    async search(params: { query: string; limit?: number }): Promise<SkillShopSkillResult[]> {
        if (!params.query || params.query.trim() === '') {
            return this.getHotlist({ limit: params.limit });
        }

        try {
            const url = new URL(SKILLSHOP_API.SEARCH);
            url.searchParams.set('q', params.query);
            if (params.limit) {
                url.searchParams.set('limit', String(params.limit));
            } else {
                url.searchParams.set('limit', '20');
            }

            const response = await fetch(url.toString(), {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();

            // Parse search results
            const results: SkillShopSkillResult[] = [];

            if (Array.isArray(data)) {
                for (const item of data) {
                    results.push(this.parseSkillItem(item));
                }
            } else if (data.results && Array.isArray(data.results)) {
                for (const item of data.results) {
                    results.push(this.parseSkillItem(item));
                }
            } else if (data.data && Array.isArray(data.data)) {
                for (const item of data.data) {
                    results.push(this.parseSkillItem(item));
                }
            }

            return results;
        } catch (error) {
            console.error('SkillShop search error:', error);
            throw error;
        }
    }

    private parseSkillItem(item: any): SkillShopSkillResult {
        return {
            slug: item.slug || item.name || '',
            name: item.name || item.title || item.slug || '',
            description: item.description || item.summary || '',
            version: item.version || 'latest',
            author: item.author || item.owner,
            downloads: item.downloads || item.download_count || item.downloads_count || 0,
            stars: item.stars || item.stars_count || item.stargazers || 0,
            category: item.category || item.tag,
            tags: item.tags || [],
            homepage: item.homepage || item.url || `https://www.skillhub.cn/skills/${item.slug || item.name}`,
        };
    }

    /**
     * Run clawhub CLI with skillhub.cn registry
     */
    private async runCommand(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.useNodeRunner && !fs.existsSync(this.cliEntryPath)) {
                reject(new Error(`ClawHub CLI entry not found at: ${this.cliEntryPath}`));
                return;
            }

            if (!this.useNodeRunner && !fs.existsSync(this.cliPath)) {
                reject(new Error(`ClawHub CLI not found at: ${this.cliPath}`));
                return;
            }

            // Use lightmake.site as registry (primary) and cn.clawhub-mirror.com as fallback
            const registries = [
                'https://lightmake.site/api/v1',
                'https://cn.clawhub-mirror.com',
            ];
            const registry = registries[0];

            const commandArgs = this.useNodeRunner
                ? [this.cliEntryPath, '--registry', registry, ...args]
                : ['--registry', registry, ...args];

            console.log(`SkillShop: Running ClawHub command (registry: ${registry}): ${this.cliPath} ${commandArgs.join(' ')}`);

            const isWin = process.platform === 'win32';
            const useShell = isWin && !this.useNodeRunner;
            const { NODE_OPTIONS: _nodeOptions, ...baseEnv } = process.env;
            const env = {
                ...baseEnv,
                CI: 'true',
                FORCE_COLOR: '0',
            };
            if (this.useNodeRunner) {
                env.ELECTRON_RUN_AS_NODE = '1';
            }
            const spawnCmd = useShell ? quoteForCmd(this.cliPath) : this.cliPath;
            const spawnArgs = useShell ? commandArgs.map(a => quoteForCmd(a)) : commandArgs;
            const child = spawn(spawnCmd, spawnArgs, {
                cwd: this.workDir,
                shell: useShell,
                env: {
                    ...env,
                    CLAWHUB_WORKDIR: this.workDir,
                },
                windowsHide: true,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                console.error('SkillShop CLI process error:', error);
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    console.error(`SkillShop CLI command failed with code ${code}`);
                    console.error('Stderr:', stderr);
                    reject(new Error(`Command failed: ${stderr || stdout}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Install a skill via clawhub CLI
     */
    async install(params: SkillShopInstallParams): Promise<void> {
        const args = ['install', params.slug];

        if (params.version) {
            args.push('--version', params.version);
        }

        if (params.force) {
            args.push('--force');
        }

        await this.runCommand(args);
    }

    /**
     * Clear hotlist cache
     */
    clearCache(): void {
        this.cachedHotlist = null;
        this.hotlistCacheTime = 0;
    }
}
