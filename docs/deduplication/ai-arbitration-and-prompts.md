# AI Arbitration & Exact Prompts

This document details how Gemini 2.5 Flash is used to arbitrate complex catalog edge cases, the exact prompts used, and the error-handling mechanisms in place.

---

## Why Use AI for Catalog Arbitration?

Rule-based engines excel at exact matching and string stripping, but video game cataloging frequently presents historical nuances that deterministic algorithms cannot reliably resolve on their own:
- **Studio Rebranding**: Was *Visceral Games* a different company from *EA Redwood Shores*, or did the same team make the same game?
- **Fan Ports**: Is a 2017 PSP version of *Doki Doki Literature Club!* an official multi-platform release or an unofficial homebrew project?
- **Scraper Incompleteness**: Did a scraper crash halfway through, creating a duplicate record with missing summary and release year?

Rather than guessing or writing thousands of manual regex rules, ambiguous candidates (Pool C) are sent to **Gemini 2.5 Flash**.

---

## The Exact Prompt Template

Each call provides the model with the catalog candidate group and the 5-Point Rubric instructions.

```text
You are a master video game historian and catalog curator.
Your task is to analyze each group of games with matching/similar titles and determine if any of the listings represent the EXACT same video game release that should be merged, OR if they are DISTINCT games that must remain separate.

5-POINT VERIFICATION RUBRIC:
1. Studio Pedigree: Check if developers are the same, or if a studio rebranded (e.g. EA Redwood Shores became Visceral Games).
2. Generational & Platform Era: If games are from different console generations (e.g. 1990s vs 2020s, or PS2 vs PS5), or completely different engines/remakes, DO NOT merge.
3. Content Scope: Demos, Prologues, and standalone Expansion/DLCs (e.g. "Afterbirth" vs "Afterbirth+", Chapter 1 vs Full Game) MUST remain separate.
4. Homonyms: Independent indie games that merely share a common name (e.g. "Inside" 2012 by 9ine vs "Inside" 2016 by Playdead) MUST remain separate.
5. Storefront & Scraper Duplicates: Incomplete duplicate scraper entries or dual-language uploads by the same creator CAN be merged into the richer primary listing.

CANDIDATE GROUPS:
[
  {
    "id": 1,
    "title": "Dead Space (2008)",
    "games": [
      {
        "id": "cm0...",
        "slug": "dead-space",
        "title": "Dead Space (2008)",
        "developer": "Visceral Games",
        "year": 2008,
        "platforms": "PlayStation 3, PC (Microsoft Windows), Xbox 360",
        "summary": "Isaac Clarke is an engineer on a spacecraft..."
      },
      {
        "id": "cm1...",
        "slug": "dead-space-2008",
        "title": "Dead Space (2008)",
        "developer": "EA Redwood Shores",
        "year": 2008,
        "platforms": "PlayStation 3, PC (Microsoft Windows), Xbox 360",
        "summary": "Isaac Clarke is an engineer on a spacecraft..."
      }
    ]
  }
]

Respond with ONLY a valid JSON array of objects with the exact schema:
[
  {
    "id": 1,
    "title": "Title",
    "shouldMerge": true,
    "primarySlug": "slug of the richer game to keep, or null if shouldMerge is false",
    "mergeSlug": "slug of the redundant duplicate game to merge, or null if shouldMerge is false",
    "reason": "Clear 1-sentence historical rationale"
  }
]
```

---

## Resiliency & Error Handling

When querying cloud AI APIs at scale, transient spikes in demand (HTTP 503) or rate limits (HTTP 429) can occur. The arbitration pipeline incorporates automatic retry logic:

```typescript
let success = false;
let attempts = 0;
const maxAttempts = 5;

while (!success && attempts < maxAttempts) {
  attempts++;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const raw = response.text || "";
    const jsonMatch = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) throw new Error("Failed to parse JSON");

    const verdicts = JSON.parse(jsonMatch[0]);
    newVerdicts.push(...verdicts);
    success = true;
  } catch (err: any) {
    if (attempts < maxAttempts) {
      // Exponential backoff: 3s, 6s, 12s, 24s
      const waitTime = Math.pow(2, attempts) * 1500;
      await sleep(waitTime);
    } else {
      console.error("Exhausted retries for this batch.");
    }
  }
}
```

---

## Real Decision Case Studies from the Logs

### Case Study 1: Studio Rebranding Detected
- **Game**: *Dead Space (2008)*
- **Candidates**: `dead-space` (Visceral Games) vs `dead-space-2008` (EA Redwood Shores)
- **Decision**: `shouldMerge: true`
- **Primary**: `dead-space` | **Merge**: `dead-space-2008`
- **Gemini Reason**: *"Both entries refer to the original Dead Space (2008), with the differing developer names (EA Redwood Shores vs Visceral Games) reflecting a known studio rebranding, and the identical summaries indicate they are the exact same game that can be merged per Studio Pedigree rules."*

### Case Study 2: Expansion Protected from Over-Merging
- **Game**: *The Binding of Isaac: Afterbirth* vs *Afterbirth+*
- **Candidates**: `the-binding-of-isaac-afterbirth` vs `the-binding-of-isaac-afterbirth-plus`
- **Decision**: `shouldMerge: false`
- **Gemini Reason**: *"The Binding of Isaac: Afterbirth+ is a distinct, content-rich expansion to Afterbirth, not merely a re-release or duplicate, and as such should remain a separate catalog entry per Content Scope rules."*

### Case Study 3: Fan Homebrew Port Isolated
- **Game**: *Doki Doki Literature Club!*
- **Candidates**: Official PC Team Salvato release vs PlayStation Portable entry
- **Decision**: `shouldMerge: false`
- **Gemini Reason**: *"The second listing is an unofficial fan-made port for the PlayStation Portable, making it a distinct release on an entirely different and older platform from the original game developed by Team Salvato, thus must remain separate per Generational & Platform Era rules."*

### Case Study 4: 3DS Original vs HD Remaster Isolated
- **Game**: *Resident Evil: Revelations*
- **Candidates**: 2012 Nintendo 3DS entry vs 2013 Multi-Platform PC/Console entry
- **Decision**: `shouldMerge: false`
- **Gemini Reason**: *"These are distinct releases; the 2012 Nintendo 3DS original and the 2013 multi-platform HD remaster are separate entries due to generational and content differences."*

### Case Study 5: Duplicate Unreal Engine Remake Scraper Runs
- **Game**: *Layers of Fear (2023)*
- **Candidates**: `layers-of-fear--1` vs `layers-of-fear--2`
- **Decision**: `shouldMerge: true`
- **Primary**: `layers-of-fear--2` | **Merge**: `layers-of-fear--1`
- **Gemini Reason**: *"These are duplicate entries for the same 2023 remake of Layers of Fear, developed by the same studios, with one entry providing a more detailed summary."*
