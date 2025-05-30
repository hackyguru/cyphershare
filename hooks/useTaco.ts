import {
  conditions,
  decrypt,
  Domain,
  encrypt,
  initialize,
  ThresholdMessageKit,
} from "@nucypher/taco";
import {
  EIP4361AuthProvider,
  USER_ADDRESS_PARAM_DEFAULT,
} from "@nucypher/taco-auth";
import { ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";

interface UseTacoParams {
  ritualId: number;
  domain: Domain;
  provider: ethers.providers.Provider | undefined;
}

export const SUPPORTED_CHAIN_IDS = [
  80002, // Amoy Polygon testnet
  137, // Polygon mainnet
  11155111, // Sepolia testnet
  1, // Ethereum mainnet
];

export default function useTaco({ ritualId, domain, provider }: UseTacoParams) {
  const [isInit, setIsInit] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const { networkInfo } = useWallet();

  // Validate network and initialize TACo
  useEffect(() => {
    const init = async () => {
      if (!provider) {
        console.log("useTaco: Provider not available for TACo initialization.");
        return;
      }
      try {
        if (!networkInfo) {
          return;
        }
        const network = networkInfo!;

        console.log("useTaco: Connected to network for TACo init:", network);

        if (!SUPPORTED_CHAIN_IDS.includes(network.chainId)) {
          const error = `Network not supported. Please connect to \
            Amoy Polygon testnet (80002), Sepolia testnet (11155111), Polygon (137) or Ethereum (1). \
            Current network: ${network.name} (${network.chainId})`;
          console.error(error);
          setNetworkError(error);
          return;
        }

        setNetworkError(null);
        await initialize();
        setIsInit(true);
        console.log("useTaco: TACo initialized successfully.");
      } catch (error) {
        console.error("useTaco: Error initializing TACo:", error);
        setNetworkError(
          error instanceof Error
            ? error.message
            : "Unknown error initializing TACo"
        );
      }
    };

    init();
  }, [provider, networkInfo]);

  /**
   * Decrypt ciphertext returned as raw bytes (Uint8Array)
   */
  const decryptDataFromBytes = async (
    encryptedBytes: Uint8Array,
    signer: ethers.Signer
  ) => {
    console.log("useTaco: Attempting to decrypt data...");

    if (!isInit || !provider) {
      console.error("useTaco: Decryption pre-check failed:", {
        isInit,
        providerExists: !!provider,
      });
    }

    if (networkError && !isInit) {
      throw new Error(`Cannot decrypt: ${networkError}`);
    }
    if (!isInit) {
      throw new Error("TACo library not initialized. Cannot decrypt.");
    }
    if (!provider) {
      throw new Error("Web3 provider not available. Cannot decrypt.");
    }

    if (networkError) {
      console.warn(
        `useTaco: Continuing decryption attempt despite network error state: ${networkError}. Ensure your wallet can satisfy conditions on their respective chains.`
      );
    }

    try {
      const messageKit = ThresholdMessageKit.fromBytes(encryptedBytes);
      const authProvider = new EIP4361AuthProvider(provider, signer);
      const conditionContext =
        conditions.context.ConditionContext.fromMessageKit(messageKit);
      conditionContext.addAuthProvider(
        USER_ADDRESS_PARAM_DEFAULT,
        authProvider
      );

      console.log(
        "useTaco: Decrypting with (messageKit, conditionContext):",
        messageKit,
        conditionContext
      );
      const result = await decrypt(
        provider,
        domain,
        messageKit,
        conditionContext
      );
      if (!result) {
        throw new Error("Decryption returned empty result");
      }
      return result;
    } catch (error) {
      console.log("Decryption error:", error);

      // Format standard error for TACo decryption failures
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isTacoConditionFailure = errorMessage.includes(
        "Threshold of responses not met"
      );

      throw new Error(
        isTacoConditionFailure
          ? "Access denied: TACo condition not satisfied"
          : `Decryption failed: ${errorMessage}`
      );
    }
  };

  /**
   * Encrypt arbitrary data (string or bytes) under a single access condition.
   * Returns the ciphertext as raw bytes (Uint8Array) that can be uploaded to Codex.
   */
  const encryptDataToBytes = useCallback(
    async (
      data: string | Uint8Array,
      condition: conditions.condition.Condition,
      encryptorSigner: ethers.Signer
    ) => {
      console.log("useTaco: Attempting to encrypt data...");
      if (!isInit || !provider) {
        console.error("useTaco: Encryption pre-check failed:", {
          isInit,
          providerExists: !!provider,
        });
        if (networkError && !isInit)
          throw new Error(`Cannot encrypt: ${networkError}`);
        throw new Error(
          "TACo not initialized or provider not available for encryption."
        );
      }
      try {
        if (!provider)
          throw new Error("Provider became unavailable for encrypt.");
        const messageKit = await encrypt(
          provider,
          domain,
          data,
          condition,
          ritualId,
          encryptorSigner
        );

        console.log("useTaco: Data has been encrypted successfully.");

        return messageKit.toBytes();
      } catch (error) {
        console.error("useTaco: Error during TACo encryption:", error);
        throw error;
      }
    },
    [isInit, provider, domain, ritualId, networkError]
  );

  /**
   * Helpers to create common access conditions
   */
  const createConditions = {
    positiveBalance: (chainId: number = 80002, minimumBalance: number = 1) => {
      console.log(`useTaco: Creating positive balance condition with minimum balance: ${minimumBalance}...`);
      if (networkError && !isInit) {
        throw new Error(`Cannot create condition: ${networkError}`);
      }
      return new conditions.base.rpc.RpcCondition({
        chain: chainId,
        method: "eth_getBalance",
        parameters: [":userAddress", "latest"],
        returnValueTest: {
          comparator: ">=",
          value: minimumBalance,
        },
      });
    },

    // Condition for time-limited access based on seconds from now
    withinNumberOfSeconds: async (timeWindowInSeconds: number) => {
      console.log("useTaco: Creating time condition...");
      if (networkError && !isInit)
        throw new Error(`Cannot create condition: ${networkError}`);
      if (!provider)
        throw new Error(
          "Provider not available for determining current network for time condition."
        );
      const network = await provider.getNetwork();

      // Get current timestamp in seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);
      // Calculate future timestamp
      const expirationTimestamp = currentTimestamp + timeWindowInSeconds;
      console.log("useTaco: Time condition details:", {
        currentNetworkChainId: network.chainId,
        currentTimestamp,
        timeWindowInSeconds,
        expirationTimestamp,
      });
      return new conditions.base.time.TimeCondition({
        chain: network.chainId,
        method: "blocktime",
        returnValueTest: {
          comparator: "<=",
          value: expirationTimestamp,
        },
      });
    },

    // Function accepts parameters for contractAddress and minimumBalance
    isNFTOwner: (
      nftContractAddress: string,
      minimumBalance: number = 1,
      chainId: number = 80002 // default to Amoy Polygon testnet
    ) => {
      console.log(
        `useTaco: Creating Amoy NFT ownership condition for contract: ${nftContractAddress}, min balance: ${minimumBalance}, chainId: ${chainId}`
      );
      if (networkError && !isInit)
        throw new Error(`Cannot create condition: ${networkError}`);

      // Validate the provided address format (basic check, ethers.utils.getAddress will do more)
      if (!ethers.utils.isAddress(nftContractAddress)) {
        throw new Error(
          `Invalid NFT contract address provided: ${nftContractAddress}`
        );
      }

      const checksummedContractAddress =
        ethers.utils.getAddress(nftContractAddress);
      console.log(
        "useTaco: NFT contract (checksummed for SDK):",
        checksummedContractAddress
      );

      // Note: The try-catch for JS SDK constructor for checksum vs lowercase might still be relevant
      // if the SDK is very particular. For now, we'll assume ethers.utils.getAddress() output is fine.
      // If you get "Invalid Ethereum address" from the JS SDK during encryption, re-introduce the try-catch.
      return new conditions.base.contract.ContractCondition({
        chain: chainId,
        contractAddress: checksummedContractAddress,
        method: "balanceOf",
        parameters: [":userAddress"],
        returnValueTest: {
          comparator: ">=",
          value: minimumBalance,
        },
        standardContractType: "ERC721",
      });
    },
  };

  return {
    isInit,
    networkError,
    encryptDataToBytes,
    decryptDataFromBytes,
    createConditions,
  };
}
