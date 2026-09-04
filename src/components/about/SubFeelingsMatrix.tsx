import React, { useState } from 'react';

interface SubFeeling {
  name: string;
  definition: string;
  biologicalRoot: string;
  examples: string[];
}

interface Realm {
  id: string;
  title: string;
  summary: string;
  feelings: SubFeeling[];
}

const realms: Realm[] = [
  {
    id: "spatial",
    title: "1. Spatial & Atmospheric Dread",
    summary: "Fear triggered by the geometry of your environment—darkness, endless voids, tight spaces, and confusing acoustics.",
    feelings: [
      {
        name: "Slow-Burn Dread",
        definition: "The heavy certainty that something terrible is coming, combined with zero idea when or where it will strike.",
        biologicalRoot: "Predator vigilance—staying on high alert while navigating tall grass where hunters hide.",
        examples: ["Silent Hill 2", "Amnesia: The Dark Descent", "PT"]
      },
      {
        name: "Liminal Disorientation",
        definition: "The unease of being trapped in transitional spaces that should have people (hallways, offices, transit hubs), but are dead empty.",
        biologicalRoot: "Navigational panic when your brain loses spatial landmarks and repeats patterns endlessly.",
        examples: ["The Complex: Found Footage", "Anemoiapolis", "Superliminal"]
      },
      {
        name: "Claustrophobia & Entombment",
        definition: "The suffocating fear of being trapped in a tight, narrow space where movement is restricted and air is running out.",
        biologicalRoot: "Primal survival instinct against cave-ins, collapsed burrows, and suffocation.",
        examples: ["Iron Lung", "Amnesia: The Bunker", "Alien: Isolation (ducts)"]
      },
      {
        name: "Thalassophobia",
        definition: "The dread of deep, murky open water—realizing an endless black void exists beneath your feet with things swimming in it.",
        biologicalRoot: "Terrestrial helplessness. Humans have zero mobility, zero visibility, and no ground to stand on in deep water.",
        examples: ["Subnautica", "SOMA (Abyss)", "Sunless Sea", "Barotrauma"]
      },
      {
        name: "Acoustic Pareidolia",
        definition: "When your brain mistakes harmless background sounds (wind, pipes creaking, wood settling) for footsteps, breathing, or voices.",
        biologicalRoot: "Acoustic survival bias. Believing the wind is a tiger is harmless; believing a tiger is just wind is fatal.",
        examples: ["Darkwood", "Hellblade: Senua's Sacrifice", "Phasmophobia"]
      }
    ]
  },
  {
    id: "uncanny",
    title: "2. The Uncanny & Cognitive Shock",
    summary: "Horror born from things that look, sound, or act almost human, but are corrupted, fake, or broken.",
    feelings: [
      {
        name: "The Uncanny Valley",
        definition: "A sudden recoil from something that looks almost human, but has dead eyes, stiff movement, or an unnatural smile.",
        biologicalRoot: "Disease and corpse avoidance. Ancient warnings against corpses, rabies, or contagious neurological illness.",
        examples: ["Condemned: Criminal Origins", "Little Nightmares", "Signalis"]
      },
      {
        name: "Analog Decay & Corrupted Media",
        definition: "Dread carried through degraded VHS tape static, distorted audio tapes, emergency broadcasts, and glitched CRT screens.",
        biologicalRoot: "Sensory signal corruption. When communication channels fail, our brain senses an invisible threat nearby.",
        examples: ["Signalis", "Fears to Fathom", "The Mortuary Assistant", "No Players Online"]
      },
      {
        name: "Masquerade of Innocence",
        definition: "Childhood comfort objects—mascots, toys, nursery rhymes, theme parks—twisted into predatory monsters.",
        biologicalRoot: "Violation of safe harbor. Corrupting environments meant for protection shatters basic security instincts.",
        examples: ["Five Nights at Freddy's", "Poppy Playtime", "Doki Doki Literature Club!"]
      },
      {
        name: "Perceptual Gaslighting",
        definition: "When the game deliberately tricks you into doubting your own senses, memory, or sanity through subtle changes.",
        biologicalRoot: "Cognitive breakdown. The terror of knowing your internal senses cannot be trusted.",
        examples: ["Eternal Darkness", "Silent Hill 4: The Room", "Milk inside a bag of milk"]
      }
    ]
  },
  {
    id: "biological",
    title: "3. Biological & Visceral Revulsion",
    summary: "Reflexive disgust and horror triggered by physical mutilation, infection, and the breakdown of the human body.",
    feelings: [
      {
        name: "Body Betrayal & Mutation",
        definition: "The horror of the human form mutating against its will—flesh tearing, bone growth, and uncontrollable biological distortion.",
        biologicalRoot: "Somatic integrity defense. Primal panic at physical deformity and cellular corruption.",
        examples: ["Dead Space", "Resident Evil 2 (Birkin)", "The Last of Us Part II (Rat King)", "Scorn"]
      },
      {
        name: "Parasitic Violation",
        definition: "The skin-crawling panic of foreign organisms burrowing under your skin, taking over your mind, or consuming you from within.",
        biologicalRoot: "Parasite and insect evasion. Triggers immediate shuddering and frantic grooming reflexes.",
        examples: ["Resident Evil 7 (Bakers)", "Carrion", "Alien: Isolation (Facehuggers)"]
      },
      {
        name: "Motor Frailty & Sluggishness",
        definition: "The nightmare sensation of needing to run, but your legs feel like lead; needing to turn, but your body moves too slowly.",
        biologicalRoot: "Sleep paralysis and motor exhaustion in the face of an incoming predator.",
        examples: ["Classic Resident Evil (Tank Controls)", "Darkwood", "Cry of Fear"]
      }
    ]
  },
  {
    id: "existential",
    title: "4. Psychological & Existential Terror",
    summary: "Quiet dread born from insignificance, deep guilt, unbearable grief, and total isolation.",
    feelings: [
      {
        name: "Cosmic Insignificance",
        definition: "The realization that humanity is an inconsequential speck in a universe ruled by vast, cold, indifferent entities.",
        biologicalRoot: "Existential vertigo. Humans need to believe their choices matter; cosmic horror dissolves that comfort.",
        examples: ["Bloodborne", "World of Horror", "SOMA", "Call of Cthulhu"]
      },
      {
        name: "Guilt Manifestation",
        definition: "Being trapped in a personal purgatory where the monsters you fight are direct reflections of your own past crimes or repressed shame.",
        biologicalRoot: "Social shame, moral conscience, and fear of banishment from the community.",
        examples: ["Silent Hill 2", "Cry of Fear", "Omori", "The Cat Lady"]
      },
      {
        name: "Grief & Melancholic Decay",
        definition: "A slow, sorrowful dread born from bereavement, irreversible loss, and watching everything you love fade away.",
        biologicalRoot: "Mourning and social connection loss.",
        examples: ["The House in Fata Morgana", "What Remains of Edith Finch", "Signalis", "Detention"]
      },
      {
        name: "Absolute Solitude",
        definition: "The cold understanding that nobody is coming to save you. You are the last person alive in an empty bunker or dead facility.",
        biologicalRoot: "Separation from the group. In human history, being left alone in the wild meant certain death.",
        examples: ["SOMA", "Alien: Isolation", "System Shock 2", "Lone Survivor"]
      }
    ]
  },
  {
    id: "survival",
    title: "5. Survival & Adrenaline Panic",
    summary: "Urgent physical panic—running, counting bullets, hiding in lockers, and surviving sudden shocks.",
    feelings: [
      {
        name: "Stalker Pursuit Panic",
        definition: "The adrenaline spike of being relentlessly hunted by an unkillable enemy who roams freely and hears your mistakes.",
        biologicalRoot: "Apex predator chase. When fighting back is impossible and running is your only hope.",
        examples: ["Alien: Isolation (Xenomorph)", "Resident Evil 2 (Mr. X)", "Clock Tower", "Outlast"]
      },
      {
        name: "Scarcity & Inventory Agony",
        definition: "The panic of entering danger knowing you only have three bullets, no health items, and very little inventory room.",
        biologicalRoot: "Resource depletion and winter starvation panic.",
        examples: ["Resident Evil 1 & 2", "Signalis", "Tormented Souls", "Darkwood"]
      },
      {
        name: "Jump-Shock Reflex",
        definition: "An involuntary biological flinch caused by sudden loud noise and violent movement on screen.",
        biologicalRoot: "Acoustic startle reflex. A rapid physical reaction that helps animals dodge sudden attacks.",
        examples: ["Dead Space", "Outlast", "Five Nights at Freddy's"]
      }
    ]
  },
  {
    id: "relational",
    title: "6. Relational & Social Horror",
    summary: "Fear rooted in corrupted human bonds—possessive obsession, mob mentality, and cult loyalty.",
    feelings: [
      {
        name: "Obsessive Stalking (Yandere)",
        definition: "The horror of suffocating, violent romantic obsession—where an entity loves you so intensely they will harm anyone to keep you.",
        biologicalRoot: "Loss of personal autonomy and toxic entrapment.",
        examples: ["Doki Doki Literature Club!", "Misao", "You and Me and Her"]
      },
      {
        name: "Mob Paranoia & Cult Isolation",
        definition: "The dread of being an outsider in an isolated village or facility where everyone is unified under a sinister ancient ritual.",
        biologicalRoot: "Out-group hostility and xenophobia. The horror of being outnumbered in unfamiliar territory.",
        examples: ["Resident Evil 4 (El Pueblo)", "Outlast 2", "Mundaun", "Bloodborne (Central Yharnam)"]
      }
    ]
  }
];

export default function SubFeelingsMatrix() {
  const [activeRealmId, setActiveRealmId] = useState("spatial");
  const currentRealm = realms.find((r) => r.id === activeRealmId) || realms[0];

  return (
    <div className="border border-white/10 bg-[#0a0a0c] p-6 sm:p-8 space-y-6">
      <div className="space-y-2 border-b border-white/10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-white font-bold text-lg uppercase tracking-wide">
            The 21 Sub-Feelings of Horror
          </h3>
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
            Affective Index
          </span>
        </div>
        <p className="text-sm text-neutral-300">
          Horror is not just one emotion. A submarine explorer feels dread; an unarmed survivor feels panic. We classify horror into six emotional realms and twenty-one distinct registers:
        </p>
      </div>

      {/* Realm Selection Tabs */}
      <div className="flex flex-wrap gap-2">
        {realms.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveRealmId(r.id)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
              activeRealmId === r.id
                ? 'bg-white text-black border-white'
                : 'bg-black/50 text-neutral-400 border-white/10 hover:border-white/30 hover:text-white'
            }`}
          >
            {r.title.split('. ')[1]}
          </button>
        ))}
      </div>

      {/* Current Realm Header */}
      <div className="space-y-1 bg-black/40 border border-white/5 p-4">
        <h4 className="text-white font-bold text-sm uppercase tracking-wider">
          {currentRealm.title}
        </h4>
        <p className="text-neutral-300 text-xs sm:text-sm">
          {currentRealm.summary}
        </p>
      </div>

      {/* Sub-Feelings Cards Grid */}
      <div className="grid grid-cols-1 gap-4 pt-1">
        {currentRealm.feelings.map((f) => (
          <div
            key={f.name}
            className="border border-white/10 bg-[#050508] p-4 space-y-2 text-xs sm:text-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/5 pb-2">
              <span className="text-white font-bold tracking-wide">{f.name}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono text-neutral-500">Examples:</span>
                {f.examples.map((ex) => (
                  <span
                    key={ex}
                    className="text-[11px] px-1.5 py-0.5 border border-white/10 text-neutral-300"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-neutral-300 leading-relaxed">
              {f.definition}
            </p>

            <div className="pt-1 text-xs text-neutral-400 flex items-start gap-1.5">
              <span className="text-neutral-500 font-mono text-[10px] uppercase shrink-0 pt-0.5">Origin:</span>
              <span>{f.biologicalRoot}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
