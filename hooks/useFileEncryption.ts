// /hooks/useFileEncryption.ts
// Hook to handle encryption/decryption logic for files,
// extracted from FileTransferContext to make it reusable

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useWallet } from "@/context/WalletContext";
import { useTacoContext } from "@/context/TacoContext";
import {
  ConditionKind,
  ConditionArgs,
  applyConditionDefaults,
} from "@/types/taco";

export interface EncryptionResult {
  encryptedFile: File | null;
  accessCondition?: string;
  error?: Error;
}

export interface DecryptionResult {
  decryptedBlob: Blob | null;
  error?: Error;
}

interface EncryptOptions {
  accessConditionType?: ConditionKind;
  accessConditionArgs?: ConditionArgs;
}

interface DecryptOptions {
  fileType?: string;
  accessCondition?: string;
}

export const useFileEncryption = () => {
  const [error, setError] = useState<Error | null>(null);

  const { signer, walletConnected } = useWallet();
  const {
    isTacoInit,
    encryptDataToBytes,
    decryptDataFromBytes,
    createCondition,
  } = useTacoContext();

  // Check if encryption requirements are met
  const checkEncryptionRequirements = useCallback((): {
    success: boolean;
    reason?: string;
  } => {
    if (!walletConnected) {
      toast.error(
        "Encryption requested, but wallet is not connected. Please connect your wallet."
      );
      setError(new Error("Wallet not connected for encryption."));
      return { success: false, reason: "wallet-disconnected" };
    }

    if (!signer) {
      toast.error(
        "Encryption requested, but wallet signer is not available. Please reconnect your wallet."
      );
      setError(new Error("Wallet signer not available for encryption."));
      return { success: false, reason: "wallet-signer-not-available" };
    }

    if (!isTacoInit) {
      toast.error(
        "Encryption service (TACo) is not ready. Please try again in a moment."
      );
      setError(new Error("Encryption service not ready."));
      return { success: false, reason: "taco-not-initialized" };
    }

    return { success: true };
  }, [walletConnected, signer, isTacoInit]);

  // Encrypt a file with access conditions
  const encryptFile = useCallback(
    async (
      file: File,
      options: EncryptOptions = {}
    ): Promise<EncryptionResult> => {
      const {
        accessConditionType = "positive",
        accessConditionArgs = applyConditionDefaults(
          options.accessConditionArgs || {}
        ),
      } = options;
      // Verify encryption requirements
      const requirements = checkEncryptionRequirements();
      if (!requirements.success) {
        return { encryptedFile: null, error: new Error(requirements.reason) };
      }

      try {
        // Get condition with description using the central helper
        console.log(`Creating ${accessConditionType} condition...`);
        const { condition: accessCond, description } = await createCondition(
          accessConditionType,
          accessConditionArgs[accessConditionType]
        );

        // Ensure signer is available
        if (!signer) {
          throw new Error("Signer unexpectedly became null during encryption");
        }

        // Read and encrypt file
        const arrayBuff = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuff);
        const cipherBytes = await encryptDataToBytes(bytes, accessCond, signer);

        if (!cipherBytes) {
          throw new Error("Encryption failed - received empty result");
        }

        // Create encrypted file
        const encryptedFile = new File([cipherBytes], `${file.name}.enc`, {
          type: "application/octet-stream",
        });

        return {
          encryptedFile,
          accessCondition: description,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown encryption error";
        setError(new Error(errorMsg));
        toast.error("Encryption failed", { description: errorMsg });
        console.error("File encryption error:", errorMsg);
        return { encryptedFile: null };
      }
    },
    [
      checkEncryptionRequirements,
      createCondition,
      encryptDataToBytes,
      signer,
      setError,
    ]
  );

  // Decrypt a blob with the correct access condition
  const decryptBlob = useCallback(
    async (
      blob: Blob,
      options: DecryptOptions = {}
    ): Promise<DecryptionResult> => {
      const { fileType, accessCondition } = options;

      // Verify decryption requirements
      if (!walletConnected) {
        setError(new Error("Wallet not connected – connect wallet to decrypt"));
        toast.error("Wallet not connected", {
          description: "Please connect your wallet to decrypt this file.",
        });
        return {
          decryptedBlob: null,
          error: new Error("Wallet not connected"),
        };
      }

      if (!signer) {
        setError(new Error("Wallet not providing signer – please reconnect"));
        toast.error("No wallet signer", {
          description: "Please reconnect your wallet to decrypt this file.",
        });
        return { decryptedBlob: null, error: new Error("No wallet signer") };
      }

      if (!isTacoInit) {
        setError(
          new Error("TACo not initialized - please try again in a moment")
        );
        toast.error("TACo not initialized", {
          description:
            "The encryption service is not ready. Please try again in a moment.",
        });
        return {
          decryptedBlob: null,
          error: new Error("TACo not initialized"),
        };
      }

      try {
        // Convert blob to bytes
        const bytes = new Uint8Array(await blob.arrayBuffer());

        // Ensure signer is available (TypeScript safety)
        if (!signer) {
          throw new Error("Signer unexpectedly became null during decryption");
        }

        // Perform decryption
        const plainBytes = await decryptDataFromBytes(bytes, signer);

        if (!plainBytes) {
          throw new Error("Decryption returned empty result");
        }

        // Create decrypted blob with original type if available
        const decryptedBlob = new Blob([plainBytes], {
          type: fileType || "application/octet-stream",
        });

        return { decryptedBlob };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("File decryption error:", errorMsg);

        // Provide user-friendly error messages for common conditions
        if (
          errorMsg.includes("Threshold of responses not met") ||
          errorMsg.includes("condition not satisfied")
        ) {
          // If accessCondition is the full description, use it directly
          // Otherwise fallback to generic condition descriptions
          let conditionDesc;

          // Check if we already have a full description string
          if (
            accessCondition &&
            (accessCondition.includes("balance") ||
              accessCondition.includes("seconds") ||
              accessCondition.includes("Accessible"))
          ) {
            conditionDesc = accessCondition;
          }
          // Otherwise build a generic description based on type
          else if (accessCondition === "positive") {
            conditionDesc =
              "Your wallet must have a positive balance to access this file";
          } else if (accessCondition === "time") {
            conditionDesc =
              "This file is time-locked and can only be accessed within the specified time window";
          } else {
            conditionDesc =
              "This file requires specific conditions to be met for decryption";
          }

          toast.error("Access denied: TACo condition not satisfied", {
            description: conditionDesc,
            duration: 30000,
          });

          return {
            decryptedBlob: null,
            error: new Error(`Access denied: ${conditionDesc}`),
          };
        }

        // Generic error message
        toast.error("Decryption failed", {
          description: errorMsg,
          duration: 10000,
        });

        return {
          decryptedBlob: null,
          error: new Error(errorMsg),
        };
      }
    },
    [walletConnected, signer, isTacoInit, setError]
  );

  return {
    encryptFile,
    decryptBlob,
    checkEncryptionRequirements,
    error,
    setError,
  };
};
