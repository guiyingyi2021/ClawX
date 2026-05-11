/**
 * SkillHub Service
 * 封装 skillhub CLI 调用，提供搜索/安装/检查技能能力
 * 
 * 依赖：
 * - Python 3.x
 * - skillhub skill (安装到 ~/.skillhub/)
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const execAsync = promisify(exec);

export interface SkillSearchResult {
  slug: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  downloads?: number;
  rating?: number;
  tags?: string[];
  requires_api?: boolean;
}

export interface SkillInstallResult {
  slug: string;
  status: 'installed' | 'already_installed' | 'failed';
  message?: string;
}

export interface RequiredSkill {
  slug: string;
  required: boolean;
  reason: string;
}

export class SkillHubService {
  private pythonCommand: string | null = null;
  private skillhubScript: string;
  private initialized: boolean = false;

  constructor() {
    // ~/.skillhub/skills_store_cli.py
    this.skillhubScript = path.join(os.homedir(), '.skillhub', 'skills_store_cli.py');
  }

  /**
   * 初始化：检测 Python 命令
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.pythonCommand = await this.detectPythonCommand();
      this.initialized = true;
      console.log(`[SkillHubService] Initialized with Python: ${this.pythonCommand}`);
    } catch (error) {
      console.error('[SkillHubService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * 检测 Python 命令（自动检测 python3 或 python）
   */
  private async detectPythonCommand(): Promise<string> {
    if (this.pythonCommand) return this.pythonCommand;

    const candidates = ['python3', 'python'];
    for (const cmd of candidates) {
      try {
        await execAsync(`${cmd} --version`);
        this.pythonCommand = cmd;
        return cmd;
      } catch {
        continue;
      }
    }
    throw new Error('Python not found. Please install Python 3.x.');
  }

  /**
   * 检查 skillhub CLI 是否可用
   */
  async checkSkillHubAvailable(): Promise<boolean> {
    try {
      await this.init();
      return fs.existsSync(this.skillhubScript);
    } catch {
      return false;
    }
  }

  /**
   * 搜索技能
   * @param query 搜索关键词
   * @param limit 限制结果数量
   */
  async search(query: string, limit: number = 20): Promise<SkillSearchResult[]> {
    await this.init();

    if (!fs.existsSync(this.skillhubScript)) {
      throw new Error('skillhub CLI not found. Please install from https://skillhub.cn/install/skillhub.md');
    }

    try {
      const { stdout } = await execAsync(
        `${this.pythonCommand} "${this.skillhubScript}" search "${query}" --json --limit ${limit}`
      );
      
      const results: SkillSearchResult[] = JSON.parse(stdout);
      return results;
    } catch (error) {
      console.error('[SkillHubService] Search failed:', error);
      throw new Error(`Skill search failed: ${error}`);
    }
  }

  /**
   * 安装指定技能
   * @param slug 技能标识
   * @param skillsDir 安装目录（默认 ~/.openclaw/skills/）
   */
  async install(slug: string, skillsDir?: string): Promise<SkillInstallResult> {
    await this.init();

    const targetDir = skillsDir || path.join(os.homedir(), '.openclaw', 'skills');
    
    // 检查是否已安装
    const alreadyInstalled = await this.checkInstalled(slug);
    if (alreadyInstalled) {
      return {
        slug,
        status: 'already_installed',
        message: `Skill ${slug} is already installed`,
      };
    }

    if (!fs.existsSync(this.skillhubScript)) {
      return {
        slug,
        status: 'failed',
        message: 'skillhub CLI not found',
      };
    }

    try {
      const { stdout } = await execAsync(
        `${this.pythonCommand} "${this.skillhubScript}" install ${slug} --dir "${targetDir}"`,
        { timeout: 60000 } // 60秒超时
      );
      
      console.log(`[SkillHubService] Install output: ${stdout}`);
      
      return {
        slug,
        status: 'installed',
        message: `Successfully installed ${slug}`,
      };
    } catch (error: any) {
      console.error('[SkillHubService] Install failed:', error);
      return {
        slug,
        status: 'failed',
        message: error.message || 'Installation failed',
      };
    }
  }

  /**
   * 检查并安装专家所需的所有技能
   * @param requiredSkills 专家需要的技能列表
   * @param skillsDir 安装目录
   */
  async ensureSkills(
    requiredSkills: RequiredSkill[],
    skillsDir?: string
  ): Promise<{ results: SkillInstallResult[]; allSuccess: boolean }> {
    const results: SkillInstallResult[] = [];
    let allSuccess = true;

    for (const required of requiredSkills) {
      try {
        const result = await this.install(required.slug, skillsDir);
        results.push(result);
        
        if (result.status === 'failed') {
          allSuccess = false;
        }
      } catch (error: any) {
        results.push({
          slug: required.slug,
          status: 'failed',
          message: error.message,
        });
        allSuccess = false;
      }
    }

    return { results, allSuccess };
  }

  /**
   * 检查技能是否已安装
   * @param slug 技能标识
   * @param skillsDir 检查目录（默认 ~/.openclaw/skills/）
   */
  async checkInstalled(slug: string, skillsDir?: string): Promise<boolean> {
    const targetDir = skillsDir || path.join(os.homedir(), '.openclaw', 'skills');
    const skillPath = path.join(targetDir, slug);
    return fs.existsSync(skillPath);
  }

  /**
   * 获取手动安装步骤说明
   * @param slug 技能标识
   */
  getManualInstallInstructions(slug: string): string {
    const skillsDir = path.join(os.homedir(), '.openclaw', 'skills');
    return `python ~/.skillhub/skills_store_cli.py install ${slug} --dir "${skillsDir}"`;
  }

  /**
   * 批量检查技能是否已安装
   * @param slugs 技能标识列表
   */
  async batchCheckInstalled(slugs: string[]): Promise<{ slug: string; installed: boolean }[]> {
    const results = await Promise.all(
      slugs.map(async (slug) => ({
        slug,
        installed: await this.checkInstalled(slug),
      }))
    );
    return results;
  }
}

// 导出单例
let instance: SkillHubService | null = null;

export function getSkillHubService(): SkillHubService {
  if (!instance) {
    instance = new SkillHubService();
  }
  return instance;
}
