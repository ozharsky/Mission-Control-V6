# Kalshi Scanner Implementation Guide

**Based on:** Kimi Code Review Report (2026-03-13)  
**Target:** `kalshi-trade-fetcher-v2.cjs`  
**Goal:** Fix critical bugs + improve mathematical accuracy

---

## Phase 1: Critical Fixes (Do First - 30 min)

### Fix #1: Unprotected JSON.parse() in Polymarket Arbitrage

**Location:** Line ~4331 in `calculatePolymarketArbitrage` function

**Current Code:**
```javascript
const outcomes = JSON.parse(pmMarket.outcomes || '[]');
```

**Replace with:**
```javascript
// Safely parse outcomes with try/catch
let outcomes = [];
try {
  outcomes = JSON.parse(pmMarket.outcomes || '[]');
} catch (e) {
  console.warn(`⚠️ Invalid outcomes JSON for ${pmEvent.slug}: ${e.message}`);
  return null;
}

// Additional safety: ensure outcomes is actually an array
if (!Array.isArray(outcomes)) {
  console.warn(`⚠️ Outcomes is not an array for ${pmEvent.slug}`);
  return null;
}
```

**Also add safety check for yesIndex:**
```javascript
// Replace: const yesIndex = outcomes.findIndex(o => o.toLowerCase() === 'yes');
// With:
const yesIndex = outcomes.findIndex(o => 
  typeof o === 'string' && o.toLowerCase() === 'yes'
);

// Safety check for price array bounds
if (yesIndex === -1 || yesIndex >= prices.length) {
  return null;
}

const pmYesPrice = parseFloat(prices[yesIndex]) * 100;
if (isNaN(pmYesPrice)) {
  console.warn(`⚠️ Invalid price for ${pmEvent.slug}: ${prices[yesIndex]}`);
  return null;
}
```

---

### Fix #2: Undefined Variable in Correlation Report

**Location:** Line ~5483 in `main()` function

**Current Code:**
```javascript
correlationMatrix.printCorrelationReport(correlations);
```

**Replace with:**
```javascript
// Store correlations on instance for safe access
if (correlations && correlations.length > 0) {
  correlationMatrix.printCorrelationReport(correlations);
} else {
  console.log('\n📊 No correlation data available yet (need more price history)');
}
```

**Also modify CrossMarketCorrelation class (around line 1027):**
```javascript
class CrossMarketCorrelation {
  constructor() {
    this.correlations = [];
    this.lastAnalysis = null;
  }

  analyzeCorrelations(trades) {
    // ... existing code ...
    this.correlations = correlations;
    this.lastAnalysis = Date.now();
    return correlations;
  }
  
  printCorrelationReport(correlations = null) {
    const data = correlations || this.correlations;
    if (!data || data.length === 0) {
      console.log('\n📊 No correlation data available yet (need more price history)');
      return;
    }
    // ... rest of method ...
  }
}
```

---

### Fix #3: Division by Zero in Kelly Calculation

**Location:** Lines 4197-4200 in `calculateKelly` function

**Current Code:**
```javascript
const b = (100 - price) / price;  // If price = 100, b = 0
const fullKelly = (b * p - q) / b;  // Division by zero when b = 0!
```

**Replace with:**
```javascript
function calculateKelly(trueProb, price, bankroll = 10000, category = 'unknown') {
  const marketProb = price / 100;
  
  // Guard against invalid probability advantage
  if (trueProb <= marketProb) return { kellyPct: 0, position: 0 };
  
  // FIX: Guard against edge cases in price
  if (price <= 0 || price >= 99) {
    console.warn(`⚠️ Invalid price for Kelly calc: ${price}`);
    return { kellyPct: 0, position: 0 };
  }
  
  const b = (100 - price) / price;
  const p = trueProb;
  const q = 1 - p;
  
  // Additional safety: check b is positive and reasonable
  if (b <= 0 || !isFinite(b)) {
    console.warn(`⚠️ Invalid odds ratio: ${b}`);
    return { kellyPct: 0, position: 0 };
  }
  
  const fullKelly = (b * p - q) / b;
  
  // Validate Kelly result
  if (!isFinite(fullKelly) || fullKelly < 0) {
    console.warn(`⚠️ Invalid Kelly result: ${fullKelly}`);
    return { kellyPct: 0, position: 0 };
  }
  
  // ... rest of function ...
}
```

---

## Phase 2: Mathematical Corrections (1-2 hours)

### Fix #4: Replace Crypto Probability Model

**Location:** Lines 524-581, `calculateCryptoProbabilityFromMarketPrice` function

**Current:** Distance-based heuristics (arbitrary 70-95% ranges)

**Replace with Black-Scholes log-normal model:**

```javascript
// Add at top of file (after imports)
function erf(x) {
  // Error function approximation for normal CDF
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Replace calculateCryptoProbabilityFromMarketPrice function:
async function calculateCryptoProbabilityFromMarketPrice(marketTitle, livePrice, hoursToClose = 24) {
  // Extract bracket from title
  const aboveMatch = marketTitle.match(/above\s*\$?([\d,]+)/i);
  const belowMatch = marketTitle.match(/below\s*\$?([\d,]+)/i);
  const rangeMatch = marketTitle.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
  
  // Fetch volatility (default 45% annual for crypto)
  const volatility = 0.45;
  
  // Convert annual volatility to period volatility
  const hoursPerYear = 365 * 24;
  const periodVol = volatility * Math.sqrt(Math.max(0.001, hoursToClose) / hoursPerYear);
  
  if (aboveMatch) {
    const threshold = parseFloat(aboveMatch[1].replace(/,/g, ''));
    // Probability price > threshold at expiration
    const d1 = (Math.log(livePrice / threshold) + 0.5 * periodVol * periodVol) / periodVol;
    return Math.max(0.01, Math.min(0.99, 1 - normalCDF(d1)));
  }
  
  if (belowMatch) {
    const threshold = parseFloat(belowMatch[1].replace(/,/g, ''));
    // Probability price < threshold at expiration
    const d1 = (Math.log(livePrice / threshold) + 0.5 * periodVol * periodVol) / periodVol;
    return Math.max(0.01, Math.min(0.99, normalCDF(d1)));
  }
  
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const high = parseFloat(rangeMatch[2].replace(/,/g, ''));
    
    const d_low = (Math.log(livePrice / low) + 0.5 * periodVol * periodVol) / periodVol;
    const d_high = (Math.log(livePrice / high) + 0.5 * periodVol * periodVol) / periodVol;
    
    const probBelowLow = normalCDF(d_low);
    const probBelowHigh = normalCDF(d_high);
    
    return Math.max(0.01, Math.min(0.99, probBelowHigh - probBelowLow));
  }
  
  return 0.5; // Default
}
```

**Update the call site** (around line 4950):
```javascript
// Replace:
const effectiveBaseProb = series.category === 'crypto'
  ? await calculateCryptoProbabilityFromMarketPrice(m.title, liveCryptoPrices[series.ticker])
  : series.baseProb;

// With:
const hoursToClose = (new Date(m.close_time) - Date.now()) / (1000 * 60 * 60);
const effectiveBaseProb = series.category === 'crypto'
  ? await calculateCryptoProbabilityFromMarketPrice(m.title, liveCryptoPrices[series.ticker], hoursToClose)
  : series.baseProb;
```

---

### Fix #5: Improve R-Score Calculation

**Location:** Lines 4129-4186 in `calculateEdge` function

**Current:** Population std dev, no minimum sample check

**Replace with:**
```javascript
function calculateRScore(edge, history, ticker, minSamples = 10) {
  const tickerHistory = history[ticker] || [];
  
  if (tickerHistory.length < minSamples) {
    // Insufficient history - use category average or conservative default
    return {
      rScore: edge / 10, // Conservative 10% default volatility
      confidence: 'low',
      sampleSize: tickerHistory.length
    };
  }
  
  const edges = tickerHistory.map(h => h.edge).filter(e => typeof e === 'number');
  if (edges.length < minSamples) {
    return { rScore: edge / 10, confidence: 'low', sampleSize: edges.length };
  }
  
  // Sample standard deviation (Bessel's correction)
  const mean = edges.reduce((a, b) => a + b, 0) / edges.length;
  const squaredDiffs = edges.map(e => Math.pow(e - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (edges.length - 1);
  const stdDev = Math.sqrt(variance);
  
  // Minimum volatility floor to prevent extreme R-scores
  const adjustedVolatility = Math.max(stdDev, 2); // Min 2% volatility
  
  // R-Score = Signal / Noise
  const rScore = edge / adjustedVolatility;
  
  // Confidence based on sample size
  let confidence = 'low';
  if (edges.length >= 50) confidence = 'high';
  else if (edges.length >= 20) confidence = 'medium';
  
  return {
    rScore,
    historicalVolatility: adjustedVolatility,
    confidence,
    sampleSize: edges.length
  };
}
```

---

### Fix #6: Account for Exit Fees in Net Edge

**Location:** Lines 4968-4971

**Current:** Only calculates entry fees

**Add exit fee calculation:**
```javascript
// Replace the fee calculation section with:
const entryFeeResult = calculateKalshiFees(100, yesPrice, true, series.ticker);
const entryFee = entryFeeResult.fee;

// Estimate exit fee (sell at current price)
const exitFeeResult = calculateKalshiFees(100, yesPrice, true, series.ticker);
const exitFee = exitFeeResult.fee;

// Total cost = entry fee + exit fee + spread
const totalCost = entryFee + exitFee + spreadCost;
const netEdge = grossEdge - totalCost;

// Store for reference
const estimatedFees = {
  entry: entryFee,
  exit: exitFee,
  spread: spreadCost,
  total: totalCost
};
```

---

## Phase 3: Production Hardening (1 hour)

### Fix #7: Add Request Timeouts

**Location:** Lines 294-336 in `fetchWithRetry` function

**Add timeout wrapper:**
```javascript
async function fetchWithRetry(url, options = {}, maxRetries = CONFIG.rateLimit.maxRetries, isWrite = false) {
  let lastError;
  
  // Add timeout wrapper
  const fetchWithTimeout = async (timeoutMs = 15000) => {
    return Promise.race([
      rateLimitedFetchOnce(url, options, isWrite),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchWithTimeout(15000);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) break;
      
      const isTimeout = error.message.includes('timeout');
      const isRateLimit = error.message && error.message.includes('429');
      
      if (isTimeout) {
        console.log(`⏱️ Request timeout, retrying... (${attempt + 1}/${maxRetries})`);
      }
      
      // ... rest of retry logic
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}
```

---

### Fix #8: Improve Ticker Regex Pattern

**Location:** Line ~3003 in `PennyPickingScanner.groupByEvent`

**Replace with more flexible pattern:**
```javascript
groupByEvent(markets) {
  const groups = {};
  
  for (const market of markets) {
    if (!market.ticker) continue;
    
    // Try multiple patterns for flexibility
    const patterns = [
      /^([A-Z]+-\d{2}[A-Z]{3}\d{2})/i,  // Standard: KXHIGHNY-26MAR08
      /^([A-Z]+-\d{8})/i,                // Numeric: KXHIGHNY-20260308
      /^(.+)-[^-]+$/                     // Fallback: up to last hyphen
    ];
    
    let eventKey = null;
    for (const pattern of patterns) {
      const match = market.ticker.match(pattern);
      if (match) {
        eventKey = match[1].toUpperCase();
        break;
      }
    }
    
    if (!eventKey) {
      console.warn(`⚠️ Could not parse event key from ticker: ${market.ticker}`);
      eventKey = market.ticker; // Use full ticker as fallback
    }
    
    if (!groups[eventKey]) groups[eventKey] = [];
    groups[eventKey].push(market);
  }
  
  return groups;
}
```

---

### Fix #9: Add Log Level System

**Location:** Add at top of file (after imports)

```javascript
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

function log(level, ...args) {
  if (LOG_LEVELS[level] <= CURRENT_LOG_LEVEL) {
    console.log(...args);
  }
}

// Usage examples:
// log('DEBUG', 'Detailed auth info:', signature);
// log('INFO', '✅ Connected to WebSocket');
// log('ERROR', '❌ Fatal error:', err);
```

Replace excessive logging with appropriate levels:
- `log('DEBUG', ...)` for auth signatures, detailed market data
- `log('INFO', ...)` for connection status, scan results
- `log('WARN', ...)` for API failures, rate limits
- `log('ERROR', ...)` for critical failures

---

### Fix #10: Add Cache Size Limits

**Location:** Line ~4802 in `main()` function

**Replace simple Map with bounded cache:**
```javascript
class BoundedCache {
  constructor(maxSize = 1000, ttlMs = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  
  set(key, value) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }
}

// Usage:
const livePriceCache = new BoundedCache(1000, 30000); // Max 1000 items, 30s TTL
```

---

## Phase 4: Testing Checklist

After implementing fixes, verify:

- [ ] Scanner completes without crashing
- [ ] `opportunities` array is populated in Firebase
- [ ] No `JSON.parse` errors in logs
- [ ] Kelly calculation returns valid numbers (no Infinity/NaN)
- [ ] Crypto probabilities are between 0.01 and 0.99
- [ ] R-Score confidence levels shown correctly
- [ ] All markets have valid price data
- [ ] Firebase save includes all required fields

---

## Summary

| Phase | Time | Impact |
|-------|------|--------|
| Phase 1 | 30 min | **Prevents crashes** |
| Phase 2 | 1-2 hours | **Improves accuracy** |
| Phase 3 | 1 hour | **Production ready** |

**Start with Phase 1** - those 3 fixes will immediately stabilize the scanner.
