"use client";

import ReturnButton from "@/components/ReturnButton";
import SciFiLogo from "@/components/SciFiLogo";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-white bg-black sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <SciFiLogo withLink={true} />
            <div className="flex items-center gap-2 font-mono text-[12px] tracking-widest text-white uppercase font-bold mt-1">
              <span>Horror</span>
              <span className="text-white font-black">•</span>
              <span>Game</span>
              <span className="text-white font-black">•</span>
              <span>Mega</span>
              <span className="text-white font-black">•</span>
              <span>Metadata</span>
            </div>
          </div>
          <div>
            <ReturnButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6 my-12">
        <div className="max-w-3xl w-full border-4 border-white bg-[#08080a] p-8 md:p-12 shadow-[8px_8px_0px_0px_#ffffff] flex flex-col gap-8 relative overflow-hidden">
          <div className="flex flex-col gap-2 pb-4 border-b border-white/10">
            <h1 className="font-sans font-black text-4xl sm:text-5xl uppercase tracking-tighter leading-none text-[#f3f4f6]">
              LEGAL NOTICE
            </h1>
            <span className="font-mono text-xs text-white/50 uppercase tracking-widest">
              Intellectual Property & Disclaimers
            </span>
          </div>

          <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-sans">
            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 1. Third-Party Trademarks & Brands</h2>
              <p>
                All third-party game names, titles, publisher and developer brand names, company logos, platform brands (such as Steam, itch.io, Game Jolt, GOG, Epic Games, PlayStation, Xbox, Nintendo, Windows, Linux, macOS), and associated artwork are the registered and unregistered trademarks of their respective legal copyright owners.
              </p>
              <p>
                hoGAMEGATA is an independent, non-commercial metadata directory and community archive. It is not affiliated, associated, authorized, endorsed by, or in any way officially connected with any game creators, publishers, distributors, or distribution platforms listed.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 2. Game Media & Cover Art (Fair Use Disclaimer)</h2>
              <p>
                All visual assets, including game cover images, logos, and screenshots displayed across the hoGAMEGATA catalog are hosted and displayed strictly for descriptive, archival, and search indexing purposes.
              </p>
              <p>
                The use of these graphic elements is protected under the Fair Use provisions of copyright law (17 U.S.C. § 107) as a non-commercial reference registry designed to catalog, review, and evaluate creative horror gaming history.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 3. hoGAMEGATA Proprietary Content</h2>
              <p>
                hoGAMEGATA retains full ownership, proprietary rights, and copyrights over our custom-built metadata schema, search structures, vibe categorization taxonomies, multi-dimensional score calculations, and editorial ratings—including the **Custom Scare Meter Ratings** (scare scores, rating reviews, confidence metrics, and taxonomy mappings).
              </p>
              <p>
                You may not scrape, copy, or redistribute our proprietary scoring systems or databases for commercial registry platforms without prior consent.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 4. Disclaimer of Warranty & Liability</h2>
              <p>
                Game details, specs, store links, and pricing snapshots are provided on an "as-is" basis for general informational discovery. hoGAMEGATA does not warrant the completeness or accuracy of real-time store deals or system specs, and is not responsible for external store purchase transactions.
              </p>
            </section>
          </div>

          {/* Footer inside card */}
          <div className="border-t border-white/10 pt-4 font-mono text-[9px] text-gray-500 uppercase tracking-widest flex justify-between items-center w-full">
            <span>© hoGAMEGATA</span>
            <span>•</span>
            <span>Indexing since 2026</span>
          </div>
        </div>
      </main>

      {/* Spacer to make sure layout matches footer placement */}
      <div></div>
    </div>
  );
}
