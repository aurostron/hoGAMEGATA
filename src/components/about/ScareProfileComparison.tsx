import React, { useState } from 'react';

interface GameProfile {
  title: string;
  year: number;
  developer: string;
  archetype: string;
  summary: string;
  dimensions: {
    name: string;
    score: number; // 0 to 10
    description: string;
  }[];
}

const profiles: GameProfile[] = [
  {
    title: "Amnesia: The Bunker",
    year: 2023,
    developer: "Frictional Games",
    archetype: "Unscripted Stalker & Claustrophobia",
    summary: "Trapped in a crumbling WWI bunker with a creature that responds to every sound. The generator is constantly running out of fuel.",
    dimensions: [
      { name: "Jump Scares & Shock Reflex", score: 4, description: "Minimal cheap stingers; scares come from real encounters." },
      { name: "Psychological Tension", score: 9, description: "Agonizing dread knowing the monster can emerge anywhere." },
      { name: "Visceral Revulsion", score: 5, description: "WWI trench gore and rotting corpses." },
      { name: "Environmental Claustrophobia", score: 10, description: "Suffocating, pitch-black underground tunnels." },
      { name: "Helplessness & Resource Agony", score: 9, description: "Finite fuel, scarce revolver bullets, noisy wind-up flashlight." },
      { name: "Uncanny & Surreal Dread", score: 4, description: "Grounded physical monster with unnatural speed." },
      { name: "Audio Haunting & Pareidolia", score: 10, description: "Every creak, rat, and distant rumble is a potential alert." },
    ],
  },
  {
    title: "Silent Hill 2",
    year: 2001,
    developer: "Team Silent",
    archetype: "Psychological Guilt & Surreal Dread",
    summary: "A widower searches a foggy town after receiving a letter from his deceased wife. The monsters mirror his repressed guilt.",
    dimensions: [
      { name: "Jump Scares & Shock Reflex", score: 3, description: "Rare sudden shocks; relies almost entirely on atmosphere." },
      { name: "Psychological Tension", score: 10, description: "Persistent melancholy and mental unease." },
      { name: "Visceral Revulsion", score: 6, description: "Decaying flesh, distorted mannequins, and rusted hospital rooms." },
      { name: "Environmental Claustrophobia", score: 8, description: "Dense, blinding fog outside and oppressive apartment hallways inside." },
      { name: "Helplessness & Resource Agony", score: 6, description: "Awkward combat and limited medical supplies." },
      { name: "Uncanny & Surreal Dread", score: 10, description: "Dream logic, distorted human anatomy, and disjointed dialogue." },
      { name: "Audio Haunting & Pareidolia", score: 9, description: "Akira Yamaoka's industrial static and metallic clatter." },
    ],
  },
  {
    title: "Iron Lung",
    year: 2022,
    developer: "David Szymanski",
    archetype: "Sensory Deprivation & Thalassophobia",
    summary: "You are locked inside a welded metal submarine exploring an ocean of blood on an alien moon. You can only view the outside through still camera photos.",
    dimensions: [
      { name: "Jump Scares & Shock Reflex", score: 4, description: "Long stretches of silence punctuated by jarring mechanical groans." },
      { name: "Psychological Tension", score: 10, description: "Near-total sensory deprivation and the wait for photos to develop." },
      { name: "Visceral Revulsion", score: 5, description: "Submerged in an ocean of human blood and bone fragments." },
      { name: "Environmental Claustrophobia", score: 10, description: "A one-room capsule you cannot leave, slowly buckling under pressure." },
      { name: "Helplessness & Resource Agony", score: 9, description: "Zero weapons, no direct viewports, relying entirely on coordinates." },
      { name: "Uncanny & Surreal Dread", score: 8, description: "Cosmic extinction event where stars disappeared." },
      { name: "Audio Haunting & Pareidolia", score: 10, description: "Metal groans, sonar clicks, and unseen entities brushing the hull." },
    ],
  },
  {
    title: "Resident Evil 2 (Remake)",
    year: 2019,
    developer: "Capcom",
    archetype: "Survival Resource Agony & Body Horror",
    summary: "Rookie cop and college student navigate a zombie-infested police station pursued by an unstoppable trenchcoat-wearing tyrant.",
    dimensions: [
      { name: "Jump Scares & Shock Reflex", score: 7, description: "Zombies breaking through windows, lickers dropping from ceilings." },
      { name: "Psychological Tension", score: 8, description: "Hearing heavy footsteps approaching while inventory is full." },
      { name: "Visceral Revulsion", score: 9, description: "Detailed tissue damage, dismemberment, and mutating biological tissue." },
      { name: "Environmental Claustrophobia", score: 7, description: "Narrow corridors, barricaded exits, and dark basement archives." },
      { name: "Helplessness & Resource Agony", score: 8, description: "Limited inventory slots, counting individual 9mm rounds." },
      { name: "Uncanny & Surreal Dread", score: 4, description: "Grounded biological outbreak science-fiction." },
      { name: "Audio Haunting & Pareidolia", score: 8, description: "Mr. X's thumping boots above and wet zombie groans." },
    ],
  },
  {
    title: "Signalis",
    year: 2022,
    developer: "rose-engine",
    archetype: "Cosmic Melancholy & Analog Decay",
    summary: "An android searches for her lost companion inside a brutalist mining facility consumed by illness and corrupted memories.",
    dimensions: [
      { name: "Jump Scares & Shock Reflex", score: 4, description: "Sharp audio stingers when enemies stand back up." },
      { name: "Psychological Tension", score: 8, description: "Bleak, lonely atmosphere and cryptic puzzles." },
      { name: "Visceral Revulsion", score: 6, description: "Bandaged android corpses and meat-growing walls." },
      { name: "Environmental Claustrophobia", score: 7, description: "Underground concrete bunkers and elevator shafts." },
      { name: "Helplessness & Resource Agony", score: 9, description: "Strict 6-slot inventory limit, permanent downed enemy respawns." },
      { name: "Uncanny & Surreal Dread", score: 10, description: "Eldritch radio frequencies, dream loops, and fragmented identity." },
      { name: "Audio Haunting & Pareidolia", score: 9, description: "Shortwave numbers station radio broadcasts and cassette tape hum." },
    ],
  },
];

export default function ScareProfileComparison() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const current = profiles[selectedIndex];

  return (
    <div className="border border-white/10 bg-[#0a0a0c] p-6 sm:p-8 space-y-6">
      <div className="space-y-2 border-b border-white/10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-white font-bold text-lg uppercase tracking-wide">
            7D Scare Profile
          </h3>
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
            Interactive Archetype Matrix
          </span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          <span className="text-neutral-300 font-medium">Note:</span> Horror is subjective. These scores are editorial estimates based on the game's design and commonly observed player experiences. Different players may reasonably rate the same game differently.
        </p>
        <p className="text-sm text-neutral-300 pt-1">
          Different games build fear in completely different ways. Select a title below to see how its scare profile is measured across hoGAMEGATA's seven dimensions.
        </p>
      </div>

      {/* Game Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {profiles.map((p, idx) => (
          <button
            key={p.title}
            type="button"
            onClick={() => setSelectedIndex(idx)}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
              selectedIndex === idx
                ? 'bg-white text-black border-white'
                : 'bg-black/50 text-neutral-400 border-white/10 hover:border-white/30 hover:text-white'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Selected Game Details */}
      <div className="space-y-2 bg-black/40 border border-white/5 p-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-white font-bold">{current.title}</span>
          <span className="text-neutral-500">({current.year})</span>
          <span className="text-neutral-400 font-mono text-xs">by {current.developer}</span>
          <span className="text-xs px-2 py-0.5 border border-white/20 text-neutral-300 uppercase tracking-wider ml-auto">
            {current.archetype}
          </span>
        </div>
        <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed">
          {current.summary}
        </p>
      </div>

      {/* 7 Dimensions Meter List */}
      <div className="space-y-4 pt-2">
        {current.dimensions.map((dim) => (
          <div key={dim.name} className="space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-medium">{dim.name}</span>
              <span className="font-mono text-neutral-400">{dim.score} / 10</span>
            </div>

            {/* Meter Bar */}
            <div className="w-full h-2 bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${dim.score * 10}%` }}
              />
            </div>

            <p className="text-neutral-400 text-xs leading-relaxed">
              {dim.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
