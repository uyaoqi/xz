export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const POSTS_DIR = path.resolve(process.cwd(), 'src/content/posts');

// Helper: GitHub API 操作
async function commitToGitHub(filePath: string, content: string | null, message: string) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) return false;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  let sha: string | undefined;

  const getRes = await fetch(url + `?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Firefly-Blog-CMS',
    },
  });

  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  }

  // content 为 null 代表删除操作
  if (content === null) {
    if (!sha) return true;
    await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Firefly-Blog-CMS',
      },
      body: JSON.stringify({ message, sha, branch }),
    });
    return true;
  }

  // 新增或更新文件
  const body: any = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Firefly-Blog-CMS',
    },
    body: JSON.stringify(body),
  });

  return putRes.ok;
}

// 1. GET: 获取文章列表或单篇文章详情
export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');

  if (slug) {
    const filePath = path.join(POSTS_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404 });
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);
    return new Response(JSON.stringify({ frontmatter: data, content, slug }), { status: 200 });
  }

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  const posts = files.map((file) => {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data } = matter(content);
    return {
      slug,
      title: data.title || slug,
      published: data.published ? new Date(data.published).toISOString().split('T')[0] : '',
      draft: !!data.draft,
      tags: data.tags || [],
      category: data.category || '未分类',
    };
  });

  // 按日期降序
  posts.sort((a, b) => (a.published < b.published ? 1 : -1));
  return new Response(JSON.stringify(posts), { status: 200 });
};

// 2. POST: 保存 / 新建 / 更新文章
export const POST: APIRoute = async ({ request }) => {
  try {
    const { slug, originalSlug, frontmatter, content } = await request.json();

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug/文件名不能为空' }), { status: 400 });
    }

    const cleanSlug = slug.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-').toLowerCase();
    const markdownData = matter.stringify(content || '', frontmatter);
    const targetFile = path.join(POSTS_DIR, `${cleanSlug}.md`);

    // 如果修改了 Slug，清理旧文件
    if (originalSlug && originalSlug !== cleanSlug) {
      const oldFile = path.join(POSTS_DIR, `${originalSlug}.md`);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      await commitToGitHub(`src/content/posts/${originalSlug}.md`, null, `Delete old: ${originalSlug}`);
    }

    // 写入本地文件系统
    fs.writeFileSync(targetFile, markdownData, 'utf-8');

    // 如果配置了 GitHub Token，提交到远端触发全自动构建发布
    const gitSuccess = await commitToGitHub(
      `src/content/posts/${cleanSlug}.md`,
      markdownData,
      `Publish post: ${frontmatter.title || cleanSlug}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        slug: cleanSlug,
        triggeredDeploy: gitSuccess,
        message: gitSuccess ? '已自动触发构建发布！' : '已保存到本地。',
      }),
      { status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// 3. DELETE: 删除文章
export const DELETE: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: '缺少 slug' }), { status: 400 });
  }

  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const gitSuccess = await commitToGitHub(`src/content/posts/${slug}.md`, null, `Delete post: ${slug}`);

  return new Response(
    JSON.stringify({
      success: true,
      triggeredDeploy: gitSuccess,
    }),
    { status: 200 }
  );
};
