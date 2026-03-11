# Brier Score Integration for Kalshi Scanner

## Summary of Research Papers

### 1. Brier Score Basics (Paper 3)
The **Brier Score** is defined as:
```
BS = (1/N) Σ(r_i - Y_i)²
```
Where:
- `r_i` = predicted probability (0-1)
- `Y_i` = actual outcome (0 or 1)
- Lower score = better calibration

### 2. Key Decomposition
Brier Score = MSEP + Variance

Where:
- **MSEP** (Mean Square Error for Probability): Measures prediction accuracy
- **Variance**: Inherent randomness in binary outcomes (not model's fault)

**MSEP = (1/N) Σ(r_i - p_i)²**

The papers show that focusing on MSEP (pure model performance) is better for comparing models than raw Brier score.

---

## Proposed Implementation for Kalshi Scanner

### 1. Brier Score Tracking Module

**Track for Each Trade:**
```javascript
{
  ticker: 'KXHIGHNY-26MAR11-T72',
  entryTime: '2026-03-12T10:00:00Z',
  closeTime: '2026-03-12T23:59:00Z',
  side: 'NO',
  entryPrice: 5,              // Market price (cents)
  marketProb: 0.05,           // 5¢ = 5% implied probability
  ourProb: 0.85,              // Our estimated true probability
  outcome: null,              // 0 or 1 (filled when resolved)
  brierScore: null,           // (ourProb - outcome)²
  edge: 0.80,                 // ourProb - marketProb
  category: 'weather',
  signals: ['fat_pitch', 'nws_lag']
}
```

**Brier Score Calculation:**
- For a resolved trade: `brierScore = (ourProb - outcome)²`
- Example: We predict 85% chance, outcome is 1 (YES): BS = (0.85 - 1)² = 0.0225 ✓
- Example: We predict 85% chance, outcome is 0 (NO): BS = (0.85 - 0)² = 0.7225 ✗

### 2. Rolling Brier Score Dashboard

**Track by Category:**
```javascript
brierMetrics: {
  weather: {
    totalTrades: 150,
    resolvedTrades: 120,
    avgBrier: 0.145,
    msep: 0.138,           // Adjusted for variance
    calibration: 'good'    // < 0.25 = good, < 0.15 = excellent
  },
  crypto: {
    totalTrades: 80,
    resolvedTrades: 65,
    avgBrier: 0.198,
    msep: 0.192
  },
  economics: {
    totalTrades: 45,
    resolvedTrades: 30,
    avgBrier: 0.156
  },
  politics: {
    totalTrades: 60,
    resolvedTrades: 45,
    avgBrier: 0.134
  }
}
```

### 3. Calibration Analysis

**Compare Predicted vs Actual:**
```javascript
calibrationBuckets: [
  { predictedRange: '0-10%', actualWinRate: 0.08, count: 25 },
  { predictedRange: '10-20%', actualWinRate: 0.15, count: 40 },
  { predictedRange: '20-30%', actualWinRate: 0.24, count: 35 },
  { predictedRange: '30-40%', actualWinRate: 0.38, count: 20 },
  { predictedRange: '40-50%', actualWinRate: 0.45, count: 15 },
  { predictedRange: '50-60%', actualWinRate: 0.52, count: 20 },
  { predictedRange: '60-70%', actualWinRate: 0.68, count: 25 },
  { predictedRange: '70-80%', actualWinRate: 0.75, count: 30 },
  { predictedRange: '80-90%', actualWinRate: 0.82, count: 35 },
  { predictedRange: '90-100%', actualWinRate: 0.91, count: 25 }
]
```

**Perfect calibration**: actualWinRate ≈ midpoint of predictedRange

### 4. Market vs Our Calibration

**Compare Kalshi market prices vs our predictions:**
```javascript
calibrationComparison: {
  // Kalshi market Brier scores
  marketBrier: {
    weather: 0.185,
    crypto: 0.220,
    economics: 0.165,
    politics: 0.145
  },
  // Our Brier scores
  ourBrier: {
    weather: 0.145,  // We beat market by 0.040
    crypto: 0.198,   // We beat market by 0.022
    economics: 0.156, // We lose to market by 0.009
    politics: 0.134   // We beat market by 0.011
  },
  // Edge validation
  edgeQuality: {
    highConfidence: { avgEdge: 0.25, actualEdge: 0.22 },
    mediumConfidence: { avgEdge: 0.15, actualEdge: 0.14 },
    lowConfidence: { avgEdge: 0.08, actualEdge: 0.07 }
  }
}
```

### 5. Brier Score in Scanner Output

**Add to Scanner Output:**
```javascript
{
  summary: {
    // ... existing fields
    brierScore: {
      last30Days: 0.152,
      last90Days: 0.168,
      byCategory: {
        weather: 0.145,
        crypto: 0.198,
        economics: 0.156,
        politics: 0.134
      }
    }
  },
  opportunities: [...],
  // ... existing fields
  brierAnalysis: {
    calibration: 'good',  // based on MSEP < 0.25
    trend: 'improving',   // last30 < last90
    bestCategory: 'politics',
    worstCategory: 'crypto',
    recommendations: [
      'Crypto edge calculations overestimate by ~4%',
      'Weather forecasts are well-calibrated',
      'Consider reducing position sizes in crypto'
    ]
  }
}
```

### 6. Edge Refinement via Brier Score

**Use Brier scores to tune edge calculation:**

```javascript
// Current edge calculation (simplified)
edge = (estimatedProb - marketPrice/100) * 100

// Brier-tuned edge
function calculateBrierTunedEdge(marketPrice, baseEdge, category, brierHistory) {
  const rawEdge = baseEdge;
  
  // Apply category-specific calibration factor
  const categoryCalibration = {
    weather: 0.95,    // Our weather predictions slightly overconfident
    crypto: 0.88,     // Crypto predictions significantly overconfident
    economics: 1.02,  // Econ predictions slightly underconfident
    politics: 0.98    // Politics well-calibrated
  };
  
  // Get calibration factor for this category
  const calibration = categoryCalibration[category] || 1.0;
  
  // Adjust edge
  const tunedEdge = rawEdge * calibration;
  
  return tunedEdge;
}
```

### 7. Confidence Score Based on Brier

**Add Brier-calibrated confidence:**
```javascript
confidence: {
  level: 'high',
  score: 78,
  brierContribution: 15,  // +15 points if category Brier < 0.15
  calibration: 'excellent'  // Based on historical Brier scores
}
```

---

## Implementation Plan

### Phase 1: Data Collection
1. Add `brierTracker` module to scanner
2. Store predictions for each opportunity
3. Fetch resolved market outcomes from Kalshi API
4. Calculate Brier scores for resolved markets

### Phase 2: Analysis
1. Build calibration curves by category
2. Calculate rolling Brier scores (30-day, 90-day)
3. Compare market Brier vs our Brier
4. Identify calibration biases

### Phase 3: Integration
1. Add Brier-based edge calibration
2. Add confidence boost for well-calibrated categories
3. Add Brier metrics to UI
4. Generate calibration recommendations

### Phase 4: Feedback Loop
1. Weekly recalibration of edge formulas
2. Monthly review of category calibration
3. Quarterly model updates based on Brier analysis

---

## Expected Benefits

1. **Objective Performance Metric**: Brier score gives us a single number to track prediction quality
2. **Calibration Detection**: Identify when we're overconfident or underconfident
3. **Category-Specific Tuning**: Different edge calculations for weather vs crypto
4. **Market Comparison**: Prove we beat the market's implied probabilities
5. **Risk Management**: Reduce position sizes in poorly-calibrated categories

---

## UI Components

### 1. Brier Score Card
```
┌─────────────────────────────────────────┐
│ 📊 Brier Score Analysis                 │
│                                         │
│ Overall: 0.152 (Good) 📈                │
│ Trend: Improving ↗️                     │
│                                         │
│ By Category:                            │
│ 🌤️ Weather: 0.145 ⭐                    │
│ 🪙 Crypto: 0.198 ⚠️ (Overconfident)     │
│ 📊 Econ: 0.156 ✅                       │
│ 🏛️ Politics: 0.134 ⭐⭐                  │
│                                         │
│ vs Market: Beat by 0.032 on avg 🎯      │
└─────────────────────────────────────────┘
```

### 2. Calibration Curve Chart
- X-axis: Predicted probability buckets (10% increments)
- Y-axis: Actual win rate
- Perfect calibration = diagonal line
- Show per-category calibration curves

### 3. Resolved Trades Table
- Show last 20 resolved trades
- Brier score for each
- Cumulative average
- Color-coded (green = good BS < 0.15, yellow = 0.15-0.25, red > 0.25)

---

## Technical Notes

### Storage
- Store prediction records in `kalshi_data/brier_predictions.json`
- Store resolved outcomes in `kalshi_data/brier_resolved.json`
- Calculate rolling metrics on each scan

### Kalshi API for Resolutions
- Fetch closed markets: `GET /markets?status=closed`
- Get outcome from market data: `market.result` ("yes" or "no")
- Match by ticker and close date

### Calculation Frequency
- Calculate Brier scores on each scan for newly resolved markets
- Update rolling averages daily
- Full recalibration weekly

---

## Next Steps

Want me to:
1. **Build the Brier tracking module** (Phase 1)?
2. **Add calibration analysis** (Phase 2)?
3. **Integrate into UI** (Phase 3)?
4. **Start with a specific category** (e.g., weather only)?

Which approach do you prefer?