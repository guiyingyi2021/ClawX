/**
 * AIGC 页面 - 轻量级容器
 *
 * 这个页面本身不渲染内容，而是通过 IPC 通知主进程
 * 切换到 AIGC BrowserView。
 *
 * 真正的 AIGC 站点由 Electron 主进程通过 BrowserView 加载，
 * 从而实现与主窗口共享 session/localStorage。
 *
 * 关键：BrowserView 只覆盖 main content 区域，
 * Sidebar 保持可见可点击，实现自由切换。
 */
import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings';

interface AigcBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function Aigc() {
  const { t } = useTranslation(['dashboard', 'settings']);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);

  // 计算 BrowserView bounds：只覆盖 main content 区域
  const calculateBounds = useCallback((): AigcBounds => {
    // Sidebar 宽度：展开 256px，折叠 64px
    const sidebarWidth = sidebarCollapsed ? 64 : 256;
    // TitleBar 高度（h-10 = 40px）
    const titleBarHeight = 40;
    // 窗口尺寸
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    return {
      x: sidebarWidth,
      y: titleBarHeight,
      width: windowWidth - sidebarWidth,
      height: windowHeight - titleBarHeight,
    };
  }, [sidebarCollapsed]);

  useEffect(() => {
    // 通知主进程显示 AIGC View，并传入 bounds
    const bounds = calculateBounds();
    console.log('[AIGC] 页面挂载，计算 bounds:', bounds);
    window.electron.ipcRenderer.send('aigc:show-view', bounds);

    // 监听 Sidebar 折叠状态变化，更新 bounds
    const handleResize = () => {
      const newBounds = calculateBounds();
      window.electron.ipcRenderer.send('aigc:update-bounds', newBounds);
    };

    window.addEventListener('resize', handleResize);

    // 页面卸载时隐藏 AIGC View
    return () => {
      window.removeEventListener('resize', handleResize);
      window.electron.ipcRenderer.send('aigc:hide-view');
    };
  }, [calculateBounds]);

  // Sidebar 折叠/展开时更新 bounds
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      const bounds = calculateBounds();
      window.electron.ipcRenderer.send('aigc:update-bounds', bounds);
    }
  }, [sidebarCollapsed, calculateBounds]);

  return (
    <div
      data-testid="aigc-page"
      className="h-full w-full flex items-center justify-center"
    >
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">正在加载 AIGC...</p>
      </div>
    </div>
  );
}

export default Aigc;
