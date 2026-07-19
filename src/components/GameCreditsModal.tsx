import React, { useState, useEffect } from "react";

interface TeamMember {
  id: number;
  name: string;
  role: string;
  roles: string[];
  image: string | null;
  rawgSlug: string;
}

interface GameCreditsModalProps {
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

export default function GameCreditsModal({ title, rawgSlug }: GameCreditsModalProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (loading || team.length === 0) {
    return null; // Gracefully hide badge if game has no credits
  }

  const filteredTeam = team.filter(
    (person) =>
      person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Hero Badge Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-white/30 text-[11px] font-mono text-neutral-300 hover:text-white transition-all cursor-pointer group"
        title="Click to view development team credits"
      >
        <span className="text-amber-400/80 group-hover:text-amber-300 transition-colors">✦</span>
        <span>Team Credits</span>
        <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] text-white/70">
          {team.length}
        </span>
      </button>

      {/* Slide-Over / Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          {/* Backdrop click dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Right Slide-Over Panel */}
          <div className="relative z-10 w-full max-w-lg bg-[#0e0e11] border-l border-white/10 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#131316]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-amber-400/80">
                  Team Credits
                </span>
                <h3 className="text-lg font-extrabold text-white leading-tight">
                  Creative Team & Credits
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-xs">
                  {title}
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* Search / Filter Input */}
            <div className="p-4 border-b border-white/5 bg-[#0e0e11]">
              <input
                type="text"
                placeholder="Filter by name or role (e.g. Director, Writer)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {/* Team Roster List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-white/5">
              {filteredTeam.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 font-mono text-xs">
                  No team members matching "{searchQuery}"
                </div>
              ) : (
                filteredTeam.map((person) => (
                  <div
                    key={person.id}
                    className="pt-3 first:pt-0 flex items-center gap-3.5 group"
                  >
                    {/* Avatar / Monogram */}
                    {person.image ? (
                      <img
                        src={person.image}
                        alt={person.name}
                        className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 group-hover:border-white/30 transition-colors"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono text-sm font-bold text-white/50 shrink-0 group-hover:border-white/30 transition-colors">
                        {person.name.charAt(0)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white/90 truncate group-hover:text-white transition-colors">
                          {person.name}
                        </h4>
                        <div className="flex flex-wrap gap-1.5 mt-1">
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
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-[#131316] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Showing {filteredTeam.length} of {team.length} members</span>
              <span>Press ESC to exit</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
