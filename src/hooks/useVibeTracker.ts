"use client";

const VIBE_KEY = "hogamegata_affinities";

export function useVibeTracker() {
  const trackVisit = (tags: string[], genres: string[]) => {
    try {
      const stored = localStorage.getItem(VIBE_KEY);
      const affinities: Record<string, number> = stored ? JSON.parse(stored) : {};

      const slugs = [...tags, ...genres];
      if (slugs.length === 0) return;

      slugs.forEach(slug => {
        if (!affinities[slug]) affinities[slug] = 0;
        affinities[slug] += 2; // +2 weight for page visit
      });

      localStorage.setItem(VIBE_KEY, JSON.stringify(affinities));
    } catch (err) {
      console.error("Failed to track vibe affinities:", err);
    }
  };

  const getTopAffinities = (limit = 3): string[] => {
    try {
      const stored = localStorage.getItem(VIBE_KEY);
      if (!stored) return [];
      
      const affinities: Record<string, number> = JSON.parse(stored);
      return Object.entries(affinities)
        .sort((a, b) => b[1] - a[1]) // Sort by score descending
        .slice(0, limit)
        .map(entry => entry[0]);
    } catch (err) {
      console.error("Failed to read vibe affinities:", err);
      return [];
    }
  };

  return { trackVisit, getTopAffinities };
}
