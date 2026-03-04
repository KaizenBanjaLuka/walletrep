// ─────────────────────────────────────────────────────────────────────────────
// chains/optimism.js
// Fetches wallet activity on Optimism via Alchemy API.
// ─────────────────────────────────────────────────────────────────────────────

const { createChainFetcher } = require("./_evm-template");

const LOOKBACK_MS = 365 * 3 * 24 * 60 * 60 * 1000; // 3 years

const DEFI_CONTRACTS = new Map([
  // Uniswap
  ["0xe592427a0aece92de3edee1f18e0157c05861564", "uniswap-v3"],
  ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "uniswap-universal"],
  // Aave v3
  ["0x794a61358d6845594f94dc1db02a252b5b4814ad", "aave-v3"],
  // Velodrome (Optimism-native LP)
  ["0x9c12939390052919af3155f41bf4160fd3666a6f", "velodrome"],
  // 1inch
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
]);

const LENDING_PROTOCOLS = new Set(["aave-v3"]);
const LP_PROTOCOLS      = new Set(["uniswap-v3", "velodrome"]);

module.exports = createChainFetcher(
  "optimism",
  "opt-mainnet",
  DEFI_CONTRACTS,
  LENDING_PROTOCOLS,
  LP_PROTOCOLS,
  LOOKBACK_MS
);
