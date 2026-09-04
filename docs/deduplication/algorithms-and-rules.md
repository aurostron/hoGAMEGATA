# Algorithms & Examination Factors

This document explains the algorithms, normalization logic, and validation rules used to detect duplicates while preventing false positives.

---

## 1. Title Normalization Algorithms

A standard fuzzy search (like Levenshtein distance) often fails when applied to video game titles. For example:
- *Silent Hill* vs *Silent Hill 2* has a high similarity score (90%+), but they are completely different games.
- *Quake* vs *Quake II* is an entirely different sequel.
- *The Binding of Isaac: Afterbirth* vs *Afterbirth+* only differs by a single character (`+`), but *Afterbirth+* is a major separate release.

Therefore, rather than loose fuzzy distance, the system uses **deterministic normalization passes**:

### Pass 1: Strict Normalization
Used to catch identical titles with minor spacing or casing differences:
```typescript
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
```

### Pass 2: Punctuation and Symbol Invariance
Used to catch cross-scraper variations where one source included trademarks or different punctuation:
```typescript
function normalizePunctuation(title: string): string {
  return title
    .toLowerCase()
    // Normalize unicode apostrophes and quotation marks
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    // Remove trademark and registered symbols
    .replace(/[®™©]/g, "")
    // Remove colons, dashes, hyphens, and slashes
    .replace(/[:\-–—\/_]/g, " ")
    // Remove miscellaneous punctuation
    .replace(/[!?.,;~]/g, "")
    // Collapse excess whitespace
    .trim()
    .replace(/\s+/g, " ");
}
```

### Real-world catches from Pass 2:
- `Call of Duty®: Black Ops II` ➔ `call of duty black ops ii` (matches `call-of-duty-black-ops-ii--1`)
- `Higurashi When They Cry Hou: Ch.3` vs `Hou - Ch.3` (colon vs hyphen)
- `P.A.M.E.L.A.®` ➔ `p a m e l a` (matches `pamela--1`)
- `Scooby-Doo 2: Monsters Unleashed` vs `Scooby-Doo 2 - Monsters Unleashed`

---

## 2. Storefront AppID & Creator URL Resolution

Many duplicates originate from scrapers importing the same game from different stores. To connect them safely:

### Steam App ID Matching
Extracts the unique numeric app ID:
```typescript
const steamMatch = url.match(/store\.steampowered\.com\/app\/(\d+)/i);
const steamAppId = steamMatch ? `steam:${steamMatch[1]}` : null;
```
If Game A and Game B both link to Steam App ID `472870`, they represent the same core Steam release.

### GOG Product Slug Matching
Extracts the canonical GOG product slug:
```typescript
const gogMatch = url.match(/gog\.com\/(?:[a-z]{2}\/)?game\/([a-z0-9_-]+)/i);
const gogSlug = gogMatch ? `gog:${gogMatch[1]}` : null;
```

### itch.io Creator Subdomain Isolation
On itch.io, hundreds of creators release games with common names like *Inside*, *Obsession*, or *Vacant*. To avoid merging unrelated games:
```typescript
const itchMatch = url.match(/https?:\/\/([a-zA-Z0-9_-]+)\.itch\.io\/([a-zA-Z0-9_-]+)/i);
const creatorSubdomain = itchMatch ? itchMatch[1].toLowerCase() : null;
```
If two itch.io games share the title "Inside", but Creator A is `playdead.itch.io` and Creator B is `indiedev99.itch.io`, the system locks them as distinct games in Pool B.

---

## 3. The 5-Point Examination Rubric

Every candidate group is evaluated against five criteria before any merge can take place:

### Rubric 1: Studio Pedigree
- **Rule**: Developers must match, or have a documented studio rebrand.
- **Example**: *Dead Space (2008)* listed EA Redwood Shores on one entry and Visceral Games on another. Historical verification confirmed that EA Redwood Shores rebranded to Visceral Games in 2009. **Result: MERGE.**
- **Counter-example**: *Inside* (2016 by Playdead) vs *Inside* (2012 by 9ine). Different creators. **Result: KEEP SEPARATE.**

### Rubric 2: Generational & Platform Era
- **Rule**: If games are from different console generations (e.g. 1990s vs 2020s), or use completely different game engines (remakes), they must not be merged.
- **Example**: *Silent Hill 2* (2001 PS2 Team Silent) vs *Silent Hill 2* (2024 Unreal Engine 5 Bloober Team) vs *Silent Hill 2* (2012 Hijinx HD). **Result: KEEP SEPARATE.**
- **Example**: *Castlevania II: Simon's Quest* (NES original) vs *Castlevania II* (Tiger Electronics handheld LCD). **Result: KEEP SEPARATE.**

### Rubric 3: Content Scope (Expansions, Demos, Editions)
- **Rule**: Standalone expansions, DLC packs, Chapter editions, and demos must remain independent listings.
- **The Plus (`+`) Guard**: Titles ending in `+` often signify an enhanced expansion rather than a simple variation.
- **Example**: *The Binding of Isaac: Afterbirth* vs *Afterbirth+*. *Afterbirth+* added new floors, items, bosses, and mod support. **Result: KEEP SEPARATE.**
- **Counter-example**: *The Phenomenon* (2017) vs *The Phenomenon+* (2015). Both shared the exact same developer, platform (Android), and storyline text by 2 Fly Dreams. **Result: MERGE.**

### Rubric 4: Homonym Protection
- **Rule**: Short, generic dictionary titles must never be merged based on name alone.
- **Protected titles**: *Ghosts*, *Shiver*, *Vacant*, *Echo*, *Abandoned*, *The Twins*.
- When release years, developers, and storylines differ, the entry is locked in Pool B.

### Rubric 5: Storefront & Scraper Duplicates
- **Rule**: Incomplete listings caused by scraper timing, duplicated records with `--1` slugs, or multi-store uploads from the same developer are consolidated into the richest primary entry.
- **Example**: *System Shock* (2023 remake) had two entries from different scraper passes; one had incomplete platform tags. **Result: MERGE into richer record.**
- **Example**: *Fears to Fathom: Home Alone* had a Steam listing and an itch.io listing by creator `rayll`. **Result: MERGE into Golden Record.**
