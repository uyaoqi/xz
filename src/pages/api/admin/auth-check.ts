import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { getCredentialVersion, verifyToken } from "../../../utils/auth";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
	const token = cookies.get("admin_token")?.value;
	const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = env;
	let user: Awaited<ReturnType<typeof verifyToken>> = null;
	if (
		token &&
		ADMIN_USERNAME &&
		ADMIN_PASSWORD &&
		JWT_SECRET &&
		JWT_SECRET.length >= 32
	) {
		const credentialVersion = await getCredentialVersion(
			ADMIN_USERNAME,
			ADMIN_PASSWORD,
			JWT_SECRET,
		);
		user = await verifyToken(token, JWT_SECRET, {
			username: ADMIN_USERNAME,
			credentialVersion,
		});
	}
	return new Response(JSON.stringify({ authenticated: !!user }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
