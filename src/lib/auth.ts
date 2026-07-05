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

    const secret = getEnvVal("BETTER_AUTH_SECRET") || "";
    const baseURL = getEnvVal("BETTER_AUTH_URL") || "http://localhost:4321";
    const resendApiKey = getEnvVal("RESEND_API_KEY");
    const turnstileSecretKey = getEnvVal("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000UNTRUSTED";
    const googleClientId = getEnvVal("GOOGLE_CLIENT_ID") || "placeholder";
    const googleClientSecret = getEnvVal("GOOGLE_CLIENT_SECRET") || "placeholder";

    _auth = betterAuth({
      database: drizzleAdapter(tursoAuth, {
        provider: "sqlite",
        schema: authSchema,
      }),
      secret: secret,
      baseURL: baseURL,
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      emailVerification: {
        sendOnSignUp: true,
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
            // Enforce 10,000 user limit checks at the database level before user is created
            const result = await tursoAuth.select().from(authSchema.user);
            if (result.length >= 10000) {
              throw new Error("Registration limit of 10,000 users has been reached.");
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
      plugins: [
        {
          id: "turnstile-captcha",
          hooks: {
            before: [
              {
                matcher: (context: any) =>
                  context.path.endsWith("/sign-up/email") || context.path.endsWith("/sign-in/email"),
                handler: async (context: any) => {
                  const request = context.request;
                  const captchaToken = request.headers.get("x-captcha-token");

                  // Skip Turnstile check in local development if no token is passed
                  const nodeEnv = getEnvVal("NODE_ENV") || "development";
                  if (nodeEnv === "development" && !captchaToken) {
                    return;
                  }

                  if (!captchaToken) {
                    throw new APIError("BAD_REQUEST", { message: "CAPTCHA verification is required." });
                  }

                  // Verify with Cloudflare Turnstile API
                  try {
                    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                      method: "POST",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: `secret=${encodeURIComponent(turnstileSecretKey)}&response=${encodeURIComponent(captchaToken)}`,
                    });
                    const outcome = (await response.json()) as any;
                    if (!outcome.success) {
                      throw new APIError("BAD_REQUEST", { message: "CAPTCHA verification failed. Please try again." });
                    }
                  } catch (err) {
                    console.error("Cloudflare Turnstile verification failed:", err);
                    throw new APIError("INTERNAL_SERVER_ERROR", { message: "Failed to verify CAPTCHA." });
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
