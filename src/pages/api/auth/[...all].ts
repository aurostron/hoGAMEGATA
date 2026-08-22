import { auth, initBetterAuth } from "../../../lib/auth";
import { initTursoAuthForRequest } from "../../../lib/tursoAuth";
import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const env = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : cfEnv)
    : (cfEnv || (context.locals as any)?.runtime?.env || (typeof process !== "undefined" ? process.env : {}));
  
  if (env) {
    initTursoAuthForRequest(env);
    initBetterAuth(env);
  }
  return auth.handler(context.request);
};
