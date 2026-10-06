import {
	adConfig1,
	adConfig2,
	announcementConfig,
	backgroundWallpaper,
	commentConfig,
	coverImageConfig,
	expressiveCodeConfig,
	fontConfig,
	footerConfig,
	friendsConfig,
	friendsPageConfig,
	galleryConfig,
	getDynamicNavBarConfig,
	licenseConfig,
	live2dModelConfig,
	musicPlayerConfig,
	navBarConfig,
	navBarSearchConfig,
	profileConfig,
	sakuraConfig,
	sidebarLayoutConfig,
	siteConfig,
	spineModelConfig,
	sponsorConfig,
} from "../config";
import type { D1Database } from "./cloudflare";

export interface SiteSettingModule {
	key: string;
	label: string;
	group: string;
	value: unknown;
}

const modules: SiteSettingModule[] = [
	{
		key: "siteConfig",
		label: "站点基础信息与主题",
		group: "站点与外观",
		value: siteConfig,
	},
	{
		key: "navBarConfig",
		label: "导航栏",
		group: "站点与外观",
		value: navBarConfig,
	},
	{
		key: "navBarSearchConfig",
		label: "导航搜索",
		group: "站点与外观",
		value: navBarSearchConfig,
	},
	{
		key: "backgroundWallpaper",
		label: "背景与壁纸",
		group: "站点与外观",
		value: backgroundWallpaper,
	},
	{ key: "fontConfig", label: "字体", group: "站点与外观", value: fontConfig },
	{
		key: "footerConfig",
		label: "页脚",
		group: "站点与外观",
		value: footerConfig,
	},
	{
		key: "sidebarLayoutConfig",
		label: "侧边栏布局与组件",
		group: "页面布局与组件",
		value: sidebarLayoutConfig,
	},
	{
		key: "profileConfig",
		label: "个人资料与社交链接",
		group: "页面布局与组件",
		value: profileConfig,
	},
	{
		key: "announcementConfig",
		label: "公告",
		group: "页面布局与组件",
		value: announcementConfig,
	},
	{
		key: "adConfig1",
		label: "广告位 1",
		group: "页面布局与组件",
		value: adConfig1,
	},
	{
		key: "adConfig2",
		label: "广告位 2",
		group: "页面布局与组件",
		value: adConfig2,
	},
	{
		key: "musicPlayerConfig",
		label: "音乐播放器",
		group: "页面布局与组件",
		value: musicPlayerConfig,
	},
	{
		key: "coverImageConfig",
		label: "文章封面图",
		group: "文章与内容",
		value: coverImageConfig,
	},
	{
		key: "licenseConfig",
		label: "文章许可协议",
		group: "文章与内容",
		value: licenseConfig,
	},
	{
		key: "expressiveCodeConfig",
		label: "代码块样式",
		group: "文章与内容",
		value: expressiveCodeConfig,
	},
	{
		key: "commentConfig",
		label: "评论系统",
		group: "第三方服务与特效",
		value: commentConfig,
	},
	{
		key: "sponsorConfig",
		label: "赞助页面",
		group: "第三方服务与特效",
		value: sponsorConfig,
	},
	{
		key: "friendsPageConfig",
		label: "友链页面",
		group: "第三方服务与特效",
		value: friendsPageConfig,
	},
	{
		key: "friendsConfig",
		label: "友链列表",
		group: "第三方服务与特效",
		value: friendsConfig,
	},
	{
		key: "galleryConfig",
		label: "相册",
		group: "第三方服务与特效",
		value: galleryConfig,
	},
	{
		key: "sakuraConfig",
		label: "樱花特效",
		group: "第三方服务与特效",
		value: sakuraConfig,
	},
	{
		key: "live2dModelConfig",
		label: "Live2D 看板娘",
		group: "第三方服务与特效",
		value: live2dModelConfig,
	},
	{
		key: "spineModelConfig",
		label: "Spine 看板娘",
		group: "第三方服务与特效",
		value: spineModelConfig,
	},
];

const defaults = new Map(
	modules.map((module) => [module.key, cloneJson(module.value)]),
);
const settingsTableReady = new WeakMap<D1Database, Promise<void>>();

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateJsonValue(value: unknown, path: string, depth = 0): void {
	if (depth > 32) throw new Error(`${path} 的嵌套层级过深。`);
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "boolean"
	) {
		return;
	}
	if (typeof value === "number" && Number.isFinite(value)) return;
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			validateJsonValue(item, `${path}[${index}]`, depth + 1);
		}
		return;
	}
	if (isRecord(value)) {
		for (const [key, item] of Object.entries(value)) {
			if (key === "__proto__" || key === "constructor" || key === "prototype") {
				throw new Error(`${path}.${key} 不是允许的配置项。`);
			}
			validateJsonValue(item, `${path}.${key}`, depth + 1);
		}
		return;
	}
	throw new Error(`${path} 不是有效的 JSON 配置值。`);
}

function allowsAlternateShape(path: string, value: unknown): boolean {
	if (
		path.endsWith(".weight") &&
		(typeof value === "string" ||
			(typeof value === "number" && Number.isFinite(value)))
	) {
		return true;
	}
	if (
		(path === "fontConfig.selected" ||
			path.endsWith(".homeText.subtitle") ||
			path === "backgroundWallpaper.src" ||
			path === "backgroundWallpaper.src.desktop" ||
			path === "backgroundWallpaper.src.mobile") &&
		(typeof value === "string" ||
			(Array.isArray(value) && value.every((item) => typeof item === "string")))
	) {
		return true;
	}
	if (
		(path === "backgroundWallpaper.banner.credit.text" ||
			path === "backgroundWallpaper.banner.credit.url") &&
		typeof value === "string"
	) {
		return true;
	}
	if (
		(path === "backgroundWallpaper.banner.credit.enable" ||
			path === "backgroundWallpaper.banner.waves.enable" ||
			path === "backgroundWallpaper.overlay.switchable") &&
		typeof value === "boolean"
	) {
		return true;
	}
	return false;
}

function validateValue(value: unknown, template: unknown, path: string): void {
	if (allowsAlternateShape(path, value)) return;

	if (Array.isArray(template)) {
		if (!Array.isArray(value)) throw new Error(`${path} 必须是数组。`);
		for (const [index, item] of value.entries()) {
			const itemTemplate = template.find((candidate) => {
				if (Array.isArray(candidate)) return Array.isArray(item);
				if (isRecord(candidate)) return isRecord(item);
				return typeof item === typeof candidate;
			});
			if (itemTemplate === undefined) {
				validateJsonValue(item, `${path}[${index}]`);
			} else {
				validateValue(item, itemTemplate, `${path}[${index}]`);
			}
		}
		return;
	}

	if (isRecord(template)) {
		if (!isRecord(value)) throw new Error(`${path} 必须是对象。`);
		for (const [key, item] of Object.entries(value)) {
			if (key === "__proto__" || key === "constructor" || key === "prototype") {
				throw new Error(`${path}.${key} 不是允许的配置项。`);
			}
			if (Object.hasOwn(template, key)) {
				validateValue(item, template[key], `${path}.${key}`);
			} else {
				validateJsonValue(item, `${path}.${key}`);
			}
		}
		return;
	}

	if (
		template === null
			? value !== null
			: typeof value !== typeof template ||
				(typeof value === "number" && !Number.isFinite(value))
	) {
		throw new Error(`${path} 的值类型不正确。`);
	}
}

function restoreValue(target: unknown, source: unknown): unknown {
	if (Array.isArray(target) && Array.isArray(source)) {
		target.splice(0, target.length, ...cloneJson(source));
		return target;
	}
	if (isRecord(target) && isRecord(source)) {
		for (const key of Object.keys(target)) {
			if (!Object.hasOwn(source, key)) delete target[key];
		}
		for (const [key, value] of Object.entries(source)) {
			target[key] = restoreValue(target[key], value);
		}
		return target;
	}
	return cloneJson(source);
}

function applyValue(target: unknown, override: unknown): unknown {
	if (Array.isArray(target) && Array.isArray(override)) {
		target.splice(0, target.length, ...cloneJson(override));
		return target;
	}
	if (isRecord(target) && isRecord(override)) {
		for (const [key, value] of Object.entries(override)) {
			target[key] = applyValue(target[key], value);
		}
		return target;
	}
	return cloneJson(override);
}

export async function ensureSiteSettingsTable(DB: D1Database): Promise<void> {
	let setup = settingsTableReady.get(DB);
	if (!setup) {
		setup = DB.prepare(
			`CREATE TABLE IF NOT EXISTS site_settings (
				config_key TEXT PRIMARY KEY NOT NULL,
				config_value TEXT NOT NULL,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
		)
			.run()
			.then(() => undefined);
		settingsTableReady.set(DB, setup);
	}
	try {
		await setup;
	} catch (error) {
		settingsTableReady.delete(DB);
		throw error;
	}
}

export function getSiteSettingsModules(): SiteSettingModule[] {
	return modules.map((module) => ({
		...module,
		value: cloneJson(module.value),
	}));
}

export function validateSiteSetting(key: string, value: unknown): void {
	const template = defaults.get(key);
	if (template === undefined) throw new Error("未知的前端配置模块。");
	validateValue(value, template, key);
}

export function hasSiteSetting(key: string): boolean {
	return defaults.has(key);
}

export function applySiteSettings(
	rows: Array<{ config_key: string; config_value: string }>,
): void {
	for (const module of modules) {
		const baseline = defaults.get(module.key);
		if (baseline !== undefined)
			module.value = restoreValue(module.value, baseline);
	}

	for (const row of rows) {
		const module = modules.find(
			(candidate) => candidate.key === row.config_key,
		);
		if (!module) {
			console.error(`Ignored unknown site setting "${row.config_key}".`);
			continue;
		}
		try {
			const override: unknown = JSON.parse(row.config_value);
			validateSiteSetting(row.config_key, override);
			module.value = applyValue(module.value, override);
		} catch (error) {
			console.error(`Failed to apply site setting "${row.config_key}":`, error);
		}
	}

	if (!rows.some((row) => row.config_key === "navBarConfig")) {
		const navBarModule = modules.find(
			(module) => module.key === "navBarConfig",
		);
		if (navBarModule) {
			navBarModule.value = applyValue(
				navBarModule.value,
				getDynamicNavBarConfig(),
			);
		}
	}
}
