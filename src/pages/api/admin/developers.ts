import type { APIRoute } from 'astro';
import { getServerUser, isAdminUser } from '../../../lib/serverAuth';
import { turso } from '../../../lib/turso';
import { developers } from '../../../db/schema';
import { eq, like, desc } from 'drizzle-orm';

let cfEnv: any = null;
try {
  const { env } = await import("cloudflare:workers");
  cfEnv = env;
} catch (e) {}

export const prerender = false;

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');         // Replace multiple - with single -
}

const checkAdmin = async (request: Request, cookies: any) => {
  const user = await getServerUser(request, cookies);
  return user ? isAdminUser(user.email, cfEnv) : false;
};

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    if (!await checkAdmin(request, cookies)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    const results = await turso
      .select()
      .from(developers)
      .where(like(developers.name, `%${search}%`))
      .limit(20);

    return new Response(JSON.stringify({ developers: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to query developers:", error);
    return new Response(JSON.stringify({ error: "Query failed" }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    if (!await checkAdmin(request, cookies)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });
    }

    const devSlug = slugify(name);
    
    // Check if developer already exists by name or slug
    const [existing] = await turso
      .select()
      .from(developers)
      .where(eq(developers.slug, devSlug))
      .limit(1);

    if (existing) {
      return new Response(JSON.stringify({ success: true, developer: existing }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const newId = crypto.randomUUID();
    await turso.insert(developers).values({
      id: newId,
      name: name.trim(),
      slug: devSlug
    });

    const [newDev] = await turso
      .select()
      .from(developers)
      .where(eq(developers.id, newId))
      .limit(1);

    return new Response(JSON.stringify({ success: true, developer: newDev }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Failed to create developer:", error);
    return new Response(JSON.stringify({ error: "Creation failed" }), { status: 500 });
  }
};
