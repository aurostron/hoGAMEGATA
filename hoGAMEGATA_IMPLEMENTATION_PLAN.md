# hoGAMEGATA: Stage-Wise Backend Implementation Plan

**Focus:** Event-driven metrics (Triggers), not calendar dates.  
**Core Directive:** Build for the reality of a FOSS, pre-revenue, curated horror catalog—prioritizing user experience and agile product evolution over premature infrastructure management.

---

## The Strategic Focus

At your current scale (~200 games), the primary objective is **not backend sophistication**. Your biggest leverage lies in:
1. Better horror discovery UX
2. A refined, highly specific taxonomy
3. Top-tier curation

A beautifully curated horror discovery platform with 2,000 highly targeted entries will always beat a technically pristine 100,000-game database that nobody enjoys browsing. The following blueprint implements optimization changes strictly through **performance-based triggers** rather than predefined milestones.

---

## Stage 1: The Immediate Baseline (200 → ~2,000 Games)

**Goal:** Establish foundational stability, database resilience, and initial presentation performance. Avoid adding any secondary infrastructure or changing your existing sequential ingestion flow.

### 1. Database Indexing
* **Action:** Explicitly define database indexes inside your `schema.prisma` file.
* **Target Fields:** Index the primary properties that govern lookups, sorting, and hot query paths:
    ```prisma
    @@index([slug])
    @@index([genre])
    @@index([releaseDate])
    @@index([rating])
    ```
    *Later, add composite vector indexes for multi-variable filtering fields:*
    ```prisma
    @@index([genre, platform]) // For queries like "Survival Horror + PC"
    ```
* **Rationale:** Adding indexes under active production load is risky and error-prone. Laying down programmatic roads before the data traffic hits prevents high-CPU full-table scans early on.

### 2. Ingestion Checkpoint Recovery
* **Action:** Modify your custom ingestion pipeline (`scripts/ingest.ts`) to log tracking cursors into a local flat file or a lightweight configurations table in Supabase.
* **Implementation:** Track fields such as `lastProcessedGameId` and `lastSyncTimestamp`.
* **Rationale:** Even at minor scale, if the ingestion pipeline suffers a network drop or hits an IGDB API limit at game 1,500, it shouldn't require restarting from zero. The engine should seamlessly resume from its last cursor position.

### 3. Caching via Incremental Static Regeneration (ISR)
* **Action:** Setup Next.js ISR on dynamic game detail pages (`src/app/game/[slug]`).
* **Rationale:** Horror catalog metadata changes very rarely. Rendering pages statically and setting a relaxed background refresh window minimizes active database reads, drastically reduces Supabase free-tier egress, and optimizes initial page loads.

---

## Stage 2: The Search Migration Sync (~2,000 → 10,000 Games)

**Trigger Metric:** The home page payload size grows noticeably, mobile clients experience stutter or lag while loading the grid, or initializing the client-side `MiniSearch` index shows visible UI friction.

```
[Trigger Event] ──> Large JSON payloads / Mobile UI lag ──> Shift MiniSearch to Postgres FTS
```

### 1. Prototype Server-Side Search Fallbacks
* **Action:** Prepare to deprecate full client-side array delivery. Prototype server-side search directly inside your existing relational database using PostgreSQL's built-in Full-Text Search features.
* **Implementation:** Enable and query using native extensions:
    * `tsvector` for structured full-text matching.
    * `pg_trgm` (trigram matching) for typo tolerance.
* **Rationale:** You are already paying for Supabase. Utilizing Postgres's highly optimized, built-in search components keeps your infrastructure surface area at zero extra cost and avoids DevOps overhead.

### 2. Transition Client Search Scope
* **Action:** Keep `MiniSearch` active on the client exclusively for fast, lightweight UI text autocompletes, but route structural discovery results and catalog updates to your server-side Postgres queries.

---

## Stage 3: Real Dataset Optimization (10,000 → 50,000 Games)

**Trigger Metric:** High-volume pagination requests display system friction, deep page `OFFSET` lookups slow down, or database joins introduce latency during catalog card feed generation.

### 1. Enforce Cursor Pagination
* **Action:** Totally eliminate standard `LIMIT X OFFSET Y` SQL logic across multi-page components. Transition to explicit key/id-based cursor pagination.
* **Implementation:** Refactor page queries to look up data relative to the last seen record:
    ```sql
    WHERE id > lastSeenId LIMIT 20
    -- Or ranking metrics:
    WHERE popularity < cursor LIMIT 20
    ```
* **Rationale:** Standard offset pagination forces PostgreSQL to read and discard all preceding rows up to the offset count. Cursors keep deep queries performing at constant, sub-second speeds.

### 2. Implement Denormalized Read Models
* **Action:** Add flat, cached text array attributes directly inside the core `Game` model table block (e.g., `developerNames: string[]`, `genreNames: string[]`, `platformNames: string[]`). Do not delete your normalized relationship models; use these strictly as read-only mirrors.
* **Rationale:** Discovery platforms are heavily read-optimized. Mirroring relationships directly inside the `Game` record allows your backend to assemble complex filtered browse grids without executing heavy 4-way table joins on every click.

### 3. Tiered Lazy Price Caching
* **Action:** If implementing the cheapest-price engine, structure a dual-tier cache to handle storefront scraping securely:
    * **Hot Tier (Top ~1,000 Iconic Games):** Run a background cron runner that updates prices for highly visible horror titles (*Resident Evil, Silent Hill, Signalis*) every 6–12 hours.
    * **Cold Tier (The Remaining Long-Tail Catalog):** Fetch storefront values *only* when an active user opens that specific game's detail view. Instantly cache that response to Supabase with a 24-hour Time-To-Live (TTL) window so subsequent users get sub-second responses without triggering third-party rate blocks.

---

## Stage 4: Scale & Infrastructure Hardening (50,000+ Games OR True Pain)

**Trigger Metric:** PostgreSQL search execution times spike noticeably, complex multi-variable filters degrade database throughput, autocomplete features hit walls, or text matching accuracy falls short.

### 1. Evaluate External Search Engines
* **Action:** Only when genuine, unfixable performance pain appears should you evaluate migrating to standalone platforms like **Meilisearch** or **Typesense**.
* **Rationale:** Moving search out of your primary database introduces synchronization logic, schema alignment tracking, index maintenance, and deployment configuration pipelines. Protect yourself from DevOps hell by staying natively in Postgres until row scaling demands it.

---

## Technical Summary Matrix for Development

| Priority Phase | Target Scale | Code/Infrastructure Deliverables | Objective / Rationale |
| :--- | :--- | :--- | :--- |
| **Stage 1 (Immediate)** | 200 → 2,000 | • Explicit Prisma DB Indexes<br>• Ingestion state checkpoints<br>• Page Caching & ISR | Protect database from full table scans, prevent scraping script crashes, and drop serverless compute usage. |
| **Stage 2** | 2,000 → 10,000 | • Supabase Postgres FTS (`tsvector`) + `pg_trgm` | Offload search calculation from mobile client memories to the server utilizing zero-cost infrastructure. |
| **Stage 3** | 10,000 → 50,000 | • Cursor-based pagination (`id > lastSeen`)<br>• Flat read model denormalization<br>• Tiered Hot/Cold price caching | Eliminate relational SQL join penalties across feed grids and scale out automated storefront price discovery safely. |
| **Stage 4** | 50,000+ | • Meilisearch / Typesense migration | Deploy dedicated search infrastructure **only** if query accuracy or structural sorting thresholds break. |

---

## Immediate Next Steps for Your Sprint
If you are prioritizing tasks for the upcoming development cycle, build only these three high-leverage features:
1. **Indexes:** Annotate `schema.prisma` with sorting and lookup targets.
2. **Checkpoints:** Upgrade `scripts/ingest.ts` to log tracking cursors.
3. **Caching:** Wrap game dynamic routing layouts with solid static regeneration (ISR) timelines.

Avoid the infrastructure rabbit hole. Optimize for the product first.
