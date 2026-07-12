export interface GameInput {
  title: string;
  summary?: string | null;
  storyline?: string | null;
  keywords?: Array<{ name: string; slug: string }> | null;
  genres?: Array<{ name: string; slug: string }> | null;
}

export interface TaxonomyTag {
  name: string;
  slug: string;
  category: "theme" | "setting" | "gameplay" | "visual" | "experience" | "perspective";
  keywords: string[];
}

export const HORROR_TAXONOMY: TaxonomyTag[] = [
  // 1. Themes & Subgenres (theme)
  {
    name: "Psychological Horror",
    slug: "psychological",
    category: "theme",
    keywords: ["psychological", "madness", "hallucination", "paranoia", "insanity", "schizophrenia", "mental illness", "trauma", "grief", "guilt", "memory loss", "amnesia", "delusion", "dread", "terror", "sanity", "loneliness", "oppressive", "mental health", "illusion", "identity"]
  },
  {
    name: "Cosmic & Eldritch",
    slug: "cosmic-horror",
    category: "theme",
    keywords: ["lovecraftian", "cosmic horror", "cthulhu", "eldritch", "ancient god", "unfathomable", "insignificance", "outer god", "aberration", "void", "alien entities", "ancient ones", "stars", "yogg", "depths of space"]
  },
  {
    name: "Body Horror",
    slug: "body-horror",
    category: "theme",
    keywords: ["body horror", "mutation", "disfigurement", "flesh", "visceral", "gore", "mutilation", "medical horror", "anatomy", "experimentation", "grotesque", "mutate", "mutant", "decay", "blood", "flesh", "growth"]
  },
  {
    name: "Liminal & Surreal",
    slug: "liminal-surreal",
    category: "theme",
    keywords: ["liminal", "backrooms", "surreal", "dream-like", "dreamlike", "uncanny", "non-euclidean", "strange architecture", "distorted reality", "dream", "hallway", "empty space", "maze", "illogical", "surrealism"]
  },
  {
    name: "Folk Horror",
    slug: "folk-horror",
    category: "theme",
    keywords: ["folk horror", "pagan", "ritual", "folklore", "witchcraft", "cult", "rural", "village", "forest", "sect", "sacrificial", "occult", "tradition", "ancient belief", "witch", "coven"]
  },
  {
    name: "Slasher Horror",
    slug: "slasher",
    category: "theme",
    keywords: ["slasher", "serial killer", "murderer", "splatter", "pursuit", "escaped killer", "masked killer", "chase", "axe", "butcher", "knife", "stalker", "camp", "teenager", "hunting humans"]
  },
  {
    name: "Mascot Horror",
    slug: "mascot-horror",
    category: "theme",
    keywords: ["mascot horror", "animatronic", "toy", "puppet", "playground", "doll", "attraction", "childhood", "creepy mascot", "freddy", "huggy", "factory", "playtime"]
  },
  {
    name: "Supernatural Horror",
    slug: "supernatural",
    category: "theme",
    keywords: ["gothic", "vampire", "ghost", "haunted", "haunting", "demonic", "demon", "exorcism", "paranormal", "spirit", "specter", "phantom", "poltergeist", "creepy doll", "mansion", "castle", "curse", "cursed", "devil"]
  },
  {
    name: "Zombie & Apocalypse",
    slug: "zombie-apocalypse",
    category: "theme",
    keywords: ["zombie", "undead", "outbreak", "infection", "virus", "apocalypse", "apocalyptic", "horde", "quarantine", "infected", "plague", "living dead", "survival apocalypse", "collapse"]
  },
  {
    name: "Creature Horror",
    slug: "creature-horror",
    category: "theme",
    keywords: ["monster", "cryptid", "beast", "creature", "alien entity", "predator", "predatory", "abomination", "werewolf", "wendigo", "abominable", "wolfman", "chupacabra", "spider", "insect", "giant creature"]
  },
  {
    name: "Comedy & Parody",
    slug: "comedy-horror",
    category: "theme",
    keywords: ["comedy", "humor", "funny", "parody", "satire", "silly", "spoof", "quirky", "meme", "laugh", "slapstick", "weird comedy", "joke", "hilarious", "lighthearted"]
  },

  // 2. Setting & Flavor (setting)
  {
    name: "Sci-Fi Horror",
    slug: "setting-sci-fi",
    category: "setting",
    keywords: ["sci-fi", "science fiction", "futuristic", "laser", "cyber", "nanotech", "hologram", "space", "station", "laboratory", "future", "high-tech"]
  },
  {
    name: "Cyberpunk Horror",
    slug: "setting-cyberpunk",
    category: "setting",
    keywords: ["cyberpunk", "neon", "megacorporation", "augmented", "hacker", "cyberspace", "cybernetic", "dystopian", "implants", "syndicate"]
  },
  {
    name: "Medical Horror",
    slug: "setting-medical",
    category: "setting",
    keywords: ["medical", "hospital", "asylum", "clinic", "sanatorium", "doctor", "surgery", "nurse", "patient", "experimentation", "ward", "psychiatric", "operation"]
  },
  {
    name: "Space Horror",
    slug: "setting-space",
    category: "setting",
    keywords: ["space", "spaceship", "orbit", "planetary", "asteroid", "galaxy", "cosmic station", "starship", "astronaut", "dead space"]
  },
  {
    name: "Deep Sea Horror",
    slug: "setting-deep-sea",
    category: "setting",
    keywords: ["underwater", "submarine", "abyss", "oceanic", "sea monster", "sonar", "deep sea", "submersible", "trench", "drowning", "aquatic"]
  },
  {
    name: "Rural Isolation",
    slug: "setting-rural",
    category: "setting",
    keywords: ["rural", "village", "farm", "cabin", "woods", "forest", "remote", "isolated town", "countryside", "cornfield", "swamp", "mountains", "wilderness"]
  },
  {
    name: "Urban Decay",
    slug: "setting-urban",
    category: "setting",
    keywords: ["urban", "city", "sewer", "subway", "abandoned building", "alleyway", "metropolis", "apartment complex", "slum", "metro", "streets"]
  },
  {
    name: "Industrial Horror",
    slug: "setting-industrial",
    category: "setting",
    keywords: ["industrial", "factory", "facility", "refinery", "generator", "pipes", "machinery", "boiler room", "foundry", "warehouse", "power plant"]
  },
  {
    name: "School Horror",
    slug: "setting-school",
    category: "setting",
    keywords: ["school", "classroom", "academy", "high school", "university", "hallway", "locker", "student", "teacher", "dormitory", "education", "detention"]
  },
  {
    name: "Analog & Broadcast",
    slug: "setting-analog",
    category: "setting",
    keywords: ["analog horror", "broadcast", "vhs", "tape", "television", "crt", "signal", "feed", "recording", "cassette", "transmission"]
  },
  {
    name: "Found Footage",
    slug: "setting-found-footage",
    category: "setting",
    keywords: ["found footage", "camcorder", "camera feed", "cctv", "bodycam", "handheld camera", "footage", "recorded", "security camera", "gopro"]
  },

  // 3. Gameplay & Mechanics (gameplay)
  {
    name: "Survival Horror",
    slug: "survival-horror",
    category: "gameplay",
    keywords: ["survival horror", "inventory", "resource management", "ammo", "backtracking", "item box", "save room", "ink ribbon", "limited ammunition", "resident evil style", "silent hill style"]
  },
  {
    name: "Stealth & Hide",
    slug: "stealth-no-combat",
    category: "gameplay",
    keywords: ["stealth", "hide", "run", "no combat", "defenseless", "helpless", "weapons are useless", "unable to fight", "closet", "crouch", "run and hide", "hiding in the dark"]
  },
  {
    name: "Action Horror",
    slug: "action-horror",
    category: "gameplay",
    keywords: ["action", "combat", "shooter", "gun", "weapon", "ammo", "melee", "fight", "arsenal", "firepower", "kill", "blast", "hack", "slay", "combat-heavy", "hack and slash"]
  },
  {
    name: "Narrative Horror",
    slug: "narrative-horror",
    category: "gameplay",
    keywords: ["story rich", "narrative", "dialogue choices", "interactive fiction", "story-heavy", "lore", "diaries", "notes", "reading", "document", "plot", "mystery"]
  },
  {
    name: "Walking Simulator",
    slug: "walking-sim",
    category: "gameplay",
    keywords: ["walking simulator", "exploration", "explore", "walk", "investigate", "atmosphere", "first-person walk", "slow pace"]
  },
  {
    name: "Immersive Sim",
    slug: "immersive-sim",
    category: "gameplay",
    keywords: ["immersive sim", "emergent", "systemic", "player choices", "choices and consequences", "sandbox", "multiple solutions", "looking glass style", "physics-based interactions"]
  },
  {
    name: "Puzzle Horror",
    slug: "puzzle-horror",
    category: "gameplay",
    keywords: ["puzzle", "riddle", "code", "lock", "key", "escape room", "escape the room", "solve puzzles", "cipher", "mechanism"]
  },
  {
    name: "Point & Click",
    slug: "point-click",
    category: "gameplay",
    keywords: ["point and click", "point & click", "pixel hunt", "adventure game", "interactable object", "click to walk"]
  },
  {
    name: "Visual Novel",
    slug: "visual-novel",
    category: "gameplay",
    keywords: ["visual novel", "novel", "dialogue tree", "illustrated story", "dating sim", "text choices"]
  },
  {
    name: "Text-Based",
    slug: "text-based",
    category: "gameplay",
    keywords: ["text-based", "interactive fiction", "text adventure", "reading text", "terminal interface", "command prompt", "type commands"]
  },
  {
    name: "RPG Maker",
    slug: "rpg-maker",
    category: "gameplay",
    keywords: ["rpg maker", "rpgmaker", "2d top-down", "top-down adventure", "rpg maker style", "wolf rpg editor"]
  },
  {
    name: "Co-op",
    slug: "co-op",
    category: "gameplay",
    keywords: ["co-op", "cooperative", "online co-op", "local co-op", "play together", "friends", "teamwork"]
  },
  {
    name: "Multiplayer",
    slug: "multiplayer",
    category: "gameplay",
    keywords: ["multiplayer", "online multiplayer", "pvp", "asymmetrical", "versus", "lobby", "server", "matchmaking"]
  },

  // 4. Visual Identity (visual)
  {
    name: "PS1 / Low Poly",
    slug: "retro-ps1",
    category: "visual",
    keywords: ["low-poly", "ps1 style", "psx", "demake", "fixed camera", "tank controls", "lo-fi", "retro 3d", "90s graphics", "pixelated textures"]
  },
  {
    name: "Pixel Art",
    slug: "pixel-art",
    category: "visual",
    keywords: ["pixel art", "pixelated", "16-bit", "8-bit", "retro 2d", "sidescroller", "side-scrolling", "sprite art", "hand-drawn pixels"]
  },
  {
    name: "VHS / Analog",
    slug: "vhs-analog",
    category: "visual",
    keywords: ["vhs", "analog", "tape", "static", "crt filter", "recording", "glitch", "tracking errors", "flicker", "distorted video"]
  },
  {
    name: "Hand Drawn",
    slug: "hand-drawn",
    category: "visual",
    keywords: ["hand drawn", "hand-drawn", "sketch", "drawn by hand", "illustrated", "charcoal", "pencil style", "watercolor"]
  },
  {
    name: "Anime Horror",
    slug: "anime-style",
    category: "visual",
    keywords: ["anime", "manga", "japanese style", "cel-shaded", "visual novel style", "otaku"]
  },
  {
    name: "Photorealistic",
    slug: "photorealistic",
    category: "visual",
    keywords: ["photorealistic", "unreal engine 5", "ue5", "motion capture", "mocap", "live action", "ultra realistic", "unrecord style", "bodycam view"]
  },
  {
    name: "FMV / Live Action",
    slug: "fmv",
    category: "visual",
    keywords: ["fmv", "full motion video", "interactive movie", "live-action", "recorded actors"]
  },
  {
    name: "Stylized Horror",
    slug: "stylized",
    category: "visual",
    keywords: ["stylized", "cartoon", "low poly", "comic book", "unique art style", "cel shaded", "claymation"]
  },
  {
    name: "Black & White",
    slug: "black-white",
    category: "visual",
    keywords: ["black and white", "black & white", "monochrome", "grayscale", "noir"]
  },
  {
    name: "CRT / Retro Filter",
    slug: "crt-retro",
    category: "visual",
    keywords: ["crt filter", "retro filter", "retro scanlines", "phosphor glow", "scanline"]
  },

  // 5. Emotional Experience (experience)
  {
    name: "Oppressive",
    slug: "oppressive",
    category: "experience",
    keywords: ["oppressive", "suffocating", "claustrophobic", "relentless", "crushing", "darkness", "dreadful", "hopelessness", "helplessness"]
  },
  {
    name: "Slow Burn",
    slug: "slow-burn",
    category: "experience",
    keywords: ["slow burn", "gradual", "build up", "creeping dread", "pacing", "atmosphere building", "subtle tension"]
  },
  {
    name: "High Tension",
    slug: "high-tension",
    category: "experience",
    keywords: ["high tension", "stressful", "panic", "heart-pounding", "chase", "pursued", "relentless enemy", "nervous"]
  },
  {
    name: "Lonely / Isolated",
    slug: "isolated",
    category: "experience",
    keywords: ["lonely", "isolated", "isolation", "solitude", "desolate", "abandoned", "alone", "empty town", "silence"]
  },
  {
    name: "Melancholic",
    slug: "melancholic",
    category: "experience",
    keywords: ["melancholic", "sad", "somber", "depressing", "sorrow", "grief", "loss", "tragedy", "weeping", "mourning"]
  },
  {
    name: "Jumpscare Heavy",
    slug: "jumpscare-heavy",
    category: "experience",
    keywords: ["jumpscare", "jump scare", "screamer", "sudden fright", "loud noise", "pop up"]
  },
  {
    name: "Unsettling",
    slug: "unsettling",
    category: "experience",
    keywords: ["unsettling", "creepy", "disturbing", "uncomfortable", "bizarre", "weird", "strange", "abnormal", "deformed"]
  },
  {
    name: "Chaotic Panic",
    slug: "chaotic-panic",
    category: "experience",
    keywords: ["panic", "chaos", "stress", "screaming", "frantic", "escape", "frantic pace", "hectic"]
  },
  {
    name: "Cozy Horror",
    slug: "cozy-horror",
    category: "experience",
    keywords: ["cozy", "comforting", "charming", "spooky but cute", "relaxed", "halloween vibe", "retro comforting"]
  },

  // 6. Player Perspective (perspective)
  {
    name: "First person",
    slug: "first-person",
    category: "perspective",
    keywords: ["first person", "first-person", "fpv", "fps"]
  },
  {
    name: "Third person",
    slug: "third-person",
    category: "perspective",
    keywords: ["third person", "third-person", "over the shoulder", "tps"]
  },
  {
    name: "Isometric",
    slug: "isometric",
    category: "perspective",
    keywords: ["isometric", "diagonal view"]
  },
  {
    name: "Side view",
    slug: "side-view",
    category: "perspective",
    keywords: ["side view", "side-scroller", "side scroller", "2d platformer"]
  },
  {
    name: "Top down",
    slug: "bird-view-top-down",
    category: "perspective",
    keywords: ["top down", "top-down", "bird view", "bird's-eye view", "overhead"]
  },
  {
    name: "Text",
    slug: "text",
    category: "perspective",
    keywords: ["text", "text-based", "interactive fiction"]
  },
  {
    name: "Virtual Reality",
    slug: "virtual-reality",
    category: "perspective",
    keywords: ["virtual reality", "vr", "oculus", "meta quest", "psvr"]
  }
];

// Backward Compatibility Aliases
export const MOODS = HORROR_TAXONOMY.map(t => ({ name: t.name, slug: t.slug }));

export async function getTaxonomyTagsForGame(
  game: GameInput,
  classifier?: any // Optional zero-shot classifier
): Promise<{
  tags: TaxonomyTag[];
  scores: Record<string, number>;
}> {
  const matchedTags: TaxonomyTag[] = [];
  const scores: Record<string, number> = {};

  const title = (game.title || "").toLowerCase();
  const summary = (game.summary || "").toLowerCase();
  const storyline = (game.storyline || "").toLowerCase();
  const text = `${title}. ${summary} ${storyline}`.trim();

  const keywords = (game.keywords || []).filter(k => k?.name).map(k => k.name.toLowerCase());
  const genreNames = (game.genres || []).map(g => g.name.toLowerCase());

  // 1. HARD MATCHES (Genres, Keywords) - Very accurate
  for (const tag of HORROR_TAXONOMY) {
    let rawScore = 0;
    if (tag.category === "perspective") continue; // Handled natively

    const hasTitleMatch = tag.keywords.some(kw => title.includes(kw));
    if (hasTitleMatch) rawScore += 1.0;

    const hasGenreMatch = tag.keywords.some(kw => genreNames.some(g => g.includes(kw)));
    if (hasGenreMatch) rawScore += 0.8;

    const hasKeywordMatch = tag.keywords.some(kw => keywords.some(k => k.includes(kw)));
    if (hasKeywordMatch) rawScore += 0.7;

    const score = Math.min(1.0, rawScore);
    if (score >= 0.35) {
      scores[tag.slug] = parseFloat(score.toFixed(3));
      matchedTags.push(tag);
    }
  }

  // 2. AI ZERO-SHOT CLASSIFICATION (Summary/Storyline Text)
  // Only run AI if we have enough text and the classifier is passed
  if (classifier && text.length > 50) {
    // Truncate to ~1500 characters to prevent exceeding the model's 512 token limit
    const aiText = text.length > 1500 ? text.substring(0, 1500) + "..." : text;

    // Only classify against tags we haven't already locked in via hard matches
    const candidates = HORROR_TAXONOMY.filter(t => t.category !== "perspective" && !scores[t.slug]);
    const candidateNames = candidates.map(t => t.name);

    if (candidateNames.length > 0) {
      try {
        const result = await classifier(aiText, candidateNames, { multi_label: true });
        
        for (let i = 0; i < result.labels.length; i++) {
          const label = result.labels[i];
          const score = result.scores[i];
          
          // High confidence threshold for Zero-Error tagging
          if (score > 0.85) {
            const tag = candidates.find(t => t.name === label);
            if (tag) {
              scores[tag.slug] = parseFloat(score.toFixed(3));
              matchedTags.push(tag);
            }
          }
        }
      } catch (err) {
        console.error(`⚠️ AI Classification failed for ${title}:`, err);
      }
    }
  } else if (!classifier) {
    // Fallback legacy heuristic scanner if AI is not available
    for (const tag of HORROR_TAXONOMY) {
      if (scores[tag.slug]) continue;
      
      let summaryMatches = 0;
      tag.keywords.forEach(kw => {
        let idx = summary.indexOf(kw);
        while (idx !== -1) {
          summaryMatches++;
          idx = summary.indexOf(kw, idx + kw.length);
        }
      });
      let rawScore = summaryMatches * 0.35;

      let storylineMatches = 0;
      tag.keywords.forEach(kw => {
        let idx = storyline.indexOf(kw);
        while (idx !== -1) {
          storylineMatches++;
          idx = storyline.indexOf(kw, idx + kw.length);
        }
      });
      rawScore += storylineMatches * 0.25;

      const score = Math.min(1.0, rawScore);
      if (score >= 0.35) {
        scores[tag.slug] = parseFloat(score.toFixed(3));
        matchedTags.push(tag);
      }
    }
  }

  // Fallback if no tags matched
  if (matchedTags.length === 0) {
    const fallbackTag = HORROR_TAXONOMY.find(t => t.slug === "psychological")!;
    matchedTags.push(fallbackTag);
    scores["psychological"] = 0.35;
  }

  return { tags: matchedTags, scores };
}

// Backward Compatibility function
export async function getMoodTagsForGame(game: GameInput, classifier?: any): Promise<Array<{ name: string; slug: string }>> {
  const result = await getTaxonomyTagsForGame(game, classifier);
  return result.tags.map(t => ({ name: t.name, slug: t.slug }));
}
