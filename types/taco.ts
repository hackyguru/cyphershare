export type ConditionKind = "positive" | "time" | "nft";

export type ConditionArgs = {
  positive: { minimumBalance?: number };
  time: { windowTimeInSeconds?: number };
  nft: {
    nftContractAddress: string;
    minimumBalance?: number;
    chainId?: number;
    networkName?: string;
  };
};

/**
 * Applies default values to partial ConditionArgs
 * @template T - Type parameter extending Partial<ConditionArgs>
 * @param partialCondition The partial condition arguments to apply defaults to
 * @returns A complete ConditionArgs object with defaults applied
 */
export function applyConditionDefaults<T extends Partial<ConditionArgs>>(
  partialCondition: T
): Required<ConditionArgs> {
  // Create a properly typed object with all defaults applied
  return {
    positive: {
      minimumBalance: partialCondition.positive?.minimumBalance ?? 1,
    },
    time: {
      windowTimeInSeconds: partialCondition.time?.windowTimeInSeconds ?? 60, // Default: 60 seconds
    },
    nft: {
      nftContractAddress: partialCondition.nft?.nftContractAddress ?? "",
      minimumBalance: partialCondition.nft?.minimumBalance ?? 1, // Default: 1
      chainId: partialCondition.nft?.chainId ?? 80002, // Default: Amoy Polygon testnet
      networkName: partialCondition.nft?.networkName ?? "Amoy Polygon testnet",
    },
  };
}
