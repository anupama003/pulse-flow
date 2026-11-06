import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import SplashScreen from "@/components/brand/SplashScreen";
import DictationBridge from "@/components/DictationBridge";
import { SPLASH_KEY } from "@/components/brand/splash-key";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Pulse Flow", template: "%s · Pulse Flow" },
  description: "Pulse Flow: voice-first care from handover to pharmacy. Speak it, approve it, it flows.",
  applicationName: "Pulse Flow",
  // app/icon.svg (the animated Pulse Flow mark) is picked up automatically as the favicon.
  openGraph: { title: "Pulse Flow", description: "Voice-first hospital & clinic platform", images: ["/pulse-flow-logo.svg"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Before first paint: hide the splash if this tab already saw it (no flash on reloads). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var q=new URLSearchParams(location.search);if(sessionStorage.getItem(${JSON.stringify(SPLASH_KEY)})==="1"&&!q.has("splash"))document.documentElement.setAttribute("data-splash-seen","")}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans text-ink antialiased">
        <SplashScreen />
        <DictationBridge />
        {children}
      </body>
    </html>
  );
}
