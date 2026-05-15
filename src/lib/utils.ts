import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getHighResCoverUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace("t_cover_big", "t_cover_big_2x");
}
