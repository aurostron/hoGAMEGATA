"use client";

import { useEffect } from "react";
import { useVibeTracker } from "../hooks/useVibeTracker";

interface VibeTrackerProps {
  tags: { slug: string }[];
  genres: { slug: string }[];
}

export default function VibeTracker({ tags, genres }: VibeTrackerProps) {
  const { trackVisit } = useVibeTracker();

  useEffect(() => {
    const tagSlugs = tags.map(t => t.slug);
    const genreSlugs = genres.map(g => g.slug);
    trackVisit(tagSlugs, genreSlugs);
    // We only want this to run once when the game page mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
