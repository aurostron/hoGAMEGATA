# GAMEGATA Open-Core Architecture & GitHub Actions Automation Strategy

## 1. Executive Summary & Purpose

### Purpose
Transition GAMEGATA (`gamegata-astro`) into an **Open-Core platform** to:
1. **Utilize GitHub's Unlimited Free Actions Minutes**: Automate heavy background tasks (nightly store price updates, ProtonDB compatibility sync, search cache generation, and sitemap indexing) on 100% free GitHub Actions runners without requiring a paid VPS or credit card.
2. **Protect GAMEGATA's Data Moat**: Preserve exclusive ownership of GAMEGATA's highest-value proprietary assets—the **Scare Meter readings**, **15,800+ thematic horror micro-tags**, and hand-curated game metadata.
3. **Encourage Open-Source Contributions**: Allow external developers to contribute UI improvements, component enhancements, and bug fixes to the Astro codebase.

---

## 2. The Core Idea & Architecture

### Code vs. Data Decoupling
```
┌────────────────────────────────────────────────────────┐
│                   PUBLIC (GitHub)                      │
│                                                        │
│  • Astro 5 Frontend Code & Components                  │
│  • Drizzle Database Schemas & Migrations               │
│  • Automated Data Ingestion GitHub Workflows           │
│  • Search & Filter DSL Logic                           │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Encrypted GitHub Secrets)
┌────────────────────────────────────────────────────────┐
│               PRIVATE & PROTECTED (Turso)              │
│                                                        │
│  • 107,800+ Game Profiles & Metadata Records           │
│  • 15,800+ Micro-Genre Horror Tags                     │
│  • Proprietary Scare Meter Ratings                     │
│  • Production Database Credentials                     │
└────────────────────────────────────────────────────────┘
```

- **Open Source (Code)**: Astro 5 UI, React island components, Drizzle schema, search filters, and ingestion script runners.
- **Proprietary (Data)**: The full production dataset on Turso, Scare Meter ratings, tag taxonomy, and production secrets (`TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`).

---

## 3. Phase-by-Phase Execution Plan

### Phase 1: Repository Audit & Security Hardening
- **Objective**: Ensure no secrets, environment variables, or raw database files are committed.
- **Tasks**:
  - Verify `.gitignore` blocks `.env`, `.env.db-profiles.json`, `local.db`, `data/*.db`, `pending-search-cache.json`, and `/scratch/`.
  - Audit codebase for any hardcoded connection strings or API keys.
  - Store all production secrets securely in GitHub Repo Settings (`Settings` -> `Secrets and variables` -> `Actions`).

### Phase 2: Mock Seed Dataset for Local Contributors
- **Objective**: Allow open-source contributors to run `npm run dev` out of the box without needing production database credentials.
- **Tasks**:
  - Create `data/sample-seed.json` containing 10 mock game records.
  - Create `scripts/seed-mock-db.ts` to initialize a local SQLite file for new contributors automatically.

### Phase 3: GitHub Actions Automation Setup
- **Objective**: Automate data ingestion and price tracking using GitHub's free runners.
- **Workflows to Create**:
  1. `.github/workflows/daily-price-updates.yml`: Runs nightly at 3:00 AM UTC to update store prices across Steam, GOG, and Epic Games Store.
  2. `.github/workflows/sitemap-search-cache.yml`: Runs daily to pre-generate search indexes and update `sitemap.xml`.

### Phase 4: Licensing & Legal Dual-Structure
- **Objective**: Define clear, legally enforceable boundaries between open-source code, open database, and proprietary data assets.
- **Decided License Stack (2026-09-06)**:
  - **Code (`/LICENSE`)**: MIT License — permissive, OSI-approved, Cloudflare Project Alexandria compatible
  - **Curated Database (`DATA_LICENSE.md` → Section 2)**: Open Database License (ODbL 1.0) — attribution required, share-alike for derivative databases, "Produced Work" exception allows apps using the data to remain closed-source
  - **Scare Meter ratings & tag taxonomy (`DATA_LICENSE.md` → Section 3)**: Proprietary / All Rights Reserved — core data moat, no open license granted
  - **Third-party game metadata (`DATA_LICENSE.md` → Section 4)**: Not licensed by hoGAMEGATA — belongs to respective game publishers/developers
- **Tasks**:
  - Create `LICENSE` (MIT for application source code)
  - Create `DATA_LICENSE.md` with all four sections (code → ODbL → proprietary → third-party notice)
  - Add **Attribution notice** in `README.md`: code is MIT, database is ODbL, Scare Meter and tags are proprietary
  - Confirm aurostron is a personal pseudonym (single individual), not a registered commercial entity — state this clearly in the Project Alexandria application

### Phase 5: Repository Public Launch
- **Objective**: Transition GitHub repository to Public visibility.
- **Tasks**:
  - Change repository visibility to Public in GitHub Settings.
  - Run initial manual trigger (`workflow_dispatch`) of GitHub Actions to confirm Turso database synchronization over GitHub runner.

---

## 4. Expected Caveats & Mitigation Strategies

| Caveat / Risk | Potential Impact | Mitigation Strategy |
|---|---|---|
| **1. Scraping Live Data** | Malicious users trying to scrape Scare Meter readings from live API. | Enforce Edge Rate Limiting (120 req/min), Cloudflare Bot Fight Mode, and honeypot decoys (`/api/games/dump`). |
| **2. GitHub Cron Delay** | GitHub Actions schedule triggers can be delayed by 5–15 minutes during peak global load. | Add `workflow_dispatch` to all workflow YAML files so jobs can be manually triggered with 1 click anytime. |
| **3. Upstream API Limits** | Steam/IGDB/ProtonDB rate limits when scraping inside GitHub Actions. | Implement batching and sleep delays (`await sleep(500)`) in ingestion scripts to stay well under upstream limits. |
| **4. Accidental Secret Leak** | Pushing API keys or database tokens to public repository. | Rely exclusively on process environment variables (`process.env.TURSO_AUTH_TOKEN`) and run pre-commit git secret audits. |

---

## 5. Verification & Deliverables

1. `OPEN_CORE_STRATEGY.md` updated with finalized license decisions.
2. `planning/OPEN_CORE_AND_CLOUDFLARE_PLAN.md` — Full implementation plan (see this file for phase-by-phase detail).
3. `LICENSE` — MIT license file at repo root (to be created in Phase 2).
4. `DATA_LICENSE.md` — Three-layer data license document: ODbL 1.0 (catalog) + Proprietary (Scare Meter, tags) + Third-party notice (to be created in Phase 2).
5. `.github/workflows/daily-price-updates.yml` — Automated cron workflow (to be created in Phase 3/7).
6. Updated `README.md` — Correctly references MIT (code), ODbL (database), and proprietary (Scare Meter/tags) layers.

