import React from "react";
import { Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/wallet-context";

interface WalletConnectButtonProps {
  className?: string;
}

export function WalletConnectButton({
  className = "",
}: WalletConnectButtonProps = {}) {
  const { walletConnected, connectWallet, truncatedAddress } = useWallet();
  return (
    <Button
      onClick={connectWallet}
      variant={walletConnected ? "outline" : "default"}
      disabled={walletConnected}
      className={`font-mono text-sm ${className}`}
    >
      {walletConnected ? (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>{truncatedAddress}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>Connect Wallet</span>
        </div>
      )}
    </Button>
  );
}
