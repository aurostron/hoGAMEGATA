import React, { useState, useEffect } from 'react';

interface Chapter {
  id: string;
  number: string;
  label: string;
}

const chapters: Chapter[] = [
  { id: 'mission', number: '01', label: 'Archive & Mission' },
  { id: 'rubric', number: '02', label: 'Curation Rubric' },
  { id: 'psychology', number: '03', label: 'Fear Science' },
  { id: 'scare-profile', number: '04', label: '7D Scare Profile' },
  { id: 'sub-feelings', number: '05', label: '21 Sub-Feelings' },
  { id: 'faq-sources', number: '06', label: 'FAQ & Sources' },
];

export default function DocsSidebar() {
  const [activeId, setActiveId] = useState('mission');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;

      for (let i = chapters.length - 1; i >= 0; i--) {
        const el = document.getElementById(chapters[i].id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveId(chapters[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setActiveId(id);
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.scrollY - 85;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  };

  const currentChapter = chapters.find((c) => c.id === activeId) || chapters[0];

  return (
    <>
      {/* Mobile Sticky Chapter Dropdown (< lg) */}
      <div className="lg:hidden sticky top-14 sm:top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-white/10">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2 border border-white/10 bg-black/60 text-left text-xs uppercase tracking-wider text-neutral-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-neutral-500">INDEX:</span>
            <span className="font-bold text-white">
              {currentChapter.number}. {currentChapter.label}
            </span>
          </div>
          <span className="font-mono text-xs text-neutral-400">
            {mobileOpen ? '▲ CLOSE' : '▼ JUMP'}
          </span>
        </button>

        {mobileOpen && (
          <div className="mt-2 border border-white/10 bg-[#050508] p-2 space-y-1 shadow-2xl animate-in fade-in duration-150">
            {chapters.map((c) => {
              const isActive = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => scrollTo(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs uppercase tracking-wider text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white font-bold border-l-2 border-white pl-2.5'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <span className="font-mono text-[10px] text-neutral-500">{c.number}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Vertical Stack Sidebar (>= lg) */}
      <aside className="hidden lg:block w-60 xl:w-64 shrink-0 self-stretch">
        <div className="sticky top-20 sm:top-24 z-20 space-y-6 border border-white/10 bg-[#0a0a0c] p-5 text-sm shadow-xl">
          {/* Sidebar Header */}
          <div className="space-y-1 border-b border-white/10 pb-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block">
              Documentation
            </span>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">
              On This Page
            </h3>
          </div>


          {/* Navigation Links Vertical Stack */}
          <nav className="flex flex-col space-y-1">
            {chapters.map((c) => {
              const isActive = activeId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => scrollTo(c.id)}
                  className={`group flex items-center gap-2.5 px-3 py-2 text-xs uppercase tracking-wide text-left transition-all cursor-pointer border-l-2 ${
                    isActive
                      ? 'border-white text-white font-bold bg-white/5'
                      : 'border-transparent text-neutral-400 hover:text-white hover:border-white/30 hover:bg-white/[0.02]'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] transition-colors ${
                      isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
                    }`}
                  >
                    {c.number}
                  </span>
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer Meta / Quick Return */}
          <div className="pt-3 border-t border-white/10 text-[11px] text-neutral-500 flex justify-between items-center font-mono">
            <span>6 CHAPTERS</span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
            >
              ↑ Top
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
