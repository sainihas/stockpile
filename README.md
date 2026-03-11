# stockpile

Free real-time stock quotes, financials, and market indices via Google Finance. No API key required.

Zero dependencies. Works with Node.js, Bun, and Deno.

## Install

```bash
npm install stockpile
# or
bun add stockpile
```

## Quick Start

```typescript
import { quote, batchQuote, financials, indices } from 'stockpile';

// Single quote with real-time price + after-hours
const aapl = await quote('AAPL');
console.log(aapl.price, aapl.afterHoursPrice, aapl.sector);

// Batch quotes (up to 40 tickers per RPC call)
const quotes = await batchQuote(['AAPL', 'NVDA', 'MSFT', 'GOOGL']);

// Quarterly financials (100+ quarters of revenue, EPS, FCF, margins)
const fin = await financials('NVDA');

// Major market indices (DJI, S&P 500, NASDAQ, Russell 2000, S&P/TSX)
const idx = await indices();

// With explicit exchange
const shop = await quote({ symbol: 'SHOP', exchange: 'TSE' });
```

## CLI

```bash
npx stockpile AAPL NVDA MSFT
npx stockpile SHOP:TSE RY:TSE
npx stockpile --json AAPL
npx stockpile --financials NVDA
npx stockpile --indices
```

## API

### `quote(ticker, options?): Promise<Quote>`

Fetch a single stock quote with real-time price, after-hours data, and company fundamentals.

- **ticker** — `string` (e.g. `'AAPL'`) or `{ symbol: string, exchange: string }`
- **options.timeout** — Request timeout in ms (default: 10000)
- **options.userAgent** — Custom User-Agent string

### `batchQuote(tickers, options?): Promise<Quote[]>`

Fetch multiple quotes in a single RPC call. Auto-chunks into batches of 40.

- **tickers** — Array of `string` or `{ symbol, exchange }` objects

### `financials(ticker, options?): Promise<QuarterlyFinancial[]>`

Fetch quarterly financial statements for a ticker. Returns 100+ quarters with revenue, net income, EPS, FCF, margins, and prior-year comparisons.

### `indices(options?): Promise<MarketIndex[]>`

Fetch major market indices (DJI, S&P 500, NASDAQ, Russell 2000, S&P/TSX).

### `Quote`

```typescript
interface Quote {
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
  sector: string | null;
  ceo: string | null;
  employees: number | null;
  hq: HQLocation | null;
  founded: string | null;
  kgId: string | null;
  afterHoursPrice: number | null;
  afterHoursChange: number | null;
  afterHoursChangePercent: number | null;
}
```

### `QuarterlyFinancial`

```typescript
interface QuarterlyFinancial {
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
```

### `MarketIndex`

```typescript
interface MarketIndex {
  symbol: string;
  exchange: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}
```

### `GFinanceError`

All errors thrown are instances of `GFinanceError` with a `.code` property:

| Code | Description |
|------|-------------|
| `TIMEOUT` | Request timed out |
| `NETWORK_ERROR` | Network/fetch failure |
| `RATE_LIMITED` | HTTP 429 from Google |
| `HTTP_ERROR` | Non-200 HTTP response |
| `NO_DATA` | No data returned for ticker |
| `NOT_FOUND` | Ticker not found on any exchange |

## Exchange Auto-Detection

Built-in mappings for 500+ NASDAQ, 200+ NYSE, 100+ NYSEARCA ETFs, and 50+ TSE tickers. Unknown tickers try NASDAQ, NYSE, then NYSEARCA automatically.

Override with an explicit exchange:

```typescript
await quote({ symbol: 'SAP', exchange: 'ETR' });  // Frankfurt
await quote({ symbol: '7203', exchange: 'TYO' });  // Toyota on Tokyo
```

## Disclaimer

This package uses Google Finance's internal RPC endpoint. It is **not** an official Google API. Use at your own risk. Google may change or restrict this endpoint at any time.

## License

MIT
