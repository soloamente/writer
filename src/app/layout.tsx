import "@/styles/globals.css";
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-lexical/styles.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import { CustomCursor } from "@/components/cursor";
import { TextCaret } from "@/components/text-caret";

export const metadata: Metadata = {
  title: "Writer",
  description: "A real-time collaborative writing app",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const iaWriterMonoV = localFont({
  src: [
    {
      path: "../../public/fonts/iAWriterMonoV.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/iAWriterMonoV-Italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-ia-writer-mono-v",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${iaWriterMonoV.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TRPCReactProvider>
            <ToastProvider>
              <CustomCursor />
              <TextCaret />
              {children}
            </ToastProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
