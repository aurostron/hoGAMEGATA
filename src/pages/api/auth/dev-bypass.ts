import type { APIRoute } from 'astro';

export const prerender = false;

const DEV_BYPASS_CODE = "gamegata-dev-2026";

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!import.meta.env.DEV) {
    return new Response(JSON.stringify({ error: "Not available" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  try {
    // Safety check: only allow this on localhost
    const host = request.headers.get("host") || "";
    const isLocalhost =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("::1");

    if (!isLocalhost) {
      return new Response(
        JSON.stringify({ error: "Dev bypass is only available on localhost." }),
        { status: 403 }
      );
    }

    const { code } = await request.json();

    if (code !== DEV_BYPASS_CODE) {
      return new Response(
        JSON.stringify({ error: "Invalid bypass code." }),
        { status: 401 }
      );
    }

    // Create a developer session cookie
    const devId = "dev-local-preview";
    const devEmail = "dev@localhost";
    const cookieVal = encodeURIComponent(`${devId}:${devEmail}`);

    cookies.set("gamegata-session", cookieVal, {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
      secure: false, // HTTP on localhost is fine
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Dev bypass error:", error);
    return new Response(
      JSON.stringify({ error: "Server error during bypass." }),
      { status: 500 }
    );
  }
};
