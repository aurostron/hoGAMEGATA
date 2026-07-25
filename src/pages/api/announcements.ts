import type { APIRoute } from 'astro';
import { turso } from '../../lib/turso';
import { announcements } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10), 1), 50);

    const rows = await turso
      .select()
      .from(announcements)
      .where(eq(announcements.isPublished, true))
      .orderBy(desc(announcements.date))
      .limit(limit);

    return new Response(JSON.stringify({ success: true, announcements: rows }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch announcements' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
