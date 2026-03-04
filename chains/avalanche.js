// ─────────────────────────────────────────────────────────────────────────────
// chains/avalanche.js
// Fetches wallet activity on Avalanche C-Chain via Alchemy API.
// ─────────────────────────────────────────────────────────────────────────────

const { createChainFetcher } = require("./_evm-template");

const LOOKBACK_MS = 365 * 3 * 24 * 60 * 60 * 1000; // 3 years

const DEFI_CONTRACTS = new Map([
  // Trader Joe (Avalanche-native DEX)
  ["0x60ae616a2155ee3d9a68541ba4544862310933d4", "traderjoe"],
  // Pangolin
  ["0xe0c6cac29fdd8e8e14e7d0a2e0dabb012c3c5b6a", "pangolin"],
  // Aave v3
  ["0x794a61358d6845594f94dc1db02a252b5b4814ad", "aave-v3"],
  // 1inch
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
]);

const LENDING_PROTOCOLS = new Set(["aave-v3"]);
const LP_PROTOCOLS      = new Set(["traderjoe", "pangolin"]);

module.exports = createChainFetcher(
  "avalanche",
  "avax-mainnet",
  DEFI_CONTRACTS,
  LENDING_PROTOCOLS,
  LP_PROTOCOLS,
  LOOKBACK_MS
);
