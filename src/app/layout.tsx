import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/context/AuthContext";

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
      className={cn("h-full", "antialiased", "font-sans")}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" />
      </head>
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

