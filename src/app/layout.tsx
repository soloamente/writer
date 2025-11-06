import "@/styles/globals.css";
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-lexical/styles.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Writer",
  description: "A real-time collaborative writing app",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TRPCReactProvider>
            <ToastProvider>{children}</ToastProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
