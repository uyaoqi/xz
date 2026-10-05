export const prerender = false;
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../utils/auth';

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get('admin-token')?.value;
  const user = token ? await verifyToken(token) : null;
  return new Response(JSON.stringify({ authenticated: !!user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
