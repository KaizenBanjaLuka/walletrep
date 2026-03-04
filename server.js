// ─────────────────────────────────────────────────────────────────────────────
// server.js — WalletRep Scoring Backend
//
// What this does:
//  1. Receives a wallet address from the frontend
//  2. Queries each EVM chain for the wallet's activity (plugin architecture)
//  3. Computes a 1-100 score across all chains
//  4. Signs the score with the backend private key (ECDSA)
//  5. Returns the score + signature to the frontend for minting
//
// REQUIRED .env variables:
//   ALCHEMY_API_KEY         = from alchemy.com (supports all 5 chains)
//   BACKEND_SIGNER_PRIVATE_KEY = private key for signing scores (keep SECRET)
//   CONTRACT_ADDRESS        = deployed WalletRep contract address
//   PORT                    = (optional) defaults to 3001
// ─────────────────────────────────────────────────────────────────────────────

const express    = require("express");
const cors       = require("cors");
const { ethers } = require("ethers");
require("dotenv").config();

const { computeScore } = require("./scorer");
const { fetchAllChains } = require("./chains");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Signing wallet (your backend's private key) ───────────────────────────
const signingWallet = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY);
console.log("Backend signer address:", signingWallet.address);
console.log("⚠️  Make sure this matches BACKEND_SIGNER_ADDRESS in your contract deploy!");

// ── Rate limiting (simple in-memory, swap for Redis in production) ────────
const requestLog = new Map(); // address => last request timestamp
const RATE_LIMIT_MS = 60 * 1000; // 1 request per minute per wallet

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/score
// Body: { wallet: "0x..." }
// Returns: { score, tier, tierName, breakdown, signature, nonce }
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/score", async (req, res) => {
  try {
    const { wallet } = req.body;

    // ── Validate wallet address ───────────────────────────────────────
    if (!wallet || !ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const normalizedWallet = wallet.toLowerCase();

    // ── Rate limit check ──────────────────────────────────────────────
    const lastRequest = requestLog.get(normalizedWallet);
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest)) / 1000);
      return res.status(429).json({
        error: `Rate limited. Try again in ${retryAfter}s`
      });
    }
    requestLog.set(normalizedWallet, Date.now());

    console.log(`\nScoring wallet: ${wallet}`);

    // ── Fetch activity across all chains ─────────────────────────────
    // Each chain module returns a standardized ActivityData object.
    // Adding a new chain = adding one new file in /chains/
    const chainData = await fetchAllChains(wallet);
    console.log("Chain data fetched:", Object.keys(chainData));

    // ── Compute score ─────────────────────────────────────────────────
    const { score, tier, tierName, breakdown } = computeScore(chainData);
    console.log(`Score: ${score}/100 — ${tierName} (Tier ${tier})`);

    // ── Get current nonce from contract ──────────────────────────────
    // The nonce prevents replay attacks (signature can only be used once)
    const provider = new ethers.JsonRpcProvider(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    );
    const contractABI = ["function nonces(address) view returns (uint256)"];
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      provider
    );
    const nonce = await contract.nonces(wallet);

    // ── Sign the score ────────────────────────────────────────────────
    // This is what the smart contract will verify on-chain.
    // Message: keccak256(wallet, score, tier, nonce, chainId)
    // Base Sepolia chainId = 84532, Base Mainnet = 8453
    const chainId = process.env.CHAIN_ID || 84532;

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint8", "uint8", "uint256", "uint256"],
      [wallet, score, tier, nonce, chainId]
    );

    const signature = await signingWallet.signMessage(
      ethers.getBytes(messageHash)
    );

    // ── Return result ─────────────────────────────────────────────────
    // NOTE: We do NOT store the wallet address or activity data.
    // The score is computed and returned — nothing is persisted.
    return res.json({
      score,
      tier,
      tierName,
      breakdown,   // per-category subscores for the UI
      signature,
      nonce: nonce.toString()
    });

  } catch (err) {
    console.error("Scoring error:", err);
    return res.status(500).json({ error: "Failed to compute score" });
  }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`\nWalletRep scoring backend running on port ${PORT}`);
});
