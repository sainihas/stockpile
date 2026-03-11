import type { Quote, HQLocation, QuarterlyFinancial, MarketIndex } from "./types.js";

// ---------------------------------------------------------------------------
// Batchexecute response parsing
// ---------------------------------------------------------------------------

/**
 * Parse raw batchexecute response into per-callback results.
 */
export function parseRpcCallbacks(raw: string): Array<{ rpcId: string; data: any; index: string }> {
  const stripped = raw.replace(/^\)\]\}'\s*\n?/, "");
  const results: Array<{ rpcId: string; data: any; index: string }> = [];
  const lines = stripped.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^\d+$/.test(trimmed)) continue;

    let envelope: any;
    try {
      envelope = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (!Array.isArray(envelope)) continue;

    for (const entry of envelope) {
      if (!Array.isArray(entry)) continue;
      if (entry[0] === "wrb.fr" && typeof entry[1] === "string" && typeof entry[2] === "string") {
        try {
          const payload = JSON.parse(entry[2]);
          results.push({
            rpcId: entry[1],
            data: payload,
            index: entry[6] != null ? String(entry[6]) : "",
          });
        } catch {}
      }
    }
  }

  return results;
}

/**
 * Legacy: parse only HqGpWd payloads (backward compat).
 */
export function parseRpcResponse(raw: string): any[][] {
  return parseRpcCallbacks(raw)
    .filter(cb => cb.rpcId === "HqGpWd")
    .map(cb => cb.data)
    .filter(d => Array.isArray(d));
}

// ---------------------------------------------------------------------------
// Price data extraction (xh8wxf)
// ---------------------------------------------------------------------------

export interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  kgId: string;
  afterHoursPrice: number | null;
  afterHoursChange: number | null;
  afterHoursChangePercent: number | null;
}

/**
 * Extract real-time price data from xh8wxf RPC response.
 *
 * xh8wxf response layout (per ticker): data[0][0][0] =
 *   [0] KG ID          "/m/07zmbvf"
 *   [1] [symbol, exchange]  ["AAPL","NASDAQ"]
 *   [2] Company name   "Apple Inc"
 *   [3] Entity type    0=stock, 5=ETF
 *   [4] Currency       "USD"
 *   [5] [price, change, change_pct, ...]
 *   [7] prev_close
 *  [16] [after_hours_price, ah_change, ah_change_pct, ...] (null if market open)
 *  [17] [market_close_timestamp]
 *  [18] [after_hours_timestamp]
 */
export function extractXh8wxfPrice(data: any): PriceData | null {
  try {
    const d = data?.[0]?.[0]?.[0];
    if (!d || !Array.isArray(d)) return null;

    const priceArr = d[5];  // [price, change, change_pct, ...]
    if (!Array.isArray(priceArr) || typeof priceArr[0] !== "number") return null;

    const ahArr = d[16];    // [ah_price, ah_change, ah_change_pct, ...] or null

    return {
      price: priceArr[0],
      change: priceArr[1] ?? 0,
      changePercent: priceArr[2] ?? 0,
      previousClose: typeof d[7] === "number" ? d[7] : priceArr[0] - (priceArr[1] ?? 0),
      symbol: d[1]?.[0] ?? "",
      exchange: d[1]?.[1] ?? "",
      name: typeof d[2] === "string" ? d[2] : "",
      currency: typeof d[4] === "string" ? d[4] : "USD",
      kgId: typeof d[0] === "string" ? d[0] : "",
      afterHoursPrice: numOrNull(ahArr?.[0]),
      afterHoursChange: numOrNull(ahArr?.[1]),
      afterHoursChangePercent: numOrNull(ahArr?.[2]),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page scraping (legacy, for single-ticker fallback)
// ---------------------------------------------------------------------------

/**
 * Parse the Google Finance quote page HTML to extract price data and fundamentals.
 */
export function parseQuotePage(html: string): { price: PriceData | null; fundamentals: any[] | null } {
  const priceData = extractPriceDataFromPage(html);
  const fundData = extractFundamentalsFromPage(html);
  return { price: priceData, fundamentals: fundData };
}

function findTickerArray(data: any, depth: number = 0): any[] | null {
  if (depth > 5 || !Array.isArray(data)) return null;

  if (data.length >= 8 &&
      Array.isArray(data[1]) && data[1].length === 2 &&
      typeof data[1][0] === "string" && typeof data[1][1] === "string" &&
      Array.isArray(data[5]) && data[5].length >= 3 &&
      typeof data[5][0] === "number") {
    return data;
  }

  for (const child of data) {
    const result = findTickerArray(child, depth + 1);
    if (result) return result;
  }

  return null;
}

function extractPriceDataFromPage(html: string): PriceData | null {
  const attrBlock = html.match(
    /data-entity-type="\d+"\s+data-exchange="([^"]+)"\s+data-currency-code="([^"]+)"\s+data-last-price="([^"]+)"/
  );

  const afCallbacks = [...html.matchAll(
    /AF_initDataCallback\(\{[^}]*key:\s*'(ds:\d+)'[^}]*data:([\s\S]*?),\s*sideChannel:\s*\{\}\s*\}\);/g
  )];

  for (const cb of afCallbacks) {
    const dataStr = cb[2].trim();
    if (dataStr.length > 2000) continue;

    try {
      const parsed = JSON.parse(dataStr);
      if (!Array.isArray(parsed)) continue;

      const ticker = findTickerArray(parsed);
      if (!ticker) continue;
      if (!Array.isArray(ticker[1]) || ticker[1].length !== 2) continue;
      if (!Array.isArray(ticker[5]) || ticker[5].length < 3) continue;
      if (typeof ticker[5][0] !== "number") continue;

      const ahArr = ticker[16];

      return {
        price: ticker[5][0],
        change: ticker[5][1],
        changePercent: ticker[5][2],
        previousClose: typeof ticker[7] === "number" ? ticker[7] : ticker[5][0] - ticker[5][1],
        symbol: String(ticker[1][0]),
        exchange: String(ticker[1][1]),
        name: String(ticker[2] || ""),
        currency: String(ticker[4] || "USD"),
        kgId: String(ticker[0] || ""),
        afterHoursPrice: numOrNull(ahArr?.[0]),
        afterHoursChange: numOrNull(ahArr?.[1]),
        afterHoursChangePercent: numOrNull(ahArr?.[2]),
      };
    } catch {
      continue;
    }
  }

  if (attrBlock) {
    return {
      price: parseFloat(attrBlock[3]),
      change: 0,
      changePercent: 0,
      previousClose: parseFloat(attrBlock[3]),
      symbol: "",
      exchange: attrBlock[1],
      name: "",
      currency: attrBlock[2],
      kgId: "",
      afterHoursPrice: null,
      afterHoursChange: null,
      afterHoursChangePercent: null,
    };
  }

  return null;
}

function extractFundamentalsFromPage(html: string): any[] | null {
  const afCallbacks = [...html.matchAll(
    /AF_initDataCallback\(\{[^}]*key:\s*'(ds:\d+)'[^}]*data:([\s\S]*?),\s*sideChannel:\s*\{\}\s*\}\);/g
  )];

  for (const cb of afCallbacks) {
    const dataStr = cb[2].trim();
    if (dataStr.length < 500 || dataStr.length > 10000) continue;

    try {
      const parsed = JSON.parse(dataStr);
      if (!Array.isArray(parsed)) continue;

      let innerArray: any[] | null = null;
      if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
        innerArray = parsed[0][0];
      } else if (Array.isArray(parsed[0])) {
        innerArray = parsed[0];
      }

      if (!innerArray || innerArray.length < 25) continue;

      if (typeof innerArray[0] === "string" &&
          (innerArray[0].startsWith("/m/") || innerArray[0].startsWith("/g/")) &&
          typeof innerArray[1] === "string" &&
          typeof innerArray[2] === "string" && innerArray[2].length > 50 &&
          typeof innerArray[7] === "number" && innerArray[7] > 1e6) {
        return innerArray;
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Quote building
// ---------------------------------------------------------------------------

function num(val: any, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(val: any): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function str(val: any, fallback: string = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Build a Quote from fundamentals array + price data.
 *
 * HqGpWd fundamentals array layout (72 elements):
 *   [0] KG ID            [1] name             [2] description (long)
 *   [3] [city,state,country,cc,address]        [4] [year,month,day] founded
 *   [5] CEO              [6] employees         [7] market_cap
 *   [8] prev_close       [9] open             [10] high
 *  [11] low             [12] 52w_high         [13] 52w_low
 *  [14] volume          [15] currency         [16] pe_ratio
 *  [17] dividend_yield  [18] avg_volume       [19] eps
 *  [20] beta            [21] shares_outstanding
 *  [23] currency2       [24] exchange         [71] sector
 */
export function buildQuote(
  fundamentals: any[] | null,
  priceInfo: PriceData | null,
  symbolFallback: string,
  exchangeFallback: string,
): Quote {
  const f = fundamentals;

  const price = priceInfo?.price ?? 0;
  const change = priceInfo?.change ?? 0;
  const changePercent = priceInfo?.changePercent ?? 0;
  const previousClose = priceInfo?.previousClose ?? (f ? num(f[8]) : 0);

  if (f && f.length >= 25) {
    const kgId = str(f[0]) || null;
    const name = str(f[1]);
    const description = str(f[2]);

    let hq: HQLocation | null = null;
    if (Array.isArray(f[3]) && f[3].length >= 4) {
      hq = {
        city: str(f[3][0]),
        state: str(f[3][1]),
        country: str(f[3][2]),
        countryCode: str(f[3][3]),
        address: str(f[3][4]),
      };
    }

    let founded: string | null = null;
    if (Array.isArray(f[4]) && f[4][0]) {
      const y = f[4][0];
      const m = f[4][1] ? String(f[4][1]).padStart(2, "0") : "01";
      const d = f[4][2] ? String(f[4][2]).padStart(2, "0") : "01";
      founded = `${y}-${m}-${d}`;
    }

    const ceo = str(f[5]) || null;
    const employees = numOrNull(f[6]);
    const marketCap = num(f[7]);
    const open = num(f[9]);
    const high = num(f[10]);
    const low = num(f[11]);
    const high52 = num(f[12]);
    const low52 = num(f[13]);
    const volume = num(f[14]);
    const currency = str(f[15]) || str(f[23]) || priceInfo?.currency || "USD";
    const peRatio = numOrNull(f[16]);
    const dividendYield = numOrNull(f[17]);
    const avgVolume = num(f[18]);
    const eps = numOrNull(f[19]);
    const beta = numOrNull(f[20]);
    const sharesOutstanding = num(f[21]);
    const exchangeName = priceInfo?.exchange || str(f[24]) || exchangeFallback;

    return {
      symbol: (priceInfo?.symbol || symbolFallback).toUpperCase(),
      name: priceInfo?.name || name,
      description,
      price: round(price || num(f[8]), 2),
      open: round(open, 2),
      high: round(high, 2),
      low: round(low, 2),
      previousClose: round(previousClose || num(f[8]), 2),
      change: round(change, 2),
      changePercent: round(changePercent, 2),
      marketCap,
      peRatio: peRatio !== null ? round(peRatio, 2) : null,
      eps: eps !== null ? round(eps, 2) : null,
      beta: beta !== null ? round(beta, 2) : null,
      dividendYield,
      volume,
      avgVolume,
      high52: round(high52, 2),
      low52: round(low52, 2),
      sharesOutstanding,
      currency,
      exchange: exchangeName,
      ceo,
      employees,
      hq,
      founded,
      kgId: priceInfo?.kgId || kgId,
      afterHoursPrice: priceInfo?.afterHoursPrice ?? null,
      afterHoursChange: priceInfo?.afterHoursChange ?? null,
      afterHoursChangePercent: priceInfo?.afterHoursChangePercent ?? null,
    };
  }

  // No fundamentals — build from price data only
  return {
    symbol: (priceInfo?.symbol || symbolFallback).toUpperCase(),
    name: priceInfo?.name || "",
    description: "",
    price: round(price, 2),
    open: 0,
    high: 0,
    low: 0,
    previousClose: round(previousClose, 2),
    change: round(change, 2),
    changePercent: round(changePercent, 2),
    marketCap: 0,
    peRatio: null,
    eps: null,
    beta: null,
    dividendYield: null,
    volume: 0,
    avgVolume: 0,
    high52: 0,
    low52: 0,
    sharesOutstanding: 0,
    currency: priceInfo?.currency || "USD",
    exchange: priceInfo?.exchange || exchangeFallback,
    ceo: null,
    employees: null,
    hq: null,
    founded: null,
    kgId: priceInfo?.kgId || null,
    afterHoursPrice: priceInfo?.afterHoursPrice ?? null,
    afterHoursChange: priceInfo?.afterHoursChange ?? null,
    afterHoursChangePercent: priceInfo?.afterHoursChangePercent ?? null,
  };
}

/**
 * Build a Quote from RPC fundamentals data alone (legacy, for HqGpWd-only mode).
 */
export function buildQuoteFromRpc(data: any[], symbol: string, exchange: string): Quote {
  let q: any[];
  if (Array.isArray(data) && Array.isArray(data[0]) && Array.isArray(data[0][0])) {
    q = data[0][0];
  } else if (Array.isArray(data) && Array.isArray(data[0])) {
    q = data[0];
  } else {
    q = data;
  }

  return buildQuote(q, null, symbol, exchange);
}

// ---------------------------------------------------------------------------
// Financials extraction (Pr8h2e)
// ---------------------------------------------------------------------------

/**
 * Extract quarterly financials from Pr8h2e RPC response.
 *
 * Each quarter: [year, quarter_num, [current_period], [prior_year_period]]
 * Per-period indices:
 *   [0] revenue    [1] net_income   [2] EPS         [3] PE
 *   [4] op_income  [7] gross_profit [23] total_assets [24] total_equity
 *  [27] shares_out [28] FCF        [35] profit_margin [36] op_margin
 */
export function extractFinancials(data: any): QuarterlyFinancial[] {
  const results: QuarterlyFinancial[] = [];
  const quarters = data?.[0]?.[0]?.[0];
  if (!Array.isArray(quarters)) return results;

  for (const q of quarters) {
    const cur = q[2];
    const prior = q[3];
    if (!cur) continue;

    results.push({
      year: q[0],
      quarter: q[1],
      revenue: numOrNull(cur[0]),
      netIncome: numOrNull(cur[1]),
      eps: numOrNull(cur[2]),
      peRatio: numOrNull(cur[3]),
      operatingIncome: numOrNull(cur[4]),
      grossProfit: numOrNull(cur[7]),
      totalAssets: numOrNull(cur[23]),
      totalEquity: numOrNull(cur[24]),
      sharesOutstanding: numOrNull(cur[27]),
      fcf: numOrNull(cur[28]),
      profitMargin: numOrNull(cur[35]),
      operatingMargin: numOrNull(cur[36]),
      priorYear: prior
        ? {
            revenue: numOrNull(prior[0]),
            netIncome: numOrNull(prior[1]),
            eps: numOrNull(prior[2]),
          }
        : null,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Indices extraction (Xhdx2e)
// ---------------------------------------------------------------------------

/**
 * Extract market indices from Xhdx2e RPC response.
 */
export function extractIndices(data: any): MarketIndex[] {
  const results: MarketIndex[] = [];
  const indices = data?.[0]?.[0]?.[1];
  if (!Array.isArray(indices)) return results;

  for (const idx of indices) {
    const d = idx?.[1]?.[0];
    if (!d) continue;

    const priceArr = d[5];
    results.push({
      symbol: d[1]?.[0] || "",
      exchange: d[1]?.[1] || "",
      name: d[2] || "",
      price: numOrNull(priceArr?.[0]) ?? 0,
      change: numOrNull(priceArr?.[1]) ?? 0,
      changePercent: numOrNull(priceArr?.[2]) ?? 0,
      previousClose: numOrNull(d[7]) ?? 0,
    });
  }

  return results;
}
