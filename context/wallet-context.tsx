import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

// Define the context value type
interface WalletContextType {
  walletConnected: boolean;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.providers.JsonRpcSigner | null;
  walletAddress: string;
  truncatedAddress: string;
  connectWallet: () => Promise<ethers.providers.Web3Provider | null>;
}

// Create the context with a default value
const WalletContext = createContext<WalletContextType>({
  walletConnected: false,
  provider: null,
  signer: null,
  walletAddress: '',
  truncatedAddress: '',
  connectWallet: async () => null,
});

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

// Helper function to truncate wallet address
const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function WalletProvider({ children }: WalletProviderProps) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [truncatedAddress, setTruncatedAddress] = useState('');

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            const address = accounts[0];
            setProvider(provider);
            setSigner(provider.getSigner());
            setWalletAddress(address);
            setTruncatedAddress(truncateAddress(address));
            setWalletConnected(true);
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
    };
    
    checkConnection();
  }, []);

  // Connect to Ethereum wallet
  const connectWallet = useCallback(async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        
        // Check if we're on the correct network (Polygon Amoy testnet)
        const { chainId } = await provider.getNetwork();
        const amoyChainId = 80002;
        
        if (chainId !== amoyChainId) {
          try {
            // Try to switch to Amoy testnet
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x13882' }], // 0x13882 is 80002 in hex
            });
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x13882',
                    chainName: 'Polygon Amoy Testnet',
                    nativeCurrency: {
                      name: 'MATIC',
                      symbol: 'MATIC',
                      decimals: 18,
                    },
                    rpcUrls: ['https://rpc-amoy.polygon.technology'],
                    blockExplorerUrls: ['https://amoy.polygonscan.com/'],
                  },
                ],
              });
            } else {
              throw switchError;
            }
          }
        }
        
        setProvider(provider);
        setSigner(provider.getSigner());
        setWalletAddress(address);
        setTruncatedAddress(truncateAddress(address));
        setWalletConnected(true);
        
        return provider;
      } else {
        console.error('MetaMask not found');
        alert('Please install MetaMask to use encryption features');
        return null;
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      alert('Failed to connect wallet: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }, []);

  // Handle account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          setWalletConnected(false);
          setProvider(null);
          setSigner(null);
          setWalletAddress('');
          setTruncatedAddress('');
        } else if (walletConnected) {
          // User switched accounts, update the signer and address
          if (provider) {
            const newAddress = accounts[0];
            setSigner(provider.getSigner());
            setWalletAddress(newAddress);
            setTruncatedAddress(truncateAddress(newAddress));
          }
        }
      };

      const handleChainChanged = () => {
        // When chain changes, refresh the page to ensure we have the correct network context
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [provider, walletConnected]);

  const value = {
    walletConnected,
    provider,
    signer,
    walletAddress,
    truncatedAddress,
    connectWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
