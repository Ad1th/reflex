import type { Metadata } from "next";
import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const ui = Schibsted_Grotesk({
  variable: "--font-ui",
  subsets: ["latin"],
});

const code = Martian_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reflex",
  description:
    "AI agents that get faster every time they do something twice. Reflex remembers each step an agent takes and replays it from a ~1 ms Moss lookup instead of calling the LLM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
