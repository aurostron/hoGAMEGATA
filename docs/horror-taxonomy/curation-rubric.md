# Gamegata Curation Rubric & Decision Rules

> The objective standard used by human curators, automated scrapers, and local AI arbiters to determine whether a game is accepted into the catalog or hidden as noise.

---

## 1. The Core Dilemma: Why Tags Lie

On modern digital storefronts (Steam, itch.io, Epic Games, GOG), tags are applied by developers looking for visibility or by community members making jokes.

This leads to three major types of tag distortion:
1. **The Clickbait Tag:** An itch.io creator tags a basic 2D platformer with `#horror` simply because horror is one of the most clicked categories on the platform.
2. **The Ironic Tag:** Steam users tag a bright dating sim or a notoriously stressful competitive shooter with "Psychological Horror" as a meme.
3. **The Cosmetic Reskin:** An arcade pinball table or racing game licenses Dracula or a slasher villain, slap on some dark textures, and claims the horror genre without offering an ounce of tension or dread.

Gamegata does not blindly trust user-submitted tags. Every game in the catalog is tested against a rigorous **5-Point Curatorial Test**.

---

## 2. The 5-Point Curatorial Test

To determine whether a game belongs in Gamegata, curators evaluate five foundational criteria:

```
                  ┌─────────────────────────────────────┐
                  │      5-POINT CURATORIAL TEST        │
                  ├─────────────────────────────────────┤
                  │ 1. Primary Affective Intent         │
                  │ 2. Mechanical Vulnerability         │
                  │ 3. Audio-Visual Worldbuilding       │
                  │ 4. Thematic & Narrative Gravity     │
                  │ 5. Community Consensus (Ground Truth)│
                  └─────────────────────────────────────┘
```

### Criterion 1: Primary Affective Intent
*Does the game deliberately engineer negative emotional resonance (fear, anxiety, shock, dread, grief, or disgust)?*
- **Pass:** The game's atmosphere, pacing, and mechanics are designed to put the player on edge.
- **Fail:** The game's intent is lighthearted fun, relaxed puzzle solving, or competitive reflex tests, with scary elements treated merely as decorative wallpaper.

### Criterion 2: Mechanical Vulnerability vs. Agency
*Does the player experience risk, limitation, or loss of control?*
- **Pass:** The player deals with scarce ammo, fragile health, low visibility, unpredictable adversaries, or narrative helplessness. Even in action-heavy horror (like *Dead Space*), combat is stressful, high-stakes, and disorienting.
- **Fail:** The player is an all-powerful juggernaut mowing down cannon fodder without tension, resource management, or consequence.

### Criterion 3: Audio-Visual Worldbuilding & Atmosphere
*Does the world feel oppressive, eerie, liminal, or grotesque?*
- **Pass:** Ambient sound design, silence, shadows, industrial decay, uncanny proportions, or visceral creature designs establish a sustained sense of place.
- **Fail:** Clean, bright, cheerful aesthetic with zero intent to unsettle or unnerve.

### Criterion 4: Thematic & Narrative Gravity
*Does the story grapple with dark, psychological, macabre, or taboo realities?*
- **Pass:** Themes of mortality, madness, biological mutation, haunting guilt, cosmic insignificance, or supernatural persecution.
- **Fail:** Trivial or slapstick narrative where spooky characters are friendly cartoon caricatures (e.g. standard Halloween party games).

### Criterion 5: Community Consensus (Ground Truth)
*How do real players describe the actual gameplay on Reddit, Steam reviews, and forums?*
- We harvest real player discussions across `r/horrorgaming`, `r/creepygaming`, `r/patientgamers`, and dedicated game communities.
- If real players discuss feeling genuine tension, needing breaks to calm down, analyzing dark lore, or praising the scare design, the game passes.

---

## 3. Classification Standards

### Class A: Pure Horror (Approved — Keep)
A game is classified as **Pure Horror** when the delivery of fear and vulnerability is the foundation of the design.

**Key Indicators:**
- Stripping away the fear or horror would leave the game hollow or completely unplayable.
- Mechanics emphasize survival over conquest: hiding, running, managing flashlights, solving puzzles under duress, or navigating oppressive environments.
- Sound design relies on silence, distorted frequencies, heavy breathing, and directional footsteps.

**Real Catalog Examples:**
- *Silent Hill 2* (Psychological grief and sexual guilt manifesting as foggy town abominations)
- *Amnesia: The Dark Descent* (Sanity mechanics, defenseless hiding, creeping audio dread)
- *Faith: The Unholy Trinity* (Lo-fi 8-bit rotoscoped religious exorcism terror)
- *Cry of Fear* (First-person psychological isolation and mental decay in cold urban Stockholm)
- *Iron Lung* (Blind navigation in a rusted submarine through a claustrophobic ocean of blood)

---

### Class B: Horror-Adjacent (Approved — Keep)
A game is classified as **Horror-Adjacent** when it contains unmistakable horror DNA, dark themes, and intense dread, but balances them with non-horror gameplay loops (action combat, RPG character builds, detective mysteries, or surreal satire).

**The Golden Rule for Action-Horror:**
> *Never reject a game simply because the player holds a gun or swings a sword.*

If an action game features visceral body horror, terrifying creature stalkers, oppressive basements, or psychological trauma, it belongs in Gamegata as horror-adjacent.

**Real Catalog Examples:**
- *Bloodborne*: A masterpiece of Victorian gothic architecture descending into cosmic Lovecraftian body horror, insight-induced madness, and terrifying beast hunts.
- *The Last of Us Part II*: A post-apocalyptic survival drama featuring some of the most terrifying body horror encounters in modern gaming (e.g., the multi-human grafted Rat King), pitch-black spore basements, and panic-inducing stalker stealth.
- *Signalis*: A classic survival horror love letter featuring retro PS1 aesthetics, inventory micro-management, and cosmic android dread, balanced with top-down shooter combat.
- *The Binding of Isaac: Repentance*: A fast-paced arcade roguelike, but deeply saturated in grotesque body horror, religious blasphemy, child trauma, and existential disgust.
- *Castlevania: Symphony of the Night*: Action-platforming exploration wrapped entirely in classic Bram Stoker gothic horror, occult iconography, and macabre mythology.
- *The House in Fata Morgana*: A gothic visual novel dealing with multi-century tragedy, betrayal, psychological torment, and madness in a cursed mansion.

---

### Class C: Non-Horror / Noise (Rejected — Soft-Hide)
A game is classified as **Non-Horror** and removed from active discovery when it fails the 5-point test.

**Categories of Removed Noise:**
1. **Superficial Skinning / Arcade Games:**
   - *Example:* *Pinball M*. While themed around horror movie licenses (Chucky, Dead by Daylight), the gameplay is standard pinball physics with zero survival elements, fear mechanics, or atmospheric tension.
2. **Joke & Meme Uploads:**
   - *Example:* *Unity Runtime Fee Calculator*, *mr beast calculator*. Software tagged "Horror" as an ironic political commentary on game industry pricing or internet memes.
3. **Non-Game Audio & Asset Packs:**
   - *Example:* *The Doll SFX Pack*, *OLD CLOCK Sfx pack*, standalone original soundtrack albums (OSTs). These are developer production tools, not playable interactive games.
4. **Developer Test Scripts:**
   - *Example:* *Resident Evil Game Engine Test*. A simple room demo testing camera clipping, not a completed narrative or game experience.
5. **Completely Unrelated Genres:**
   - Casual match-3 puzzles, realistic football/cricket sports games, or plain driving simulators that had accidental or bogus tags assigned during data scrapes.

---

## 4. How Soft-Hiding Works (Zero Data Loss)

Gamegata enforces a strict database safety standard: **We never execute hard SQL deletes.**

When a game is rejected:
1. Its database row in TursoDB is updated to `status = 'hidden'`.
2. The reason for removal is logged to `scripts/horror-audit/data/pass2_hidden_log.json`.
3. The game is excluded from `public/search-index.json` so regular users never see it in searches or catalog queries.
4. The record remains fully preserved in the database. If a developer or curator reviews the game later, it can be instantly restored to `status = 'released'` in seconds using our automated rollback scripts.
