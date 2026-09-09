# hoGAMEGATA

hoGAMEGATA is an open-core discovery and preservation database for horror video games. The project indexes over 107,000 horror titles, 68,000 developers, and 15,800 tags, covering commercial releases, delisted games, and independent freeware projects.

The live website is ad-free and does not require an account for searching, filtering, or viewing catalog records: [https://gamegata.xyz](https://gamegata.xyz)

[![nFXt0F4.md.png](https://iili.io/nFXt0F4.md.png)](https://freeimage.host/i/nFXt0F4)

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
<img width="200" height="100" alt="image" src="https://github.com/user-attachments/assets/6c11e9de-62d2-441b-9063-6398a48f16f0" />
<img width="200" height="100" alt="image" src="https://github.com/user-attachments/assets/ce16df0c-90dd-4956-94ae-416dd1ec49b5" />

---

## Licensing & Open Access Model

hoGAMEGATA publishes its application software and curated test catalog under recognized open licenses:

| Component | License / Availability |
|---|---|
| Application Frontend (`src/`) | [MIT License](./LICENSE) |
| Curated Test Dataset (`data/`) | [Open Database License (ODbL) v1.0](./DATA_LICENSE.md) |
| Developer Build Tools (`scripts/`) | [MIT License](./LICENSE) |

The core web client is 100% open source. Anyone can clone, build, inspect, and contribute to the platform. Proprietary production secrets, Cloudflare tokens, and backend database credentials are strictly decoupled and never committed.

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

![Astro](https://img.shields.io/badge/astro-%232C2052.svg?style=for-the-badge&logo=astro&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-%23000000.svg?style=for-the-badge&logo=drizzle&logoColor=C5F74F)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
<img width="100" height="30" alt="Minisearch" src="https://github.com/user-attachments/assets/b5423b2a-3635-45c6-82f9-78784660f53c" />

![NodeJS](https://img.shields.io/badge/node.js-%236DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)
<img width="100" height="30" alt="Better Auth" src="https://github.com/user-attachments/assets/c9053416-b70f-48c0-9583-f4555c78e799" />



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
| `npm run setup:mock` | Seeds local SQLite (`local.db`) with 100 curated games for zero-config offline development |
| `npm run build` | Builds the production bundle and normalizes Cloudflare Worker entrypoint manifests |
| `npm run build:quick` | Fast production build without regenerating static sitemaps |
| `npm run preview` | Runs the compiled Cloudflare Worker build locally |

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

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) hoGAMEGATA
[![License: ODbL](https://img.shields.io/badge/License-ODbL-brightgreen.svg)](https://opendatacommons.org/licenses/odbl/) hoGAMEGATA's data (under Project-hGG)
