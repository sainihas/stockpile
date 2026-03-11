#!/usr/bin/env node

/**
 * gfinance CLI — fetch real-time stock quotes from the terminal.
 *
 * Usage:
 *   npx gfinance AAPL NVDA MSFT
 *   npx gfinance SHOP:TSE RY:TSE
 *   npx gfinance --json AAPL
 *   npx gfinance --financials AAPL
 *   npx gfinance --indices
 */

import { batchQuote, financials, indices, GFinanceError } from "../src/index.js";
import type { TickerInput } from "../src/index.js";

const VERSION = "2.0.0";

const args = process.argv.slice(2);
let jsonMode = false;
let financialsMode = false;
let indicesMode = false;
const tickers: TickerInput[] = [];

for (const arg of args) {
  if (arg === "--json" || arg === "-j") {
    jsonMode = true;
    continue;
  }
  if (arg === "--financials" || arg === "-f") {
    financialsMode = true;
    continue;
  }
  if (arg === "--indices" || arg === "-i") {
    indicesMode = true;
    continue;
  }
  if (arg === "--version" || arg === "-v") {
    console.log(`gfinance v${VERSION}`);
    process.exit(0);
  }
  if (arg === "--help" || arg === "-h") {
    console.log(`
gfinance v${VERSION} - Free real-time stock quotes via Google Finance

Usage:
  gfinance AAPL NVDA MSFT          Fetch quotes for multiple tickers
  gfinance SHOP:TSE RY:TSE         Specify exchange explicitly
  gfinance --json AAPL             Output as JSON
  gfinance --financials AAPL       Quarterly financials for a ticker
  gfinance --indices               Major market indices
  gfinance --version               Show version
  gfinance --help                  Show this help

Examples:
  gfinance AAPL
  gfinance AAPL GOOGL MSFT AMZN META
  gfinance SHOP:TSE BNS:TSE
  gfinance --financials NVDA
  gfinance --indices
`);
    process.exit(0);
  }
  if (arg.startsWith("--")) {
    console.error(`Unknown flag: ${arg}. Run with --help for usage.`);
    process.exit(1);
  }

  // Parse SYMBOL or SYMBOL:EXCHANGE
  if (arg.includes(":")) {
    const [symbol, exchange] = arg.split(":");
    tickers.push({ symbol: symbol.toUpperCase(), exchange: exchange.toUpperCase() });
  } else {
    tickers.push(arg.toUpperCase());
  }
}

async function main() {
  try {
    if (indicesMode) {
      const idx = await indices();
      if (jsonMode) {
        console.log(JSON.stringify(idx, null, 2));
      } else {
        const header = padRow(["Index", "Price", "Change", "Change%"]);
        console.log(header);
        console.log("-".repeat(header.length));
        for (const i of idx) {
          const sign = i.change >= 0 ? "+" : "";
          console.log(padRow([
            i.symbol,
            i.price.toFixed(2),
            `${sign}${i.change.toFixed(2)}`,
            `${sign}${i.changePercent.toFixed(2)}%`,
          ]));
        }
      }
      return;
    }

    if (financialsMode) {
      if (tickers.length === 0) {
        console.error("Error: Provide a ticker for financials. Example: gfinance --financials AAPL");
        process.exit(1);
      }
      if (tickers.length > 1) {
        console.error(`Warning: --financials only supports one ticker, ignoring: ${tickers.slice(1).map(t => typeof t === "string" ? t : t.symbol).join(", ")}`);
      }
      const fin = await financials(tickers[0]);
      if (jsonMode) {
        console.log(JSON.stringify(fin, null, 2));
      } else {
        const header = padFinRow(["Quarter", "Revenue", "Net Income", "EPS", "FCF", "Margin"]);
        console.log(header);
        console.log("-".repeat(header.length));
        for (const q of fin.slice(0, 8)) {
          console.log(padFinRow([
            `Q${q.quarter} ${q.year}`,
            formatLarge(q.revenue),
            formatLarge(q.netIncome),
            q.eps !== null ? `$${q.eps.toFixed(2)}` : "—",
            formatLarge(q.fcf),
            q.profitMargin !== null ? `${q.profitMargin.toFixed(1)}%` : "—",
          ]));
        }
      }
      return;
    }

    if (tickers.length === 0) {
      console.error("Error: No tickers provided. Run with --help for usage.");
      process.exit(1);
    }

    const quotes = await batchQuote(tickers);

    if (jsonMode) {
      console.log(JSON.stringify(quotes, null, 2));
      return;
    }

    const header = padRow(["Symbol", "Price", "Change", "Change%", "Volume", "Mkt Cap", "Exchange"]);
    console.log(header);
    console.log("-".repeat(header.length));

    for (const q of quotes) {
      const changeStr = q.change >= 0 ? `+${q.change.toFixed(2)}` : q.change.toFixed(2);
      const pctStr = q.changePercent >= 0 ? `+${q.changePercent.toFixed(2)}%` : `${q.changePercent.toFixed(2)}%`;
      console.log(
        padRow([
          q.symbol,
          q.price.toFixed(2),
          changeStr,
          pctStr,
          formatNumber(q.volume),
          formatMarketCap(q.marketCap),
          q.exchange,
        ]),
      );
      if (q.afterHoursPrice !== null) {
        const ahSign = (q.afterHoursChange ?? 0) >= 0 ? "+" : "";
        console.log(
          padRow([
            "  AH",
            q.afterHoursPrice.toFixed(2),
            `${ahSign}${(q.afterHoursChange ?? 0).toFixed(2)}`,
            `${ahSign}${(q.afterHoursChangePercent ?? 0).toFixed(2)}%`,
            "",
            "",
            "",
          ]),
        );
      }
    }
  } catch (err) {
    if (err instanceof GFinanceError) {
      console.error(`Error [${err.code}]: ${err.message}`);
    } else {
      console.error("Error:", (err as Error).message);
    }
    process.exit(1);
  }
}

function padRow(cols: string[]): string {
  const widths = [8, 10, 10, 10, 12, 12, 10];
  return cols.map((c, i) => c.padEnd(widths[i] || 10)).join("  ");
}

function padFinRow(cols: string[]): string {
  const widths = [10, 14, 14, 10, 14, 10];
  return cols.map((c, i) => c.padEnd(widths[i] || 10)).join("  ");
}

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n}`;
}

function formatLarge(n: number | null): string {
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

main();
