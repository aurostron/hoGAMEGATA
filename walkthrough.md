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




