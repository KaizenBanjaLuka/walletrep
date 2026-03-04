// ─────────────────────────────────────────────────────────────────────────────
// chains/base.js
// Fetches wallet activity on Base mainnet via Alchemy API.
// ─────────────────────────────────────────────────────────────────────────────

const { createChainFetcher } = require("./_evm-template");

const LOOKBACK_MS = 365 * 3 * 24 * 60 * 60 * 1000; // 3 years

const DEFI_CONTRACTS = new Map([
  // Uniswap
  ["0x2626664c2603336e57b271c5c0b26f421741e481", "uniswap-v3"],
  ["0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", "uniswap-universal"],
  // Aave v3
  ["0xa238dd80c259a72e81d7e4664a9801593f98d1c5", "aave-v3"],
  // Aerodrome (Base-native LP)
  ["0xcf77a3ba9a5ca399b7c97c74d54e5b1357880dce", "aerodrome"],
  // 1inch
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
]);

const LENDING_PROTOCOLS = new Set(["aave-v3"]);
const LP_PROTOCOLS      = new Set(["uniswap-v3", "aerodrome"]);

module.exports = createChainFetcher(
  "base",
  "base-mainnet",
  DEFI_CONTRACTS,
  LENDING_PROTOCOLS,
  LP_PROTOCOLS,
  LOOKBACK_MS
);
