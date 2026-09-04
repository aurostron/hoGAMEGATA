# Gamegata Horror Taxonomy & Catalog Curation

> The definitive guide to how Gamegata evaluates, classifies, and curates video games across the entire spectrum of human fear.

---

## Why Gamegata Exists

Most game storefronts treat "Horror" as a blunt marketing tag. A game either gets the tag or it does not.

That binary tag fails players completely:
- It groups a slow-burn psychological descent like *Silent Hill 2* into the exact same bucket as a loud jumpscare simulator.
- It leaves out dark masterpieces like *Bloodborne*, *Castlevania*, or *The Last of Us* simply because they have deep combat systems.
- It allows meme uploads, joke calculators, sound asset packs, and standard sports titles to pollute discovery just because an uploader checked `#horror` on itch.io or Steam.

**Gamegata runs on an expansive affective philosophy:**
> *Every game that prominently displays, explores, or evokes horror—and its thousands of psychological sub-feelings—belongs in Gamegata.*

Horror is not just a monster jumping out of a closet. Horror is an emotional spectrum: creeping dread, isolation, uncanny familiarity, bodily vulnerability, cosmic insignificance, paranoia, and moral disgust. 

This documentation suite defines how our catalog works, how we distinguish pure horror from horror-adjacent titles, and how we map the psychology of fear into actionable data for players.

---

## The Three Catalog Classes

Every game audited in Gamegata falls into one of three distinct categories:

```
                                  Game Candidate
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      [ Pure Horror ]          [ Horror-Adjacent ]          [ Non-Horror ]
             │                          │                          │
      Primary goal is            Horror DNA blended        Spurious tag, meme,
     fear, dread, panic,        with action, mystery,       or non-game asset.
      and vulnerability.       RPG, or surreal themes.             │
             │                          │                          ▼
             ▼                          ▼                     [ SOFT-HIDE ]
      [ KEEP & ENRICH ]          [ KEEP & ENRICH ]         (Hidden from Catalog)
```

| Classification | Definition | Core Player Experience | Iconic Examples |
| :--- | :--- | :--- | :--- |
| **Pure Horror** | Games where generating fear, dread, helplessness, or visceral panic is the **primary design objective**. Stripping the horror elements breaks the game's identity. | High tension, resource scarcity, sensory deprivation, high player vulnerability. | *Amnesia: The Dark Descent*, *Silent Hill 2*, *Alien: Isolation*, *Outlast*, *Faith*, *Iron Lung*, *Cry of Fear*. |
| **Horror-Adjacent** | Games where horror iconography, dread, macabre themes, or psychological torment are **prominently featured**, but share equal footing with robust secondary systems (fast action, RPG progression, puzzle-solving, or dark comedy). | Atmospheric awe, dark immersion, uncanny worldbuilding, moments of intense dread punctuated by empowerment. | *Bloodborne*, *The Last of Us Part II*, *Signalis*, *The Binding of Isaac*, *Darkest Dungeon*, *Castlevania: Symphony of the Night*, *Death Stranding 2*. |
| **Non-Horror (Noise)** | Games that use horror aesthetics purely as a superficial skin (e.g. a Halloween pinball board), joke meme uploads, or non-game utility assets. | Arcade scoring, casual puzzles, sports mechanics, non-interactive sound effects, calculators. | *Pinball M* (arcade sports), *Unity Runtime Fee Calculator*, *The Doll SFX Pack*, standard educational math quizzes. |

---

## Documentation Suite Index

This guide is organized into four deep-dive sections:

1. [**Curation Rubric & Decision Rules**](./curation-rubric.md)
   - Step-by-step rules for deciding whether to **KEEP** or **HIDE** a game.
   - The 5-Point Curatorial Test.
   - Concrete case studies on boundary titles (*The Last of Us*, *Bloodborne*, *The Yellow Wallpaper*, *Bubsy 3D*).
   - How soft-hiding preserves catalog integrity with zero permanent data loss.

2. [**The Psychology of Human Fear in Video Games**](./human-fear-psychology.md)
   - The evolutionary roots of fear (fight, flight, freeze, fawn).
   - Stephen King's Tripartite Hierarchy: Terror vs. Horror vs. Revulsion.
   - The Valence-Arousal-Dominance (VAD) model in interactive gaming.
   - "Safe Fear": Why human brains seek out terror through a controller.
   - Ludonarrative tension: Agency vs. Vulnerability.

3. [**The Encyclopedia of Horror Sub-Feelings**](./sub-feelings-encyclopedia.md)
   - The comprehensive index of horror feelings and affective states.
   - Detailed breakdowns of atmospheric dread, liminal unease, body betrayal, cosmic insignificance, analog corruption, parasocial obsession, and existential grief.
   - Exact gameplay examples demonstrating each emotional register.

---

## The 7-Dimensional Scare Profile

In the Gamegata user interface, every verified horror and horror-adjacent game displays an interactive **Scare Profile** powered by seven core emotional dimensions:

```
  ┌──────────────────────────────────────────────────────────────┐
  │ SCARE PROFILE                                                │
  ├──────────────────────────────────────────────────────────────┤
  │ Dread & Atmosphere      ████████████████████░░░░░░░░   72%   │
  │ Jump Scares             ████████░░░░░░░░░░░░░░░░░░░░   28%   │
  │ Psychological Torment   ██████████████████████████░░   91%   │
  │ Gore & Visceral Shock   ████████████░░░░░░░░░░░░░░░░   45%   │
  │ Tension & Panic         ████████████████████░░░░░░░░   68%   │
  │ Uncanny & Disturbing    ████████████████████████░░░░   84%   │
  │ Isolation & Solitude    ████████████████████████████   98%   │
  └──────────────────────────────────────────────────────────────┘
```

This multidimensional metric allows a player who loves atmospheric psychological dread (*Silent Hill*, *SOMA*) to find exactly what they want, while filtering out games that rely solely on cheap auditory jump scares.
