# SignalForge

Agentic **research → execution** for the [SoSoValue Buildathon](https://app.akindo.io/wave-hacks/JBEQXgN4Zi2jA3wA) on AKINDO WaveHack.

**Landing:** `/` · **Workflow app:** `/app`

---

## What is SignalForge?

SignalForge ingests live [SoSoValue Open API](https://openapi.sosovalue.com/openapi/v1) data, runs a verification gate on every signal, and outputs **Spot** and **Futures** trade plans you can match and execute on [SoDEX testnet](https://testnet.sodex.com).

Most tools stop at charts. SignalForge closes the loop: **Scan → Analyze → Signal → Match**.

---

## Workflow

| Step | Name | What happens |
|------|------|----------------|
| **1** | **Scan** | Hot news, sector spotlight, BTC ETF flows, SSI index snapshots (rate-limited, cached) |
| **2** | **Analyze** | Fuse ETF, sentiment, sector rotation, and index momentum for your focus preset |
| **3** | **Signal** | **Verified** signals only — **Spot** (left) and **Futures** (right); pick one card |
| **4** | **Match** | Shows the **exact** plan from your selected card (amount, price USDC, TP/SL) + open on testnet |

### Signal verification (no random outputs)

Signals are emitted only when live data passes all checks, for example:

- ETF: flow ≥ $5M, dated snapshot, 2-day direction when available  
- Sector: ≥4 sectors, leader/laggard spread ≥ 1.5%, SSI mapping  
- News: ≥3 tagged headlines, score ≥ ±3, tone matches direction  
- Index: live price, 24h move ≥ 0.5%  

Confidence is computed from the underlying metrics, not fixed placeholders.

### Futures plan fields

- Cross / Isolated · Leverage 1x–25x · Buy-Long / Sell-Short  
- Limit order · Amount (BTC or USDC) · Price (USDC)  
- Take profit & stop loss (% + USD price) · Reduce only yes/no  

---

## SoSoValue APIs used

| Module | Endpoints |
|--------|-----------|
| Feeds | `/news/hot`, `/news/featured` |
| Currency | `/currencies/sector-spotlight` |
| SoSoValue Index | `/indices/{ticker}/market-snapshot` |
| ETF | `/etfs/summary-history` (BTC, US) |

Auth: header `x-soso-api-key` · Base: `https://openapi.sosovalue.com/openapi/v1`

---

## Quick start

```bash
cd signalforge
cp .env.example .env.local
# SOSO_API_KEY from https://sosovalue.com/developer/dashboard
npm install
npm run dev
```

Open http://localhost:3000 (landing) → http://localhost:3000/app (workflow).

### Environment

```env
SOSO_API_KEY=your_key_here
```

Never commit `.env.local`.

### Dev on Windows (500 on `react-refresh.js` / `_app.js`)

This means a **corrupt `.next` cache** or **two dev servers** fighting on port 3000.

```bash
# Stop all terminals running npm run dev, then:
npm run fix
npm run dev:fast
```

Or one command: `npm run dev` (cleans `.next` first).

Hard refresh: **Ctrl+Shift+R** · use only **http://localhost:3000** · one dev process only.

Server log may show `Cannot find module './638.js'` — same fix: `npm run fix` and restart.

---

## Project structure

```
src/
  app/
    page.tsx              # Landing (Buildathon hero + workflow carousel)
    app/page.tsx          # Scan → Analyze → Signal → Match
    api/pulse/            # SoSoValue ingest + cache
    api/analyze/          # Verified signal engine
    api/testnet/          # SoDEX testnet proxy (symbol, account)
  components/
    WorkflowCarousel.tsx  # Landing step preview
    SignalMarketColumn.tsx # Spot / Futures signal columns
    MatchPanel.tsx        # Selected card → match view
  lib/
    signal-engine.ts      # Data-backed signals + verification
    signal-plans.ts       # Spot & futures plan builders
    signal-verify.ts      # Verification gates
    sosovalue.ts          # API client
public/
  icon.svg, apple-icon.svg  # Brand favicon (amber → cyan signal line)
vercel.json
```

---

## Deploy (Vercel)

1. Push to GitHub  
2. Import project in [Vercel](https://vercel.com) (Next.js auto-detected; `vercel.json` included)  
3. Environment variable: **`SOSO_API_KEY`**  
4. Deploy · submit demo URL on [AKINDO](https://app.akindo.io/wave-hacks/JBEQXgN4Zi2jA3wA)

---

## AKINDO demo script

1. Landing → **Launch app**  
2. **Scan** → **Analyze** (pick focus preset)  
3. **Signal** → select one **Spot** or **Futures** card  
4. **Match** → confirm plan matches the card → **Open on SoDEX testnet**  

---

## Links

- [Buildathon](https://app.akindo.io/wave-hacks/JBEQXgN4Zi2jA3wA)
- [SoSoValue API Docs](https://sosovalue.gitbook.io/soso-value-api-doc/)
- [API key dashboard](https://sosovalue.com/developer/dashboard)
- [SSI Protocol](https://ssi.sosovalue.com/)
- [SoDEX testnet](https://testnet.sodex.com/)

---

Built for AKINDO WaveHack · SoSoValue Buildathon · Data via [openapi.sosovalue.com](https://openapi.sosovalue.com/openapi/v1)