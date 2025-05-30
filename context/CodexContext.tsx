// /context/CodexContext.tsx
// Handles Codex file storage functionality
import React, { createContext, useContext, ReactNode, useEffect } from "react";
import { useCodex, CodexEndpointType, CodexNodeInfo, CodexClient } from "@/hooks/useCodex";
import { useSettings } from "./SettingsContext";
import { toast } from "sonner";

// Response types for better type safety
interface UploadResponse {
  success: boolean;
  id?: string;
  error?: string;
}

interface DownloadResponse {
  success: boolean;
  data?: Blob;
  error?: string;
}

interface CodexContextType {
  // Status
  isCodexNodeActive: boolean;
  isCodexLoading: boolean;
  codexError: string | null;
  
  // Actions
  updateCodexConfig: (url: string, endpointType: CodexEndpointType) => void;
  checkCodexStatus: (forceCheck?: boolean) => Promise<boolean>;
  getNodeInfo: () => Promise<CodexNodeInfo | null>;
  getCodexClient: () => CodexClient;
  
  // File operations
  uploadFile: (file: File, onProgress?: (progress: number) => void) => Promise<UploadResponse>;
  downloadFile: (fileId: string) => Promise<DownloadResponse>;
}

const CodexContext = createContext<CodexContextType | null>(null);

export const useCodexContext = () => {
  const ctx = useContext(CodexContext);
  if (!ctx) throw new Error("useCodexContext must be used within <CodexProvider>");
  return ctx;
};

interface CodexProviderProps {
  children: ReactNode;
}

export function CodexProvider({ children }: CodexProviderProps) {
  const { codexNodeUrl, codexEndpointType } = useSettings();
  
  // Codex hook
  const {
    isNodeActive: isCodexNodeActive,
    isLoading: isCodexLoading,
    updateConfig: updateCodexConfig,
    checkNodeStatus: checkCodexStatus,
    error: codexError,
    getNodeInfo,
    getCodexClient,
    uploadFile: codexUploadFile,
    downloadFile: codexDownloadFile,
  } = useCodex(codexNodeUrl, codexEndpointType);

  // Check Codex node status on mount
  useEffect(() => {
    if (codexNodeUrl && !isCodexLoading && !isCodexNodeActive) {
      checkCodexStatus(true).catch(() => {
        toast.error("Failed to connect to Codex node", {
          description: "Please check your Codex settings and ensure the node is running.",
        });
      });
    }
  }, [codexNodeUrl, isCodexLoading, isCodexNodeActive, checkCodexStatus]);

  // Type-safe wrapper for uploadFile to ensure File type
  const uploadFile = async (file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> => {
    try {
      return await codexUploadFile(file, onProgress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown upload error";
      console.error("Codex upload error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Type-safe wrapper for downloadFile
  const downloadFile = async (fileId: string): Promise<DownloadResponse> => {
    try {
      return await codexDownloadFile(fileId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown download error";
      console.error("Codex download error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value: CodexContextType = {
    isCodexNodeActive,
    isCodexLoading,
    codexError,
    updateCodexConfig,
    checkCodexStatus,
    getNodeInfo,
    getCodexClient,
    uploadFile,
    downloadFile,
  };

  return <CodexContext.Provider value={value}>{children}</CodexContext.Provider>;
}
