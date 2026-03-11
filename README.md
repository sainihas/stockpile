# gfinance

Free real-time stock quotes via Google Finance RPC. No API key required.

Zero dependencies. Works with Node.js, Bun, and Deno.

## Install

```bash
npm install gfinance
# or
bun add gfinance
```

## Quick Start

```typescript
import { quote, batchQuote } from 'gfinance';

// Single quote
const aapl = await quote('AAPL');
console.log(aapl.price, aapl.change, aapl.changePercent);

// Batch quotes (single RPC call, up to 40 tickers)
const quotes = await batchQuote(['AAPL', 'NVDA', 'MSFT', 'GOOGL']);

// With explicit exchange
const shop = await quote({ symbol: 'SHOP', exchange: 'TSE' });

// With options
const q = await quote('AAPL', { timeout: 15000 });
```

## CLI

```bash
npx gfinance AAPL NVDA MSFT
npx gfinance SHOP:TSE RY:TSE
npx gfinance --json AAPL
```

## API

### `quote(ticker, options?): Promise<Quote>`

Fetch a single stock quote.

- **ticker** — `string` (e.g. `'AAPL'`) or `{ symbol: string, exchange: string }` (e.g. `{ symbol: 'SHOP', exchange: 'TSE' }`)
- **options.timeout** — Request timeout in ms (default: 10000)
- **options.userAgent** — Custom User-Agent string

### `batchQuote(tickers, options?): Promise<Quote[]>`

Fetch multiple quotes in a single RPC call. Auto-chunks into batches of 40 for larger lists.

- **tickers** — Array of `string` or `{ symbol, exchange }` objects

### `Quote` object

```typescript
interface Quote {
  symbol: string;           // 'AAPL'
  name: string;             // 'Apple Inc'
  description: string;      // Company description
  price: number;            // 260.83
  open: number;             // 257.64
  high: number;             // 262.48
  low: number;              // 256.95
  previousClose: number;    // 259.88
  change: number;           // 0.95
  changePercent: number;    // 0.37
  marketCap: number;        // 3834905043576
  peRatio: number | null;   // 33.0
  eps: number | null;       // 7.90
  beta: number | null;      // 1.10
  dividendYield: number | null; // 0.004
  volume: number;           // 12633000
  avgVolume: number;        // 51490066
  high52: number;           // 288.61
  low52: number;            // 169.21
  sharesOutstanding: number;
  currency: string;         // 'USD'
  exchange: string;         // 'NASDAQ'
  ceo: string | null;
  employees: number | null;
  hq: HQLocation | null;
  founded: string | null;
  kgId: string | null;
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

The package includes built-in mappings for:

- **500+ NASDAQ** tickers (tech, biotech, consumer)
- **200+ NYSE** tickers (financials, industrials, energy)
- **100+ NYSEARCA** ETFs (SPY, QQQ, sector ETFs, leveraged, crypto, bonds)
- **50+ TSE** tickers (Canadian banks, energy, mining)

For unknown tickers, the package tries NASDAQ -> NYSE -> NYSEARCA automatically.

You can always override with an explicit exchange:

```typescript
await quote({ symbol: 'SAP', exchange: 'ETR' });  // Frankfurt
await quote({ symbol: '7203', exchange: 'TYO' });  // Toyota on Tokyo
```

## Disclaimer

This package uses Google Finance's internal RPC endpoint. It is **not** an official Google API. Use at your own risk. This is intended for personal/educational use. Google may change or restrict this endpoint at any time.

## License

MIT
