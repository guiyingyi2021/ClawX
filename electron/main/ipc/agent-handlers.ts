/**
 * Agent 召唤处理器
 * 负责从 GitHub CDN 下载并安装 Agent
 */
import { ipcMain } from 'electron';
import * as agentDownloader from '../../lib/agent-downloader';

export function registerAgentHandlers(): void {
  // 召唤 Agent（下载并安装）
  ipcMain.handle('agent:summon', async (_event, agentId: string, downloadUrl: string) => {
    try {
      const result = await agentDownloader.summonAgent(agentId, downloadUrl);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Agent] 召唤失败:', message);
      return { success: false, agentId, message: `召唤失败: ${message}` };
    }
  });

  // 移除已安装的 Agent
  ipcMain.handle('agent:remove', async (_event, agentId: string) => {
    try {
      const result = agentDownloader.removeAgent(agentId);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Agent] 移除失败:', message);
      return { success: false, agentId, message: `移除失败: ${message}` };
    }
  });

  // 检查 Agent 是否已安装
  ipcMain.handle('agent:isInstalled', async (_event, agentId: string) => {
    try {
      return agentDownloader.isAgentInstalled(agentId);
    } catch {
      return false;
    }
  });

  // 获取已安装的 Agent 列表
  ipcMain.handle('agent:getInstalled', async () => {
    try {
      return agentDownloader.getInstalledAgents();
    } catch {
      return [];
    }
  });
}
