import { ipcMain, BrowserWindow, session, app } from 'electron';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const AIGC_COOKIE_NAME = 'token';
const AIGC_URL = 'https://aigc.dayunzhonglian.com/hthotpc/100000';
const TOKEN_SAVE_PATH = 'aigc-token.txt';

let loginWindow: BrowserWindow | null = null;
let loginResolve: ((value: { success: boolean; error?: string }) => void) | null = null;

export function getTokenPath(): string {
  return path.join(app.getPath('userData'), TOKEN_SAVE_PATH);
}

export function getAigcToken(): string | null {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf8').trim();
    }
  } catch (e) {
    logger.error('[AIGC] Failed to read token:', e);
  }
  return null;
}

function setupLoginWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    title: 'AIGC 登录',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 监听 Cookie 变化
  session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
    if (loginResolve && cookie.name === AIGC_COOKIE_NAME && !removed && cookie.value) {
      logger.info('[AIGC] Token received from cookie');
      
      // 保存 token
      const tokenPath = getTokenPath();
      try {
        fs.writeFileSync(tokenPath, cookie.value, 'utf8');
        logger.info('[AIGC] Token saved');
      } catch (err) {
        logger.error('[AIGC] Failed to save token:', err);
      }

      if (loginResolve) {
        loginResolve({ success: true });
        loginResolve = null;
      }
      win.close();
    }
  });

  win.on('closed', () => {
    loginWindow = null;
    if (loginResolve) {
      loginResolve({ success: false, error: '用户取消登录' });
      loginResolve = null;
    }
  });

  win.loadURL(AIGC_URL).catch((err) => {
    logger.error('[AIGC] Failed to load:', err);
    if (loginResolve) {
      loginResolve({ success: false, error: '加载页面失败' });
      loginResolve = null;
    }
  });

  return win;
}

export function setupAigcLogin(): void {
  // 获取 token
  ipcMain.handle('aigc:get-token', async () => {
    const token = getAigcToken();
    return { success: !!token, token };
  });

  // 打开登录窗口
  ipcMain.handle('aigc:open-login', async () => {
    // 如果已有登录窗口，不重复打开
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus();
      return { success: true, message: '登录窗口已打开' };
    }

    return new Promise((resolve) => {
      loginResolve = resolve;
      loginWindow = setupLoginWindow();

      // 5分钟超时
      setTimeout(() => {
        if (loginResolve) {
          logger.warn('[AIGC] Login timeout');
          loginResolve({ success: false, error: '登录超时，请重试' });
          loginResolve = null;
          if (loginWindow && !loginWindow.isDestroyed()) {
            loginWindow.close();
          }
        }
      }, 5 * 60 * 1000);
    });
  });

  // 清除 token
  ipcMain.handle('aigc:clear-token', async () => {
    try {
      const tokenPath = getTokenPath();
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  });

  // 检查是否已登录
  ipcMain.handle('aigc:check-login', async () => {
    const token = getAigcToken();
    return { loggedIn: !!token };
  });

  logger.info('[AIGC] Login handlers registered');
}
