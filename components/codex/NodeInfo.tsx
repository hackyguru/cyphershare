// components/codex/NodeInfo.tsx
import { Card } from "@/components/ui/card";
import { Server } from "lucide-react";
import { useState, useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";
import { getNodeInfo } from "@/hooks/useCodex";

// Define the node info type
interface ExtendedNodeInfo {
  id?: string;
  version?: string;
  revision?: string;
  status?: string;
  uptime?: string;
  peers?: number;
}

export default function NodeInfo() {
  const { codexNodeUrl, codexEndpointType } = useSettings();
  const [nodeInfo, setNodeInfo] = useState<ExtendedNodeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch node info on mount and when endpoint changes
  useEffect(() => {
    const fetchNodeInfo = async () => {
      
      setIsLoading(true);
      setError(null);
      
      try {
        const info = await getNodeInfo();

        setNodeInfo(info);
      } catch (err) {
        console.error("Failed to fetch node info:", err);
        const errorMessage = "Failed to fetch node info";
        setError(errorMessage);
        setNodeInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNodeInfo();
    
    // Set up polling for node info updates
    const interval = setInterval(fetchNodeInfo, 30000);
    return () => clearInterval(interval);
  }, [codexNodeUrl, codexEndpointType]);

  if (isLoading) {
    return (
      <Card className="bg-card border border-border p-4 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="animate-pulse h-5 w-32 bg-muted rounded"></div>
        </div>
        <div className="mt-2 space-y-2">
          <div className="animate-pulse h-4 w-full bg-muted rounded"></div>
          <div className="animate-pulse h-4 w-3/4 bg-muted rounded"></div>
          <div className="animate-pulse h-4 w-2/3 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border border-border p-4 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-red-500/10 border border-red-500/20">
            <Server size={16} className="text-red-500" />
          </div>
          <h3 className="text-sm font-medium font-mono text-red-500">NODE_ERROR</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-mono">
          {error}
        </p>
      </Card>
    );
  }

  if (!nodeInfo) {
    return (
      <Card className="bg-card border border-border p-4 relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 border border-primary/10">
            <Server size={16} className="text-primary" />
          </div>
          <h3 className="text-sm font-medium font-mono">NODE_INFO</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-mono">
          No node information available
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border p-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 border border-primary/10">
            <Server size={16} className="text-primary" />
          </div>
          <h3 className="text-sm font-medium font-mono">NODE_INFO</h3>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono border border-border">
          {codexEndpointType}
        </div>
      </div>
      
      <div className="mt-3 space-y-2 text-sm font-mono">
        {nodeInfo.id && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">NODE_ID:</span>
            <span className="text-xs truncate">{nodeInfo.id}</span>
          </div>
        )}
        
        {nodeInfo.version && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">VERSION:</span>
            <span className="text-xs">{nodeInfo.version}</span>
          </div>
        )}
        
        {nodeInfo.revision !== undefined && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">REVISION:</span>
            <span className="text-xs">{nodeInfo.revision ?? 'N/A'}</span>
          </div>
        )}
        
        {nodeInfo.status && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">STATUS:</span>
            <span className="text-xs">{nodeInfo.status}</span>
          </div>
        )}
        
        {nodeInfo.uptime && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">UPTIME:</span>
            <span className="text-xs">{nodeInfo.uptime}</span>
          </div>
        )}
        
        {nodeInfo.peers !== undefined && (
          <div className="flex items-start">
            <span className="text-xs text-muted-foreground w-24 flex-shrink-0">PEERS:</span>
            <span className="text-xs">{nodeInfo.peers}</span>
          </div>
        )}
      </div>
      
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
    </Card>
  );
}
