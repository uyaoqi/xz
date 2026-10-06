import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../utils/auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('admin_token')?.value;
  const secret = env.JWT_SECRET;
  const user = token && secret ? await verifyToken(token, secret) : null;
  return new Response(JSON.stringify({ authenticated: !!user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
