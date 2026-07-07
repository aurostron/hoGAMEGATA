CREATE TABLE `Developer` (
	`id` text PRIMARY KEY NOT NULL,
	`igdbId` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`avatarUrl` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Developer_igdbId_unique` ON `Developer` (`igdbId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Developer_name_unique` ON `Developer` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Developer_slug_unique` ON `Developer` (`slug`);--> statement-breakpoint
CREATE TABLE `GameRecommendation` (
	`gameId` text NOT NULL,
	`recommendedGameId` text NOT NULL,
	`distance` real NOT NULL,
	PRIMARY KEY(`gameId`, `recommendedGameId`)
);
--> statement-breakpoint
CREATE INDEX `idx_rec_game_id` ON `GameRecommendation` (`gameId`);--> statement-breakpoint
CREATE INDEX `idx_rec_recommended_id` ON `GameRecommendation` (`recommendedGameId`);--> statement-breakpoint
CREATE TABLE `Game` (
	`id` text PRIMARY KEY NOT NULL,
	`igdbId` integer,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`storyline` text,
	`releaseDate` integer,
	`status` text,
	`coverUrl` text,
	`rating` real,
	`trailerUrl` text,
	`screenshots` text,
	`isTrending` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`metacritic` integer,
	`metacriticUrl` text,
	`playtime` integer,
	`esrbRating` text,
	`pegiRating` text,
	`redditUrl` text,
	`websiteUrl` text,
	`rawgRating` real,
	`rawgSlug` text,
	`rawgEnriched` integer DEFAULT false NOT NULL,
	`rawgId` integer,
	`lastRawgSync` integer,
	`rawgMetadataHash` text,
	`steamRating` real,
	`steamRatingDesc` text,
	`lastSteamSync` integer,
	`scareRating` real,
	`scareProfile` text,
	`scareReviewCount` integer,
	`lastScareSync` integer,
	`protonDbTier` text,
	`protonDbConfidence` text,
	`protonDbScore` real,
	`protonDbTotalReports` integer,
	`lastProtonDbSync` integer,
	`category` integer,
	`minRequirements` text,
	`recRequirements` text,
	`popularity` real,
	`developerNames` text,
	`genreNames` text,
	`platformNames` text,
	`source` text,
	`taxonomyScores` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Game_slug_unique` ON `Game` (`slug`);--> statement-breakpoint
CREATE INDEX `game_release_date_idx` ON `Game` (`releaseDate`,`id`);--> statement-breakpoint
CREATE INDEX `game_rating_idx` ON `Game` (`rating`);--> statement-breakpoint
CREATE INDEX `game_status_idx` ON `Game` (`status`);--> statement-breakpoint
CREATE INDEX `game_popularity_idx` ON `Game` (`popularity`);--> statement-breakpoint
CREATE INDEX `game_proton_tier_idx` ON `Game` (`protonDbTier`);--> statement-breakpoint
CREATE INDEX `game_slug_idx` ON `Game` (`slug`);--> statement-breakpoint
CREATE INDEX `game_igdb_id_idx` ON `Game` (`igdbId`);--> statement-breakpoint
CREATE INDEX `game_updated_at_idx` ON `Game` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `game_trending_popularity_idx` ON `Game` (`isTrending`,`popularity`,`id`);--> statement-breakpoint
CREATE INDEX `game_trending_rating_idx` ON `Game` (`isTrending`,`rating`);--> statement-breakpoint
CREATE TABLE `_DeveloperToGame` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `idx_developer_to_game_b` ON `_DeveloperToGame` (`B`);--> statement-breakpoint
CREATE TABLE `_GameToGenre` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `idx_game_to_genre_b` ON `_GameToGenre` (`B`);--> statement-breakpoint
CREATE TABLE `_GameToPlatform` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `idx_game_to_platform_b` ON `_GameToPlatform` (`B`);--> statement-breakpoint
CREATE TABLE `_GameToPublisher` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `idx_game_to_publisher_b` ON `_GameToPublisher` (`B`);--> statement-breakpoint
CREATE TABLE `_GameToTag` (
	`A` text NOT NULL,
	`B` text NOT NULL,
	PRIMARY KEY(`A`, `B`)
);
--> statement-breakpoint
CREATE INDEX `idx_game_to_tag_b` ON `_GameToTag` (`B`);--> statement-breakpoint
CREATE TABLE `Genre` (
	`id` text PRIMARY KEY NOT NULL,
	`igdbId` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Genre_igdbId_unique` ON `Genre` (`igdbId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Genre_name_unique` ON `Genre` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Genre_slug_unique` ON `Genre` (`slug`);--> statement-breakpoint
CREATE TABLE `Platform` (
	`id` text PRIMARY KEY NOT NULL,
	`igdbId` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Platform_igdbId_unique` ON `Platform` (`igdbId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Platform_slug_unique` ON `Platform` (`slug`);--> statement-breakpoint
CREATE TABLE `PriceSnapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`gameId` text NOT NULL,
	`storeName` text NOT NULL,
	`dealPrice` real NOT NULL,
	`retailPrice` real NOT NULL,
	`discountPercent` real NOT NULL,
	`dealUrl` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`country` text DEFAULT 'US' NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `price_snapshot_unique_idx` ON `PriceSnapshot` (`gameId`,`storeName`,`country`);--> statement-breakpoint
CREATE TABLE `Publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`igdbId` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Publisher_igdbId_unique` ON `Publisher` (`igdbId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Publisher_name_unique` ON `Publisher` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Publisher_slug_unique` ON `Publisher` (`slug`);--> statement-breakpoint
CREATE TABLE `PurchaseLink` (
	`id` text PRIMARY KEY NOT NULL,
	`storeName` text NOT NULL,
	`url` text NOT NULL,
	`gameId` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_link_game_id_idx` ON `PurchaseLink` (`gameId`);--> statement-breakpoint
CREATE TABLE `SiteContent` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`label` text,
	`section` text,
	`updatedAt` integer NOT NULL,
	`updatedBy` text
);
--> statement-breakpoint
CREATE TABLE `Tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Tag_name_unique` ON `Tag` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Tag_slug_unique` ON `Tag` (`slug`);