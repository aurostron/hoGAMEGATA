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
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  if (isTrending && cloudName) {
    // Uses Cloudinary's fetch feature to optimize and cache trending images
    return `https://res.cloudinary.com/${cloudName}/image/fetch/f_auto,q_auto/${originalUrl}`;
  }
  
  return originalUrl;
}

export function cleanTitle(title: string): string {
  if (!title) return "";
  // Strip bracketed text like [FREE] [VISUAL NOVEL] or parenthesized text like (demo)
  return title
    .replace(/\s*[\[\(][^\]\)]*[\]\)]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
