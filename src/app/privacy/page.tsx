"use client";

import ReturnButton from "@/components/ReturnButton";
import SciFiLogo from "@/components/SciFiLogo";

export default function PrivacyPage() {
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
              PRIVACY POLICY
            </h1>
            <span className="font-mono text-xs text-white/50 uppercase tracking-widest">
              Last Updated: June 2026
            </span>
          </div>

          <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-sans">
            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 1. Information We Collect</h2>
              <p>
                We only collect basic, necessary information to manage access to hoGAMEGATA:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">Email Address:</strong> Captured only when requesting waitlist access or creating an account, used purely for user authentication.</li>
                <li><strong className="text-white">Local Storage:</strong> Used locally on your device to remember game vibe preferences, sorting choices, layouts, and onboarding completions.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 2. Service Providers & Infrastructure</h2>
              <p>
                We utilize standard, secure external services to operate the database platform. Your information is stored and handled in compliance with their privacy guidelines:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-400">
                <li><strong className="text-white">Supabase & Neon:</strong> Database storage and user session credentials.</li>
                <li><strong className="text-white">Resend:</strong> Single-click authentication link emails and system sign-up alerts.</li>
                <li><strong className="text-white">Cloudinary:</strong> Image content delivery networks (CDNs) for horror game screenshots.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 3. Tracking & Third-Party Cookies</h2>
              <p>
                hoGAMEGATA does not deploy advertising trackers, analytical cookies, marketing tags, or custom tracking pixels. We believe in a clean, privacy-respecting games index.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-white font-mono text-xs uppercase tracking-wider font-bold">// 4. Account Deletion & Rights</h2>
              <p>
                Your data is yours. Since we only retain your email address, you can contact the system administrator at any time to request the complete deletion of your registration details, wishlist contents, and catalog preferences.
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
