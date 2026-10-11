import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Landscape } from "@/components/Landscape";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gesture Rack",
  description: "Shape your sound with your hands.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Landscape className="fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
