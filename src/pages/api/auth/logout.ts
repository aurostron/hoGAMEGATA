import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Clear all session-related cookies
  cookies.delete("better-auth.session_token", { path: "/" });
  cookies.delete("gamegata-session", { path: "/" });
  cookies.delete("admin_2fa_session", { path: "/" });

  // Redirect to login page
  return redirect("/login");
};
