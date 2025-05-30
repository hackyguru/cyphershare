import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { useRef } from "react";
import { WalletProvider } from "@/context/WalletContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { TacoProvider } from "@/context/TacoContext";
import { CodexProvider } from "@/context/CodexContext";
import { WakuProvider } from "@/context/WakuContext";
import { FileTransferProvider, FileTransferHandle } from "@/context/FileTransferContext";

export default function App({ Component, pageProps }: AppProps) {
  // Create a ref to access the FileTransferProvider's handleFileReceived method
  const fileTransferRef = useRef<FileTransferHandle>(null);

  return (
    <ThemeProvider defaultTheme="system">
      <SettingsProvider>
        <WalletProvider>
          <TacoProvider>
            <CodexProvider>
              <WakuProvider onFileReceived={(msg) => fileTransferRef.current?.handleFileReceived(msg)}>
                <FileTransferProvider ref={fileTransferRef}>
                  <Component {...pageProps} />
                  <Toaster richColors position="top-center" />
                </FileTransferProvider>
              </WakuProvider>
            </CodexProvider>
          </TacoProvider>
        </WalletProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
