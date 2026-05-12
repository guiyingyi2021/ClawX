/**
 * SkillShop Service (技能商店)
 * Manages interactions with skillhub.cn API for skills browsing and installation
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { SkillHubService } from './skillhub-service';
import { getOpenClawConfigDir, getOpenClawSkillsDir, ensureDir, getClawHubCliBinPath, getClawHubCliEntryPath, quoteForCmd, getResourcesDir } from '../utils/paths';

// skillhub.cn API endpoints
const SKILLSHOP_API = {
    HOTLIST: 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/skills.json',
    SEARCH: 'https://lightmake.site/api/v1/search',
    DETAILS: 'https://lightmake.site/api/v1/skills',
};

// Local marketplace paths (from find-skills logic, adapted for DClaw)
const LOCAL_MARKETPLACE = {
    SKILLS_DIR: path.join(require('os').homedir(), '.dclaw', 'skills-marketplace', 'skills'),
    DCLAW_SKILLS: path.join(require('os').homedir(), '.dclaw', 'skills'),
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
    private skillHubService: SkillHubService | null = null;

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
        
        // Initialize SkillHubService for skillhub.cn CLI integration
        try {
            this.skillHubService = new SkillHubService();
        } catch (error) {
            console.warn('SkillShop: Failed to initialize SkillHubService:', error);
            this.skillHubService = null;
        }
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
     * Install a skill - tries SkillHubService first, falls back to ClawHub CLI
     * Priority: skillhub.cn (Python) > ClawHub CLI (Electron)
     */
    async install(params: SkillShopInstallParams): Promise<void> {
        // Try SkillHubService (skillhub.cn Python CLI) first
        if (this.skillHubService && this.skillHubService.isAvailable()) {
            console.log(`SkillShop: Installing "${params.slug}" via SkillHubService (skillhub.cn)...`);
            try {
                await this.skillHubService.install(params);
                console.log(`SkillShop: Successfully installed "${params.slug}" via SkillHubService`);
                return;
            } catch (error: any) {
                console.warn(`SkillShop: SkillHubService install failed for "${params.slug}", falling back to ClawHub CLI:`, error.message);
            }
        }

        // Fallback to ClawHub CLI (Electron tool)
        console.log(`SkillShop: Using ClawHub CLI for "${params.slug}"...`);
        await this.installViaClawHubCli(params);
    }

    /**
     * Detect skillhub Python CLI (pip install skillhub)
     * Returns the command to use (e.g., 'python -m skillhub' or 'skillhub')
     */
    private async detectSkillhubCli(): Promise<string | null> {
        const candidates = [
            'skillhub',  // If installed as a standalone CLI
            'python -m skillhub',  // If installed as Python module
            'python3 -m skillhub',
        ];

        for (const cmd of candidates) {
            try {
                const testProcess = spawn(cmd.split(' ')[0], [...cmd.split(' ').slice(1), '--version'], {
                    stdio: 'ignore',
                    windowsHide: true,
                });
                await new Promise((resolve) => {
                    testProcess.on('close', (code) => resolve(code === 0));
                    testProcess.on('error', () => resolve(false));
                    setTimeout(() => resolve(false), 3000); // 3 second timeout
                });
                console.log(`SkillShop: Found skillhub CLI: ${cmd}`);
                return cmd;
            } catch {
                continue;
            }
        }

        console.log('SkillShop: skillhub Python CLI not found, will use ClawHub CLI');
        return null;
    }

    /**
     * Install a skill via skillhub Python CLI
     */
    private async installViaSkillhubPython(cmd: string, params: SkillShopInstallParams): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = ['install', params.slug];
            if (params.version) args.push('--version', params.version);
            if (params.force) args.push('--force');

            const cmdParts = cmd.split(' ');
            const spawnCmd = cmdParts[0];
            const spawnArgs = [...cmdParts.slice(1), ...args];

            console.log(`SkillShop: Running skillhub command: ${spawnCmd} ${spawnArgs.join(' ')}`);

            const child = spawn(spawnCmd, spawnArgs, {
                cwd: this.workDir,
                shell: true,
                windowsHide: true,
                env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => { stdout += data.toString(); });
            child.stderr?.on('data', (data) => { stderr += data.toString(); });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`SkillShop: skillhub installed "${params.slug}" successfully`);
                    resolve();
                } else {
                    console.error(`SkillShop: skillhub install failed (code ${code}): ${stderr || stdout}`);
                    reject(new Error(`skillhub install failed: ${stderr || stdout || 'Unknown error'}`));
                }
            });

            child.on('error', (error) => {
                console.error(`SkillShop: skillhub process error:`, error);
                reject(error);
            });
        });
    }

    /**
     * Install a skill via ClawHub CLI (fallback method)
     */
    private async installViaClawHubCli(params: SkillShopInstallParams): Promise<void> {
        console.log(`SkillShop: Installing "${params.slug}" via ClawHub CLI...`);
        
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

    // ==================== Enhanced with find-skills logic ====================

    /**
     * Check if a skill exists in local marketplace
     * @param slug Skill slug to check
     * @returns Path to local skill if exists, null otherwise
     */
    async checkLocalMarketplace(slug: string): Promise<string | null> {
        try {
            if (!fs.existsSync(LOCAL_MARKETPLACE.SKILLS_DIR)) {
                console.log('SkillShop: Local marketplace not found at', LOCAL_MARKETPLACE.SKILLS_DIR);
                return null;
            }

            const entries = fs.readdirSync(LOCAL_MARKETPLACE.SKILLS_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillDir = path.join(LOCAL_MARKETPLACE.SKILLS_DIR, entry.name);
                const skillMdPath = path.join(skillDir, 'SKILL.md');
                
                // Check if this directory matches the requested skill
                if (entry.name === slug || fs.existsSync(skillMdPath)) {
                    // Verify it's actually the right skill by checking SKILL.md or _meta.json
                    if (fs.existsSync(skillMdPath)) {
                        console.log(`SkillShop: Found skill "${slug}" in local marketplace at ${skillDir}`);
                        return skillDir;
                    }
                }
            }

            console.log(`SkillShop: Skill "${slug}" not found in local marketplace`);
            return null;
        } catch (error) {
            console.error('SkillShop: Error checking local marketplace:', error);
            return null;
        }
    }

    /**
     * Install a skill from local marketplace to target directory
     * @param slug Skill slug
     * @param sourcePath Path to skill in local marketplace
     * @param targetDir Target skills directory (DClaw skills dir)
     * @returns Success status
     */
    async installFromLocalMarketplace(slug: string, sourcePath: string, targetDir: string): Promise<boolean> {
        try {
            ensureDir(targetDir);
            const targetPath = path.join(targetDir, slug);

            // Check if already exists in target
            if (fs.existsSync(targetPath)) {
                console.log(`SkillShop: Skill "${slug}" already exists at ${targetPath}, skipping copy`);
                return true;
            }

            // Copy entire skill directory
            fs.cpSync(sourcePath, targetPath, { recursive: true });
            console.log(`SkillShop: Copied skill "${slug}" from local marketplace to ${targetPath}`);
            return true;
        } catch (error) {
            console.error(`SkillShop: Failed to install "${slug}" from local marketplace:`, error);
            return false;
        }
    }

    /**
     * Get DClaw skills directory (simplified - no need to detect client type)
     * @returns DClaw skills directory path
     */
    detectTargetSkillsDir(): string {
        console.log('SkillShop: Using DClaw skills directory');
        return LOCAL_MARKETPLACE.DCLAW_SKILLS;
    }

    /**
     * Find if a skill is already installed
     * @param slug Skill slug to find
     * @returns Path to installed skill if exists, null otherwise
     */
    async findSkill(slug: string): Promise<string | null> {
        try {
            const skillsDir = LOCAL_MARKETPLACE.DCLAW_SKILLS;
            
            if (!fs.existsSync(skillsDir)) {
                console.log(`SkillShop: Skills directory not found at ${skillsDir}`);
                return null;
            }

            const skillPath = path.join(skillsDir, slug);
            if (fs.existsSync(skillPath)) {
                console.log(`SkillShop: Found installed skill "${slug}" at ${skillPath}`);
                return skillPath;
            }

            console.log(`SkillShop: Skill "${slug}" not found in ${skillsDir}`);
            return null;
        } catch (error) {
            console.error(`SkillShop: Error finding skill "${slug}":`, error);
            return null;
        }
    }

    /**
     * Ensure required skills are available with local marketplace check
     * Enhanced version that checks local marketplace first before downloading
     * @param requiredSkills Array of required skills with slug, required flag, and reason
     * @returns Results of installation attempts
     */
    async ensureSkillsWithLocalCheck(requiredSkills: Array<{ slug: string; required: boolean; reason: string }>): Promise<{
        results: Array<{ slug: string; status: 'installed' | 'failed' | 'skipped' | 'already_installed'; message?: string; fromLocal?: boolean }>;
        allSuccess: boolean;
    }> {
        const results: Array<{ slug: string; status: 'installed' | 'failed' | 'skipped' | 'already_installed'; message?: string; fromLocal?: boolean }> = [];
        const targetDir = this.detectTargetSkillsDir();
        
        for (const skill of requiredSkills) {
            try {
                // Check if already installed
                const existingPath = await this.findSkill(skill.slug);
                if (existingPath) {
                    console.log(`SkillShop: Skill "${skill.slug}" already installed at ${existingPath}`);
                    results.push({ slug: skill.slug, status: 'already_installed', fromLocal: true });
                    continue;
                }

                let installed = false;
                let fromLocal = false;

                // Step 1: Check local marketplace first
                const localPath = await this.checkLocalMarketplace(skill.slug);
                if (localPath) {
                    console.log(`SkillShop: Installing "${skill.slug}" from local marketplace...`);
                    installed = await this.installFromLocalMarketplace(skill.slug, localPath, targetDir);
                    fromLocal = true;
                }

                // Step 2: If not in local marketplace, install via CLI (download from remote)
                if (!installed) {
                    console.log(`SkillShop: Installing "${skill.slug}" from remote...`);
                    try {
                        await this.install({ slug: skill.slug });
                        installed = true;
                        fromLocal = false;
                    } catch (installError: any) {
                        console.error(`SkillShop: Remote install failed for "${skill.slug}":`, installError);
                    }
                }

                if (installed) {
                    results.push({ 
                        slug: skill.slug, 
                        status: 'installed', 
                        fromLocal,
                        message: fromLocal ? '从本地安装' : '从远程安装'
                    });
                } else {
                    results.push({ 
                        slug: skill.slug, 
                        status: 'failed', 
                        message: `无法安装技能: ${skill.reason}` 
                    });
                }
            } catch (error: any) {
                console.error(`SkillShop: Error processing skill "${skill.slug}":`, error);
                results.push({ 
                    slug: skill.slug, 
                    status: 'failed', 
                    message: error.message 
                });
            }
        }

        const allSuccess = results.every(r => r.status === 'installed' || r.status === 'already_installed');
        return { results, allSuccess };
    }

    /**
     * Auto-suggest skills for an expert based on their role and description
     * Uses semantic search to find relevant skills on SkillHub
     * @param expert Expert object with role, name, and description
     * @returns Array of suggested skills with relevance scores
     */
    async suggestSkillsForExpert(expert: { role: string; name: string; description?: string }): Promise<SkillShopSkillResult[]> {
        try {
            // Build search query from expert's role and description
            const query = `${expert.role} ${expert.description || ''}`.trim();
            console.log(`SkillShop: Suggesting skills for expert "${expert.name}" with query: "${query}"`);

            // Search SkillHub with semantic search
            const searchResults = await this.search({ query, limit: 10 });
            
            // Filter results by relevance score (if available) and return top matches
            const suggestions = searchResults
                .filter(skill => skill.description || skill.name)
                .slice(0, 5); // Top 5 suggestions

            console.log(`SkillShop: Found ${suggestions.length} skill suggestions for expert "${expert.name}"`);
            return suggestions;
        } catch (error) {
            console.error('SkillShop: Error suggesting skills for expert:', error);
            return [];
        }
    }

    /**
     * Get detailed information about a specific skill
     * @param slug Skill slug
     * @returns Detailed skill information or null
     */
    async getSkillDetails(slug: string): Promise<SkillShopSkillResult | null> {
        try {
            const url = `${SKILLSHOP_API.DETAILS}/${slug}`;
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch skill details: ${response.status}`);
            }

            const data = await response.json();
            return this.parseSkillItem(data);
        } catch (error) {
            console.error(`SkillShop: Error getting details for skill "${slug}":`, error);
            return null;
        }
    }

    /**
     * Get categories from SkillHub
     * @returns Array of categories
     */
    async getCategories(): Promise<string[]> {
        try {
            const url = 'https://lightmake.site/api/v1/categories';
            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch categories: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data : (data.categories || []);
        } catch (error) {
            console.error('SkillShop: Error fetching categories:', error);
            return [];
        }
    }
}
