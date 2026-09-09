import { config } from './config.js';
function bearerToken(header) {
    const match = header?.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}
function decodeClaims(token) {
    const payload = token.split('.')[1];
    if (!payload)
        throw new Error('无效的访问令牌');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
export async function authenticateToken(token) {
    const claims = decodeClaims(token);
    const userId = String(claims.id || '');
    if (!userId)
        throw new Error('令牌缺少用户标识');
    const response = await fetch(`${config.queryServiceUrl}/api/v1/rbac/role/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
        throw new Error('登录状态已失效');
    const rolePayload = (await response.json());
    const role = String(rolePayload.data?.group_name ||
        rolePayload.data?.groupName ||
        rolePayload.group_name ||
        rolePayload.groupName ||
        'VIEWER').toUpperCase();
    return {
        id: userId,
        orgId: String(claims.orgId || 'default'),
        email: String(claims.email || ''),
        role: role === 'ADMIN' || role === 'EDITOR' ? role : 'VIEWER',
        token,
    };
}
export async function authenticate(c, next) {
    if (c.req.path === '/health')
        return next();
    const token = bearerToken(c.req.header('Authorization'));
    if (!token)
        return c.json({ error: '需要登录' }, 401);
    try {
        c.set('user', await authenticateToken(token));
        await next();
    }
    catch (error) {
        return c.json({ error: error instanceof Error ? error.message : '身份验证失败' }, 401);
    }
}
export function currentUser(c) {
    return c.get('user');
}
export function requireAdmin(c) {
    return currentUser(c).role === 'ADMIN' ? null : c.json({ error: '仅管理员可执行此操作' }, 403);
}
//# sourceMappingURL=auth.js.map