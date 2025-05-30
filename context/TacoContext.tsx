// context/TacoContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { useWallet } from "./WalletContext";
import useTaco from "@/hooks/useTaco";
import { domains, conditions } from "@nucypher/taco";
import { ethers } from "ethers";
import { ConditionKind, ConditionArgs } from "@/types/taco";

//-----------------------------------------------------------------------------
// Types
//-----------------------------------------------------------------------------
interface TacoContextType {
  // Initialization status
  isTacoInit: boolean;
  networkError: string | null;
  
  // Core encryption/decryption functions
  encryptDataToBytes: (
    data: string | Uint8Array,
    condition: conditions.condition.Condition,
    encryptorSigner: ethers.Signer
  ) => Promise<Uint8Array | undefined>;
  
  decryptDataFromBytes: (
    encryptedBytes: Uint8Array,
    signer: ethers.Signer
  ) => Promise<Uint8Array>;
  
  
  // Encryption settings
  useEncryption: boolean;
  setUseEncryption: (val: boolean) => void;
  accessConditionType: ConditionKind;
  setAccessConditionType: (val: ConditionKind) => void;
  windowTimeInSeconds: string;
  setWindowTimeSeconds: (val: string) => void;
  nftContractAddress: string;
  setNftContractAddress: (val: string) => void;
  minimumBalance: number;
  setMinimumBalance: (val: number) => void;
  
  // Configuration
  ritualId: number;
  domain: string;
  
  /**
   * Returns an access condition object **and** a user-friendly description
   * based on the selected accessConditionType plus optional parameters.
   * Useful for UI tool-tips and sharing with peers.
   */
  createCondition: <T extends ConditionKind>(
    type: T,
    ...[params]: ConditionArgs[T] extends undefined
      ? []                          // "positive" ⇒ no second argument
      : [ConditionArgs[T]]          // "time" | "nft" ⇒ exactly one object
  ) => Promise<{
    condition: conditions.condition.Condition;
    description: string;
  }>;
}

const TacoContext = createContext<TacoContextType | null>(null);

export const useTacoContext = () => {
  const ctx = useContext(TacoContext);
  if (!ctx) throw new Error("useTacoContext must be used within <TacoProvider>");
  return ctx;
};

//-----------------------------------------------------------------------------
// Provider implementation
//-----------------------------------------------------------------------------
interface Props {
  children: ReactNode;
}

export function TacoProvider({ children }: Props) {
  const {
    provider,
    walletConnected,
  } = useWallet();

  // TACo initialization settings
  const ritualId = 6;
  const domain = domains.TESTNET;
  
  // Encryption settings
  const [useEncryption, setUseEncryption] = useState(false);
  const [accessConditionType, setAccessConditionType] = useState<ConditionKind>("positive");
  const [windowTimeInSeconds, setWindowTimeSeconds] = useState("60");
  const [nftContractAddress, setNftContractAddress] = useState("");
  const [minimumBalance, setMinimumBalance] = useState(1);

  // TACo hook
  const {
    isInit: isTacoInit,
    networkError,
    encryptDataToBytes,
    decryptDataFromBytes,
    createConditions,
  } = useTaco({
    provider: provider as ethers.providers.Provider | undefined,
    domain,
    ritualId,
  });

  // Helper to create a positive balance condition
  const createPositiveBalanceCondition = useCallback((minBalance: number = 1) => {
    if (networkError) throw new Error(networkError);
    return createConditions.positiveBalance(undefined, minBalance);
  }, [createConditions, networkError]);

  // Helper to create a time window condition
  const createTimeWindowCondition = useCallback(
    async (timeWindowInSeconds: number) => {
      if (networkError) throw new Error(networkError);
      return await createConditions.withinNumberOfSeconds(timeWindowInSeconds);
    },
    [createConditions, networkError]
  );

  // Helper to create a time window condition
  const createIsNftOwnerCondition = useCallback(
    async (nftContractAddress: string, minimumBalance: number, chainId: number) => {
      if (networkError) throw new Error(networkError);
      return await createConditions.isNFTOwner(nftContractAddress, minimumBalance, chainId);
    },
    [createConditions, networkError]
  );
  
  // Generate the conditions with human-readable descriptions
  const createCondition = useCallback(
    async <T extends ConditionKind>(
      type: T,
      ...[params]: ConditionArgs[T] extends undefined
        ? []                          // "positive" can now have an optional parameter
        : [ConditionArgs[T]]          // "time" | "nft" ⇒ exactly one object
    ) => {
      if (type === "positive") {
        const condition = createPositiveBalanceCondition(Number(minimumBalance));
        const description = 
          `The account needs to have a minimum network-native token balance of '${minimumBalance}' to decrypt this file`;
        return { condition, description, type } as const;
      }

      if (type === "time") {
        const { windowTimeInSeconds } = params as ConditionArgs["time"];
        // Ensure windowTimeInSeconds is always a number
        const condition   = await createTimeWindowCondition(Number(windowTimeInSeconds));
        const description = `Accessible only within ${windowTimeInSeconds} seconds of ${new Date().toLocaleTimeString()} (${new Date().toLocaleDateString()})`;
        return { condition, description, type } as const;
      }

      if (type === "nft") {
        const { nftContractAddress, minimumBalance, chainId, networkName } = params as ConditionArgs["nft"];
        if (!ethers.utils.isAddress(nftContractAddress)) {
          throw new Error(
            `Please enter a valid ERC721 contract address for the NFT condition. ${nftContractAddress}`
          );
        }
        const condition = await createIsNftOwnerCondition(
          nftContractAddress,
          Number(minimumBalance), // Defaults already applied
          Number(chainId) // Defaults already applied
        );
        const description = `Requires ownership of an NFT from contract ${
            nftContractAddress.substring(0,6)
          }...${
            nftContractAddress.substring(nftContractAddress.length - 4)
          } on chain ${networkName} (${chainId})`;
        return { condition, description, type } as const;
      }

      throw new Error("Invalid access-condition type");
    },
    [createPositiveBalanceCondition, createTimeWindowCondition, createIsNftOwnerCondition]
  );


  // Log initialization status for debugging
  useEffect(() => {
    console.log("TACo initialization status:", {
      isTacoInit,
      networkError,
      walletConnected,
    });
  }, [isTacoInit, networkError, walletConnected]);

  // Context value
  const contextValue: TacoContextType = {
    isTacoInit,
    networkError,
    encryptDataToBytes,
    decryptDataFromBytes,
    useEncryption,
    setUseEncryption,
    accessConditionType,
    setAccessConditionType,
    windowTimeInSeconds,
    setWindowTimeSeconds,
    nftContractAddress,
    setNftContractAddress,
    ritualId,
    domain: domain.toString(),
    minimumBalance,
    setMinimumBalance,
    createCondition,
  };

  return (
    <TacoContext.Provider value={contextValue}>{children}</TacoContext.Provider>
  );
}
