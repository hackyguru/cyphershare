// components/settings/CodexConfigPanel.tsx
import { useState, useEffect } from "react";
import { Server, Info, AlertCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCodex, CodexNodeInfo } from "@/hooks/useCodex";

// Extend CodexNodeInfo for optional id (for unknown/derived ids)
interface NodeInfo extends Partial<CodexNodeInfo> {
  id?: string;
}

export default function CodexConfigPanel() {
  const {
    codexNodeUrl,
    codexEndpointType,
    updateSettings,
  } = useSettings();

  const {
    client,
    isNodeActive: isCodexNodeActive,
    isLoading: isCodexLoading,
    error: codexError,
    getNodeInfo,
    checkNodeStatus,
    updateConfig,
  } = useCodex(codexNodeUrl);

  const updateCodexConnection = (url: string, endpointType: "remote" | "local") => {
    // update the codex client
    updateConfig(url, endpointType);
    // update the settings
    updateSettings({ codexNodeUrl: url, codexEndpointType: endpointType });
  }

  // Local UI state
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [localCodexUrl, setLocalCodexUrl] = useState(codexNodeUrl);
  const [manualCheckInProgress, setManualCheckInProgress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Run initial status check on mount / when url changes
  useEffect(() => {
    checkCodexStatus();
  }, [codexNodeUrl, codexEndpointType, checkNodeStatus]);

  /**
   * Update endpoint type (remote / local)
   */
  const handleEndpointTypeChange = async (value: "remote" | "local") => {
    try {
      setNodeInfo(null);
      setManualCheckInProgress(true);

      // Determine proper URL
      const newUrl =
        value === "remote"
          ? process.env.NEXT_PUBLIC_CODEX_REMOTE_API_URL || ""
          : localCodexUrl ||
            process.env.NEXT_PUBLIC_CODEX_LOCAL_API_URL ||
            "http://localhost:8080/api/codex";

      // Ensure local UI mirrors chosen url immediately
      if (value === "local") {
        setLocalCodexUrl(newUrl);
        updateCodexConnection(newUrl, value);
      } else {
        updateCodexConnection("", value);
      }

      await checkCodexStatus(true);
    } catch (err) {
      console.error("Error during Codex endpoint change:", err);
      setNodeInfo(null);
    } finally {
      setManualCheckInProgress(false);
    }
  };

  /** Handle URL edit field */
  const handleCodexUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalCodexUrl(e.target.value);
  };

  /**
   * Comprehensive Codex node status routine
   */
  const checkCodexStatus = async (refresh = false) => {
    try {
      if (refresh) {
        updateConfig(codexNodeUrl, codexEndpointType);
        setLocalCodexUrl(codexNodeUrl);
      }

      // For local nodes we additionally force a direct health probe
      if (codexEndpointType === "local") {
        try {
          const active = await client.isNodeActive(true);
          if (!active) {
            setNodeInfo(null);
            return;
          }
        } catch (err) {
          console.error("Local node direct check failed", err);
          setNodeInfo(null);
          return;
        }
      }

      // Normal hook-assisted probe
      await checkNodeStatus(true);

      // Try to fetch info object for nicer UX
      const info = await getNodeInfo();
      if (info) {
        setNodeInfo({ id: "codex-node", ...info });
      } else if (isCodexNodeActive) {
        setNodeInfo({ id: "verified-active", status: "active", version: "unknown" });
      } else {
        setNodeInfo(null);
      }
    } catch (err) {
      console.error("Error in checkCodexStatus", err);
      setNodeInfo(null);
    }
  };

  /** Persist changes (URL / type) */
  const handleSave = () => {
    // Basic URL validation for local endpoint
    if (
      codexEndpointType === "local" &&
      (!localCodexUrl.trim() || !localCodexUrl.startsWith("http"))
    ) {
      alert("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setIsSaving(true);

    const urlToUse =
      codexEndpointType === "remote"
        ? process.env.NEXT_PUBLIC_CODEX_REMOTE_API_URL || ""
        : localCodexUrl;

    updateSettings({ codexNodeUrl: urlToUse, codexEndpointType });

    checkCodexStatus(true);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Server size={16} className="text-primary" />
          </div>
          <h3 className="text-base font-medium font-mono">CODEX_SETTINGS</h3>
        </div>
        {isCodexLoading || manualCheckInProgress ? (
          <div
            className="w-2 h-2 rounded-full bg-amber-700/70 animate-pulse"
            title="Checking node status..."
          />
        ) : isCodexNodeActive ? (
          <div
            className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
            title="Node is active"
          />
        ) : (
          <div
            className="w-2 h-2 rounded-full bg-amber-600/80"
            title={`Node is not active (${
              codexEndpointType === "local" ? "Local" : "Remote"
            } node unavailable)`}
          />
        )}
      </div>

      {/* Config Form */}
      <div className="space-y-4 pl-2 ml-2 border-l border-border">
        {/* Endpoint type selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium font-mono">ENDPOINT_TYPE</label>
          <Tabs
            value={codexEndpointType}
            onValueChange={(val) => handleEndpointTypeChange(val as "remote" | "local")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 font-mono">
              <TabsTrigger value="remote">REMOTE_NODE</TabsTrigger>
              <TabsTrigger value="local">LOCAL_NODE</TabsTrigger>
            </TabsList>
          </Tabs>
          {codexEndpointType === "remote" && (
            <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-md">
              <p className="text-xs text-primary/90 font-mono flex items-center gap-1">
                <Info size={12} /> Use local Codex node for peak decentralization
              </p>
            </div>
          )}
        </div>

        {/* URL input (only for local) */}
        <div className="space-y-2">
          <label htmlFor="codex-url" className="text-sm font-medium font-mono">
            API_ENDPOINT
          </label>
          {codexEndpointType === "local" ? (
            <>
              <Input
                id="codex-url"
                value={localCodexUrl}
                onChange={handleCodexUrlChange}
                placeholder="http://localhost:8080/api/codex"
                className="font-mono text-sm bg-card/70"
              />
              {/* Status row */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-mono">
                  Local Codex node API endpoint URL
                </p>
                <div className="flex items-center gap-1">
                  {isCodexNodeActive ? (
                    <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                      {isCodexLoading ? "CHECKING" : "OFFLINE"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => checkCodexStatus(true)}
                    className="h-6 w-6 p-0 rounded-full"
                    title="Refresh node status"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-refresh-cw"
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M3 21v-5h5" />
                    </svg>
                  </Button>
                </div>
              </div>

              {/* Error / offline alerts */}
              {codexError && (
                <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Error: {codexError}
                </p>
              )}
              {!isCodexNodeActive && !isCodexLoading && !codexError && (
                <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Codex node is not running in the API endpoint
                </p>
              )}

              {!isCodexNodeActive && !isCodexLoading && (
                <div className="mt-2 p-2 bg-amber-600/20 border border-amber-600/30 rounded-md">
                  <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                    <AlertCircle size={12} /> Turn off adblockers to avoid Codex node detection issues
                  </p>
                </div>
              )}

              {isCodexNodeActive && nodeInfo && (
                <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Info size={12} className="text-primary/70" />
                    <span className="text-xs font-medium text-primary/90 font-mono">NODE_INFO</span>
                  </div>
                  <div className="space-y-1 pl-4 border-l border-primary/10">
                    <p className="text-xs font-mono flex items-center justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="text-primary/80 truncate max-w-[180px]" title={nodeInfo.id}>
                        {nodeInfo.id}
                      </span>
                    </p>
                    <p className="text-xs font-mono flex items-center justify-between">
                      <span className="text-muted-foreground">VERSION:</span>
                      <span className="text-primary/80">
                        {nodeInfo.version} {nodeInfo.revision ? `(${nodeInfo.revision})` : ""}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-3 bg-card/70 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-mono text-muted-foreground">Managed Codex endpoint</p>
                <div className="flex items-center gap-1">
                  {isCodexNodeActive ? (
                    <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600/80" />
                      {isCodexLoading ? "CHECKING" : "OFFLINE"}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => checkCodexStatus(true)}
                    className="h-6 w-6 p-0 rounded-full"
                    title="Refresh node status"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-refresh-cw"
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M3 21v-5h5" />
                    </svg>
                  </Button>
                </div>
              </div>
              {codexError && (
                <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Error: {codexError}
                </p>
              )}
              {isCodexNodeActive && nodeInfo && (
                <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Info size={12} className="text-primary/70" />
                    <span className="text-xs font-medium text-primary/90 font-mono">NODE_INFO</span>
                  </div>
                  <div className="space-y-1 pl-4 border-l border-primary/10">
                    <p className="text-xs font-mono flex items-center justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="text-primary/80 truncate max-w-[180px]" title={nodeInfo.id}>
                        {nodeInfo.id}
                      </span>
                    </p>
                    <p className="text-xs font-mono flex items-center justify-between">
                      <span className="text-muted-foreground">VERSION:</span>
                      <span className="text-primary/80">
                        {nodeInfo.version} {nodeInfo.revision?.toString() ?? "N/A"}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="pt-4 border-t border-border flex justify-end">
        <Button className="flex-1 font-mono" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
              SAVING...
            </span>
          ) : saveSuccess ? (
            <span className="flex items-center gap-2">
              <Info size={16} /> SAVED!
            </span>
          ) : (
            "SAVE_CONFIG"
          )}
        </Button>
      </div>
    </div>
  );
}
