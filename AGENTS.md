AGENTS.md — Bojan Pilipović (KaizenBanjaLuka)

This file is the source of truth for all Claude Code sessions and Claude chat sessions across this project suite.
Read this fully before writing any code, making any suggestion, or planning any feature.


1. Who I Am

Role: Project & Product Manager. Web3/crypto background. No traditional dev experience.
Building: AI-assisted development using Claude (chat) + Claude Code (terminal/IDE).
GitHub: KaizenBanjaLuka
Writing: medium.com/@fikko87_90982


2. Active Infrastructure
ServiceRoleNotesClaude CodePrimary dev agentConnected to GitHub reposVercelHosting + deploymentAuto-deploys on push to mainAlchemy APIOnchain dataFree tier — flag if limits approachedNamecheapDomain managementGitHub Issues + KanbanProject managementBacklog → In Progress → In Review → Done
Always check Vercel deployment status after every push to main.

3. Tech Stack
Frontend

Framework: Next.js 14 App Router (preferred default)
Language: Plain JavaScript only — no TypeScript
Styling: Custom CSS only — no Tailwind, no CSS frameworks
Web3 frontend: ethers.js (current), open to Wagmi/Viem for new projects
Font: Space Mono (monospace everywhere — non-negotiable for suite products)

Backend

Runtime: Node.js + Express (where backend is needed)
Preference: Client-side computation over servers wherever possible
Database: Avoid unless strictly necessary — always ask "can this be stateless?" first
Chains: EVM (Ethereum, Polygon, Base — primary), Solana (secondary), multi-chain aware

Smart Contracts (future/Wallet Passport)

Foundry preferred over Hardhat for new contracts
Always flag: audit requirements, proxy patterns for upgradeability, gas implications
Target chain for Wallet Passport: Base (L2, low fees, Coinbase ecosystem)


4. Active Products
WalletRep — wlltrep.xyz

What: Multichain wallet reputation scoring dApp
Stack: Node.js · Express · Alchemy · Vanilla JS · Vercel
Repo: github.com/KaizenBanjaLuka/[walletrep-repo]
⚠️ Critical: .gitignore was accidentally deleted once — never use git add . — always add files explicitly by name

wlltresume — wlltresume.xyz

What: Onchain resume builder
Stack: Next.js 14 · Alchemy · ethers.js · Vercel
Repo: github.com/KaizenBanjaLuka/walletresume
Open: Issue #8 (mobile responsive), Connect Wallet flow

Wallet Passport (in development)

What: Soulbound NFT identity credential
Chain: Base
Status: PRD done, lives in /docs
Stack: TBD — will be decided when development begins


5. Product Suite Vision
Three-layer Web3 identity stack. Always think about how features connect across layers:
Layer 1: WalletRep        → Private reputation score
Layer 2: wlltresume       → Public onchain resume
Layer 3: Wallet Passport  → Portable soulbound credential NFT (Base)
Cross-product integration is a first-class concern. Before building any feature, ask: does this create a connection point between products, or block one?

6. Design System
All suite products share this design language. Never deviate without explicit instruction.
css--background:   #0d0d1a;   /* dark navy */
--surface:      #11112a;   /* card background */
--border:       #1e1e3a;   /* card border — 1px solid */
--accent:       #7b6ff0;   /* purple — buttons, highlights */
--font:         'Space Mono', monospace;
Rules:

Uppercase labels
No shadows, no gradients
Subtle dot grid background pattern
Buttons: outlined (#7b6ff0 border) or filled (#7b6ff0 background)
Mobile responsive is never optional — include it in every feature, even if as a follow-up prompt
Never use generic AI aesthetics (no Inter/Roboto, no purple-on-white, no cookie-cutter layouts)
Each product can have a slightly different tone but must feel like a family


7. How We Work
Workflow

I describe goals and context in Claude chat
Claude chat generates a structured prompt for Claude Code
Claude Code executes — one prompt per feature chunk, never bundle too much
Test locally before moving to next prompt
Push to main → Vercel auto-deploys → verify deployment

Prompt Structure for Claude Code
Every Claude Code prompt must include:

Project context (which product, what exists)
Design system reminder (paste the CSS variables above)
Exact files to create or edit
Precise acceptance criteria
"Plain JavaScript, no TypeScript, no Tailwind" — always state this explicitly to prevent drift

Claude Code has no memory between sessions — every prompt must be fully self-contained.
Git Hygiene

wlltrep repo: Always git add [filename] explicitly — never git add .
Always verify .gitignore covers .env.local before first push on any new project
Never commit secrets — if it looks like a key, it goes in .env.local


8. Standing Instructions
Product Thinking (always apply)
Before writing any code, ask:

Who is this for? What problem does it solve?
Is there a simpler version to build first (MVP slice)?
Does this create technical debt that blocks future roadmap items?
How does this connect WalletRep, wlltresume, and Wallet Passport?
What's the monetization angle, if any?

Proactively flag:

Scope creep — if a request is growing large, propose phased delivery
Roadmap drift — if we go off on a tangent, name it
Open issues — reference relevant GitHub issues when applicable

Security (non-negotiable)

Never expose API keys — always use environment variables
All sensitive config in .env.local, always covered by .gitignore
Never request unnecessary signing permissions in Web3 flows
Never store wallet addresses or private data without explicit user consent
Be transparent about what onchain data is read and why
Remind me proactively if something risks exposing a secret (e.g. before a push)

Code Quality

Write expandable code — avoid hardcoding values that should be configurable
Clear folder structure, separated concerns: /data, /components, /utils, /api
Comments explain why, not just what — especially on non-obvious logic
Prefer explicit over clever — I need to understand and direct the code
Functions: small, single-purpose, safe for Claude Code to edit in isolation
Always handle errors gracefully — failed API calls return empty defaults, never crash UI
Empty states: always show meaningful UI when a section returns no data — never a blank section

Infrastructure Constraints

Free or cheap infra only — flag cost implications of any new service before suggesting it
No databases unless strictly necessary — always check if stateless/client-side works first
Vercel free tier for hosting, Alchemy free tier for onchain data
If a feature would exceed free tier limits, flag it before building

When Multiple Approaches Exist
Always present 2–3 options with tradeoffs — never make the decision silently. Format as:
Option A — [Name]: [one line description]
  + Pro  + Pro
  - Con
  Recommended if: [condition]

Option B — [Name]: ...
Communication Style

I have no traditional dev background — explain technical decisions in plain language
When something breaks: diagnose clearly — what is wrong, why it happened, exact fix
Don't give 5 options when 1 is clearly right — make a recommendation and explain why
At the end of significant features: summarize what was built and what's logically next
Maintain awareness of the roadmap — reference open items when relevant


9. Roadmap (current)
PriorityItemStatus1wlltresume — mobile responsive (Issue #8)Next up2wlltresume × WalletRep — cross-reference integrationPlanned3Wallet Passport — soulbound NFT credential (Base)PRD done4Personal portfolio repoOngoing5Medium blog cadenceOngoing

10. Things I Sometimes Forget (remind me)

Check Vercel deployment after every push
.env.local must be in .gitignore before first push on any new project
git add . is banned on the wlltrep repo — always add files explicitly
Mobile responsive is required, not optional
Prompt Claude Code with full context — it has no memory between sessions
Product suite integration: always ask how a feature connects all three layers
Security review before any new API integration or wallet interaction
Never delete .gitignore and if you do recover it and notify Bojan
Check for session_log.md for more context 
