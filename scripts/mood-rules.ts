export interface GameInput {
  title: string;
  summary?: string | null;
  storyline?: string | null;
  keywords?: Array<{ name: string; slug: string }> | null;
  genres?: Array<{ name: string; slug: string }> | null;
}

export interface MoodTag {
  name: string;
  slug: string;
}

export const MOODS: MoodTag[] = [
  { name: "Dread & Psychological", slug: "dread-psychological" },
  { name: "Survival Horror", slug: "survival-horror" },
  { name: "Cosmic Horror", slug: "cosmic-horror" },
  { name: "Body Horror", slug: "body-horror" },
  { name: "Liminal & Surreal", slug: "liminal-surreal" },
  { name: "Folk Horror", slug: "folk-horror" },
  { name: "Found Footage & Analog", slug: "found-footage-analog" },
  { name: "Retro & PS1 Vibe", slug: "retro-ps1-vibe" },
  { name: "Mascot Horror", slug: "mascot-horror" },
  { name: "Sci-Fi & Cyber", slug: "sci-fi-cyber" },
  { name: "Slasher & Splatter", slug: "slasher-splatter" },
  { name: "Co-Op & Social", slug: "co-op-social" },
  { name: "Combat-Heavy Action", slug: "combat-heavy" },
  { name: "No-Combat & Stealth", slug: "no-combat-stealth" },
  { name: "Walking Sim & Story", slug: "walking-sim-story" },
  { name: "Gothic & Supernatural", slug: "gothic-supernatural" }
];

export function getMoodTagsForGame(game: GameInput): MoodTag[] {
  const matchedSlugs = new Set<string>();

  const title = (game.title || "").toLowerCase();
  const summary = (game.summary || "").toLowerCase();
  const storyline = (game.storyline || "").toLowerCase();
  const text = `${title} ${summary} ${storyline}`;

  const keywords = (game.keywords || []).map(k => k.name.toLowerCase());
  const genreNames = (game.genres || []).map(g => g.name.toLowerCase());

  // Helper check methods
  const hasKeyword = (patterns: string[]) => keywords.some(k => patterns.some(p => k.includes(p)));
  const hasText = (patterns: string[]) => patterns.some(p => text.includes(p));

  // 1. Dread & Psychological
  if (
    hasKeyword(["psychological", "madness", "hallucination", "paranoia", "insanity", "schizophrenia", "fear of the dark", "dread"]) ||
    hasText(["dread", "psychological", "madness", "paranoia", "hallucination", "sanity", "mental illness", "insane", "terror", "loneliness", "oppressive"])
  ) {
    matchedSlugs.add("dread-psychological");
  }

  // 2. Survival Horror
  if (
    hasKeyword(["survival horror", "inventory management", "resource management", "resident evil style", "silent hill style"]) ||
    hasText(["survival horror", "inventory", "resource management", "ammo", "backtracking", "item box", "save room"])
  ) {
    matchedSlugs.add("survival-horror");
  }

  // 3. Cosmic Horror
  if (
    hasKeyword(["lovecraftian", "cosmic horror", "cthulhu mythos", "cthulhu", "alien entities", "ancient gods", "eldritch"]) ||
    hasText(["lovecraftian", "cosmic horror", "cthulhu", "eldritch", "ancient one", "unfathomable", "insignificance", "outer god"])
  ) {
    matchedSlugs.add("cosmic-horror");
  }

  // 4. Body Horror
  if (
    hasKeyword(["body horror", "mutation", "disfigurement", "flesh", "visceral", "gore", "mutilation", "medical horror"]) ||
    hasText(["body horror", "flesh", "mutate", "mutant", "disfigured", "visceral", "mutilated", "decay", "experimentation"])
  ) {
    matchedSlugs.add("body-horror");
  }

  // 5. Liminal & Surreal
  if (
    hasKeyword(["liminal space", "liminal horror", "backrooms", "dream-like", "surrealism", "non-euclidean", "uncanny"]) ||
    hasText(["liminal", "backrooms", "surreal", "dream-like", "uncanny", "non-euclidean", "strange architecture", "hallway", "empty space"])
  ) {
    matchedSlugs.add("liminal-surreal");
  }

  // 6. Folk Horror
  if (
    hasKeyword(["folk horror", "pagan", "ritual", "folklore", "witchcraft", "cult", "rural", "occult"]) ||
    hasText(["folk horror", "pagan", "ritual", "folklore", "witchcraft", "cult", "rural", "village", "forest", "sect", "sacrificial"])
  ) {
    matchedSlugs.add("folk-horror");
  }

  // 7. Found Footage & Analog
  if (
    hasKeyword(["found-footage", "found footage", "analog horror", "vhs", "camcorder", "crt", "cctv", "screamer", "recording"]) ||
    hasText(["found footage", "analog horror", "vhs", "camcorder", "crt", "cctv", "recorder", "video tape", "cassette"])
  ) {
    matchedSlugs.add("found-footage-analog");
  }

  // 8. Retro & PS1 Vibe
  if (
    hasKeyword(["retro", "low-poly", "ps1 style", "psx", "90s", "demake", "fixed camera", "tank controls", "pixel art", "lo-fi"]) ||
    hasText(["retro", "low-poly", "ps1", "psx", "90s", "demake", "fixed camera", "tank controls", "pixel", "lo-fi", "crt filter"])
  ) {
    matchedSlugs.add("retro-ps1-vibe");
  }

  // 9. Mascot Horror
  if (
    hasKeyword(["mascot horror", "animatronics", "toy", "puppet", "playground", "doll", "creepy mascot"]) ||
    hasText(["mascot horror", "animatronic", "toy", "puppet", "playground", "doll", "attraction", "childhood"])
  ) {
    matchedSlugs.add("mascot-horror");
  }

  // 10. Sci-Fi & Cyber
  if (
    hasKeyword(["sci-fi", "space", "cyberpunk", "cybernetics", "alien", "underwater", "deep sea", "machine", "futuristic"]) ||
    hasText(["sci-fi", "space", "spaceship", "alien", "underwater", "submarine", "station", "cyber", "laboratory", "crew"])
  ) {
    matchedSlugs.add("sci-fi-cyber");
  }

  // 11. Slasher & Splatter
  if (
    hasKeyword(["slasher", "serial killer", "murderer", "splatter", "blood", "gore", "pursuit", "escaped killer"]) ||
    hasText(["slasher", "serial killer", "murderer", "splatter", "blood", "gore", "chased", "axe", "cabin in the woods", "stalker"])
  ) {
    matchedSlugs.add("slasher-splatter");
  }

  // 12. Co-Op & Social
  if (
    hasKeyword(["co-op", "multiplayer", "cooperative", "online co-op", "local co-op"]) ||
    genreNames.some(g => g.includes("multiplayer") || g.includes("co-op") || g.includes("cooperative")) ||
    hasText(["co-op", "cooperative", "multiplayer", "play with friends", "online", "team", "survive together"])
  ) {
    matchedSlugs.add("co-op-social");
  }

  // 13. Combat-Heavy Action
  if (
    hasKeyword(["action", "combat", "shooter", "hack and slash", "weapons", "melee", "fighting"]) ||
    genreNames.some(g => g.includes("shooter") || g.includes("action") || g.includes("hack and slash")) ||
    hasText(["weapons", "shoot", "fight", "combat", "melee", "guns", "arsenal", "firepower", "defeat", "kill", "action"])
  ) {
    matchedSlugs.add("combat-heavy");
  }

  // 14. No-Combat & Stealth
  if (
    hasKeyword(["stealth", "no combat", "run and hide", "hiding", "helplessness", "defenseless"]) ||
    hasText(["stealth", "hide", "run", "no combat", "defenseless", "helpless", "weapons are useless", "unable to fight", "closet"])
  ) {
    matchedSlugs.add("no-combat-stealth");
  }

  // 15. Walking Sim & Story
  if (
    hasKeyword(["walking simulator", "story rich", "visual novel", "narrative", "interactive fiction", "exploration"]) ||
    genreNames.some(g => g.includes("visual novel") || g.includes("narrative") || g.includes("interactive fiction")) ||
    hasText(["walking simulator", "narrative", "story-heavy", "story rich", "visual novel", "read", "diaries", "explore", "notes", "investigate"])
  ) {
    matchedSlugs.add("walking-sim-story");
  }

  // 16. Gothic & Supernatural
  if (
    hasKeyword(["gothic", "vampire", "ghost", "haunted", "haunting", "demonic", "demon", "exorcism", "paranormal", "spirit", "supernatural"]) ||
    hasText(["gothic", "vampire", "ghost", "haunted house", "haunting", "demonic", "demon", "exorcism", "paranormal", "spirit", "specter", "mansion", "castle", "creepy doll"])
  ) {
    matchedSlugs.add("gothic-supernatural");
  }

  // Default Fallback
  if (matchedSlugs.size === 0) {
    matchedSlugs.add("dread-psychological");
  }

  return MOODS.filter(m => matchedSlugs.has(m.slug));
}
