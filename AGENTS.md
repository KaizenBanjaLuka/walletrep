# AGENTS.md — WalletRep (KaizenBanjaLuka/walletrep)

> This file is the source of truth for all Claude Code sessions working on the WalletRep repo.
> Read this fully before writing any code, making any suggestion, or planning any feature.
> If anything here conflicts with a suite-level AGENTS.md, this file takes precedence for this repo.

---

## 1. What This Product Is

**WalletRep** is a multichain onchain wallet reputation scoring dApp.
- Live at: **wlltrep.xyz**
- Scores wallets across 5 chains on 6 dimensions, assigns a reputation tier (1–5)
- No wallet data stored — everything computed live
- Layer 1 of a 3-product Web3 identity suite (WalletRep → wlltresume → Wallet Passport)

---

## 2. Who I Am

| Field | Detail |
|---|---|
| Role | Project & Product Manager. Web3/crypto background. No traditional dev experience. |
| Building | AI-assisted development using Claude (chat) + Claude Code (terminal) |
| GitHub Org | KaizenBanjaLuka |
| Personal GitHub | bojan-pilipovic |

---

## 3. Infrastructure

| Service | Role | Notes |
|---|---|---|
| Vercel | Frontend hosting | Auto-deploys on push to main |
| Railway | Backend hosting | Auto-deploys on push to main (Starter plan — always on) |
| Alchemy API | Onchain data | Free tier — flag if limits approach |
| Namecheap | Domain | wlltrep.xyz |
| Notion | Task tracker | Linked to GitHub Issues |
| GitHub Issues | Project tracking | Backlog → In Progress → In Review → Done |

> ✅ Both Vercel and Railway auto-deploy on every push to main.
> After every push, check both dashboards to confirm successful deployment.
> Railway is on the Starter paid plan — no sleep, always on.

---

## 4. Deployment Workflow

**Every change — frontend or backend:**
```bash
git add [filename]        # NEVER use git add . in this repo
git commit -m "type: description"
git push
# Vercel auto-deploys frontend
# Railway auto-deploys backend
# Check both dashboards — verify green status
```

> ⚠️ `git add .` is BANNED in this repo. Always add files explicitly by name.
> The .gitignore was accidentally deleted once. Never let it happen again.
> Never commit .env — always use environment variables.

---

## 5. Tech Stack

This repo uses **Vanilla JS**, not Next.js. Do not suggest migrating to Next.js.

### Frontend
- **Main app:** `frontend/index.html` — vanilla JS, single file
- **Share page:** `frontend/score.html` — standalone shareable score page
- **Language:** Plain JavaScript only — no TypeScript
- **Styling:** Custom CSS only — no Tailwind, no CSS frameworks
- **Web3:** ethers.js via CDN, EIP-6963 for wallet discovery
- **Font:** Space Mono (monospace — non-negotiable)

### Backend
- **Entry:** `backend/server.js` — Express API
- **Scoring:** `backend/scorer.js` — tune weights here only
- **Chain fetchers:** `backend/chains/` — one file per chain, plugin-based
- **Runtime:** Node.js 18, port 8080 on Railway

### Smart Contract
- **File:** `contracts/WalletRep.sol`
- **Standard:** ERC-721 + ERC-5192 (Soulbound)
- **Network:** Base mainnet / Base Sepolia (testnet)
- **Status:** Written, NOT yet deployed to mainnet
- **Note:** Badge minting is not live — `BACKEND_SIGNER_PRIVATE_KEY` and `CONTRACT_ADDRESS` not set

### Environment Variables (backend/.env — never commit)
```
ALCHEMY_API_KEY=
BACKEND_SIGNER_PRIVATE_KEY=
CONTRACT_ADDRESS=
CHAIN_ID=8453
PORT=8080
```

---

## 6. Repo Structure

```
walletrep/
├── frontend/
│   ├── index.html              Main dApp (vanilla JS)
│   ├── score.html              Shareable score page
│   ├── favicon.svg             Purple hexagon favicon
│   └── assets/
│       └── badges/             Tier badge SVGs (tier1–5)
│           ├── badge-tier1-newbie.svg
│           ├── badge-tier2-explorer.svg
│           ├── badge-tier3-degen-in-training.svg
│           ├── badge-tier4-veteran.svg
│           └── badge-tier5-degen.svg
├── backend/
│   ├── server.js               Express API
│   ├── scorer.js               Scoring algorithm
│   └── chains/
│       ├── index.js            Chain aggregator
│       ├── _evm-template.js    Shared EVM logic
│       ├── ethereum.js
│       ├── base.js
│       ├── arbitrum.js
│       ├── optimism.js
│       └── avalanche.js
├── contracts/
│   └── WalletRep.sol           Soulbound token contract
├── vercel.json                 Vercel routing config
└── AGENTS.md                   This file
```

---

## 7. Design System

```css
--background:     #0E0C1A;   /* page background */
--surface:        #120F28;   /* card background */
--border:         #2A2550;   /* card border — 0.5px solid */
--accent:         #7F77DD;   /* purple primary */
--accent-deep:    #534AB7;   /* buttons, deep borders */
--accent-darkest: #3C3489;   /* receding text */
--text-primary:   #EEEDFE;   /* headings, score numbers */
--text-secondary: #AFA9EC;   /* labels, subtitles */
--text-muted:     #444441;   /* hints, stat labels */
--font:           'Space Mono', monospace;
```

**Rules:**
- Uppercase labels
- No shadows, no gradients
- Subtle dot grid background
- Buttons: outlined (#534AB7 border) or filled (#534AB7 background)
- Mobile responsive is never optional
- Never use generic AI aesthetics

---

## 8. Tier System

| Score | Tier | Name | Badge Background | Badge Accent |
|-------|------|------|-----------------|--------------|
| 1–20 | 1 | Newbie | #04342C | #5DCAA5 |
| 21–55 | 2 | Explorer | #042C53 | #85B7EB |
| 56–75 | 3 | Degen-in-Training | #412402 | #EF9F27 |
| 76–90 | 4 | Veteran | #4A1B0C | #F0997B |
| 91–100 | 5 | DEGEN | #26215C | #AFA9EC |

> ⚠️ These are the canonical tier names. Never use old names: Intern, Activus, Vet.

---

## 9. Scoring Dimensions

| Category | Max Points | Notes |
|----------|------------|-------|
| Wallet Age | 20 | Age + monthly consistency |
| TX Volume | 15 | Log scale (500+ txs = full score) |
| TX Frequency | 15 | Penalizes bot-like bursts |
| DeFi Activity | 25 | Protocol diversity + complexity |
| NFT Activity | 10 | Minting, buying, diversity |
| Multi-chain | 15 | 3pts per active chain, max 5 |

---

## 10. API Endpoints

| Method | Route | Description | Rate limited |
|--------|-------|-------------|-------------|
| POST | /api/score | Score a connected wallet | Yes |
| GET | /api/score/:wallet | Fetch score for any wallet | No |
| GET | /badge/:wallet | SVG badge for wallet | No |
| GET | /health | Health check | No |

---

## 11. Supported Chains

| Chain | Status |
|-------|--------|
| Ethereum | ✅ Live |
| Base | ✅ Live |
| Arbitrum | ✅ Live |
| Optimism | ✅ Live |
| Avalanche | ✅ Live |
| Polygon | 🔲 Roadmap |
| Solana | 🔲 Roadmap |
| BNB Chain | 🔲 Roadmap |

---

## 12. Adding a New Chain

1. Create `backend/chains/{chainname}.js` using `_evm-template.js` as base
2. Register it in `backend/chains/index.js`
3. Add the chain pill to `frontend/index.html` chain pills section
4. Update stats bar chain count if needed
5. Test locally with a wallet known to be active on that chain
6. Commit and push — both Vercel and Railway auto-deploy

---

## 13. Open Roadmap

| Issue | Title | Priority |
|-------|-------|----------|
| #2 | feat: add Polygon and BNB Chain scoring | Medium |
| #3 | feat: add Avalanche C-Chain scoring | Low |
| #4 | feat: add Solana wallet scoring | Medium |
| #5 | feat: embed widget and public API | High |
| #7 | feat: add crypto donate button | Medium |

---

## 14. How We Work

1. Bojan describes goals in Claude chat
2. Claude chat generates a structured prompt for Claude Code
3. Claude Code executes — one feature chunk per prompt, never bundle too much
4. Test locally before pushing
5. Push to main → both Vercel and Railway auto-deploy → verify both dashboards

### Prompt Structure for Claude Code
Every Claude Code prompt must include:
- Which product and what exists
- Design system CSS variables (paste from Section 7)
- Exact files to create or edit
- Precise acceptance criteria
- Always state: "Plain JavaScript, no TypeScript, no Tailwind"

> ⚠️ Claude Code has no memory between sessions — every prompt must be fully self-contained.

---

## 15. Standing Instructions

### Product Thinking
Before writing any code, ask:
- Who is this for? What problem does it solve?
- Is there a simpler MVP slice to build first?
- Does this create technical debt that blocks the roadmap?
- How does this connect WalletRep → wlltresume → Wallet Passport?
- What's the monetization angle?

Proactively flag:
- Scope creep — propose phased delivery
- Roadmap drift — name it when it happens
- Open issues — reference GitHub issues when relevant

### Security
- Never expose API keys — always use environment variables
- All sensitive config in `.env`, always in `.gitignore`
- Never request unnecessary signing permissions in Web3 flows
- Never store wallet addresses without explicit user consent
- Remind proactively before any push that might expose secrets

### Code Quality
- Write expandable code — avoid hardcoding configurable values
- Clear folder structure: `/chains`, `/utils`, etc.
- Comments explain why, not just what
- Prefer explicit over clever
- Functions: small, single-purpose
- Always handle errors gracefully — never crash the UI
- Empty states: always show meaningful UI, never a blank section

### Communication
- Explain technical decisions in plain language
- When something breaks: what is wrong, why it happened, exact fix
- Don't give 5 options when 1 is clearly right — recommend and explain
- Summarize what was built and what's next after significant features
- Reference open roadmap items when relevant

---

## 16. Known Issues

- **Smart contract not deployed** — minting is not live yet
- **No Redis** — rate limiting is in-memory only, fine for current scale
- **`git add .` is banned** — always add files explicitly

---

## 17. Changelog

| Version | Changes |
|---------|---------|
| v1.1 | Purple rebrand, Railway backend, shareable score pages, tier badges, correct tier names, auto-deploy |
| v1.0 | Initial launch — 5 chain scoring, 6 dimensions, Vercel deployment |
