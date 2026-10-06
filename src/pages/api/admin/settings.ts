import type { APIRoute } from "astro";
import { getCloudflareEnv } from "../../../utils/cloudflare";
import {
	applySiteSettings,
	ensureSiteSettingsTable,
	getSiteSettingsModules,
	hasSiteSetting,
	validateSiteSetting,
} from "../../../utils/site-settings";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});

async function readSettings(DB: ReturnType<typeof getCloudflareEnv>["DB"]) {
	await ensureSiteSettingsTable(DB);
	const { results } = await DB.prepare(
		"SELECT config_key, config_value FROM site_settings",
	).all<{ config_key: string; config_value: string }>();
	applySiteSettings(results);
	return results;
}

export const GET: APIRoute = async () => {
	try {
		const { DB } = getCloudflareEnv();
		await readSettings(DB);
		return json({ modules: getSiteSettingsModules() });
	} catch (error) {
		console.error("Failed to read site settings:", error);
		return json(
			{ error: "读取前端配置失败，请检查 Cloudflare D1 绑定。" },
			500,
		);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: "请求内容不是有效的 JSON。" }, 400);
	}

	if (
		!body ||
		typeof body !== "object" ||
		typeof (body as Record<string, unknown>).configKey !== "string" ||
		!("config" in body)
	) {
		return json({ error: "请提供配置模块名称和配置内容。" }, 400);
	}

	const { configKey, config } = body as {
		configKey: string;
		config: unknown;
	};
	const serialized = JSON.stringify(config);
	if (serialized.length > 500_000) {
		return json({ error: "单个配置模块不能超过 500 KB。" }, 413);
	}

	try {
		validateSiteSetting(configKey, config);
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : "配置内容无效。" },
			400,
		);
	}

	try {
		const { DB } = getCloudflareEnv();
		await ensureSiteSettingsTable(DB);
		await DB.prepare(
			`INSERT INTO site_settings (config_key, config_value, updated_at)
			 VALUES (?, ?, CURRENT_TIMESTAMP)
			 ON CONFLICT(config_key) DO UPDATE SET
				config_value = excluded.config_value,
				updated_at = CURRENT_TIMESTAMP`,
		)
			.bind(configKey, serialized)
			.run();
		await readSettings(DB);
		return json({ success: true });
	} catch (error) {
		console.error("Failed to save site setting:", error);
		return json(
			{ error: "保存前端配置失败，请检查 Cloudflare D1 数据库。" },
			500,
		);
	}
};

export const DELETE: APIRoute = async ({ url }) => {
	const configKey = url.searchParams.get("key");
	if (!configKey || !hasSiteSetting(configKey)) {
		return json({ error: "缺少或无效的配置模块名称。" }, 400);
	}

	try {
		const { DB } = getCloudflareEnv();
		await ensureSiteSettingsTable(DB);
		await DB.prepare("DELETE FROM site_settings WHERE config_key = ?")
			.bind(configKey)
			.run();
		await readSettings(DB);
		return json({ success: true });
	} catch (error) {
		console.error("Failed to reset site setting:", error);
		return json(
			{ error: "恢复默认配置失败，请检查 Cloudflare D1 数据库。" },
			500,
		);
	}
};
