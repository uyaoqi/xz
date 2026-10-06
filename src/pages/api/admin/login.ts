import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { createToken } from '../../../utils/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { username, password } = await request.json();
    const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = env;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !JWT_SECRET || JWT_SECRET.length < 32) {
      return new Response(JSON.stringify({
        error: '后台认证环境变量未配置。请在本地 .dev.vars 或线上 Cloudflare Worker Secrets 中设置 ADMIN_USERNAME、ADMIN_PASSWORD 和不少于 32 个字符的 JWT_SECRET。',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = await createToken({ username }, JWT_SECRET);
      // 写入安全 Cookie
      cookies.set('admin_token', token, {
        path: '/',
        httpOnly: true,
        secure: new URL(request.url).protocol === 'https:',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 天
      });
      // 写入一个非 httpOnly 的标记供前台感知登录状态
      cookies.set('is_admin_logged', '1', {
        path: '/',
        httpOnly: false,
        secure: new URL(request.url).protocol === 'https:',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
      });

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: '账号或密码错误' }), { status: 400 });
  } catch {
    return new Response(JSON.stringify({ error: '登录请求无效。' }), { status: 400 });
  }
};