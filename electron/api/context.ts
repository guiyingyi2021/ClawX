import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { ClawHubService } from '../gateway/clawhub';
import type { SkillShopService } from '../gateway/skillshop';
import type { HostEventBus } from './event-bus';

export interface HostApiContext {
  gatewayManager: GatewayManager;
  clawHubService: ClawHubService;
  skillShopService: SkillShopService;
  eventBus: HostEventBus;
  mainWindow: BrowserWindow | null;
}
