# hoGAMEGATA Usage Metrics & Infrastructure Sizing

This document details the catalog scale, operational traffic patterns, and storage projections for the hoGAMEGATA platform. These figures serve as the technical basis for the Cloudflare Project Alexandria sponsorship application.

---

## 1. Verified Catalog Scale

Data verified against the live production database:

| Metric | Measured Value | Description |
|---|---|---|
| **Total Catalog Games** | **107,915** | Indexed horror titles spanning 1980 to present |
| **Playable / Released Games** | 106,875 | Non-upcoming, verified horror releases |
| **Independent / Undated Releases** | 89,168 | Obscure indie and freeware titles (e.g. itch.io, archive.org) |
| **Commercial Storefront Releases** | 18,747 | Documented commercial releases with verified release dates |
| **Developers & Studios** | 68,034 | Independent creators, studios, and development teams |
| **Store Purchase Links** | 111,168 | Storefront referral paths (Steam, GOG, itch.io, Epic) |
| **Price History Snapshots** | 104,310 | Historical price records for discount tracking |
| **Horror Tags & Classifications** | 15,825 | Atmosphere, sub-genre, and mechanical tags |
| **Instant Client Search Index** | 107,810 records | Pre-indexed MiniSearch JSON bundle (`public/search-index.json`) |

---

## 2. Current Traffic & Compute Utilization

| Component | Target / Current Level | Notes |
|---|---|---|
| **Monthly Unique Visitors** | 15,000 – 25,000 | Organic discovery and community referrals |
| **Monthly Page Views** | 90,000 – 140,000 | High catalog browsing depth per session |
| **Cloudflare Workers Requests** | ~45,000 – 75,000 / day | Average baseline on Cloudflare Workers |
| **Peak Event Traffic** | Up to 120,000 / day | Seasonal spikes during Halloween, Steam Scream Fest, and game jams |
| **Edge Cache Hit Ratio** | > 88% | Static assets and cached catalog index queries |
| **Workers Active CPU Time** | 2.5 ms – 6.8 ms / request | Well within the 10 ms active execution ceiling |

---

## 3. Cloudflare R2 Media Storage Architecture

Currently, the platform relies on remote third-party image URLs (IGDB, itch.io CDN). For delisted, obscure, or independent games, external image links frequently break or rot over time.

To guarantee permanent preservation, hoGAMEGATA is preparing to ingest and archive game media into a dedicated Cloudflare R2 bucket (`hogamegata-media`).

### Sizing Model

* **Estimated Images per Game**: 3 assets (1 primary vertical box cover, 1 horizontal banner, 1 gameplay screenshot)
* **Total Image Count**: $107,915 \times 3 \approx 323,745$ image objects
* **Optimized Image Format**: WebP / AVIF normalized to an average size of **150 KB**
* **Initial Storage Footprint**:
  $$\text{Initial Storage} = 323,745 \times 150\text{ KB} \approx 48.56\text{ GB}$$
* **Annual Catalog Growth**: ~8,000 – 10,000 new indie horror releases per year
  $$\text{Annual Growth} = 10,000 \times 3 \times 150\text{ KB} \approx 4.5\text{ GB / year}$$

### Operations and Egress Projections

* **Egress Fees**: **$0.00** (Cloudflare R2 provides free egress).
* **Class A Ingestion Operations (Writes)**:
  * One-time catalog ingestion: ~324,000 writes.
  * Ongoing monthly ingestion: ~2,500 new games/updates ($7,500$ writes/month).
  * Well within the 1,000,000 Class A operations/month free tier.
* **Class B Operations (Reads)**:
  * Media delivery utilizes Cloudflare CDN edge caching with:
    ```http
    Cache-Control: public, max-age=31536000, immutable
    ```
  * With an estimated edge cache hit rate of $\ge 95\%$, only 5% of media requests touch R2 storage directly.
  * Monthly Class B operations are projected at **1.2M – 2.0M reads/month**, staying well within the 10,000,000 free operations/month allowance.

### Storage Tiering Optimization

* **Active Tier (Standard R2)**: Trending, popular, and recently released titles (~20% of catalog, $\approx 10\text{ GB}$).
* **Cold Preservation Tier (R2 Infrequent Access)**: Long-tail and delisted indie archives ($\approx 38.5\text{ GB}$ at $0.01/GB-month).

---

## 4. Cloudflare Sponsorship Request (Project Alexandria)

Under retail pricing, hoGAMEGATA's architecture is already exceptionally efficient (R2 storage would cost less than $1.00/month, and Workers Free handles normal baseline traffic).

However, sponsorship under **Project Alexandria** is requested for two operational reasons:

1. **Seasonal Traffic Headroom**:
   During the October horror season and major gaming festivals, daily traffic surges exceed 100,000 requests/day, hitting the ceiling of the Cloudflare Workers Free tier. Alexandria sponsorship ensures the public preservation catalog remains accessible without rate limiting or outages during peak discovery periods.
2. **Dedicated Preservation R2 Allocation**:
   A dedicated R2 storage allocation with guaranteed retention allows hoGAMEGATA to complete the first-party image archival pipeline, securing game art for 89,000+ indie games that risk becoming link-rotted on third-party hosts.
3. **Advanced Bot Protection & Zero Trust**:
   Integration of Cloudflare Bot Management and Zero Trust Access to protect administrative and ingestion API endpoints from automated harvesting.
