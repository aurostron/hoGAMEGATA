import { auth, initBetterAuth } from "../../../lib/auth";
import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const env = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : cfEnv;
  if (env) {
    initBetterAuth(env);
  }
  return auth.handler(context.request);
};
