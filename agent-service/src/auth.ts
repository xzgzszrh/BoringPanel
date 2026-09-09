import type { Context, Next } from 'hono';

import { config } from './config.js';
import type { AuthenticatedUser } from './types.js';

function bearerToken(header?: string): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function decodeClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('无效的访问令牌');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export async function authenticateToken(token: string): Promise<AuthenticatedUser> {
  const claims = decodeClaims(token);
  const userId = String(claims.id || '');
  if (!userId) throw new Error('令牌缺少用户标识');

  const response = await fetch(`${config.queryServiceUrl}/api/v1/rbac/role/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('登录状态已失效');
  const rolePayload = (await response.json()) as {
    data?: { groupName?: string; group_name?: string };
    groupName?: string;
    group_name?: string;
  };
  const role = String(
    rolePayload.data?.group_name ||
      rolePayload.data?.groupName ||
      rolePayload.group_name ||
      rolePayload.groupName ||
      'VIEWER',
  ).toUpperCase();

  return {
    id: userId,
    orgId: String(claims.orgId || 'default'),
    email: String(claims.email || ''),
    role: role === 'ADMIN' || role === 'EDITOR' ? role : 'VIEWER',
    token,
  };
}

export async function authenticate(c: Context, next: Next): Promise<Response | void> {
  if (c.req.path === '/health') return next();

  const token = bearerToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: '需要登录' }, 401);

  try {
    c.set('user', await authenticateToken(token));
    await next();
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : '身份验证失败' }, 401);
  }
}

export function currentUser(c: Context): AuthenticatedUser {
  return c.get('user') as AuthenticatedUser;
}

export function requireAdmin(c: Context): Response | null {
  return currentUser(c).role === 'ADMIN' ? null : c.json({ error: '仅管理员可执行此操作' }, 403);
}
