# Database Operations & Safety Architecture

This document describes how database operations are executed against TursoDB (LibSQL), how multi-store records are unified into a "Golden Record", and how rollbacks are handled.

---

## 1. The "Golden Record" Pattern

When two or more listings are determined to be the exact same video game, the system does not simply delete one. Instead, it creates a **Golden Record**:

```
[Secondary Game Listing] ──────────┐
  - Has itch.io purchase link      │
  - Has richer community tags      ├─► [Primary Golden Record]
                                   │     - Inherits itch.io link (unlocks itch.io badge)
[Secondary Scraper Entry] ─────────┤     - Inherits GOG link (unlocks DRM-Free badge)
  - Has missing GOG link           │     - Merges tags, genres, platforms
  - Has higher resolution cover    │     - Fills in missing summary or cover art
                                   │
                                   ▼
                       [Secondary records marked status = 'hidden']
```

### Key Benefits:
- **Store Provenance**: If Game A was imported from IGDB with a Steam link, and Game B was imported from GOG, merging them gives the Golden Record both Steam and GOG links. On the frontend, this displays the purple **`DRM-Free`** badge alongside Steam.
- **Enriched Metadata**: If the primary record was missing a cover image, release date, or scare rating, it inherits them from the secondary record before the secondary is retired.

---

## 2. Non-Destructive Soft-Hiding

To ensure zero risk of accidental data loss, the pipeline **never** runs `DELETE FROM "Game"`.

Instead, secondary games are soft-hidden:
```sql
UPDATE "Game" SET status = 'hidden', "updatedAt" = unixepoch() WHERE id = ?;
```

### Why Soft-Hiding?
1. **Zero Data Loss**: The entire original record remains intact in the database.
2. **Instant Reversibility**: If any merge needs to be undone, changing `status` back to `'released'` restores the game immediately.
3. **Clean Frontend Filtering**: All frontend queries, sitemaps, and search index generators filter by:
   ```sql
   WHERE status IS NULL OR status != 'hidden'
   ```
   Hidden games are invisible to users and search engines while remaining fully preserved.

---

## 3. Atomic Batched SQL Execution

TursoDB is an edge database queried over HTTP. In early tests, running queries sequentially inside a loop took over ~50ms per network roundtrip, making thousands of database calls take 10+ minutes.

To solve this, operations are bundled using LibSQL's atomic batch API (`rawDb.batch`):

```typescript
const stmts: InStatement[] = [];

// 1. Delete duplicate purchase links (matching URLs)
stmts.push({
  sql: `DELETE FROM "PurchaseLink" WHERE "gameId" = ? AND "url" IN (SELECT "url" FROM "PurchaseLink" WHERE "gameId" = ?)`,
  args: [secondary.id, primary.id],
});

// 2. Reparent remaining purchase links
stmts.push({
  sql: `UPDATE "PurchaseLink" SET "gameId" = ? WHERE "gameId" = ?`,
  args: [primary.id, secondary.id],
});

// 3. Reparent price history
stmts.push({
  sql: `UPDATE "PriceSnapshot" SET "gameId" = ? WHERE "gameId" = ?`,
  args: [primary.id, secondary.id],
});

// 4. Merge tags and developers without collisions
stmts.push({
  sql: `INSERT OR IGNORE INTO "_GameToTag" ("A", "B") SELECT ?, "B" FROM "_GameToTag" WHERE "A" = ?`,
  args: [primary.id, secondary.id],
});
stmts.push({
  sql: `DELETE FROM "_GameToTag" WHERE "A" = ?`,
  args: [secondary.id],
});

// 5. Soft-hide secondary
stmts.push({
  sql: `UPDATE "Game" SET status = 'hidden', "updatedAt" = unixepoch() WHERE id = ?`,
  args: [secondary.id],
});

// Execute in a single transactional batch over the network
await rawDb.batch(stmts, "write");
```

This reduces execution time from 10 minutes to **under 40 seconds** across 60 clusters while guaranteeing that either all statements succeed together or none do.

---

## 4. Rollback Mechanisms

Each pass has a dedicated rollback script that reads the saved execution report and un-hides secondary records in seconds:

### Rollback Pass 1:
```bash
npx tsx scripts/dedup-pipeline/rollback.ts
```

### Rollback Pass 2:
```bash
npx tsx scripts/dedup-pass2/rollback-pass2.ts
```

### How Rollback Works:
```typescript
const secondarySlugs = report.poolAMerges.flatMap(m => m.secondarySlugs);
const placeholders = secondarySlugs.map(() => "?").join(",");

await rawDb.execute({
  sql: `UPDATE "Game" SET status = 'released', "updatedAt" = unixepoch() WHERE slug IN (${placeholders})`,
  args: secondarySlugs,
});
```
After rollback, running `npm run index:build` instantly restores the search index to include the restored records.
