/**
 * Exchange auto-detection for common tickers.
 *
 * Maps ticker symbols to their primary exchange **as recognized by Google Finance**.
 * Note: Google Finance's exchange assignment may differ from the actual listing exchange.
 * For example, QQQ is listed on NASDAQ in Google Finance, not NYSEARCA.
 *
 * For unknown tickers the client will try NASDAQ -> NYSE -> NYSEARCA in order.
 */

// ---------- NASDAQ (as listed on Google Finance) ----------
const NASDAQ_TICKERS = new Set([
  // Mega-cap tech
  "AAPL", "MSFT", "AMZN", "GOOGL", "GOOG", "META", "NVDA", "TSLA", "AVGO", "COST",
  "NFLX", "AMD", "ADBE", "QCOM", "INTC", "CSCO", "TXN", "INTU", "AMAT", "ISRG",
  "BKNG", "LRCX", "ADI", "REGN", "VRTX", "KLAC", "PANW", "SNPS", "CDNS", "MRVL",
  "ASML", "FTNT", "MNST", "NXPI", "MELI", "ORLY", "CTAS", "KDP", "ADP", "PCAR",
  "CHTR", "CPRT", "MCHP", "ODFL", "AEP", "ROST", "KHC", "PAYX", "DXCM", "FAST",
  "EXC", "VRSK", "CTSH", "GEHC", "XEL", "IDXX", "ILMN", "ON", "FANG",
  "ANSS", "CDW", "TTWO", "DLTR", "MDB", "TEAM", "WBD", "LCID", "RIVN",
  "ZS", "DDOG", "CRWD", "WDAY", "SPLK", "OKTA", "ZM", "DOCU", "ROKU", "SQ",
  "PYPL", "ABNB", "COIN", "HOOD", "DASH", "RBLX", "SNAP", "PINS", "TTD", "BILL",
  "HUBS", "NET", "SNOW", "PLTR", "SOFI", "AFRM", "U", "PATH", "DKNG", "LYFT",
  "UBER", "GRAB", "SE", "SHOP", "LULU", "SBUX", "PEP", "MDLZ", "WBA", "SIRI",
  "CMCSA", "TMUS", "GILD", "AMGN", "BIIB", "MRNA", "BNTX", "AZN", "JD", "PDD",
  "BIDU", "NTES", "LI", "NIO", "XPEV", "BILI", "TCOM", "MNSO", "FUTU", "TME",
  "MSTR", "SMCI", "ARM", "APP", "CELH", "DUOL", "FOUR", "GLBE", "GGAL", "NU",
  "CPNG", "CAVA", "CART", "IBKR", "LPLA", "EWBC", "FITB", "HBAN", "NTRS",
  "CINF", "ERIE", "CBSH", "COLB", "SBCF", "FFIN",
  // ETFs that Google Finance lists under NASDAQ
  "QQQ", "TQQQ", "SQQQ", "BND", "TLT", "SMH", "SOXX", "IBB", "BOTZ", "ICLN",
  "IBIT", "ETHA",
]);

// ---------- NYSE (as listed on Google Finance) ----------
const NYSE_TICKERS = new Set([
  // Mega-cap
  "BRK.A", "BRK.B", "JPM", "V", "MA", "UNH", "JNJ", "WMT", "PG", "HD",
  "XOM", "CVX", "BAC", "ABBV", "LLY", "MRK", "PFE", "TMO", "ABT", "DHR",
  "DIS", "VZ", "T", "CRM", "ACN", "IBM", "GE", "RTX", "HON", "UNP",
  "CAT", "DE", "BA", "LMT", "GD", "NOC", "MMM", "EMR", "ETN", "ITW",
  "SHW", "APD", "ECL", "FCX", "NEM", "GOLD", "FMC",
  "NEE", "DUK", "SO", "D", "SRE", "ED", "ES", "WEC", "AWK",
  "AMT", "CCI", "PLD", "SPG", "PSA", "EQIX", "O", "WELL", "DLR", "VICI",
  "BLK", "SCHW", "GS", "MS", "C", "WFC", "USB", "PNC", "TFC", "AXP",
  "COF", "DFS", "SYF", "ALL", "TRV", "PGR", "CB", "MET", "PRU", "AFL",
  "AIG", "HIG", "BK", "STT", "SPGI", "MCO", "ICE", "CME", "NDAQ",
  "CL", "KO", "GIS", "K", "SJM", "HSY", "MKC", "HRL", "CPB", "CAG",
  "PM", "MO", "STZ", "BF.B", "TAP", "SAM",
  "NKE", "TJX", "LOW", "TGT", "BURL", "GPS", "ANF", "RL", "PVH", "TPR",
  "CVS", "CI", "HUM", "CNC", "ELV", "MCK", "CAH", "ABC",
  "COP", "EOG", "SLB", "OXY", "MPC", "PSX", "VLO", "HES", "DVN", "HAL",
  "GM", "F", "TM", "HMC", "RACE",
  "FDX", "UPS", "CSX", "NSC", "DAL", "UAL", "LUV", "AAL",
  "BX", "KKR", "APO", "ARES", "CG", "OWL",
  "SPOT", "TWLO",
  "TSM", "SONY", "SAP",
  "BABA",
  "CEG", "VST", "NRG", "OKE", "WMB", "KMI", "ET",
]);

// ---------- NYSEARCA (ETFs as listed on Google Finance) ----------
const NYSEARCA_TICKERS = new Set([
  // Broad market
  "SPY", "IVV", "VOO", "VTI", "DIA", "IWM", "IWF", "IWD", "MDY",
  "RSP", "SPLG", "SCHX", "SCHB", "ITOT", "VTV", "VUG", "VIG", "SCHD", "DVY",
  // Sector
  "XLK", "XLF", "XLV", "XLE", "XLI", "XLP", "XLU", "XLY", "XLB", "XLRE",
  "XLC", "XBI", "XOP", "XHB", "XRT", "KRE", "KBE",
  "GDX", "GDXJ", "SLV", "GLD", "IAU", "GLDM", "PPLT", "PALL",
  // International
  "EFA", "EEM", "VEA", "VWO", "IEFA", "IEMG", "INDA", "FXI", "MCHI", "EWZ",
  "EWJ", "EWG", "EWU", "EWC", "EWA", "EWT", "EWY", "EWH", "EWS",
  // Bond
  "AGG", "IEF", "SHY", "LQD", "HYG", "JNK", "TIP", "VCIT",
  "VCSH", "VGSH", "VGIT", "VGLT", "MUB", "SUB", "EMB", "BNDX", "GOVT",
  // Commodity / Real assets
  "USO", "UNG", "DBA", "DBC", "PDBC", "COMT",
  "VNQ", "VNQI", "IYR", "REM", "SCHH",
  // Leveraged / inverse
  "SPXL", "SPXS", "UPRO", "SDS", "SSO", "SH",
  "SOXL", "SOXS", "LABU", "LABD", "FAS", "FAZ",
  "QLD", "QID",
  // Crypto
  "FBTC", "BITB", "ARKB", "HODL", "BRRR", "EZBC", "BTCO", "BTCW", "GBTC",
  "ETHE",
  // Thematic
  "ARKK", "ARKW", "ARKF", "ARKG", "ARKQ",
  "ROBO", "HACK", "SKYY", "CLOU", "WCLD", "BUG",
  "TAN", "QCLN", "PBW", "LIT", "REMX",
  "KWEB", "CQQQ",
]);

// ---------- TSE (Toronto Stock Exchange — Canadian stocks) ----------
const TSE_TICKERS = new Set([
  "RY", "TD", "BNS", "BMO", "CM", "NA", "MFC", "SLF", "GWO", "IAG",
  "ENB", "TRP", "CNQ", "SU", "IMO", "CVE", "HSE", "MEG", "WCP", "ERF",
  "CP", "CNR", "QSR", "DOL", "ATD", "L", "MG", "TIH", "WSP", "SNC",
  // Note: K (Kinross), T (TELUS), SHOP (Shopify) omitted — they collide with
  // NYSE K (Kellanova), NYSE T (AT&T), NASDAQ SHOP. Use explicit exchange for TSE.
  "ABX", "FNV", "WPM", "AEM", "AGI", "FM", "LUN", "HBM", "TECK.B",
  "BCE", "RCI.B", "QBR.B", "SJR.B",
  "BAM", "BN", "BIP.UN", "BEP.UN", "BBU.UN",
  "CSU", "OTEX", "KXS", "DCBO",
  "FFH", "IFC", "DFY", "EFN",
  "NTR", "CCL.B", "TFI", "AIF", "STN",
  "XIU", "XIC", "XSP", "ZSP", "VFV", "XQQ", "ZQQ", "ZEB", "ZWB",
  "XEQT", "XGRO", "XBAL", "VGRO", "VEQT", "VBAL",
]);

/**
 * Resolve the exchange for a given ticker symbol.
 * Returns the known exchange or null if unknown.
 */
export function resolveExchange(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  if (NASDAQ_TICKERS.has(upper)) return "NASDAQ";
  if (NYSE_TICKERS.has(upper)) return "NYSE";
  if (NYSEARCA_TICKERS.has(upper)) return "NYSEARCA";
  if (TSE_TICKERS.has(upper)) return "TSE";
  return null;
}

/**
 * Fallback exchanges to try in order when the ticker is not in the built-in map.
 */
export const FALLBACK_EXCHANGES = ["NASDAQ", "NYSE", "NYSEARCA"] as const;
