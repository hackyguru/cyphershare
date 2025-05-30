// /context/SettingsContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface Settings {
  codexNodeUrl: string;
  codexEndpointType: "remote" | "local";
  wakuNodeUrl: string;
  wakuNodeType: "light" | "relay";
}

interface SettingsContextType extends Settings {
  updateSettings: (changes: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  codexNodeUrl: process.env.NEXT_PUBLIC_CODEX_REMOTE_API_URL || "http://localhost:8080/api/codex",
  codexEndpointType: "remote",
  wakuNodeUrl: "http://127.0.0.1:8645",
  wakuNodeType: "light",
};

const SettingsContext = createContext<SettingsContextType>({
  ...defaultSettings,
   
  updateSettings: () => {},
});

export const useSettings = () => useContext(SettingsContext);

interface Props {
  children: ReactNode;
}

export function SettingsProvider({ children }: Props) {
  const [settings, setSettings] = useState<Settings>(() => {
    // Initial state from localStorage if present
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("cyphershare_settings");
      if (stored) {
        try {
          return { ...defaultSettings, ...JSON.parse(stored) } as Settings;
        } catch {
          /* ignore */
        }
      }
    }
    return defaultSettings;
  });

  const updateSettings = useCallback((changes: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cyphershare_settings", JSON.stringify(next));
      }
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
