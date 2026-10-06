import { env } from "cloudflare:workers";

export interface PostRecord {
	slug: string;
	title: string;
	content: string;
	category: string;
	tags: string;
	published: string;
	draft: number;
	description: string;
	image: string;
	pinned: number;
	metadata: string;
	deleted: number;
	updated_at: string;
}

export interface D1Result<T> {
	results: T[];
	success: boolean;
}

export interface D1Statement {
	bind(...values: unknown[]): D1Statement;
	first<T>(): Promise<T | null>;
	all<T>(): Promise<D1Result<T>>;
	run(): Promise<unknown>;
}

export interface D1Database {
	prepare(query: string): D1Statement;
	batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface CloudflareEnv {
	DB: D1Database;
	ADMIN_USERNAME?: string;
	ADMIN_PASSWORD?: string;
	ADMIN_HOSTNAME?: string;
	JWT_SECRET?: string;
}

export function getCloudflareEnv(): CloudflareEnv {
	if (!env.DB) {
		throw new Error("Cloudflare D1 binding DB is not configured.");
	}
	return env;
}

export function getOptionalCloudflareEnv(): Partial<CloudflareEnv> {
	return env;
}
