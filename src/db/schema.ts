import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

// --- Game Catalog ---
export const games = sqliteTable(
  "Game",
  {
    id: text("id").primaryKey(),
    igdbId: integer("igdbId"),
    title: text("title").notNull(),
    slug: text("slug").unique().notNull(),
    summary: text("summary"),
    storyline: text("storyline"),
    releaseDate: integer("releaseDate", { mode: "timestamp" }),
    status: text("status"),
    coverUrl: text("coverUrl"),
    rating: real("rating"),
    trailerUrl: text("trailerUrl"),
    screenshots: text("screenshots"), // JSON array of string URLs
    isTrending: integer("isTrending", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),

    // Secondary metadata
    metacritic: integer("metacritic"),
    metacriticUrl: text("metacriticUrl"),
    playtime: integer("playtime"),
    esrbRating: text("esrbRating"),
    pegiRating: text("pegiRating"),
    redditUrl: text("redditUrl"),
    websiteUrl: text("websiteUrl"),
    rawgRating: real("rawgRating"),
    rawgSlug: text("rawgSlug"),
    rawgEnriched: integer("rawgEnriched", { mode: "boolean" }).default(false).notNull(),
    rawgId: integer("rawgId"),
    lastRawgSync: integer("lastRawgSync", { mode: "timestamp" }),
    rawgMetadataHash: text("rawgMetadataHash"),

    // Steam metadata
    steamRating: real("steamRating"),
    steamRatingDesc: text("steamRatingDesc"),
    lastSteamSync: integer("lastSteamSync", { mode: "timestamp" }),

    // Scare Meter
    scareRating: real("scareRating"),
    scareProfile: text("scareProfile"), // JSON object string
    scareReviewCount: integer("scareReviewCount"),
    lastScareSync: integer("lastScareSync", { mode: "timestamp" }),

    // ProtonDB
    protonDbTier: text("protonDbTier"),
    protonDbConfidence: text("protonDbConfidence"),
    protonDbScore: real("protonDbScore"),
    protonDbTotalReports: integer("protonDbTotalReports"),
    lastProtonDbSync: integer("lastProtonDbSync", { mode: "timestamp" }),

    // General metadata fields cached
    category: integer("category"),
    minRequirements: text("minRequirements"),
    recRequirements: text("recRequirements"),
    popularity: real("popularity"),
    developerNames: text("developerNames"),
    genreNames: text("genreNames"),
    platformNames: text("platformNames"),
    source: text("source"),
    taxonomyScores: text("taxonomyScores"), // JSON object string
  },
  (table) => [
    index("game_release_date_idx").on(table.releaseDate, table.id),
    index("game_rating_idx").on(table.rating),
    index("game_status_idx").on(table.status),
    index("game_popularity_idx").on(table.popularity),
    index("game_proton_tier_idx").on(table.protonDbTier),
    index("game_slug_idx").on(table.slug),
    index("game_igdb_id_idx").on(table.igdbId),
    index("game_updated_at_idx").on(table.updatedAt),
    index("game_trending_popularity_idx").on(table.isTrending, table.popularity, table.id),
    index("game_trending_rating_idx").on(table.isTrending, table.rating),
    index("game_title_idx").on(table.title),
  ]
);

// --- Related Entities ---

export const developers = sqliteTable("Developer", {
  id: text("id").primaryKey(),
  igdbId: integer("igdbId").unique(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
  avatarUrl: text("avatarUrl"),
});

export const publishers = sqliteTable("Publisher", {
  id: text("id").primaryKey(),
  igdbId: integer("igdbId").unique(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
});

export const genres = sqliteTable("Genre", {
  id: text("id").primaryKey(),
  igdbId: integer("igdbId").unique(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
});

export const tags = sqliteTable("Tag", {
  id: text("id").primaryKey(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
});

export const platforms = sqliteTable("Platform", {
  id: text("id").primaryKey(),
  igdbId: integer("igdbId").unique(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
});

// --- Many-to-Many Join Tables ---

export const gamesToGenres = sqliteTable(
  "_GameToGenre",
  {
    gameId: text("A").notNull(),
    genreId: text("B").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.genreId] }),
    index("idx_game_to_genre_b").on(table.genreId),
  ]
);

export const gamesToTags = sqliteTable(
  "_GameToTag",
  {
    gameId: text("A").notNull(),
    tagId: text("B").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.tagId] }),
    index("idx_game_to_tag_b").on(table.tagId),
  ]
);

export const gamesToDevelopers = sqliteTable(
  "_DeveloperToGame",
  {
    developerId: text("A").notNull(),
    gameId: text("B").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.developerId, table.gameId] }),
    index("idx_developer_to_game_b").on(table.gameId),
  ]
);

export const gamesToPublishers = sqliteTable(
  "_GameToPublisher",
  {
    gameId: text("A").notNull(),
    publisherId: text("B").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.publisherId] }),
    index("idx_game_to_publisher_b").on(table.publisherId),
  ]
);

export const gamesToPlatforms = sqliteTable(
  "_GameToPlatform",
  {
    gameId: text("A").notNull(),
    platformId: text("B").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.platformId] }),
    index("idx_game_to_platform_b").on(table.platformId),
  ]
);

// --- Price Snapshot & Links ---

export const purchaseLinks = sqliteTable(
  "PurchaseLink",
  {
    id: text("id").primaryKey(),
    storeName: text("storeName").notNull(),
    url: text("url").notNull(),
    gameId: text("gameId").notNull(),
  },
  (table) => [
    index("purchase_link_game_id_idx").on(table.gameId),
  ]
);

export const priceSnapshots = sqliteTable(
  "PriceSnapshot",
  {
    id: text("id").primaryKey(),
    gameId: text("gameId").notNull(),
    storeName: text("storeName").notNull(),
    dealPrice: real("dealPrice").notNull(),
    retailPrice: real("retailPrice").notNull(),
    discountPercent: real("discountPercent").notNull(),
    dealUrl: text("dealUrl").notNull(),
    currency: text("currency").default("USD").notNull(),
    country: text("country").default("US").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("price_snapshot_unique_idx").on(table.gameId, table.storeName, table.country),
  ]
);

export const gameRecommendations = sqliteTable(
  "GameRecommendation",
  {
    gameId: text("gameId").notNull(),
    recommendedGameId: text("recommendedGameId").notNull(),
    distance: real("distance").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.recommendedGameId] }),
    index("idx_rec_game_id").on(table.gameId),
    index("idx_rec_recommended_id").on(table.recommendedGameId),
  ]
);

// --- Site Copy ---

export const siteContent = sqliteTable("SiteContent", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  type: text("type").default("text").notNull(),
  label: text("label"),
  section: text("section"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedBy: text("updatedBy"),
});
