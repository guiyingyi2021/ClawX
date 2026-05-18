/**
 * AIGC Panel Manager
 * 
 * 使用 BrowserView 内嵌 AIGC 站点，实现：
 * - 与主窗口共享 session（自动登录）
 * - 本地存储持久化
 * - 平滑切换体验
 */

import { app, BrowserView, BrowserWindow, ipcMain, ipcRenderer } from 'electron';
import { join } from 'path';
import { readFileSync, existsSync, watchFile } from 'fs';

// AIGC site_id 配置（可配置，避免硬编码）
// 优先级：1. ~/.dclaw/aigc-config.json  2. 默认值 100000
function getAigcSiteId(): string {
  try {
    const configPath = join(app.getPath('home'), '.dclaw', 'aigc-config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (config.siteId) return config.siteId;
    }
  } catch { /* ignore */ }
  return '100000'; // 默认 site_id
}

function getAigcUrl(): string {
  return `https://aigc.dayunzhonglian.com/hthotpc/${getAigcSiteId()}`;
}

let aigcView: BrowserView | null = null;
let mainWindowRef: BrowserWindow | null = null;
let isVisible = false;

// 动态 bounds：用于计算 BrowserView 位置
interface AigcBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
let currentBounds: AigcBounds = { x: 0, y: 0, width: 800, height: 600 };

/**
 * 创建 AIGC BrowserView
 */
function createAigcView(mainWindow: BrowserWindow): BrowserView {
  // 使用与主窗口相同的 partition，共享 session/localStorage
  const view = new BrowserView({
    webPreferences: {
      partition: 'persist:default',
      contextIsolation: false,  // 允许访问页面内容
      nodeIntegration: false,
    }
  });

  // 加载 AIGC 站点（动态 URL，支持配置 site_id）
  const aigcUrl = getAigcUrl();
  console.log('[AIGC] 加载 URL:', aigcUrl);
  view.webContents.loadURL(aigcUrl);

  // 监听加载状态
  view.webContents.on('did-finish-load', () => {
    console.log('[AIGC] 站点加载完成');
  });

  view.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('[AIGC] 加载失败:', errorCode, errorDescription);
  });

  // 阻止在 AIGC 站点内打开新窗口
  view.webContents.setWindowOpenHandler(({ url }) => {
    // AIGC 站点的外部链接可以在默认浏览器中打开
    if (url.startsWith('http')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return view;
}

/**
 * 显示 AIGC BrowserView
 * @param bounds 可选的 bounds，如果提供则使用，否则使用保存的 currentBounds
 */
function showAigcView(mainWindow: BrowserWindow, bounds?: AigcBounds): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[AIGC] 主窗口已销毁，无法显示');
    return;
  }

  // 创建 BrowserView（如果不存在）
  if (!aigcView) {
    aigcView = createAigcView(mainWindow);
  }

  // 使用传入的 bounds 或当前保存的 bounds
  const targetBounds = bounds || currentBounds;
  currentBounds = targetBounds;

  // 设置 BrowserView 位置（仅覆盖 main content 区域，不覆盖 Sidebar）
  aigcView.setBounds({
    x: targetBounds.x,
    y: targetBounds.y,
    width: targetBounds.width,
    height: targetBounds.height
  });
  aigcView.setAutoResize({ width: true, height: true });

  // 将 BrowserView 添加到主窗口
  mainWindow.addBrowserView(aigcView);

  // 确保在其他内容之上
  mainWindow.setTopBrowserView(aigcView);

  isVisible = true;
  console.log('[AIGC] BrowserView 已显示，bounds:', targetBounds);
}

/**
 * 隐藏 AIGC BrowserView
 */
function hideAigcView(): void {
  if (!aigcView || !mainWindowRef || mainWindowRef.isDestroyed()) {
    return;
  }

  try {
    mainWindowRef.removeBrowserView(aigcView);
  } catch (e) {
    // 可能已经移除
  }
  
  isVisible = false;
  console.log('[AIGC] BrowserView 已隐藏');
}

/**
 * 切换 AIGC 视图
 */
function toggleAigcView(mainWindow: BrowserWindow): void {
  if (isVisible) {
    hideAigcView();
  } else {
    showAigcView(mainWindow);
  }
}

/**
 * 初始化 AIGC Panel
 */
export function setupAigcPanel(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  // 注册 IPC 处理器
  ipcMain.on('aigc:show-view', (_, bounds?: AigcBounds) => {
    console.log('[AIGC] 收到显示请求', bounds);
    showAigcView(mainWindow, bounds);
  });

  ipcMain.on('aigc:hide-view', () => {
    console.log('[AIGC] 收到隐藏请求');
    hideAigcView();
  });

  ipcMain.on('aigc:toggle-view', (_, bounds?: AigcBounds) => {
    console.log('[AIGC] 收到切换请求');
    if (isVisible) {
      hideAigcView();
    } else {
      showAigcView(mainWindow, bounds);
    }
  });

  // 更新 bounds（例如 Sidebar 折叠/展开时）
  ipcMain.on('aigc:update-bounds', (_, bounds: AigcBounds) => {
    console.log('[AIGC] 收到 bounds 更新:', bounds);
    currentBounds = bounds;
    if (isVisible && aigcView) {
      aigcView.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
    }
  });

  ipcMain.handle('aigc:is-visible', () => {
    return isVisible;
  });

  // 监听窗口大小变化，使用保存的 bounds 重新调整
  mainWindow.on('resize', () => {
    if (isVisible && aigcView) {
      // 窗口大小变化时，重新应用保存的 bounds
      aigcView.setBounds({
        x: currentBounds.x,
        y: currentBounds.y,
        width: currentBounds.width,
        height: currentBounds.height
      });
    }
  });

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    hideAigcView();
    aigcView = null;
    mainWindowRef = null;
  });

  console.log('[AIGC] Panel 初始化完成');
}
