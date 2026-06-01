export interface RetroGameEntry {
  title: string;
  slug: string;
  summary: string | null;
  releaseYear: number | null;
  source: string;
  externalId: string;
  coverUrl: string | null;
  platform: string | null;
  genreTags: string[];
}

const RETRO_PLATFORM_MAP: Record<string, string> = {
  dos: "DOS",
  "ms-dos": "DOS",
  windows: "Windows",
  mac: "Mac",
  "macintosh": "Mac",
  amiga: "Amiga",
  "commodore-amiga": "Amiga",
  "commodore-64": "Commodore 64",
  "commodore": "Commodore 64",
  "c64": "Commodore 64",
  "nes": "NES",
  snes: "SNES",
  "super-nintendo": "SNES",
  "sega-genesis": "Sega Genesis",
  genesis: "Sega Genesis",
  "sega-mega-drive": "Sega Mega Drive",
  "sega-cd": "Sega CD",
  "sega-32x": "Sega 32X",
  "sega-saturn": "Sega Saturn",
  "sega-dreamcast": "Sega Dreamcast",
  dreamcast: "Sega Dreamcast",
  "playstation": "PlayStation",
  "ps1": "PlayStation",
  "playstation-2": "PlayStation 2",
  "ps2": "PlayStation 2",
  "atari": "Atari",
  "atari-st": "Atari ST",
  "atari-2600": "Atari 2600",
  "3do": "3DO",
  "pc-98": "PC-98",
  "sharp-x68000": "Sharp X68000",
  "msx": "MSX",
  "zx-spectrum": "ZX Spectrum",
};

function normalizePlatform(tags: string[], description: string): string | null {
  const combined = [...tags, description].join(" ").toLowerCase();
  for (const [key, name] of Object.entries(RETRO_PLATFORM_MAP)) {
    if (combined.includes(key)) return name;
  }
  return null;
}

export function normalizeRetroEntry(raw: {
  identifier: string;
  title: string;
  description?: string;
  year?: string;
  source: string;
  tags?: string[];
}): RetroGameEntry {
  const { identifier, title, description, year, source, tags } = raw;
  const slug = identifier.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const releaseYear = year ? parseInt(year, 10) : null;
  const platform = normalizePlatform(tags || [], description || "");
  return {
    title,
    slug,
    summary: description?.substring(0, 2000) || null,
    releaseYear,
    source,
    externalId: identifier,
    coverUrl: null,
    platform,
    genreTags: ["horror"],
  };
}

export function buildRetroSlug(title: string, year?: number | null): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return year ? `${base}-${year}` : base;
}
