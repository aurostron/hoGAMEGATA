import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getHighResCoverUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace("t_cover_big", "t_cover_big_2x");
}

export function getCategoryBadge(category: number | null, title?: string): string | null {
  if (title) {
    const lower = title.toLowerCase();
    
    // Check for Visual Novel markers first so a Visual Novel DLC gets categorized correctly or VNs stand out
    if (
      lower.includes("[visual novel]") ||
      lower.includes("(visual novel)") ||
      lower.includes("[vn]") ||
      lower.includes("(vn)") ||
      lower.includes("visual novel") ||
      lower.includes("interactive novel")
    ) {
      return "Visual Novel";
    }

    if (
      lower.includes("banned footage") ||
      lower.includes("end of zoe") ||
      lower.includes("not a hero") ||
      lower.includes("shadows of rose") ||
      lower.includes("separate ways") ||
      lower.includes("lost in nightmares") ||
      lower.includes("desperate escape") ||
      lower.includes("ghost survivors") ||
      lower.includes("whistleblower") ||
      lower.includes("left behind") ||
      lower.includes("season pass") ||
      lower.includes("extra episode") ||
      lower.includes("dlc")
    ) {
      return "DLC";
    }
    if (lower.includes("expansion")) {
      return "Expansion";
    }
  }

  if (category === 1) return "DLC";
  if (category === 2) return "Expansion";
  if (category === 4) return "Standalone";
  if (category === 8) return "Remake";
  if (category === 9) return "Remaster";
  
  return null;
}

export function getCloudinaryFetchUrl(originalUrl: string | null, isTrending?: boolean): string | null {
  if (!originalUrl) return null;

  // If it's already a local path, return it directly
  if (originalUrl.startsWith("/") && !originalUrl.startsWith("//")) {
    return originalUrl;
  }
  
  let formattedUrl = originalUrl;
  if (formattedUrl.startsWith("//")) {
    formattedUrl = "https:" + formattedUrl;
  }
  
  // Safe read of env variables for both client-side (Astro/Vite) and server-side (Node/Cloudflare)
  const cloudName = import.meta.env?.PUBLIC_CLOUDINARY_CLOUD_NAME || 
    import.meta.env?.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 
    (typeof process !== "undefined" && process?.env ? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME : undefined);
  
  if (isTrending && cloudName) {
    // Uses Cloudinary's fetch feature to optimize and cache trending images
    return `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto/${formattedUrl}`;
  }
  
  // Route all other remote images through our Cloudflare Edge-cached image proxy
  // v=2 cache-buster: purges stale browser/CDN caches from the old stripped-query-key bug
  return `/api/image-proxy?v=2&url=${encodeURIComponent(formattedUrl)}`;
}

export function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(visual novel\)/gi, '')
    .replace(/\s*\[visual novel\]/gi, '')
    .replace(/\s*\(vn\)/gi, '')
    .replace(/\s*\[vn\]/gi, '')
    .trim();
}

export function formatPrice(amount: number, currencyCode = "USD"): string {
  if (typeof amount !== "number" || isNaN(amount)) return "";
  try {
    const code = (currencyCode || "USD").toUpperCase();
    const locale = code === "INR" ? "en-IN" : code === "EUR" ? "de-DE" : code === "GBP" ? "en-GB" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    return `$${amount.toFixed(2)}`;
  }
}

export function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/&nbsp;/g, " ") // decode basic entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

export function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function formatEmbedVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const ytId = getYoutubeId(url);
  if (ytId) {
    return `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
  }
  if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
    return url;
  }
  return url;
}
