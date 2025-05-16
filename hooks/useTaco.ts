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

interface UseTacoParams {
  ritualId: number;
  domain: Domain;
  provider: ethers.providers.Provider | undefined;
}

export default function useTaco({ ritualId, domain, provider }: UseTacoParams) {
  const [isInit, setIsInit] = useState(false);

  // Initialise the TACo runtime once on mount
  useEffect(() => {
    initialize().then(() => setIsInit(true));
  }, []);

  /**
   * Decrypt ciphertext returned as raw bytes (Uint8Array)
   */
  const decryptDataFromBytes = async (
    encryptedBytes: Uint8Array,
    signer: ethers.Signer
  ) => {
    console.log("Decrypting data...");
    if (!isInit || !provider) return;

    const messageKit = ThresholdMessageKit.fromBytes(encryptedBytes);
    const authProvider = new EIP4361AuthProvider(provider, signer);
    const conditionContext =
      conditions.context.ConditionContext.fromMessageKit(messageKit);
    conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

    console.log("Decrypting data...", messageKit, conditionContext);
    return await decrypt(provider, domain, messageKit, conditionContext);
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
      console.log("Encrypting data...");
      if (!isInit || !provider) return;

      // Ensure we always provide a string to `encrypt`
      const payload =
        typeof data === "string" ? data : new TextDecoder().decode(data);

      try {
        const messageKit = await encrypt(
          provider,
          domain,
          payload,
          condition,
          ritualId,
          encryptorSigner
        );

        console.log("Data has been encrypted...");

        return messageKit.toBytes();
      } catch (error) {
        console.error("Error encrypting data:", error);
        throw error;
      }
    },
    [isInit, provider, domain, ritualId]
  );

  /**
   * Helpers to create common access conditions
   */
  const createConditions = {
    positiveBalance: () => {
      console.log("Creating positive balance condition...");
      return new conditions.base.rpc.RpcCondition({
        chain: 80002, // Polygon Amoy testnet
        method: "eth_getBalance",
        parameters: [":userAddress", "latest"],
        returnValueTest: {
          comparator: ">",
          value: 0,
        },
      });
    },

    // Condition for time-limited access based on seconds from now
    withinNumberOfSeconds: async (timeWindowInSeconds: number) => {
      console.log("Creating time condition...");
      // Get current timestamp in seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);
      // Calculate future timestamp
      const expirationTimestamp = currentTimestamp + timeWindowInSeconds;

      console.log(await provider!.getNetwork());
      console.log("Current timestamp:", currentTimestamp);
      console.log("Time window (seconds):", timeWindowInSeconds);
      console.log("Expiration timestamp:", expirationTimestamp);

      return new conditions.base.time.TimeCondition({
        chain: (await provider!.getNetwork()).chainId,
        method: "blocktime",
        returnValueTest: {
          comparator: "<=",
          value: expirationTimestamp,
        },
      });
    },
  };

  return {
    isInit,
    encryptDataToBytes,
    decryptDataFromBytes,
    createConditions,
  };
}
