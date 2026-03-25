Changelog — WalletRep (wlltrep.xyz)
All notable changes to this project will be documented here.
Format: Keep a Changelog
Versioning: Semantic Versioning — MAJOR.MINOR.PATCH

[Unreleased]
Planned (open issues)

#2 feat: add Polygon and BNB Chain scoring
#3 feat: add Avalanche C-Chain scoring
#4 feat: add Solana wallet scoring (Helius API)
#5 feat: embed widget and public API
#7 feat: add crypto donate button
#8 improve: wallet connection UX and pre-connection messaging

Roadmap (beyond open issues)

NFT metadata with dynamic SVG (score renders in badge art)
Multi-wallet linking (aggregate across addresses)
Telegram/email linking via ZK proof (privacy-preserving)
Redis rate limiting for production backend
Deploy backend to Railway
Cross-product: wlltresume × WalletRep score integration
Sui support (Blockvision API)


[1.0.0] — Initial Launch
Added

Multichain wallet reputation scoring across 5 EVM chains (Ethereum, Base, Arbitrum, Optimism, Avalanche)
5-tier scoring system: Newbie → Explorer → Degen-in-Training → Veteran → DEGEN (1–100 scale)
Scoring algorithm across 6 categories: Wallet Age (20pts), TX Volume (15pts), TX Frequency (15pts), DeFi Activity (25pts), NFT Activity (10pts), Multi-chain Activity (15pts)
Plugin-based chain architecture (/backend/chains/) — new chains can be added without touching core logic
Node.js + Express backend scoring and signing server
Cryptographic signature flow — backend signs scores, contract validates signatures before minting
Soulbound Token (SBT) smart contract on Base — ERC-721 + ERC-5192 standard
Non-transferable tokens — cannot be sold or moved between wallets
Burn + remint flow — users can refresh their score at any time
Opt-out — users can burn their token at any time via burnMyToken()
Owner key rotation via setBackendSigner() if signing key is compromised
Nonce-based replay attack prevention — each signature is single-use
Vanilla JS frontend (index.html) — zero framework, single file
No wallet data storage — addresses and activity never persisted
Deployed to Vercel (frontend) with Base Sepolia testnet support
.env.example for safe onboarding — secrets never committed
