// /context/WakuContext.tsx
// Handles Waku messaging functionality
import React, { createContext, useContext, ReactNode } from "react";
import useWaku, { WakuFileMessage } from "@/hooks/useWaku";
import { useSettings } from "./SettingsContext";

// Default configuration
const DEFAULT_ROOM_ID = "XYZ123";

// Import the exact return type from useWaku hook to ensure compatibility
interface WakuContextType {
  // Status properties
  isWakuConnected: boolean;
  isWakuConnecting: boolean;
  wakuPeerCount: number;
  wakuContentTopic: string;
  wakuError: string | null;
  
  // Actions
  sendFileMessage: (fileMessage: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileId: string;
    isEncrypted?: boolean;
    accessCondition?: string;
  }) => Promise<boolean>;
}

const WakuContext = createContext<WakuContextType | null>(null);

export const useWakuContext = () => {
  const ctx = useContext(WakuContext);
  if (!ctx) throw new Error("useWakuContext must be used within <WakuProvider>");
  return ctx;
};

interface WakuProviderProps {
  children: ReactNode; 
  onFileReceived?: (fileMessage: WakuFileMessage) => void;
  roomId?: string; // Optional room ID to override default
}

export function WakuProvider({ children, onFileReceived, roomId }: WakuProviderProps) {
  const { wakuNodeUrl, wakuNodeType } = useSettings();
  
  // Validate node type before passing to hook
  const validNodeType = (wakuNodeType === "light" || wakuNodeType === "relay") 
    ? wakuNodeType 
    : "light";
  
  // Waku hook with proper error handling
  const {
    isConnecting: isWakuConnecting,
    isConnected: isWakuConnected,
    error: wakuError,
    sendFileMessage,
    peerCount: wakuPeerCount,
    contentTopic: wakuContentTopic,
  } = useWaku({
    roomId: roomId || DEFAULT_ROOM_ID,
    wakuNodeUrl,
    wakuNodeType: validNodeType,
    onFileReceived,
  });

  
  const value: WakuContextType = {
    isWakuConnected,
    isWakuConnecting,
    wakuPeerCount,
    wakuContentTopic,
    wakuError,
    sendFileMessage,
  };

  return <WakuContext.Provider value={value}>{children}</WakuContext.Provider>;
}
