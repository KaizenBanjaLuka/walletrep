---
## 2026-03-04 16:07:33
**What was built:** Full WalletRep backend + frontend running locally. Added shareable score page (`GET /score/:wallet`), embeddable SVG badge (`GET /badge/:wallet`), and `widget.html` for embedding in other sites. Removed SBT/minting entirely.
**Decisions made:** No NFT/SBT minting — replaced with shareable link + badge only. Score cached 1hr in memory. EIP-6963 used for wallet discovery instead of `window.ethereum` (fixes MetaMask+Phantom+XDEFI conflicts). Backend serves `index.html` and `widget.html` directly from Express.
**Problems solved:** npm cache permissions error (sudo chown ~/.npm). Browser opening index.html as Google search (fixed by serving from Express). Phantom faking `isMetaMask=true` causing wrong wallet to be selected. XDEFI locking `window.ethereum` as getter-only (fixed with EIP-6963 event-based discovery).
**Next step:** Deploy backend to Railway — set ALCHEMY_API_KEY and APP_URL env vars, point `CONFIG.backendUrl` in index.html to the live Railway URL, then test shareable links and badge end-to-end.
---

---
## 2026-03-04 16:11:01
**What was built:** `/saveme` command made globally available across all projects. Project-level copies added to both `dashboard` and `walletrep`. Also tested wallet connection end-to-end — scoring works locally.
**Decisions made:** Command lives in `~/.claude/commands/saveme.md` (global) plus project-level copies in `.claude/commands/` for both projects as a fallback. Any future project picks it up automatically from the global location after a CLI restart.
**Problems solved:** `/saveme` returning "Unknown skill" — caused by CLI session not reloading commands. Fixed by adding project-level copies and restarting Claude Code.
**Next step:** Deploy WalletRep to Railway — set ALCHEMY_API_KEY and APP_URL env vars, update CONFIG.backendUrl in index.html to the live Railway URL, test shareable score page and badge end-to-end.
---

---
## 2026-03-17 13:28:41
**What was built:** Three server.js improvements — (1) Alchemy API key rotated to new key in `.env`. (2) Two Map cleanup intervals added (`scoreCache` and `requestLog`) running every 10 minutes, pruning entries older than their respective TTLs (`CACHE_TTL` 1hr, `RATE_LIMIT` 1min). (3) Inline PNG favicon generated at startup via a self-contained IIFE using Node's built-in `zlib.deflateSync` — a 16×16 `#7fff6a` "W" on `#0a0a0f` background, served at `GET /favicon.ico`.
**Decisions made:** Favicon is built entirely in memory at startup (no file, no npm package). PNG-in-memory approach using manual CRC32 + zlib deflate + proper PNG chunk structure. Cleanup intervals share a single `CLEANUP_INTERVAL` constant (10 min). Console logs sanitized to remove wallet addresses from output (`Cache hit` / `Scoring new request`).
**Problems solved:** `scoreCache` and `requestLog` Maps growing unbounded on long-running server. Missing favicon causing 404s in browser tabs. Console logs leaking wallet addresses.
**Next step:** Deploy updated server.js to Railway — verify favicon shows in browser tab, confirm cleanup intervals fire correctly in production logs.
---
