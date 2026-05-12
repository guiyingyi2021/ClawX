import type { IncomingMessage, ServerResponse } from 'http';
import { getAllSkillConfigs, updateSkillConfig } from '../../utils/skill-config';
import { collectQuickAccessSkills, filterEnabledQuickAccessSkills, type QuickAccessRuntimeSkillStatus } from '../../utils/skill-quick-access';
import type { ClawHubInstallParams, ClawHubSearchParams, ClawHubUninstallParams } from '../../gateway/clawhub';
import type { SkillShopInstallParams } from '../../gateway/skillshop';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getSkillHubService } from '../../gateway/skillhub-service';
import { getExpertSkillConfig, setExpertSkillConfig, deleteExpertSkillConfig } from '../../utils/expert-skill-config';

export async function handleSkillRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/skills/configs' && req.method === 'GET') {
    sendJson(res, 200, await getAllSkillConfigs());
    return true;
  }

  if (url.pathname === '/api/skills/config' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{
        skillKey: string;
        apiKey?: string;
        env?: Record<string, string>;
      }>(req);
      sendJson(res, 200, await updateSkillConfig(body.skillKey, {
        apiKey: body.apiKey,
        env: body.env,
      }));
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skills/quick-access' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        workspace?: string;
      }>(req);
      const [scannedSkills, configs] = await Promise.all([
        collectQuickAccessSkills({
          workspace: body.workspace,
        }),
        getAllSkillConfigs(),
      ]);
      let runtimeSkills: QuickAccessRuntimeSkillStatus[] | undefined;
      if (ctx.gatewayManager.getStatus().state === 'running') {
        try {
          const runtimeStatus = await ctx.gatewayManager.rpc<{ skills?: QuickAccessRuntimeSkillStatus[] }>('skills.status');
          runtimeSkills = runtimeStatus.skills || [];
        } catch {
          runtimeSkills = undefined;
        }
      }
      sendJson(res, 200, {
        success: true,
        skills: filterEnabledQuickAccessSkills(scannedSkills, runtimeSkills, configs),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/capability' && req.method === 'GET') {
    try {
      sendJson(res, 200, {
        success: true,
        capability: await ctx.clawHubService.getMarketplaceCapability(),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<ClawHubSearchParams>(req);
      sendJson(res, 200, {
        success: true,
        results: await ctx.clawHubService.search(body),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/install' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<ClawHubInstallParams>(req);
      await ctx.clawHubService.install(body);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/uninstall' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<ClawHubUninstallParams>(req);
      await ctx.clawHubService.uninstall(body);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/list' && req.method === 'GET') {
    try {
      sendJson(res, 200, { success: true, results: await ctx.clawHubService.listInstalled() });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/open-readme' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug?: string; skillKey?: string; baseDir?: string }>(req);
      await ctx.clawHubService.openSkillReadme(body.skillKey || body.slug || '', body.slug, body.baseDir);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/open-path' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug?: string; skillKey?: string; baseDir?: string }>(req);
      await ctx.clawHubService.openSkillPath(body.skillKey || body.slug || '', body.slug, body.baseDir);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  // ==================== SkillShop (技能商店) Routes ====================
  
  if (url.pathname === '/api/skillshop/capability' && req.method === 'GET') {
    try {
      sendJson(res, 200, {
        success: true,
        capability: await ctx.skillShopService.getCapability(),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillshop/hotlist' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ limit?: number }>(req);
      sendJson(res, 200, {
        success: true,
        results: await ctx.skillShopService.getHotlist(body),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillshop/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ query: string; limit?: number }>(req);
      sendJson(res, 200, {
        success: true,
        results: await ctx.skillShopService.search(body),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillshop/install' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<SkillShopInstallParams>(req);
      await ctx.skillShopService.install(body);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillshop/clear-cache' && req.method === 'POST') {
    try {
      ctx.skillShopService.clearCache();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // ==================== SkillHub Routes ====================
  
  if (url.pathname === '/api/skillhub/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ query: string; limit?: number }>(req);
      const skillHubService = getSkillHubService();
      const results = await skillHubService.search(body.query, body.limit || 20);
      sendJson(res, 200, { success: true, results });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillhub/install' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug: string; skillsDir?: string }>(req);
      const skillHubService = getSkillHubService();
      const result = await skillHubService.install(body.slug, body.skillsDir);
      sendJson(res, 200, { success: true, result });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillhub/ensure-for-expert' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        requiredSkills: Array<{ slug: string; required: boolean; reason: string }>;
        skillsDir?: string;
      }>(req);
      const skillHubService = getSkillHubService();
      const result = await skillHubService.ensureSkills(body.requiredSkills, body.skillsDir);
      sendJson(res, 200, { success: true, result });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillhub/check-installed' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slugs: string[] }>(req);
      const skillHubService = getSkillHubService();
      const results = await skillHubService.batchCheckInstalled(body.slugs);
      sendJson(res, 200, { success: true, results });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skillhub/manual-install-guide' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug: string }>(req);
      const skillHubService = getSkillHubService();
      const instructions = skillHubService.getManualInstallInstructions(body.slug);
      sendJson(res, 200, { success: true, instructions });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  // ==================== Expert Skill Config Routes ====================
  
  // GET /api/expert-skill-config/:expertId - 读取专家技能配置
  if (url.pathname.startsWith('/api/expert-skill-config/') && req.method === 'GET') {
    try {
      const expertId = decodeURIComponent(url.pathname.replace('/api/expert-skill-config/', ''));
      const skills = await getExpertSkillConfig(expertId);
      sendJson(res, 200, { success: true, skills });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // POST /api/expert-skill-config/:expertId - 保存专家技能配置
  if (url.pathname.startsWith('/api/expert-skill-config/') && req.method === 'POST') {
    try {
      const expertId = decodeURIComponent(url.pathname.replace('/api/expert-skill-config/', ''));
      const body = await parseJsonBody<{ skills: string[] }>(req);
      await setExpertSkillConfig(expertId, body.skills);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // DELETE /api/expert-skill-config/:expertId - 删除专家技能配置
  if (url.pathname.startsWith('/api/expert-skill-config/') && req.method === 'DELETE') {
    try {
      const expertId = decodeURIComponent(url.pathname.replace('/api/expert-skill-config/', ''));
      await deleteExpertSkillConfig(expertId);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
