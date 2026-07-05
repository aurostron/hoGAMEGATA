import { auth } from "./auth";

export async function getServerUser(request: Request, cookies: any) {
  try {
    // 1. Try to fetch the session using Better Auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        avatarUrl: session.user.image || undefined,
      };
    }
  } catch (err) {
    console.error("Better Auth server session retrieval failed:", err instanceof Error ? err.message : "Unknown error");
  }

  // 2. Mock session fallback (development fallback — when Better Auth is bypassed or cookies are set manually)
  const mockSession = cookies.get("gamegata-session");
  if (mockSession?.value) {
    try {
      const decoded = decodeURIComponent(mockSession.value);
      const [id, email] = decoded.split(":");
      if (id && email) {
        return { id, email, avatarUrl: undefined };
      }
    } catch (e) {
      console.error("Error reading server mock session cookie:", e instanceof Error ? e.message : "Unknown error");
    }
  }

  return null;
}
