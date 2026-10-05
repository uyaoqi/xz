export const prerender = false;
import type { APIRoute } from 'astro';
import { createToken } from '../../../utils/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { username, password } = await request.json();
    const correctUser = process.env.ADMIN_USERNAME || 'admin';
    const correctPass = process.env.ADMIN_PASSWORD || 'admin';

    if (username === correctUser && password === correctPass) {
      const token = await createToken({ username });
      // 写入安全 Cookie
      cookies.set('admin_token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 天
      });
      // 写入一个非 httpOnly 的标记供前台感知登录状态
      cookies.set('is_admin_logged', '1', {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
      });

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: '账号或密码错误' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};