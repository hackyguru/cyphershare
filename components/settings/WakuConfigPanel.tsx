// components/settings/WakuConfigPanel.tsx
import { useState } from "react";
import { Radio, Info, AlertCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { useFileTransfer } from "@/context/FileTransferContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWakuContext } from "@/context/WakuContext";
import WakuStatusIndicatorDot from "../waku/WakuStatusIndicatorDot";

export default function WakuConfigPanel() {
  const { wakuNodeUrl, wakuNodeType, updateSettings } = useSettings();
  const { isWakuConnected, isWakuConnecting, wakuPeerCount } = useFileTransfer();

  const [localWakuUrl, setLocalWakuUrl] = useState(wakuNodeUrl);
  const [roomId] = useState("XYZ123");

  const { wakuContentTopic, wakuError } = useWakuContext();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleWakuUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalWakuUrl(e.target.value);
  };

  const sendTestWakuMessage = () => {
    console.log("Sending test Waku message:", {
      roomId,
      timestamp: new Date().toISOString(),
    });
  };

  const handleSave = () => {
    setIsSaving(true);

    updateSettings({ wakuNodeUrl: localWakuUrl, wakuNodeType });

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
            <Radio size={16} className="text-primary" />
          </div>
          <h3 className="text-base font-medium font-mono">WAKU_SETTINGS</h3>
        </div>
        <WakuStatusIndicatorDot />
      </div>

      <div className="space-y-4 pl-2 ml-2 border-l border-border">
        {/* Node type selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium font-mono">NODE_TYPE</label>
          <Tabs
            value={wakuNodeType}
            onValueChange={(val) => updateSettings({ wakuNodeType: val as "light" | "relay" })}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 font-mono">
              <TabsTrigger value="light">LIGHT_NODE</TabsTrigger>
              <TabsTrigger value="relay">RELAY_NODE</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground font-mono">Select Waku node type</p>

          {wakuNodeType === "relay" && (
            <div className="mt-2 p-2 bg-amber-600/20 border border-amber-600/30 rounded-md">
              <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                <AlertCircle size={12} /> Relay node integration is not available yet
              </p>
            </div>
          )}
        </div>

        {/* Endpoint for relay */}
        {wakuNodeType === "relay" && (
          <div className="space-y-2">
            <label htmlFor="waku-url" className="text-sm font-medium font-mono">
              API_ENDPOINT
            </label>
            <Input
              id="waku-url"
              value={localWakuUrl}
              onChange={handleWakuUrlChange}
              placeholder="http://127.0.0.1:8645"
              className="font-mono text-sm bg-card/70"
            />
            <p className="text-xs text-muted-foreground font-mono">Waku relay node API endpoint</p>
          </div>
        )}

        {/* Status (light node) */}
        {wakuNodeType === "light" && (
          <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
            <div className="flex items-center gap-1 mb-1">
              <Info size={12} className="text-primary/70" />
              <span className="text-xs font-medium text-primary/90 font-mono">WAKU_STATUS</span>
            </div>
            <div className="space-y-1 pl-4 border-l border-primary/10">
              <p className="text-xs font-mono flex items-center justify-between">
                <span className="text-muted-foreground">STATUS:</span>
                <span className={`${isWakuConnected ? "text-green-500" : "text-amber-500"}`}>
                  {isWakuConnecting
                    ? "CONNECTING"
                    : isWakuConnected
                    ? "CONNECTED"
                    : "DISCONNECTED"}
                </span>
              </p>
              {isWakuConnected && (
                <>
                  <p className="text-xs font-mono flex items-center justify-between">
                    <span className="text-muted-foreground">PEERS:</span>
                    <span className="text-primary/80">{wakuPeerCount}</span>
                  </p>
                  <p className="text-xs font-mono flex items-center justify-between">
                    <span className="text-muted-foreground">TOPIC:</span>
                    <span className="text-primary/80 truncate max-w-[180px]" title={wakuContentTopic}>
                      {wakuContentTopic}
                    </span>
                  </p>
                </>
              )}
              {wakuError && (
                <p className="text-xs font-mono flex items-center text-amber-500">
                  <AlertCircle size={10} className="mr-1" />
                  {wakuError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Test message */}
        <div className="space-y-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs w-full flex items-center gap-2"
            onClick={sendTestWakuMessage}
            disabled={!isWakuConnected}
          >
            <Radio size={12} /> TEST_WAKU_MESSAGE
          </Button>
          {!isWakuConnected && (
            <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Connect to Waku network to send test messages
            </p>
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
