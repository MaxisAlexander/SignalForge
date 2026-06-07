# SignalForge

SignalForge is an agentic **research-to-execution** workflow application built for the **SoSoValue Buildathon** on AKINDO WaveHack.

Most trading tools stop at charts and data feeds. SignalForge closes the loop: **Scan -> Analyze -> Signal -> Match**.

---

## What is SignalForge?

SignalForge ingests real-time macro indicators from the **SoSoValue Open API**, validates them through strict verification gates, structures precise risk-calibrated spot and futures trade plans, and allows users to match and execute those plans directly on the **SoDEX exchange testnet**.

---

## Core Workflow

| Step | Phase | Functionality |
|------|-------|---------------|
| **1** | **Scan** | Pulls sector spotlights, hot headlines, sentiment indexes (SSI snapshots), and US BTC ETF flows. |
| **2** | **Analyze** | Runs preset focus engines (AI, DeFi, BTC Macro, Risk-Off) to compute sentiment trends. |
| **3** | **Signal** | Filters results through strict verification gates to emit verified Spot and Futures trade plans. |
| **4** | **Match** | Configures leverage, entry levels, and TP/SL boundaries, deep-linking directly to SoDEX testnet. |

---

## Signal Verification Gates

To eliminate low-confidence noise, signals are only generated when incoming data passes all verification checks:

* **ETF Flow Gate**: Flow magnitude must be greater than or equal to 5 million USD with consistent 2-day flow direction.
* **Sector Rotation Gate**: At least 4 sectors must load, with leader-laggard spread greater than or equal to 1.5 percent.
* **News Sentiment Gate**: At least 3 tagged headlines, with sentiment score greater than or equal to 3 or less than or equal to -3.
* **SSI Index Gate**: Mapped leader must show 24h change greater than or equal to 0.5 percent.
* **Price Drift Gate**: Live spot prices (fetched from CoinGecko + Binance) must not drift from plan entry prices by more than 1.5 percent.

---

## Roadmap & Wave Updates

### Wave 2 (Completed)
* **Core Workflow Engine**: Built and integrated the full 4-step wizard UI.
* **API Ingestion & Caching**: Live feeds from SoSoValue and dual-source price feeds (CoinGecko + Binance) with client-side rate protection.
* **Sizing Calculators**: Automatic calculation of leverage caps and trade sizes proportional to mock account balances.
* **Netlify Deployment Integration**: Configured `netlify.toml` and patched Next.js dependencies to version 15.5.19 to bypass CVE-2025-55182 deployment blocks.

### Wave 3 (Planned)
* **Direct Web3 Execution**: Integrate Viem and browser wallet extensions (MetaMask/Rainbow) to sign and execute trades directly on SoDEX contracts.
* **On-Chain Balance Sync**: Sync live token balances directly from the ValueChain testnet.

### Wave 4 (Planned)
* **Custom Gate Rules**: Allow traders to adjust validation thresholds (e.g. minimum flows, leverage limits) from the UI.
* **Index Rebalancing**: Enable direct SSI index swapping and portfolio rebalancing on-chain.

---

## Quick Start

### Prerequisites
* Node.js v18 or later
* SoSoValue API Key (Get one at [sosovalue.com/developer/dashboard](https://sosovalue.com/developer/dashboard))

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/MaxisAlexander/SignalForge.git
   cd SignalForge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Create a `.env.local` file in the root directory:
   ```env
   SOSO_API_KEY=your_sosovalue_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) for the landing page or [http://localhost:3000/app](http://localhost:3000/app) for the application.

---

## Development on Windows (Port and Cache Solver)

If you experience compilation issues, port conflicts, or corrupt cache states on Windows:
```bash
# Clean cache, free local ports 3000-3002, and start dev server:
npm run fix
npm run dev:fast
```
Or execute the all-in-one command:
```bash
npm run dev
```

---

## Tech Stack
* **Framework**: Next.js 15 (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS
* **Web3 Utilities**: Viem
* **APIs**: SoSoValue Open API, SoDEX Testnet API