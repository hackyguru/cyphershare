// components/layout/MainLayout.tsx
import { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import TopBar from "./TopBar";
import { cn } from "@/lib/utils";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

interface Props { children: ReactNode }

export default function MainLayout({ children }: Props) {
  return (
    <TooltipProvider>
      <div className={cn("min-h-screen bg-background text-foreground flex flex-col", geistSans.variable, geistMono.variable)}>
        <TopBar />
        <main className="flex-1">{children}</main>
      </div>
    </TooltipProvider>
  );
}
