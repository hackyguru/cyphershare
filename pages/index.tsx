import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useWallet } from "@/context/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Geist, Geist_Mono } from "next/font/google";
import { Upload, Download, FileIcon, Copy, Edit, Check, File, FileText, Image, Github, Settings, Server, Radio, Terminal, AlertCircle, Info, Waypoints, Lock, Unlock, Shield } from "lucide-react";
import Head from "next/head";
import { useDropzone } from "react-dropzone";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetTrigger
} from "@/components/ui/sheet";
import { useCodex, CodexClient, getCodexClient } from "@/hooks/useCodex";
import useWaku, { WakuFileMessage } from "@/hooks/useWaku";
import axios from "axios";
import { cn } from "@/lib/utils";
import { domains } from "@nucypher/taco";
import useTaco from "@/hooks/useTaco";
import { ethers } from "ethers";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Update the FileItem interface to include id as string and add fileId
interface FileItem {
  id: number | string;
  name: string;
  size: number;
  type: string;
  timestamp: string;
  fileId?: string; // Codex file ID
  isEncrypted?: boolean; // Whether the file is encrypted with TACo
  accessCondition?: string; // Description of access condition
}

// Update ExtendedNodeInfo interface
interface ExtendedNodeInfo {
  id: string;
  version: string;
  revision?: string;
  status: string;
  uptime: string;
  peers?: number;
}

export default function Home() {
  const [roomId, setRoomId] = useState("XYZ123");
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [codexNodeUrl, setCodexNodeUrl] = useState("http://localhost:8080/api/codex");
  const [wakuNodeUrl, setWakuNodeUrl] = useState("http://127.0.0.1:8645");
  const [wakuNodeType, setWakuNodeType] = useState("light");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<ExtendedNodeInfo | null>(null);
  
  // TACo integration state
  const { provider, signer, walletConnected, connectWallet } = useWallet();
  const timeInputRef = useRef<HTMLDivElement>(null);
  const useEncryptionInputRef = useRef<HTMLDivElement>(null);
  const [useEncryption, setUseEncryption] = useState(false);
  const [accessConditionType, setAccessConditionType] = useState<'time' | 'positive'>('positive');
  
  // Effect to scroll to the time input section when selected
  useEffect(() => {
    if (accessConditionType === 'time' && timeInputRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        timeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [accessConditionType]);
  // Effect to scroll to the useEncryption input section when selected
  useEffect(() => {
    if (useEncryption && useEncryptionInputRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        useEncryptionInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [useEncryption]);
  const [windowTimeSeconds, setWindowTimeSeconds] = useState('60'); // Default to 1 minute (60 seconds)
  const [decryptionInProgress, setDecryptionInProgress] = useState<Record<string, boolean>>({});
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  
  // TACo ritual ID and domain
  const ritualId = 6; // Update with your actual ritual ID if needed
  
  // Initialize TACo hooks
  const { 
    isInit: isTacoInit, 
    encryptDataToBytes, 
    decryptDataFromBytes,
    createConditions
  } = useTaco({
    provider: provider as ethers.providers.Provider | undefined,
    domain: domains.TESTNET, // Using testnet
    ritualId
  });
  
  const [sentFiles, setSentFiles] = useState<FileItem[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<FileItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: { 
      progress: number; 
      name: string; 
      size: number; 
      type: string; 
      timestamp?: string;
      isEncrypted?: boolean;
      accessCondition?: string;
    }
  }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // Initialize Codex client with default URL
  const { 
    isNodeActive: isCodexNodeActive, 
    isLoading: isCodexLoading,
    updateBaseUrl: updateCodexUrl,
    checkNodeStatus: checkCodexStatus,
    error: codexError,
    getNodeInfo,
    getCodexClient,
    testDirectUpload: codexTestUpload,
    downloadFile
  } = useCodex(codexNodeUrl);

  // Add a debug state for Waku messages
  const [wakuDebugVisible, setWakuDebugVisible] = useState(false);
  const [wakuDebugLogs, setWakuDebugLogs] = useState<{
    type: 'info' | 'error' | 'success';
    message: string;
    timestamp: string;
  }[]>([]);

  // Function to add a debug log
  const addWakuDebugLog = useCallback((type: 'info' | 'error' | 'success', message: string) => {
    setWakuDebugLogs(prev => [
      {
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev.slice(0, 19) // Keep only the last 20 logs
    ]);
  }, []);

  // Handle file received via Waku
  const handleFileReceived = useCallback((fileMessage: WakuFileMessage) => {
    // Get our tab-specific sender ID from sessionStorage
    const ourSenderId = sessionStorage.getItem('wakuSenderId');
    
    // Add to debug logs
    addWakuDebugLog('info', `Message received: ${fileMessage.fileName} from ${fileMessage.sender.substring(0, 8)}`);
    
    // Check if this is a file we sent (by checking our tab-specific sender ID)
    const isSentByUs = ourSenderId && fileMessage.sender === ourSenderId;
    
    // If we sent this file, don't add it to received files
    if (isSentByUs) {
      console.log('Ignoring file we sent:', fileMessage.fileName, 'from sender:', fileMessage.sender);
      addWakuDebugLog('info', `Ignoring our own message: ${fileMessage.fileName}`);
      return;
    }
    
    // Also check if we already have this file in our sent files (as a backup check)
    const isInSentFiles = sentFiles.some(file => file.fileId === fileMessage.fileId);
    if (isInSentFiles) {
      console.log('Ignoring file already in our sent files:', fileMessage.fileName);
      addWakuDebugLog('info', `Ignoring file already in our sent files: ${fileMessage.fileName}`);
      return;
    }
    
    console.log('Received new file from peer:', {
      fileName: fileMessage.fileName,
      sender: fileMessage.sender,
      fileId: fileMessage.fileId,
      timestamp: fileMessage.timestamp,
      encrypted: fileMessage.isEncrypted,
      accessCondition: fileMessage.accessCondition
    });
    
    addWakuDebugLog('success', `New file from peer: ${fileMessage.fileName}`);
    
    // Check if we already have this file in our received files
    const fileExists = receivedFiles.some(file => file.fileId === fileMessage.fileId);
    
    if (fileExists) {
      addWakuDebugLog('info', `File already exists: ${fileMessage.fileName}`);
      return;
    }
    
    // Create a new file item
    const timestamp = new Date(fileMessage.timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const newFile: FileItem = {
      id: `received-${fileMessage.timestamp}-${fileMessage.fileName}`,
      name: fileMessage.fileName,
      size: fileMessage.fileSize,
      type: fileMessage.fileType,
      timestamp,
      fileId: fileMessage.fileId,
      isEncrypted: fileMessage.isEncrypted,
      accessCondition: fileMessage.accessCondition
    };
    
    // Add to received files
    setReceivedFiles(prev => [newFile, ...prev]);
    
    // Show notification
    setCopySuccess(`Received file: ${fileMessage.fileName}`);
    setTimeout(() => setCopySuccess(null), 3000);
    
    addWakuDebugLog('success', `Added to received files: ${fileMessage.fileName}`);
  }, [receivedFiles, sentFiles, addWakuDebugLog]);

  // Initialize Waku client
  const { 
    isConnecting: isWakuConnecting,
    isConnected: isWakuConnected,
    error: wakuError,
    sendFileMessage,
    peerCount: wakuPeerCount,
    contentTopic: wakuContentTopic,
    reconnect: reconnectWaku
  } = useWaku({
    roomId,
    wakuNodeUrl,
    wakuNodeType: wakuNodeType as 'light' | 'relay',
    onFileReceived: handleFileReceived
  });

  // Update type guard with more explicit checks
  const isValidNodeInfo = (info: unknown): info is ExtendedNodeInfo => {
    if (!info || typeof info !== 'object') return false;
    const nodeInfo = info as Partial<ExtendedNodeInfo>;
    return (
      typeof nodeInfo.version === 'string' &&
      typeof nodeInfo.status === 'string' &&
      typeof nodeInfo.uptime === 'string' &&
      (typeof nodeInfo.id === 'string' || nodeInfo.id === undefined) &&
      (typeof nodeInfo.revision === 'string' || nodeInfo.revision === undefined) &&
      (typeof nodeInfo.peers === 'number' || nodeInfo.peers === undefined)
    );
  };

  // Update the useEffect that fetches node info
  useEffect(() => {
    if (isCodexNodeActive && !isCodexLoading) {
      const fetchNodeInfo = async () => {
        const info = await getNodeInfo();
        if (info && isValidNodeInfo(info)) {
          setNodeInfo(info);
        } else {
          setNodeInfo(null);
        }
      };
      
      fetchNodeInfo();
    } else {
      setNodeInfo(null);
    }
  }, [isCodexNodeActive, isCodexLoading, getNodeInfo]);


  // Handle file drop - Modified to include TACo encryption and Waku message sharing
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!isCodexNodeActive) {
      setUploadError("Codex node is not active. Please check your connection.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    // If encryption is enabled but wallet is not connected, prompt to connect
    if (useEncryption && !walletConnected) {
      const connected = await connectWallet();
      if (!connected) {
        setUploadError("Please connect your wallet to use encryption features.");
        setTimeout(() => setUploadError(null), 5000);
        return;
      }
    }

    // Process each file
    acceptedFiles.forEach(file => {
      console.log("----------------------------- Processing file...");
      const fileId = `upload-${Date.now()}-${file.name}`;
      
      // Add file to uploading state
      setUploadingFiles(prev => ({
        ...prev,
        [fileId]: {
          progress: 0,
          name: file.name,
          size: file.size / (1024 * 1024), // Convert to MB
          type: file.type
        }
      }));
      
      // Upload file to Codex
      const uploadFile = async () => {
        try {
          let fileToUpload = file;
          let isFileEncrypted = false;
          let accessConditionDescription = '';

          // If encryption is enabled and we have a wallet connected, encrypt the file
          if (useEncryption && walletConnected && signer) {
            try {
              // Create a condition based on selected type
              let accessCondition;
              
              if (accessConditionType === 'positive') {
                accessCondition = createConditions.positiveBalance();
                accessConditionDescription = `The account needs to have a positive balance, to be able to decrypt this file`;
              } else if (accessConditionType === 'time') {
                accessCondition = await createConditions.withinNumberOfSeconds(Number(windowTimeSeconds));
                accessConditionDescription = `Accessible only within ${windowTimeSeconds} seconds of  ${new Date().toLocaleTimeString()} (${new Date().toLocaleDateString()})`;
              } else {
                throw new Error('Invalid access condition type');
              }
              
              // Read file as ArrayBuffer
              const arrayBuffer = await file.arrayBuffer();
              const fileBytes = new Uint8Array(arrayBuffer);
              
              console.log('Preparing to encrypt file...', {
                fileName: file.name,
                fileSize: fileBytes.length,
                accessCondition: accessConditionDescription
              });
              
              // Encrypt the file using TACo
              try {
                const encryptedBytes = await encryptDataToBytes(
                  fileBytes,
                  accessCondition,
                  signer
                );
                
                if (encryptedBytes) {
                  // Wrap ciphertext into a File for Codex upload
                  fileToUpload = new globalThis.File([encryptedBytes], `${file.name}.enc`, {
                    type: 'application/octet-stream', // Use generic binary type
                    lastModified: file.lastModified
                  });
                  
                  isFileEncrypted = true;
                  console.log('File encrypted successfully');
                }
              } catch (encryptError) {
                console.log('Encryption error:', encryptError);
                setUploadError(`Encryption failed: ${encryptError instanceof Error ? encryptError.message : 'Unknown error'}`);
                setTimeout(() => setUploadError(null), 5000);
                // Continue with unencrypted upload
              }
            } catch (conditionError) {
              console.log('Error setting up access conditions:', conditionError);
              setUploadError(`Error setting up access conditions: ${conditionError instanceof Error ? conditionError.message : 'Unknown error'}`);
              setTimeout(() => setUploadError(null), 5000);
              // Continue with unencrypted upload
            }
          }
          
          // Upload to Codex (either encrypted or original file)
          const result = await getCodexClient().uploadFile(fileToUpload, (progress: number) => {
            // Update progress
            setUploadingFiles(prev => ({
              ...prev,
              [fileId]: { ...prev[fileId], progress }
            }));
          });
          
          // Handle upload completion
          if (result.success) {
            // Add to sent files
            const timestamp = new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            // Enhanced debug logging for the upload result
            console.log('========== UPLOAD RESULT ==========');
            console.log(JSON.stringify(result, null, 2));
            console.log('===================================');
            
            // Log the CID specifically
            if (result.id) {
              console.log('✅ File uploaded successfully. CID:', result.id);
              console.log('%c Copy this CID: ' + result.id, 'background: #222; color: #bada55; padding: 2px 5px; border-radius: 2px;');
            } else {
              console.warn('⚠️ No CID returned from upload');
            }
            
            const newFile: FileItem = {
              id: fileId,
              name: file.name,
              isEncrypted: isFileEncrypted,
              accessCondition: isFileEncrypted ? accessConditionDescription : undefined,
              size: parseFloat((file.size / (1024 * 1024)).toFixed(2)), // MB with 2 decimal places
              type: file.type,
              timestamp,
              fileId: result.id // Store the CID returned from the Codex API
            };
            
            // Log the file object with CID
            console.log('Adding file to sent files:', newFile);
            
            // Log the file ID for debugging
            if (process.env.NODE_ENV !== 'production') {
              console.log(`File uploaded successfully. CID: ${result.id}`);
            }
            
            setSentFiles(prev => [newFile, ...prev]);
            
            // Remove from uploading files
            setUploadingFiles(prev => {
              const updated = { ...prev };
              delete updated[fileId];
              return updated;
            });
            
            // Share the file with peers via Waku if connected
            if (isWakuConnected && result.id) {
              try {
                await sendFileMessage({
                  fileName: file.name,
                  fileSize: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
                  fileType: file.type,
                  fileId: result.id,
                  isEncrypted: isFileEncrypted,
                  accessCondition: isFileEncrypted ? accessConditionDescription : undefined
                });
                console.log('File shared with peers via Waku');
              } catch (wakuError) {
                console.error('Failed to share file via Waku:', wakuError);
              }
            }
          } else {
            // Handle error
            setUploadError(`Failed to upload ${file.name}: ${result.error}`);
            setTimeout(() => setUploadError(null), 5000);
            
            // Remove from uploading files
            setUploadingFiles(prev => {
              const updated = { ...prev };
              delete updated[fileId];
              return updated;
            });
          }
        } catch (error) {
          setUploadError(`Error uploading ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setTimeout(() => setUploadError(null), 5000);
          
          // Remove from uploading files
          setUploadingFiles(prev => {
            const updated = { ...prev };
            delete updated[fileId];
            return updated;
          });
        }
      };
      
      uploadFile();
    });
  }, [isCodexNodeActive, getCodexClient, isWakuConnected, sendFileMessage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 100 * 1024 * 1024, // 100MB max size
  });

  // Function to get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) {
      return <Image size={24} />;
    } else if (fileType.includes('pdf')) {
      return <FileText size={24} />;
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('xlsx')) {
      return <FileText size={24} />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint') || fileType.includes('pptx')) {
      return <FileText size={24} />;
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <File size={24} />;
    } else {
      return <FileIcon size={24} />;
    }
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };
  
  // Handle copying file CID
  const [copiedFileCid, setCopiedFileCid] = useState<string | null>(null);
  
  // Function to copy text to clipboard using a fallback method
  const copyToClipboard = (text: string): boolean => {
    try {
      // Create a temporary textarea element
      const textarea = document.createElement('textarea');
      textarea.value = text;
      
      // Make the textarea out of viewport
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      
      // Select and copy the text
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      
      // Clean up
      document.body.removeChild(textarea);
      
      return success;
    } catch (error) {
      console.error('Failed to copy text:', error);
      return false;
    }
  };
  
  // Debug function to test clipboard functionality
  const testClipboardCopy = (text: string) => {
    const success = copyToClipboard(text);
    if (success) {
      console.log('Successfully copied to clipboard:', text);
      setCopySuccess(`Test text copied to clipboard: ${text}`);
    } else {
      console.error('Failed to copy to clipboard');
      setUploadError('Failed to copy to clipboard');
    }
    setTimeout(() => {
      setCopySuccess(null);
      setUploadError(null);
    }, 2000);
  };
  
  // Test function to directly upload a file to Codex
  const testDirectUpload = async () => {
    if (!isCodexNodeActive) {
      setUploadError("Codex node is not active. Please check your connection.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }
    
    try {
      const result = await codexTestUpload();
      
      if (result.success) {
        if (result.id) {
          setCopySuccess(`Direct upload successful. CID: ${result.id}`);
        } else {
          setCopySuccess(result.message || 'Direct upload successful');
        }
      } else {
        setUploadError(result.error || 'Upload failed with unknown error');
      }
      
      setTimeout(() => {
        setCopySuccess(null);
        setUploadError(null);
      }, 5000);
    } catch (error) {
      console.error('Error in direct upload test:', error);
      setUploadError(`Direct upload test failed: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };
  
  // Enhanced test function for Waku messaging with debug logs
  const testWakuMessage = async () => {
    if (!isWakuConnected) {
      setUploadError("Waku is not connected. Please check your connection.");
      addWakuDebugLog('error', 'Waku is not connected');
      setTimeout(() => setUploadError(null), 5000);
      return;
    }
    
    try {
      addWakuDebugLog('info', 'Sending test message via Waku...');
      
      // Create a test message with timestamp to ensure uniqueness
      const timestamp = Date.now();
      const testFileName = `test-message-${timestamp}.txt`;
      const testFileId = `test-${timestamp}`;
      
      addWakuDebugLog('info', `Created test message: ${testFileName} (ID: ${testFileId})`);
      
      // Send a test message via Waku
      const success = await sendFileMessage({
        fileName: testFileName,
        fileSize: 0.01, // Small dummy size
        fileType: 'text/plain',
        fileId: testFileId // Dummy file ID
      });
      
      if (success) {
        setCopySuccess(`Test message sent successfully: ${testFileName}`);
        addWakuDebugLog('success', `Message sent: ${testFileName}`);
      } else {
        setUploadError('Failed to send test message');
        addWakuDebugLog('error', 'Failed to send test message');
      }
      
      setTimeout(() => {
        setCopySuccess(null);
        setUploadError(null);
      }, 3000);
    } catch (error) {
      console.error('Error sending test Waku message:', error);
      setUploadError(`Test message failed: ${error instanceof Error ? error.message : String(error)}`);
      addWakuDebugLog('error', `Test message failed: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const handleCopyFileCid = (fileId: string) => {
    const file = sentFiles.find(f => f.id.toString() === fileId) || receivedFiles.find(f => f.id.toString() === fileId);
    if (file && file.fileId) {
      // Debug log to see what's being copied
      console.log('Copying file CID:', {
        fileId: fileId,
        file: file,
        cid: file.fileId
      });
      
      const cidToDisplay = `${file.fileId.substring(0, 8)}...${file.fileId.substring(file.fileId.length - 6)}`;
      
      // Use the fallback method to copy
      const success = copyToClipboard(file.fileId);
      
      if (success) {
        setCopiedFileCid(fileId);
        setCopySuccess(`CID copied to clipboard: ${cidToDisplay}`);
        console.log(`Copied CID to clipboard: ${file.fileId}`);
        
        setTimeout(() => {
          setCopiedFileCid(null);
          setCopySuccess(null);
        }, 2000);
      } else {
        console.error('Failed to copy CID to clipboard');
        setUploadError('Failed to copy CID to clipboard');
        setTimeout(() => setUploadError(null), 5000);
      }
    } else {
      console.warn('No CID found for file:', fileId);
      setUploadError('No CID available for this file');
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  // Handle file download with potential decryption
  const handleDownloadFile = async (fileId: string) => {
    const file = sentFiles.find(f => f.id.toString() === fileId) || receivedFiles.find(f => f.id.toString() === fileId);
    if (!file) {
      setUploadError('File not found');
      return;
    }
    if (!file.fileId) {
      setUploadError('File ID not found');
      return;
    }
    
    try {
      setCopySuccess(`Fetching file metadata...`);
      // If file is encrypted, we need to decrypt it after download
      if (file.isEncrypted) {
        // Check if wallet is connected
        if (!walletConnected || !signer) {
            setUploadError('You need to connect your wallet to decrypt this file');
            setTimeout(() => setUploadError(null), 5000);
            return;
        }

        setCopySuccess('File is encrypted, decrypting...');
        
        // Start decryption process
        setDecryptionInProgress(prev => ({ ...prev, [file.fileId!]: true }));
        setDecryptionError(null);
        
        // Download encrypted data from Codex

        setCopySuccess(`Fetching encrypted file (${file.name}) from Codex...`);
        const encryptedData = await downloadFile(file.fileId);
        if (!encryptedData || !encryptedData.data) {
          throw new Error('Failed to download encrypted file data');
        }
        
        // Convert blob to Uint8Array for decryption
        const encryptedArrayBuffer = await encryptedData.data.arrayBuffer();
        const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
        
        // Decrypt the data
        try {
          // Ensure signer exists before attempting to decrypt
          // Due to react hooks, the signer variable is not updated immediately if `await connectWallet()` was called
          if (!signer) {
            setUploadError('Please go to settings and connect your wallet to decrypt this file');
            setTimeout(() => setUploadError(null), 5000);
            return;
          }
          setCopySuccess(`Decrypting encrypted file (${file.name})...`);
          const decryptedBytes = await decryptDataFromBytes(encryptedBytes, signer);
          
          if (decryptedBytes) {
            // The decrypted data is already in the right format with the updated TACo implementation
            const originalBytes = new Uint8Array(decryptedBytes);
            
            setCopySuccess(`Downloading ${file.name}...`);
            // Create a blob and download link
            const blob = new Blob([originalBytes], { type: file.type || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            
            setCopySuccess(`Decrypted and downloaded ${file.name}`);
            setTimeout(() => setCopySuccess(null), 3000);
          } else {
            throw new Error('Decryption returned no data');
          }
        } catch (decryptError) {
          console.log('Decryption failed:', decryptError);
          const message = `Failed to decrypt: ${(decryptError as Error)?.message?.indexOf('Threshold of responses not met;') !== -1
            ? 'Access denied. Threshold of responses not met.' : (decryptError as Error).message}`;
          setDecryptionError(message);
          setTimeout(() => setDecryptionError(null), 5000);

          setUploadError(message);      
          setTimeout(() => setUploadError(null), 5000);
        } finally {
          setDecryptionInProgress(prev => ({ ...prev, [file.fileId!]: false }));
        }
      } else {
          setCopySuccess(`Fetching file metadata...`);
          
          // Download the file using the CodexClient
          const result = await downloadFile(file.fileId);
          
          if (!result.success || !result.data || !result.metadata) {
            throw new Error(result.error || 'Failed to download file');
          }
          
          // Get data from successful download
          const { data: blob, metadata: { filename, mimetype } } = result;
          
          setCopySuccess(`Downloading ${filename}...`);
          
          // Create a download link for the file
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = filename || file.name; // Use the filename from metadata or fallback to the file name we have
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Show success message
          setCopySuccess(`File "${filename || file.name}" downloaded successfully`);
      }
      setTimeout(() => setCopySuccess(null), 3000);
    } catch (error: unknown) {
      console.error('Error downloading file:', error);
      let errorMessage = 'Failed to download file';
      
      if (axios.isAxiosError(error)) {
        errorMessage += `: ${error.response?.status || ''} ${error.message}`;
        console.error('API error details:', error.response?.data);
      } else if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      setUploadError(errorMessage);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  // Handle Codex URL change
  const handleCodexUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCodexNodeUrl(event.target.value);
  };

  // Update Codex URL when Save button is clicked
  const handleSaveConfig = () => {
    // Basic URL validation
    if (!codexNodeUrl.trim() || !codexNodeUrl.startsWith('http')) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }
    
    setIsSaving(true);
    updateCodexUrl(codexNodeUrl);
    
    // Show success indicator briefly
    setSaveSuccess(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(false);
    }, 2000);
  };

  // Function to clear all sender IDs
  const clearSenderIds = () => {
    sessionStorage.removeItem('wakuSenderId');
    sessionStorage.removeItem('wakuTabId');
    localStorage.removeItem('wakuUserId');
    addWakuDebugLog('info', 'All sender IDs cleared');
    setCopySuccess('All sender IDs cleared');
    setTimeout(() => setCopySuccess(null), 3000);
  };

  // Update the node info rendering with proper type checking and casting
  const renderNodeInfo = () => {
    if (!nodeInfo || !isValidNodeInfo(nodeInfo)) return null;
    
    return (
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm">Node ID: {nodeInfo.id}</p>
        <p className="text-sm">Version: {nodeInfo.version}</p>
        <p className="text-sm">Revision: {nodeInfo.revision ?? 'N/A'}</p>
        <p className="text-sm">Status: {nodeInfo.status}</p>
        <p className="text-sm">Uptime: {nodeInfo.uptime}</p>
        {nodeInfo.peers !== undefined && (
          <p className="text-sm">Connected Peers: {nodeInfo.peers}</p>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className={`flex min-h-screen flex-col ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Head>
        <title>Codex File Transfer</title>
        <meta name="description" content="Simple filesharing application that uses Codex and Waku" />
        <meta property="og:title" content="Codex File Transfer" />
        <meta property="og:description" content="Simple filesharing application that uses Codex and Waku" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Codex File Transfer" />
        <meta name="twitter:description" content="Simple filesharing application that uses Codex and Waku" />
        <meta name="keywords" content="Codex, Waku, file sharing, p2p, decentralized" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Copy Success Toast */}
      {copySuccess && (
        <div className="fixed bottom-4 right-4 p-3 bg-green-500/20 border border-green-500/30 rounded-md shadow-lg z-50 max-w-md terminal-glow">
          <p className="text-xs text-green-500 font-mono flex items-center gap-1">
            <Check size={12} />
            {copySuccess}
          </p>
        </div>
      )}
      
      {/* Upload Error Toast */}
      {uploadError && (
        <div className="fixed bottom-4 right-4 p-3 bg-amber-600/20 border border-amber-600/30 rounded-md shadow-lg z-50 max-w-md terminal-glow">
          <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
            <AlertCircle size={12} />
            {uploadError}
          </p>
        </div>
      )}

      <main className="flex-1 flex flex-col p-4 md:p-8 relative z-0">
        <div className="w-full max-w-5xl mx-auto">
        {/* Combined Logo and Room ID Section */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 group md:w-1/4">
              <div className="p-2 rounded-lg bg-primary/15 shadow-sm group-hover:bg-primary/20 transition-all duration-300 border border-primary/10">
                <Waypoints size={22} className="text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="flex items-center">
                <span className="font-bold text-lg tracking-tight font-mono">CypherShare</span>
              </div>
              <div className="hidden md:flex items-center h-6 px-2.5 rounded-full bg-muted/60 border border-border text-xs font-medium text-muted-foreground font-mono">
                alpha
              </div>
            </div>
            
            {/* Room ID - Centered */}
            <div className="flex items-center justify-center md:w-2/4 w-full">
              <div className="inline-flex items-center gap-2 border border-border rounded-md px-4 py-2 bg-card shadow-sm w-full md:max-w-[350px] relative overflow-hidden">
                <span className="text-sm font-medium text-secondary-foreground whitespace-nowrap font-mono">Room ID:</span>
                <div className="relative w-full md:w-[180px]">
                  <Input
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    disabled={!isEditingRoom}
                    className={`h-8 font-mono text-base px-3 ${isEditingRoom ? "border-primary ring-1 ring-primary/30" : ""} bg-opacity-70`}
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsEditingRoom(!isEditingRoom)}
                    className="h-8 w-8 p-0 hover:bg-accent text-accent-foreground"
                    aria-label={isEditingRoom ? "Save room ID" : "Edit room ID"}
                  >
                    {isEditingRoom ? <Check size={16} className="text-primary" /> : <Edit size={16} />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyRoomId}
                    className="h-8 w-8 p-0 hover:bg-accent text-accent-foreground"
                    aria-label="Copy room ID"
                  >
                    {copiedRoom ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </Button>
                </div>
                {/* Waku connection indicator */}
                {wakuNodeType === 'light' && (
                  <div 
                    className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                      isWakuConnected 
                        ? 'bg-green-500 animate-pulse' 
                        : isWakuConnecting 
                          ? 'bg-amber-500 animate-pulse' 
                          : 'bg-red-500'
                    }`}
                    title={
                      isWakuConnected 
                        ? `Connected to Waku network (${wakuPeerCount} peers)` 
                        : isWakuConnecting 
                          ? 'Connecting to Waku network...' 
                          : 'Not connected to Waku network'
                    }
                  ></div>
                )}
                {/* Scanline effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
              </div>
            </div>
            
            {/* Icons */}
            <div className="flex items-center gap-3 shrink-0 md:w-1/4 md:justify-end">
              <a 
                href="https://github.com/hackyguru/cyphershare" 
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full hover:bg-accent/80 hover:scale-105 transition-all duration-200 flex items-center justify-center border border-primary/20"
                aria-label="View on GitHub"
              >
                <Github size={20} className="text-primary" />
              </a>
              
              <WalletConnectButton />
              {/* Settings Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    className="p-2.5 rounded-full hover:bg-accent/80 hover:scale-105 transition-all duration-200 flex items-center justify-center relative border border-primary/20"
                    aria-label="Open settings"
                  >
                    <Settings size={20} className="text-primary" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="p-5 flex flex-col">
                  <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
                  <SheetHeader className="px-1 pb-4 mb-6 border-b border-border">
                    <SheetTitle className="text-xl font-mono">SYSTEM_CONFIG</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground font-mono">
                      Configure Codex and Waku settings
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-8 px-1 flex-1 overflow-y-auto">
                    {/* Codex Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Server size={16} className="text-primary" />
                          </div>
                          <h3 className="text-base font-medium font-mono">CODEX_SETTINGS</h3>
                        </div>
                        {isCodexLoading ? (
                          <div className="w-2 h-2 rounded-full bg-amber-700/70 animate-pulse" title="Checking node status..."></div>
                        ) : isCodexNodeActive ? (
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Node is active"></div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-amber-600/80" title="Node is not active"></div>
                        )}
                      </div>
                      
                      <div className="space-y-4 pl-2 ml-2 border-l border-border">
                        <div className="space-y-2">
                          <label htmlFor="codex-url" className="text-sm font-medium font-mono">API_ENDPOINT</label>
                          <Input 
                            id="codex-url"
                            value={codexNodeUrl}
                            onChange={handleCodexUrlChange}
                            placeholder="http://localhost:8080/api/codex"
                            className="font-mono text-sm bg-card/70"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground font-mono">
                              Codex node API endpoint URL
                            </p>
                            <div className="flex items-center gap-1">
                              {isCodexNodeActive ? (
                                <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600/80"></span>
                                  {isCodexLoading ? "CHECKING" : "OFFLINE"}
                                </span>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => checkCodexStatus(true)}
                                className="h-6 w-6 p-0 rounded-full"
                                title="Refresh node status"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw">
                                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                                  <path d="M21 3v5h-5"></path>
                                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                                  <path d="M3 21v-5h5"></path>
                                </svg>
                              </Button>
                            </div>
                          </div>
                          {codexError && (
                            <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Error: {codexError}
                            </p>
                          )}
                          {!isCodexNodeActive && !isCodexLoading && !codexError && (
                            <p className="text-xs text-amber-600/90 font-mono mt-1 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Codex node is not running in the API endpoint
                            </p>
                          )}
                          
                          {/* Alert for adblocker when node is inactive */}
                          {!isCodexNodeActive && !isCodexLoading && (
                            <div className="mt-2 p-2 bg-amber-600/20 border border-amber-600/30 rounded-md">
                              <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                                <AlertCircle size={12} />
                                Turn off adblockers to avoid Codex node detection issues
                              </p>
                            </div>
                          )}
                          
                          {/* Display Node ID and Version when active */}
                          {isCodexNodeActive && nodeInfo && (
                            <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
                              <div className="flex items-center gap-1 mb-1">
                                <Info size={12} className="text-primary/70" />
                                <span className="text-xs font-medium text-primary/90 font-mono">NODE_INFO</span>
                              </div>
                              <div className="space-y-1 pl-4 border-l border-primary/10">
                                <p className="text-xs font-mono flex items-center justify-between">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span className="text-primary/80 truncate max-w-[180px]" title={nodeInfo.id}>
                                    {nodeInfo.id}
                                  </span>
                                </p>
                                <p className="text-xs font-mono flex items-center justify-between">
                                  <span className="text-muted-foreground">VERSION:</span>
                                  <span className="text-primary/80">
                                    {nodeInfo.version} ({nodeInfo.revision ?? 'N/A'})
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Waku Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Radio size={16} className="text-primary" />
                          </div>
                          <h3 className="text-base font-medium font-mono">WAKU_SETTINGS</h3>
                        </div>
                        {wakuNodeType === 'light' ? (
                          isWakuConnecting ? (
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Connecting to Waku network..."></div>
                          ) : isWakuConnected ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title={`Connected to Waku network (${wakuPeerCount} peers)`}></div>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-red-500" title="Not connected to Waku network"></div>
                          )
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-primary/80" title="Using relay node"></div>
                        )}
                      </div>
                      
                      <div className="space-y-4 pl-2 ml-2 border-l border-border">
                        <div className="space-y-2">
                          <label className="text-sm font-medium font-mono">NODE_TYPE</label>
                          <Tabs 
                            value={wakuNodeType} 
                            onValueChange={setWakuNodeType}
                            className="w-full"
                          >
                            <TabsList className="grid w-full grid-cols-2 font-mono">
                              <TabsTrigger value="light">LIGHT_NODE</TabsTrigger>
                              <TabsTrigger value="relay">RELAY_NODE</TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <p className="text-xs text-muted-foreground font-mono">
                            Select Waku node type
                          </p>
                          
                          {/* Alert for relay node */}
                          {wakuNodeType === 'relay' && (
                            <div className="mt-2 p-2 bg-amber-600/20 border border-amber-600/30 rounded-md">
                              <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                                <AlertCircle size={12} />
                                Relay node integration is not available yet
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* API_ENDPOINT - only show for RELAY_NODE */}
                        {wakuNodeType === 'relay' && (
                          <div className="space-y-2">
                            <label htmlFor="waku-url" className="text-sm font-medium font-mono">API_ENDPOINT</label>
                            <Input 
                              id="waku-url"
                              value={wakuNodeUrl}
                              onChange={(e) => setWakuNodeUrl(e.target.value)}
                              placeholder="http://127.0.0.1:8645"
                              className="font-mono text-sm bg-card/70"
                            />
                            <p className="text-xs text-muted-foreground font-mono">
                              nwaku node API endpoint URL
                            </p>
                          </div>
                        )}
                        
                        {/* Waku Status Information */}
                        {wakuNodeType === 'light' && (
                          <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
                            <div className="flex items-center gap-1 mb-1">
                              <Info size={12} className="text-primary/70" />
                              <span className="text-xs font-medium text-primary/90 font-mono">WAKU_STATUS</span>
                            </div>
                            <div className="space-y-1 pl-4 border-l border-primary/10">
                              <p className="text-xs font-mono flex items-center justify-between">
                                <span className="text-muted-foreground">STATUS:</span>
                                <span className={`${isWakuConnected ? 'text-green-500' : 'text-amber-500'}`}>
                                  {isWakuConnecting ? 'CONNECTING' : isWakuConnected ? 'CONNECTED' : 'DISCONNECTED'}
                                </span>
                              </p>
                              {isWakuConnected && (
                                <>
                                  <p className="text-xs font-mono flex items-center justify-between">
                                    <span className="text-muted-foreground">PEERS:</span>
                                    <span className="text-primary/80">{wakuPeerCount}</span>
                                  </p>
                                  <p className="text-xs font-mono flex items-center justify-between">
                                    <span className="text-muted-foreground">TOPIC:</span>
                                    <span className="text-primary/80 truncate max-w-[180px]" title={wakuContentTopic}>
                                      {wakuContentTopic}
                                    </span>
                                  </p>
                                </>
                              )}
                              {wakuError && (
                                <p className="text-xs font-mono flex items-center text-amber-500">
                                  <AlertCircle size={10} className="mr-1" />
                                  {wakuError}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TACo Settings */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Shield size={16} className="text-primary" />
                          </div>
                          <h3 className="text-base font-medium font-mono">TACO_SETTINGS</h3>
                        </div>
                        {walletConnected ? (
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Wallet connected"></div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-amber-600/80" title="Wallet not connected"></div>
                        )}
                      </div>
                      
                      <div className="space-y-4 pl-2 ml-2 border-l border-border">
                        <div className="space-y-2">
                          <label className="text-sm font-medium font-mono">WALLET_CONNECTION</label>
                          <WalletConnectButton className="w-full" />
                          <p className="text-xs text-muted-foreground font-mono">
                            {walletConnected 
                              ? "Wallet connected - TACo encryption available" 
                              : "Connect your wallet to enable TACo encryption"}
                          </p>
                        </div>
                        
                        {/* Encryption Toggle */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium font-mono">ENCRYPTION</label>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="encryption-toggle"
                              checked={useEncryption}
                              onCheckedChange={setUseEncryption}
                              disabled={!walletConnected}
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

                        {/* Access Condition Controls - Only shown when encryption is on */}
                        {useEncryption && walletConnected && (
                          <div className="mt-3 p-2 bg-card/50 border border-primary/10 rounded-md">
                            <div className="flex items-center gap-1 mb-3">
                              <Shield size={12} className="text-primary/70" />
                              <span className="text-xs font-medium text-primary/90 font-mono">ACCESS_CONDITION</span>
                            </div>
                            <div className="space-y-3 pl-4 border-l border-primary/10">
                              <div ref={useEncryptionInputRef} className="space-y-2">
                                <RadioGroup 
                                  value={accessConditionType} 
                                  onValueChange={(val) => setAccessConditionType(val as 'time' | 'positive')}
                                  className="flex flex-col"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="positive" id="positive" />
                                    <Label htmlFor="positive" className="text-xs font-mono">POSITIVE_BALANCE</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="time" id="time" />
                                    <Label htmlFor="time" className="text-xs font-mono">TIME_WINDOW</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                              
                              {accessConditionType === 'time' && (
                                <div ref={timeInputRef} className="space-y-1">
                                  <Label htmlFor="window-time" className="text-xs font-mono text-muted-foreground">
                                    WINDOW_TIME_IN_SECONDS
                                  </Label>
                                  <Input
                                    id="window-time"
                                    placeholder="3600"
                                    value={windowTimeSeconds}
                                    onChange={(e) => setWindowTimeSeconds(e.target.value)}
                                    className="font-mono text-sm bg-card/70"
                                  />
                                  <p className="text-xs text-muted-foreground font-mono">
                                    Access limited to specified time window in seconds
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <SheetFooter className="mt-8 pt-4 border-t border-border flex gap-2 shrink-0">
                    <SheetClose asChild>
                      <Button variant="outline" className="flex-1 font-mono">CANCEL</Button>
                    </SheetClose>
                    <Button 
                      className="flex-1 font-mono" 
                      onClick={handleSaveConfig}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full border-2 border-t-transparent border-white animate-spin"></span>
                          SAVING...
                        </span>
                      ) : saveSuccess ? (
                        <span className="flex items-center gap-2">
                          <Check size={16} />
                          SAVED!
                        </span>
                      ) : (
                        "SAVE_CONFIG"
                      )}
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        <div className="grid gap-8">
            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
        </div>
          
          {/* Files being uploaded section */}
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">
              Uploading Files
            </h3>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all mb-8 bg-card shadow-sm relative overflow-hidden ${
              isDragActive 
                ? "border-primary bg-accent scale-[0.99]" 
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-3 relative z-10">
              <div className={`p-4 rounded-full bg-accent transition-transform ${isDragActive ? 'scale-110' : ''}`}>
                <Upload size={36} className={`transition-colors ${isDragActive ? 'text-primary' : 'text-primary/70'}`} />
              </div>
              <h3 className="text-lg font-medium mt-2 font-mono">
                {isDragActive ? "Drop to share" : "Drag and drop your files here"}
              </h3>
              <p className="text-sm text-muted-foreground mb-2 font-mono">
                or click to select files
              </p>
              <div className="px-4 py-1.5 rounded-full bg-muted text-xs text-muted-foreground font-mono border border-primary/10">
                MAX_SIZE=100MB
              </div>
              
              {/* Waku connection status */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${
                  isWakuConnected 
                    ? 'bg-green-500 animate-pulse' 
                    : isWakuConnecting 
                      ? 'bg-amber-500 animate-pulse' 
                      : 'bg-red-500'
                }`}></div>
                <span className="text-xs font-mono">
                  {isWakuConnected 
                    ? `WAKU: CONNECTED (${wakuPeerCount} peers)` 
                    : isWakuConnecting 
                      ? 'WAKU: CONNECTING...' 
                      : 'WAKU: DISCONNECTED'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addWakuDebugLog('info', 'Manual reconnection requested');
                    reconnectWaku();
                  }}
                  className="text-xs font-mono text-primary/70 hover:text-primary bg-primary/10 px-2 py-0.5 rounded"
                >
                  RECONNECT
                </button>
              </div>
              
              {/* Debug buttons for testing - only in development */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        testClipboardCopy('Test clipboard text ' + new Date().toISOString());
                      }}
                      className="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-mono rounded-md hover:bg-primary/30 transition-colors"
                    >
                      TEST_CLIPBOARD
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        testDirectUpload();
                      }}
                      className="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-mono rounded-md hover:bg-primary/30 transition-colors"
                    >
                      TEST_DIRECT_UPLOAD
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        testWakuMessage();
                      }}
                      className="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-mono rounded-md hover:bg-primary/30 transition-colors"
                    >
                      TEST_WAKU_MESSAGE
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setWakuDebugVisible(!wakuDebugVisible);
                      }}
                      className="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-mono rounded-md hover:bg-primary/30 transition-colors"
                    >
                      {wakuDebugVisible ? 'HIDE_DEBUG' : 'SHOW_DEBUG'}
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const senderId = sessionStorage.getItem('wakuSenderId');
                        const tabId = sessionStorage.getItem('wakuTabId');
                        const userId = localStorage.getItem('wakuUserId');
                        addWakuDebugLog('info', `Sender ID: ${senderId || 'not set'}`);
                        addWakuDebugLog('info', `Tab ID: ${tabId || 'not set'}`);
                        addWakuDebugLog('info', `User ID: ${userId || 'not set'}`);
                        setCopySuccess(`Sender ID: ${senderId || 'not set'}`);
                        setTimeout(() => setCopySuccess(null), 3000);
                      }}
                      className="mt-3 px-4 py-2 bg-primary/20 text-primary text-xs font-mono rounded-md hover:bg-primary/30 transition-colors"
                    >
                      SHOW_ID
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSenderIds();
                      }}
                      className="mt-3 px-4 py-2 bg-amber-600/20 text-amber-600 text-xs font-mono rounded-md hover:bg-amber-600/30 transition-colors"
                    >
                      RESET_IDS
                    </button>
                  </div>
                  
                  {/* Waku Debug Panel */}
                  {wakuDebugVisible && (
                    <div 
                      onClick={(e) => e.stopPropagation()} 
                      className="mt-3 p-3 bg-black/80 border border-primary/30 rounded-md w-full max-w-full overflow-hidden text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-mono text-primary">WAKU_DEBUG_CONSOLE</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            Room: {roomId}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            Peers: {wakuPeerCount}
                          </span>
                          <button
                            onClick={() => setWakuDebugLogs([])}
                            className="text-xs font-mono text-primary/70 hover:text-primary"
                          >
                            CLEAR
                          </button>
                        </div>
                      </div>
                      <div className="h-40 overflow-y-auto font-mono text-xs space-y-1 bg-black/50 p-2 rounded border border-primary/10">
                        {wakuDebugLogs.length > 0 ? (
                          wakuDebugLogs.map((log, index) => (
                            <div key={index} className="flex">
                              <span className="text-muted-foreground mr-2">[{log.timestamp}]</span>
                              <span className={
                                log.type === 'error' 
                                  ? 'text-red-400' 
                                  : log.type === 'success' 
                                    ? 'text-green-400' 
                                    : 'text-blue-400'
                              }>
                                {log.message}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">No logs yet. Send a test message to see debug info.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Upload Error Message */}
              {uploadError && (
                <div className="mt-3 p-2 bg-amber-600/20 border border-amber-600/30 rounded-md w-full max-w-md">
                  <p className="text-xs text-amber-600/90 font-mono flex items-center gap-1">
                    <AlertCircle size={12} />
                    {uploadError}
                  </p>
                </div>
              )}
            </div>
            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
          </div>
        
            <div className="space-y-3">
                {Object.entries(uploadingFiles).map(([fileId, file]) => (
                  <>
                  <div key={fileId} className="p-3 bg-card rounded-lg border border-border">
                    <div className="flex flex-col gap-1 text-sm">
                      <h4 className="font-medium">{file.name}</h4>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {getFileIcon(file.type)}
                          <span>{file.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                        </div>
                        <span className="mx-1">•</span>
                        <span>{file.size.toFixed(2)} MB</span>
                      </div> 
                      <div className="text-xs text-muted-foreground">
                        {file.timestamp}
                      </div> 
                        {file.isEncrypted && (
                        <div className="flex items-center text-yellow-600 dark:text-yellow-500 mt-1 text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          <span>Encrypted</span>
                          {file.accessCondition && (
                            <Tooltip>
                              <TooltipTrigger> <Info className="h-3 w-3 ml-1 cursor-help" /> </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{file.accessCondition}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-mono text-primary">{file.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300 ease-in-out"
                      style={{ width: `${file.progress}%` }}
                    ></div>
                  </div>
                  </>
                ))}
              </div>
            </div>

          {/* Sent and Received Files Tabs */}
          <Tabs defaultValue="sent" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 font-mono">
              <TabsTrigger value="sent" className="flex items-center gap-2">
                <Upload size={16} />
                SENT_FILES
              </TabsTrigger>
              <TabsTrigger value="received" className="flex items-center gap-2">
                <Download size={16} />
                RECEIVED_FILES
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="sent">
              <Card className="shadow-sm border-border relative overflow-hidden">
                <CardHeader className="pb-3 border-b border-border bg-card">
                  <CardTitle className="text-lg font-mono">Files Sent</CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-card">
                  <div className="h-[250px] overflow-y-auto overflow-x-hidden p-4 relative">
                    {sentFiles.length > 0 ? (
                      <div className="space-y-3">
                        {sentFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border hover:border-primary/20 hover:bg-accent/50 transition-colors w-full">
                            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                              <div className="p-2 rounded-md bg-card text-primary shadow-sm border border-border flex-shrink-0">
                                {getFileIcon(file.type)}
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="font-medium text-sm font-mono truncate">{file.name}
                                  {file.isEncrypted &&
                                  <Tooltip>
                                    <TooltipTrigger> <Lock size={14} /> </TooltipTrigger>
                                    <TooltipContent>
                                      {file.accessCondition}
                                    </TooltipContent>
                                  </Tooltip>}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono truncate">{file.size.toFixed(2)} MB • {file.timestamp}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleCopyFileCid(file.id.toString())}
                                className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary text-accent-foreground border border-primary/20 transition-all relative group"
                                disabled={!file.fileId}
                                title={file.fileId ? "Copy file CID" : "No CID available"}
                              >
                                {copiedFileCid === file.id.toString() ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} />
                                )}
                                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                                  Copy CID
                                </span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDownloadFile(file.id.toString())}
                                className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary text-accent-foreground border border-primary/20 transition-all relative group"
                                disabled={!file.fileId}
                                title={file.fileId ? "Download file" : "No file available for download"}
                              >
                                <Download size={14} />
                                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                                  Download File
                                </span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="p-3 rounded-full bg-muted/50">
                          <Upload size={24} className="text-muted-foreground/60" />
                        </div>
                        <p className="text-muted-foreground font-mono mt-3">No files sent yet</p>
                        <p className="text-xs text-muted-foreground/70 font-mono mt-1">
                          Upload files to see them here
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                {/* Scanline effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
              </Card>
            </TabsContent>
            
            <TabsContent value="received">
              <Card className="shadow-sm border-border relative overflow-hidden">
                <CardHeader className="pb-3 border-b border-border bg-card">
                  <CardTitle className="text-lg font-mono">Files Received</CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-card">
                  <div className="h-[250px] overflow-y-auto overflow-x-hidden p-4 relative">
                    {receivedFiles.length > 0 ? (
                      <div className="space-y-3">
                        {receivedFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border hover:border-primary/20 hover:bg-accent/50 transition-colors w-full">
                            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                              <div className="p-2 rounded-md bg-card text-primary shadow-sm border border-border flex-shrink-0">
                                {getFileIcon(file.type)}
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="font-medium text-sm font-mono truncate">{file.name}
                                  {file.isEncrypted &&
                                  <Tooltip>
                                    <TooltipTrigger> <Lock size={14} /> </TooltipTrigger>
                                    <TooltipContent>
                                      {file.accessCondition}
                                    </TooltipContent>
                                  </Tooltip>}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono truncate">{file.size.toFixed(2)} MB • {file.timestamp}</p>
                                {file.fileId && (
                                  <p className="text-xs text-primary/70 font-mono truncate" title={file.fileId}>
                                    CID: {file.fileId.substring(0, 8)}...{file.fileId.substring(file.fileId.length - 6)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleCopyFileCid(file.id.toString())}
                                className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary text-accent-foreground border border-primary/20 transition-all relative group"
                                disabled={!file.fileId}
                                title={file.fileId ? "Copy file CID" : "No CID available"}
                              >
                                {copiedFileCid === file.id.toString() ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} />
                                )}
                                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                                  Copy CID
                                </span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDownloadFile(file.id.toString())}
                                className="h-8 w-8 p-0 hover:bg-primary/20 hover:text-primary text-accent-foreground border border-primary/20 transition-all relative group"
                                disabled={!file.fileId}
                                title={file.fileId ? "Download file" : "No file available for download"}
                              >
                                <Download size={14} />
                                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                                  Download File
                                </span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="p-3 rounded-full bg-muted/50">
                          <Download size={24} className="text-muted-foreground/60" />
                        </div>
                        <p className="text-muted-foreground font-mono mt-3">No files received yet</p>
                        <p className="text-xs text-muted-foreground/70 font-mono mt-1">
                          Received files will appear here
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                {/* Scanline effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-scanline"></div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {/* Node info section */}
      <div className="mt-4">
        {renderNodeInfo()}
      </div>
      
      <style jsx global>{`
        .terminal-display {
          font-family: var(--font-mono);
          letter-spacing: 0.5px;
        }
        
        .terminal-glow {
          box-shadow: 0 0 10px rgba(6, 243, 145, 0.3);
        }
        
        /* Add CRT screen curvature effect */
        .terminal-display::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0, 0, 0, 0.3) 100%
          );
          pointer-events: none;
          z-index: 9996;
        }
        
        /* Add subtle vignette effect */
        .terminal-display::after {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            ellipse at center,
            transparent 60%,
            rgba(3, 33, 21, 0.4) 100%
          );
          pointer-events: none;
          z-index: 9995;
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
}
