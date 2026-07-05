import { createAuthClient } from "better-auth/client";

// Dynamically determine the base URL to prevent CORS/production URL mismatches during local testing
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return import.meta.env.PUBLIC_SITE_URL || import.meta.env.NEXT_PUBLIC_SITE_URL || "";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});
