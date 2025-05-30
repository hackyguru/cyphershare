import { useState, useEffect, useCallback } from "react";
import {
  createLightNode,
  DecodedMessage,
  LightNode,
  Protocols,
  IEncoder,
  IDecoder,
  IDecodedMessage,
} from "@waku/sdk";

import protobuf from "protobufjs";

// Define the FileMessage structure using Protobuf
const FileMessage = new protobuf.Type("FileMessage")
  .add(new protobuf.Field("timestamp", 1, "uint64"))
  .add(new protobuf.Field("sender", 2, "string"))
  .add(new protobuf.Field("fileName", 3, "string"))
  .add(new protobuf.Field("fileSize", 4, "float"))
  .add(new protobuf.Field("fileType", 5, "string"))
  .add(new protobuf.Field("fileId", 6, "string")) // CID of the file
  .add(new protobuf.Field("isEncrypted", 7, "bool"))
  .add(new protobuf.Field("accessCondition", 8, "string")); // Description of access condition

// Correct content topic format following Waku protocol specification
// Format: /{application-name}/{version}/{content-topic-name}/{encoding}
const BASE_CONTENT_TOPIC = "/fileshare/1/";

export interface WakuFileMessage {
  timestamp: number;
  sender: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileId: string;
  isEncrypted?: boolean;
  accessCondition?: string;
}

export interface UseWakuOptions {
  roomId: string;
  wakuNodeUrl: string;
  wakuNodeType: "light" | "relay";
  onFileReceived?: (fileMessage: WakuFileMessage) => void;
}

export const useWaku = ({
  roomId,
  wakuNodeUrl,
  wakuNodeType,
  onFileReceived,
}: UseWakuOptions) => {
  const [node, setNode] = useState<LightNode | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentTopic, setContentTopic] = useState<string>(
    `${BASE_CONTENT_TOPIC}room-${roomId}/proto`
  );
  const [encoder, setEncoder] = useState<IEncoder | null>(null);
  const [decoder, setDecoder] = useState<IDecoder<IDecodedMessage> | null>(
    null
  );
  const [subscription, setSubscription] = useState<unknown | null>(null);
  const [peerCount, setPeerCount] = useState(0);

  // Initialize Waku node
  const initWaku = useCallback(async () => {
    if (wakuNodeType !== "light") {
      // Only initialize for light node type
      return;
    }

    if (isConnecting || isConnected) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const newContentTopic = `${BASE_CONTENT_TOPIC}room-${roomId}/proto`;
      setContentTopic(newContentTopic);

      console.log("Creating Waku light node...");
      const lightNode = await createLightNode({
        defaultBootstrap: false,
        networkConfig: {
          clusterId: 42,
          shards: [0],
        },
      });

      await lightNode.start();
      console.log("Waku node started");

      // Connect to bootstrap nodes with better error handling
      const bootstrapNodes = [
        "/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ",
        "/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk",
        "/dns4/waku-42-1.bloxy.one/tcp/8000/wss/p2p/16Uiu2HAmV8y1exLbqWVQjytwsuTKXK4n3QvLUa4zAWF71nshejYo",
        "/dns4/waku-42-2.bloxy.one/tcp/8000/wss/p2p/16Uiu2HAmJRs6ypS3XEhkpV2sJb8SHtsgpBsTPzuA4X9zq5ExkEZj",
      ];

      let connectedToAnyNode = false;
      for (const node of bootstrapNodes) {
        try {
          console.log(`Attempting to connect to ${node}...`);
          await lightNode.dial(node);
          connectedToAnyNode = true;
          console.log(`Successfully connected to ${node}`);
        } catch (error) {
          console.warn(`Failed to connect to ${node}:`, error);
          // Continue trying other nodes
        }
      }

      if (!connectedToAnyNode) {
        throw new Error("Failed to connect to any bootstrap nodes");
      }

      // Wait for peer connections with better error handling
      console.log("Waiting for peers...");
      try {
        await Promise.race([
          lightNode.waitForPeers([Protocols.LightPush, Protocols.Filter]),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Peer connection timeout - please try again")),
              15000
            )
          ),
        ]);
        console.log("Connected to peers successfully");
      } catch (peerError: unknown) {
        if (
          peerError instanceof Error &&
          peerError.message.includes("timeout")
        ) {
          throw new Error(
            "Connection timed out. Please check your network connection and try again."
          );
        }
        throw new Error(
          "Failed to establish peer connections. Please try again."
        );
      }

      // Create encoder and decoder
      const newEncoder = lightNode.createEncoder({
        contentTopic: newContentTopic,
        ephemeral: true,
      });

      const newDecoder = lightNode.createDecoder({
        contentTopic: newContentTopic,
      });

      setNode(lightNode);
      setEncoder(newEncoder);
      setDecoder(newDecoder);
      setIsConnected(true);
      setIsConnecting(false);

      // Update peer count and handle disconnections
      const interval = setInterval(async () => {
        if (lightNode) {
          try {
            const peers = await lightNode.libp2p.getPeers();
            setPeerCount(peers.length);

            // If no peers, try to reconnect
            if (peers.length === 0) {
              console.log("No peers connected, attempting to reconnect...");
              for (const node of bootstrapNodes) {
                try {
                  await lightNode.dial(node);
                  const newPeers = await lightNode.libp2p.getPeers();
                  if (newPeers.length > 0) {
                    console.log("Successfully reconnected to peers");
                    break;
                  }
                } catch (error) {
                  console.warn(
                    `Reconnection attempt to ${node} failed:`,
                    error
                  );
                }
              }
            }
          } catch (error) {
            console.error("Error checking peer count:", error);
          }
        }
      }, 5000);

      // Subscribe to messages
      await subscribeToMessages(lightNode, newDecoder, newContentTopic);
      console.log("Message subscription setup complete");

      return () => {
        clearInterval(interval);
        unsubscribeIfPossible(subscription);
        if (lightNode) {
          lightNode.stop();
        }
      };
    } catch (err) {
      console.error("Error initializing Waku:", err);
      // Provide more user-friendly error messages
      let errorMessage = "Failed to initialize Waku";
      if (err instanceof Error) {
        if (err.message.includes("timeout")) {
          errorMessage =
            "Connection timed out. Please check your network connection and try again.";
        } else if (err.message.includes("bootstrap")) {
          errorMessage =
            "Could not connect to the network. Please try again in a few moments.";
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [roomId, wakuNodeUrl, wakuNodeType, isConnecting, isConnected]);

  // Subscribe to messages
  const subscribeToMessages = async (
    lightNode: LightNode,
    messageDecoder: IDecoder<IDecodedMessage>,
    topic: string
  ) => {
    try {
      console.log("Setting up message subscription for topic:", topic);

      // Create a message handler callback
      const messageHandler = (wakuMessage: DecodedMessage) => {
        if (!wakuMessage.payload) {
          console.log("Received empty message payload");
          return;
        }

        try {
          console.log("Raw message received:", {
            contentTopic: wakuMessage.contentTopic,
            timestamp: new Date().toISOString(),
            payloadLength: wakuMessage.payload.length,
          });

          // Decode the message using protobuf
          const decodedMessage = FileMessage.decode(
            wakuMessage.payload
          ) as unknown as WakuFileMessage;

          console.log("Successfully decoded message:", {
            fileName: decodedMessage.fileName,
            sender: decodedMessage.sender,
            fileId: decodedMessage.fileId,
            timestamp: new Date(decodedMessage.timestamp).toISOString(),
          });

          // Call the callback if provided
          if (onFileReceived) {
            onFileReceived(decodedMessage);
          }
        } catch (decodeError) {
          console.error("Failed to decode message:", decodeError);
          console.log(
            "Message payload (first 50 bytes):",
            new TextDecoder().decode(wakuMessage.payload.slice(0, 50))
          );
        }
      };

      // Subscribe using the standard filter subscription
      const subscription = await lightNode.filter.subscribe(
        // TODO: sounds like there is something wrong here that led to the need to casting!
        [messageDecoder] as any,
        messageHandler
      );

      // Cast the subscription to our custom type
      setSubscription(subscription);
      console.log("Message subscription setup complete");
      console.log("✅ Message subscription setup complete");
    } catch (err) {
      console.error("❌ Error in message subscription process:", err);
      setError(
        "Failed to subscribe to messages: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  // Send a file message
  const sendFileMessage = useCallback(
    async (fileData: {
      fileName: string;
      fileSize: number;
      fileType: string;
      fileId: string;
      isEncrypted?: boolean;
      accessCondition?: string;
    }) => {
      console.log("Sending file message:", fileData);
      if (!node || !encoder || !isConnected) {
        console.error("Cannot send message: Waku node is not connected", {
          node: !!node,
          encoder: !!encoder,
          isConnected,
          peerCount,
        });
        setError("Waku node is not connected");
        return false;
      }

      try {
        console.log("🚀 Preparing to send file message:", fileData);

        // Generate a unique sender ID if not already available
        // This helps with identifying our own messages
        const getTabSpecificSenderId = () => {
          // Create a unique ID for this tab instance
          const tabId =
            sessionStorage.getItem("wakuTabId") ||
            `tab-${Math.random().toString(36).substring(2, 10)}`;
          if (!sessionStorage.getItem("wakuTabId")) {
            sessionStorage.setItem("wakuTabId", tabId);
          }

          // Get or create the user ID from localStorage
          const userId =
            localStorage.getItem("wakuUserId") ||
            `user-${Math.random().toString(36).substring(2, 10)}`;
          if (!localStorage.getItem("wakuUserId")) {
            localStorage.setItem("wakuUserId", userId);
          }

          // Combine them for a tab-specific sender ID
          return `${userId}-${tabId}`;
        };

        const senderId = getTabSpecificSenderId();

        // Store the current sender ID in sessionStorage for this tab only
        sessionStorage.setItem("wakuSenderId", senderId);

        // Create a new message object
        const protoMessage = FileMessage.create({
          timestamp: Date.now(),
          sender: senderId, // Use the unique sender ID
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          fileType: fileData.fileType,
          fileId: fileData.fileId,
          isEncrypted: fileData.isEncrypted || false,
          accessCondition: fileData.accessCondition || "",
        });

        // Serialize the message using Protobuf
        const serializedMessage = FileMessage.encode(protoMessage).finish();

        console.log("📦 Message prepared:", {
          contentTopic,
          sender: senderId,
          fileName: fileData.fileName,
          fileId: fileData.fileId,
          payloadSize: serializedMessage.length,
          timestamp: new Date().toISOString(),
        });

        // Check if we have peers before sending
        const peers = await node.libp2p.getPeers();
        if (peers.length === 0) {
          console.warn(
            "⚠️ No peers connected. Message might not be delivered."
          );
        } else {
          console.log(
            `✅ Connected to ${peers.length} peers for message delivery`
          );
        }

        // Send the message using Light Push
        console.log("Sending message via lightPush...");
        const result = await node.lightPush.send(encoder as unknown as any, {
          payload: serializedMessage,
        });

        console.log("✅ File message sent successfully:", result);

        // For debugging: Try to receive our own message to verify it's formatted correctly
        try {
          console.log(
            "Verifying message format by decoding our own message..."
          );
          const decodedMessage = FileMessage.decode(
            serializedMessage
          ) as unknown as WakuFileMessage;
          console.log("Message verification successful:", decodedMessage);
        } catch (verifyError) {
          console.error("⚠️ Message verification failed:", verifyError);
          // Continue anyway as this is just a verification step
        }

        return true;
      } catch (err) {
        console.error("❌ Error sending file message:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error sending file message"
        );
        return false;
      }
    },
    [node, encoder, isConnected, contentTopic, peerCount]
  );

  // Update room ID
  useEffect(() => {
    if (roomId && isConnected) {
      // If room ID changes while connected, reconnect with new room ID
      const newContentTopic = `${BASE_CONTENT_TOPIC}room-${roomId}/proto`;
      if (newContentTopic !== contentTopic) {
        // Clean up existing connection
        unsubscribeIfPossible(subscription);
        if (node) {
          node.stop();
        }

        // Reset state
        setIsConnected(false);
        setNode(null);
        setEncoder(null);
        setDecoder(null);
        setSubscription(null);

        // Initialize with new room ID
        initWaku();
      }
    }
  }, [roomId, isConnected, contentTopic, initWaku]);

  // Initialize Waku when component mounts or when wakuNodeType changes
  useEffect(() => {
    if (wakuNodeType === "light") {
      initWaku();
    } else {
      // Clean up existing connection if switching from light to relay
      unsubscribeIfPossible(subscription);
      if (node) {
        node.stop();
      }

      // Reset state
      setIsConnected(false);
      setNode(null);
      setEncoder(null);
      setDecoder(null);
      setSubscription(null);
    }

    // Cleanup function
    return () => {
      unsubscribeIfPossible(subscription);
      if (node) {
        node.stop();
      }
    };
  }, [wakuNodeType, initWaku]);

  // Function to manually reconnect
  const reconnect = useCallback(async () => {
    console.log("Manual reconnection requested");

    // Clean up existing connection
    unsubscribeIfPossible(subscription);

    if (node) {
      try {
        await node.stop();
      } catch (e) {
        console.warn("Error stopping node:", e);
      }
    }

    // Reset state
    setIsConnected(false);
    setNode(null);
    setEncoder(null);
    setDecoder(null);
    setSubscription(null);
    setError(null);

    // Small delay before reconnecting
    setTimeout(() => {
      initWaku();
    }, 1000);
  }, [node, subscription, initWaku]);

  return {
    isConnecting,
    isConnected,
    error,
    sendFileMessage,
    peerCount,
    contentTopic,
    reconnect,
  };
};

export default useWaku;
function unsubscribeIfPossible(subscription: unknown) {
  if (
    subscription &&
    typeof (subscription as { unsubscribe: () => void }).unsubscribe ===
      "function"
  ) {
    try {
      (subscription as { unsubscribe: () => void }).unsubscribe();
    } catch (e) {
      console.warn("Error unsubscribing:", e);
    }
  }
}
