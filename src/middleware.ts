import { defineMiddleware } from "astro:middleware";
import { getCredentialVersion, verifyToken } from "./utils/auth";
import {
	applySiteSettings,
	ensureSiteSettingsTable,
} from "./utils/site-settings";

let workerBindingsWarningLogged = false;

export const onRequest = defineMiddleware(async (context, next) => {
	const pathname = context.url.pathname.replace(/\/+$/, "") || "/";
	const isAdminLoginPage = pathname === "/admin/login";
	const isAdminLoginApi = pathname === "/api/admin/login";
	const isAdminAuthCheckApi = pathname === "/api/admin/auth-check";
	const requestHostname = context.url.hostname.toLowerCase();
	let env: typeof import("cloudflare:workers").env;
	try {
		({ env } = await import("cloudflare:workers"));
	} catch (error) {
		if (
			pathname.startsWith("/admin") ||
			pathname.startsWith("/api/admin") ||
			requestHostname.split(".")[0] === "admin"
		) {
			console.error(
				"Cloudflare Worker bindings are required for the admin backend:",
				error,
			);
			return new Response(
				JSON.stringify({
					error: "后台管理功能需要在 Cloudflare Worker 环境中运行。",
				}),
				{
					status: 503,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				},
			);
		}
		if (!workerBindingsWarningLogged) {
			console.warn(
				"Cloudflare Worker bindings are unavailable; serving source-default site settings.",
				error,
			);
			workerBindingsWarningLogged = true;
		}
		return next();
	}
	const configuredAdminHostname = env.ADMIN_HOSTNAME?.trim().toLowerCase();
	const isAdminHost =
		requestHostname === configuredAdminHostname ||
		(!configuredAdminHostname && requestHostname.split(".")[0] === "admin");
	const isAdminRoot = isAdminHost && pathname === "/";

	// 保护管理路径与专用管理域名；登录页、登录接口和状态检查接口除外。
	const isAdminPage =
		pathname.startsWith("/admin") && pathname !== "/admin/login";
	const isAdminApi =
		pathname.startsWith("/api/admin") &&
		pathname !== "/api/admin/login" &&
		pathname !== "/api/admin/auth-check";

	const requiresAdminAuth =
		isAdminPage ||
		isAdminApi ||
		(isAdminHost &&
			!isAdminLoginPage &&
			!isAdminLoginApi &&
			!isAdminAuthCheckApi);
	if (requiresAdminAuth) {
		const { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } = env;
		if (
			!ADMIN_USERNAME ||
			!ADMIN_PASSWORD ||
			!JWT_SECRET ||
			JWT_SECRET.length < 32
		) {
			return new Response(
				JSON.stringify({
					error:
						"后台认证环境变量未配置。请在本地 .dev.vars 或线上 Cloudflare Worker Secrets 中设置 ADMIN_USERNAME、ADMIN_PASSWORD 和不少于 32 个字符的 JWT_SECRET。",
				}),
				{
					status: 503,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				},
			);
		}
		const token = context.cookies.get("admin_token")?.value;
		const credentialVersion = await getCredentialVersion(
			ADMIN_USERNAME,
			ADMIN_PASSWORD,
			JWT_SECRET,
		);
		const isValid = token
			? await verifyToken(token, JWT_SECRET, {
					username: ADMIN_USERNAME,
					credentialVersion,
				})
			: null;

		if (!isValid) {
			if (isAdminApi) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}
			return context.redirect("/admin/login/");
		}

		if (isAdminRoot) {
			return context.redirect("/admin/");
		}
	}

	if (
		!pathname.startsWith("/admin") &&
		!pathname.startsWith("/api/") &&
		env.DB
	) {
		try {
			await ensureSiteSettingsTable(env.DB);
			const { results } = await env.DB.prepare(
				"SELECT config_key, config_value FROM site_settings",
			).all<{ config_key: string; config_value: string }>();
			applySiteSettings(results);
		} catch (error) {
			console.error(
				"Failed to load runtime site settings; using source defaults:",
				error,
			);
			applySiteSettings([]);
		}
	}

	return next();
});
