import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/AuthContext";
import PreferencesButton from "@/components/PreferencesButton";
import dynamic from "next/dynamic";
import { unstable_cache } from "next/cache";
import { getSupabaseServer } from "@/lib/supabaseServer";
import PageTransitionLoader from "@/components/PageTransitionLoader";
import HeaderScrollController from "@/components/HeaderScrollController";
import InteractiveTutorial from "@/components/InteractiveTutorial";
import { Suspense } from "react";

const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"));

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "hoGAMEGATA | Horror Game Discovery Database",
  description: "A fast, minimal, and premium metadata registry for survival horror, psychological horror, and indie nightmare games.",
};

async function fetchMaintenanceStatusFromDb() {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("SystemConfig")
      .select("value")
      .eq("key", "maintenance_mode")
      .limit(1)
      .maybeSingle();
    return data?.value === "true";
  } catch (e) {
    console.error("Error checking maintenance mode:", e);
    return false;
  }
}

const getCachedMaintenanceStatus = unstable_cache(
  async () => fetchMaintenanceStatusFromDb(),
  ["maintenance_mode"],
  {
    revalidate: 60,
    tags: ["maintenance"],
  }
);

async function getMaintenanceStatus() {
  if (process.env.NODE_ENV === "development") {
    return fetchMaintenanceStatusFromDb();
  }
  return getCachedMaintenanceStatus();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isMaintenance = await getMaintenanceStatus();

  if (isMaintenance) {
    return (
      <html
        lang="en"
        className={cn("h-full", "antialiased", montserrat.variable, "font-sans")}
      >
        <body className="min-h-full flex flex-col items-center justify-center bg-[#030303] text-[#f3f4f6] p-6 selection:bg-[#ff2a2a] selection:text-white">
          <div className="max-w-2xl w-full border-4 border-white bg-[#08080a] p-8 md:p-12 shadow-[8px_8px_0px_0px_#ffffff] relative overflow-hidden flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <span className="font-mono text-xs text-[#ff2a2a] font-bold tracking-widest uppercase">// STATUS: OFFLINE</span>
              <h1 className="font-sans font-black text-4xl sm:text-5xl uppercase tracking-tighter leading-none text-[#f3f4f6] border-b border-white/10 pb-4">
                THE WEBSITE IS IN <span className="text-[#ff2a2a] glow-text">MAINTENANCE</span>, CHECK BACK AGAIN LATER!
              </h1>
              <p className="font-mono text-sm text-gray-400 mt-2 leading-relaxed">
                We are currently performing catalog ingestion updates and database FTS indexing operations. 
                All outbound systems, search routes, and metadata registries are offline.
              </p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", montserrat.variable, "font-sans")}
    >
      <head>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={null}>
          <HeaderScrollController />
        </Suspense>
        <AuthProvider>
          <Suspense fallback={null}>
            <InteractiveTutorial />
          </Suspense>
          <div className="flex-1 flex flex-col w-full">
            {children}
          </div>
          <OnboardingModal />
        </AuthProvider>
        <footer className="max-w-5xl w-full mx-auto px-6 py-8 border-t border-white flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-white uppercase tracking-widest font-black">
          <span>© 2026 hoGAMEGATA, Free, forever.</span>
          <div className="flex items-center gap-4">
            <PreferencesButton />
            <span>Made with ❤️ by aurostron.</span>
          </div>
        </footer>
        <Suspense fallback={null}>
          <PageTransitionLoader />
        </Suspense>
      </body>
    </html>
  );
}
