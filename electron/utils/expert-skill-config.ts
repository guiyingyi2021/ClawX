/**
 * 专家技能配置存储工具
 * 
 * 存储位置：user-data/expert-skill-configs.json
 * 格式：{ [expertId: string]: string[] }
 */

import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';

const CONFIG_FILE_NAME = 'expert-skill-configs.json';

function getConfigFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CONFIG_FILE_NAME);
}

export interface ExpertSkillConfig {
  [expertId: string]: string[];
}

/**
 * 读取所有专家技能配置
 */
export async function loadExpertSkillConfigs(): Promise<ExpertSkillConfig> {
  try {
    const filePath = getConfigFilePath();
    if (!await fs.pathExists(filePath)) {
      return {};
    }
    return await fs.readJson(filePath);
  } catch (error) {
    console.error('[ExpertSkillConfig] 读取配置失败:', error);
    return {};
  }
}

/**
 * 保存所有专家技能配置
 */
export async function saveExpertSkillConfigs(configs: ExpertSkillConfig): Promise<void> {
  try {
    const filePath = getConfigFilePath();
    await fs.ensureFile(filePath);
    await fs.writeJson(filePath, configs, { spaces: 2 });
  } catch (error) {
    console.error('[ExpertSkillConfig] 保存配置失败:', error);
    throw error;
  }
}

/**
 * 获取单个专家的技能配置
 */
export async function getExpertSkillConfig(expertId: string): Promise<string[]> {
  const configs = await loadExpertSkillConfigs();
  return configs[expertId] || [];
}

/**
 * 保存单个专家的技能配置
 */
export async function setExpertSkillConfig(expertId: string, skills: string[]): Promise<void> {
  const configs = await loadExpertSkillConfigs();
  configs[expertId] = skills;
  await saveExpertSkillConfigs(configs);
}

/**
 * 删除单个专家的技能配置
 */
export async function deleteExpertSkillConfig(expertId: string): Promise<void> {
  const configs = await loadExpertSkillConfigs();
  delete configs[expertId];
  await saveExpertSkillConfigs(configs);
}

/**
 * 检查专家是否有手动配置的技能
 */
export async function hasExpertSkillConfig(expertId: string): Promise<boolean> {
  const configs = await loadExpertSkillConfigs();
  return !!configs[expertId] && configs[expertId].length > 0;
}
