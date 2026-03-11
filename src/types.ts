/**
 * A stock quote returned by the Google Finance RPC.
 */
export interface Quote {
  symbol: string;
  name: string;
  description: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  marketCap: number;
  peRatio: number | null;
  eps: number | null;
  beta: number | null;
  dividendYield: number | null;
  volume: number;
  avgVolume: number;
  high52: number;
  low52: number;
  sharesOutstanding: number;
  currency: string;
  exchange: string;
  ceo: string | null;
  employees: number | null;
  hq: HQLocation | null;
  founded: string | null;
  kgId: string | null;
  afterHoursPrice: number | null;
  afterHoursChange: number | null;
  afterHoursChangePercent: number | null;
}

export interface HQLocation {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  address: string;
}

/**
 * Quarterly financial data from Google Finance.
 */
export interface QuarterlyFinancial {
  year: number;
  quarter: number;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  peRatio: number | null;
  operatingIncome: number | null;
  grossProfit: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  sharesOutstanding: number | null;
  fcf: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  priorYear: {
    revenue: number | null;
    netIncome: number | null;
    eps: number | null;
  } | null;
}

/**
 * Market index data.
 */
export interface MarketIndex {
  symbol: string;
  exchange: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

/**
 * Ticker input — either a plain string like "AAPL" or an object with explicit exchange.
 */
export type TickerInput = string | { symbol: string; exchange: string };

/**
 * Options for quote and batchQuote calls.
 */
export interface QuoteOptions {
  /** Request timeout in milliseconds. Default: 10000 */
  timeout?: number;
  /** Custom User-Agent header. */
  userAgent?: string;
}

/**
 * Internal resolved ticker with symbol and exchange.
 */
export interface ResolvedTicker {
  symbol: string;
  exchange: string;
}
