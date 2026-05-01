import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HostApiContext } from '../context';
import { sendJson, setCorsHeaders } from '../route-utils';
import { getAigcToken } from '../../main/aigc-login';

export async function handleAigcRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  setCorsHeaders(res);

  // GET /api/aigc/token - 获取保存的 token
  if (url.pathname === '/api/aigc/token' && req.method === 'GET') {
    const token = getAigcToken();
    sendJson(res, { success: !!token, token });
    return true;
  }

  // GET /api/aigc/check - 检查是否已登录
  if (url.pathname === '/api/aigc/check' && req.method === 'GET') {
    const token = getAigcToken();
    sendJson(res, { loggedIn: !!token });
    return true;
  }

  return false; // 继续尝试其他路由
}
