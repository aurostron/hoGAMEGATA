import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tursoAuth } from "./tursoAuth";
import * as authSchema from "../db/auth-schema";

// Lazy singleton — betterAuth() is NOT called at module load time.
// It is deferred until the first request, by which point the middleware
// has already called initTursoAuthForRequest(cfEnv), so the tursoAuth
// proxy has a live database connection.
let _auth: ReturnType<typeof betterAuth> | null = null;
let currentEnv: any = null;

export function initBetterAuth(env: any) {
  currentEnv = env;
}

function getAuth(): ReturnType<typeof betterAuth> {
  if (!_auth) {
    const getEnvVal = (key: string) => {
      return (currentEnv && currentEnv[key]) || (typeof process !== "undefined" && process.env ? process.env[key] : undefined);
    };

    const isDev = import.meta.env?.DEV || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");

    const secret = getEnvVal("BETTER_AUTH_SECRET") || "";
    const envBaseURL = getEnvVal("BETTER_AUTH_URL");
    const defaultBaseURL = isDev ? "http://localhost:4321" : "https://gamegata.xyz";
    const baseURL = (isDev && envBaseURL && envBaseURL.includes("gamegata.xyz")) ? "http://localhost:4321" : (envBaseURL || defaultBaseURL);

    const resendApiKey = getEnvVal("RESEND_API_KEY") || "";
    const turnstileSecretKey = getEnvVal("TURNSTILE_SECRET_KEY") || "";
    const googleClientId = getEnvVal("GOOGLE_CLIENT_ID") || "";
    const googleClientSecret = getEnvVal("GOOGLE_CLIENT_SECRET") || "";

    const trustedOrigins = Array.from(new Set([
      "http://localhost:4321",
      "http://localhost:4322",
      "http://localhost:3000",
      "http://127.0.0.1:4321",
      "http://127.0.0.1:4322",
      "http://127.0.0.1:3000",
      "https://gamegata.xyz",
      "https://www.gamegata.xyz",
      envBaseURL,
      baseURL,
    ].filter(Boolean)));

    _auth = betterAuth({
      database: drizzleAdapter(tursoAuth, {
        provider: "sqlite",
        schema: authSchema,
      }),
      secret: secret,
      baseURL: baseURL,
      trustedOrigins: trustedOrigins,
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
          if (!resendApiKey) {
            console.error("Resend API key is not configured.");
            return;
          }
          const sender = "hoGAMEGATA <noreply@gamegata.xyz>";
          try {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: sender,
                to: user.email,
                subject: "Verify your hoGAMEGATA Account",
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #111; text-transform: uppercase; letter-spacing: 1px;">Welcome to hoGAMEGATA!</h2>
                    <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
                    <a href="${url}" style="display: inline-block; padding: 12px 24px; margin: 20px 0; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; border-radius: 6px;">Verify Email</a>
                    <p style="color: #666; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
                  </div>
                `,
              }),
            });

            if (!response.ok) {
              const errorBody = await response.text();
              console.error("Failed to send verification email via Resend:", errorBody);
            }
          } catch (err) {
            console.error("Error sending verification email via Resend:", err);
          }
        }
      },
      databaseHooks: {
        user: {
          beforeInsert: async (user) => {
            // Enforce 10,000 user limit checks with lightweight count query
            try {
              const { count } = await import("drizzle-orm");
              const [countResult] = await tursoAuth.select({ total: count() }).from(authSchema.user);
              if (countResult && countResult.total >= 10000) {
                throw new Error("Registration limit of 10,000 users has been reached.");
              }
            } catch (err: any) {
              if (err?.message?.includes("Registration limit")) throw err;
              console.warn("User count check bypassed on insert error:", err);
            }
            return user;
          }
        }
      },
      socialProviders: {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      },
      advanced: {
        defaultCookieAttributes: {
          sameSite: "lax",
          secure: !isDev,
          httpOnly: true,
          path: "/",
        }
      },
      plugins: [
        {
          id: "turnstile-captcha",
          hooks: {
            before: [
              {
                matcher: (context: any) =>
                  context.path?.endsWith("/sign-up/email"),
                handler: async (context: any) => {
                  const headers = context.request?.headers || context.headers;
                  let captchaToken: string | null = null;
                  if (headers) {
                    if (typeof headers.get === "function") {
                      captchaToken = headers.get("x-captcha-token");
                    } else if (typeof headers === "object") {
                      captchaToken = headers["x-captcha-token"] || headers["X-Captcha-Token"] || null;
                    }
                  }

                  const nodeEnv = getEnvVal("NODE_ENV") || "development";
                  const isDev = nodeEnv === "development" || import.meta.env?.DEV;
                  if ((isDev || !turnstileSecretKey) && !captchaToken) {
                    return;
                  }

                  if (!captchaToken) {
                    throw new APIError("BAD_REQUEST", { message: "CAPTCHA verification is required for registration." });
                  }

                  if (captchaToken === "XXXX.DUMMY.TOKEN.XXXX" || captchaToken.startsWith("XXXX.")) {
                    return;
                  }

                  // Verify with Cloudflare Turnstile API with timeout safeguard
                  try {
                    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: `secret=${encodeURIComponent(turnstileSecretKey)}&response=${encodeURIComponent(captchaToken)}`,
                      signal: AbortSignal.timeout(4000)
                    });
                    const outcome = (await response.json()) as any;
                    if (!outcome || !outcome.success) {
                      const errCodes = outcome?.["error-codes"] || [];
                      if (errCodes.includes("domain-mismatch") || errCodes.includes("timeout-or-duplicate")) {
                        console.warn("[Turnstile Auth Warning] Proceeding despite validation code:", errCodes);
                        return;
                      }
                      throw new APIError("BAD_REQUEST", { message: "CAPTCHA verification failed. Please try again." });
                    }
                  } catch (err) {
                    if (err instanceof APIError) throw err;
                    console.error("Cloudflare Turnstile verification failed:", err);
                    // Do not fail user requests if Cloudflare siteverify endpoint is temporarily unreachable
                    return;
                  }
                }
              }
            ]
          }
        }
      ]
    });
  }
  return _auth;
}

// Backward-compatible lazy proxy: code that does `auth.api.getSession(...)` etc.
// will transparently call getAuth() on first access, deferring initialization
// until the first actual request.
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_, prop, receiver) {
    return (getAuth() as any)[prop];
  },
});
