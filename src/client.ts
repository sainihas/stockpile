import type { Quote, QuarterlyFinancial, MarketIndex, TickerInput, QuoteOptions, ResolvedTicker } from "./types.js";
import { resolveExchange, FALLBACK_EXCHANGES } from "./exchanges.js";
import {
  parseRpcCallbacks,
  parseQuotePage,
  buildQuote,
  extractXh8wxfPrice,
  extractFinancials,
  extractIndices,
} from "./parser.js";

const RPC_ENDPOINT = "https://www.google.com/finance/_/GoogleFinanceUi/data/batchexecute";
const PAGE_BASE = "https://www.google.com/finance/quote";
const DEFAULT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_PER_BATCH = 40;
const DEFAULT_TIMEOUT = 10_000;
const BATCH_CONCURRENCY = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTicker(input: TickerInput): ResolvedTicker {
  if (typeof input === "string") {
    const upper = input.toUpperCase();
    const known = resolveExchange(upper);
    return { symbol: upper, exchange: known ?? "NASDAQ" };
  }
  return { symbol: input.symbol.toUpperCase(), exchange: input.exchange.toUpperCase() };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new GFinanceError("Request timed out", "TIMEOUT");
    }
    throw new GFinanceError(`Network error: ${err.message}`, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

function rpcHeaders(ua: string): Record<string, string> {
  return {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": ua,
    origin: "https://www.google.com",
    referer: "https://www.google.com/finance/",
  };
}

function buildBatchBody(items: Array<[string, string, null, string]>): string {
  return `f.req=${encodeURIComponent(JSON.stringify([items]))}`;
}

function tickerPayload(sym: string, exch: string): [null, [string, string]] {
  return [null, [sym, exch]];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Page scraping approach (single-ticker, gets real-time price)
// ---------------------------------------------------------------------------

async function fetchQuotePage(
  ticker: ResolvedTicker,
  options: QuoteOptions = {},
): Promise<Quote | null> {
  const ua = options.userAgent ?? DEFAULT_UA;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const url = `${PAGE_BASE}/${ticker.symbol}:${ticker.exchange}`;

  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: { "user-agent": ua, "accept-language": "en-US,en;q=0.9" },
  }, timeout);

  if (res.status === 429) {
    throw new GFinanceError("Rate limited by Google Finance (HTTP 429)", "RATE_LIMITED");
  }

  if (!res.ok) return null;

  const html = await res.text();
  const { price, fundamentals } = parseQuotePage(html);
  if (!price) return null;

  return buildQuote(fundamentals, price, ticker.symbol, ticker.exchange);
}

// ---------------------------------------------------------------------------
// RPC batch approach (multi-ticker, uses xh8wxf + HqGpWd)
// ---------------------------------------------------------------------------

/**
 * Composite key for a ticker on a specific exchange.
 * Prevents collision when the same symbol is on multiple exchanges (e.g., SHOP on NASDAQ + TSE).
 */
function tickerKey(t: ResolvedTicker): string {
  return `${t.symbol}:${t.exchange}`;
}

async function executeRpcBatch(
  tickers: ResolvedTicker[],
  options: QuoteOptions = {},
): Promise<Map<string, Quote>> {
  const ua = options.userAgent ?? DEFAULT_UA;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  // Build mixed batch: xh8wxf (price) + HqGpWd (fundamentals) per ticker
  const items: Array<[string, string, null, string]> = [];
  let idx = 1;
  const indexMap = new Map<string, { priceIdx: string; fundIdx: string }>();

  for (const t of tickers) {
    const priceIdx = String(idx++);
    const fundIdx = String(idx++);
    indexMap.set(tickerKey(t), { priceIdx, fundIdx });

    items.push(["xh8wxf", JSON.stringify([[tickerPayload(t.symbol, t.exchange)], 1]), null, priceIdx]);
    items.push(["HqGpWd", JSON.stringify([[tickerPayload(t.symbol, t.exchange)]]), null, fundIdx]);
  }

  const body = buildBatchBody(items);
  const res = await fetchWithTimeout(RPC_ENDPOINT, {
    method: "POST",
    headers: rpcHeaders(ua),
    body,
  }, timeout);

  if (res.status === 429) {
    throw new GFinanceError("Rate limited by Google Finance (HTTP 429)", "RATE_LIMITED");
  }
  if (!res.ok) {
    throw new GFinanceError(`HTTP ${res.status}: ${res.statusText}`, "HTTP_ERROR");
  }

  const text = await res.text();
  const callbacks = parseRpcCallbacks(text);

  const cbByIndex = new Map<string, (typeof callbacks)[0]>();
  for (const cb of callbacks) {
    cbByIndex.set(cb.index, cb);
  }

  const results = new Map<string, Quote>();

  for (const t of tickers) {
    const key = tickerKey(t);
    const mapping = indexMap.get(key);
    if (!mapping) continue;

    const priceCb = cbByIndex.get(mapping.priceIdx);
    const fundCb = cbByIndex.get(mapping.fundIdx);

    const priceData = priceCb?.rpcId === "xh8wxf" ? extractXh8wxfPrice(priceCb.data) : null;

    // Extract fundamentals array from HqGpWd
    let fundArray: any[] | null = null;
    if (fundCb?.rpcId === "HqGpWd") {
      const d = fundCb.data;
      if (Array.isArray(d?.[0]?.[0]) && d[0][0].length >= 15) {
        fundArray = d[0][0];
      }
    }

    if (priceData || fundArray) {
      results.set(key, buildQuote(fundArray, priceData, t.symbol, t.exchange));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: quote
// ---------------------------------------------------------------------------

/**
 * Fetch a single stock quote.
 *
 * Uses the batchexecute RPC (xh8wxf + HqGpWd) to get real-time price
 * with after-hours data AND full company fundamentals in a single request.
 *
 * @example
 * ```ts
 * const q = await quote('AAPL');
 * console.log(q.price, q.change, q.afterHoursPrice);
 * ```
 */
export async function quote(
  ticker: TickerInput,
  options?: QuoteOptions,
): Promise<Quote> {
  const resolved = resolveTicker(ticker);
  const isKnown = typeof ticker !== "string" || resolveExchange(resolved.symbol) !== null;

  // Use RPC for known tickers (more data, including after-hours)
  if (isKnown) {
    const results = await executeRpcBatch([resolved], options);
    const q = results.get(tickerKey(resolved));
    if (q) return q;

    // Fallback to page scrape
    const pageQ = await fetchQuotePage(resolved, options);
    if (pageQ) return pageQ;

    throw new GFinanceError(`No data returned for ${resolved.symbol}`, "NO_DATA");
  }

  // Unknown ticker — try fallback exchanges via RPC
  let lastError: Error | null = null;
  for (const exchange of FALLBACK_EXCHANGES) {
    try {
      const t = { symbol: resolved.symbol, exchange };
      const results = await executeRpcBatch([t], options);
      const q = results.get(tickerKey(t));
      if (q && q.name) return q;
    } catch (err) {
      if (err instanceof GFinanceError && err.code === "RATE_LIMITED") throw err;
      lastError = err as Error;
    }
  }

  throw new GFinanceError(
    `Could not find ${resolved.symbol} on any exchange`,
    "NOT_FOUND",
  );
}

// ---------------------------------------------------------------------------
// Public API: batchQuote
// ---------------------------------------------------------------------------

/**
 * Fetch quotes for multiple tickers.
 *
 * Uses the batchexecute RPC with xh8wxf (real-time price + after-hours)
 * and HqGpWd (fundamentals) combined in a single request per batch.
 * Batches up to 40 tickers per request.
 *
 * @example
 * ```ts
 * const quotes = await batchQuote(['AAPL', 'NVDA', 'MSFT']);
 * for (const q of quotes) console.log(q.symbol, q.price, q.afterHoursPrice);
 * ```
 */
export async function batchQuote(
  tickers: TickerInput[],
  options?: QuoteOptions,
): Promise<Quote[]> {
  if (tickers.length === 0) return [];

  const resolved = tickers.map(resolveTicker);
  const chunks_ = chunk(resolved, MAX_PER_BATCH);

  // Limit concurrent chunk requests to BATCH_CONCURRENCY
  const chunkResults = await pMap(
    chunks_,
    (c) => executeRpcBatch(c, options).catch((err) => {
      if (err instanceof GFinanceError && err.code === "RATE_LIMITED") throw err;
      return new Map<string, Quote>();
    }),
    BATCH_CONCURRENCY,
  );

  const merged = new Map<string, Quote>();
  for (const m of chunkResults) {
    for (const [k, v] of m) {
      merged.set(k, v);
    }
  }

  // Collect results, trying fallback exchanges for missing unknown tickers
  const results: Quote[] = [];
  for (const t of resolved) {
    const key = tickerKey(t);
    let q = merged.get(key);

    // If not found and exchange was a guess (not user-specified), try fallbacks
    if (!q && resolveExchange(t.symbol) === null) {
      for (const exchange of FALLBACK_EXCHANGES) {
        if (exchange === t.exchange) continue;
        try {
          const fb = { symbol: t.symbol, exchange };
          const fbResult = await executeRpcBatch([fb], options);
          const fbQ = fbResult.get(tickerKey(fb));
          if (fbQ && fbQ.name) { q = fbQ; break; }
        } catch (err) {
          if (err instanceof GFinanceError && err.code === "RATE_LIMITED") throw err;
        }
      }
    }

    if (q) results.push(q);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: financials
// ---------------------------------------------------------------------------

/**
 * Fetch quarterly financial statements for a ticker.
 *
 * Returns revenue, net income, EPS, FCF, margins, and more for up to
 * 100+ quarters with prior-year comparisons.
 *
 * @example
 * ```ts
 * const fin = await financials('AAPL');
 * for (const q of fin.slice(0, 4)) {
 *   console.log(`Q${q.quarter} ${q.year}: Revenue $${q.revenue}`);
 * }
 * ```
 */
export async function financials(
  ticker: TickerInput,
  options?: QuoteOptions,
): Promise<QuarterlyFinancial[]> {
  const resolved = resolveTicker(ticker);
  const ua = options?.userAgent ?? DEFAULT_UA;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const inner = JSON.stringify([[tickerPayload(resolved.symbol, resolved.exchange)]]);
  const items: Array<[string, string, null, string]> = [
    ["Pr8h2e", inner, null, "1"],
  ];

  const res = await fetchWithTimeout(RPC_ENDPOINT, {
    method: "POST",
    headers: rpcHeaders(ua),
    body: buildBatchBody(items),
  }, timeout);

  if (res.status === 429) {
    throw new GFinanceError("Rate limited by Google Finance (HTTP 429)", "RATE_LIMITED");
  }
  if (!res.ok) {
    throw new GFinanceError(`HTTP ${res.status}: ${res.statusText}`, "HTTP_ERROR");
  }

  const callbacks = parseRpcCallbacks(await res.text());
  for (const cb of callbacks) {
    if (cb.rpcId === "Pr8h2e") {
      return extractFinancials(cb.data);
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API: indices
// ---------------------------------------------------------------------------

/**
 * Fetch major market indices (DJI, S&P 500, NASDAQ, Russell 2000, S&P/TSX).
 *
 * @example
 * ```ts
 * const idx = await indices();
 * for (const i of idx) {
 *   console.log(`${i.name}: ${i.price} (${i.changePercent > 0 ? '+' : ''}${i.changePercent.toFixed(2)}%)`);
 * }
 * ```
 */
export async function indices(
  options?: QuoteOptions,
): Promise<MarketIndex[]> {
  const ua = options?.userAgent ?? DEFAULT_UA;
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const inner = JSON.stringify([null, 1]);
  const items: Array<[string, string, null, string]> = [
    ["Xhdx2e", inner, null, "1"],
  ];

  const res = await fetchWithTimeout(RPC_ENDPOINT, {
    method: "POST",
    headers: rpcHeaders(ua),
    body: buildBatchBody(items),
  }, timeout);

  if (res.status === 429) {
    throw new GFinanceError("Rate limited by Google Finance (HTTP 429)", "RATE_LIMITED");
  }
  if (!res.ok) {
    throw new GFinanceError(`HTTP ${res.status}: ${res.statusText}`, "HTTP_ERROR");
  }

  const callbacks = parseRpcCallbacks(await res.text());
  for (const cb of callbacks) {
    if (cb.rpcId === "Xhdx2e") {
      return extractIndices(cb.data);
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Error class for gfinance operations.
 */
export class GFinanceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "GFinanceError";
    this.code = code;
  }
}
