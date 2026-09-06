# hoGAMEGATA

hoGAMEGATA is an open-core discovery and preservation database for horror video games. The project indexes over 107,000 horror titles, 68,000 developers, and 15,800 tags, covering commercial releases, delisted games, and independent freeware projects.

The live website is ad-free and does not require an account for searching, filtering, or viewing catalog records: [https://gamegata.xyz](https://gamegata.xyz)

---

## Architecture Overview

The web platform runs as a server-rendered application deployed to Cloudflare Workers using the Astro framework and Drizzle ORM.

```
Users
  │
  ▼
Cloudflare Edge Network
  │
  ├── Cloudflare Workers (Astro SSR)
  │     ├── Server endpoints & dynamic page rendering
  │     ├── MiniSearch client-side search index delivery
  │     └── Edge caching (KV cache & query cache)
  │
  ├── Cloudflare R2 (Planned Object Storage)
  │     └── First-party game artwork and screenshot archive
  │
  └── Turso Database (libSQL)
        └── Production catalog records, relationships, and metadata
```

---

## Open-Core Model

hoGAMEGATA publishes its application software, schema definitions, and tools under open-source licenses, while keeping production operational credentials, user data, and core editorial classification datasets private.

| Area | Status | License / Availability |
|---|---|---|
| Application Frontend (`src/`) | Open | MIT License |
| Database Schemas (`src/db/`) | Open | MIT License |
| Search DSL & Ingestion Runners (`scripts/`) | Open | MIT License |
| Curated Catalog Metadata | Open | ODbL 1.0 (Attribution & Share-Alike) |
| Scare Meter Scoring System | Private | Proprietary (All Rights Reserved) |
| Horror Micro-Tag Taxonomy (15,800+ tags) | Private | Proprietary (All Rights Reserved) |
| Production Database Credentials & User PII | Private | Internal Only |

For a complete breakdown of boundaries and legal terms, see [OPEN_CORE.md](./docs/OPEN_CORE.md) and [DATA_LICENSE.md](./DATA_LICENSE.md).

---

## Tech Stack

* **Framework**: Astro 7 (Server Output)
* **Runtime**: Cloudflare Workers via `@astrojs/cloudflare`
* **UI Components**: React 19 islands, Tailwind CSS 4, Lucide React
* **Database ORM**: Drizzle ORM (libSQL dialect)
* **Primary Database (Production)**: Turso (libSQL over HTTP)
* **Local Database (Development)**: SQLite (`file:local.db`)
* **Search Engine**: MiniSearch (client-side pre-indexed search)
* **Authentication**: Better-Auth with Cloudflare KV session support

---

## Getting Started

### Prerequisites

* Node.js 22.12.0 or higher
* npm 10 or higher

### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aurostron/hoGAMEGATA.git
   cd hoGAMEGATA
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   *Note: You do not need production Turso or Cloudflare credentials to run the local development server. The application defaults to local development mode when remote database variables are omitted.*

4. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:4321` in your browser.

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts the Astro development server at `localhost:4321` |
| `npm run build` | Generates sitemaps and runs production build for Cloudflare Workers |
| `npm run build:quick` | Builds the application bundle without regenerating sitemaps |
| `npm run preview` | Runs the compiled production build locally |
| `npm run console` | Launches the interactive developer console (`scripts/dev-tools.ts`) |
| `npm run dev-gui` | Starts the local administrative web interface |
| `npm run sync:prices` | Runs storefront price synchronizers for Steam and GOG |
| `npm run search:apply` | Applies client-side search cache updates |

For details on all automated workflows and utilities, see [`scripts/README.md`](./scripts/README.md).

---

## Contributing

Contributions to user interface components, accessibility, client-side search logic, and documentation are welcome.

Please read our [Contributing Guide](./CONTRIBUTING.md) for branch naming standards, verification requirements, and pull request workflows.

---

## Licensing

* **Application Software**: Licensed under the [MIT License](./LICENSE). Copyright (c) 2024-2026 aurostron / hoGAMEGATA.
* **Curated Database Compilations**: Licensed under the [Open Database License (ODbL) v1.0](./DATA_LICENSE.md).
* **Proprietary Assets**: The Scare Meter algorithm, intensity ratings, and horror micro-tag taxonomy are proprietary works of aurostron. All rights reserved.
* **Third-Party Game IP**: Game titles, cover artwork, and publisher metadata remain the property of their respective creators and are used under nominative fair use for historical preservation.
