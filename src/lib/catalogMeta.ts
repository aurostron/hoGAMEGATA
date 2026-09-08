import rawStats from '../data/catalogStats.json';
import rawGenres from '../data/genres.json';
import rawPlatforms from '../data/platforms.json';

export interface CatalogStats {
  totalGames: number;
  totalVisibleGames: number;
  totalDevelopers: number;
  totalPublishers: number;
  totalTags: number;
  totalDeals: number;
  totalScreenshots: number;
  updatedAt: string;
}

export interface CatalogEntityOption {
  name: string;
  slug: string;
}

const stats: CatalogStats = rawStats as CatalogStats;
const genres: CatalogEntityOption[] = rawGenres as CatalogEntityOption[];
const platforms: CatalogEntityOption[] = rawPlatforms as CatalogEntityOption[];

/**
 * Returns precomputed catalog statistics without querying TursoDB.
 * Eliminates full-table COUNT(*) scans on SSR pages.
 */
export function getCatalogStats(): CatalogStats {
  return stats;
}

/**
 * Returns static list of catalog genres.
 */
export function getCatalogGenres(): CatalogEntityOption[] {
  return genres;
}

/**
 * Returns static list of catalog platforms.
 */
export function getCatalogPlatforms(): CatalogEntityOption[] {
  return platforms;
}
