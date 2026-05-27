export interface MoodFilterGroup {
  categoryName: string;
  categorySlug: string;
  filters: { name: string; slug: string }[];
}

export const TAXONOMY_GROUPS: MoodFilterGroup[] = [
  {
    categoryName: "Themes & Subgenres",
    categorySlug: "theme",
    filters: [
      { name: "Psychological", slug: "psychological" },
      { name: "Cosmic & Eldritch", slug: "cosmic-horror" },
      { name: "Body Horror", slug: "body-horror" },
      { name: "Liminal & Surreal", slug: "liminal-surreal" },
      { name: "Folk Horror", slug: "folk-horror" },
      { name: "Slasher", slug: "slasher" },
      { name: "Mascot Horror", slug: "mascot-horror" },
      { name: "Supernatural", slug: "supernatural" },
      { name: "Zombie & Apocalypse", slug: "zombie-apocalypse" },
      { name: "Creature", slug: "creature-horror" },
      { name: "Comedy & Parody", slug: "comedy-horror" }
    ]
  },
  {
    categoryName: "Setting & Flavor",
    categorySlug: "setting",
    filters: [
      { name: "Sci-Fi", slug: "setting-sci-fi" },
      { name: "Cyberpunk", slug: "setting-cyberpunk" },
      { name: "Medical", slug: "setting-medical" },
      { name: "Space", slug: "setting-space" },
      { name: "Deep Sea", slug: "setting-deep-sea" },
      { name: "Rural Isolation", slug: "setting-rural" },
      { name: "Urban Decay", slug: "setting-urban" },
      { name: "Industrial", slug: "setting-industrial" },
      { name: "School", slug: "setting-school" },
      { name: "Analog", slug: "setting-analog" },
      { name: "Found Footage", slug: "setting-found-footage" }
    ]
  },
  {
    categoryName: "Gameplay & Mechanics",
    categorySlug: "gameplay",
    filters: [
      { name: "Survival Horror", slug: "survival-horror" },
      { name: "Stealth & Hide", slug: "stealth-no-combat" },
      { name: "Action Horror", slug: "action-horror" },
      { name: "Narrative", slug: "narrative-horror" },
      { name: "Walking Sim", slug: "walking-sim" },
      { name: "Immersive Sim", slug: "immersive-sim" },
      { name: "Puzzle", slug: "puzzle-horror" },
      { name: "Point & Click", slug: "point-click" },
      { name: "Visual Novel", slug: "visual-novel" },
      { name: "Text-Based", slug: "text-based" },
      { name: "RPG Maker", slug: "rpg-maker" },
      { name: "Co-op", slug: "co-op" },
      { name: "Multiplayer", slug: "multiplayer" }
    ]
  },
  {
    categoryName: "Visual Identity",
    categorySlug: "visual",
    filters: [
      { name: "PS1 / Low Poly", slug: "retro-ps1" },
      { name: "Pixel Art", slug: "pixel-art" },
      { name: "VHS / Analog", slug: "vhs-analog" },
      { name: "Hand Drawn", slug: "hand-drawn" },
      { name: "Anime", slug: "anime-style" },
      { name: "Photorealistic", slug: "photorealistic" },
      { name: "FMV / Live Action", slug: "fmv" },
      { name: "Stylized", slug: "stylized" },
      { name: "Black & White", slug: "black-white" },
      { name: "CRT / Scanlines", slug: "crt-retro" }
    ]
  },
  {
    categoryName: "Emotional Experience",
    categorySlug: "experience",
    filters: [
      { name: "Oppressive", slug: "oppressive" },
      { name: "Slow Burn", slug: "slow-burn" },
      { name: "High Tension", slug: "high-tension" },
      { name: "Isolated / Lonely", slug: "isolated" },
      { name: "Melancholic", slug: "melancholic" },
      { name: "Jumpscare Heavy", slug: "jumpscare-heavy" },
      { name: "Unsettling", slug: "unsettling" },
      { name: "Chaotic Panic", slug: "chaotic-panic" },
      { name: "Cozy Horror", slug: "cozy-horror" }
    ]
  },
  {
    categoryName: "Player Perspective",
    categorySlug: "perspective",
    filters: [
      { name: "First person", slug: "first-person" },
      { name: "Third person", slug: "third-person" },
      { name: "Isometric", slug: "isometric" },
      { name: "Side view", slug: "side-view" },
      { name: "Top down", slug: "bird-view-top-down" },
      { name: "Text", slug: "text" },
      { name: "Virtual Reality", slug: "virtual-reality" }
    ]
  }
];
