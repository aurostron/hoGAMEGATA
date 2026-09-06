# hoGAMEGATA Open-Core Architecture

hoGAMEGATA operates as an open-core digital preservation project maintained by an independent developer under the pseudonym aurostron.

The project publishes its core application software, data models, and development tooling under permissive open-source terms, while reserving rights to its proprietary analytical ratings, taxonomies, and production infrastructure.

---

## Component Separation

The repository is structured to separate application logic from private production data:

### 1. Open Source Layer (MIT License)
The codebase that runs the discovery platform is publicly available under the MIT License:
* Astro server-rendered pages and API endpoints (`src/pages/`)
* Interactive React islands and search interfaces (`src/components/`)
* Drizzle ORM schema definitions and migration templates (`src/db/`)
* Search DSL filters and client indexing logic (`src/workers/`, `src/lib/`)
* Ingestion pipelines, storefront synchronization scripts, and sitemap utilities (`scripts/`)
* Continuous integration workflows (`.github/workflows/`)

### 2. Open Data Layer (ODbL 1.0)
The aggregated relational catalog metadata—including game titles, platform releases, studio relationships, and general genre classifications—is published under the Open Database License (ODbL) v1.0.

* **Attribution Requirement**: Anyone utilizing extracts or queries from the database in a public project must credit hoGAMEGATA.
* **Derivative Databases**: Derived databases must be shared under ODbL 1.0.
* **Application Exception**: Developers building standalone applications, widgets, or tools that merely query or visualize this data (Produced Works under ODbL Section 4.4) are not required to open-source their own software.

### 3. Proprietary Layer (All Rights Reserved)
The following original assets form hoGAMEGATA's analytical moat and are not licensed under any open terms:
* **The Scare Meter Rating Engine**: Mathematical formulations, intensity factor weightings, and computed numerical scores.
* **Horror Micro-Tag Taxonomy**: The 15,800+ micro-genre classifications, mood detection heuristics, and keyword relationship matrices.
* **Branding and Identity**: Project naming, logos, custom typography, and editorial graphics.
* **User Accounts and Sync Data**: All user profiles, backlogs, and private dashboard lists.

### 4. Private Operational Infrastructure
Production secrets and deployment configurations are strictly separated from source control:
* Production Turso database connection strings and authorization tokens
* Cloudflare Workers account bindings, route mappings, and KV namespace identifiers
* Third-party service credentials (transactional email, OAuth client secrets, CAPTCHA secret keys)

---

## Frequently Asked Questions

### Can I fork this repository and run my own copy?
Yes. The entire application frontend and schema are MIT licensed. You can clone the repository, provide your own database credentials or use local SQLite storage, and run the service independently.

### Can I use hoGAMEGATA's data in my own application?
Yes, under the terms of ODbL 1.0. You must display the required attribution statement. If you modify or extend the database compilation itself and redistribute it, that derivative database must also be licensed under ODbL 1.0.

### Can I scrape or redistribute Scare Meter ratings?
No. Scare Meter ratings and the 15,800+ horror micro-tag hierarchy are proprietary editorial works and may not be extracted, mirrored, or redistributed without written authorization.

### How do external contributors test changes locally?
Contributors do not need access to the production Turso database. The project includes local SQLite configurations and sample seed datasets so that changes to UI, components, and search algorithms can be developed and validated completely offline.
