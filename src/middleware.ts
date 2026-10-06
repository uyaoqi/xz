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
    const secret = env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      return new Response(JSON.stringify({ error: 'Admin authentication is not configured.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const token = context.cookies.get('admin_token')?.value;
    const isValid = token ? await verifyToken(token, secret) : null;

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
