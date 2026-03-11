import type { Metadata } from "next";
import "./globals.css";
import ClientRoot from "./ClientRoot";

export const metadata: Metadata = {
  title: "修仙模拟器",
  description: "原生AI修仙游戏《修仙模拟器》，无限剧情自由探索，每局皆不同",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body>
        <ClientRoot>
          {children}
        </ClientRoot>
      </body>
    </html>
  );
}
