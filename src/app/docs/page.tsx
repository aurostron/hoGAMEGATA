import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import { 
  ArrowLeft, 
  Terminal, 
  Layers, 
  Cpu, 
  Database, 
  Route, 
  ShieldAlert, 
  DollarSign, 
  Activity, 
  ChevronRight, 
  FileText
} from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black pb-24">
      {/* Top Banner Navigation */}
      <header className="border-b border-white sticky top-0 bg-black z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              <span className="italic">ho</span>GAMEGATA.
            </h1>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-white uppercase font-bold">
              <span>Technical Specification</span>
              <span className="text-white font-black">•</span>
              <span>v2.0</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AuthButton />
            <Link 
              href="/" 
              className="group flex items-center gap-2 font-mono text-xs text-white hover:bg-white hover:text-black uppercase tracking-wider transition-all duration-150 border border-white px-3 py-1.5 rounded-none font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ Return to Search ]</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-4 gap-12">
        
        {/* Sticky Sidebar Navigation */}
        <aside className="lg:col-span-1 lg:sticky lg:top-28 h-fit hidden lg:block">
          <div className="font-mono text-xs tracking-wider text-white font-black uppercase mb-4">
            Sections
          </div>
          <nav className="flex flex-col gap-3">
            <a href="#vision" className="group flex items-center justify-between text-white hover:underline transition-all duration-150 py-1 border-b border-transparent hover:border-white text-xs font-mono font-bold">
              <span>01 / Vision</span>
              <ChevronRight className="w-3 h-3 text-white" />
            </a>
            <a href="#stack" className="group flex items-center justify-between text-white hover:underline transition-all duration-150 py-1 border-b border-transparent hover:border-white text-xs font-mono font-bold">
              <span>02 / Tech Stack</span>
              <ChevronRight className="w-3 h-3 text-white" />
            </a>
            <a href="#pipeline" className="group flex items-center justify-between text-white hover:underline transition-all duration-150 py-1 border-b border-transparent hover:border-white text-xs font-mono font-bold">
              <span>03 / Data Pipeline</span>
              <ChevronRight className="w-3 h-3 text-white" />
            </a>
            <a href="#routes" className="group flex items-center justify-between text-white hover:underline transition-all duration-150 py-1 border-b border-transparent hover:border-white text-xs font-mono font-bold">
              <span>04 / Route Architecture</span>
              <ChevronRight className="w-3 h-3 text-white" />
            </a>
            <a href="#nongoals" className="group flex items-center justify-between text-white hover:underline transition-all duration-150 py-1 border-b border-transparent hover:border-white text-xs font-mono font-bold">
              <span>05 / Limits & Non-Goals</span>
              <ChevronRight className="w-3 h-3 text-white" />
            </a>
          </nav>
        </aside>

        {/* Documentation Content */}
        <div className="lg:col-span-3 space-y-16">
          
          {/* Introduction Sub-Header */}
          <section className="pb-12 border-b border-white">
            <div className="font-mono text-xs text-white font-black uppercase tracking-widest mb-3">Project Metadata</div>
            <h2 className="text-3xl text-white font-extrabold leading-tight mb-4">
              Minimalistic, No BS and it just works.
            </h2>
            <p className="text-white max-w-2xl leading-relaxed text-sm">
              The project is named <span className="text-black bg-white font-black px-1.5 py-0.5 border border-white rounded">hoGAMEGATA</span>, where the prefix <span className="font-bold italic text-white">"ho"</span> denotes horror, and <span className="text-white font-bold">GAMEGATA</span> is the abbreviated technical slang of <span className="font-bold italic text-white">"game mega metadata"</span>. It aims to eliminate modern web fatigue by functioning strictly as a lightweight discovery layer.
            </p>
          </section>

          {/* 1. VISION & PHILOSOPHY */}
          <section id="vision" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-white text-black border border-white px-2.5 py-1 font-black">01</span>
              <h3 className="text-lg text-white uppercase tracking-wider font-black">Project Vision & Philosophy</h3>
            </div>
            
            <div className="border border-white bg-black p-6 rounded-none space-y-6">
              <div>
                <span className="font-mono text-[10px] text-white uppercase tracking-widest block mb-2 font-black">Core Manifesto</span>
                <p className="text-lg text-white font-medium leading-relaxed">
                  "A minimalistic horror game discovery website focused on horror games. Fast → Minimal → Useful. No comments, reviews, likes, feeds, or unnecessary social clutter."
                </p>
              </div>

              {/* Strict Success Metric stark banner */}
              <div className="border-2 border-white bg-black p-5 rounded-none relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-white text-black font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 font-bold">
                  Strict Target
                </div>
                <div className="flex items-start gap-4">
                  <Activity className="w-5 h-5 text-white shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono text-xs text-white uppercase tracking-wider font-bold block mb-1">
                      Success Metric
                    </span>
                    <p className="text-sm text-white font-medium leading-relaxed">
                      Target execution: User must be capable of discovering, inspecting, and supporting a developer within 30 seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. TECHNICAL STACK MAP */}
          <section id="stack" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-white text-black border border-white px-2.5 py-1 font-black">02</span>
              <h3 className="text-lg text-white uppercase tracking-wider font-black">Technical Stack Map</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Next.js */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Framework</span>
                  <Terminal className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">Next.js (App Router)</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Server-side rendering, routing logic, static/dynamic regeneration capabilities, and strict component separation.
                </p>
              </div>

              {/* Supabase */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Database</span>
                  <Database className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">Supabase (PostgreSQL)</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Relational game metadata storage leveraging a free-tier hosting node with standard PostgreSQL optimizations.
                </p>
              </div>

              {/* Prisma ORM */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Schema Mapper</span>
                  <Layers className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">Prisma ORM</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Strict schema mapping, type-safe database queries, and declarative relational mapping for nested tables.
                </p>
              </div>

              {/* Tailwind CSS & shadcn/ui */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Styles & UI</span>
                  <Cpu className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">Tailwind CSS + shadcn/ui</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Utility-first styling with custom dark-palette themes and Radix Primitives for clean accessibility wrappers.
                </p>
              </div>

              {/* MiniSearch */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Search Engine</span>
                  <FileText className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">MiniSearch Engine</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Ultra-fast, typo-tolerant, client-side memory index. Queries games by title, genre, developer, and platforms.
                </p>
              </div>

              {/* Vercel */}
              <div className="border border-white bg-black p-5 rounded-none hover:bg-white hover:text-black group transition-all duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-white group-hover:text-black font-bold uppercase">Infrastructure</span>
                  <Terminal className="w-4 h-4 text-white group-hover:text-black" />
                </div>
                <h4 className="text-white group-hover:text-black text-base font-bold mb-1">Vercel Infrastructure</h4>
                <p className="text-xs text-white group-hover:text-black leading-relaxed font-sans font-medium">
                  Serverless compute deployment, asset delivery optimization, and global edge cache integration.
                </p>
              </div>
            </div>
          </section>

          {/* 3. DATA PIPELINE STRATEGY */}
          <section id="pipeline" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-white text-black border border-white px-2.5 py-1 font-black">03</span>
              <h3 className="text-lg text-white uppercase tracking-wider font-black">Data Pipeline Strategy</h3>
            </div>

            <div className="border border-white bg-black p-6 rounded-none space-y-6">
              
              {/* Flowchart */}
              <div>
                <span className="font-mono text-[10px] text-white uppercase tracking-widest block mb-3 font-black">
                  Ingestion Sequence
                </span>
                
                <div className="hidden sm:flex items-center gap-2 p-4 bg-black border border-white rounded-none font-mono text-xs text-white overflow-x-auto">
                  <div className="bg-white text-black px-3 py-1.5 border border-white shrink-0 text-center font-sans font-bold">
                    IGDB API
                    <span className="block text-[8px] font-mono font-bold text-black mt-0.5">with plans for RAWG API</span>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-white" />
                  <div className="bg-white text-black px-3 py-1.5 border border-white shrink-0 text-center font-sans font-bold">
                    Normalization Layer
                    <span className="block text-[8px] font-mono font-bold text-black mt-0.5">Local TS Tooling</span>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-white" />
                  <div className="bg-white text-black px-3 py-1.5 border border-white shrink-0 text-center font-sans font-bold">
                    Supabase Postgres
                    <span className="block text-[8px] font-mono font-bold text-black mt-0.5">Remote Database</span>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-white" />
                  <div className="bg-white text-black px-3 py-1.5 border border-white shrink-0 text-center font-sans font-bold">
                    Next.js Engine
                    <span className="block text-[8px] font-mono font-bold text-black mt-0.5">Client-Side Search</span>
                  </div>
                </div>

                <div className="sm:hidden flex flex-col gap-2 p-4 bg-black border border-white rounded-none font-mono text-xs text-white">
                  <div className="bg-white text-black px-3 py-1.5 border border-white text-center font-sans font-bold">
                    IGDB API (Local TypeScript)
                  </div>
                  <div className="text-center text-white font-bold">↓</div>
                  <div className="bg-white text-black px-3 py-1.5 border border-white text-center font-sans font-bold">
                    Normalization Layer
                  </div>
                  <div className="text-center text-white font-bold">↓</div>
                  <div className="bg-white text-black px-3 py-1.5 border border-white text-center font-sans font-bold">
                    Remote Supabase Postgres DB
                  </div>
                  <div className="text-center text-white font-bold">↓</div>
                  <div className="bg-white text-black px-3 py-1.5 border border-white text-center font-sans font-bold">
                    Next.js Engine
                  </div>
                </div>
              </div>

              {/* Constraints and Details */}
              <div className="space-y-3">
                <span className="font-mono text-[10px] text-white uppercase tracking-widest block font-black">
                  Media Handling & Timeouts
                </span>
                <p className="text-sm leading-relaxed text-white font-medium">
                  <strong>Zero local storage.</strong> Bypassing Vercel serverless limits (10-second execution timeouts) via offline local batch ingestion. All imagery, cover nodes, and screenshots are stored, resolved, and rendered purely via remote-hosted asset URLs, keeping the database slim and hosting costs minimal.
                </p>
              </div>
            </div>
          </section>

          {/* 4. APP FUNCTIONALITY & ROUTE ARCHITECTURE */}
          <section id="routes" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-white text-black border border-white px-2.5 py-1 font-black">04</span>
              <h3 className="text-lg text-white uppercase tracking-wider font-black">App Functionality & Route Architecture</h3>
            </div>

            <div className="border border-white rounded-none overflow-hidden bg-black">
              <div className="grid grid-cols-1 divide-y divide-white">
                {/* Route: / */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-white hover:text-black group transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <Route className="w-4 h-4 text-white group-hover:text-black" />
                    <span className="font-mono text-sm text-white group-hover:text-black font-bold tracking-tight">/</span >
                  </div>
                  <p className="text-xs text-white group-hover:text-black md:max-w-md font-medium">
                    Instant, client-side typo-tolerant search and core catalog mapping of all ingested titles.
                  </p>
                </div>

                {/* Route: /game/[slug] */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-white hover:text-black group transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <Route className="w-4 h-4 text-white group-hover:text-black" />
                    <span className="font-mono text-sm text-white group-hover:text-black font-bold tracking-tight">/game/[slug]</span >
                  </div>
                  <p className="text-xs text-white group-hover:text-black md:max-w-md font-medium">
                    Raw game profile views showcasing developer data, release status, cover nodes, and direct external purchase outlinks.
                  </p>
                </div>

                {/* Route: /upcoming */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-white hover:text-black group transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <Route className="w-4 h-4 text-white group-hover:text-black" />
                    <span className="font-mono text-sm text-white group-hover:text-black font-bold tracking-tight">/upcoming</span >
                  </div>
                  <p className="text-xs text-white group-hover:text-black md:max-w-md font-medium">
                    An uncluttered release calendar tracking emerging software and upcoming project timelines.
                  </p>
                </div>

                {/* Route: /random */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-white hover:text-black group transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <Route className="w-4 h-4 text-white group-hover:text-black" />
                    <span className="font-mono text-sm text-white group-hover:text-black font-bold tracking-tight">/random</span >
                  </div>
                  <p className="text-xs text-white group-hover:text-black md:max-w-md font-medium">
                    Fast server-side redirect utility mapping users to discover random database entries instantly.
                  </p>
                </div>

                {/* Route: /wishlist & /collection */}
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-white hover:text-black group transition-all duration-150">
                  <div className="flex items-center gap-3">
                    <Route className="w-4 h-4 text-white group-hover:text-black" />
                    <span className="font-mono text-sm text-white group-hover:text-black font-bold tracking-tight">/wishlist & /collection</span >
                  </div>
                  <p className="text-xs text-white group-hover:text-black md:max-w-md font-medium">
                    Private, authenticated tracking dashboards backed by Supabase Magic Link credentials.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. NON-GOALS & FINANCIAL GUARDRAILS */}
          <section id="nongoals" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs bg-white text-black border border-white px-2.5 py-1 font-black">05</span>
              <h3 className="text-lg text-white uppercase tracking-wider font-black">Non-Goals & Financial Guardrails</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Structural Boundaries */}
              <div className="border border-white bg-black p-6 rounded-none space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-white" />
                  <span className="font-mono text-xs text-white uppercase tracking-wider font-black">
                    Non-Goals
                  </span>
                </div>
                <p className="text-xs text-white leading-relaxed font-sans font-medium">
                  To protect the scope and preserve a zero-noise user experience, the website enforces absolute structural boundaries:
                </p>
                <ul className="text-xs text-white space-y-2 list-disc list-inside font-bold">
                  <li>No reviews or comments</li>
                  <li>No social elements, likes, or upvotes</li>
                  <li>No algorithmic feeds or recommendations</li>
                  <li>No piracy indexation or link distribution</li>
                  <li>No hosting for game files</li>
                </ul>
              </div>

              {/* Financial Projection */}
              <div className="border border-white bg-black p-6 rounded-none space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-white" />
                  <span className="font-mono text-xs text-white uppercase tracking-wider font-black">
                    Financial Limitations
                  </span>
                </div>
                <p className="text-xs text-white leading-relaxed font-sans font-medium">
                  I am starting this out by keeping the infra focused on cost efficiency, ensuring the project survives with minimal costs and upfront, with plans for scaling later.
                </p>
                <div className="p-3 bg-black border border-white rounded-none font-mono">
                  <div className="flex justify-between items-center text-xs mb-1 font-bold">
                    <span className="text-white">Database & hosting:</span>
                    <span className="text-white">$0.00 / mo</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mb-1 font-bold">
                    <span className="text-white">Media CDN:</span>
                    <span className="text-white">$0.00 / mo</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-white mt-2 pt-2 font-black">
                    <span className="text-white">Total Fixed Budget:</span>
                    <span className="text-white">$0.00 / mo</span>
                  </div>
                </div>
                <p className="text-[10px] text-white leading-relaxed font-medium">
                  *There are plans for purchasing a domain for the website. Media rendering remains free via external image links and hosters.
                </p>
              </div>

            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
