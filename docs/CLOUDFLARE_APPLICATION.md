# Cloudflare Project Alexandria Sponsorship Application

> **Target Program**: Cloudflare Project Alexandria  
> **Application URL**: https://www.cloudflare.com/lp/project-alexandria/  
> **Applicant**: aurostron / hoGAMEGATA  
> **Project URL**: https://gamegata.xyz  
> **Repository**: https://github.com/aurostron/gamegata-v1  

---

## 1. Project Overview & Mission

hoGAMEGATA is an independently operated, non-commercial digital preservation and discovery database dedicated exclusively to video games within the horror genre.

The project currently indexes **107,915 horror games**, **68,034 developers and studios**, and **15,825 micro-genre classifications**, covering commercial storefront releases, delisted retro titles, and independent freeware projects.

Unlike standard game discovery engines, hoGAMEGATA operates as a digital archive to preserve the lineage, relationships, and metadata of obscure and independent releases that would otherwise become lost to link rot and storefront delistings.

The platform is ad-free, accessible without an account, and does not sell database access or gate content behind paywalls.

---

## 2. Organization & Non-Profit Operating Status

hoGAMEGATA is operated solely on a non-profit, community-service basis by an independent software developer under the pseudonym **aurostron**.

* **Entity Status**: hoGAMEGATA is a non-commercial community initiative, not a venture-backed startup or registered commercial corporation.
* **Monetization**: Zero advertising revenue, zero paid subscriptions, and zero paywalled data access.
* **Mission Alignment**: Preserving cultural and software heritage on the open internet, directly aligning with Cloudflare's mission to help build a better Internet.

---

## 3. Open-Source Licensing Compliance

In accordance with Project Alexandria requirements, hoGAMEGATA maintains an open-source codebase under an OSI-approved license:

* **Application Code**: Licensed under the **MIT License** (`LICENSE` at repository root).
* **Curated Database**: Published under the **Open Database License (ODbL) v1.0** (`DATA_LICENSE.md`), ensuring that compiled catalog structures remain open to the public while allowing developers to create Produced Works.
* **Open Repository**: https://github.com/aurostron/gamegata-v1

---

## 4. Current Technical Infrastructure & Cloudflare Utilization

hoGAMEGATA is already built natively on the Cloudflare developer platform:

* **Edge Compute**: Deployed to **Cloudflare Workers** using the Astro framework (`@astrojs/cloudflare` SSR runtime), serving dynamic pages and API routes from edge data centers.
* **Edge Storage & Caching**: Utilizing **Cloudflare KV** for sliding-window rate limiting (`RATE_LIMIT`) and maintenance coordination (`MAINTENANCE`).
* **Bot Protection**: Utilizing **Cloudflare Turnstile** for outbound affiliate redirect verification.
* **Client Search**: Pre-indexed MiniSearch JSON bundle (`public/search-index.json`, 107,810 records) delivered over Cloudflare CDN edge caching.
* **Database Backend**: Turso (distributed libSQL over HTTP) queried directly from Cloudflare Workers isolates.

---

## 5. Resource Sizing & Specific Sponsorship Request

hoGAMEGATA requests sponsorship under Project Alexandria for the following components:

### A. Cloudflare R2 Object Storage Allocation
* **Current Limitation**: Game cover art and screenshots currently depend on external third-party CDNs (IGDB, itch.io). For delisted and independent games, these links frequently rot, threatening long-term preservation.
* **Storage Requirement**:
  * $107,915\text{ games} \times 3\text{ images} \approx 323,745\text{ image objects}$.
  * Normalized WebP/AVIF format at 150 KB average size $\approx$ **48.56 GB initial storage** (+ ~4.5 GB/year growth).
* **Request**: An allocation of **60 GB – 100 GB** in Cloudflare R2 storage to host the permanent first-party game image archive.
* **Bandwidth Efficiency**: Assets will be served with immutable edge cache headers (`Cache-Control: public, max-age=31536000, immutable`), ensuring a $\ge 95\%$ CDN cache hit rate and keeping direct R2 Class B operations minimal (1.2M – 2.0M reads/month).

### B. Cloudflare Workers Request Headroom
* **Current Baseline**: 45,000 – 75,000 requests/day.
* **Peak Surge Issue**: During seasonal events (Halloween season throughout October, Steam Scream Fest, and independent game jams), traffic surges exceed the Workers Free allowance of 100,000 requests/day.
* **Request**: Upgraded Workers request allowance to ensure the non-profit archive remains accessible during seasonal traffic spikes without rate-limiting legitimate community researchers.

### C. Zero Trust & Bot Management
* **Request**: Access to Cloudflare Bot Management or advanced WAF rules to safeguard the public catalog and APIs from abusive automated scrapers.

---

## 6. How Cloudflare Alexandria Will Be Credited

hoGAMEGATA proudly acknowledges its infrastructure partners:

* A permanent footer badge on [gamegata.xyz](https://gamegata.xyz): **"Powered by Cloudflare Workers & R2"** linking to Cloudflare.
* Dedicated recognition in the open-source repository `README.md` and `docs/ARCHITECTURE.md`.
* Case study availability highlighting high-performance Astro SSR at the edge and cost-effective digital preservation with R2.

---

## 7. Contact Information

* **Lead Maintainer**: aurostron
* **Email**: contact@gamegata.xyz
* **Repository**: https://github.com/aurostron/gamegata-v1
* **Live Service**: https://gamegata.xyz
