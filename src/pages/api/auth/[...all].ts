import { auth, initBetterAuth } from "../../../lib/auth";
import type { APIRoute } from "astro";

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");
  const env = isDev
    ? (typeof process !== "undefined" && process.env ? process.env : null)
    : (context.locals.runtime?.env || (typeof process !== "undefined" && process.env ? process.env : null));
  if (env) {
    initBetterAuth(env);
  }
  return auth.handler(context.request);
};
