"use client";

import { ExternalLink, ArrowUpRight, Mail } from "lucide-react";
import {
  SURVIVAL_HORRORS_PARTNER,
  SURVIVAL_HORRORS_GAMES,
  type SurvivalHorrorPartnerGame
} from "../data/survivalHorrorsGames";

// SimpleIcons compliant SVGs for YouTube and X / Twitter
function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function TwitterXIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function PartnerGameCard({ game }: { game: SurvivalHorrorPartnerGame }) {
  return (
    <a
      href={game.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-[#121217]/90 hover:bg-[#181820] rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all duration-200 group border border-white/[0.06] hover:border-red-500/30 hover:shadow-xl hover:shadow-red-950/20 hover:-translate-y-0.5 cursor-pointer relative"
      aria-label={`${game.title} on SurvivalHorrors.com`}
    >
      <div className="space-y-3">
        {/* Cover Artwork Container */}
        <div className="relative aspect-[3/4] w-full bg-neutral-900 rounded-xl overflow-hidden shrink-0 border border-white/[0.04]">
          <img
            src={game.coverUrl}
            alt={`${game.title} cover`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Graceful fallback to solid container if network glitch
              (e.target as HTMLElement).style.opacity = "0.7";
            }}
          />

          {/* Top Left Badge: Release Year */}
          <span className="absolute top-2 left-2 font-mono text-[9px] font-bold bg-black/80 text-red-200 border border-red-500/30 backdrop-blur-md px-1.5 py-0.5 rounded shadow">
            {game.releaseYear}
          </span>

          {/* Top Right External Link Indicator */}
          <div className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg bg-black/75 text-white/80 group-hover:bg-red-600 group-hover:text-white transition-colors duration-200 border border-white/10 shadow">
            <ExternalLink className="w-3 h-3 stroke-[2.2]" />
          </div>
        </div>

        {/* Title and Developer */}
        <div className="space-y-1">
          <h4 className="font-sans text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-red-300 transition-colors">
            {game.title}
          </h4>
          <span className="font-sans text-xs text-white/50 block font-normal truncate">
            by {game.developers || "Classic Developer"}
          </span>
        </div>
      </div>

      {/* Footer Info & Outlink */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/[0.04] font-sans text-xs shrink-0">
        <span className="text-[11px] font-mono text-white/40 truncate max-w-[55%]">
          {game.platforms.split(", ")[0]}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 group-hover:text-red-300 transition-colors">
          <span>Read Archive</span>
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </a>
  );
}

export default function SurvivalHorrorsSection() {
  const partner = SURVIVAL_HORRORS_PARTNER;

  return (
    <section id="survival-horrors" className="space-y-6 scroll-mt-24 pt-4 sm:pt-6">
      {/* ── Section Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-white/[0.08]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <a
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:opacity-90 transition-opacity"
              title="Visit SurvivalHorrors.com"
            >
              <img
                src={partner.logoUrl}
                alt="SurvivalHorrors.com"
                className="h-6 sm:h-7 w-auto object-contain brightness-110"
                loading="lazy"
              />
            </a>
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-md bg-red-950/80 text-red-300 border border-red-500/30">
              Official Collaboration
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-tight">
            SurvivalHorrors.com Collection
          </h2>
          <p className="text-xs sm:text-sm text-white/50 font-sans leading-relaxed">
            Preserving and documenting the greatest survival horror titles across gaming history.
          </p>
        </div>

        <a
          href={partner.gamesListUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start sm:self-auto font-sans text-xs font-semibold tracking-wide text-white/90 hover:text-white bg-red-950/40 hover:bg-red-900/50 px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-red-500/30 hover:border-red-500/60 shrink-0 shadow-sm"
        >
          <span>Explore Full Archive</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* ── Creator Collab Banner (Styled after official about card) ── */}
      <div className="relative bg-gradient-to-br from-[#8f0909] via-[#750707] to-[#450505] rounded-3xl p-6 sm:p-8 lg:p-9 overflow-hidden shadow-2xl border border-red-500/40">
        {/* Subtle background texture overlay */}
        <div className="absolute inset-0 bg-radial from-transparent via-black/10 to-black/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col-reverse lg:flex-row items-center lg:items-stretch justify-between gap-6 sm:gap-8">
          {/* Left Column: Mission, Bio, and Socials */}
          <div className="flex-1 flex flex-col justify-between space-y-5 text-white">
            <div className="space-y-3">
              <span className="font-mono text-xs sm:text-sm text-red-100/90 font-medium tracking-wide block">
                {partner.tagline}
              </span>

              <h3 className="text-3xl sm:text-4xl font-sans font-black tracking-tight uppercase text-white leading-tight">
                About SurvivalHorrors.com
              </h3>

              <p className="text-xs sm:text-sm text-white/95 font-sans leading-relaxed max-w-2xl">
                {partner.aboutText}
              </p>

              {/* Preservation Quote */}
              <blockquote className="border-l-2 border-white/60 pl-3.5 py-1 text-xs sm:text-sm italic text-red-100 font-sans leading-relaxed bg-black/15 rounded-r-lg max-w-2xl">
                "{partner.quote}"
                <span className="block not-italic font-bold font-mono text-[11px] text-white/80 mt-1 uppercase tracking-wider">
                  — {partner.founder}
                </span>
              </blockquote>
            </div>

            {/* Social Buttons & Direct Outlink */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={partner.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Twitter / X (@JMMREVIEW)"
                className="w-9 h-9 rounded-full bg-black hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer border border-white/20"
                aria-label="Twitter / X profile"
              >
                <TwitterXIcon className="w-4 h-4" />
              </a>

              <a
                href={partner.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube (@JMMREVIEW)"
                className="w-9 h-9 rounded-full bg-black hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer border border-white/20"
                aria-label="YouTube channel"
              >
                <YoutubeIcon className="w-4 h-4" />
              </a>

              <a
                href={`mailto:${partner.email}`}
                title={`Email (${partner.email})`}
                className="w-9 h-9 rounded-full bg-black hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 shadow-lg cursor-pointer border border-white/20"
                aria-label="Send email"
              >
                <Mail className="w-4 h-4" />
              </a>

              <a
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-sans text-xs font-bold bg-white text-black hover:bg-neutral-100 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer shadow-lg ml-auto sm:ml-2"
              >
                <span>Visit SurvivalHorrors.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Founder Framed Card */}
          <div className="w-full sm:w-auto shrink-0 flex justify-center">
            <div className="bg-black border border-white/20 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex flex-col items-center w-48 sm:w-56 transition-transform hover:scale-[1.02] duration-200">
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-neutral-900 border border-white/10">
                <img
                  src={partner.founderAvatarUrl}
                  alt={partner.founder}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="font-serif font-black text-red-600 tracking-wider text-base sm:text-lg uppercase mt-2.5">
                {partner.founder}
              </span>
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                Creator & Curator
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 17 Canonical Survival Horror Games Grid ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-white/60 px-1">
          <span>CURATED CLASSICS ({SURVIVAL_HORRORS_GAMES.length} TITLES)</span>
          <span className="text-[11px] text-red-300">Links directly to SurvivalHorrors.com</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
          {SURVIVAL_HORRORS_GAMES.map((game) => (
            <PartnerGameCard key={game.url} game={game} />
          ))}
        </div>
      </div>
    </section>
  );
}
