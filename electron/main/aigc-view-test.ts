/**
 * AIGC BrowserView 内嵌测试
 * 直接用 Electron BrowserView 加载 AIGC 站点，验证内嵌可行性
 */

import { app, BrowserWindow, BrowserView, session } from 'electron';
import * as path from 'path';

const AIGC_URL = 'https://aigc.dayunzhonglian.com/hthotpc/100000';

let mainWindow: BrowserWindow | null = null;
let aigcView: BrowserView | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AIGC 内嵌测试',
  });

  // 创建 BrowserView 来加载 AIGC 站点
  aigcView = new BrowserView({
    webPreferences: {
      // 与主窗口共享 session（共享 cookie/localStorage）
      partition: 'persist:default',
      contextIsolation: false,
      nodeIntegration: false,
    }
  });

  mainWindow.setBrowserView(aigcView);
  
  // 设置 BrowserView 大小和位置
  const bounds = mainWindow.getBounds();
  aigcView.setBounds({
    x: 0,
    y: 60,  // 留出顶部空间
    width: bounds.width,
    height: bounds.height - 60
  });
  aigcView.setAutoResize({ width: true, height: true });

  // 加载 AIGC 站点
  aigcView.webContents.loadURL(AIGC_URL);

  // 监听加载完成
  aigcView.webContents.on('did-finish-load', () => {
    console.log('✅ AIGC 站点加载完成');
    console.log('标题:', aigcView?.webContents.getTitle());

    // 检查 localStorage 中的 token
    aigcView?.webContents.executeJavaScript(`
      const token = localStorage.getItem('webToken');
      console.log('webToken:', token ? '已登录 (' + token.substring(0, 30) + '...)' : '未登录');
    `);
  });

  aigcView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ 加载失败:', errorCode, errorDescription);
  });

  // 监听控制台消息
  aigcView.webContents.on('console-message', (event, level, message) => {
    console.log('[BrowserView Console]', message);
  });

  // 添加顶部工具栏（显示状态）
  mainWindow.webContents.executeJavaScript(`
    document.body.innerHTML = \`
      <div style="height: 60px; background: #1a1a2e; color: white; padding: 10px; display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 18px; font-weight: bold;">Dclaw - AIGC 内嵌测试</div>
        <div style="color: #888;">点击页面登录 AIGC</div>
      </div>
    \`;
  `);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('🚀 启动 AIGC 内嵌测试...');
  console.log('URL:', AIGC_URL);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
