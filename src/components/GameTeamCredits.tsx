import React, { useState, useEffect } from "react";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  roles: string[];
  image: string | null;
  rawgSlug: string;
}

interface GameTeamCreditsProps {
  title: string;
  rawgSlug?: string | null;
}

function getRoleBadgeStyle(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("director") || r.includes("lead") || r.includes("producer") || r.includes("creator")) {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }
  if (r.includes("writer") || r.includes("story") || r.includes("narrative") || r.includes("script")) {
    return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  }
  if (r.includes("composer") || r.includes("music") || r.includes("audio") || r.includes("sound")) {
    return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  }
  if (r.includes("art") || r.includes("designer") || r.includes("graphic") || r.includes("animat")) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }
  if (r.includes("program") || r.includes("code") || r.includes("engine") || r.includes("tech")) {
    return "bg-purple-500/10 text-purple-300 border-purple-500/20";
  }
  return "bg-white/5 text-white/60 border-white/10";
}

export default function GameTeamCredits({ title, rawgSlug }: GameTeamCreditsProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCredits() {
      try {
        const params = new URLSearchParams();
        if (rawgSlug) params.set("rawgSlug", rawgSlug);
        if (title) params.set("title", title);

        const res = await fetch(`/api/game/credits?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.team && Array.isArray(data.team)) {
            setTeam(data.team);
          }
        }
      } catch (err) {
        console.error("Failed to load game credits:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCredits();
    return () => {
      isMounted = false;
    };
  }, [title, rawgSlug]);

  if (loading) {
    return null; // Silent load
  }

  if (team.length === 0) {
    return null; // Gracefully hide if game has no credits in database
  }

  const displayedTeam = expanded ? team : team.slice(0, 6);

  return (
    <section className="border-t border-white/5 pt-12 space-y-6">
      {/* Minimalist Section Header Pill */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/30 text-[12px] uppercase tracking-[0.18em] font-bold text-white/100">
          Creative Team & Credits
        </span>
        <span className="font-mono text-xs text-neutral-500">
          [{team.length} Contributors]
        </span>
      </div>

      {/* Bento-Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedTeam.map((person) => (
          <div
            key={person.id}
            className="group relative rounded-2xl border border-white/[0.08] bg-[#0e0e11] p-4 flex items-center gap-3.5 hover:bg-white/[0.02] hover:border-white/20 transition-all duration-200"
          >
            {/* Avatar / Monogram */}
            {person.image ? (
              <img
                src={person.image}
                alt={person.name}
                className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 group-hover:border-white/30 transition-colors"
                loading="lazy"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono text-sm font-bold text-white/50 shrink-0 group-hover:border-white/30 transition-colors">
                {person.name.charAt(0)}
              </div>
            )}

            {/* Person Info & Role Badge */}
            <div className="min-w-0 flex-1 space-y-1">
              <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-white transition-colors">
                {person.name}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`inline-block text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-md border ${getRoleBadgeStyle(
                    person.role
                  )}`}
                >
                  {person.role}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand / Show All Button */}
      {team.length > 6 && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            <span>{expanded ? "Show Less" : `View All ${team.length} Contributors`}</span>
            <span className="text-white/40">{expanded ? "↑" : "↓"}</span>
          </button>
        </div>
      )}
    </section>
  );
}
