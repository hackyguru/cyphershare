import { useState, useEffect, useCallback } from 'react';
import {
  createLightNode,
  DecodedMessage,
  LightNode,
  Protocols,
  utils,
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
  wakuNodeType: 'light' | 'relay';
  onFileReceived?: (fileMessage: WakuFileMessage) => void;
}

export const useWaku = ({
  roomId,
  wakuNodeUrl,
  wakuNodeType,
  onFileReceived
}: UseWakuOptions) => {
  const [node, setNode] = useState<LightNode | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentTopic, setContentTopic] = useState<string>(`${BASE_CONTENT_TOPIC}room-${roomId}/proto`);
  const [encoder, setEncoder] = useState<any>(null);
  const [decoder, setDecoder] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [peerCount, setPeerCount] = useState(0);

  // Initialize Waku node
  const initWaku = useCallback(async () => {
    if (wakuNodeType !== 'light') {
      // Only initialize for light node type
      return;
    }

    if (isConnecting || isConnected) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Create a new content topic with the current room ID
      // Using correct format: /{application-name}/{version}/{content-topic-name}/{encoding}
      const newContentTopic = `${BASE_CONTENT_TOPIC}room-${roomId}/proto`;
      setContentTopic(newContentTopic);

      // Create a light node with explicit protocols
      console.log('Creating Waku light node...');
      const lightNode = await createLightNode({
        defaultBootstrap: false,
        networkConfig: {
          clusterId: 42,
          shards: [0]
        },
      });

      // Start the node
      await lightNode.start();
      console.log('Waku node started');
      await lightNode.dial("/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ");
      await lightNode.dial("/dns4/vps-aaa00d52.vps.ovh.ca/tcp/8000/wss/p2p/16Uiu2HAm9PftGgHZwWE3wzdMde4m3kT2eYJFXLZfGoSED3gysofk");


      // Wait for peer connections with timeout
      console.log('Waiting for peers...');
      try {
        // Wait for both protocols with a timeout
        const timeout = 15000; // 15 seconds timeout
        await Promise.race([
          lightNode.waitForPeers([Protocols.LightPush, Protocols.Filter]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Peer connection timeout')), timeout)
          )
        ]);
        console.log('Connected to peers successfully');
      } catch (peerError) {
        console.warn('Peer connection issue:', peerError);
        // Continue anyway, as we might connect to peers later
      }

      // Create encoder and decoder
      const newEncoder = lightNode.createEncoder({
        contentTopic: newContentTopic,
        ephemeral: true,
      });

      const newDecoder = lightNode.createDecoder({contentTopic: newContentTopic});

      setNode(lightNode);
      setEncoder(newEncoder);
      setDecoder(newDecoder);
      setIsConnected(true);
      setIsConnecting(false);

      // Update peer count periodically
      const interval = setInterval(async () => {
        if (lightNode) {
          const peers = await lightNode.libp2p.getPeers();
          setPeerCount(peers.length);

          // Log connected peers for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Connected to ${peers.length} Waku peers`);
          }
        }
      }, 5000);

      // Subscribe to messages
      await subscribeToMessages(lightNode, newDecoder, newContentTopic);
      console.log('Message subscription setup complete');

      return () => {
        clearInterval(interval);
        if (subscription) {
          subscription.unsubscribe();
        }
        if (lightNode) {
          lightNode.stop();
        }
      };
    } catch (err) {
      console.error('Error initializing Waku:', err);
      setError(err instanceof Error ? err.message : 'Unknown error initializing Waku');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [roomId, wakuNodeUrl, wakuNodeType, isConnecting, isConnected]);

  // Subscribe to messages
  const subscribeToMessages = async (lightNode: LightNode, messageDecoder: any, topic: string) => {
    try {
      console.log('Setting up message subscription for topic:', topic);

      // Create a message handler callback
      const messageHandler = (wakuMessage: DecodedMessage) => {
        if (!wakuMessage.payload) {
          console.log('Received empty message payload');
          return;
        }

        try {
          console.log('Raw message received:', {
            contentTopic: wakuMessage.contentTopic,
            timestamp: new Date().toISOString(),
            payloadLength: wakuMessage.payload.length
          });

          // Decode the message using protobuf
          const decodedMessage = FileMessage.decode(wakuMessage.payload) as unknown as WakuFileMessage;

          console.log('Successfully decoded message:', {
            fileName: decodedMessage.fileName,
            sender: decodedMessage.sender,
            fileId: decodedMessage.fileId,
            timestamp: new Date(decodedMessage.timestamp).toISOString()
          });

          // Call the callback if provided
          if (onFileReceived) {
            onFileReceived(decodedMessage);
          }
        } catch (decodeError) {
          console.error('Failed to decode message:', decodeError);
          console.log('Message payload (first 50 bytes):',
            new TextDecoder().decode(wakuMessage.payload.slice(0, 50)));
        }
      };

      // Subscribe using the standard filter subscription
      const subscription = await lightNode.filter.subscribe(
        [messageDecoder],
        messageHandler
      );

      setSubscription(subscription);
      console.log('✅ Message subscription setup complete');

    } catch (err) {
      console.error('❌ Error in message subscription process:', err);
      setError('Failed to subscribe to messages: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Send a file message
  const sendFileMessage = useCallback(async (fileData: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileId: string;
    isEncrypted?: boolean;
    accessCondition?: string;
  }) => {
    if (!node || !encoder || !isConnected) {
      console.error('Cannot send message: Waku node is not connected', {
        node: !!node,
        encoder: !!encoder,
        isConnected,
        peerCount
      });
      setError('Waku node is not connected');
      return false;
    }

    try {
      console.log('🚀 Preparing to send file message:', fileData);

      // Generate a unique sender ID if not already available
      // This helps with identifying our own messages
      const getTabSpecificSenderId = () => {
        // Create a unique ID for this tab instance
        const tabId = sessionStorage.getItem('wakuTabId') || `tab-${Math.random().toString(36).substring(2, 10)}`;
        if (!sessionStorage.getItem('wakuTabId')) {
          sessionStorage.setItem('wakuTabId', tabId);
        }

        // Get or create the user ID from localStorage
        const userId = localStorage.getItem('wakuUserId') || `user-${Math.random().toString(36).substring(2, 10)}`;
        if (!localStorage.getItem('wakuUserId')) {
          localStorage.setItem('wakuUserId', userId);
        }

        // Combine them for a tab-specific sender ID
        return `${userId}-${tabId}`;
      };

      const senderId = getTabSpecificSenderId();

      // Store the current sender ID in sessionStorage for this tab only
      sessionStorage.setItem('wakuSenderId', senderId);

      // Create a new message object
      const protoMessage = FileMessage.create({
        timestamp: Date.now(),
        sender: senderId, // Use the unique sender ID
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        fileId: fileData.fileId,
        isEncrypted: fileData.isEncrypted || false,
        accessCondition: fileData.accessCondition || ''
      });

      // Serialize the message using Protobuf
      const serializedMessage = FileMessage.encode(protoMessage).finish();

      console.log('📦 Message prepared:', {
        contentTopic,
        sender: senderId,
        fileName: fileData.fileName,
        fileId: fileData.fileId,
        payloadSize: serializedMessage.length,
        timestamp: new Date().toISOString()
      });

      // Check if we have peers before sending
      const peers = await node.libp2p.getPeers();
      if (peers.length === 0) {
        console.warn('⚠️ No peers connected. Message might not be delivered.');
      } else {
        console.log(`✅ Connected to ${peers.length} peers for message delivery`);
      }

      // Send the message using Light Push
      console.log('Sending message via lightPush...');
      const result = await node.lightPush.send(encoder, {
        payload: serializedMessage,
      });

      console.log('✅ File message sent successfully:', result);

      // For debugging: Try to receive our own message to verify it's formatted correctly
      try {
        console.log('Verifying message format by decoding our own message...');
        const decodedMessage = FileMessage.decode(serializedMessage) as unknown as WakuFileMessage;
        console.log('Message verification successful:', decodedMessage);
      } catch (verifyError) {
        console.error('⚠️ Message verification failed:', verifyError);
        // Continue anyway as this is just a verification step
      }

      return true;
    } catch (err) {
      console.error('❌ Error sending file message:', err);
      setError(err instanceof Error ? err.message : 'Unknown error sending file message');
      return false;
    }
  }, [node, encoder, isConnected, contentTopic, peerCount]);

  // Update room ID
  useEffect(() => {
    if (roomId && isConnected) {
      // If room ID changes while connected, reconnect with new room ID
      const newContentTopic = `${BASE_CONTENT_TOPIC}room-${roomId}/proto`;
      if (newContentTopic !== contentTopic) {
        // Clean up existing connection
        if (subscription) {
          subscription.unsubscribe();
        }
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
    if (wakuNodeType === 'light') {
      initWaku();
    } else {
      // Clean up existing connection if switching from light to relay
      if (subscription) {
        subscription.unsubscribe();
      }
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
      if (subscription) {
        subscription.unsubscribe();
      }
      if (node) {
        node.stop();
      }
    };
  }, [wakuNodeType, initWaku]);

  // Function to manually reconnect
  const reconnect = useCallback(async () => {
    console.log('Manual reconnection requested');

    // Clean up existing connection
    if (subscription) {
      try {
        subscription.unsubscribe();
      } catch (e) {
        console.warn('Error unsubscribing:', e);
      }
    }

    if (node) {
      try {
        await node.stop();
      } catch (e) {
        console.warn('Error stopping node:', e);
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
    reconnect
  };
};

export default useWaku; 