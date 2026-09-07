/// <reference lib="webworker" />
import trendingTop50 from '../data/trendingTop50.json';

const trendingRankMap = new Map<string, { rank: number; reason: string; category: string }>();
if (Array.isArray(trendingTop50)) {
  for (const item of trendingTop50 as any[]) {
    if (item && item.slug) {
      trendingRankMap.set(item.slug, {
        rank: item.rank,
        reason: item.reason,
        category: item.category,
      });
    }
  }
}

interface CatalogRecord {
  i: string;           // id
  t: string;           // title
  s: string;           // slug
  c: string | null;    // coverUrl
  dn: string | null;   // developerNames
  pn: string | null;   // platformNames
  rd: number | string | null;   // releaseDate unix epoch seconds or ISO string
  rt: number | null;   // rating (0-100)
  sr: number | null;   // steamRating
  mc: number | null;   // metacritic
  rr: number | null;   // rawgRating
  cat: number | null;  // category
  pop: number | null;  // popularity
  tr: boolean;         // isTrending
  lk: number;          // likesCount
  gs: string[];        // genre slugs
  ts: string[];        // tag slugs
  dp: number | null;   // cheapest deal price
  st: string | null;   // status
}

interface GameResult {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  developerNames: string | null;
  platformNames: string | null;
  releaseDate: string | null;
  rating: number | null;
  category: number | null;
  status: string | null;
  genreNames: string | null;
  tags: { name: string; slug: string }[];
  displayRating: number | null;
  isAbsoluteCinema: boolean;
  isTrending: boolean;
  trendingRank?: number | null;
  trendingReason?: string | null;
  priceSnapshots: { dealPrice: number }[];
  screenshots: string[];
  summary: string | null;
  esrbRating: string | null;
  pegiRating: string | null;
  trailerUrl: string | null;
  purchaseLinks: { storeName: string; url: string }[];
}

interface QueryParams {
  search?: string;
  sort?: 'trending' | 'latest' | 'upcoming' | 'top-rated' | 'price-asc' | 'price-desc' | 'title';
  genres?: string[];
  systems?: string[];
  decades?: string[];
  features?: string[];
  hideDlcs?: boolean;
  freeOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  offset?: number;
  limit?: number;
}

const ABBREVIATIONS: Record<string, string> = {
  re: 'Resident Evil',
  lou: 'Last of Us',
  tlou: 'The Last of Us',
  sh: 'Silent Hill',
  tew: 'The Evil Within',
  aw: 'Alan Wake',
  dl: 'Dying Light',
  l4d: 'Left 4 Dead',
  fnaf: "Five Nights at Freddy's",
  dbd: 'Dead by Daylight',
};

let allRecords: CatalogRecord[] = [];

self.onmessage = (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  if (type === 'LOAD_CATALOG') {
    allRecords = payload as CatalogRecord[];
    self.postMessage({ id, type: 'LOAD_SUCCESS', count: allRecords.length });
  } else if (type === 'QUERY') {
    const results = processQuery(payload as QueryParams);
    self.postMessage({ id, type: 'QUERY_RESULTS', ...results });
  }
};

function processQuery(params: QueryParams) {
  const {
    search = '',
    sort,
    genres = [],
    systems = [],
    decades = [],
    features = [],
    hideDlcs = false,
    freeOnly = false,
    minPrice,
    maxPrice,
    offset = 0,
    limit = 24,
  } = params;

  let searchTerm = search.trim().toLowerCase();
  if (ABBREVIATIONS[searchTerm]) {
    searchTerm = ABBREVIATIONS[searchTerm].toLowerCase();
  }

  const nowSec = Math.floor(Date.now() / 1000);
  
  let filtered = [];
  
  for (const game of allRecords) {
    const gameStatus = game.st || 'released';
    if (gameStatus === 'hidden') continue;

    if (hideDlcs && game.cat != null && [1, 2, 3, 10, 13].includes(game.cat)) continue;

    const gameGs = game.gs || [];
    if (genres.length > 0 && !genres.some((g) => gameGs.includes(g))) continue;

    const gameTs = game.ts || [];
    if (features.length > 0 && !features.every((f) => gameTs.includes(f))) continue;

    if (systems.length > 0) {
      const pnLower = (game.pn || '').toLowerCase();
      const hasMatch = systems.some((sys) => {
        if (sys === 'win') return pnLower.includes('win') || pnLower.includes('pc') || pnLower.includes('windows');
        if (sys === 'mac') return pnLower.includes('mac') || pnLower.includes('os x') || pnLower.includes('macos');
        if (sys === 'linux') return pnLower.includes('linux');
        return false;
      });
      if (!hasMatch) continue;
    }

    const rdSec = game.rd != null
      ? (typeof game.rd === 'number' ? game.rd : Math.floor(new Date(game.rd).getTime() / 1000))
      : null;

    if (decades.length > 0) {
      const year = rdSec != null ? new Date(rdSec * 1000).getUTCFullYear() : null;
      let matchedDecade = false;
      if (year !== null) {
        if (decades.includes('2020s') && year >= 2020 && year <= 2029) matchedDecade = true;
        else if (decades.includes('2010s') && year >= 2010 && year <= 2019) matchedDecade = true;
        else if (decades.includes('2000s') && year >= 2000 && year <= 2009) matchedDecade = true;
        else if (decades.includes('1990s') && year >= 1990 && year <= 1999) matchedDecade = true;
        else if (decades.includes('older') && year < 1990) matchedDecade = true;
      }
      if (!matchedDecade) continue;
    }

    if (freeOnly) {
      if (!(game.dp === 0 || gameTs.includes('free'))) continue;
    }

    if (minPrice !== undefined && (game.dp == null || game.dp < minPrice)) continue;
    if (maxPrice !== undefined && (game.dp == null || game.dp > maxPrice)) continue;

    if (sort === 'upcoming') {
      if (!(gameStatus === 'upcoming' || (rdSec != null && rdSec > nowSec))) continue;
    } else if (sort === 'latest') {
      if (gameStatus === 'upcoming') continue;
      if (rdSec != null && rdSec > nowSec) continue;
    } else {
      if (gameStatus === 'upcoming') continue;
    }

    let searchRank = -1;
    if (searchTerm) {
      const tLower = game.t.toLowerCase();
      const dnLower = (game.dn || '').toLowerCase();
      const sLower = game.s.toLowerCase();

      if (tLower === searchTerm) {
        searchRank = 0;
      } else if (tLower.startsWith(searchTerm)) {
        searchRank = 1;
      } else if (tLower.includes(searchTerm)) {
        searchRank = 2;
      } else if (dnLower.includes(searchTerm) || sLower.includes(searchTerm)) {
        searchRank = 3;
      } else {
        continue; // Doesn't match search term
      }
    }

    filtered.push({ game, searchRank });
  }

  filtered.sort((a, b) => {
    const ga = a.game;
    const gb = b.game;

    if (searchTerm && !sort) {
      if (a.searchRank !== b.searchRank) return a.searchRank - b.searchRank;
      const trA = ga.tr ? 1 : 0;
      const trB = gb.tr ? 1 : 0;
      if (trA !== trB) return trB - trA;
      const popA = ga.pop != null ? ga.pop : -1;
      const popB = gb.pop != null ? gb.pop : -1;
      if (popA !== popB) return popB - popA;
      return gb.i.localeCompare(ga.i);
    }

    switch (sort) {
      case 'trending': {
        const trendA = trendingRankMap.get(ga.s);
        const trendB = trendingRankMap.get(gb.s);
        if (trendA && trendB) return trendA.rank - trendB.rank;
        if (trendA) return -1;
        if (trendB) return 1;

        const trA = ga.tr ? 1 : 0;
        const trB = gb.tr ? 1 : 0;
        if (trA !== trB) return trB - trA;
        const popA = ga.pop != null ? ga.pop : -1;
        const popB = gb.pop != null ? gb.pop : -1;
        if (popA !== popB) return popB - popA;
        const rtA = ga.rt != null ? ga.rt : -1;
        const rtB = gb.rt != null ? gb.rt : -1;
        if (rtA !== rtB) return rtB - rtA;
        const lkA = ga.lk || 0;
        const lkB = gb.lk || 0;
        if (lkA !== lkB) return lkB - lkA;
        return gb.i.localeCompare(ga.i);
      }
      case 'latest': {
        const rdA = ga.rd != null ? (typeof ga.rd === 'number' ? ga.rd : Math.floor(new Date(ga.rd).getTime() / 1000)) : null;
        const rdB = gb.rd != null ? (typeof gb.rd === 'number' ? gb.rd : Math.floor(new Date(gb.rd).getTime() / 1000)) : null;
        if (rdA != null && rdB == null) return -1;
        if (rdA == null && rdB != null) return 1;
        if (rdA != null && rdB != null && rdA !== rdB) return rdB - rdA;
        return gb.i.localeCompare(ga.i);
      }
      case 'upcoming': {
        const rdA = ga.rd != null ? (typeof ga.rd === 'number' ? ga.rd : Math.floor(new Date(ga.rd).getTime() / 1000)) : Infinity;
        const rdB = gb.rd != null ? (typeof gb.rd === 'number' ? gb.rd : Math.floor(new Date(gb.rd).getTime() / 1000)) : Infinity;
        if (rdA !== rdB) return rdA - rdB;
        return gb.i.localeCompare(ga.i);
      }
      case 'top-rated': {
        const rtA = ga.rt != null ? ga.rt : -1;
        const rtB = gb.rt != null ? gb.rt : -1;
        if (rtA !== rtB) return rtB - rtA;
        return gb.i.localeCompare(ga.i);
      }
      case 'price-asc': {
        const dpA = ga.dp != null ? ga.dp : Infinity;
        const dpB = gb.dp != null ? gb.dp : Infinity;
        if (dpA !== dpB) return dpA - dpB;
        return gb.i.localeCompare(ga.i);
      }
      case 'price-desc': {
        // Outlier detection: demote unverified joke/donation tiers on itch or unrated >$80
        const isOutlierA = (ga.dp || 0) > 70 && (ga.s.startsWith('itch-') || ((ga.dp || 0) > 80 && !ga.sr && !ga.mc));
        const isOutlierB = (gb.dp || 0) > 70 && (gb.s.startsWith('itch-') || ((gb.dp || 0) > 80 && !gb.sr && !gb.mc));
        if (isOutlierA !== isOutlierB) return isOutlierA ? 1 : -1;

        const dpA = ga.dp != null ? ga.dp : -1;
        const dpB = gb.dp != null ? gb.dp : -1;

        // Group into $10 price tiers first (e.g. $70+, $60-$69.99, $50-$59.99)
        const tierA = Math.floor(Math.max(0, dpA) / 10);
        const tierB = Math.floor(Math.max(0, dpB) / 10);
        if (tierA !== tierB) return tierB - tierA;

        // Within the same $10 tier, higher price comes first
        if (dpA !== dpB) return dpB - dpA;

        // If prices are equal, prioritize games with proven reputation & ratings
        const popA = ga.pop != null ? ga.pop : -1;
        const popB = gb.pop != null ? gb.pop : -1;
        if (popA !== popB) return popB - popA;

        const rtA = ga.rt != null ? ga.rt : -1;
        const rtB = gb.rt != null ? gb.rt : -1;
        if (rtA !== rtB) return rtB - rtA;

        const lkA = ga.lk || 0;
        const lkB = gb.lk || 0;
        if (lkA !== lkB) return lkB - lkA;

        return gb.i.localeCompare(ga.i);
      }
      case 'title': {
        const tA = ga.t.toLowerCase();
        const tB = gb.t.toLowerCase();
        if (tA !== tB) return tA.localeCompare(tB);
        return gb.i.localeCompare(ga.i);
      }
      default: {
        return gb.i.localeCompare(ga.i);
      }
    }
  });

  const totalCount = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  const games: GameResult[] = paginated.map(({ game }) => {
    let displayRating: number | null = null;
    let isAbsoluteCinema = false;

    const igdb = (game.rt != null && game.rt <= 100) ? game.rt : null;
    const steam = game.sr != null ? game.sr * 10 : null;
    const meta = game.mc != null ? game.mc : null;
    const rawg = game.rr != null ? game.rr * 20 : null;

    const ratings = [igdb, steam, meta, rawg].filter(r => r !== null) as number[];
    const sourcesCount = ratings.length;

    if (sourcesCount > 0) {
      const avg = ratings.reduce((s, v) => s + v, 0) / sourcesCount;
      if (sourcesCount >= 2) {
        displayRating = Math.round(avg * 10) / 10;
        isAbsoluteCinema = avg >= 90;
      } else {
        displayRating = Math.round(((avg + 70) / 2) * 10) / 10;
        isAbsoluteCinema = false;
      }
    }

    const trendInfo = trendingRankMap.get(game.s);

    return {
      id: game.i,
      title: game.t,
      slug: game.s,
      coverUrl: game.c || null,
      developerNames: game.dn || null,
      platformNames: game.pn || null,
      releaseDate: game.rd != null
        ? (typeof game.rd === 'number' ? new Date(game.rd * 1000).toISOString() : String(game.rd))
        : null,
      rating: game.rt ?? null,
      category: game.cat ?? null,
      status: game.st || 'released',
      genreNames: null,
      tags: (game.ts || []).map(slug => ({ name: slug, slug })),
      displayRating,
      isAbsoluteCinema,
      isTrending: Boolean(game.tr || trendInfo),
      trendingRank: trendInfo?.rank || null,
      trendingReason: trendInfo?.reason || null,
      priceSnapshots: game.dp != null ? [{ dealPrice: game.dp }] : [],
      screenshots: [],
      summary: null,
      esrbRating: null,
      pegiRating: null,
      trailerUrl: null,
      purchaseLinks: [],
    };
  });

  return { games, totalCount };
}
