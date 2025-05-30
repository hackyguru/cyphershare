/**
 * useCodex.ts - Central file for Codex API functionality
 *
 * This file contains:
 * 1. Type definitions for Codex API
 * 2. CodexClient class implementation
 * 3. Singleton management functions
 * 4. React hook for component integration
 */

import { useState, useEffect, useCallback } from "react";

//-----------------------------------------------------------------------------
// TYPE DEFINITIONS
//-----------------------------------------------------------------------------

export interface CodexNodeInfo {
  version: string;
  status: string;
  uptime: string;
  peers?: number;
  [key: string]: unknown; // For any additional fields in the response
}

interface CodexApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type CodexEndpointType = "remote" | "local";

type CodexHeaders = Record<string, string>;

export interface FileMetadata {
  manifest: {
    filename: string;
    mimetype: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

//-----------------------------------------------------------------------------
// CODEX CLIENT IMPLEMENTATION
//-----------------------------------------------------------------------------

/**
 * Class to handle all Codex-related operations
 */
export class CodexClient {
  private baseUrl: string;
  private isActive: boolean = false;
  private lastChecked: number = 0;
  private checkInterval: number = 30000; // Check every 30 seconds
  private endpointType: CodexEndpointType;
  private authHeaders?: CodexHeaders;

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_CODEX_REMOTE_API_URL || "",
    endpointType: CodexEndpointType = "remote"
  ) {
    // Validate and format the base URL
    if (!baseUrl) {
      console.error(
        "No base URL provided and NEXT_PUBLIC_CODEX_REMOTE_API_URL environment variable is not set"
      );
      baseUrl = ""; // Set empty string to allow initialization, but client won't work
    }

    // For remote endpoint, use our proxy API
    if (endpointType === "remote") {
      baseUrl = "/api/codex";
    }

    this.baseUrl = baseUrl;
    this.endpointType = endpointType;
    // Log configuration on initialization
    console.log("=== CODEX CLIENT CONFIGURATION ===");
    console.log("Endpoint Type:", endpointType);
    console.log("Base URL:", baseUrl);
    console.log("Environment Variables:", {
      NEXT_PUBLIC_CODEX_REMOTE_API_URL:
        process.env.NEXT_PUBLIC_CODEX_REMOTE_API_URL || "not set",
      NEXT_PUBLIC_CODEX_LOCAL_API_URL:
        process.env.NEXT_PUBLIC_CODEX_LOCAL_API_URL || "not set",
      NEXT_PUBLIC_CODEX_REMOTE_API_USERNAME: process.env
        .NEXT_PUBLIC_CODEX_REMOTE_API_USERNAME
        ? "✓ set"
        : "✗ not set",
      NEXT_PUBLIC_CODEX_REMOTE_API_PASSWORD: process.env
        .NEXT_PUBLIC_CODEX_REMOTE_API_PASSWORD
        ? "✓ set"
        : "✗ not set",
    });
    console.log("================================");

    this.updateAuthHeaders();
  }

  /**
   * Update the configuration for the Codex API
   */
  public updateConfig(newUrl: string, endpointType: CodexEndpointType): void {
    console.log("=== UPDATING CODEX CONFIGURATION ===");
    console.log("Previous Config:", {
      baseUrl: this.baseUrl,
      endpointType: this.endpointType,
    });

    // For remote endpoint, use our proxy API
    if (endpointType === "remote") {
      newUrl = "/api/codex";
    }

    console.log("New Config:", {
      baseUrl: newUrl,
      endpointType: endpointType,
    });

    this.baseUrl = newUrl;
    this.endpointType = endpointType;
    this.updateAuthHeaders();
    this.isActive = false;
    this.lastChecked = 0;

    console.log("Configuration updated successfully");
    console.log("=================================");
  }

  /**
   * Update authentication headers based on endpoint type
   */
  private updateAuthHeaders(): void {
    // We don't need auth headers anymore as they're handled by the proxy
    this.authHeaders = undefined;
  }

  /**
   * Get the current base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the current endpoint type
   */
  public getEndpointType(): CodexEndpointType {
    return this.endpointType;
  }

  /**
   * Get fetch options based on endpoint type
   */
  private getFetchOptions(options: RequestInit = {}): RequestInit {
    const baseOptions: RequestInit = {
      ...options,
      mode: "cors",
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
        ...(this.authHeaders || {}),
      },
    };

    // Only include credentials for remote endpoints
    if (this.endpointType === "remote") {
      baseOptions.credentials = "include";
    }

    return baseOptions;
  }

  /**
   * Check if the Codex node is active
   * @param forceCheck - Force a check even if the cache is still valid
   * @returns Promise resolving to a boolean indicating if the node is active
   */
  public async isNodeActive(forceCheck: boolean = false): Promise<boolean> {
    const now = Date.now();

    // Return cached result if it's recent enough and not forcing a check
    if (!forceCheck && now - this.lastChecked < this.checkInterval) {
      return this.isActive;
    }

    try {
      // Create an AbortController with timeout for browsers that don't support AbortSignal.timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `${this.baseUrl}/v1/debug/info`;
      console.log("=== CHECKING CODEX NODE STATUS ===");
      console.log("URL:", url);
      console.log("Endpoint Type:", this.endpointType);

      const response = await fetch(
        url,
        this.getFetchOptions({
          method: "GET",
          signal: controller.signal,
        })
      );

      clearTimeout(timeoutId);

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const text = await response.text();
        console.log("Error response:", text);
      }

      this.isActive = response.ok;
      this.lastChecked = now;
      console.log("Node active:", this.isActive);
      console.log("===============================");
      return this.isActive;
    } catch (error) {
      console.error(
        "Error checking node status:",
        error instanceof Error ? error.message : String(error)
      );
      this.isActive = false;
      this.lastChecked = now;
      return false;
    }
  }

  /**
   * Get information about the Codex node
   * @returns Promise resolving to node info or null if request fails
   */
  public async getNodeInfo(): Promise<CodexNodeInfo | null> {
    try {
      // Add timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${this.baseUrl}/v1/debug/info`,
        this.getFetchOptions({
          method: "GET",
          signal: controller.signal,
        })
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data as CodexNodeInfo;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Could not fetch Codex node info:",
          error instanceof Error ? error.message : String(error)
        );
      }
      return null;
    }
  }

  /**
   * Generic method to make API requests to the Codex node
   * @param endpoint - API endpoint (without the base URL)
   * @param method - HTTP method
   * @param body - Request body for POST/PUT requests
   * @returns Promise resolving to the API response
   */
  public async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<CodexApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${
        endpoint.startsWith("/") ? endpoint : "/" + endpoint
      }`;

      const options = this.getFetchOptions({
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (body && (method === "POST" || method === "PUT")) {
        options.body = JSON.stringify(body);
      }

      // Add timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;

      try {
        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        // Try to parse JSON, but handle case where response might not be valid JSON
        let data;
        try {
          data = await response.json();
        } catch {
          data = { error: "Invalid response format" };
        }

        return {
          success: response.ok,
          data: response.ok ? data : undefined,
          error: !response.ok
            ? data.error || `HTTP error! Status: ${response.status}`
            : undefined,
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          success: false,
          error: "Request timed out. The Codex node might be unresponsive.",
        };
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          success: false,
          error: "Cannot connect to Codex node. Please check if it is running.",
        };
      }

      if (process.env.NODE_ENV !== "production") {
        console.error("Error making request:", error);
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Upload a file to the Codex node
   * @param file - The file to upload
   * @param onProgress - Optional callback for upload progress
   * @returns Promise resolving to the upload response or error
   */
  public async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const url = `${this.baseUrl}/v1/data`;

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        // Set up progress tracking
        if (onProgress) {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round(
                (event.loaded / event.total) * 100
              );
              onProgress(percentComplete);
            }
          });
        }

        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.setRequestHeader(
          "Content-Disposition",
          `attachment; filename='${file.name}'`
        );

        // Add auth headers if they exist
        if (this.authHeaders) {
          Object.entries(this.authHeaders).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }

        xhr.onload = function () {
          // Log the raw response text first, before any parsing
          console.log("=== RAW CODEX UPLOAD RESPONSE ===");
          console.log("Status:", xhr.status);
          console.log("Response Text:", xhr.responseText);
          console.log("Response Headers:", xhr.getAllResponseHeaders());
          console.log("===============================");

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Try to parse as JSON
              let response;
              try {
                response = JSON.parse(xhr.responseText);
                console.log("Parsed JSON response:", response);
              } catch {
                // Response is not JSON, using raw text
                console.log("Response is not JSON, using raw text");
                response = xhr.responseText.trim();
              }

              // Extract the CID from the response
              const cid =
                typeof response === "object"
                  ? response.id ||
                    response.cid ||
                    (response.data && (response.data.id || response.data.cid))
                  : response;

              if (!cid) {
                console.warn(
                  "No CID found in Codex upload response:",
                  response
                );
                // Try to extract CID from raw response if it's just a string
                const rawResponse = xhr.responseText.trim();
                if (
                  rawResponse &&
                  !rawResponse.includes("{") &&
                  !rawResponse.includes("[")
                ) {
                  console.log("Using raw response as CID:", rawResponse);
                  resolve({
                    success: true,
                    id: rawResponse,
                  });
                  return;
                }
              } else {
                console.log(
                  "%c File uploaded successfully! CID: " + cid,
                  "background: #222; color: #bada55; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
                );
              }

              resolve({
                success: true,
                id: cid,
              });
            } catch {
              // If response is not JSON but status is success
              console.warn("Failed to parse Codex upload response");
              console.log("Raw response text:", xhr.responseText);

              // If the response is a plain string, it might be the CID directly
              const rawText = xhr.responseText.trim();
              resolve({
                success: true,
                id: rawText, // Use the raw text as the ID
              });
            }
          } else {
            console.error("Upload failed with status:", xhr.status);
            let errorMessage = "Upload failed";
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              errorMessage = errorResponse.error || errorMessage;
              console.error("Error response:", errorResponse);
            } catch {
              // If error response is not JSON
              errorMessage = `Upload failed with status ${xhr.status}: ${xhr.responseText}`;
              console.error("Error response (not JSON):", xhr.responseText);
            }
            resolve({ success: false, error: errorMessage });
          }
        };

        xhr.onerror = function () {
          console.error("Network error during upload");
          resolve({
            success: false,
            error: "Network error occurred during upload",
          });
        };

        xhr.send(file);
      });
    } catch (error) {
      // Handle network errors more gracefully
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          success: false,
          error: "Request timed out. The Codex node might be unresponsive.",
        };
      }

      // For network errors (like when node is not running)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          success: false,
          error: "Cannot connect to Codex node. Please check if it is running.",
        };
      }

      // For other errors
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading file:", error);
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Test direct upload to Codex node
   * @returns Promise resolving to upload result with CID or error
   */
  public async testDirectUpload(): Promise<{
    success: boolean;
    id?: string;
    message?: string;
    error?: string;
  }> {
    try {
      // Create a test file with timestamp to ensure uniqueness
      const timestamp = new Date().toISOString();
      const testContent = `This is a test file created at ${timestamp}`;
      const blob = new Blob([testContent], { type: "text/plain" });
      const fileName = `test-file-${Date.now()}.txt`;

      console.log("Uploading test file directly to Codex API...");
      console.log(`URL: ${this.baseUrl}/v1/data`);
      console.log(`File: ${fileName}`);

      const response = await fetch(`${this.baseUrl}/v1/data`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename='${fileName}'`,
          ...(this.authHeaders || {}),
        },
        mode: "cors",
        credentials: "include",
        body: blob,
      });

      console.log("========== DIRECT UPLOAD RESPONSE ==========");
      console.log("Status:", response.status);
      console.log("Status Text:", response.statusText);
      console.log("Headers:");
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });

      // Try to get the response as text first
      const responseText = await response.text();
      console.log("Response Text:", responseText);
      console.log("===========================================");

      // Try to parse as JSON if possible
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log("Parsed JSON response:", jsonResponse);

        // Extract CID
        const cid =
          jsonResponse.id ||
          jsonResponse.cid ||
          (jsonResponse.data &&
            (jsonResponse.data.id || jsonResponse.data.cid));

        if (cid) {
          console.log(
            "%c Direct upload CID: " + cid,
            "background: #222; color: #bada55; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
          );
          return {
            success: true,
            id: cid,
            message: `Direct upload successful. CID: ${cid}`,
          };
        }
        return {
          success: true,
          id: "unknown-id",
          message: "Upload successful but no CID found",
        };
      } catch {
        // If not JSON, the response text might be the CID directly
        if (responseText && response.ok) {
          console.log(
            "%c Direct upload CID (from text): " + responseText.trim(),
            "background: #222; color: #bada55; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
          );
          return {
            success: true,
            id: responseText.trim(),
            message: `Direct upload successful. CID: ${responseText.trim()}`,
          };
        }

        // Something went wrong but we got a 200 OK response
        if (response.ok) {
          return {
            success: true,
            message: "Upload successful but response format is unexpected",
          };
        }

        // Error response
        return {
          success: false,
          error: `Upload failed with status ${response.status}: ${responseText}`,
        };
      }
    } catch (error) {
      console.error("Error in direct upload test:", error);
      return {
        success: false,
        error: `Direct upload test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Get file metadata from Codex
   * @param fileId - The Codex file ID (CID)
   * @returns Promise resolving to file metadata
   */
  public async getFileMetadata(
    fileId: string
  ): Promise<{ success: boolean; metadata?: FileMetadata; error?: string }> {
    try {
      const metadataUrl = `${this.baseUrl}/v1/data/${fileId}/network`;
      console.log(`Fetching metadata from: ${metadataUrl}`);

      const response = await fetch(metadataUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.authHeaders || {}),
        },
        mode: "cors",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, metadata: data };
    } catch (error) {
      console.error("Error fetching file metadata:", error);
      let errorMessage = "Failed to fetch file metadata";

      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Download a file from Codex
   * @param fileId - The Codex file ID (CID)
   * @returns Promise resolving to file data and metadata
   */
  public async downloadFile(fileId: string): Promise<{
    success: boolean;
    data?: Blob;
    metadata?: {
      filename: string;
      mimetype: string;
    };
    error?: string;
  }> {
    try {
      // Step 1: Get the file metadata
      const metadataResult = await this.getFileMetadata(fileId);
      if (!metadataResult.success || !metadataResult.metadata) {
        return {
          success: false,
          error: metadataResult.error || "Failed to fetch file metadata",
        };
      }

      const { manifest } = metadataResult.metadata;
      const { filename, mimetype } = manifest;

      console.log("File metadata:", {
        filename,
        mimetype,
        manifest,
      });

      // Step 2: Download the file content
      const downloadUrl = `${this.baseUrl}/v1/data/${fileId}/network/stream`;
      console.log(`Downloading file from: ${downloadUrl}`);

      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          Accept: "*/*",
          ...(this.authHeaders || {}),
        },
        mode: "cors",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const blob = await response.blob();

      return {
        success: true,
        data: blob,
        metadata: {
          filename,
          mimetype,
        },
      };
    } catch (error) {
      console.error("Error downloading file:", error);
      let errorMessage = "Failed to download file";

      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }

      return { success: false, error: errorMessage };
    }
  }
}

//-----------------------------------------------------------------------------
// SINGLETON MANAGEMENT
//-----------------------------------------------------------------------------

let codexClientInstance: CodexClient | null = null;

/**
 * Get the CodexClient instance (creates one if it doesn't exist)
 */
export function getCodexClient(
  baseUrl?: string,
  endpointType?: CodexEndpointType
): CodexClient {
  if (!codexClientInstance) {
    codexClientInstance = new CodexClient(baseUrl, endpointType);
  } else if (baseUrl && endpointType) {
    codexClientInstance.updateConfig(baseUrl, endpointType);
  }

  return codexClientInstance;
}

/**
 * Reset the CodexClient instance (useful for testing)
 */
export function resetCodexClient(): void {
  codexClientInstance = null;
}

/**
 * Standalone function to get node info using the singleton client
 * This can be imported and used directly without using the useCodex hook
 */
export async function getNodeInfo(): Promise<CodexNodeInfo | null> {
  return getCodexClient().getNodeInfo();
}

//-----------------------------------------------------------------------------
// REACT HOOK
//-----------------------------------------------------------------------------

/**
 * React hook for using the Codex client in components
 */
export function useCodex(
  initialUrl?: string,
  initialEndpointType?: CodexEndpointType
) {
  const [client] = useState<CodexClient>(() =>
    getCodexClient(initialUrl, initialEndpointType)
  );
  const [isNodeActive, setIsNodeActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointType, setEndpointType] = useState<CodexEndpointType>("remote");

  // Check node status
  const checkNodeStatus = useCallback(
    async (forceCheck: boolean = false): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      let isActive = false;

      try {
        isActive = await client.isNodeActive(forceCheck);
        setIsNodeActive(isActive);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to check node status"
        );
        setIsNodeActive(false);
      } finally {
        setIsLoading(false);
      }

      return isActive;
    },
    [client]
  );

  // Update the configuration
  const updateConfig = useCallback(
    (newUrl: string, endpointType: CodexEndpointType): void => {
      try {
        // Allow proxy paths (starting with /) or full URLs
        if (!newUrl.startsWith("/") && !newUrl.startsWith("http")) {
          throw new Error(
            "URL must start with '/  ' or 'http://' or 'https://'"
          );
        }

        client.updateConfig(newUrl, endpointType);
        setEndpointType(endpointType);
        checkNodeStatus(true);
      } catch (err) {
        setError(
          `Invalid URL: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [client, checkNodeStatus]
  );

  // Initial check on mount and periodic checks
  useEffect(() => {
    checkNodeStatus();

    const intervalId = setInterval(() => {
      checkNodeStatus();
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [checkNodeStatus]);

  return {
    client,
    isNodeActive,
    isLoading,
    error,
    endpointType,
    checkNodeStatus,
    updateConfig,
    baseUrl: client.getBaseUrl(),
    getNodeInfo: client.getNodeInfo.bind(client),
    getCodexClient: () => getCodexClient(),
    testDirectUpload: client.testDirectUpload.bind(client),
    uploadFile: client.uploadFile.bind(client),
    downloadFile: client.downloadFile.bind(client),
  };
}
