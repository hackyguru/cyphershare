// components/waku/WakuDebugConsole.tsx
import { useState, useEffect, useCallback } from "react";
import { Terminal, XCircle, Info, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileTransfer } from "@/context/FileTransferContext";
import { cn } from "@/lib/utils";

type LogType = 'info' | 'error' | 'success';

interface WakuDebugLog {
  type: LogType;
  message: string;
  timestamp: string;
}

export default function WakuDebugConsole() {
  const { isWakuConnected, isWakuConnecting, wakuPeerCount } = useFileTransfer();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<WakuDebugLog[]>([]);

  // Add a debug log
  const addLog = useCallback((type: LogType, message: string) => {
    setLogs(prev => [
      {
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev.slice(0, 19) // Keep only the last 20 logs
    ]);
  }, []);

  // Simulate connection logs on mount and connection change
  useEffect(() => {
    if (isWakuConnected) {
      addLog('success', `Connected to Waku network (${wakuPeerCount} peers)`);
    } else if (isWakuConnecting) {
      addLog('info', 'Connecting to Waku network...');
    } else {
      addLog('info', 'Not connected to Waku network');
    }
  }, [isWakuConnected, wakuPeerCount, isWakuConnecting]);

  // Get icon based on log type
  const getLogIcon = (type: 'info' | 'error' | 'success') => {
    switch (type) {
      case 'info':
        return <Info size={14} className="text-blue-500" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-500" />;
      case 'success':
        return <CheckCircle size={14} className="text-green-500" />;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Debug Console Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "rounded-full p-2 h-10 w-10 border border-primary/20 relative shadow-md",
          isOpen ? "bg-primary/10" : "bg-card"
        )}
        title="Waku Debug Console"
      >
        <Terminal size={18} className="text-primary" />
        <div
          className={cn(
            "absolute -top-1 -right-1 w-3 h-3 rounded-full border border-card",
            isWakuConnected ? "bg-green-500 animate-pulse" : 
            isWakuConnecting ? "bg-amber-500" : "bg-red-500"
          )}
          title={!isWakuConnected ? "Waku not connected" : 
                 isWakuConnecting ? "Waku connecting" : "Waku connected"}
        ></div>
      </Button>

      {/* Debug Console Panel */}
      {isOpen && (
        <div className="bg-card border border-border rounded-lg shadow-lg w-80 sm:w-96 absolute bottom-12 right-0 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-primary" />
              <span className="font-mono text-sm">WAKU_DEBUG_CONSOLE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                {wakuPeerCount} {wakuPeerCount === 1 ? 'peer' : 'peers'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <XCircle size={16} className="text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-64 bg-black/90">
            <div className="p-2 font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground p-2 text-center">No logs yet</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 p-1 hover:bg-white/5 rounded">
                    <span className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
                    <span className="text-muted-foreground">[{log.timestamp}]</span>
                    <span className={cn(
                      log.type === 'info' && "text-blue-300",
                      log.type === 'error' && "text-red-300",
                      log.type === 'success' && "text-green-300"
                    )}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex border-t border-border">
            <Button 
              onClick={() => setLogs([])}
              variant="ghost" 
              className="flex-1 h-8 text-xs font-mono rounded-none text-red-400"
            >
              Clear Logs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
