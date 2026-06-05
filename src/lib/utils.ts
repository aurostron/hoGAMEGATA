import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getHighResCoverUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace("t_cover_big", "t_cover_big_2x");
}

export function getCategoryBadge(category: number | null): string | null {
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
