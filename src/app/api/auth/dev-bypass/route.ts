import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Secret code for developer bypass - only works on localhost
const DEV_BYPASS_CODE = "gamegata-dev-2026";

export async function POST(request: Request) {
  try {
    // Safety check: only allow this on localhost
    const host = request.headers.get("host") || "";
    const isLocalhost =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("::1");

    if (!isLocalhost) {
      return NextResponse.json(
        { error: "Dev bypass is only available on localhost." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (code !== DEV_BYPASS_CODE) {
      return NextResponse.json(
        { error: "Invalid bypass code." },
        { status: 401 }
      );
    }

    // Create a developer session cookie
    const devId = "dev-local-preview";
    const devEmail = "dev@localhost";
    const cookieVal = encodeURIComponent(`${devId}:${devEmail}`);

    const cookieStore = await cookies();
    cookieStore.set("gamegata-session", cookieVal, {
      path: "/",
      maxAge: 31536000, // 1 year
      sameSite: "lax",
      secure: false, // HTTP on localhost is fine
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dev bypass error:", error);
    return NextResponse.json(
      { error: "Server error during bypass." },
      { status: 500 }
    );
  }
}
