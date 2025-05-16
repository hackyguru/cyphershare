# FileShare - Secure File Sharing Application

A secure file sharing application built with Next.js, React, and TailwindCSS that integrates with Codex and Waku protocols.

## Features

- Secure file sharing with end-to-end encryption
- Integration with Codex and Waku protocols
- Real-time status monitoring of Codex and Waku nodes
- Customizable API endpoints
- Modern, responsive UI with dark mode
- Optional client-side encryption powered by TACo with customizable on-chain access conditions
- Seamless Ethereum wallet connectivity (MetaMask) for signing encryption/decryption operations

## Codex Integration

The application integrates with Codex nodes through a dedicated client implementation. The integration includes:

- Real-time status monitoring of Codex nodes
- Customizable API endpoint configuration
- Visual indicators for node status (active/inactive)
- Error handling and reporting

### Codex Client Architecture

The Codex integration is implemented using a modular architecture:

1. **CodexClient Class and useCodex Hook** (`hooks/useCodex.ts`):

   - Contains the complete Codex implementation in a single file
   - Handles all API requests to Codex nodes
   - Manages node status checking and caching
   - Provides methods for interacting with Codex APIs
   - Implements React hook for using the Codex client in components
   - Manages state for node status, loading, and errors
   - Provides methods for updating the API endpoint

2. **UI Integration**:
   - Visual indicators for node status
   - Form for configuring the API endpoint
   - Error reporting and status messages

## TACo Encryption & Access Control

The application uses **[TACo](https://github.com/nucypher/taco)** for client-side encryption and on-chain access control. The integration is encapsulated in `hooks/useTaco.ts` and is tightly coupled with the file-upload flow.

Key points:

- Files are encrypted in the browser _before_ they are uploaded to Codex; only ciphertext ever leaves the client.
- Decryption happens on-demand and only when the connected wallet satisfies the defined TACo **Condition**s.
- Helper utilities are provided for two common conditions as examples of using TACo:
  - **Positive balance** of POL (Polygon Amoy)
  - **Time-limited** access (N seconds from upload)
- You can define any arbitrary on-chain condition by instantiating a TACo `Condition` in your code.
- Wallet connectivity (handled transparently by `WalletProvider` and the **Connect Wallet** button) is only required to sign TACo encryption/decryption requests.

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### Codex Node

By default, the application connects to a Codex node at `http://localhost:8080/api/codex`. You can change this in the settings panel.

### Waku Node

By default, the application connects to a Waku node at `http://127.0.0.1:8645`. You can change this in the settings panel.

### Ethereum Network

The application targets the **Polygon Amoy** testnet (`80002`). If your MetaMask wallet is on a different network, the app will automatically request to add/switch to the correct network.

## License

MIT
