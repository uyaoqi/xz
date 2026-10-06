import { defineMiddleware } from 'astro:middleware';
import { verifyToken } from './utils/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname.replace(/\/+$/, '') || '/';

  // 仅拦截 /admin（除了登录页）和 /api/admin（除了登录和状态检查接口）
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isAdminApi =
    pathname.startsWith('/api/admin') &&
    pathname !== '/api/admin/login' &&
    pathname !== '/api/admin/auth-check';

  if (isAdminPage || isAdminApi) {
    const { env } = await import('cloudflare:workers');
    const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = env;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !JWT_SECRET || JWT_SECRET.length < 32) {
      return new Response(JSON.stringify({
        error: '后台认证环境变量未配置。请在本地 .dev.vars 或线上 Cloudflare Worker Secrets 中设置 ADMIN_USERNAME、ADMIN_PASSWORD 和不少于 32 个字符的 JWT_SECRET。',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
    const token = context.cookies.get('admin_token')?.value;
    const isValid = token ? await verifyToken(token, JWT_SECRET) : null;

    if (!isValid) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login/');
    }
  }

  return next();
});
