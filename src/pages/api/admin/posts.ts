import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import {
	type D1Statement,
	getCloudflareEnv,
	type PostRecord,
} from "../../../utils/cloudflare";

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});

function toPostResponse(post: PostRecord) {
	const metadata = JSON.parse(post.metadata) as Record<string, unknown>;
	return {
		slug: post.slug,
		title: post.title,
		published: post.published,
		draft: Boolean(post.draft),
		tags: JSON.parse(post.tags) as string[],
		category: post.category || "未分类",
		frontmatter: metadata,
		content: post.content,
	};
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const { DB } = getCloudflareEnv();
		const slug = url.searchParams.get("slug");
		if (slug) {
			const post = await DB.prepare("SELECT * FROM posts WHERE slug = ?")
				.bind(slug)
				.first<PostRecord>();
				if (post) {
					return post.deleted
						? json({ error: "文章不存在。" }, 404)
						: json(toPostResponse(post));
				}

				const sourcePost = (await getCollection("posts")).find(
					(entry) => entry.id.replace(/\.(md|mdx)$/i, "") === slug,
				);
				if (!sourcePost) return json({ error: "文章不存在。" }, 404);
				return json({
					slug,
					title: sourcePost.data.title,
					published: sourcePost.data.published.toISOString().slice(0, 10),
					draft: sourcePost.data.draft,
					tags: sourcePost.data.tags,
					category: sourcePost.data.category || "未分类",
					frontmatter: sourcePost.data,
					content: sourcePost.body ?? "",
				});
			}

			const [{ results }, sourcePosts] = await Promise.all([
				DB.prepare("SELECT * FROM posts ORDER BY published DESC, updated_at DESC")
					.all<PostRecord>(),
				getCollection("posts"),
			]);
			const postMap = new Map<string, ReturnType<typeof toPostResponse>>();
			for (const sourcePost of sourcePosts) {
				const sourceSlug = sourcePost.id.replace(/\.(md|mdx)$/i, "");
				postMap.set(sourceSlug, {
					slug: sourceSlug,
					title: sourcePost.data.title,
					published: sourcePost.data.published.toISOString().slice(0, 10),
					draft: sourcePost.data.draft,
					tags: sourcePost.data.tags,
					category: sourcePost.data.category || "未分类",
					frontmatter: sourcePost.data,
					content: sourcePost.body ?? "",
				});
			}
			for (const post of results) {
				if (post.deleted) {
					postMap.delete(post.slug);
				} else {
					postMap.set(post.slug, toPostResponse(post));
				}
			}
			return json(
				[...postMap.values()].sort((a, b) =>
					a.published < b.published ? 1 : -1,
				),
			);
		} catch (error) {
		console.error("Failed to read posts from D1:", error);
		return json({ error: "读取文章失败，请检查 D1 数据库配置。" }, 500);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const payload: unknown = await request.json();
		if (!payload || typeof payload !== "object") {
			return json({ error: "请求内容无效。" }, 400);
		}

		const { slug, originalSlug, frontmatter, content } = payload as Record<
			string,
			unknown
		>;
		if (
			typeof slug !== "string" ||
			!slug.trim() ||
			!/^[-\p{L}\p{N}_]+$/u.test(slug.trim()) ||
			!frontmatter ||
			typeof frontmatter !== "object" ||
			typeof content !== "string"
		) {
			return json({ error: "请提供有效的文章别名、元数据和 Markdown 正文。" }, 400);
		}
		if (content.length > 1_000_000) {
			return json({ error: "文章正文不能超过 1 MB。" }, 413);
		}

		const cleanSlug = slug.trim().toLowerCase();
		const oldSlug =
			typeof originalSlug === "string" && originalSlug !== cleanSlug
				? originalSlug
				: null;
		const metadata = frontmatter as Record<string, unknown>;
		const sourceSlug =
			typeof originalSlug === "string" ? originalSlug : cleanSlug;
		const sourcePost = (await getCollection("posts")).find(
			(entry) => entry.id.replace(/\.(md|mdx)$/i, "") === sourceSlug,
		);
		if (sourcePost?.data.password) {
			return json(
				{ error: "加密文章暂不支持通过在线编辑器修改，请继续使用原有加密文章流程。" },
				400,
			);
		}

		const title =
			typeof metadata.title === "string" && metadata.title.trim()
				? metadata.title.trim()
				: cleanSlug;
		const published =
			typeof metadata.published === "string" && metadata.published
				? metadata.published
				: new Date().toISOString().slice(0, 10);
		const tags = Array.isArray(metadata.tags)
			? metadata.tags.filter((tag): tag is string => typeof tag === "string")
			: [];
		const category =
			typeof metadata.category === "string" ? metadata.category : "";
		const description =
			typeof metadata.description === "string" ? metadata.description : "";
		const image = typeof metadata.image === "string" ? metadata.image : "";

		const { DB } = getCloudflareEnv();
		const conflictingPost = await DB.prepare(
			"SELECT slug FROM posts WHERE slug = ?",
		)
			.bind(cleanSlug)
			.first<{ slug: string }>();
		if (conflictingPost && conflictingPost.slug !== oldSlug) {
			return json({ error: "该文章别名已被使用。" }, 409);
		}

		const statements: D1Statement[] = [];
		if (oldSlug) {
			statements.push(
				DB.prepare(
					`INSERT INTO posts (slug, title, content, published, deleted, metadata, updated_at)
					 VALUES (?, ?, '', ?, 1, '{}', CURRENT_TIMESTAMP)
					 ON CONFLICT(slug) DO UPDATE SET deleted = 1, updated_at = CURRENT_TIMESTAMP`,
				).bind(oldSlug, oldSlug, published),
			);
		}
		statements.push(
			DB.prepare(
				`INSERT INTO posts
					(slug, title, content, category, tags, published, draft, description, image, pinned, metadata, deleted, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
				 ON CONFLICT(slug) DO UPDATE SET
					title = excluded.title,
					content = excluded.content,
					category = excluded.category,
					tags = excluded.tags,
					published = excluded.published,
					draft = excluded.draft,
					description = excluded.description,
					image = excluded.image,
					pinned = excluded.pinned,
					metadata = excluded.metadata,
					deleted = 0,
					updated_at = CURRENT_TIMESTAMP`,
			).bind(
				cleanSlug,
				title,
				content,
				category,
				JSON.stringify(tags),
				published,
				metadata.draft === true ? 1 : 0,
				description,
				image,
				metadata.pinned === true ? 1 : 0,
				JSON.stringify(metadata),
			),
		);
		await DB.batch(statements);
		return json({ success: true, slug: cleanSlug, message: "文章已保存到 D1。" });
	} catch (error) {
		console.error("Failed to save post to D1:", error);
		return json({ error: "保存文章失败，请检查 D1 数据库配置。" }, 500);
	}
};

export const DELETE: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");
	if (!slug || !/^[-\p{L}\p{N}_]+$/u.test(slug)) {
		return json({ error: "缺少有效的文章别名。" }, 400);
	}

	try {
		const { DB } = getCloudflareEnv();
		const sourcePost = (await getCollection("posts")).find(
			(entry) => entry.id.replace(/\.(md|mdx)$/i, "") === slug,
		);
		if (sourcePost) {
			await DB.prepare(
				`INSERT INTO posts (slug, title, content, published, deleted, metadata, updated_at)
				 VALUES (?, ?, '', ?, 1, '{}', CURRENT_TIMESTAMP)
				 ON CONFLICT(slug) DO UPDATE SET deleted = 1, updated_at = CURRENT_TIMESTAMP`,
			)
				.bind(slug, slug, sourcePost.data.published.toISOString().slice(0, 10))
				.run();
		} else {
			await DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
		}
		return json({ success: true, deleted: true });
	} catch (error) {
		console.error("Failed to delete post from D1:", error);
		return json({ error: "删除文章失败，请检查 D1 数据库配置。" }, 500);
	}
};
