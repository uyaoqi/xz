import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	getCredentialVersion,
	getValidAdminAuthConfig,
	verifyToken,
} from "../../../utils/auth";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
	const token = cookies.get("admin_token")?.value;
	const adminAuth = getValidAdminAuthConfig({
		username: env.ADMIN_USERNAME,
		password: env.ADMIN_PASSWORD,
		secret: env.JWT_SECRET,
	});
	let user: Awaited<ReturnType<typeof verifyToken>> = null;
	if (token && adminAuth) {
		const credentialVersion = await getCredentialVersion(
			adminAuth.username,
			adminAuth.password,
			adminAuth.secret,
		);
		user = await verifyToken(token, adminAuth.secret, {
			username: adminAuth.username,
			credentialVersion,
		});
	}
	return new Response(JSON.stringify({ authenticated: !!user }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
