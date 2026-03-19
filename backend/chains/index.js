// ─────────────────────────────────────────────────────────────────────────────
// chains/index.js — Multi-chain Data Aggregator
//
// Plugin architecture: each chain is its own module.
// To add a new chain (e.g. Solana), just add a new file here.
//
// Each chain module must export:
//   fetchChainData(wallet, alchemyKey) => ChainActivity
//
// ChainActivity shape:
//   {
//     chainName:        string,
//     txCount:          number,
//     oldestTxDate:     Date | null,
//     defiTxCount:      number,
//     uniqueDefiProtos: string[],
//     hasLending:       boolean,
//     hasLP:            boolean,
//     nftTxCount:       number,
//     uniqueNFTs:       number,
//     hasNFTMinted:     boolean,
//     txsByMonth:       { [yearMonth: string]: number },
//     maxTxInOneDay:    number,
//   }
// ─────────────────────────────────────────────────────────────────────────────

const fetchEthereum  = require("./ethereum");
const fetchBase      = require("./base");
const fetchArbitrum  = require("./arbitrum");
const fetchOptimism  = require("./optimism");
const fetchAvalanche = require("./avalanche");

// ── Chain registry — add new chains here ─────────────────────────────────
// This is the ONLY place you need to edit to add a new chain.
const CHAIN_MODULES = [
  { name: "ethereum",  fetcher: fetchEthereum  },
  { name: "base",      fetcher: fetchBase      },
  { name: "arbitrum",  fetcher: fetchArbitrum  },
  { name: "optimism",  fetcher: fetchOptimism  },
  { name: "avalanche", fetcher: fetchAvalanche },
];

// ─────────────────────────────────────────────────────────────────────────────
// fetchAllChains
// Fetches data from all chains in parallel, then aggregates into
// a single object that the scorer can use.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAllChains(wallet) {
  const alchemyKey = process.env.ALCHEMY_API_KEY;

  // Fetch all chains in parallel (much faster than sequential)
  const results = await Promise.allSettled(
    CHAIN_MODULES.map(({ name, fetcher }) =>
      fetcher(wallet, alchemyKey)
        .then(data => ({ name, data, ok: true }))
        .catch(err  => {
          console.warn(`Chain ${name} fetch failed:`, err.message);
          return { name, data: null, ok: false };
        })
    )
  );

  // Extract successful results
  const chainResults = results
    .filter(r => r.status === "fulfilled" && r.value.ok)
    .map(r => r.value.data);

  const activeChains = chainResults.filter(c => c.txCount > 0);

  // ── Aggregate across all chains ───────────────────────────────────────
  const allTxsByMonth = {};
  let totalTxCount         = 0;
  let totalDefiTxCount     = 0;
  let totalNftTxCount      = 0;
  let allDefiProtocols     = new Set();
  let totalUniqueNFTs      = 0;
  let hasLending           = false;
  let hasLP                = false;
  let hasNFTMinted         = false;
  let oldestTxDate         = null;
  let globalMaxTxInOneDay  = 0;

  for (const chain of chainResults) {
    totalTxCount     += chain.txCount;
    totalDefiTxCount += chain.defiTxCount;
    totalNftTxCount  += chain.nftTxCount;
    totalUniqueNFTs  += chain.uniqueNFTs;
    hasLending        = hasLending || chain.hasLending;
    hasLP             = hasLP      || chain.hasLP;
    hasNFTMinted      = hasNFTMinted || chain.hasNFTMinted;
    globalMaxTxInOneDay = Math.max(globalMaxTxInOneDay, chain.maxTxInOneDay);

    chain.uniqueDefiProtos.forEach(p => allDefiProtocols.add(p));

    // Merge monthly activity
    for (const [month, count] of Object.entries(chain.txsByMonth)) {
      allTxsByMonth[month] = (allTxsByMonth[month] || 0) + count;
    }

    // Track oldest tx across all chains
    if (chain.oldestTxDate) {
      if (!oldestTxDate || chain.oldestTxDate < oldestTxDate) {
        oldestTxDate = chain.oldestTxDate;
      }
    }
  }

  // ── Derived metrics ───────────────────────────────────────────────────
  const now = new Date();
  const oldestTxAgeDays = oldestTxDate
    ? Math.floor((now - oldestTxDate) / (1000 * 60 * 60 * 24))
    : 0;

  // Count unique months with any activity
  const activeMonths = Object.values(allTxsByMonth).filter(c => c > 0).length;

  // Average txs per active month
  const avgTxPerMonth = activeMonths > 0
    ? Math.round(totalTxCount / activeMonths)
    : 0;

  return {
    // Totals
    totalTxCount,
    totalDefiTxCount,
    totalNftTxCount,

    // Age & consistency
    oldestTxDate,
    oldestTxAgeDays,
    activeMonths,
    avgTxPerMonth,
    maxTxInOneDay: globalMaxTxInOneDay,

    // DeFi
    defiTxCount:          totalDefiTxCount,
    uniqueDefiProtocols:  allDefiProtocols.size,
    hasLendingActivity:   hasLending,
    hasLPActivity:        hasLP,

    // NFT
    nftTxCount:  totalNftTxCount,
    uniqueNFTs:  totalUniqueNFTs,
    hasNFTMinted,

    // Multi-chain
    activeChainCount: activeChains.length,
    activeChainNames: activeChains.map(c => c.chainName),
  };
}

module.exports = { fetchAllChains, CHAIN_MODULES };
