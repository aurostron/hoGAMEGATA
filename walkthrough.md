# Project Walkthrough — gamegata-v1

> Agent-maintained change log. **Append-only**: every code/config/file change made by an
> AI agent (or significant human change) gets a new entry at the bottom. Never rewrite
> history.

---

## 2026-08-13 — Omnisync Harness Setup

### Summary
Installed the Omnisync agentic coding harness into the `gamegata-v1` project directory, establishing the append-only change-log convention and setting up the `.opencode` environment and subagents.

### Files Modified
| File | Action |
|------|--------|
| `AGENTS.md` | Modified — Integrated Omnisync change-log rule alongside Next.js notice |
| `CLAUDE.md` | Modified — Integrated Omnisync change-log rule with Astro dev guidelines |
| `.agents/AGENTS.md` | Modified — Integrated Omnisync change-log rule into agent preferences |
| `.opencode/.gitignore` | NEW — Ignored package manager artifacts |
| `.opencode/instructions.md` | NEW — OpenCode project instructions with change-log rule |
| `.opencode/agents/web-search.md` | NEW — Autonomous web research subagent |
| `walkthrough.md` | NEW — Project walkthrough change log initialized with initial harness setup entry |

### Design Decisions / Rationale
- Configured project-level rules across `AGENTS.md`, `CLAUDE.md`, `.agents/AGENTS.md`, and `.opencode/instructions.md` to ensure any AI agent operating on `gamegata-v1` adheres to the append-only documentation standard.
- Maintained existing project preferences and Astro development instructions.

### Verification
- Verified directory structure and file contents using PowerShell `Get-ChildItem` and file inspections.

---

## 2026-08-16 — API Security Hardening & Abuse Prevention

### Summary
Comprehensive hardening of all 25 public API endpoints following penetration test and abuse surface audit. Implemented KV-based rate limiting, fixed 3 critical authentication/authorization bypasses, enforced authentication on game likes, added Cloudflare Turnstile CAPTCHA to bug submissions, enforced server-side `userId` verification for edit suggestions, prevented CSRF on logout by transitioning to POST, and disabled legacy waitlist registration.

### Files Modified
| File | Action |
|------|--------|
| `src/lib/rateLimit.ts` | NEW — Cloudflare KV sliding-window rate limiter utility |
| `wrangler.jsonc` | Modified — Bound `RATE_LIMIT` KV namespace (`b4f797e76c9545d6aa41ea80be9ddb5a`) |
| `src/pages/api/maintenance/toggle.ts` | Modified — Removed spoofable `Referer` auth bypass, converted to POST-only |
| `src/pages/api/discord/interactions.ts` | Modified — Enforced hard-fail on missing `DISCORD_PUBLIC_KEY` & invalid signatures |
| `src/pages/api/auth/dev-bypass.ts` | Modified — Added `import.meta.env.DEV` guard (returns 404 in production) |
| `src/pages/api/game/likes.ts` | Modified — Enforced session authentication (`getServerUser`) and added rate limiting |
| `src/pages/api/edits/suggest.ts` | Modified — Enforced server-side `userId` verification and rate limiting (5 req/10 min) |
| `src/pages/api/bugs/submit.ts` | Modified — Integrated Turnstile CAPTCHA verification and rate limiting (3 req/hr) |
| `src/components/bugs/BugReportModal.tsx` | Modified — Added Turnstile CAPTCHA widget to bug report modal UI |
| `src/pages/api/search/click.ts` | Modified — Added rate limiting (30 req/min) |
| `src/pages/api/track/click.ts` | Modified — Added rate limiting (20 req/min) |
| `src/pages/api/waitlist/join.ts` | Modified — Disabled endpoint permanently (returns 410 Gone) |
| `src/pages/api/auth/logout.ts` | Modified — Converted from GET to POST to eliminate CSRF logout vulnerability |
| `src/pages/api/auth/token-login.ts` | Modified — Added rate limiting against token brute-force (5 req/15 min) |
| `src/layouts/AdminLayout.astro` | Modified — Updated logout link to submit via POST form |
| `src/pages/admin/verify-2fa.astro` | Modified — Updated logout link to submit via POST form |
| `src/context/AuthContext.tsx` | Modified — Added POST `/api/auth/logout` server call during logout flow |
| `src/pages/api/image-proxy.ts` | Modified — Added rate limiting (60 req/min) |
| `src/pages/api/game/credits.ts` | Modified — Added rate limiting (20 req/min) |
| `src/pages/api/protondb/fetch.ts` | Modified — Added rate limiting (20 req/min) and edge cache-control headers |
| `src/pages/api/search/web.ts` | Modified — Added non-dev environment guard (404 Not available) |
| `src/pages/api/games/index.ts` | Modified — Capped `sort=title` max limit from 20000 to 500 records |

### Design Decisions / Rationale
- **Sliding-window KV rate limiter**: Implemented in `src/lib/rateLimit.ts` leveraging Cloudflare KV with TTL auto-expiry and fail-open resilience to prevent accidental outages on KV faults while stopping high-frequency bot abuse.
- **Strict Server Auth Verification**: Replaced reliance on client-supplied body payloads (`body.userId`) with authenticated session tokens (`getServerUser`) on mutation endpoints to defeat identity spoofing and unauthorized reputation auto-approvals.
- **CSRF Defense**: Converted `/api/auth/logout` to POST to eliminate `<img src="/api/auth/logout">` image-tag CSRF traps.

### Verification
- Ran full production build (`npm run build`) — static sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.
- Verified Cloudflare `RATE_LIMIT` KV namespace creation via Wrangler CLI.

---

## 2026-08-16 — Enforce Client-Side Authentication on Likes and Wishlist Toggles

### Summary
Fixed optimistic guest interaction vulnerability where unauthenticated/incognito users could click Favorite / Like buttons and see optimistic state updates locally without logging in. Enforced strict authentication checks and automatic login redirect on all client components handling favorites, likes, and ratings.

### Files Modified
| File | Action |
|------|--------|
| `src/components/TrackControls.tsx` | Modified — Enforced `handleAuthRedirect()` when `!user` on `toggleWishlist` and `handleRatingChange`, preventing optimistic guest likes |
| `src/components/GameCatalogClient.tsx` | Modified — Added `!user` authentication redirect on card favorite toggle |
| `src/components/TabCatalog.tsx` | Modified — Added `!user` authentication redirect on tab game favorite toggle |
| `src/components/HeroCarousel.tsx` | Modified — Added `!user` authentication redirect on hero carousel favorite toggle |
| `src/components/StorefrontLists.tsx` | Modified — Added `!user` authentication redirect on storefront game favorite toggle |

### Design Decisions / Rationale
- Removed optimistic guest liking and guest `/api/game/likes` fallback from `TrackControls.tsx`. If a user is not authenticated (`!user`), interacting with Favorite/Like redirects to `/login?redirect=...`.
- Aligned all client-side favorite toggles across catalog, hero carousel, tabs, and game pages with the backend authentication requirement.

### Verification
- Ran production build (`npm run build`) successfully with 0 errors.

---

## 2026-08-16 — Fix Game Screenshots and Cover Image Rendering (Cloudinary 401 & Image Proxy)

### Summary
Fixed broken cover images and screenshot galleries on game pages (such as `/game/itch-backrooms-out-of-oxygen`). Resolved root cause where `getCloudinaryFetchUrl` was wrapping trending game URLs with Cloudinary's `image/fetch` feature which returned 401 Unauthorized for third-party hosting domains (`catbox.moe`, `iili.io`, etc.). Re-routed all remote game images through our Cloudflare Edge image proxy (`/api/image-proxy`), expanded `ALLOWED_HOSTS` domain whitelist, and increased proxy rate limits for screenshot galleries.

### Files Modified
| File | Action |
|------|--------|
| `src/lib/utils.ts` | Modified — Removed failing `res.cloudinary.com/image/fetch` route for trending games; routed all remote images through `/api/image-proxy?v=2&url=...` |
| `src/pages/api/image-proxy.ts` | Modified — Expanded `ALLOWED_HOSTS` to include itch.io, giphy, unsplash, and akamai CDN domains; raised rate limit from 60 to 600 req/min for gallery browsing |

### Design Decisions / Rationale
- Cloudinary free tier accounts reject unauthorized `image/fetch` proxying on third-party image domains. Our Cloudflare Worker image proxy already supports CDN-level 1-year immutable caching and handles external host fetching reliably without external account restrictions.
- Raised image proxy rate limit from 60 to 600 req/min so loading games with 12+ high-res screenshots never triggers rate-limiting false positives.

### Verification
- Tested `/api/image-proxy` against `catbox.moe` and `iili.io` URLs — returned `200 OK` with `Content-Type: image/webp` and `image/png`.
- Ran full production build (`npm run build`) — compiled with 0 errors.

---

## 2026-08-17 — Official Store & Platform Brand Logos for External/Creator Links

### Summary
Replaced generic external link icons across the game detail page with crisp, official vector brand logos (Steam, itch.io, GOG, Epic Games, PlayStation, Xbox, Nintendo, Humble Bundle, Fanatical, Reddit, and Official Website). Also integrated brand logos into the live storefront deal rows in the price comparison component.

### Files Modified
| File | Action |
|------|--------|
| `src/components/icons/OfficialLinkIcon.astro` | NEW — Astro component rendering platform and store vector SVG logos with theme-reactive currentColor fill/stroke |
| `src/components/icons/BrandIcon.tsx` | NEW — Universal React component supporting Steam, itch.io, GOG, Epic Games, PlayStation, Xbox, Nintendo, Humble Bundle, Fanatical, Reddit, Website, YouTube, Discord, Bluesky |
| `src/pages/game/[slug].astro` | Modified — Integrated `OfficialLinkIcon` across both Itch and standard game "Official & Creator Links" blocks |
| `src/components/PriceComparison.tsx` | Modified — Integrated `BrandIcon` into deal store rows |

### Design Decisions / Rationale
- Inline SVGs with `fill="currentColor"` (and `stroke="currentColor"` for outline icons) allow seamless color transitions on button hover states (`text-white/80 group-hover:text-black`) and dark theme palette consistency without external network asset dependencies.
- Added comprehensive fuzzy-matching so storefront variations (e.g. `Steam`, `itch.io`, `GOG.com`, `Epic Games Store`, `PlayStation Store`, `Nintendo eShop`) map automatically to their canonical brand iconography.

### Verification
- Ran full production build (`npm run build`) — sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.

---

## 2026-08-17 — Standardized Turnstile CAPTCHA & Edit Suggestion Protection

### Summary
Resolved Turnstile layout and lifecycle bugs by replacing the awkward compact layout with a standard responsive banner. Created a reusable, lifecycle-managed `TurnstileWidget` component with proper cleanup and fallback keys. Added Cloudflare Turnstile CAPTCHA verification to the Edit Suggestion modal and backend endpoint (`/api/edits/suggest`).

### Files Modified
| File | Action |
|------|--------|
| `src/components/ui/TurnstileWidget.tsx` | NEW — Reusable Turnstile component with dynamic script loading, explicit rendering, removal/cleanup on unmount, and official test keys |
| `src/components/bugs/BugReportModal.tsx` | Modified — Replaced manual script loading and compact layout with `TurnstileWidget` (`size="normal"`) |
| `src/components/editing/EditPageModal.tsx` | Modified — Added `turnstileToken` state, validation, reset hooks, and `TurnstileWidget` above submission actions |
| `src/pages/api/bugs/submit.ts` | Modified — Added dev fallback secret handling for seamless local verification |
| `src/pages/api/edits/suggest.ts` | Modified — Added server-side `turnstileToken` validation and Cloudflare `siteverify` verification |
| `src/components/LoginPage.tsx` | Modified — Corrected fallback test site key to canonical `1x00000000000000000000AA` |

### Design Decisions / Rationale
- Standard horizontal Turnstile banner (`size="normal"`, 300x65px) replaces the compact 130px box for a balanced, modern layout inside modal forms.
- Dynamic cleanup lifecycle (`turnstile.remove`) prevents stale iframe errors and duplicate widgets when modals are reopened.
- Added symmetric client & server validation on both bug reports and edit suggestions to prevent automated submission spam.

### Verification
- Ran full production build (`npm run build`) — sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.

---

## 2026-08-17 — Official Vector Brand Logos & UI/UX Perfection

### Summary
Perfected vector brand logos and external storefront links according to UI/UX Pro Max design standards. Replaced inverted/distorted shapes with authentic, pixel-accurate vector paths for Steam, itch.io, GOG, Epic Games, PlayStation, Xbox, Nintendo Switch, Humble Bundle, Fanatical, Reddit, Official Website, YouTube, Discord, and Bluesky. Refined button interactions, hover states, optical alignment, and cursor states.

### Files Modified
| File | Action |
|------|--------|
| `src/components/icons/BrandIcon.tsx` | Modified — Upgraded with canonical 24x24 vector paths for all gaming platforms and storefronts |
| `src/components/icons/OfficialLinkIcon.astro` | Modified — Upgraded with canonical 24x24 vector paths for all gaming platforms and storefronts |
| `src/pages/game/[slug].astro` | Modified — Polished button padding, typography, icon alignment (`gap-2.5`, `px-4 py-2.5`, `cursor-pointer`, `w-3.5 h-3.5` external link icon) |

### Design Decisions / Rationale
- Applied official SVG paths from canonical brand repositories to eliminate inverted fill silhouettes (such as solid circular backgrounds).
- Standardized uniform 24x24 viewBox scaling across all icons with `currentColor` reactive fills and strokes, providing seamless hover state transitions from muted white to high-contrast dark text.
- Enhanced accessibility with `cursor-pointer`, `items-center`, and proportional icon sizing.

### Verification
- Ran full production build (`npm run build`) — sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.

---

## 2026-08-18 — Edit Proposal & Bug Report Safe Error Handling

### Summary
Fixed `TypeError: fetch failed` error that occurred when submitting edit proposals under local Vite/Miniflare dev runtime. Resolved the static `cloudflare:workers` module import in API endpoints by switching to safe runtime dynamic loading. Sanitized client-side response handlers in `EditPageModal.tsx` and `BugReportModal.tsx` to cleanly extract error messages and prevent raw HTML tags (`<!DOCTYPE html>`) from being rendered in error alerts.

### Files Modified
| File | Action |
|------|--------|
| `src/pages/api/edits/suggest.ts` | Modified — Switched from static `cloudflare:workers` import to safe dynamic resolution, added abort timeout on Turnstile verification |
| `src/pages/api/bugs/submit.ts` | Modified — Switched to safe dynamic resolution of workers environment and verification timeout |
| `src/components/editing/EditPageModal.tsx` | Modified — Added HTML error sanitization so dev 500 error pages extract human-friendly error messages |
| `src/components/bugs/BugReportModal.tsx` | Modified — Added HTML error sanitization and fallback error parsing |

### Design Decisions / Rationale
- Static imports of `cloudflare:workers` in server endpoints can cause Miniflare dispatcher failures during local development. Dynamic resolution inside `try...catch` keeps dev and Cloudflare production seamless.
- Client modal forms now strip HTML boilerplate from non-JSON server errors so users see clean, actionable error messages rather than raw stack traces or HTML code.

### Verification
- Ran full production build (`npm run build`) — sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.

---

## 2026-08-18 — Official Platform & Storefront Vector Icons Integration

### Summary
Integrated and renamed the provided official platform/storefront vector marks:
- **Steam**: Official white circular badge containing the mechanical crank path (`public/icons/steam.svg`).
- **GOG**: Inverted white badge card with crisp letter cutouts (`public/icons/gog.svg`).
- **itch.io**: Official red circular badge with white controller silhouette (`public/icons/itch.svg`).
- **Reddit**: Official full-color circular Reddit mark (`public/icons/reddit.png`).

Updated [`BrandIcon.tsx`](file:///C:/Users/bapum/Desktop/Portfolio/gamegata-astro/src/components/icons/BrandIcon.tsx) and [`OfficialLinkIcon.astro`](file:///C:/Users/bapum/Desktop/Portfolio/gamegata-astro/src/components/icons/OfficialLinkIcon.astro) to render these exact marks across game detail pages, price comparisons, and official links.

### Files Modified
| File | Action |
|------|--------|
| `public/icons/steam.svg` | Created — Official Steam circular badge icon |
| `public/icons/gog.svg` | Created — Inverted white GOG badge icon |
| `public/icons/itch.svg` | Created — Official red itch.io badge icon |
| `public/icons/reddit.png` | Created — Official Reddit circular icon |
| `public/platforms/*` | Synced — Copied standard platform assets |
| `src/components/icons/BrandIcon.tsx` | Modified — Upgraded Steam, itch, GOG (inverted), and Reddit renderers |
| `src/components/icons/OfficialLinkIcon.astro` | Modified — Upgraded Steam, itch, GOG (inverted), and Reddit renderers |

### Verification
- Ran full production build (`npm run build`) — sitemap, search index, and Cloudflare Worker bundle compiled with 0 errors.

---

## 2026-08-21 — 98k Itch.io Horror Games Catalog Migration & Fast-Redirect Routing

### Summary
Successfully processed and imported **97,995 scraped itch.io horror games** into the Gamegata database. Deduplicated and enriched **9,090 existing games** with official `itch.io` purchase links and price snapshots. Created **88,905 new standalone itch horror games**, mapped **68,073 developer profiles**, and indexed **15,830 tags** including AI transparency flags ("No AI", "AI-Assisted", "AI Text"). Configured seamless fast-redirect routing on game cards to direct users to official itch.io store pages for un-enriched catalog titles.

### Files Modified
| File | Action |
|------|--------|
| `scripts/migrate-itch-games.ts` | NEW — High-performance transactional batch migration pipeline (~1,000 games/sec) supporting both local SQLite and remote Turso targets |
| `src/pages/game/[slug].astro` | Modified — Added 307 fast-redirect logic for standalone itch games pending detail enrichment passes |
| `src/pages/api/discord/interactions.ts` | NEW — Discord interaction endpoint supporting Ed25519 signature verification and 1-click Approve/Reject actions |
| `.env` | Modified — Added Discord Application credentials (`DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`) |

### Design Decisions / Rationale
- **High-Throughput Batch Transactions**: Executed chunked batches of 250 statements via `@libsql/client` batch API, completing the entire ~98,000 game import in **154 seconds** with zero network timeouts or lost writes.
- **Deduplication Engine**: Cleanly matched 9,090 existing IGDB/Steam games by normalized title and attached official itch.io `PurchaseLink` and `PriceSnapshot` records rather than polluting the catalog with duplicate game records.
- **Fast-Redirect UX**: For new standalone itch titles pending rich manual detail passes (screenshots/trailers), game cards and search entries seamlessly 307-redirect directly to the creator's official itch.io download page while full developer profile pages (`/developer/[slug]`) are dynamically generated.
- **AI Transparency Classification**: Mapped scrape-level AI flags into standardized searchable tags (`"No AI"`, `"AI-Assisted"`, `"AI Text"`) for filterability.

### Verification
- Executed `scripts/migrate-itch-games.ts --target=local`:
  - Total records processed: 97,995 in 154.1s.
  - Matched & enriched existing games: 9,090.
  - Created new standalone games: 88,905.
  - Total developers in database: 68,073.
  - Total tags in database: 15,830.
- Ran full production build (`npx astro build`) — compiled cleanly in 33.71s with 0 errors.

---

## 2026-08-21 — Remote Turso Cloud Database Sync & Offline Search Indexation

### Summary
Forwarded the complete master catalog to the live remote Turso cloud database (`libsql://gamegata-db-aurostron.aws-ap-northeast-1.turso.io`) via high-speed multi-worker parallel pipeline (`scripts/fast_remote_sync.ts`). Synced 107,814 games, 68,034 developers, 111,168 store purchase links, 104,310 price snapshots, 15,825 tags, and 743,343 relations. Regenerated the offline instant client search index (`public/search-index.json`, 107,810 records) and verified production server bundle compilation.

### Files Modified
| File | Action |
|------|--------|
| `scripts/fast_remote_sync.ts` | NEW — Multi-worker parallel sync pipeline (8 concurrent client workers) streaming chunked transactional batches directly to remote Turso DB |
| `scripts/generate-search-index.ts` | Modified — Optimized search index generator to build `public/search-index.json` using cached developer names in under 10 seconds |
| `scripts/export_detailed_catalog.ts` | NEW — Master catalog exporter generating full CSV and SQLite exports |
| `scripts/generate_pptx_report.py` | NEW — 16:9 Dark Mode PowerPoint presentation generator |
| `scripts/generate_html_report.ts` | NEW — Interactive visual dashboard report with chart visualizers and print-to-PDF styles |
| `public/search-index.json` | Generated — 107,810 searchable games offline index (16.1 MB) |

### Design Decisions / Rationale
- **Multi-Worker Cloud Streaming**: Deployed 8 concurrent LibSQL clients with `batch([...], 'write')` chunking to saturate available network bandwidth, pushing 743k+ relations and 107k+ records directly to Turso AWS Tokyo edge nodes in ~15 minutes.
- **Client Search Acceleration**: Streamlined `generate-search-index.ts` from heavy multi-table SQL joins down to single-pass resolution from indexed metadata, producing the 107.8k search index in 9.9 seconds.

### Verification
- Verified live counts on remote Turso cloud DB:
  - `Game`: 107,814 records
  - `Developer`: 68,034 records
  - `PurchaseLink`: 111,168 records
  - `PriceSnapshot`: 104,310 records
  - `Tag`: 15,825 records
  - `_GameToTag`: 743,343 relations
- Rebuilt production bundle (`npx astro build`) — completed in 48.63s with 0 errors.

---

## 2026-08-21 — Cloudflare Production Deployment & SSR Edge Directory

### Summary
Successfully deployed the 107.8k master catalog upgrade to production on Cloudflare Workers (`gamegata.xyz`). Transitioned the massive A-Z directory route (`src/pages/directory.astro`) from static pre-rendering to high-performance on-demand SSR with edge cache headers (`Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`), eliminating the 36.6 MB static asset restriction and allowing instant Cloudflare asset distribution.

### Files Modified
| File | Action |
|------|--------|
| `src/pages/directory.astro` | Modified — Converted from `prerender = true` to `prerender = false` with edge caching headers to comply with Cloudflare 25 MB asset limit |
| `.env` | Modified — Updated `TURSO_AUTH_TOKEN` to latest live production credential |
| `public/sitemap.xml` | Generated — 107,814 games + 68,034 developers indexed |
| `public/search-index.json` | Generated — 107,810 active games search index deployed |

### Verification
- Executed `npm run deploy` (`wrangler deploy`):
  - Uploaded Cloudflare assets & Worker bundle in 27.98s.
  - Deployed live triggers to `gamegata.xyz` (Version ID: `f9eccb19-f67e-4d4b-bd5b-17f5d1e11e65`).
  - Production status: 100% Live.

---

## 2026-08-21 — Directory Redirect to VitePress & Build Pipeline Optimization

### Summary
Configured the `/directory` route to 301 fast-redirect directly to `https://project-hgg.github.io`. Streamlined the production build script in `package.json` by removing client search-index generation from the `gamegata.xyz` deployment step and routing directory indexing to VitePress generator (`scripts/generate-vitepress-index.ts`), updating all 107.8k game entries into `vitepress-index/docs/`. Re-deployed the updated Cloudflare Worker to `gamegata.xyz`.

### Files Modified
| File | Action |
|------|--------|
| `src/pages/directory.astro` | Modified — Added 301 HTTP redirect to `https://project-hgg.github.io` with HTML fallback |
| `package.json` | Modified — Removed `generate-search-index.ts` from default `build` script |
| `vitepress-index/docs/` | Generated — 107.8k games alphabetical directories and search index compiled |

### Verification
- Ran `npx tsx scripts/generate-vitepress-index.ts` — successfully generated 107,810 entries into `vitepress-index/docs/`.
- Deployed to Cloudflare (`npm run deploy`) — Version ID `378b5b4a-9ea9-46b4-a21b-9a9275596440` live on `gamegata.xyz`.

---

## 2026-08-21 — Multi-Token Relevance & Fuzzy Search Engine Upgrade

### Summary
Revamped local search across the platform from strict exact-matching to an intelligent multi-token relevance search engine. Implemented tokenized multi-term SQL matching with dynamic weighted scoring (exact title, prefix match, full substring, token overlap, developer matching, rating/popularity boost) across 107k+ games in `src/pages/api/search/suggest.ts`, `src/pages/api/search/ai.ts`, and `src/lib/searchEngine.ts`. Enhanced client-side `MiniSearch` configuration with `combineWith: "OR"`, `prefix: true`, and fuzzy tolerance in `searchWorker.ts`, `nativeSearchManager.ts`, and VitePress `CustomSearchModal.vue`. Re-deployed live to Cloudflare.

### Files Modified
| File | Action |
|------|--------|
| `src/pages/api/search/suggest.ts` | Modified — Upgraded auto-suggest endpoint to tokenize multi-term queries and rank results with SQL relevance scoring |
| `src/pages/api/search/ai.ts` | Modified — Replaced 1-item exact-title restriction with `localRelevanceSearch` returning top 24 ranked matching games with relation metadata |
| `src/lib/searchEngine.ts` | Modified — Added `localRelevanceSearch` function with token overlap scoring, abbreviation expansion, and quality weighting |
| `src/workers/searchWorker.ts` | Modified — Enhanced MiniSearch options (`combineWith: "OR"`, `fuzzy: 0.25`, `prefix: true`, custom weights) |
| `src/lib/nativeSearchManager.ts` | Modified — Updated main-thread and worker search options to match fuzzy relevance settings |
| `vitepress-index/docs/.vitepress/theme/CustomSearchModal.vue` | Modified — Updated VitePress search modal with `combineWith: "OR"` and multi-token fuzzy matching |
| `scripts/test_search.ts` | NEW — Test harness verifying multi-token queries ("silent 2", "puppet combo", "ps1 retro", etc.) |

### Verification
- Tested multi-term queries against live 107k database via `scripts/test_search.ts`:
  - `"silent 2"` -> returns Silent Hill 2: Restless Dreams, Silent Hill 2, Silent Hill 3.
  - `"puppet combo"` -> returns all Puppet Combo games.
  - `"resident"` -> returns top Resident Evil franchise titles ranked by score/rating.
  - `"ps1 retro"` & `"alien horror"` -> returns ranked horror matches.
- Updated `src/middleware.ts` to add top-level 301 redirect for `/directory` and unblock search API endpoints in production.
- Updated `src/components/Footer.astro` to link directly to `https://project-hgg.github.io`.
- Executed `scripts/verify_live.ts` against live `https://gamegata.xyz`:
  - `GET https://gamegata.xyz/directory` -> Status 301, Location: `https://project-hgg.github.io` (Verified PASS).
  - `GET https://gamegata.xyz/api/search/suggest?q=silent%202` -> Status 200, 10 multi-token results (Verified PASS).
  - `POST https://gamegata.xyz/api/search/ai` -> Status 200, enriched ranked results (Verified PASS).
- Cloudflare Version ID `461cc70b-65a2-42af-929f-a5d080153f73` active on `gamegata.xyz`.

---

## 2026-08-22 — Non-Itch Store Link Isolation & Cloudflare Turnstile Gateway Fix

### Summary
1. **Non-Itch Store Link & Pricing Isolation**:
   - Identified that the previous itch scraper merge script matched titles against existing non-itch catalog games (e.g. Visage, Doki Doki Literature Club), inserting 8,892 mismatched `pl_itch_%` purchase links and `ps_itch_%` ($0) price snapshots.
   - Executed database cleanup in both remote Turso and local SQLite, purging all 8,892 mismatched records.
   - Strictly updated `src/pages/game/[slug].astro` to isolate itch purchase links, price snapshots, and the under-cover "Buy / Download on itch.io" CTA button so that it **only** renders when `isItchGame` is explicitly true (`slug.startsWith("itch-")` or `source === "itch"`).
   - Updated `scripts/migrate-itch-games.ts` so future scraper syncs only match against itch entries.
2. **Cloudflare Turnstile Gateway Fix**:
   - Resolved the `Verification failed. Try again.` Turnstile error on `/re/[slug]/[store]` (e.g. Species: Unknown).
   - Added `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` worker environment variables to `wrangler.jsonc` `vars`.
   - Updated `src/pages/re/[slug]/[store]/verify.ts` and `src/pages/re/[slug]/[store].astro` to resolve secret and site keys directly from `runtimeEnv` and initialize Turso isolates.
   - Added `initTursoForRequest(runtimeEnv)` to `src/pages/api/games/[id]/prices.ts`.

### Files Modified
| File | Action |
|------|--------|
| `wrangler.jsonc` | Modified — Added `PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to worker environment variables |
| `src/pages/game/[slug].astro` | Modified — Strictly filtered out itch purchase links & snapshots for non-itch games; guarded under-cover CTA button with `isItchGame` |
| `src/pages/re/[slug]/[store]/verify.ts` | Modified — Fixed Turnstile secret key resolution from Cloudflare runtime env and initialized Turso clients |
| `src/pages/re/[slug]/[store].astro` | Modified — Initialized Turso and passed live sitekey from runtimeEnv |
| `src/pages/api/games/[id]/prices.ts` | Modified — Added `initTursoForRequest` for serverless isolate safety |
| `scripts/migrate-itch-games.ts` | Modified — Constrained title matching to existing itch entries only |
| `scripts/clean_non_itch_collisions.ts` | NEW — Executed database cleanup of 8,892 mismatched itch records in Turso and local DB |

### Verification
- Ran live audit on production `https://gamegata.xyz`:
  - `GET /game/visage`: Verified "Buy / Download on itch.io" CTA is gone, fake $0 deal is gone, and real Steam/GOG deals render.
  - `GET /re/species-unknown/steam`: Verified valid Turnstile site key `0x4AAAAAADxZWPj99fIewEFh` and operational server verification.
  - `GET /directory`: Verified 301 redirect to `https://project-hgg.github.io`.
- Deployed to Cloudflare (`npm run deploy`): Version ID `3ac4abb2-95db-4a25-a383-42cf3714b015` live on `https://gamegata.xyz`.

---

## 2026-08-22 — Dynamic 100k+ Full Catalog Querying & Real-Time Count Fix

### Summary
Fixed the games registry `/games` pagination and total count restriction where only 18,206 games were shown instead of the entire 107k+ catalog:
1. **Root Cause**: The catalog query condition in `src/pages/api/games/index.ts` applied a strict `lte(gamesTable.releaseDate, todayDate)` filter. Because ~89,000+ indie and itch games in the catalog have `releaseDate IS NULL`, SQL evaluated `NULL <= todayDate` as falsy, filtering out 89k+ games.
2. **Dynamic Ingestion-Safe Counts**:
   - Updated `buildConditions` in `src/pages/api/games/index.ts` to `or(isNull(gamesTable.releaseDate), lte(gamesTable.releaseDate, todayDate))` and `or(isNull(gamesTable.status), ne(gamesTable.status, "upcoming"))`.
   - Updated `sort === "latest"` ordering to cleanly prioritize games with known release dates first while keeping all undated games browseable.
   - Initialized Turso request isolates with `initTursoForRequest(runtimeEnv)` in `src/pages/games.astro` and `src/pages/api/games/index.ts`.
   - The catalog now dynamically computes the live Turso count on every request, automatically reflecting all 107,272+ catalog games and any future ingestions.

### Files Modified
| File | Action |
|------|--------|
| `src/pages/api/games/index.ts` | Modified — Fixed releaseDate filter to include NULL dates, updated latest sort ordering, initialized Turso isolate |
| `src/pages/games.astro` | Modified — Added `initTursoForRequest` for serverless Cloudflare Workers runtime |

### Verification
- Tested live `/api/games` on `https://gamegata.xyz`:
  - `GET https://gamegata.xyz/api/games?limit=24&hideDlcs=true` -> Status 200, Returned `totalCount: 107272` games (Verified PASS).
- Deployed to Cloudflare (`npm run deploy`): Version ID `02854ece-1094-41ec-8f01-92cceff91f11` live on `https://gamegata.xyz`.

---

## 2026-08-22 — Client & Edge Cache Invalidation (4,470 Pages Live Verification)

### Summary
1. **Client & Edge Cache Invalidation**:
   - In `src/lib/catalogCache.ts`, bumped the client-side session cache prefix to `gata_cat_cache_v2_`, added automatic cleanup of legacy `v1` cached entries, and reduced TTL to 1 hour to prevent users' browsers from displaying stale page bounds (like 759 pages).
   - In `src/middleware.ts`, added query-parameter-aware edge caching for `/api/games` and purged stale non-query cache entries.
2. **Multi-Page Verification**:
   - Verified that the catalog expands from 759 pages to **4,470 full pages** (at 24 games per page).
   - Executed live API checks across Page 1, Page 1000, and Page 4470 on `https://gamegata.xyz`.

### Files Modified
| File | Action |
|------|--------|
| `src/lib/catalogCache.ts` | Modified — Bumped cache prefix to `v2`, added auto-purge for stale `v1` session caches |
| `src/middleware.ts` | Modified — Made `/api/games` cache key query-string aware and purged stale edge keys |

### Verification
---

## 2026-08-22 — Internal API Security Hardening, Zero Trust & Anti-Scraping Defense-in-Depth

### Summary
Implemented comprehensive defense-in-depth security hardening across network, authentication, and traffic control layers to protect internal and public APIs from data scraping, unauthorized access, and automated abuse:
1. **Anti-Scraping Decoys & 24h IP Blacklisting**:
   - Created decoy honeypot endpoints `/api/games/dump` and `/api/v1/export`. Automated scrapers/harvesters hitting these endpoints trigger a critical security alert, undergo a 2-second tar-pit delay, and are instantly blacklisted for 24 hours in the `RATE_LIMIT` Cloudflare KV namespace (`block:<ip>`).
   - Added invisible honeypot decoy links in `src/components/Footer.astro` that are invisible to real users but followed by headless crawlers.
2. **Strict Pagination Bounds & Rate Limiting**:
   - Added sliding-window KV rate limiting to `/api/games` (90 req/min), `/api/games/[id]/prices` (30 req/min), `/api/games/history` (30 req/min), and `/api/discord/interactions` (60 req/min).
   - In `src/lib/rateLimit.ts`, added `isIpBlocked(ip)` and `blockIp(ip, reason)` to enforce instant rejections on blocked scraper IPs.
3. **Zero-Trust Admin & Internal API Gating**:
   - In `src/middleware.ts`, expanded admin protection to explicitly gate all `/api/admin/*` routes alongside `/admin/*` behind session authentication and 2FA verification.
   - Enforced handler-level `checkAdmin` / `getServerUser` authorization in `src/pages/api/admin/bugs/list.ts`, `src/pages/api/admin/bugs/status.ts`, `src/pages/api/admin/analytics.ts`, `src/pages/api/admin/edits/queue.ts`, `src/pages/api/admin/edits/approve.ts`, `src/pages/api/admin/edits/reject.ts`, and `src/pages/api/admin/edits/rollback.ts`.
4. **Input Schema Validation & Mass-Assignment Prevention**:
   - Created strict Zod schemas with `.strict()` in `src/lib/validations/adminSchemas.ts` (`adminGamePatchSchema`, `adminDeveloperPatchSchema`, `adminAnnouncementSchema`, `editSuggestSchema`) to reject payload pollution and mass-assignment attacks.
5. **Webhook Security & Replay Attack Defense**:
   - Enforced timestamp replay protection on `src/pages/api/discord/interactions.ts` (rejecting requests with timestamps older than 5 minutes) and added rate limiting to `src/pages/api/maintenance/webhook.ts`.
6. **Centralized Structured Security Audit Telemetry**:
   - Created `src/lib/auditLogger.ts` to log structured JSON security events (honeypot triggers, blocked rate limits, unauthorized admin attempts, and sensitive mutations) to the Cloudflare Workers log stream.

### Files Modified
| File | Action |
|------|--------|
| `src/lib/auditLogger.ts` | Created — Structured JSON security audit logger |
| `src/lib/validations/adminSchemas.ts` | Created — Strict Zod validation schemas for admin payloads |
| `src/lib/rateLimit.ts` | Modified — Added `isIpBlocked`, `blockIp`, `forbiddenResponse`, `unauthorizedResponse`, and telemetry |
| `src/pages/api/games/dump.ts` | Created — Decoy honeypot endpoint with tar-pit and 24h IP auto-ban |
| `src/pages/api/v1/export.ts` | Created — Secondary decoy honeypot endpoint |
| `src/components/Footer.astro` | Modified — Added invisible honeypot trap links for crawler detection |
| `src/middleware.ts` | Modified — Gated all `/api/admin/*` routes behind Admin + 2FA verification |
| `src/pages/api/games/index.ts` | Modified — Added KV rate limiting (90 req/min) |
| `src/pages/api/games/[id]/prices.ts` | Modified — Added KV rate limiting (30 req/min) |
| `src/pages/api/games/history.ts` | Modified — Added KV rate limiting (30 req/min) |
| `src/pages/api/admin/games/[id].ts` | Modified — Enforced strict Zod schema validation and mutation audit logging |
| `src/pages/api/admin/bugs/list.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/bugs/status.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/analytics.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/edits/queue.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/edits/approve.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/edits/reject.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/admin/edits/rollback.ts` | Modified — Added in-handler admin auth check and audit logging |
| `src/pages/api/maintenance/webhook.ts` | Modified — Added rate limiting and auth failure audit logging |
| `src/pages/api/discord/interactions.ts` | Modified — Added 5-minute timestamp replay check, rate limiting, and audit logging |

### Verification
- Ran full production build (`npm run build`) — compiled with 0 errors.

---









