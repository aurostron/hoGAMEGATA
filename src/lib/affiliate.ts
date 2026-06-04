export function generateAffiliateLink(storeName: string, cleanUrl: string): string {
  if (!cleanUrl) return "";

  // Affiliate redirection is currently on hold/disabled to ensure Vercel Hobby plan compliance.
  // We return the clean URL directly without wrapping or tracking parameters.
  return cleanUrl;
}
