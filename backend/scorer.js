// ─────────────────────────────────────────────────────────────────────────────
// scorer.js — WalletRep Scoring Algorithm
//
// Takes aggregated chain data and returns a 1-100 score.
// Each category has a max point value and its own scoring logic.
// Adjust the weights here without touching any other files.
//
// SCORING BREAKDOWN (total = 100 points):
//   Wallet Age & Consistency   = 20 pts
//   Transaction Volume         = 15 pts
//   Transaction Frequency      = 15 pts
//   DeFi Activity              = 25 pts
//   NFT Activity               = 10 pts
//   Multi-chain Presence       = 15 pts
// ─────────────────────────────────────────────────────────────────────────────

// ── Tier definitions ──────────────────────────────────────────────────────
const TIERS = [
  { min: 1,  max: 20,  tier: 1, name: "Newbie"  },
  { min: 21, max: 55,  tier: 2, name: "Explorer"          },
  { min: 56, max: 75,  tier: 3, name: "Degen-in-Training" },
  { min: 76, max: 90,  tier: 4, name: "Veteran"           },
  { min: 91, max: 100, tier: 5, name: "DEGEN"             },
];

// ── Scoring weights (must sum to 100) ────────────────────────────────────
const WEIGHTS = {
  walletAge:      20,
  txVolume:       15,
  txFrequency:    15,
  defiActivity:   25,
  nftActivity:    10,
  multichain:     15,
};

// ─────────────────────────────────────────────────────────────────────────────
// computeScore
// @param chainData  Aggregated data from all chain modules
// @returns { score, tier, tierName, breakdown }
// ─────────────────────────────────────────────────────────────────────────────
function computeScore(chainData) {
  const breakdown = {};

  // ── 1. Wallet Age & Consistency (20 pts) ─────────────────────────────
  // Rewards wallets that have been active for a long time and regularly.
  // Max points at 3+ years old, with bonus for consistent monthly activity.
  breakdown.walletAge = scoreWalletAge(chainData, WEIGHTS.walletAge);

  // ── 2. Transaction Volume (15 pts) ───────────────────────────────────
  // Rewards higher cumulative transaction counts across all chains.
  breakdown.txVolume = scoreTxVolume(chainData, WEIGHTS.txVolume);

  // ── 3. Transaction Frequency (15 pts) ────────────────────────────────
  // Rewards consistent activity over time (not just one burst).
  // Penalizes bot-like behavior (1000 txs in one day).
  breakdown.txFrequency = scoreTxFrequency(chainData, WEIGHTS.txFrequency);

  // ── 4. DeFi Activity (25 pts) ────────────────────────────────────────
  // Rewards interactions with known DeFi protocols (Uniswap, Aave, etc.)
  breakdown.defiActivity = scoreDefi(chainData, WEIGHTS.defiActivity);

  // ── 5. NFT Activity (10 pts) ─────────────────────────────────────────
  // Rewards NFT minting, buying, selling across chains.
  breakdown.nftActivity = scoreNFT(chainData, WEIGHTS.nftActivity);

  // ── 6. Multi-chain Presence (15 pts) ─────────────────────────────────
  // Rewards using multiple chains (3pts per chain, max 5 chains).
  breakdown.multichain = scoreMultichain(chainData, WEIGHTS.multichain);

  // ── Total ─────────────────────────────────────────────────────────────
  const rawScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score    = Math.max(1, Math.min(100, Math.round(rawScore)));

  // ── Tier lookup ───────────────────────────────────────────────────────
  const tierData = TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];

  return {
    score,
    tier:     tierData.tier,
    tierName: tierData.name,
    breakdown
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual scoring functions
// ─────────────────────────────────────────────────────────────────────────────

function scoreWalletAge(data, maxPts) {
  const ageInDays    = data.oldestTxAgeDays || 0;
  const activeMonths = data.activeMonths    || 0;

  // Age component (up to 70% of max)
  // 3 years (1095 days) = full age score
  const ageScore = Math.min(1, ageInDays / 1095) * (maxPts * 0.7);

  // Consistency component (up to 30% of max)
  // Active in 24+ months (out of 36) = full consistency score
  const consistencyScore = Math.min(1, activeMonths / 24) * (maxPts * 0.3);

  return Math.round(ageScore + consistencyScore);
}

function scoreTxVolume(data, maxPts) {
  const totalTxs = data.totalTxCount || 0;

  // Logarithmic scale: 500+ txs = full score
  // log10(500) ≈ 2.7, so we normalize against that
  if (totalTxs === 0) return 0;
  const logScore = Math.log10(totalTxs) / Math.log10(500);
  return Math.round(Math.min(1, logScore) * maxPts);
}

function scoreTxFrequency(data, maxPts) {
  const avgTxPerMonth = data.avgTxPerMonth || 0;
  const maxTxPerMonth = data.maxTxInOneDay || 0;

  // Penalize bot-like behavior: >500 txs in one day is suspicious
  const botPenalty = maxTxPerMonth > 500 ? 0.5 : 1.0;

  // Ideal frequency: 10-50 txs/month = full score
  const freqScore = Math.min(1, avgTxPerMonth / 30);

  return Math.round(freqScore * botPenalty * maxPts);
}

function scoreDefi(data, maxPts) {
  const protocols    = data.uniqueDefiProtocols || 0;
  const defiTxCount  = data.defiTxCount         || 0;
  const hasLending   = data.hasLendingActivity   || false;
  const hasLP        = data.hasLPActivity        || false;

  // Protocol diversity (up to 50% of max): 10+ protocols = full
  const diversityScore = Math.min(1, protocols / 10) * (maxPts * 0.5);

  // Volume of DeFi txs (up to 30% of max): 100+ txs = full
  const volumeScore = Math.min(1, defiTxCount / 100) * (maxPts * 0.3);

  // Complexity bonus (up to 20% of max): lending + LP = sophisticated user
  const complexityScore = ((hasLending ? 0.5 : 0) + (hasLP ? 0.5 : 0)) * (maxPts * 0.2);

  return Math.round(diversityScore + volumeScore + complexityScore);
}

function scoreNFT(data, maxPts) {
  const nftTxCount    = data.nftTxCount    || 0;
  const uniqueNFTs    = data.uniqueNFTs    || 0;
  const hasMinted     = data.hasNFTMinted  || false;

  if (nftTxCount === 0) return 0;

  // Activity score (up to 60% of max): 50+ NFT txs = full
  const activityScore = Math.min(1, nftTxCount / 50) * (maxPts * 0.6);

  // Diversity score (up to 30% of max): 20+ unique NFTs = full
  const diversityScore = Math.min(1, uniqueNFTs / 20) * (maxPts * 0.3);

  // Minting bonus (10% of max)
  const mintBonus = hasMinted ? maxPts * 0.1 : 0;

  return Math.round(activityScore + diversityScore + mintBonus);
}

function scoreMultichain(data, maxPts) {
  const activeChains = data.activeChainCount || 0;

  // 3 points per active chain, max 5 chains = 15 pts
  const ptsPerChain = maxPts / 5;
  return Math.round(Math.min(5, activeChains) * ptsPerChain);
}

module.exports = { computeScore, TIERS, WEIGHTS };
