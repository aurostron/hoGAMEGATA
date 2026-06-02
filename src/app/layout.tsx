import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/AuthContext";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "hoGAMEGATA | Horror Game Discovery Database",
  description: "A fast, minimal, and premium metadata registry for survival horror, psychological horror, and indie nightmare games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", montserrat.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <div className="flex-1 flex flex-col w-full">
            {children}
          </div>
        </AuthProvider>
        <footer className="max-w-5xl w-full mx-auto px-6 py-8 border-t border-white flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-white uppercase tracking-widest font-black">
          <span>© 2026 hoGAMEGATA Project, soon FOSS on Github.</span>
          <span>Made with ❤️ by aurostron.</span>
        </footer>
      </body>
    </html>
  );
}

