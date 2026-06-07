import { enrichSignal, type PlanContext } from "./signal-plans";
import { formatPriceBookSummary } from "./public-spot-prices";
import {
  DEFAULT_WALLET_USDC,
  fetchSpotPricesForPairs,
  type SpotPriceBook,
} from "./signal-sizing";
import { attachVerification, verifyPlanSizing } from "./signal-verify";
import { sosoFetch, sosoFetchOptional } from "./sosovalue";
import type {
  AnalysisResult,
  EtfFlowPoint,
  FocusPreset,
  HotNewsItem,
  IndexSnapshot,
  MarketPulse,
  SectorItem,
  SpotlightItem,
  TradeSignalDraft,
} from "./types";

/** Minimal index calls to protect SoSoValue API quota. */
const TRACKED_INDICES = ["ssiMAG7", "ssiAI"] as const;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchIndexSnapshots(
  tickers: string[],
): Promise<IndexSnapshot[]> {
  const indices: IndexSnapshot[] = [];
  for (const ticker of tickers) {
    const snap = await sosoFetchOptional<{
      price: number;
      change_pct_24h: number;
      roi_7d?: number;
      roi_1m?: number;
    } | null>(`/indices/${ticker}/market-snapshot`, undefined, null);
    if (snap) {
      indices.push({
        ticker,
        price: snap.price,
        change_pct_24h: snap.change_pct_24h,
        roi_7d: snap.roi_7d,
        roi_1m: snap.roi_1m,
      });
    }
    await delay(500);
  }
  return indices;
}

const SECTOR_SSI_MAP: Record<string, string> = {
  DeFi: "ssiDeFi",
  AI: "ssiAI",
  Meme: "ssiMeme",
  RWA: "ssiRWA",
  Layer1: "ssiLayer1",
  GameFi: "ssiGameFi",
  DePIN: "ssiDePIN",
  PayFi: "ssiPayFi",
  CeFi: "ssiCeFi",
  NFT: "ssiNFT",
  Layer2: "ssiLayer2",
  SocialFi: "ssiSocialFi",
};

const BEARISH_KEYWORDS = [
  "outflow",
  "outflows",
  "fell below",
  "decline",
  "loss",
  "delist",
  "hack",
  "exploit",
  "selling",
  "sold",
  "net outflow",
  "suspend",
  "ban",
];

const BULLISH_KEYWORDS = [
  "inflow",
  "surge",
  "launch",
  "partnership",
  "funding",
  "raises",
  "mainnet",
  "approval",
  "record",
  "break",
  "upgrade",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function analyzeNewsSentiment(news: HotNewsItem[]): {
  score: number;
  hits: { title: string; link: string; tone: "bullish" | "bearish" }[];
} {
  let score = 0;
  const hits: { title: string; link: string; tone: "bullish" | "bearish" }[] =
    [];

  for (const item of news.slice(0, 12)) {
    const text = `${item.title} ${stripHtml(item.content)}`.toLowerCase();
    let itemScore = 0;

    for (const kw of BEARISH_KEYWORDS) {
      if (text.includes(kw)) itemScore -= 1;
    }
    for (const kw of BULLISH_KEYWORDS) {
      if (text.includes(kw)) itemScore += 1;
    }

    if (itemScore !== 0) {
      score += itemScore;
      hits.push({
        title: item.title,
        link: item.source_link,
        tone: itemScore > 0 ? "bullish" : "bearish",
      });
    }
  }

  return { score, hits };
}

function topSectors(sectors: SectorItem[], n = 3): SectorItem[] {
  return [...sectors].sort((a, b) => b.change_pct_24h - a.change_pct_24h).slice(0, n);
}

function bottomSectors(sectors: SectorItem[], n = 3): SectorItem[] {
  return [...sectors].sort((a, b) => a.change_pct_24h - b.change_pct_24h).slice(0, n);
}

export async function fetchMarketPulse(): Promise<MarketPulse> {
  const warnings: string[] = [];

  const sectorData = await sosoFetch<{
    sector: SectorItem[];
    spotlight: SpotlightItem[];
  }>("/currencies/sector-spotlight");

  await delay(400);

  const hotNewsPage = await sosoFetch<{ list: HotNewsItem[] }>("/news/hot", {
    page: 1,
    page_size: 8,
  });

  await delay(400);

  const featuredPage = await sosoFetchOptional<{ list: HotNewsItem[] }>(
    "/news/featured",
    { pageNum: 1, pageSize: 5 },
    { list: [] },
  );

  const macroEvents: { date: string; events: string[] }[] = [];

  const etfBtc = await sosoFetchOptional<EtfFlowPoint[]>(
    "/etfs/summary-history",
    { symbol: "BTC", country_code: "US", limit: 3 },
    [],
  );
  if (!etfBtc.length) {
    warnings.push(
      "BTC ETF flow skipped (rate limit or outage). Scan uses news, sectors, and SSI only.",
    );
  }

  const sectors = (sectorData.sector ?? []).map((s) => ({
    name: s.name,
    change_pct_24h: Number(s.change_pct_24h ?? 0),
    marketcap_dom: s.marketcap_dom,
  }));

  const spotlight = (sectorData.spotlight ?? []).map((s) => ({
    name: s.name.trim(),
    change_pct_24h: Number(s.change_pct_24h ?? 0),
  }));

  const indices = await fetchIndexSnapshots([...TRACKED_INDICES]);
  if (indices.length < TRACKED_INDICES.length) {
    warnings.push("Some SSI snapshots were skipped due to API rate limits.");
  }

  const apiModulesUsed = [
    "Feeds (/news/hot)",
    "Currency (/currencies/sector-spotlight)",
    "SoSoValue Index (/indices/{ticker}/market-snapshot)",
  ];
  if (etfBtc.length) apiModulesUsed.push("ETF (/etfs/summary-history)");

  return {
    fetchedAt: new Date().toISOString(),
    sectors,
    spotlight,
    hotNews: hotNewsPage.list ?? [],
    featuredNews: featuredPage.list ?? [],
    macroEvents: (macroEvents ?? []).slice(0, 5),
    indices,
    etfBtc,
    apiModulesUsed,
    warnings: warnings.length ? warnings : undefined,
  };
}

function buildEtfSignal(
  pulse: MarketPulse,
  priceBook?: SpotPriceBook,
): TradeSignalDraft | null {
  const latest = pulse.etfBtc[0];
  if (!latest?.date) return null;

  const inflowM = latest.total_net_inflow / 1e6;
  const absM = Math.abs(inflowM);
  if (absM < 5) return null;

  const prev = pulse.etfBtc[1];
  const trendConfirm =
    prev && Math.sign(prev.total_net_inflow) === Math.sign(latest.total_net_inflow);
  const bearish = latest.total_net_inflow < 0;

  const draft: TradeSignalDraft = {
    id: "etf-btc-flow",
    direction: bearish ? "bearish" : "bullish",
    confidence: Math.round(
      Math.min(94, 62 + Math.min(22, absM / 4) + (trendConfirm ? 10 : 0)),
    ),
    title: bearish
      ? "BTC spot ETF net outflow — macro headwind"
      : "BTC spot ETF net inflow — macro tailwind",
    summary: `Latest US BTC ETF net flow: ${inflowM >= 0 ? "+" : ""}${inflowM.toFixed(1)}M USD (${latest.date})`,
    rationale: [
      "ETF flows are a primary institutional sentiment proxy for BTC.",
      bearish
        ? "Sustained outflows often correlate with risk-off positioning across crypto beta."
        : "Inflows support liquidity and can reinforce bullish BTC narratives.",
    ],
    evidence: [
      {
        source: "SoSoValue ETF API",
        label: "BTC ETF net inflow",
        value: `$${inflowM.toFixed(2)}M`,
        url: "https://sosovalue.com/assets/etf/us-btc-spot",
      },
      {
        source: "SoSoValue Hot News",
        label: "Related narrative",
        value: pulse.hotNews[0]?.title?.slice(0, 80) ?? "See hot feed",
        url: pulse.hotNews[0]?.source_link,
      },
    ],
    recommendedAction: bearish
      ? {
          type: "risk_off",
          label: "Reduce beta / hedge BTC exposure",
          detail:
            "Consider defensive SSI (ssiCeFi) or cash-stable allocation; prepare SoDEX hedge on ValueChain.",
        }
      : {
          type: "ssi",
          label: "Accumulate BTC beta via SSI MAG7",
          detail: "ssiMAG7 captures large-cap crypto exposure aligned with institutional flows.",
          ssiTicker: "ssiMAG7",
        },
    executionSteps: [
      "Review full ETF history on SoSoValue Terminal",
      "Select SSI index (ssiMAG7 or sector index) on https://ssi.sosovalue.com/",
      "Execute spot/perp on SoDEX when signal confidence exceeds your threshold",
      "Log trade thesis in AKINDO wave submission update",
    ],
    verification: {
      verified: false,
      score: 0,
      dataSourceCount: 0,
      checksPassed: 0,
      checksTotal: 0,
      summary: "",
    },
  };
  return attachVerification(draft, pulse, priceBook);
}

function buildSectorRotationSignal(
  pulse: MarketPulse,
  priceBook?: SpotPriceBook,
): TradeSignalDraft | null {
  if (pulse.sectors.length < 4) return null;

  const leaders = topSectors(pulse.sectors, 2);
  const laggards = bottomSectors(pulse.sectors, 2);
  const leader = leaders[0];
  const laggard = laggards[0];
  if (!leader || !laggard) return null;

  const spreadPct = (leader.change_pct_24h - laggard.change_pct_24h) * 100;
  if (spreadPct < 1.5) return null;

  const ssiTicker = SECTOR_SSI_MAP[leader.name];
  if (!ssiTicker) return null;

  const draft: TradeSignalDraft = {
    id: "sector-rotation",
    direction: "bullish",
    confidence: Math.round(Math.min(90, 58 + Math.min(28, spreadPct * 4))),
    title: `Sector rotation: ${leader?.name ?? "N/A"} leading`,
    summary: `${leader?.name} +${((leader?.change_pct_24h ?? 0) * 100).toFixed(2)}% 24h vs ${laggards[0]?.name} ${((laggards[0]?.change_pct_24h ?? 0) * 100).toFixed(2)}%`,
    rationale: [
      "Sector spotlight surfaces where capital is rotating intraday.",
      ssiTicker
        ? `Mapped leader to on-chain index ${ssiTicker} for one-click exposure.`
        : "Use SoSoValue Terminal to drill into constituent tokens.",
    ],
    evidence: leaders.map((s) => ({
      source: "Sector Spotlight API",
      label: s.name,
      value: `${(s.change_pct_24h * 100).toFixed(2)}% 24h`,
    })),
    recommendedAction: {
      type: "ssi",
      label: `Buy exposure via ${ssiTicker}`,
      detail: "Rotate from laggard sectors into momentum leaders using SSI indexes.",
      ssiTicker,
    },
    executionSteps: [
      `Open ${ssiTicker} on ssi.sosovalue.com`,
      "Compare index ROI vs sector change on Terminal",
      "Execute on SoDEX / ValueChain with size limits",
    ],
    verification: {
      verified: false,
      score: 0,
      dataSourceCount: 0,
      checksPassed: 0,
      checksTotal: 0,
      summary: "",
    },
  };
  return attachVerification(draft, pulse, priceBook);
}

function buildNewsSignal(
  pulse: MarketPulse,
  sentiment: ReturnType<typeof analyzeNewsSentiment>,
  priceBook?: SpotPriceBook,
): TradeSignalDraft | null {
  if (sentiment.hits.length < 3 || Math.abs(sentiment.score) < 3) return null;

  const direction =
    sentiment.score >= 3 ? "bullish" : sentiment.score <= -3 ? "bearish" : null;
  if (!direction) return null;

  const bull = sentiment.hits.filter((h) => h.tone === "bullish").length;
  const bear = sentiment.hits.filter((h) => h.tone === "bearish").length;
  if (direction === "bullish" && bull < 2) return null;
  if (direction === "bearish" && bear < 2) return null;

  const draft: TradeSignalDraft = {
    id: "news-sentiment",
    direction,
    confidence: Math.round(Math.min(88, 58 + Math.abs(sentiment.score) * 5)),
    title: "Hot news sentiment composite",
    summary: `Scored ${sentiment.score} across ${sentiment.hits.length} tagged headlines from SoSoValue hot feed`,
    rationale: [
      "Agent parses real-time hot news — not static dashboards.",
      "Bearish tags: outflows, hacks, delistings. Bullish: launches, inflows, funding.",
    ],
    evidence: sentiment.hits.slice(0, 4).map((h) => ({
      source: "Hot News API",
      label: h.tone,
      value: h.title.slice(0, 72) + (h.title.length > 72 ? "…" : ""),
      url: h.link,
    })),
    recommendedAction:
      direction === "bearish"
        ? {
            type: "risk_off",
            label: "Stand aside or hedge",
            detail: "Wait for ETF flow confirmation before adding risk.",
          }
        : {
            type: "ssi",
            label: "Accumulate via ssiMAG7 on confirmed news flow",
            detail: "Combine with ETF + sector signals before execution.",
            ssiTicker: "ssiMAG7",
          },
    executionSteps: [
      "Open cited SoSoValue news clusters for full context",
      "Cross-check with sector spotlight",
      "Trigger execution only when 2+ signals align",
    ],
    verification: {
      verified: false,
      score: 0,
      dataSourceCount: 0,
      checksPassed: 0,
      checksTotal: 0,
      summary: "",
    },
  };
  return attachVerification(draft, pulse, priceBook);
}

function buildIndexSignal(
  pulse: MarketPulse,
  focus: FocusPreset,
  priceBook?: SpotPriceBook,
): TradeSignalDraft | null {
  const focusMap: Record<string, string> = {
    "ai-sector": "ssiAI",
    "defi-rotation": "ssiDeFi",
    "btc-macro": "ssiMAG7",
  };
  const ticker = focusMap[focus];
  if (!ticker) return null;

  const idx = pulse.indices.find((i) => i.ticker === ticker);
  if (!idx || idx.price <= 0) return null;

  const chgPct = Math.abs(idx.change_pct_24h * 100);
  if (chgPct < 0.5) return null;

  const bullish = idx.change_pct_24h > 0;

  const draft: TradeSignalDraft = {
    id: `index-${ticker}`,
    direction: bullish ? "bullish" : "bearish",
    confidence: Math.round(Math.min(88, 60 + Math.min(22, chgPct * 6))),
    title: `${ticker} index ${bullish ? "momentum" : "weakness"}`,
    summary: `24h ${(idx.change_pct_24h * 100).toFixed(2)}% · price ${idx.price.toFixed(4)}`,
    rationale: [
      "Live index snapshot from SoSoValue Index API.",
      "SSI provides on-chain index exposure on ValueChain.",
    ],
    evidence: [
      {
        source: "Index Market Snapshot",
        label: ticker,
        value: `${(idx.change_pct_24h * 100).toFixed(2)}% / 24h`,
      },
      {
        source: "SSI Protocol",
        label: "On-chain index",
        value: ticker,
        url: "https://ssi.sosovalue.com/",
      },
    ],
    recommendedAction: {
      type: "ssi",
      label: `${bullish ? "Long" : "Reduce"} ${ticker}`,
      detail: "Use SSI for transparent spot index exposure; SoDEX for execution.",
      ssiTicker: ticker,
    },
    executionSteps: [
      `Navigate to ${ticker} on SSI`,
      "Verify constituents weights on Terminal",
      "Execute via SoDEX on ValueChain",
    ],
    verification: {
      verified: false,
      score: 0,
      dataSourceCount: 0,
      checksPassed: 0,
      checksTotal: 0,
      summary: "",
    },
  };
  return attachVerification(draft, pulse, priceBook);
}

function filterByFocus(
  signals: TradeSignalDraft[],
  focus: FocusPreset,
  customQuery?: string,
): TradeSignalDraft[] {
  if (focus === "custom" && customQuery) {
    const q = customQuery.toLowerCase();
    return signals.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.evidence.some((e) => e.value.toLowerCase().includes(q)),
    );
  }
  if (focus === "risk-off") {
    return signals.filter(
      (s) => s.direction === "bearish" || s.recommendedAction.type === "risk_off",
    );
  }
  if (focus === "btc-macro") {
    return signals.filter(
      (s) =>
        s.id.includes("etf") ||
        s.id.includes("news") ||
        s.id.includes("ssiMAG7") ||
        s.id.includes("index-ssi"),
    );
  }
  if (focus === "ai-sector") {
    return signals.filter(
      (s) =>
        s.id.includes("ssiAI") ||
        s.title.toLowerCase().includes("ai") ||
        s.recommendedAction.ssiTicker === "ssiAI",
    );
  }
  if (focus === "defi-rotation") {
    return signals.filter(
      (s) =>
        s.id.includes("sector") ||
        s.recommendedAction.ssiTicker === "ssiDeFi",
    );
  }
  return signals;
}

export async function analyzeFromPulse(
  pulse: MarketPulse,
  focus: FocusPreset = "btc-macro",
  customQuery?: string,
  planCtx?: Partial<PlanContext>,
): Promise<AnalysisResult> {
  const walletUsdc = planCtx?.walletUsdc ?? DEFAULT_WALLET_USDC;
  let spotPrices = planCtx?.spotPrices;
  let spotPriceBook = planCtx?.spotPriceBook;
  let priceSummary = "";

  if (!spotPrices) {
    try {
      const fetched = await fetchSpotPricesForPairs();
      spotPrices = fetched.prices;
      spotPriceBook = fetched.book;
      priceSummary = formatPriceBookSummary(fetched.book);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Live spot price fetch failed";
      return {
        focus,
        analyzedAt: new Date().toISOString(),
        signals: [],
        workflow: {
          scan: "Live sector spotlight, hot news, BTC ETF flows, and SSI snapshots ingested.",
          analyze: msg,
          signal:
            "No signals — BTC/ETH spot must be validated against CoinGecko + Binance public APIs before sizing.",
          match: "Match shows the exact spot or futures card you selected.",
        },
        pulse,
      };
    }
  }

  const ctx: PlanContext = { spotPrices, spotPriceBook, walletUsdc };
  const sentiment = analyzeNewsSentiment(pulse.hotNews);

  const candidates: TradeSignalDraft[] = [];
  const etf = buildEtfSignal(pulse, spotPriceBook);
  if (etf) candidates.push(etf);
  const sector = buildSectorRotationSignal(pulse, spotPriceBook);
  if (sector) candidates.push(sector);
  const news = buildNewsSignal(pulse, sentiment, spotPriceBook);
  if (news) candidates.push(news);
  const indexSig = buildIndexSignal(pulse, focus, spotPriceBook);
  if (indexSig) candidates.push(indexSig);

  const filtered = filterByFocus(candidates, focus, customQuery);
  const ranked = [...filtered].sort((a, b) => b.confidence - a.confidence);
  const enriched = ranked
    .map((s) => enrichSignal(s, ctx))
    .filter((s): s is NonNullable<typeof s> => {
      if (!s) return false;
      return verifyPlanSizing(s, walletUsdc, spotPrices);
    });

  return {
    focus,
    analyzedAt: new Date().toISOString(),
    signals: enriched,
    workflow: {
      scan: "Live sector spotlight, hot news, BTC ETF flows, and SSI snapshots ingested.",
      analyze: `Focus "${focus}" · sentiment ${sentiment.score} · ${priceSummary || "live public spot"} · ≤$${walletUsdc} wallet.`,
      signal:
        enriched.length > 0
          ? `${enriched.length} verified signal(s) — entry prices tied to live BTC/ETH/UNI spot · ~$${walletUsdc} wallet.`
          : "No verified signals — data thresholds not met, or live spot price validation failed. Re-analyze.",
      match: "Match shows the exact spot or futures card you selected.",
    },
    pulse,
  };
}

export async function runAnalysis(
  focus: FocusPreset = "btc-macro",
  customQuery?: string,
  existingPulse?: MarketPulse,
): Promise<AnalysisResult> {
  const pulse = existingPulse ?? (await fetchMarketPulse());
  return analyzeFromPulse(pulse, focus, customQuery);
}