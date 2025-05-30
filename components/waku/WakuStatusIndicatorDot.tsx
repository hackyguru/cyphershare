// components/waku/WakuStatusIndicatorDot.tsx
import { useFileTransfer } from "@/context/FileTransferContext";
import { useSettings } from "@/context/SettingsContext";

export default function WakuStatusIndicatorDot() {
  const { isWakuConnected, isWakuConnecting, wakuPeerCount } = useFileTransfer();
  const { wakuNodeType } = useSettings();
  return (
    <div>
          {/* Status indicator dot */}
          {wakuNodeType === "light" ? (
          isWakuConnecting ? (
            <div
              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
              title="Connecting to Waku network..."
            />
          ) : isWakuConnected ? (
            <div
              className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
              title={`Connected to Waku network (${wakuPeerCount} peers)`}
            />
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-500" title="Not connected to Waku network" />
          )
        ) : (
          <div className="w-2 h-2 rounded-full bg-primary/80" title="Using relay node" />
        )}
        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
    </div>
  );
}
