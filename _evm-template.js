// ─────────────────────────────────────────────────────────────────────────────
// chains/_evm-template.js
// Shared fetcher factory for all EVM-compatible chains.
// Each chain module just passes its config — no duplicated logic.
// ─────────────────────────────────────────────────────────────────────────────

const axios = require("axios");

function createChainFetcher(chainName, alchemyNetwork, defiContracts, lendingProtocols, lpProtocols, lookbackMs) {
  return async function fetchChainData(wallet, alchemyKey) {
    const baseUrl    = `https://${alchemyNetwork}.g.alchemy.com/v2/${alchemyKey}`;
    const cutoffTime = new Date(Date.now() - lookbackMs);
    const transfers  = await fetchAllTransfers(wallet, baseUrl, cutoffTime);

    if (transfers.length === 0) return emptyChainData(chainName);

    let txCount = 0, defiTxCount = 0, nftTxCount = 0;
    const defiProtocols = new Set();
    const nftContracts  = new Set();
    let hasLending = false, hasLP = false, hasNFTMinted = false;
    let oldestTxDate = null;
    const txsByMonth = {}, txsByDay = {};

    for (const tx of transfers) {
      const txDate = new Date(tx.metadata?.blockTimestamp || 0);
      if (txDate < cutoffTime) continue;
      txCount++;

      if (!oldestTxDate || txDate < oldestTxDate) oldestTxDate = txDate;

      const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
      txsByMonth[monthKey] = (txsByMonth[monthKey] || 0) + 1;

      const dayKey = txDate.toISOString().split("T")[0];
      txsByDay[dayKey] = (txsByDay[dayKey] || 0) + 1;

      const toAddr = (tx.to || "").toLowerCase();
      if (defiContracts.has(toAddr)) {
        const protocol = defiContracts.get(toAddr);
        defiTxCount++;
        defiProtocols.add(protocol);
        if (lendingProtocols.has(protocol)) hasLending = true;
        if (lpProtocols.has(protocol))      hasLP      = true;
      }

      if (tx.category === "erc721" || tx.category === "erc1155") {
        nftTxCount++;
        if (tx.rawContract?.address) nftContracts.add(tx.rawContract.address.toLowerCase());
        if (!tx.from || tx.from === "0x0000000000000000000000000000000000000000") hasNFTMinted = true;
      }
    }

    return {
      chainName,
      txCount,
      oldestTxDate,
      defiTxCount,
      uniqueDefiProtos: [...defiProtocols],
      hasLending,
      hasLP,
      nftTxCount,
      uniqueNFTs:    nftContracts.size,
      hasNFTMinted,
      txsByMonth,
      maxTxInOneDay: Math.max(0, ...Object.values(txsByDay)),
    };
  };
}

async function fetchAllTransfers(wallet, baseUrl, cutoffTime) {
  const allTransfers = [];
  let pageKey = undefined;

  do {
    const body = {
      id: 1, jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [{
        fromAddress: wallet,
        category:    ["external", "erc20", "erc721", "erc1155"],
        withMetadata: true,
        excludeZeroValue: false,
        maxCount: "0x3e8",
        ...(pageKey ? { pageKey } : {}),
      }]
    };

    const response = await axios.post(baseUrl, body, { timeout: 10000 });
    const result   = response.data?.result;
    if (!result?.transfers) break;

    allTransfers.push(...result.transfers);

    const oldest = result.transfers[result.transfers.length - 1];
    if (new Date(oldest?.metadata?.blockTimestamp || 0) < cutoffTime) break;
    pageKey = result.pageKey;
  } while (pageKey);

  return allTransfers;
}

function emptyChainData(chainName) {
  return { chainName, txCount: 0, oldestTxDate: null, defiTxCount: 0,
    uniqueDefiProtos: [], hasLending: false, hasLP: false,
    nftTxCount: 0, uniqueNFTs: 0, hasNFTMinted: false,
    txsByMonth: {}, maxTxInOneDay: 0 };
}

module.exports = { createChainFetcher };
