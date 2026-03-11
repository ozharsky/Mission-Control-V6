# Kalshi Scanner Audit Report

## Date: 2026-03-12

---

## ✅ PRODUCTION FILES (Keep & Maintain)

### 1. `kalshi-trade-fetcher-v2.cjs` (5,255 lines)
**Status**: ACTIVE - Main scanner used by GitHub Actions
**Features**:
- ✅ Brier Score integration (lines 14-16)
- ✅ Brier-based edge calibration (line 3802-3803)
- ✅ Time-based confidence adjustment (line 3753)
- ✅ Kelly criterion calculation (line 3865)
- ✅ Firebase integration (lines 5200+)
- ✅ Market health metrics
- ✅ Whale detection
- ✅ Arbitrage detection
- ✅ Sentiment analysis

**Used By**: `.github/workflows/kalshi-scanner-firebase.yml`

### 2. `kalshi-resolution-fetcher.cjs` (383 lines)
**Status**: ACTIVE - Used by GitHub Actions
**Purpose**: Fetches resolved market outcomes for Brier Score calculation

**Used By**: 
- `.github/workflows/kalshi-scanner-firebase.yml`
- `brier-integration.cjs`

### 3. `brier-integration.cjs` (8,950 bytes)
**Status**: ACTIVE - Integration layer
**Purpose**: Bridges v2 scanner with Brier tracking

**Exports**: `recordTradePrediction`, `getBrierMetrics`, `getEdgeCalibration`, etc.

**Used By**: `kalshi-trade-fetcher-v2.cjs`

### 4. `brier-tracker.cjs` (17,004 bytes)
**Status**: ACTIVE - Core Brier logic
**Purpose**: Records predictions, calculates Brier scores, generates metrics

**Used By**: `brier-integration.cjs`

---

## ❌ LEGACY/REDUNDANT FILES (Archive)

### 1. `kalshi-trade-fetcher.js` (148 lines)
**Status**: UNUSED - Original simple version
**Action**: Archive to `archive/kalshi-trade-fetcher.js`

### 2. `kalshi-scanner-firebase.mjs` (185 lines)
**Status**: UNUSED - Simplified ES module version
**Reason**: Superseded by v2 which has Firebase built-in
**Action**: Archive to `archive/kalshi-scanner-firebase.mjs`

### 3. `kalshi-scanner-with-brier.js` (169 lines)
**Status**: UNUSED - Wrapper script
**Reason**: Brier is now integrated directly into v2
**Action**: Archive to `archive/kalshi-scanner-with-brier.js`

### 4. `init-v6.ts`
**Status**: UNUSED - One-time initialization script
**Action**: Archive to `archive/init-v6.ts`

---

## 🔧 CURRENT FEATURES IN V2 SCANNER

### Brier Score Integration
```javascript
// Line 14-16: Optional Brier loading
let brierIntegration = null;
try {
  brierIntegration = require('./brier-integration.cjs');
} catch (e) { ... }
```

### Edge Calibration (Line 3798-3803)
```javascript
function getBrierEdgeCalibration(category) {
  if (!brierIntegration) return 1.0;
  return brierIntegration.getEdgeCalibration(category);
}
```

### Time Confidence by Category (Line 3753)
```javascript
// Different adjustments for weather/econ/crypto/politics
weather: +5% if <24h, +2% if <3d, -3% if >7d
economics: +3% if <7d, -2% if >30d
crypto: 0 (no adjustment)
politics: +4% if <14d, -1% otherwise
```

### Kelly Criterion (Line 3865)
```javascript
function calculateKelly(trueProb, price, bankroll = 10000) {
  // Uses CONFIG.kellyFraction (0.5 for half-Kelly)
  // Returns { kellyPct, position }
}
```

---

## 🎯 MISSING FEATURES TO IMPLEMENT

### 1. Calibration-Based Kelly Sizing
**Current**: Fixed `CONFIG.kellyFraction = 0.5`
**Needed**: Adjust Kelly by category MSEP
```javascript
// If Weather MSEP = 0.145, factor = 0.71
// If Crypto MSEP = 0.198, factor = 0.60
adjustedKelly = baseKelly * (1 - categoryMSEP * 2)
```

### 2. Dynamic Thresholds by Calibration
**Current**: Static thresholds in CONFIG
**Needed**: Category-specific thresholds
```javascript
weather: { minEdge: 8, minRScore: 5 }     // Well calibrated
crypto: { minEdge: 15, minRScore: 8 }     // Poorly calibrated
```

### 3. Correlation Avoidance
**Current**: None
**Needed**: Track historical outcome correlations, filter highly correlated trades

### 4. Market-Informed Prior
**Current**: Independent probability calculation
**Needed**: Bayesian update weighting our prediction vs market by historical accuracy

### 5. Fat-Tail Protection
**Current**: Soft cap at $500
**Needed**: Hard caps:
- Max 50% bankroll per position
- Max 20% bankroll per category per day

---

## 🗂️ RECOMMENDED FILE STRUCTURE

```
scripts/
├── kalshi-trade-fetcher-v2.cjs    (ACTIVE)
├── kalshi-resolution-fetcher.cjs  (ACTIVE)
├── brier-integration.cjs          (ACTIVE)
├── brier-tracker.cjs              (ACTIVE)
└── archive/                       (NEW FOLDER)
    ├── kalshi-trade-fetcher.js
    ├── kalshi-scanner-firebase.mjs
    ├── kalshi-scanner-with-brier.js
    └── init-v6.ts
```

---

## ✅ VERIFICATION CHECKLIST

- [x] GitHub Actions uses correct files (v2 + resolution fetcher)
- [x] Brier modules load without errors
- [x] v2 scanner outputs Brier metrics
- [x] Firebase integration present
- [x] Kalshi API authentication configured
- [ ] Legacy files archived (not deleted)
- [ ] Archive folder created

---

## 🚀 NEXT STEPS

1. **Archive legacy files** to `scripts/archive/`
2. **Implement calibration-based Kelly sizing**
3. **Add dynamic thresholds**
4. **Test full GitHub Actions workflow**
