# hoGAMEGATA System Architecture

This document outlines the technical architecture of the hoGAMEGATA platform, covering runtime environments, data pipelines, media delivery, and security layers.

---

## High-Level Topology

```
                   [ Internet Clients / Web Browsers ]
                                   │
                                   ▼
             [ Cloudflare Global Edge & Anycast Network ]
                                   │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                              │                              │
    ▼                              ▼                              ▼
Static Assets              Cloudflare Workers             Cloudflare R2
(HTML, JS, CSS)            (Astro SSR Runtime)            (Planned Media Store)
    │                              │                              │
    │                              ├── Search & Filter API        └── Box art & screenshots
    │                              ├── Page Server Endpoints          (Cached at Edge)
    │                              └── Edge Session / KV Cache
    │                                      │
    └──────────────────────────────┬───────┘
                                   │
                                   ▼ (libSQL over HTTP)
                        [ Turso Cloud Database ]
                        ├── 107,000+ Game Records
                        ├── 68,000+ Developers & Studios
                        ├── 15,800+ Micro-Genre Tags
                        └── Relational Link Mappings
```

---

## 1. Application Runtime (Astro & Cloudflare Workers)

* **Framework**: Astro 7 configured with output mode `server` and the `@astrojs/cloudflare` adapter.
* **Execution Model**: Cloudflare Workers isolates. Requests execute across global edge data centers with minimal initialization latency.
* **Per-Request Isolation**: The database client initializes isolated libSQL sessions per request (`initTursoForRequest`) using worker environment bindings to avoid cross-request promise leakage inside Cloudflare Workers.
* **React Islands**: Heavy interactive elements (filtering drawers, catalog search inputs, sorting toggles) mount as isolated React 19 components using `client:idle` or `client:load` directives.

---

## 2. Relational Data Layer (Drizzle & Turso)

* **ORM**: Drizzle ORM (`drizzle-orm/libsql`) provides typed queries and SQL migrations.
* **Production Database**: Turso (distributed libSQL). Queries execute over stateless HTTP pipelines, making it compatible with serverless edge workers without persistent TCP connection pooling overhead.
* **Local Development**: When `TURSO_DATABASE_URL` is omitted, the application runs against local SQLite database files (`file:local.db`), enabling full offline development.

---

## 3. Media & Storage Architecture (Cloudflare R2 Migration)

Currently, hoGAMEGATA references game box art and screenshots from upstream platforms (IGDB, itch.io). This creates dependencies on third-party link stability and availability.

### Planned R2 Target Architecture:
1. **First-Party Asset Storage**: Game images will be ingested, normalized into WebP/AVIF formats, and stored directly in a Cloudflare R2 bucket.
2. **Predictable Key Structure**:
   ```
   r2://hogamegata-media/
   ├── games/
   │   └── {game_id}/
   │       ├── cover.webp
   │       ├── banner.webp
   │       └── screens/
   │           ├── screen-1.webp
   │           └── screen-2.webp
   ```
3. **Edge Caching Strategy**: Images served via Workers from R2 will output immutable cache headers:
   ```http
   Cache-Control: public, max-age=31536000, immutable
   ```
   This ensures cache hit rates exceeding 95% across Cloudflare's edge cache, reducing R2 Class B read operations and infrastructure load.
4. **Storage Tiering**: Archival and delisted titles with low access frequencies can leverage R2 Infrequent Access (IA) storage for cost efficiency.

---

## 4. Search Architecture

Rather than executing database `LIKE` queries for every keystroke across 107,000 records:

1. **Pre-Indexed Slices**: Build pipelines generate compressed client search indexes (`public/search-index.json`) using MiniSearch.
2. **Client-Side Execution**: User typing triggers fast client-side fuzzy searching in memory or worker threads (`searchWorker.ts`).
3. **Dynamic Filtering**: Server endpoints (`/api/games`) handle complex faceted criteria (year ranges, price thresholds, platforms, specific tag combinations) using indexed Drizzle query builders with SQL-level bounding.

---

## 5. Security & Traffic Control

The platform implements defense-in-depth security controls inside `src/middleware.ts` and API handlers:

* **Sliding-Window Rate Limiting**: Managed via Cloudflare KV namespaces (`RATE_LIMIT`), capping public API requests (e.g. 90 req/min on `/api/games`).
* **Honeypot Decoy Traps**: Endpoints such as `/api/games/dump` and `/api/v1/export` catch automated crawlers and harvesters, subjecting them to tar-pit delays and automatic 24-hour IP blocks.
* **Turnstile Protection**: External affiliate and storefront redirects pass through Cloudflare Turnstile token validation to prevent automated scraping of store referral paths.
* **Zero-Trust Administrative Gating**: Administrative paths (`/admin/*` and `/api/admin/*`) require two-factor authentication and verified session tokens.
