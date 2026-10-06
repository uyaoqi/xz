export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete('admin_token', { path: '/' });
  cookies.delete('is_admin_logged', { path: '/' });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
