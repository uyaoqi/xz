import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	createToken,
	getCredentialVersion,
	getValidAdminAuthConfig,
	hasMinimumPasswordBytes,
} from "../../../utils/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "登录请求无效。" }), {
			status: 400,
		});
	}

	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return new Response(JSON.stringify({ error: "登录请求无效。" }), {
			status: 400,
		});
	}

	const { username, password } = payload as Record<string, unknown>;
	if (
		typeof username !== "string" ||
		typeof password !== "string" ||
		!hasMinimumPasswordBytes(password)
	) {
		return new Response(
			JSON.stringify({
				error: "请使用固定管理员账号 admax，密码至少为 6 个字节。",
			}),
			{ status: 400 },
		);
	}

	const adminAuth = getValidAdminAuthConfig({
		password: env.ADMIN_PASSWORD,
		secret: env.JWT_SECRET,
	});
	if (!adminAuth) {
		return new Response(
			JSON.stringify({
				error:
					"后台认证配置无效。请在当前 Cloudflare Worker 环境设置至少 6 个字节的 ADMIN_PASSWORD，以及至少 32 个字符的 JWT_SECRET。",
			}),
			{
				status: 503,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);
	}
	const {
		username: ADMIN_USERNAME,
		password: ADMIN_PASSWORD,
		secret: JWT_SECRET,
	} = adminAuth;

	if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
		return new Response(JSON.stringify({ error: "账号或密码错误" }), {
			status: 400,
		});
	}

	const credentialVersion = await getCredentialVersion(
		ADMIN_USERNAME,
		ADMIN_PASSWORD,
		JWT_SECRET,
	);
	const token = await createToken({ username, credentialVersion }, JWT_SECRET);
	cookies.set("admin_token", token, {
		path: "/",
		httpOnly: true,
		secure: new URL(request.url).protocol === "https:",
		sameSite: "strict",
		maxAge: 60 * 60 * 24 * 7,
	});
	cookies.set("is_admin_logged", "1", {
		path: "/",
		httpOnly: false,
		secure: new URL(request.url).protocol === "https:",
		sameSite: "strict",
		maxAge: 60 * 60 * 24 * 7,
	});

	return new Response(JSON.stringify({ success: true }), { status: 200 });
};
