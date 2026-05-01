/**
 * Agent 下载与安装模块
 * 负责从 GitHub CDN 下载 Agent zip 包并安装到本地
 */
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';

interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface InstallResult {
  success: boolean;
  agentId?: string;
  message: string;
}

/**
 * 获取 Agent 本地存储目录
 */
function getAgentsDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'agents');
}

/**
 * 确保目录存在
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 下载文件（支持进度回调）
 */
async function downloadFile(
  url: string,
  destPath: string,
  _onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(destPath);
    
    const request = protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath, _onProgress).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      
      pipeline(response, file)
        .then(() => resolve())
        .catch(reject);
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * 解压 zip 文件
 */
async function unzipFile(zipPath: string, destDir: string): Promise<void> {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

/**
 * 检查 Agent 是否已安装
 */
export function isAgentInstalled(agentId: string): boolean {
  const agentDir = path.join(getAgentsDir(), agentId);
  return fs.existsSync(agentDir);
}

/**
 * 获取已安装的 Agent 列表
 */
export function getInstalledAgents(): string[] {
  const agentsDir = getAgentsDir();
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  return fs.readdirSync(agentsDir).filter((item) => {
    const itemPath = path.join(agentsDir, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

/**
 * 召唤 Agent（下载并安装）
 */
export async function summonAgent(
  agentId: string,
  downloadUrl: string,
  _onProgress?: (progress: DownloadProgress) => void
): Promise<InstallResult> {
  try {
    const agentsDir = getAgentsDir();
    await ensureDir(agentsDir);
    
    // 检查是否已安装
    const agentDir = path.join(agentsDir, agentId);
    if (isAgentInstalled(agentId)) {
      return {
        success: false,
        agentId,
        message: '该专家已在本地召唤，无需重复召唤',
      };
    }
    
    // 下载 zip 文件
    const tempZipPath = path.join(agentsDir, `${agentId}.zip`);
    
    console.log(`[Agent Download] 开始下载: ${downloadUrl}`);
    await downloadFile(downloadUrl, tempZipPath, _onProgress);
    console.log(`[Agent Download] 下载完成: ${tempZipPath}`);
    
    // 解压到 agent 目录
    console.log(`[Agent Install] 开始解压: ${tempZipPath}`);
    await unzipFile(tempZipPath, agentsDir);
    console.log(`[Agent Install] 解压完成: ${agentDir}`);
    
    // 删除临时 zip 文件
    fs.unlinkSync(tempZipPath);
    
    // 检查解压结果
    if (!isAgentInstalled(agentId)) {
      return {
        success: false,
        agentId,
        message: '召唤失败：解压后未找到 Agent 文件',
      };
    }
    
    return {
      success: true,
      agentId,
      message: '召唤成功！该专家已添加到你的专家广场',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`[Agent Download] 召唤失败: ${errorMessage}`);
    return {
      success: false,
      agentId,
      message: `召唤失败: ${errorMessage}`,
    };
  }
}

/**
 * 移除已安装的 Agent
 */
export function removeAgent(agentId: string): InstallResult {
  try {
    const agentDir = path.join(getAgentsDir(), agentId);
    if (!isAgentInstalled(agentId)) {
      return {
        success: false,
        agentId,
        message: '该专家未安装',
      };
    }
    
    fs.rmSync(agentDir, { recursive: true, force: true });
    
    return {
      success: true,
      agentId,
      message: '已移除该专家',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      agentId,
      message: `移除失败: ${errorMessage}`,
    };
  }
}
