# Brier Score Integration for Kalshi Scanner

## Overview

This module adds Brier score tracking to the Kalshi scanner to measure prediction calibration and accuracy.

**Brier Score**: `(predictedProb - actualOutcome)²`
- Lower is better (0 = perfect, 1 = worst)
- Measures how well our probability estimates match reality

## Files

| File | Purpose |
|------|---------|
| `brier-tracker.js` | Core Brier tracking module |
| `kalshi-resolution-fetcher.js` | Fetches market outcomes from Kalshi API |
| `brier-integration.js` | Integration layer for scanner |

## How It Works

1. **Recording Predictions**: When the scanner finds opportunities, it records:
   - Market ticker
   - Our estimated probability
   - Market implied probability
   - Signal type (fat_pitch, penny_pick, etc.)

2. **Resolving Predictions**: When markets close:
   - Fetch actual outcomes from Kalshi API
   - Calculate Brier score: `(ourProb - outcome)²`
   - Update rolling metrics

3. **Metrics Calculated**:
   - Overall Brier score
   - Brier by category (weather, crypto, politics, economics)
   - 30-day and 90-day rolling averages
   - MSEP (model performance metric)
   - Calibration buckets (predicted vs actual)

## Usage

### Automatic (Integrated)

The scanner now automatically records predictions and includes Brier analysis:

```bash
node scripts/kalshi-trade-fetcher-v2.cjs
```

### Manual Resolution

Resolve pending predictions (fetch outcomes from Kalshi):

```bash
# Batch mode (recommended)
node scripts/kalshi-resolution-fetcher.js

# Single mode
node scripts/kalshi-resolution-fetcher.js --single

# Look back 14 days
node scripts/kalshi-resolution-fetcher.js --days=14
```

### View Metrics

```bash
# View current metrics
node scripts/brier-tracker.js update

# View status
node scripts/brier-tracker.js status

# View via integration module
node scripts/brier-integration.js metrics
```

## Data Storage

Files stored in `kalshi_data/`:
- `brier_predictions.json` - All predictions (pending and resolved)
- `brier_resolved.json` - Resolved outcomes only
- `brier_metrics.json` - Calculated metrics

## Output Format

The scanner now includes a `brier` section in its output:

```json
{
  "scan_time": "2026-03-12T05:22:00Z",
  "opportunities": [...],
  "brier": {
    "enabled": true,
    "hasData": true,
    "calibration": "good",
    "trend": "improving",
    "overall": {
      "brier": 0.152,
      "msep": 0.138,
      "resolved": 120,
      "total": 150
    },
    "byCategory": {
      "weather": { "avgBrier": 0.145, "resolvedTrades": 45 },
      "crypto": { "avgBrier": 0.198, "resolvedTrades": 30 },
      "politics": { "avgBrier": 0.134, "resolvedTrades": 25 },
      "economics": { "avgBrier": 0.156, "resolvedTrades": 20 }
    },
    "recommendations": [
      "Crypto predictions are overconfident (Brier: 0.198)",
      "Weather forecasts are well-calibrated"
    ]
  }
}
```

## Calibration Quality

| Brier Score | Quality | Emoji |
|-------------|---------|-------|
| < 0.15 | Excellent | ⭐⭐ |
| < 0.20 | Good | ⭐ |
| < 0.25 | Fair | ✅ |
| ≥ 0.25 | Poor | ⚠️ |

## Edge Calibration

The system uses Brier scores to calibrate edge calculations:

```javascript
// If category has high Brier (overconfident), reduce edge
// If category has low Brier (underconfident), increase edge

const calibration = getEdgeCalibration('crypto');
// crypto Brier = 0.198 → calibration ≈ 0.88

const adjustedEdge = rawEdge * calibration;
```

## GitHub Actions Integration

Add to `.github/workflows/kalshi-scanner-firebase.yml`:

```yaml
# After scanner run, resolve predictions
- name: Resolve Brier Predictions
  run: node scripts/kalshi-resolution-fetcher.js
  env:
    KALSHI_ACCESS_KEY: ${{ secrets.KALSHI_ACCESS_KEY }}
```

Or run periodically:

```yaml
- name: Resolve Brier Predictions (cron)
  if: github.event.schedule == '0 */6 * * *'
  run: node scripts/kalshi-resolution-fetcher.js --days=1
  env:
    KALSHI_ACCESS_KEY: ${{ secrets.KALSHI_ACCESS_KEY }}
```

## Development

### Adding to a New Trade Type

```javascript
const { recordTradePrediction } = require('./brier-integration.js');

// When processing a trade
const trade = {
  ticker: 'KXHIGHNY-26MAR11-T72',
  category: 'weather',
  price: 5,
  // ... other fields
};

const ourProb = 0.85; // Your estimated probability
recordTradePrediction(trade, ourProb, 'my_signal_type');
```

### Testing

```bash
# Test Brier calculation
node -e "
const { calculateBrierScore } = require('./brier-tracker.js');
console.log('Brier (0.85, YES):', calculateBrierScore(0.85, 1)); // 0.0225
console.log('Brier (0.85, NO):', calculateBrierScore(0.85, 0));  // 0.7225
"
```

## Troubleshooting

### No Predictions Recording
- Check that `brier-integration.js` exists in `scripts/` folder
- Look for `✅ Brier score tracking enabled` in scanner output

### No Resolutions
- Ensure `KALSHI_ACCESS_KEY` is set
- Markets may not be closed yet (check close dates)
- Run resolution fetch with `--days=14` to look further back

### High Brier Scores
- High Brier indicates overconfidence
- Review edge calculation for that category
- Consider reducing confidence estimates

## References

- [Brier Score - Wikipedia](https://en.wikipedia.org/wiki/Brier_score)
- Yang et al. (2022) - Modified Brier score for binary outcomes
- Murphy (1973) - Decomposition of Brier score
