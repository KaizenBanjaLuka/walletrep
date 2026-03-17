# WalletRep ($WREP)
### Onchain Reputation Protocol

WalletRep analyzes a wallet's entire onchain history across 5 EVM chains and assigns a 1–100 reputation score, divided into 5 named tiers. Scores can optionally be minted as a Soulbound Token (SBT) on Base. **No wallet addresses or activity data are ever stored.**

<img width="1860" height="1328" alt="image" src="https://github.com/user-attachments/assets/cb4ea2cf-823e-4b66-81d8-fa531010fd7c" />

---

## 🏗️ Architecture

```
walletrep/
├── contracts/          Solidity smart contract (SBT on Base)
│   ├── WalletRep.sol
│   ├── hardhat.config.js
│   └── scripts/deploy.js
│
├── backend/            Node.js scoring & signing server
│   ├── server.js       Express API
│   ├── scorer.js       Scoring algorithm (tune weights here)
│   └── chains/         Plugin-based chain data fetchers
│       ├── index.js        Aggregator
│       ├── _evm-template.js  Shared EVM logic
│       ├── ethereum.js
│       ├── base.js
│       ├── arbitrum.js
│       ├── optimism.js
│       └── avalanche.js
│
└── frontend/
    └── index.html      Full dApp (vanilla JS prototype)
```

---

## ⭐ Tier System

| Score | Tier | Name               |
|-------|------|--------------------|
| 1–20  |  1   | 🌱 Newbie           |
| 21–55 |  2   | 👀 Explorer         |
| 56–75 |  3   | ⚡ Degen-in-Training |
| 76–90 |  4   | 🔥 Veteran          |
| 91–100|  5   | 💀 DEGEN            |

---

## 📊 Scoring Breakdown (total = 100 pts)

| Category          | Max Points | Notes                              |
|-------------------|------------|------------------------------------|
| Wallet Age        | 20         | Age + monthly consistency          |
| TX Volume         | 15         | Log scale (500+ txs = full score)  |
| TX Frequency      | 15         | Penalizes bot-like bursts          |
| DeFi Activity     | 25         | Protocol diversity + complexity    |
| NFT Activity      | 10         | Minting, buying, diversity         |
| Multi-chain       | 15         | 3pts per active chain, max 5       |

---

## 🚀 Setup Guide

### Step 1: Get your API keys

| Service  | What for                  | URL                        |
|----------|---------------------------|----------------------------|
| Alchemy  | Multi-chain data (free)   | https://alchemy.com        |
| Basescan | Contract verification     | https://basescan.org       |

### Step 2: Deploy the smart contract

```bash
cd contracts
npm install

# Create .env file:
cp .env.example .env
# Fill in:
#   DEPLOYER_PRIVATE_KEY=0x...      (wallet that deploys the contract)
#   BACKEND_SIGNER_ADDRESS=0x...    (see Step 3)
#   DONATION_WALLET=0x...           (your wallet that receives donations)
#   BASESCAN_API_KEY=...

# Deploy to Base Sepolia (testnet) first
npm run deploy:testnet

# Copy the deployed contract address from the output
```

### Step 3: Set up the backend

```bash
cd backend
npm install

# Generate a new signing keypair (do this ONCE, keep private key SECRET)
node -e "
  const { ethers } = require('ethers');
  const wallet = ethers.Wallet.createRandom();
  console.log('Private key:', wallet.privateKey);
  console.log('Address (use as BACKEND_SIGNER_ADDRESS):', wallet.address);
"

# Create .env file:
ALCHEMY_API_KEY=your_alchemy_key
BACKEND_SIGNER_PRIVATE_KEY=0x...   # from above, NEVER commit this
CONTRACT_ADDRESS=0x...              # from Step 2
CHAIN_ID=84532                      # 84532=Base Sepolia, 8453=Base Mainnet
PORT=3001

# Start the backend
npm run dev
```

### Step 4: Configure the frontend

Open `frontend/index.html` and update the CONFIG object:

```javascript
const CONFIG = {
  backendUrl:      "http://localhost:3001",  // your backend URL
  contractAddress: "0x...",                  // from Step 2
  donationWallet:  "0x...",                  // your wallet
  baseChainId:     84532,                    // testnet or mainnet
};
```

For production, bundle with Vite/Next.js and add:
- `ethers.js` for proper ABI encoding
- `wagmi` + `RainbowKit` for multi-wallet support

### Step 5: Test it

1. Open `frontend/index.html` in a browser
2. Connect MetaMask (switch to Base Sepolia)
3. Click "Run WalletRep Score"
4. Backend fetches data → computes score → returns signature
5. Click "Mint Soulbound Badge" to mint on Base

---

## 🔌 Adding a New Chain (e.g. Solana, Sui)

1. Create `backend/chains/solana.js` with the chain's data fetcher
2. Add it to the registry in `backend/chains/index.js`:
   ```javascript
   const fetchSolana = require("./solana");
   const CHAIN_MODULES = [
     ...existingModules,
     { name: "solana", fetcher: fetchSolana },
   ];
   ```
3. That's it — the aggregator and scorer handle the rest automatically.

---

## 🔐 Security Notes

- **BACKEND_SIGNER_PRIVATE_KEY** must NEVER be committed to git or exposed
- The contract validates every score signature — fake scores cannot be minted
- Nonces prevent replay attacks (each signature is single-use)
- Users can burn their own token at any time via `burnMyToken()`
- The owner can rotate the signing key if compromised via `setBackendSigner()`

---

## 🛣️ Roadmap / Next Steps

- [ ] Add Solana support (Helius API)
- [ ] Add Sui support (Blockvision API)
- [ ] Multi-wallet linking (aggregate across addresses)
- [ ] NFT metadata with dynamic SVG (score renders in the badge art)
- [ ] Telegram/email linking via ZK proof (privacy-preserving)
- [ ] Redis rate limiting for production
- [ ] Deploy to Railway (backend) + Vercel (frontend)

---

## 📄 Contract Details

- **Standard**: ERC-721 + ERC-5192 (Soulbound)
- **Network**: Base (mainnet) / Base Sepolia (testnet)
- **Non-transferable**: Tokens cannot be sold or transferred
- **Updatable**: Users can burn + remint to refresh their score
- **Opt-out**: Users can burn their token at any time

---

*WalletRep — Your onchain history speaks for itself.*
