// ─────────────────────────────────────────────────────────────────────────────
// server.js — WalletRep Scoring Backend
//
// Endpoints:
//   GET  /                   — serves index.html (main app)
//   GET  /widget.html        — serves widget.html (embeddable version)
//   POST /api/score          — compute score, return JSON (used by frontend)
//   GET  /score/:wallet      — shareable HTML page for a wallet's score
//   GET  /badge/:wallet      — embeddable SVG badge  (<img src="...">)
//   GET  /health             — health check
//
// REQUIRED .env variables:
//   ALCHEMY_API_KEY   = from alchemy.com (supports all 5 chains)
//   PORT              = (optional) defaults to 3001
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
require("dotenv").config();

const { computeScore } = require("./scorer");
const { fetchAllChains } = require("./chains");

// ── Favicon + tier badge SVGs (loaded from frontend/) ────────────────────
const FAVICON_SVG = fs.readFileSync(path.join(__dirname, "../frontend/favicon.svg"));

const BADGE_SVGS = {
  1: fs.readFileSync(path.join(__dirname, "../frontend/badge-tier1-newbie.svg"),            "utf8"),
  2: fs.readFileSync(path.join(__dirname, "../frontend/badge-tier2-explorer.svg"),          "utf8"),
  3: fs.readFileSync(path.join(__dirname, "../frontend/badge-tier3-degen-in-training.svg"), "utf8"),
  4: fs.readFileSync(path.join(__dirname, "../frontend/badge-tier4-veteran.svg"),           "utf8"),
  5: fs.readFileSync(path.join(__dirname, "../frontend/badge-tier5-degen.svg"),             "utf8"),
};

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Serve frontend files ──────────────────────────────────────────────────
app.get("/",            (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/widget.html", (_, res) => res.sendFile(path.join(__dirname, "widget.html")));
app.get("/favicon.ico", (_, res) => {
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(FAVICON_SVG);
});

// ── In-memory score cache ─────────────────────────────────────────────────
// Avoids re-fetching for shareable links and repeated requests.
// Resets on server restart (fine for Railway deploys).
const scoreCache  = new Map(); // address => { ...scoreData, cachedAt }
const CACHE_TTL   = 60 * 60 * 1000; // 1 hour

async function getScore(wallet) {
  const key    = wallet.toLowerCase();
  const cached = scoreCache.get(key);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    console.log(`Cache hit`);
    return cached;
  }

  console.log(`Scoring new request`);
  const chainData = await fetchAllChains(wallet);
  const { score, tier, tierName, breakdown } = computeScore(chainData);

  const result = {
    score,
    tier,
    tierName,
    breakdown,
    activeChainNames: chainData.activeChainNames || [],
    wallet,
    cachedAt: Date.now(),
  };

  scoreCache.set(key, result);
  return result;
}

// ── Rate limiting (POST /api/score only) ──────────────────────────────────
const requestLog  = new Map();
const RATE_LIMIT  = 60 * 1000; // 1 request per minute per wallet

// ── Cache / rate-limit cleanup (every 10 minutes) ─────────────────────────
const CLEANUP_INTERVAL = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of scoreCache) {
    if (now - v.cachedAt >= CACHE_TTL) scoreCache.delete(k);
  }
}, CLEANUP_INTERVAL);
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of requestLog) {
    if (now - v >= RATE_LIMIT) requestLog.delete(k);
  }
}, CLEANUP_INTERVAL);

function isRateLimited(wallet) {
  const key  = wallet.toLowerCase();
  const last = requestLog.get(key);
  if (last && Date.now() - last < RATE_LIMIT) {
    return Math.ceil((RATE_LIMIT - (Date.now() - last)) / 1000);
  }
  requestLog.set(key, Date.now());
  return false;
}

function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/score
// Body: { wallet: "0x..." }
// Returns: { score, tier, tierName, breakdown, activeChainNames }
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/score", async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet || !isValidAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const wait = isRateLimited(wallet);
    if (wait) {
      return res.status(429).json({ error: `Rate limited. Try again in ${wait}s` });
    }

    const result = await getScore(wallet);
    return res.json(result);

  } catch (err) {
    console.error("Scoring error:", err);
    return res.status(500).json({ error: "Failed to compute score" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /score/:wallet — server-rendered shareable score page
// Anyone can open this link without connecting a wallet.
// ─────────────────────────────────────────────────────────────────────────────
app.get("/score/:wallet", async (req, res) => {
  const { wallet } = req.params;

  if (!isValidAddress(wallet)) {
    return res.status(400).send("Invalid wallet address");
  }

  try {
    const data = await getScore(wallet);
    res.setHeader("Content-Type", "text/html");
    return res.send(renderScorePage(data));
  } catch (err) {
    console.error("Score page error:", err);
    return res.status(500).send("Failed to compute score. Try again later.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /badge/:wallet — embeddable SVG badge
// Usage: <img src="https://your-url.com/badge/0x...">
// Cached for 1 hour via Cache-Control header.
// ─────────────────────────────────────────────────────────────────────────────
app.get("/badge/:wallet", async (req, res) => {
  const { wallet } = req.params;

  if (!isValidAddress(wallet)) {
    return res.status(400).send("Invalid wallet address");
  }

  try {
    const data = await getScore(wallet);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(renderBadge(data));
  } catch (err) {
    console.error("Badge error:", err);
    return res.status(500).send("Failed to generate badge.");
  }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`\nWalletRep backend running on port ${PORT}`);
  console.log(`  Score page: http://localhost:${PORT}/score/0x...`);
  console.log(`  Badge:      http://localhost:${PORT}/badge/0x...`);
});

// ─────────────────────────────────────────────────────────────────────────────
// renderScorePage — server-rendered shareable HTML page
// ─────────────────────────────────────────────────────────────────────────────
const TIER_COLORS = { 1: "#5a5a72", 2: "#6a8fff", 3: "#f0c050", 4: "#ff6a3d", 5: "#7F77DD" };

const CATEGORIES = [
  { key: "walletAge",    label: "Wallet Age",    max: 20 },
  { key: "txVolume",     label: "TX Volume",     max: 15 },
  { key: "txFrequency",  label: "TX Frequency",  max: 15 },
  { key: "defiActivity", label: "DeFi Activity", max: 25 },
  { key: "nftActivity",  label: "NFT Activity",  max: 10 },
  { key: "multichain",   label: "Multi-chain",   max: 15 },
];

function shortWallet(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function renderScorePage(data) {
  const { score, tier, tierName, breakdown, activeChainNames, wallet } = data;
  const color   = TIER_COLORS[tier] || "#7F77DD";
  const short   = shortWallet(wallet);
  const fillPct = score + "%";
  const appUrl  = process.env.APP_URL || "https://walletrep.xyz";

  const breakdownCells = CATEGORIES.map(cat => {
    const pts = breakdown[cat.key] || 0;
    const pct = Math.round((pts / cat.max) * 100);
    return `
      <div style="background:#120F28;padding:16px;">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#888780;margin-bottom:6px;">${cat.label}</div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#EEEDFE;">
          ${pts}<span style="font-size:11px;color:#888780;">/${cat.max}</span>
        </div>
        <div style="height:2px;background:#2A2550;margin-top:8px;">
          <div style="height:100%;width:${pct}%;background:#7F77DD;"></div>
        </div>
      </div>`;
  }).join("");

  const chainPills = activeChainNames.length > 0
    ? activeChainNames.map(c =>
        `<span style="font-size:10px;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border:0.5px solid #534AB7;color:#7F77DD;border-radius:4px;">${c}</span>`
      ).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${short} — ${score}/100 on WalletRep</title>
  <meta property="og:title"       content="${short} scored ${score}/100 on WalletRep" />
  <meta property="og:description" content="${tierName} tier · Onchain reputation across 5 chains" />
  <meta name="twitter:card"       content="summary" />
  <meta name="twitter:title"      content="${short} scored ${score}/100 on WalletRep" />
  <meta name="twitter:description" content="${tierName} tier · Onchain reputation across 5 chains" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0E0C1A; color: #EEEDFE;
      font-family: 'DM Mono', monospace; min-height: 100vh;
    }
    body::after {
      content: ''; position: fixed; inset: 0;
      background-image:
        linear-gradient(#2A2550 1px, transparent 1px),
        linear-gradient(90deg, #2A2550 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none; z-index: 0; opacity: 0.3;
    }
    .wrap {
      position: relative; z-index: 1;
      max-width: 760px; margin: 0 auto;
      padding: 48px 24px 80px;
    }
  </style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:48px;">
    <div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px;letter-spacing:-0.5px;">
        Wallet<span style="color:#7F77DD;">Rep</span>
      </div>
      <div style="font-size:9px;letter-spacing:0.18em;color:#534AB7;text-transform:uppercase;margin-top:2px;">Onchain Reputation</div>
    </div>
    <div style="font-size:11px;color:#AFA9EC;letter-spacing:1px;">${short}</div>
  </div>

  <!-- Score card -->
  <div style="background:#120F28;border:0.5px solid #2A2550;border-radius:14px;padding:40px;position:relative;overflow:hidden;margin-bottom:24px;">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${color},transparent);"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
      <div style="font-family:'Syne',sans-serif;font-size:96px;font-weight:800;line-height:1;color:${color};letter-spacing:-4px;">
        ${score}<span style="font-size:24px;color:#888780;letter-spacing:0;">/100</span>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:${color};">${tierName}</div>
        <div style="font-size:11px;letter-spacing:2px;color:#888780;text-transform:uppercase;margin-top:4px;">Tier ${tier}</div>
      </div>
    </div>

    <!-- Score bar -->
    <div style="margin-bottom:32px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;letter-spacing:1px;color:#888780;text-transform:uppercase;margin-bottom:8px;">
        <span>Newbie</span><span>Intern</span><span>Activus</span><span>Vet</span><span>Degen</span>
      </div>
      <div style="height:4px;background:#2A2550;position:relative;">
        <div style="height:100%;width:${fillPct};background:${color};position:relative;">
          <div style="position:absolute;right:0;top:-4px;width:2px;height:12px;background:${color};"></div>
        </div>
      </div>
      <div style="display:flex;margin-top:10px;gap:2px;">
        <div style="flex:0.2;height:2px;background:#5a5a72;opacity:0.4;"></div>
        <div style="flex:0.35;height:2px;background:#6a8fff;opacity:0.4;"></div>
        <div style="flex:0.2;height:2px;background:#f0c050;opacity:0.4;"></div>
        <div style="flex:0.15;height:2px;background:#ff6a3d;opacity:0.4;"></div>
        <div style="flex:0.1;height:2px;background:#7F77DD;opacity:0.4;"></div>
      </div>
    </div>

    <!-- Breakdown -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#2A2550;border:0.5px solid #2A2550;border-radius:8px;overflow:hidden;">
      ${breakdownCells}
    </div>

    ${activeChainNames.length > 0 ? `
    <div style="margin-top:28px;">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888780;margin-bottom:10px;">Active on</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${chainPills}</div>
    </div>` : ""}

  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-top:32px;">
    <p style="font-size:12px;color:#888780;margin-bottom:20px;letter-spacing:0.5px;">
      What's your onchain rep?
    </p>
    <a href="${appUrl}" style="display:inline-block;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;border:0.5px solid #534AB7;color:#7F77DD;border-radius:7px;padding:14px 32px;text-decoration:none;">
      Check Your Score
    </a>
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// renderBadge — tier badge SVG with actual score injected
// Usage: <img src="https://your-url.com/badge/0x...">
// ─────────────────────────────────────────────────────────────────────────────
function renderBadge(data) {
  const { score, tier } = data;
  const svg = BADGE_SVGS[tier] || BADGE_SVGS[1];
  // Replace the static score-range text (y="144") with the wallet's actual score
  return svg.replace(/(<text[^>]+y="144"[^>]*>)[^<]*(<\/text>)/, `$1${score} / 100$2`);
}
