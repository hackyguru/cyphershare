import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/context/wallet-context";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <WalletProvider>
        <Component {...pageProps} />
        <Toaster richColors position="top-center" />
      </WalletProvider>
    </ThemeProvider>
  );
}
