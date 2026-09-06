# hoGAMEGATA — Tooling & Scripts Index

This directory contains automated ingestion runners, database migration utilities, search index generators, and developer tools for the hoGAMEGATA platform.

---

## 1. Build & Public Search Cache Generation

These scripts run during build time or via automated GitHub Actions workflows to prepare client-side assets and search indexes.

| Script | Purpose |
|---|---|
| `generate-sitemap.ts` | Builds static XML sitemaps partitioned across the entire 107k+ catalog for SEO indexing. |
| `generate-search-index.ts` | Compiles the MiniSearch offline instant client search index (`public/search-index.json`). |
| `apply-search-cache.ts` | Applies optimized search cache slices to reduce initial load time. |
| `pregenerate-draft.ts` | Generates search draft caches for fast client-side query matching. |
| `fix-manifest-urls.mjs` | Post-build helper to ensure web app manifest asset URLs resolve properly. |

---

## 2. Storefront Synchronization & Catalog Ingestion

Automated crawlers and API synchronizers that keep store purchase links, regional prices, and game availability current.

> **Note**: All ingestion scripts consume API credentials strictly from environment variables (`process.env.*`). No secrets are hardcoded.

| Script | Purpose |
|---|---|
| `sync-prices.ts` | Syncs regional pricing and discount percentages across Steam and GOG. |
| `sync-new-itch-games.ts` | Discovers and indexes newly published independent horror releases on itch.io. |
| `sync-new-igdb-dumps.ts` | Ingests weekly partner metadata dumps across platforms and developers. |
| `ingest-steam.ts` | Syncs detailed Steam store metadata, pricing, requirements, and tags. |
| `ingest-gog.ts` | Ingests DRM-free horror game metadata and regional store listings from GOG. |
| `fast_remote_sync.ts` | High-speed multi-worker remote synchronization pipeline for cloud database syncs. |

---

## 3. Database Maintenance & Migration Utilities

Utilities for introspecting, validating, and migrating relational data across libSQL / SQLite / Turso databases.

| Script | Purpose |
|---|---|
| `db-helper.ts` | Shared Drizzle ORM / libSQL database connection factory and schema export. |
| `check_counts.ts` | Quick health check measuring total games, developers, purchase links, and tags. |
| `check_tables.ts` | Introspects sqlite_master to verify schema migrations and table integrity. |
| `load-env.ts` | Helper utility to load and validate local environment configurations. |
| `cleanup-gog-duplicates.ts` | Deduplicates cross-store game collisions and unifies metadata. |
| `clean_non_itch_collisions.ts` | Resolves slug collisions between independent itch.io releases and storefront titles. |
| `fix-requirements.ts` | Normalizes and sanitizes minimum / recommended PC hardware specs. |

---

## 4. Editorial, Taxonomy & Scoring (Internal / Proprietary)

These utilities implement hoGAMEGATA's editorial classification systems.

| Script | Purpose |
|---|---|
| `enrich-scare.ts` | Computes and updates proprietary Scare Meter ratings based on horror intensity algorithms. |
| `mood-rules.ts` | Rule definitions and classification heuristics for thematic horror micro-tags. |
| `tag-moods.ts` | Automatically infers horror atmosphere tags based on metadata keywords and mood rules. |
| `deepseek-cache.ts` | LLM-assisted metadata enrichment and editorial categorization. |

---

## 5. Developer Consoles & Interactive Tools

| Script | Purpose |
|---|---|
| `dev-tools.ts` | Interactive CLI developer console (`npm run console`) for database administration, maintenance, and query testing. |
| `dev-gui.ts` | Local web-based admin GUI (`npm run dev-gui`) for visual catalog editing and maintenance. |

---

## Running Scripts

Most scripts can be executed locally using `tsx`:

```bash
# Verify database counts
npx tsx scripts/check_counts.ts

# Generate sitemap
npx tsx scripts/generate-sitemap.ts

# Test store price sync (dry run)
npx tsx scripts/sync-prices.ts
```
