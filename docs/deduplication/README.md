# Video Game Catalog Deduplication System

## Overview

When building a large catalog of over 108,000 video games from multiple sources (such as Steam, GOG, itch.io, and IGDB), the same game frequently appears more than once under slightly different names, formatting, or storefront URLs.

At the same time, video games have unique challenges that make automated deduplication tricky:
- **Remakes are separate games**: The 2001 *Silent Hill 2* on PS2 and the 2024 *Silent Hill 2* on Unreal Engine 5 are distinct releases with different engines, assets, and achievements. They must not be merged.
- **Expansions look like duplicates**: *The Binding of Isaac: Afterbirth* and *Afterbirth+* share 95% of their titles, but *Afterbirth+* is a distinct expansion with unique content.
- **Common indie names collide**: Independent creators on itch.io frequently publish unrelated games called "Inside", "Siren Head", or "Obsession". Merging them based on name alone corrupts the catalog.

To solve this, Gamegata uses a two-pass hybrid deduplication system combining:
1. **Deterministic Rule Engine**: High-speed normalization of punctuation, symbols, and storefront URLs.
2. **5-Point Historical Rubric**: Structural rules that automatically protect remakes, homonyms, and distinct console generations.
3. **AI Arbitration with Gemini 2.5 Flash**: Contextual evaluation of edge cases (such as studio rebranding, scraper formatting bugs, and fan ports).
4. **Golden Record Unification**: Consolidating multiple store links (Steam, GOG, itch.io) onto a single primary entry to unlock platform badges like **DRM-Free** and **itch.io** without losing data.

---

## Catalog Results Summary

Across two execution passes, the system processed all candidate clusters, protected thousands of distinct releases, and consolidated verified duplicate listings:

| Metric | Pass 1 | Pass 2 (Punctuation & Symbols) | Combined Total |
| :--- | :---: | :---: | :---: |
| **Initial Catalog Size** | 107,859 | 107,631 | 107,859 |
| **Candidate Games Scanned** | 11,576 | 13,327 | 13,327 |
| **Clusters Merged** | 214 | 60 | **274 clusters** |
| **Duplicate Games Soft-Hidden** | 228 | 64 | **292 duplicates** |
| **Final Active Catalog** | 107,631 | 107,567 | **107,567 games** |
| **False Positives Detected** | 0 | 0 | **0** |
| **Remakes Kept Intact** | 100% | 100% | **100%** |

---

## Documentation Guide

- [**The End-to-End Workflow**](./workflow.md): Step-by-step breakdown from database scanning to safety snapshots, pool classification, AI review, and search index rebuilds.
- [**Algorithms & Examination Factors**](./algorithms-and-rules.md): The normalization rules, storefront AppID extraction, and the 5-point verification rubric.
- [**AI Arbitration & Exact Prompts**](./ai-arbitration-and-prompts.md): The exact prompts sent to Gemini 2.5 Flash, the response schemas, retry logic, and real case studies.
- [**Database Architecture & Rollback**](./database-operations.md): The Golden Record pattern, atomic SQL batching, soft-hiding vs. hard deletes, and rollback capabilities.
