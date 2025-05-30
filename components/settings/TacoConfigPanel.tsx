// components/files/TacoConfigPanel.tsx
import { Shield, Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTacoContext } from "@/context/TacoContext";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet } from "@/context/WalletContext";
import { useRef } from "react";
import { Input } from "../ui/input";
import { ConditionKind } from '@/types/taco';

export default function TacoConfigPanel() {
  const {
    useEncryption,
    setUseEncryption,
    accessConditionType,
    setAccessConditionType,
    windowTimeInSeconds,
    setWindowTimeSeconds,
    nftContractAddress,
    setNftContractAddress,
    minimumBalance,
    setMinimumBalance,
    isTacoInit,
  } = useTacoContext();
  const { walletConnected } = useWallet();

  const timeInputRef = useRef<HTMLDivElement>(null);
  const nftContractAddressInputRef = useRef<HTMLDivElement>(null);
  const minimumBalanceInputRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Shield size={16} className="text-primary" />
          </div>
          <h3 className="text-base font-medium font-mono">TACO_SETTINGS</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* {walletConnected ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Wallet connected"></div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-amber-600/80" title="Wallet not connected"></div>
          )}
          {isTacoInit ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="TACo initialized"></div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-500" title="TACo not initialized"></div>
          )} */}
          {useEncryption ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Encryption enabled"></div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-amber-600/80" title="Encryption disabled"></div>
          )}
        </div>
      </div>

      <div className="space-y-4 pl-2 ml-2 border-l border-border">
        <div className="space-y-2">
          <label className="text-sm font-medium font-mono">Wallet Connection</label>
          <WalletConnectButton className="w-full" />
          <p className="text-xs text-muted-foreground font-mono">
            {!walletConnected
              ? "Connect your wallet to enable TACo encryption"
              : !isTacoInit
              ? "Wallet connected, but TACo is not initialized"
              : "Wallet connected - TACo encryption available"}
          </p>
        </div>

        {/* Encryption toggle */}
        <div className="space-y-2">
          <label className="text-sm font-medium font-mono">Encryption</label>
          <div className="flex items-center space-x-2">
            <Switch
              id="encryption-toggle"
              checked={useEncryption}
              onCheckedChange={setUseEncryption}
              disabled={!walletConnected || !isTacoInit}
            />
            <Label htmlFor="encryption-toggle" className="cursor-pointer">
              {useEncryption ? (
                <div className="flex items-center gap-2 text-primary">
                  <Lock className="h-4 w-4" />
                  <span>Encryption Enabled</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Unlock className="h-4 w-4" />
                  <span>Encryption Disabled</span>
                </div>
              )}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Protect your shared files with TACo encryption
          </p>
        </div>

        {/* Access Condition */}
        {useEncryption && walletConnected && (
          <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
            <div className="flex items-center gap-1 mb-3">
              <Shield size={12} className="text-primary/70" />
              <span className="text-xs font-medium text-primary/90 font-mono">ACCESS_CONDITION</span>
            </div>
            <div className="space-y-3 pl-4 border-l border-primary/10">
              <RadioGroup
                value={accessConditionType}
                onValueChange={(val) => setAccessConditionType(val as ConditionKind)}
                className="flex flex-col"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="positive" id="positive" />
                  <Label htmlFor="positive" className="text-xs font-mono">
                    POSITIVE_BALANCE
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time" id="time" />
                  <Label htmlFor="time" className="text-xs font-mono">
                    TIME_WINDOW
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nft" id="nft" />
                  <Label htmlFor="nft" className="text-xs font-mono">
                    NFT_OWNERSHIP
                  </Label>
                </div>
              </RadioGroup>

              {accessConditionType === "positive" && (
                <div ref={minimumBalanceInputRef} className="space-y-1">
                  <Label htmlFor="minimum-balance" className="text-xs font-mono text-muted-foreground">
                    MINIMUM_BALANCE
                  </Label>
                  <Input
                    id="minimum-balance"
                    type="number"
                    min="0"
                    placeholder="1"
                    value={minimumBalance}
                    onChange={(e) => setMinimumBalance(Number(e.target.value))}
                    className="font-mono text-sm bg-card/70"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    Minimum network-native token balance required to decrypt and access the file
                  </p>
                </div>
              )}

              {accessConditionType === "time" && (
                <div ref={timeInputRef} className="space-y-1">
                  <Label htmlFor="window-time" className="text-xs font-mono text-muted-foreground">
                    WINDOW_TIME_IN_SECONDS
                  </Label>
                  <Input
                    id="window-time"
                    placeholder="60"
                    value={windowTimeInSeconds}
                    onChange={(e) => setWindowTimeSeconds(e.target.value)}
                    className="font-mono text-sm bg-card/70"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    Access limited to specified time window in seconds
                  </p>
                </div>
              )}

            {accessConditionType === 'nft' && (
                <div ref={nftContractAddressInputRef} className="space-y-1">
                  <Label htmlFor="nft-contract-address" className="text-xs font-mono text-muted-foreground">NFT_CONTRACT_ADDRESS</Label>
                  <Input id="nft-contract-address" placeholder="0x..." value={nftContractAddress} onChange={(e) => setNftContractAddress(e.target.value)} className="font-mono text-sm bg-card/70" />
                  <p className="text-xs text-muted-foreground font-mono">Enter the ERC721 contract address on the Connected Network.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
