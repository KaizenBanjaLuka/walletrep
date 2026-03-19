// ─────────────────────────────────────────────────────────────────────────────
// chains/ethereum.js
// Fetches wallet activity on Ethereum mainnet via Alchemy API.
//
// This file is the template for all EVM chain modules.
// To add a new EVM chain, copy this file and change:
//   1. CHAIN_NAME
//   2. ALCHEMY_BASE_URL
//   3. DEFI_CONTRACTS (chain-specific protocol addresses)
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

const CHAIN_NAME      = "ethereum";
const ALCHEMY_NETWORK = "eth-mainnet";

// ── Look-back window: 3 years ─────────────────────────────────────────────
const LOOKBACK_DAYS  = 365 * 3;
const LOOKBACK_MS    = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

// ── Known DeFi protocol addresses on Ethereum ────────────────────────────
// Add more as needed. These are used to classify txs as "DeFi activity".
const DEFI_CONTRACTS = new Map([
  // Uniswap
  ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "uniswap-v2"],
  ["0xe592427a0aece92de3edee1f18e0157c05861564", "uniswap-v3"],
  ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "uniswap-universal"],
  // Aave
  ["0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", "aave"],
  ["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", "aave-v3"],
  // Compound
  ["0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b", "compound"],
  // Curve
  ["0x99a58482bd75cbab83b27ec03ca68ff489b5788f", "curve"],
  // Lido
  ["0xae7ab96520de3a18e5e111b5eaab095312d7fe84", "lido"],
  // MakerDAO
  ["0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", "maker"],
  // 1inch
  ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch"],
]);

// Known lending protocols (for hasLending flag)
const LENDING_PROTOCOLS = new Set(["aave", "aave-v3", "compound", "maker"]);

// Known LP protocols (for hasLP flag)
const LP_PROTOCOLS = new Set(["uniswap-v2", "uniswap-v3", "curve"]);

// ─────────────────────────────────────────────────────────────────────────────
// fetchChainData
// ─────────────────────────────────────────────────────────────────────────────
async function fetchChainData(wallet, alchemyKey) {
  const baseUrl = `https://${ALCHEMY_NETWORK}.g.alchemy.com/v2/${alchemyKey}`;
  const cutoffTime = new Date(Date.now() - LOOKBACK_MS);

  // ── Fetch transaction history ─────────────────────────────────────────
  // Alchemy getAssetTransfers returns a paginated list of all txs
  const transfers = await fetchAllTransfers(wallet, baseUrl, cutoffTime);

  if (transfers.length === 0) {
    return emptyChainData();
  }

  // ── Process transfers ─────────────────────────────────────────────────
  let txCount         = 0;
  let defiTxCount     = 0;
  let nftTxCount      = 0;
  const defiProtocols = new Set();
  const nftContracts  = new Set();
  let hasLending      = false;
  let hasLP           = false;
  let hasNFTMinted    = false;
  let oldestTxDate    = null;
  const txsByMonth    = {};
  const txsByDay      = {};

  for (const tx of transfers) {
    const txDate = new Date(tx.metadata?.blockTimestamp || 0);
    if (txDate < cutoffTime) continue;

    txCount++;

    // Track oldest transaction
    if (!oldestTxDate || txDate < oldestTxDate) {
      oldestTxDate = txDate;
    }

    // Track by month (for consistency scoring)
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
    txsByMonth[monthKey] = (txsByMonth[monthKey] || 0) + 1;

    // Track by day (for bot detection)
    const dayKey = txDate.toISOString().split("T")[0];
    txsByDay[dayKey] = (txsByDay[dayKey] || 0) + 1;

    // Classify DeFi txs
    const toAddr = (tx.to || "").toLowerCase();
    if (DEFI_CONTRACTS.has(toAddr)) {
      const protocol = DEFI_CONTRACTS.get(toAddr);
      defiTxCount++;
      defiProtocols.add(protocol);
      if (LENDING_PROTOCOLS.has(protocol)) hasLending = true;
      if (LP_PROTOCOLS.has(protocol))      hasLP      = true;
    }

    // Classify NFT txs (ERC-721 and ERC-1155)
    if (tx.category === "erc721" || tx.category === "erc1155") {
      nftTxCount++;
      if (tx.rawContract?.address) {
        nftContracts.add(tx.rawContract.address.toLowerCase());
      }
      // "from" is null/zero address = minted
      if (!tx.from || tx.from === "0x0000000000000000000000000000000000000000") {
        hasNFTMinted = true;
      }
    }
  }

  const maxTxInOneDay = Math.max(0, ...Object.values(txsByDay));

  return {
    chainName:        CHAIN_NAME,
    txCount,
    oldestTxDate,
    defiTxCount,
    uniqueDefiProtos: [...defiProtocols],
    hasLending,
    hasLP,
    nftTxCount,
    uniqueNFTs:       nftContracts.size,
    hasNFTMinted,
    txsByMonth,
    maxTxInOneDay,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchAllTransfers — handles Alchemy pagination automatically
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllTransfers(wallet, baseUrl, cutoffTime) {
  const allTransfers = [];
  let pageKey        = undefined;
  const cutoffHex    = "0x" + Math.floor(cutoffTime.getTime() / 1000).toString(16);

  do {
    const body = {
      id:      1,
      jsonrpc: "2.0",
      method:  "alchemy_getAssetTransfers",
      params:  [{
        fromAddress:    wallet,
        category:       ["external", "erc20", "erc721", "erc1155"],
        withMetadata:   true,
        excludeZeroValue: false,
        maxCount:       "0x3e8", // 1000 per page
        ...(pageKey ? { pageKey } : {}),
      }]
    };

    const response = await axios.post(baseUrl, body, { timeout: 10000 });
    const result   = response.data?.result;

    if (!result?.transfers) break;

    // Stop fetching if we've gone past the cutoff window
    const oldestInPage = result.transfers[result.transfers.length - 1];
    const oldestDate   = new Date(oldestInPage?.metadata?.blockTimestamp || 0);

    allTransfers.push(...result.transfers);

    if (oldestDate < cutoffTime) break; // no need to fetch more pages
    pageKey = result.pageKey;

  } while (pageKey);

  return allTransfers;
}

function emptyChainData() {
  return {
    chainName:       CHAIN_NAME,
    txCount:         0,
    oldestTxDate:    null,
    defiTxCount:     0,
    uniqueDefiProtos:[],
    hasLending:      false,
    hasLP:           false,
    nftTxCount:      0,
    uniqueNFTs:      0,
    hasNFTMinted:    false,
    txsByMonth:      {},
    maxTxInOneDay:   0,
  };
}

module.exports = fetchChainData;
