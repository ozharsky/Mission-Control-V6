# Kalshi Scanner v2.7 - Fixes Summary

**Date:** 2026-03-15  
**File:** `kalshi-trade-fetcher-v2.cjs`  
**Version:** 2.6 → 2.7

---

## ✅ FIXES COMPLETED

### 1. Static Base Probabilities → Real Crypto Data
**Problem:** Used static `baseProb: 0.35-0.50` for all series, not real market data.

**Fix:** 
- Added CoinGecko API integration
- Real-time crypto prices fetch for BTC, ETH, SOL, ADA, DOT
- Dynamic probability calculation based on current price vs strike
- Edge recalculation when price data changes significantly (>2%)

**Code Added:**
- `fetchCoinGeckoPrice(coinId)` - API fetcher with rate limiting
- `COINGECKO_MAP` - Series to coin ID mapping
- `getCryptoProbability(series, strikeLow, strikeHigh)` - Probability calculator
- Real data integration in main loop

---

### 2. RSS Feed Regex Parsing → Proper XML Parsing
**Problem:** Regex-based RSS parsing is fragile and breaks on malformed XML.

**Fix:**
- Added `xml2js` dependency (with graceful fallback)
- `parseRSSImproved()` - Uses xml2js first, regex fallback
- `parseRSSFallback()` - Original regex parser as backup

**To Enable:**
```bash
npm install xml2js
```

---

### 3. NWS Date Parsing Issues → Improved Matching
**Problem:** Date matching between Kalshi tickers and NWS forecasts was unreliable.

**Fix:**
- `fetchNWSForecastSafe()` - Better error handling
- `parseNWSForecastSafe()` - Returns structured data with `dayOfMonth`, `month` indices
- `detectWeatherLagImproved()` - Fixed date matching logic
  - Proper month index mapping (JAN=0, FEB=1, etc.)
  - City code normalization (NY/NYC, TPHX/PHX)
  - Forecast confidence based on days out
  - Lowered lag threshold from 10% to 8%

---

### 4. No Rate Limiting → Added Protection
**Problem:** No protection against API rate limits, could get banned.

**Fix:**
- Added `rateLimiter` tracking object
- `checkRateLimit(service)` - Tracks calls per service
- Configurable limits per API:
  - NWS: 10 calls/minute
  - CoinGecko: 30 calls/minute
  - Polymarket: 20 calls/minute
  - RSS: 10 calls/minute
- Automatic wait when limits hit

---

### 5. Limited Error Handling → Enhanced Fallbacks
**Problem:** External API failures could crash or produce no output.

**Fix:**
- All external API calls wrapped in try/catch
- Graceful degradation to static data when APIs fail
- Consistent error logging with service name
- Delays between external API calls (`CONFIG.externalApiDelay: 1000ms`)

---

### 6. Limited Polymarket Mapping → Expanded Coverage
**Problem:** Only 6 Polymarket markets mapped.

**Fix:**
- Expanded to 12 mappings:
  - Crypto: BTC, ETH, SOL
  - Economics: Fed, CPI, Jobs, GDP
  - Politics: Trump approval, Trump social
  - Weather: NYC, Chicago, Seattle
- Added rate limiting to Polymarket calls

---

## 📊 SUMMARY OUTPUT UPDATES

The scan output now includes:
- `version: '2.7.0'`
- `changelog` array with all changes
- Real crypto data in trade objects:
  - `coinGeckoPrice`
  - `coinGeckoChange24h`
  - Updated `trueProbability`
  - Recalculated `edge` and `rScore`

---

## ⚠️ REQUIRES ATTENTION (Future Work)

### 1. Real Weather Data Sources
**Status:** NWS integration working but could be enhanced  
**Issue:** Still using static baseProb as fallback when NWS fails  
**Future:** Add OpenWeatherMap or WeatherAPI as backup

### 2. Real Economics Data
**Status:** Not implemented  
**Issue:** Fed/CPI/Jobs/GDP still use static `baseProb`  
**Future:** 
- CME FedWatch API for Fed probability
- BLS API for jobs data
- BEA API for GDP tracking

### 3. Real Politics Data
**Status:** Not implemented  
**Issue:** Trump/social media uses static probabilities  
**Future:**
- Truth Social API for post counts
- Twitter/X API for engagement
- 538 API for approval ratings

### 4. xml2js Dependency
**Status:** Optional but recommended  
**Action Required:**
```bash
cd /path/to/Mission-Control-V6
npm install xml2js
```
Without it, RSS parsing falls back to regex (still works but less reliable).

### 5. API Key Management
**Status:** Using public/free APIs only  
**Future:** May need API keys for:
- OpenWeatherMap (free tier available)
- CoinGecko (public API has limits)
- Premium RSS feeds

### 6. Testing
**Status:** Not tested in production  
**Action Required:**
- Test GitHub Actions workflow
- Verify Firebase writes
- Check rate limits under load

---

## 🔧 CONFIGURATION OPTIONS

New config options added:
```javascript
CONFIG.externalApiDelay = 1000;        // Delay between external API calls
CONFIG.rateLimits = {                  // Per-service rate limits
  nws: { calls: 10, window: 60000 },
  coingecko: { calls: 30, window: 60000 },
  polymarket: { calls: 20, window: 60000 },
  rss: { calls: 10, window: 60000 }
};
```

---

## 📈 EXPECTED IMPROVEMENTS

1. **Better Edge Accuracy:** Crypto edges now based on real prices vs strikes
2. **More Weather Lags:** Improved date matching should find more opportunities
3. **Fewer API Errors:** Rate limiting prevents bans and timeouts
4. **More Stable RSS:** Proper XML parsing reduces parsing errors
5. **Better Debugging:** Enhanced logging shows which data sources are working

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Install xml2js: `npm install xml2js`
- [ ] Test locally: `node scripts/kalshi-trade-fetcher-v2.cjs`
- [ ] Verify Firebase env vars are set
- [ ] Check GitHub Actions secrets
- [ ] Monitor first few runs for errors
- [ ] Compare v2.6 vs v2.7 output quality

---

## 🐛 KNOWN LIMITATIONS

1. **CoinGecko Free Tier:** 30 calls/minute, may hit limits during busy periods
2. **NWS API:** Requires proper User-Agent, occasional downtime
3. **RSS Feeds:** Some feeds may block automated requests
4. **Polymarket:** Limited market overlap with Kalshi
5. **Weather Lag:** Only works for temperature markets with clear date patterns

---

## 📞 SUPPORT

If issues arise:
1. Check logs for specific API errors
2. Verify rate limits not exceeded
3. Test individual APIs separately
4. Check Firebase quota/limits
5. Review GitHub Actions logs
