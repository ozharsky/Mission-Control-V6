#!/usr/bin/env node
/**
 * Kalshi Trade Fetcher v2.1 - Enhanced
 * Features: Time-based probability, market health metrics, liquidity filtering
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load Firebase if available
let db = null;
try {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getDatabase } = require('firebase-admin/database');
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com'
    });
    db = getDatabase();
    console.log('✅ Firebase connected');
  }
} catch (e) {
  console.log('⚠️ Firebase not available:', e.message);
}

// Series to monitor with research-based true probabilities
const SERIES = [
  { ticker: 'KXHIGHTSEA', name: 'Seattle High', category: 'weather', baseProb: 0.35 },
  { ticker: 'KXHIGHNY', name: 'NYC High', category: 'weather', baseProb: 0.40 },
  { ticker: 'KXHIGHCHI', name: 'Chicago High', category: 'weather', baseProb: 0.38 },
  { ticker: 'KXHIGHMIA', name: 'Miami High', category: 'weather', baseProb: 0.45 },
  { ticker: 'KXHIGHTPHX', name: 'Phoenix High', category: 'weather', baseProb: 0.42 },
  { ticker: 'KXBTC', name: 'Bitcoin', category: 'crypto', baseProb: 0.50 },
  { ticker: 'KXETH', name: 'Ethereum', category: 'crypto', baseProb: 0.50 },
  { ticker: 'KXSOL', name: 'Solana', category: 'crypto', baseProb: 0.48 },
  { ticker: 'KXADA', name: 'Cardano', category: 'crypto', baseProb: 0.47 },
  { ticker: 'KXDOT', name: 'Polkadot', category: 'crypto', baseProb: 0.46 },
  { ticker: 'KXTRUMP', name: 'Trump', category: 'politics', baseProb: 0.45 },
  { ticker: 'KXTRUTHSOCIAL', name: 'Trump Social', category: 'politics', baseProb: 0.30 },
  { ticker: 'KX538APPROVE', name: 'Approval Ratings', category: 'politics', baseProb: 0.42 },
  { ticker: 'KXTRUMPZELENSKYY', name: 'Trump-Zelenskyy', category: 'politics', baseProb: 0.35 },
  { ticker: 'KXTRUMPMEET', name: 'Trump Meetings', category: 'politics', baseProb: 0.40 },
  { ticker: 'KXFED', name: 'Fed Policy', category: 'economics', baseProb: 0.48 },
  { ticker: 'KXCPI', name: 'CPI Inflation', category: 'economics', baseProb: 0.45 },
  { ticker: 'KXJOBS', name: 'Jobs Report', category: 'economics', baseProb: 0.47 },
  { ticker: 'KXGDP', name: 'GDP Growth', category: 'economics', baseProb: 0.44 },
  { ticker: 'KXIR', name: 'Interest Rates', category: 'economics', baseProb: 0.46 }
];

const CONFIG = {
  minPrice: 1,
  maxPrice: 99,
  minVolume: 10,
  minEdge: 5,
  maxMarketsPerSeries: 10,
  requestDelay: 200,
  maxRetries: 3,
  minHoursToClose: 1,
  kellyFraction: 0.5,
  maxSpread: 10,
  minLiquidityScore: 20,
  whaleVolumeThreshold: 50000,
  whaleVolumeMultiplier: 3,
  historyRetentionDays: 7,
  // Cache TTLs (in milliseconds)
  cache: {
    rssTtl: 15 * 60 * 1000,        // 15 minutes
    nwsTtl: 60 * 60 * 1000,        // 1 hour
    polymarketTtl: 5 * 60 * 1000,  // 5 minutes
  },
  // Alert thresholds
  alerts: {
    edge: { min: 20, urgent: 30 },              // Edge % thresholds
    whale: { minMultiplier: 5, minVolume: 50000 }, // Whale activity
    arbitrage: { minSpread: 10 },               // Arbitrage spread %
    rScore: { min: 2.5 },                       // R-Score threshold
    priceChange: { min: 10 },                   // 24h price change %
    sentiment: { min: 0.5 },                    // Sentiment score threshold
    weatherLag: { minDiff: 15 }                 // Weather lag % difference
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load historical data for comparison
async function loadHistory() {
  try {
    if (db) {
      const snapshot = await db.ref('v6/kalshi/history').get();
      const data = snapshot.val() || {};
      // Convert sanitized keys back to original ticker format if needed
      // For now, tickers with dots are rare so we just return as-is
      return data;
    }
    // Try local file fallback (uses original ticker names)
    const historyPath = path.join(__dirname, '..', 'kalshi_data', 'price_history.json');
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
  } catch (e) {
    console.log('⚠️ Could not load history:', e.message);
  }
  return {};
}

// Sanitize ticker for Firebase key (replace invalid chars)
function sanitizeTicker(ticker) {
  return ticker.replace(/[.#$\[\]/]/g, '_');
}

// Simple memory cache with TTL
class MemoryCache {
  constructor() {
    this.cache = new Map();
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
  
  set(key, value, ttlMs) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
  
  getStats() {
    let valid = 0;
    let expired = 0;
    
    for (const [key, item] of this.cache) {
      if (Date.now() > item.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }
    
    return { valid, expired, total: this.cache.size };
  }
}

// Initialize cache
const cache = new MemoryCache();

// Alert Manager - track and deliver alerts
class AlertManager {
  constructor() {
    this.alerts = [];
    this.triggeredKeys = new Set(); // Track already-triggered alerts to avoid duplicates
  }
  
  checkThresholds(trades, polymarketArbs, weatherLags) {
    const newAlerts = [];
    
    for (const trade of trades) {
      // Edge threshold
      if (parseFloat(trade.edge) >= CONFIG.alerts.edge.urgent) {
        newAlerts.push(this.createAlert('edge', 'urgent', 
          `🔥 ${trade.ticker}: Edge ${trade.edge}% (threshold: ${CONFIG.alerts.edge.urgent}%)`,
          trade));
      } else if (parseFloat(trade.edge) >= CONFIG.alerts.edge.min) {
        newAlerts.push(this.createAlert('edge', 'high',
          `📈 ${trade.ticker}: Edge ${trade.edge}% (threshold: ${CONFIG.alerts.edge.min}%)`,
          trade));
      }
      
      // R-Score threshold
      if (parseFloat(trade.rScore) >= CONFIG.alerts.rScore.min) {
        newAlerts.push(this.createAlert('rScore', 'high',
          `⭐ ${trade.ticker}: R-Score ${trade.rScore} (threshold: ${CONFIG.alerts.rScore.min})`,
          trade));
      }
      
      // Whale activity threshold
      if (trade.whale && parseFloat(trade.whaleSpikeRatio) >= CONFIG.alerts.whale.minMultiplier) {
        newAlerts.push(this.createAlert('whale', 'high',
          `🐋 ${trade.ticker}: Whale activity ${trade.whaleSpikeRatio}x (threshold: ${CONFIG.alerts.whale.minMultiplier}x)`,
          trade));
      }
      
      // Price momentum threshold
      if (trade.momentum === 'surging' && Math.abs(parseFloat(trade.momentumChange24h)) >= CONFIG.alerts.priceChange.min) {
        newAlerts.push(this.createAlert('momentum', 'medium',
          `🚀 ${trade.ticker}: Surging +${trade.momentumChange24h}% in 24h`,
          trade));
      }
      
      // News sentiment threshold
      if (trade.sentimentSignal && Math.abs(trade.sentimentSignal.score) >= CONFIG.alerts.sentiment.min) {
        const direction = trade.sentimentSignal.score > 0 ? 'bullish' : 'bearish';
        newAlerts.push(this.createAlert('sentiment', 'medium',
          `📰 ${trade.ticker}: ${direction} news sentiment (${trade.sentimentSignal.score.toFixed(2)})`,
          trade));
      }
    }
    
    // Arbitrage alerts
    for (const arb of polymarketArbs) {
      if (parseFloat(arb.percentDiff) >= CONFIG.alerts.arbitrage.minSpread) {
        newAlerts.push(this.createAlert('arbitrage', 'urgent',
          `🔗 ARBITRAGE: ${arb.ticker} ${arb.percentDiff}% spread (Buy on ${arb.buyOn})`,
          null, arb));
      }
    }
    
    // Weather lag alerts
    for (const lag of weatherLags) {
      if (Math.abs(parseFloat(lag.probabilityDiff)) >= CONFIG.alerts.weatherLag.minDiff) {
        newAlerts.push(this.createAlert('weatherLag', 'high',
          `🌤️ WEATHER LAG: ${lag.city} ${lag.targetDate} - NWS ${lag.forecastHigh}°F vs Kalshi ${lag.kalshiProbability}% (${lag.probabilityDiff}% diff)`,
          null, null, lag));
      }
    }
    
    // Filter out duplicates
    const uniqueAlerts = newAlerts.filter(alert => {
      const key = `${alert.type}-${alert.ticker || alert.arb?.ticker || alert.lag?.city}`;
      if (this.triggeredKeys.has(key)) return false;
      this.triggeredKeys.add(key);
      return true;
    });
    
    this.alerts.push(...uniqueAlerts);
    return uniqueAlerts;
  }
  
  createAlert(type, severity, message, trade = null, arb = null, lag = null) {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      ticker: trade?.ticker || arb?.ticker,
      trade,
      arb,
      lag
    };
  }
  
  getUrgentAlerts() {
    return this.alerts.filter(a => a.severity === 'urgent');
  }
  
  getHighAlerts() {
    return this.alerts.filter(a => a.severity === 'high');
  }
  
  formatForDiscord() {
    const urgent = this.getUrgentAlerts();
    const high = this.getHighAlerts();
    
    let formatted = '';
    
    if (urgent.length > 0) {
      formatted += '## 🚨 URGENT ALERTS\n';
      urgent.forEach(a => formatted += `- ${a.message}\n`);
      formatted += '\n';
    }
    
    if (high.length > 0) {
      formatted += '## ⚠️ HIGH PRIORITY\n';
      high.slice(0, 5).forEach(a => formatted += `- ${a.message}\n`);
    }
    
    return formatted || null;
  }
  
  printSummary() {
    const urgent = this.getUrgentAlerts().length;
    const high = this.getHighAlerts().length;
    const medium = this.alerts.filter(a => a.severity === 'medium').length;
    
    if (this.alerts.length > 0) {
      console.log('\n🚨 ALERT SUMMARY:');
      if (urgent > 0) console.log(`  🔥 URGENT: ${urgent}`);
      if (high > 0) console.log(`  ⚠️ HIGH: ${high}`);
      if (medium > 0) console.log(`  ℹ️ MEDIUM: ${medium}`);
      
      console.log('\n📢 TOP ALERTS:');
      this.alerts.slice(0, 5).forEach(a => {
        const icon = a.severity === 'urgent' ? '🔥' : a.severity === 'high' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${a.message}`);
      });
    }
  }
}

// Edge Decay Tracker - track how edge changes over time
class EdgeDecayTracker {
  constructor() {
    this.edgeHistory = new Map(); // ticker -> [{timestamp, edge, rScore}]
    this.loadFromFile();
  }
  
  loadFromFile() {
    try {
      const filePath = path.join(__dirname, '..', 'kalshi_data', 'edge_history.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.edgeHistory = new Map(Object.entries(data));
        // Convert arrays back from plain objects
        for (const [key, value] of this.edgeHistory) {
          if (Array.isArray(value)) {
            this.edgeHistory.set(key, value);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Could not load edge history:', e.message);
    }
  }
  
  saveToFile() {
    try {
      const filePath = path.join(__dirname, '..', 'kalshi_data', 'edge_history.json');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const obj = Object.fromEntries(this.edgeHistory);
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.error('❌ Failed to save edge history:', e.message);
    }
  }
  
  recordEdge(ticker, edge, rScore, yesPrice) {
    if (!this.edgeHistory.has(ticker)) {
      this.edgeHistory.set(ticker, []);
    }
    
    const history = this.edgeHistory.get(ticker);
    history.push({
      timestamp: Date.now(),
      edge: parseFloat(edge),
      rScore: parseFloat(rScore),
      yesPrice
    });
    
    // Keep only last 30 days
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filtered = history.filter(h => h.timestamp > cutoff);
    this.edgeHistory.set(ticker, filtered);
  }
  
  // Calculate edge decay rate (% per day)
  calculateDecayRate(ticker, currentEdge) {
    const history = this.edgeHistory.get(ticker);
    if (!history || history.length < 2) return { decayRate: 0, trend: 'stable' };
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Get edges from 24h ago and 7 days ago
    const dayAgoEntry = history.find(h => h.timestamp > oneDayAgo);
    const weekAgoEntry = history.find(h => h.timestamp <= oneWeekAgo);
    
    if (!dayAgoEntry) return { decayRate: 0, trend: 'stable' };
    
    const edge24h = dayAgoEntry.edge;
    const edgeChange24h = currentEdge - edge24h;
    const decayRate24h = (edgeChange24h / edge24h) * 100;
    
    let trend = 'stable';
    if (decayRate24h < -10) trend = 'decaying_fast';
    else if (decayRate24h < -5) trend = 'decaying';
    else if (decayRate24h > 10) trend = 'improving_fast';
    else if (decayRate24h > 5) trend = 'improving';
    
    let weekTrend = null;
    let decayRateWeek = null;
    
    if (weekAgoEntry) {
      const edgeChangeWeek = currentEdge - weekAgoEntry.edge;
      decayRateWeek = (edgeChangeWeek / weekAgoEntry.edge) * 100;
      
      if (decayRateWeek < -20) weekTrend = 'strong_decay';
      else if (decayRateWeek > 20) weekTrend = 'strong_improvement';
    }
    
    return {
      decayRate: decayRate24h,
      trend,
      edge24hAgo: edge24h,
      edgeChange24h,
      decayRateWeek,
      weekTrend,
      entriesCount: history.length
    };
  }
  
  // Identify best opportunities based on decay trends
  rankByDecayStability(trades) {
    return trades.map(trade => {
      const decay = this.calculateDecayRate(trade.ticker, parseFloat(trade.edge));
      
      // Higher score = more stable/improving edge
      let stabilityScore = 0;
      
      if (decay.trend === 'improving_fast') stabilityScore = 2;
      else if (decay.trend === 'improving') stabilityScore = 1;
      else if (decay.trend === 'stable') stabilityScore = 0.5;
      else if (decay.trend === 'decaying') stabilityScore = -0.5;
      else if (decay.trend === 'decaying_fast') stabilityScore = -1;
      
      // Boost for long-term improvement
      if (decay.weekTrend === 'strong_improvement') stabilityScore += 1;
      else if (decay.weekTrend === 'strong_decay') stabilityScore -= 1;
      
      return {
        ...trade,
        decayAnalysis: decay,
        stabilityScore
      };
    }).sort((a, b) => b.stabilityScore - a.stabilityScore);
  }
  
  getDecayReport(trades) {
    const withDecay = this.rankByDecayStability(trades);
    
    const improving = withDecay.filter(t => t.stabilityScore > 0);
    const decaying = withDecay.filter(t => t.stabilityScore < 0);
    const stable = withDecay.filter(t => t.stabilityScore === 0);
    
    return {
      improving: improving.slice(0, 5),
      decaying: decaying.slice(0, 5),
      stable: stable.slice(0, 5),
      summary: {
        improving: improving.length,
        decaying: decaying.length,
        stable: stable.length
      }
    };
  }
  
  printDecayReport(trades) {
    const report = this.getDecayReport(trades);
    
    console.log('\n📊 EDGE DECAY ANALYSIS:');
    console.log(`  📈 Improving: ${report.summary.improving} | 📉 Decaying: ${report.summary.decaying} | ➡️ Stable: ${report.summary.stable}`);
    
    if (report.improving.length > 0) {
      console.log('\n  📈 TOP IMPROVING:');
      report.improving.slice(0, 3).forEach(t => {
        const change = t.decayAnalysis?.edgeChange24h ?? 0;
        console.log(`    ${t.ticker}: Edge ${t.edge}% (+${change.toFixed(1)}% in 24h)`);
      });
    }

    if (report.decaying.length > 0) {
      console.log('\n  ⚠️ FAST DECAYING (AVOID):');
      report.decaying.slice(0, 3).forEach(t => {
        const change = t.decayAnalysis?.edgeChange24h ?? 0;
        console.log(`    ${t.ticker}: Edge ${t.edge}% (${change.toFixed(1)}% in 24h)`);
      });
    }
  }
}

// Cross-Market Correlation Matrix (v3.0 #6)
// Tracks relationships between markets to identify correlated moves and divergences
class CrossMarketCorrelation {
  constructor() {
    this.correlationPairs = [
      // Weather correlations
      { pair: ['KXHIGHNY', 'KXHIGHCHI'], type: 'weather', name: 'NYC-Chicago Temps' },
      { pair: ['KXHIGHMIA', 'KXHIGHTPHX'], type: 'weather', name: 'Miami-Phoenix Heat' },
      { pair: ['KXHIGHTSEA', 'KXHIGHCHI'], type: 'weather', name: 'Seattle-Chicago' },
      // Crypto correlations
      { pair: ['KXBTC', 'KXETH'], type: 'crypto', name: 'BTC-ETH' },
      { pair: ['KXBTC', 'KXSOL'], type: 'crypto', name: 'BTC-SOL' },
      { pair: ['KXETH', 'KXSOL'], type: 'crypto', name: 'ETH-SOL' },
      { pair: ['KXADA', 'KXDOT'], type: 'crypto', name: 'ADA-DOT (Alts)' },
      // Politics correlations
      { pair: ['KXTRUMP', 'KX538APPROVE'], type: 'politics', name: 'Trump-Approval' },
      { pair: ['KXTRUMP', 'KXTRUTHSOCIAL'], type: 'politics', name: 'Trump-TruthSocial' },
      // Economics correlations
      { pair: ['KXFED', 'KXCPI'], type: 'economics', name: 'Fed-CPI' },
      { pair: ['KXFED', 'KXJOBS'], type: 'economics', name: 'Fed-Jobs' },
      { pair: ['KXCPI', 'KXJOBS'], type: 'economics', name: 'CPI-Jobs' }
    ];
    this.correlationHistory = new Map(); // Stores price movements for correlation calc
    this.minHistoryPoints = 5; // Minimum data points for correlation
  }

  // Record price movement for a ticker
  recordPrice(ticker, price) {
    if (!this.correlationHistory.has(ticker)) {
      this.correlationHistory.set(ticker, []);
    }
    const history = this.correlationHistory.get(ticker);
    history.push({ price, timestamp: Date.now() });
    // Keep last 100 points
    if (history.length > 100) history.shift();
  }

  // Calculate correlation coefficient between two price series (-1 to 1)
  calculateCorrelation(tickerA, tickerB) {
    const historyA = this.correlationHistory.get(tickerA) || [];
    const historyB = this.correlationHistory.get(tickerB) || [];

    if (historyA.length < this.minHistoryPoints || historyB.length < this.minHistoryPoints) {
      return null;
    }

    // Get common time window
    const minLen = Math.min(historyA.length, historyB.length);
    const pricesA = historyA.slice(-minLen).map(h => h.price);
    const pricesB = historyB.slice(-minLen).map(h => h.price);

    // Calculate returns (percentage changes)
    const returnsA = [];
    const returnsB = [];
    for (let i = 1; i < minLen; i++) {
      returnsA.push((pricesA[i] - pricesA[i-1]) / pricesA[i-1]);
      returnsB.push((pricesB[i] - pricesB[i-1]) / pricesB[i-1]);
    }

    // Calculate correlation coefficient
    const n = returnsA.length;
    const sumA = returnsA.reduce((a, b) => a + b, 0);
    const sumB = returnsB.reduce((a, b) => a + b, 0);
    const sumAB = returnsA.reduce((sum, a, i) => sum + a * returnsB[i], 0);
    const sumA2 = returnsA.reduce((sum, a) => sum + a * a, 0);
    const sumB2 = returnsB.reduce((sum, b) => sum + b * b, 0);

    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  // Analyze all correlation pairs
  analyzeCorrelations(trades) {
    // First, record current prices
    trades.forEach(t => this.recordPrice(t.ticker, t.yesPrice));

    const correlations = [];

    for (const { pair, type, name } of this.correlationPairs) {
      const tickerA = pair[0];
      const tickerB = pair[1];

      const tradeA = trades.find(t => t.ticker.startsWith(tickerA));
      const tradeB = trades.find(t => t.ticker.startsWith(tickerB));

      if (!tradeA || !tradeB) continue;

      const correlation = this.calculateCorrelation(tickerA, tickerB);
      if (correlation === null) continue;

      const strength = Math.abs(correlation);
      let signal = null;

      // Detect divergence signals
      if (strength > 0.7) {
        // Strong correlation - look for divergences
        const priceChangeA = tradeA.yesPrice - (tradeA.openPrice || tradeA.yesPrice);
        const priceChangeB = tradeB.yesPrice - (tradeB.openPrice || tradeB.yesPrice);

        if (priceChangeA > 5 && priceChangeB < -2) {
          signal = {
            type: 'divergence',
            direction: 'B_CONVERGES_UP',
            message: `${tradeB.ticker} may catch up to ${tradeA.ticker} rally`,
            confidence: strength
          };
        } else if (priceChangeA < -5 && priceChangeB > 2) {
          signal = {
            type: 'divergence',
            direction: 'B_CONVERGES_DOWN',
            message: `${tradeB.ticker} may drop to match ${tradeA.ticker}`,
            confidence: strength
          };
        }
      }

      correlations.push({
        pair: name,
        type,
        tickerA: tradeA.ticker,
        tickerB: tradeB.ticker,
        correlation: Math.round(correlation * 100) / 100,
        strength: strength > 0.7 ? 'strong' : strength > 0.4 ? 'moderate' : 'weak',
        direction: correlation > 0 ? 'positive' : 'negative',
        priceA: tradeA.yesPrice,
        priceB: tradeB.yesPrice,
        signal
      });
    }

    return correlations;
  }

  // Get trading signals from correlations
  getCorrelationSignals(correlations) {
    return correlations
      .filter(c => c.signal)
      .sort((a, b) => b.signal.confidence - a.signal.confidence);
  }

  printCorrelationReport(correlations) {
    if (correlations.length === 0) {
      console.log('\n📊 No correlation data available yet (need more price history)');
      return;
    }

    console.log('\n📊 CROSS-MARKET CORRELATION MATRIX:');

    // Group by type
    const byType = {};
    correlations.forEach(c => {
      if (!byType[c.type]) byType[c.type] = [];
      byType[c.type].push(c);
    });

    for (const [type, pairs] of Object.entries(byType)) {
      console.log(`\n  ${type.toUpperCase()}:`);
      pairs.forEach(c => {
        const emoji = c.strength === 'strong' ? '🔗' : c.strength === 'moderate' ? '~' : '•';
        const dirEmoji = c.direction === 'positive' ? '↗️' : '↘️';
        console.log(`    ${emoji} ${c.pair}: ${(c.correlation * 100).toFixed(0)}% ${dirEmoji} (${c.strength})`);
      });
    }

    // Print signals
    const signals = this.getCorrelationSignals(correlations);
    if (signals.length > 0) {
      console.log('\n  🎯 CORRELATION SIGNALS:');
      signals.forEach(s => {
        console.log(`    ${s.signal.type.toUpperCase()}: ${s.signal.message}`);
        console.log(`       Confidence: ${(s.signal.confidence * 100).toFixed(0)}% | ${s.tickerA}:${s.priceA}¢ vs ${s.tickerB}:${s.priceB}¢`);
      });
    }
  }
}

// Win Rate Analytics by Category/Time (v3.0 #7)
// Tracks historical performance to identify best categories and trading times
class WinRateAnalytics {
  constructor() {
    this.historyPath = path.join(__dirname, '..', 'kalshi_data', 'win_rate_history.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.historyPath)) {
        return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
      }
    } catch (e) {
      console.error('❌ Failed to load win rate data:', e.message);
    }
    return {
      trades: [], // { ticker, category, predictedEdge, timestamp, result, actualEdge }
      categoryStats: {},
      hourlyStats: {},
      dailyStats: {}
    };
  }

  saveData() {
    try {
      fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
      fs.writeFileSync(this.historyPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('❌ Failed to save win rate data:', e.message);
    }
  }

  // Record a trade opportunity for later outcome tracking
  recordTradeOpportunity(trade) {
    const record = {
      ticker: trade.ticker,
      category: trade.category,
      title: trade.title,
      yesPrice: trade.yesPrice,
      edge: parseFloat(trade.edge) || 0,
      rScore: parseFloat(trade.rScore) || 0,
      compositeScore: parseFloat(trade.compositeScore) || 0,
      timestamp: new Date().toISOString(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(), // 0-6 (Sun-Sat)
      month: new Date().getMonth(),
      result: null, // Will be updated later when market resolves
      actualReturn: null
    };

    // Don't duplicate if we already recorded this ticker today
    const today = new Date().toDateString();
    const existingToday = this.data.trades.find(t =>
      t.ticker === trade.ticker && new Date(t.timestamp).toDateString() === today
    );

    if (!existingToday) {
      this.data.trades.push(record);

      // Keep only last 1000 trades to prevent file bloat
      if (this.data.trades.length > 1000) {
        this.data.trades = this.data.trades.slice(-1000);
      }

      this.saveData();
    }
  }

  // Calculate win rate statistics from recorded trades
  calculateStats() {
    const trades = this.data.trades.filter(t => t.result !== null);

    if (trades.length === 0) {
      return null;
    }

    // Category stats
    const categoryStats = {};
    const byCategory = this.groupBy(trades, 'category');

    for (const [cat, catTrades] of Object.entries(byCategory)) {
      categoryStats[cat] = this.calculateWinStats(catTrades);
    }

    // Hourly stats
    const hourlyStats = {};
    const byHour = this.groupBy(trades, 'hour');

    for (let hour = 0; hour < 24; hour++) {
      const hourTrades = byHour[hour] || [];
      if (hourTrades.length > 0) {
        hourlyStats[hour] = this.calculateWinStats(hourTrades);
      }
    }

    // Day of week stats
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyStats = {};
    const byDay = this.groupBy(trades, 'dayOfWeek');

    for (let day = 0; day < 7; day++) {
      const dayTrades = byDay[day] || [];
      if (dayTrades.length > 0) {
        dailyStats[dayNames[day]] = this.calculateWinStats(dayTrades);
      }
    }

    // Edge accuracy: compare predicted vs actual
    const edgeAccuracy = this.calculateEdgeAccuracy(trades);

    return {
      totalTrades: trades.length,
      overallWinRate: this.calculateWinStats(trades),
      categoryStats,
      hourlyStats,
      dailyStats,
      edgeAccuracy,
      bestCategory: this.findBest(categoryStats, 'winRate'),
      bestHour: this.findBest(hourlyStats, 'winRate'),
      bestDay: this.findBest(dailyStats, 'winRate'),
      sampleSizeWarning: trades.length < 30 ? 'Limited data - results may not be statistically significant' : null
    };
  }

  calculateWinStats(trades) {
    const wins = trades.filter(t => t.result === 'win').length;
    const losses = trades.filter(t => t.result === 'loss').length;
    const total = wins + losses;

    const avgPredictedEdge = trades.reduce((sum, t) => sum + (t.edge || 0), 0) / trades.length;
    const avgActualReturn = trades
      .filter(t => t.actualReturn !== null)
      .reduce((sum, t) => sum + (t.actualReturn || 0), 0) /
      trades.filter(t => t.actualReturn !== null).length || 0;

    return {
      wins,
      losses,
      total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      avgPredictedEdge: Math.round(avgPredictedEdge * 100) / 100,
      avgActualReturn: Math.round(avgActualReturn * 100) / 100,
      profitFactor: this.calculateProfitFactor(trades),
      sharpe: this.calculateSharpe(trades)
    };
  }

  calculateProfitFactor(trades) {
    const grossProfit = trades
      .filter(t => t.actualReturn > 0)
      .reduce((sum, t) => sum + (t.actualReturn || 0), 0);
    const grossLoss = Math.abs(trades
      .filter(t => t.actualReturn < 0)
      .reduce((sum, t) => sum + (t.actualReturn || 0), 0));

    return grossLoss === 0 ? grossProfit : Math.round((grossProfit / grossLoss) * 100) / 100;
  }

  calculateSharpe(trades) {
    const returns = trades.filter(t => t.actualReturn !== null).map(t => t.actualReturn);
    if (returns.length < 2) return 0;

    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : Math.round((avg / stdDev) * 100) / 100;
  }

  calculateEdgeAccuracy(trades) {
    const withResults = trades.filter(t => t.actualReturn !== null);
    if (withResults.length === 0) return null;

    // Compare predicted edge (as probability) vs actual outcome
    let accuratePredictions = 0;
    let highEdgeWins = 0;
    let highEdgeTotal = 0;

    withResults.forEach(t => {
      const predictedProb = 0.5 + (t.edge / 200); // Convert edge % to probability
      const actualWin = t.actualReturn > 0;

      // Prediction was correct if:
      // - Predicted > 50% and won, OR
      // - Predicted < 50% and lost
      const predictedWin = predictedProb > 0.5;
      if (predictedWin === actualWin) {
        accuratePredictions++;
      }

      // Track high edge (>10%) accuracy
      if (t.edge >= 10) {
        highEdgeTotal++;
        if (actualWin) highEdgeWins++;
      }
    });

    return {
      overallAccuracy: Math.round((accuratePredictions / withResults.length) * 100),
      highEdgeWinRate: highEdgeTotal > 0 ? Math.round((highEdgeWins / highEdgeTotal) * 100) : null,
      highEdgeSampleSize: highEdgeTotal,
      totalSampleSize: withResults.length
    };
  }

  groupBy(array, key) {
    return array.reduce((result, item) => {
      const group = item[key];
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {});
  }

  findBest(stats, metric) {
    let best = null;
    let bestValue = -Infinity;

    for (const [key, value] of Object.entries(stats)) {
      if (value[metric] > bestValue && value.total >= 5) { // Minimum 5 samples
        bestValue = value[metric];
        best = { key, ...value };
      }
    }

    return best;
  }

  printReport() {
    const stats = this.calculateStats();

    if (!stats) {
      console.log('\n📈 WIN RATE ANALYTICS: No historical results data yet');
      console.log('  (Results tracking requires paper trading or resolved markets)');
      return;
    }

    console.log('\n📈 WIN RATE ANALYTICS:');
    console.log(`  Overall: ${stats.overallWinRate.winRate}% (${stats.overallWinRate.wins}W/${stats.overallWinRate.losses}L, n=${stats.totalTrades})`);

    if (stats.sampleSizeWarning) {
      console.log(`  ⚠️  ${stats.sampleSizeWarning}`);
    }

    // Category breakdown
    console.log('\n  By Category:');
    for (const [cat, stat] of Object.entries(stats.categoryStats)) {
      const emoji = cat === 'weather' ? '🌤️' : cat === 'crypto' ? '₿' : cat === 'politics' ? '🗳️' : '📊';
      console.log(`    ${emoji} ${cat}: ${stat.winRate}% (${stat.wins}W/${stat.losses}L) | Avg Edge: ${stat.avgPredictedEdge}%`);
    }

    // Best hour
    if (stats.bestHour) {
      const hour = stats.bestHour.key;
      const hourFormatted = hour >= 12 ? `${hour === 12 ? 12 : hour - 12}PM` : `${hour === 0 ? 12 : hour}AM`;
      console.log(`\n  ⏰ Best Time: ${hourFormatted} ET (${stats.bestHour.winRate}% win rate)`);
    }

    // Best day
    if (stats.bestDay) {
      console.log(`  📅 Best Day: ${stats.bestDay.key} (${stats.bestDay.winRate}% win rate)`);
    }

    // Edge accuracy
    if (stats.edgeAccuracy) {
      console.log(`\n  🎯 Edge Accuracy: ${stats.edgeAccuracy.overallAccuracy}% of predictions correct`);
      if (stats.edgeAccuracy.highEdgeWinRate !== null) {
        console.log(`  🔥 High Edge (>10%) Win Rate: ${stats.edgeAccuracy.highEdgeWinRate}% (${stats.edgeAccuracy.highEdgeSampleSize} trades)`);
      }
    }

    // Current session stats
    const today = new Date().toDateString();
    const todayTrades = this.data.trades.filter(t =>
      new Date(t.timestamp).toDateString() === today
    );
    if (todayTrades.length > 0) {
      console.log(`\n  📊 Today's Opportunities: ${todayTrades.length} tracked`);
    }
  }

  // Get recommendations based on historical performance
  getRecommendations() {
    const stats = this.calculateStats();
    if (!stats) return [];

    const recommendations = [];

    if (stats.bestCategory && stats.bestCategory.winRate > 60) {
      recommendations.push({
        type: 'category_focus',
        message: `Focus on ${stats.bestCategory.key} markets (${stats.bestCategory.winRate}% historical win rate)`,
        priority: 'high'
      });
    }

    if (stats.bestHour && stats.bestHour.winRate > 60) {
      recommendations.push({
        type: 'timing',
        message: `Best trading window: ${stats.bestHour.key}:00 (${stats.bestHour.winRate}% win rate)`,
        priority: 'medium'
      });
    }

    if (stats.edgeAccuracy && stats.edgeAccuracy.highEdgeWinRate > 70) {
      recommendations.push({
        type: 'edge_threshold',
        message: `High edge trades (>10%) have ${stats.edgeAccuracy.highEdgeWinRate}% win rate - prioritize these`,
        priority: 'high'
      });
    }

    return recommendations;
  }
}

// Twitter/X Sentiment Analysis (v3.0 #8)
// Fetches and analyzes social media sentiment for market-moving keywords
class TwitterSentimentAnalyzer {
  constructor() {
    // Keywords to track by category
    this.keywords = {
      crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'cardano', 'ada', 'crypto', 'cryptocurrency'],
      weather: ['weather', 'forecast', 'temperature', 'heat wave', 'cold snap', 'nyc weather', 'chicago weather'],
      politics: ['trump', 'biden', 'election', 'president', 'approval rating', 'zelenskyy', 'truth social'],
      economics: ['fed', 'federal reserve', 'cpi', 'inflation', 'jobs report', 'gdp', 'interest rates', 'fomc']
    };

    // Keyword-to-category mapping for quick lookup
    this.keywordToCategory = {};
    for (const [cat, words] of Object.entries(this.keywords)) {
      words.forEach(word => this.keywordToCategory[word.toLowerCase()] = cat);
    }

    // Bearer token for Twitter API (from env or null for fallback)
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN || null;

    // Sentiment keywords for scoring
    this.sentimentWords = {
      positive: ['bullish', 'moon', 'pump', 'surge', 'rally', 'breakout', ' ATH', 'all time high', 'strong', 'buy', 'accumulate', 'support'],
      negative: ['bearish', 'dump', 'crash', 'plunge', 'collapse', 'correction', 'weak', 'sell', 'short', 'resistance', 'fear', 'panic'],
      uncertainty: ['uncertain', 'volatile', 'unclear', 'wait', 'cautious', 'sidelines', 'chop', 'range bound']
    };

    // Cache for rate limiting
    this.cachePath = path.join(__dirname, '..', 'kalshi_data', 'twitter_cache.json');
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        // Filter out entries older than 15 minutes
        const cutoff = Date.now() - (15 * 60 * 1000);
        return Object.fromEntries(
          Object.entries(data).filter(([_, v]) => v.timestamp > cutoff)
        );
      }
    } catch (e) {
      console.error('❌ Failed to load Twitter cache:', e.message);
    }
    return {};
  }

  saveCache() {
    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      console.error('❌ Failed to save Twitter cache:', e.message);
    }
  }

  // Fetch tweets using Twitter API v2 (requires bearer token)
  async fetchTweetsWithAPI(query, maxResults = 10) {
    if (!this.bearerToken) {
      return null;
    }

    try {
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}&tweet.fields=created_at,public_metrics,author_id`;

      const response = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error('Invalid JSON'));
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        }).on('error', reject);
      });

      return response.data || [];
    } catch (e) {
      console.error(`⚠️  Twitter API error: ${e.message}`);
      return null;
    }
  }

  // Fallback: Generate synthetic sentiment from RSS/news data when Twitter API unavailable
  async fetchFallbackSentiment() {
    console.log('  📝 Using RSS/news as fallback for social sentiment');
    return null; // Will be populated from RSS data later
  }

  // Analyze sentiment of a text
  analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    let score = 0;
    let wordCount = 0;

    // Count positive words
    this.sentimentWords.positive.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      score += count * 1;
      wordCount += count;
    });

    // Count negative words
    this.sentimentWords.negative.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      score -= count * 1;
      wordCount += count;
    });

    // Uncertainty reduces confidence
    let uncertainty = 0;
    this.sentimentWords.uncertainty.forEach(word => {
      const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
      uncertainty += count * 0.5;
    });

    // Normalize to -1 to +1 range
    const normalizedScore = wordCount > 0 ? score / Math.sqrt(wordCount) : 0;
    const confidence = Math.min(1, wordCount / 5 + uncertainty / 10);

    return {
      score: Math.max(-1, Math.min(1, normalizedScore)),
      confidence: confidence,
      wordCount,
      magnitude: Math.abs(normalizedScore)
    };
  }

  // Match keywords to a trade
  matchKeywordsToTrade(trade) {
    const matches = [];
    const text = `${trade.title} ${trade.subtitle || ''} ${trade.category}`.toLowerCase();

    for (const [keyword, category] of Object.entries(this.keywordToCategory)) {
      if (text.includes(keyword)) {
        matches.push({ keyword, category });
      }
    }

    // Also check if trade category matches
    if (this.keywords[trade.category]) {
      matches.push(...this.keywords[trade.category].map(k => ({ keyword: k, category: trade.category })));
    }

    return [...new Map(matches.map(m => [m.keyword, m])).values()]; // Deduplicate
  }

  // Fetch sentiment for all categories
  async fetchCategorySentiment() {
    const results = {};

    // Check cache first
    if (this.cache.categorySentiment && Date.now() - this.cache.categorySentiment.timestamp < 15 * 60 * 1000) {
      console.log('  💾 Using cached Twitter sentiment');
      return this.cache.categorySentiment.data;
    }

    console.log('\n🐦 Fetching Twitter/X sentiment...');

    // Try API first
    if (this.bearerToken) {
      for (const [category, keywords] of Object.entries(this.keywords)) {
        const query = keywords.join(' OR ') + ' -is:retweet lang:en';
        const tweets = await this.fetchTweetsWithAPI(query, 10);

        if (tweets && tweets.length > 0) {
          const sentiments = tweets.map(t => this.analyzeSentiment(t.text));
          const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
          const avgConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;

          results[category] = {
            score: Math.round(avgScore * 100) / 100,
            confidence: Math.round(avgConfidence * 100) / 100,
            tweetCount: tweets.length,
            sampleTweets: tweets.slice(0, 3).map(t => t.text.substring(0, 100)),
            source: 'twitter_api'
          };
        }
      }
    }

    // If no API results, we'll use RSS/news as fallback
    if (Object.keys(results).length === 0) {
      console.log('  ⚠️  Twitter API unavailable - will use news sentiment as proxy');
      results.fallback = true;
    }

    // Cache results
    this.cache.categorySentiment = {
      timestamp: Date.now(),
      data: results
    };
    this.saveCache();

    return results;
  }

  // Calculate sentiment signal for a specific trade
  calculateTradeSentiment(trade, categorySentiment, relevantNews) {
    const matches = this.matchKeywordsToTrade(trade);

    if (matches.length === 0) return null;

    // Use Twitter sentiment if available
    let sentiment = null;
    let source = 'none';

    if (categorySentiment[trade.category] && !categorySentiment.fallback) {
      sentiment = categorySentiment[trade.category];
      source = 'twitter';
    }
    // Fall back to relevant news sentiment
    else if (relevantNews && relevantNews.length > 0) {
      const tradeNews = relevantNews.filter(n =>
        matches.some(m => 
          (n.title?.toLowerCase() || '').includes(m.keyword) || 
          (n.summary?.toLowerCase() || '').includes(m.keyword)
        )
      );

      if (tradeNews.length > 0) {
        const avgNewsSentiment = tradeNews.reduce((sum, n) => sum + n.sentiment, 0) / tradeNews.length;
        sentiment = {
          score: avgNewsSentiment,
          confidence: Math.min(1, tradeNews.length / 3),
          tweetCount: tradeNews.length,
          source: 'news_proxy'
        };
        source = 'news';
      }
    }

    if (!sentiment) return null;

    // Determine signal strength
    let signal = 'neutral';
    let strength = 'weak';

    if (sentiment.score > 0.3) {
      signal = 'bullish';
      strength = sentiment.score > 0.6 ? 'strong' : 'moderate';
    } else if (sentiment.score < -0.3) {
      signal = 'bearish';
      strength = sentiment.score < -0.6 ? 'strong' : 'moderate';
    }

    // Calculate social score impact (0-10)
    const socialScore = (sentiment.score + 1) * 5; // Convert -1..1 to 0..10

    return {
      score: sentiment.score,
      confidence: sentiment.confidence,
      signal,
      strength,
      socialScore: Math.round(socialScore * 10) / 10,
      source,
      matchedKeywords: matches.map(m => m.keyword),
      sampleData: sentiment.sampleTweets || sentiment.tweetCount
    };
  }

  printReport(categorySentiment) {
    console.log('\n🐦 SOCIAL SENTIMENT ANALYSIS:');

    if (categorySentiment.fallback) {
      console.log('  ⚠️  Twitter API unavailable - using news sentiment as proxy');
      return;
    }

    for (const [category, data] of Object.entries(categorySentiment)) {
      if (category === 'fallback') continue;

      const emoji = data.score > 0.2 ? '📈' : data.score < -0.2 ? '📉' : '➡️';
      const sentimentLabel = data.score > 0.2 ? 'BULLISH' : data.score < -0.2 ? 'BEARISH' : 'NEUTRAL';

      console.log(`  ${emoji} ${category.toUpperCase()}: ${sentimentLabel} (${data.score > 0 ? '+' : ''}${data.score}) | ${data.tweetCount} tweets | ${Math.round(data.confidence * 100)}% confidence`);

      // Show sample tweets
      if (data.sampleTweets && data.sampleTweets.length > 0) {
        data.sampleTweets.forEach((tweet, i) => {
          console.log(`     ${i + 1}. "${tweet.substring(0, 60)}${tweet.length > 60 ? '...' : ''}"`);
        });
      }
    }
  }
}

// Backtesting Framework (v3.0 #9)
// Historical simulation engine to test trading strategies
class BacktestingFramework {
  constructor() {
    this.resultsPath = path.join(__dirname, '..', 'kalshi_data', 'backtest_results.json');
    this.tradesPath = path.join(__dirname, '..', 'kalshi_data', 'win_rate_history.json');
  }

  // Load historical trade data
  loadHistoricalData() {
    try {
      if (fs.existsSync(this.tradesPath)) {
        const data = JSON.parse(fs.readFileSync(this.tradesPath, 'utf8'));
        return data.trades || [];
      }
    } catch (e) {
      console.error('❌ Failed to load historical data:', e.message);
    }
    return [];
  }

  // Strategy definitions
  getStrategies() {
    return {
      // Strategy 1: Buy everything with R-Score > 2.0
      highRScore: {
        name: 'High R-Score Strategy',
        description: 'Buy all trades with R-Score > 2.0',
        filter: (trade) => parseFloat(trade.rScore) > 2.0,
        positionSizing: 'kelly_half'
      },

      // Strategy 2: Only high edge (>15%) with good liquidity
      highEdge: {
        name: 'High Edge + Liquidity',
        description: 'Buy trades with edge > 15% and volume > 10k',
        filter: (trade) => parseFloat(trade.edge) > 15 && (trade.volume || 0) > 10000,
        positionSizing: 'fixed_100'
      },

      // Strategy 3: Multi-factor score > 7.0
      multiFactor: {
        name: 'Multi-Factor Elite',
        description: 'Buy trades with multi-factor score > 7.0',
        filter: (trade) => trade.multiFactorScore && trade.multiFactorScore.total > 7.0,
        positionSizing: 'kelly_full'
      },

      // Strategy 4: Whale follow (high volume spike)
      whaleFollow: {
        name: 'Follow the Whales',
        description: 'Buy when whale activity detected (>3x volume)',
        filter: (trade) => trade.whale === true && parseFloat(trade.whaleSpikeRatio) > 3,
        positionSizing: 'fixed_50'
      },

      // Strategy 5: Combined - High edge + stable decay + whale
      combined: {
        name: 'Combined Quality',
        description: 'Edge > 10%, not deteriorating, whale or high volume',
        filter: (trade) => {
          const edge = parseFloat(trade.edge) || 0;
          const deteriorating = trade.isEdgeDeteriorating;
          const whale = trade.whale;
          const volume = trade.volume || 0;
          return edge > 10 && !deteriorating && (whale || volume > 20000);
        },
        positionSizing: 'kelly_half'
      }
    };
  }

  // Run backtest on historical data
  runBacktest(strategyName, historicalTrades = null) {
    const strategies = this.getStrategies();
    const strategy = strategies[strategyName];

    if (!strategy) {
      return { error: `Unknown strategy: ${strategyName}` };
    }

    const trades = historicalTrades || this.loadHistoricalData();

    if (trades.length === 0) {
      return {
        strategy: strategy.name,
        description: strategy.description,
        error: 'No historical data available for backtesting',
        tradesAnalyzed: 0
      };
    }

    // Filter trades that match strategy
    const matchedTrades = trades.filter(strategy.filter);

    if (matchedTrades.length === 0) {
      return {
        strategy: strategy.name,
        description: strategy.description,
        tradesAnalyzed: trades.length,
        matchedTrades: 0,
        message: 'No trades matched strategy criteria'
      };
    }

    // Simulate trades (using actual results if available, otherwise estimate)
    const simulatedTrades = matchedTrades.map(t => this.simulateTrade(t, strategy.positionSizing));

    // Calculate performance metrics
    const wins = simulatedTrades.filter(t => t.result === 'win');
    const losses = simulatedTrades.filter(t => t.result === 'loss');
    const pending = simulatedTrades.filter(t => t.result === 'pending');

    const totalPnl = simulatedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = wins.length / (wins.length + losses.length) * 100;

    // Calculate drawdown
    const drawdown = this.calculateDrawdown(simulatedTrades);

    // Calculate Sharpe ratio (simplified)
    const returns = simulatedTrades.filter(t => t.pnl !== undefined).map(t => t.pnl);
    const sharpe = this.calculateSharpeRatio(returns);

    // Calculate by category
    const byCategory = {};
    simulatedTrades.forEach(t => {
      const cat = t.category || 'unknown';
      if (!byCategory[cat]) byCategory[cat] = { wins: 0, losses: 0, pnl: 0 };
      if (t.result === 'win') byCategory[cat].wins++;
      if (t.result === 'loss') byCategory[cat].losses++;
      byCategory[cat].pnl += t.pnl || 0;
    });

    return {
      strategy: strategy.name,
      description: strategy.description,
      tradesAnalyzed: trades.length,
      matchedTrades: matchedTrades.length,
      simulatedTrades: simulatedTrades.length,
      results: {
        wins: wins.length,
        losses: losses.length,
        pending: pending.length,
        winRate: Math.round(winRate * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgPnl: Math.round((totalPnl / simulatedTrades.length) * 100) / 100,
        maxDrawdown: Math.round(drawdown.max * 100) / 100,
        sharpeRatio: Math.round(sharpe * 100) / 100,
        profitFactor: this.calculateProfitFactor(simulatedTrades)
      },
      byCategory,
      positionSizing: strategy.positionSizing,
      sampleTrades: simulatedTrades.slice(0, 5).map(t => ({
        ticker: t.ticker,
        result: t.result,
        pnl: Math.round(t.pnl * 100) / 100,
        edge: t.edge,
        rScore: t.rScore
      }))
    };
  }

  // Simulate a single trade outcome
  simulateTrade(trade, positionSizing) {
    // If we have actual results, use them
    if (trade.result) {
      return {
        ...trade,
        simulated: false,
        pnl: trade.actualReturn || 0
      };
    }

    // Otherwise, estimate based on edge and R-score
    const edge = parseFloat(trade.edge) || 0;
    const rScore = parseFloat(trade.rScore) || 0;

    // Simulate win probability based on edge
    const winProbability = 0.5 + (edge / 200); // Edge 10% = 55% win prob

    // Determine position size
    let position = 100; // Default $100
    if (positionSizing === 'kelly_half') {
      position = this.calculateKellyPosition(edge, 0.5);
    } else if (positionSizing === 'kelly_full') {
      position = this.calculateKellyPosition(edge, 1.0);
    } else if (positionSizing === 'fixed_50') {
      position = 50;
    } else if (positionSizing === 'fixed_100') {
      position = 100;
    }

    // Simulate outcome (random based on probability)
    const won = Math.random() < winProbability;
    const payout = won ? position * (edge / 100) : -position;

    return {
      ...trade,
      simulated: true,
      result: won ? 'win' : 'loss',
      pnl: payout,
      position,
      winProbability: Math.round(winProbability * 100) / 100
    };
  }

  // Calculate Kelly criterion position size
  calculateKellyPosition(edge, fraction = 0.5) {
    const winProb = 0.5 + (edge / 200);
    const lossProb = 1 - winProb;
    const winAmount = edge / 100;
    const lossAmount = 1;

    // Kelly = (winProb * winAmount - lossProb * lossAmount) / winAmount
    const kelly = (winProb * winAmount - lossProb * lossAmount) / winAmount;
    const halfKelly = Math.max(0, kelly * fraction);

    // Convert to dollar amount (capped at $500)
    return Math.min(500, Math.max(10, halfKelly * 1000));
  }

  // Calculate maximum drawdown
  calculateDrawdown(trades) {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnl = 0;

    trades.forEach(t => {
      runningPnl += t.pnl || 0;
      if (runningPnl > peak) peak = runningPnl;
      const drawdown = peak - runningPnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    return {
      max: maxDrawdown,
      finalPnl: runningPnl
    };
  }

  // Calculate Sharpe ratio
  calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;

    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : avg / stdDev;
  }

  // Calculate profit factor
  calculateProfitFactor(trades) {
    const grossProfit = trades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(trades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0));

    return grossLoss === 0 ? grossProfit : Math.round((grossProfit / grossLoss) * 100) / 100;
  }

  // Run all strategies and compare
  runAllStrategies() {
    const strategies = this.getStrategies();
    const results = {};

    console.log('\n📊 RUNNING BACKTEST SIMULATIONS...');
    console.log('  (Note: Results use historical data + simulated outcomes for pending trades)');

    for (const [key, strategy] of Object.entries(strategies)) {
      console.log(`\n  Testing: ${strategy.name}...`);
      results[key] = this.runBacktest(key);
    }

    return results;
  }

  // Print comparison report
  printComparisonReport(results) {
    console.log('\n📊 BACKTEST RESULTS COMPARISON:');
    console.log('  Strategy                 | Win Rate | P&L    | Trades | Sharpe | Max DD');
    console.log('  ' + '-'.repeat(75));

    const sorted = Object.entries(results)
      .filter(([_, r]) => !r.error)
      .sort((a, b) => (b[1].results?.totalPnl || 0) - (a[1].results?.totalPnl || 0));

    sorted.forEach(([key, result]) => {
      if (result.error) return;

      const r = result.results;
      const name = result.strategy.padEnd(24);
      const winRate = `${r.winRate.toFixed(1)}%`.padEnd(8);
      const pnl = (r.totalPnl >= 0 ? '+' : '') + `$${r.totalPnl.toFixed(0)}`.padEnd(6);
      const trades = `${r.wins + r.losses}`.padEnd(6);
      const sharpe = r.sharpeRatio.toFixed(2).padEnd(6);
      const drawdown = `$${r.maxDrawdown.toFixed(0)}`.padEnd(6);

      console.log(`  ${name} | ${winRate} | ${pnl} | ${trades} | ${sharpe} | ${drawdown}`);
    });

    // Show best strategy
    if (sorted.length > 0) {
      const best = sorted[0][1];
      console.log(`\n  🏆 BEST STRATEGY: ${best.strategy}`);
      console.log(`     ${best.description}`);
      console.log(`     Win Rate: ${best.results.winRate}% | Total P&L: $${best.results.totalPnl}`);
    }
  }
}

// Portfolio Heat Map (v3.0 #10)
// Visualizes portfolio risk through concentration, correlation, and exposure analysis
class PortfolioHeatMap {
  constructor(bankroll = 10000) {
    this.bankroll = bankroll;
    this.categoryColors = {
      weather: { r: 59, g: 130, b: 246 },    // Blue
      crypto: { r: 249, g: 115, b: 22 },     // Orange
      politics: { r: 239, g: 68, b: 68 },    // Red
      economics: { r: 34, g: 197, b: 94 },   // Green
      unknown: { r: 156, g: 163, b: 175 }    // Gray
    };
  }

  // Analyze current positions and opportunities
  analyzePortfolio(positions, opportunities) {
    const analysis = {
      timestamp: new Date().toISOString(),
      bankroll: this.bankroll,
      totalExposure: 0,
      concentration: {},
      correlationRisk: [],
      heatMap: [],
      riskScore: 0,
      warnings: []
    };

    // Calculate total exposure and concentration by category
    const categoryExposure = {
      weather: 0,
      crypto: 0,
      politics: 0,
      economics: 0,
      unknown: 0
    };

    // Analyze open positions
    const openPositions = positions.filter(p => p.status === 'open');
    openPositions.forEach(pos => {
      const opp = opportunities.find(o => o.ticker === pos.ticker);
      if (opp) {
        const category = opp.category || 'unknown';
        const value = pos.value || 0;
        categoryExposure[category] += value;
        analysis.totalExposure += value;
      }
    });

    // Calculate concentration percentages
    for (const [cat, exposure] of Object.entries(categoryExposure)) {
      const percentage = this.bankroll > 0 ? (exposure / this.bankroll) * 100 : 0;
      analysis.concentration[cat] = {
        exposure,
        percentage: Math.round(percentage * 100) / 100,
        riskLevel: this.getConcentrationRiskLevel(percentage)
      };
    }

    // Calculate correlation risk between positions
    analysis.correlationRisk = this.calculateCorrelationRisk(openPositions, opportunities);

    // Generate heat map cells
    analysis.heatMap = this.generateHeatMap(openPositions, opportunities);

    // Calculate overall risk score (0-100)
    analysis.riskScore = this.calculateRiskScore(analysis);

    // Generate warnings
    analysis.warnings = this.generateWarnings(analysis);

    return analysis;
  }

  getConcentrationRiskLevel(percentage) {
    if (percentage > 50) return { level: 'critical', color: '#ef4444', emoji: '🔴' };
    if (percentage > 30) return { level: 'high', color: '#f97316', emoji: '🟠' };
    if (percentage > 15) return { level: 'medium', color: '#eab308', emoji: '🟡' };
    return { level: 'low', color: '#22c55e', emoji: '🟢' };
  }

  calculateCorrelationRisk(positions, opportunities) {
    const risks = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];
        const opp1 = opportunities.find(o => o.ticker === pos1.ticker);
        const opp2 = opportunities.find(o => o.ticker === pos2.ticker);

        if (!opp1 || !opp2) continue;

        // Check if same category (correlation risk)
        if (opp1.category === opp2.category) {
          const correlationStrength = opp1.category === 'crypto' ? 0.8 :
                                      opp1.category === 'weather' ? 0.6 : 0.5;

          risks.push({
            pair: `${pos1.ticker} ↔ ${pos2.ticker}`,
            category: opp1.category,
            correlation: correlationStrength,
            exposure1: pos1.value,
            exposure2: pos2.value,
            combinedExposure: pos1.value + pos2.value,
            riskLevel: correlationStrength > 0.7 ? 'high' : correlationStrength > 0.4 ? 'medium' : 'low'
          });
        }

        // Check for inverse correlations (hedging opportunities)
        if (opp1.category !== opp2.category) {
          // Different categories typically have lower correlation
          const inverseCorrelation = this.checkInverseCorrelation(opp1, opp2);
          if (inverseCorrelation) {
            risks.push({
              pair: `${pos1.ticker} ↔ ${pos2.ticker}`,
              type: 'hedge',
              category1: opp1.category,
              category2: opp2.category,
              correlation: inverseCorrelation.strength,
              note: inverseCorrelation.note
            });
          }
        }
      }
    }

    return risks.sort((a, b) => (b.correlation || 0) - (a.correlation || 0));
  }

  checkInverseCorrelation(opp1, opp2) {
    // Crypto often inversely correlates with Fed policy
    if ((opp1.category === 'crypto' && opp2.category === 'economics') ||
        (opp1.category === 'economics' && opp2.category === 'crypto')) {
      return { strength: -0.3, note: 'Potential hedge: Crypto vs Fed policy' };
    }

    // Weather markets in different cities have low correlation
    if (opp1.category === 'weather' && opp2.category === 'weather') {
      const city1 = opp1.ticker.match(/KXHIGH([A-Z]+)/)?.[1];
      const city2 = opp2.ticker.match(/KXHIGH([A-Z]+)/)?.[1];
      if (city1 && city2 && city1 !== city2) {
        return { strength: 0.3, note: 'Low correlation weather markets' };
      }
    }

    return null;
  }

  generateHeatMap(positions, opportunities) {
    const cells = [];

    positions.forEach(pos => {
      const opp = opportunities.find(o => o.ticker === pos.ticker);
      if (!opp) return;

      const category = opp.category || 'unknown';
      const exposure = pos.value || 0;
      const percentageOfBankroll = (exposure / this.bankroll) * 100;

      // Calculate individual position risk
      const edge = parseFloat(opp.edge) || 0;
      const rScore = parseFloat(opp.rScore) || 0;
      const isDeteriorating = opp.isEdgeDeteriorating;

      // Risk factors
      const concentrationRisk = Math.min(10, percentageOfBankroll / 5); // 0-10
      const edgeRisk = isDeteriorating ? 5 : Math.max(0, (10 - edge) / 2); // 0-10
      const qualityRisk = Math.max(0, 5 - rScore); // 0-10

      const totalRisk = (concentrationRisk + edgeRisk + qualityRisk) / 3;

      cells.push({
        ticker: pos.ticker,
        title: opp.title,
        category,
        exposure,
        percentageOfBankroll: Math.round(percentageOfBankroll * 100) / 100,
        riskScore: Math.round(totalRisk * 100) / 100,
        riskLevel: this.getRiskLevelColor(totalRisk),
        factors: {
          concentration: Math.round(concentrationRisk * 100) / 100,
          edge: Math.round(edgeRisk * 100) / 100,
          quality: Math.round(qualityRisk * 100) / 100
        },
        edge: opp.edge,
        rScore: opp.rScore,
        isDeteriorating
      });
    });

    return cells.sort((a, b) => b.riskScore - a.riskScore);
  }

  getRiskLevelColor(riskScore) {
    if (riskScore >= 7) return { level: 'critical', color: '#ef4444', emoji: '🔴' };
    if (riskScore >= 5) return { level: 'high', color: '#f97316', emoji: '🟠' };
    if (riskScore >= 3) return { level: 'medium', color: '#eab308', emoji: '🟡' };
    return { level: 'low', color: '#22c55e', emoji: '🟢' };
  }

  calculateRiskScore(analysis) {
    let score = 0;

    // Concentration risk (40% of score)
    const maxConcentration = Math.max(...Object.values(analysis.concentration).map(c => c.percentage));
    score += Math.min(40, maxConcentration * 0.8);

    // Correlation risk (30% of score)
    const highCorrCount = analysis.correlationRisk.filter(r => r.riskLevel === 'high').length;
    score += Math.min(30, highCorrCount * 10);

    // Heat map average risk (30% of score)
    if (analysis.heatMap.length > 0) {
      const avgRisk = analysis.heatMap.reduce((sum, cell) => sum + cell.riskScore, 0) / analysis.heatMap.length;
      score += Math.min(30, avgRisk * 3);
    }

    return Math.round(score);
  }

  generateWarnings(analysis) {
    const warnings = [];

    // Concentration warnings
    for (const [cat, data] of Object.entries(analysis.concentration)) {
      if (data.percentage > 40) {
        warnings.push({
          type: 'concentration',
          severity: 'critical',
          message: `${cat.toUpperCase()} exposure at ${data.percentage}% - Consider diversifying`,
          exposure: data.exposure
        });
      } else if (data.percentage > 25) {
        warnings.push({
          type: 'concentration',
          severity: 'high',
          message: `${cat.toUpperCase()} exposure at ${data.percentage}% - Monitor closely`,
          exposure: data.exposure
        });
      }
    }

    // Correlation warnings
    const highCorrelations = analysis.correlationRisk.filter(r => r.riskLevel === 'high');
    if (highCorrelations.length > 0) {
      warnings.push({
        type: 'correlation',
        severity: 'high',
        message: `${highCorrelations.length} high-correlation pairs detected - Risk of simultaneous losses`,
        pairs: highCorrelations.map(p => p.pair)
      });
    }

    // Heat map warnings
    const criticalPositions = analysis.heatMap.filter(c => c.riskLevel.level === 'critical');
    criticalPositions.forEach(pos => {
      warnings.push({
        type: 'position',
        severity: 'critical',
        message: `${pos.ticker}: Risk score ${pos.riskScore} - Consider reducing position`,
        ticker: pos.ticker,
        riskScore: pos.riskScore
      });
    });

    // Leverage warning
    const totalExposure = analysis.totalExposure;
    const leverage = totalExposure / analysis.bankroll;
    if (leverage > 0.8) {
      warnings.push({
        type: 'leverage',
        severity: leverage > 1.0 ? 'critical' : 'high',
        message: `Total exposure at ${(leverage * 100).toFixed(0)}% of bankroll - High leverage risk`,
        leverage
      });
    }

    return warnings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  printReport(analysis) {
    console.log('\n🔥 PORTFOLIO HEAT MAP:');
    console.log(`  Overall Risk Score: ${analysis.riskScore}/100 ${this.getRiskEmoji(analysis.riskScore)}`);
    console.log(`  Total Exposure: $${analysis.totalExposure.toLocaleString()} (${((analysis.totalExposure / analysis.bankroll) * 100).toFixed(1)}% of bankroll)`);

    // Concentration by category
    console.log('\n  📊 CONCENTRATION BY CATEGORY:');
    for (const [cat, data] of Object.entries(analysis.concentration)) {
      if (data.exposure > 0) {
        const emoji = data.riskLevel.emoji;
        console.log(`    ${emoji} ${cat.toUpperCase()}: $${data.exposure.toLocaleString()} (${data.percentage}%) - ${data.riskLevel.level.toUpperCase()}`);
      }
    }

    // Heat map cells
    if (analysis.heatMap.length > 0) {
      console.log('\n  🎯 POSITION RISK MAP:');
      analysis.heatMap.forEach(cell => {
        const emoji = cell.riskLevel.emoji;
        console.log(`    ${emoji} ${cell.ticker}: ${cell.riskScore} risk | ${cell.percentageOfBankroll}% bankroll | ${cell.category}`);
        console.log(`       Factors: Conc=${cell.factors.concentration}, Edge=${cell.factors.edge}, Quality=${cell.factors.quality}`);
      });
    }

    // Correlation risks
    if (analysis.correlationRisk.length > 0) {
      console.log('\n  🔗 CORRELATION RISKS:');
      analysis.correlationRisk.slice(0, 5).forEach(risk => {
        const emoji = risk.riskLevel === 'high' ? '🔴' : risk.riskLevel === 'medium' ? '🟠' : '🟢';
        if (risk.type === 'hedge') {
          console.log(`    💚 ${risk.pair}: Hedge opportunity (${risk.note})`);
        } else {
          console.log(`    ${emoji} ${risk.pair}: ${risk.correlation} correlation`);
        }
      });
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      console.log('\n  ⚠️  WARNINGS:');
      analysis.warnings.forEach(w => {
        const emoji = w.severity === 'critical' ? '🔴' : w.severity === 'high' ? '🟠' : '🟡';
        console.log(`    ${emoji} ${w.message}`);
      });
    }
  }

  getRiskEmoji(score) {
    if (score >= 70) return '🔴';
    if (score >= 50) return '🟠';
    if (score >= 30) return '🟡';
    return '🟢';
  }
}

// Dynamic Kelly Sizing (v3.0 #11)
// Adaptive position sizing based on portfolio volatility, win rate, and market regime
class DynamicKellySizing {
  constructor(bankroll = 10000) {
    this.bankroll = bankroll;
    this.baseKellyFraction = 0.5; // Start with half-Kelly
    this.minFraction = 0.1; // Minimum 10% of base Kelly
    this.maxFraction = 1.0; // Maximum full Kelly
    this.historyPath = path.join(__dirname, '..', 'kalshi_data', 'kelly_history.json');
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
      }
    } catch (e) {
      console.error('❌ Failed to load Kelly history:', e.message);
    }
    return { trades: [], regimes: [] };
  }

  saveHistory() {
    try {
      fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
      fs.writeFileSync(this.historyPath, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('❌ Failed to save Kelly history:', e.message);
    }
  }

  // Detect current market regime
  detectMarketRegime(trades) {
    if (!trades || trades.length < 5) {
      return { regime: 'neutral', confidence: 0.5 };
    }

    // Calculate recent volatility (edge changes)
    const recentEdges = trades.slice(0, 20).map(t => parseFloat(t.edge) || 0);
    const avgEdge = recentEdges.reduce((a, b) => a + b, 0) / recentEdges.length;
    const variance = recentEdges.reduce((sum, e) => sum + Math.pow(e - avgEdge, 2), 0) / recentEdges.length;
    const volatility = Math.sqrt(variance);

    // Count deteriorating vs improving edges
    const deteriorating = trades.filter(t => t.isEdgeDeteriorating).length;
    const improving = trades.filter(t => t.decayAnalysis?.trend?.includes('improving')).length;

    // Determine regime
    let regime = 'neutral';
    let confidence = 0.5;

    if (volatility > 15) {
      regime = 'high_volatility';
      confidence = Math.min(1, volatility / 25);
    } else if (volatility < 5 && improving > deteriorating) {
      regime = 'trending';
      confidence = 0.7;
    } else if (deteriorating > trades.length * 0.6) {
      regime = 'decaying';
      confidence = deteriorating / trades.length;
    } else if (avgEdge > 20) {
      regime = 'high_edge';
      confidence = Math.min(1, avgEdge / 30);
    }

    return { regime, confidence, volatility: Math.round(volatility * 100) / 100 };
  }

  // Calculate recent win rate from history
  calculateRecentWinRate(days = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentTrades = this.history.trades.filter(t => 
      t.timestamp > cutoff && t.result !== null
    );

    if (recentTrades.length < 5) {
      return { winRate: 0.5, sampleSize: recentTrades.length };
    }

    const wins = recentTrades.filter(t => t.result === 'win').length;
    const winRate = wins / recentTrades.length;

    return { 
      winRate: Math.round(winRate * 100) / 100, 
      sampleSize: recentTrades.length,
      totalPnL: recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    };
  }

  // Calculate portfolio volatility from position history
  calculatePortfolioVolatility() {
    if (this.history.trades.length < 10) {
      return { volatility: 0.15, sharpe: 1.0 }; // Default moderate volatility
    }

    const returns = this.history.trades
      .filter(t => t.pnl !== undefined)
      .map(t => t.pnl / (t.position || 100)); // Normalize to percentage

    if (returns.length < 5) {
      return { volatility: 0.15, sharpe: 1.0 };
    }

    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Calculate Sharpe ratio (simplified, assuming risk-free rate = 0)
    const sharpe = volatility === 0 ? 1.0 : avg / volatility;

    return {
      volatility: Math.round(volatility * 100) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      avgReturn: Math.round(avg * 100) / 100
    };
  }

  // Calculate dynamic Kelly fraction based on current conditions
  calculateDynamicFraction(marketRegime, winRate, portfolioVol) {
    let fraction = this.baseKellyFraction;

    // Adjust based on market regime
    switch (marketRegime.regime) {
      case 'high_volatility':
        fraction *= 0.5; // Reduce size in high volatility
        break;
      case 'trending':
        fraction *= 1.2; // Increase size in trending markets
        break;
      case 'decaying':
        fraction *= 0.6; // Reduce size when edges decaying
        break;
      case 'high_edge':
        fraction *= 1.1; // Slightly increase in high edge environments
        break;
      default:
        // neutral - keep base fraction
    }

    // Adjust based on recent win rate
    if (winRate.sampleSize >= 10) {
      if (winRate.winRate > 0.65) {
        fraction *= 1.15; // Increase if winning consistently
      } else if (winRate.winRate < 0.4) {
        fraction *= 0.7; // Decrease if losing
      }
    }

    // Adjust based on portfolio volatility
    if (portfolioVol.volatility > 0.25) {
      fraction *= 0.7; // High portfolio volatility = reduce size
    } else if (portfolioVol.volatility < 0.1) {
      fraction *= 1.1; // Low volatility = can increase slightly
    }

    // Adjust based on Sharpe ratio
    if (portfolioVol.sharpe < 0.5) {
      fraction *= 0.8; // Poor risk-adjusted returns
    } else if (portfolioVol.sharpe > 1.5) {
      fraction *= 1.1; // Good risk-adjusted returns
    }

    // Clamp to min/max bounds
    return Math.max(this.minFraction, Math.min(this.maxFraction, fraction));
  }

  // Calculate position size for a specific trade
  calculatePositionSize(trade, winRate, portfolioVol, marketRegime) {
    const edge = parseFloat(trade.edge) || 0;
    const price = trade.yesPrice || 50;

    // Base Kelly calculation
    const winProb = 0.5 + (edge / 200);
    const lossProb = 1 - winProb;
    const winAmount = (100 - price) / price;
    const lossAmount = 1;

    // Full Kelly formula
    const fullKelly = (winProb * winAmount - lossProb * lossAmount) / winAmount;

    // Apply dynamic fraction
    const dynamicFraction = this.calculateDynamicFraction(marketRegime, winRate, portfolioVol);
    const adjustedKelly = fullKelly * dynamicFraction;

    // Convert to dollar amount
    const positionSize = Math.max(0, adjustedKelly * this.bankroll);

    // Apply caps
    const maxPosition = this.bankroll * 0.1; // Max 10% per position
    const minPosition = 10; // Min $10

    const finalSize = Math.max(minPosition, Math.min(maxPosition, positionSize));

    return {
      positionSize: Math.round(finalSize),
      fullKelly: Math.round(fullKelly * 100) / 100,
      adjustedKelly: Math.round(adjustedKelly * 100) / 100,
      fraction: Math.round(dynamicFraction * 100) / 100,
      winProb: Math.round(winProb * 100) / 100,
      maxPosition,
      regime: marketRegime.regime,
      regimeConfidence: marketRegime.confidence
    };
  }

  // Analyze current conditions and provide recommendations
  analyze(trades) {
    const marketRegime = this.detectMarketRegime(trades);
    const winRate = this.calculateRecentWinRate(30);
    const portfolioVol = this.calculatePortfolioVolatility();
    const dynamicFraction = this.calculateDynamicFraction(marketRegime, winRate, portfolioVol);

    // Calculate position sizes for top opportunities
    const positionSizes = trades.slice(0, 5).map(trade => ({
      ticker: trade.ticker,
      ...this.calculatePositionSize(trade, winRate, portfolioVol, marketRegime)
    }));

    return {
      timestamp: new Date().toISOString(),
      bankroll: this.bankroll,
      baseKellyFraction: this.baseKellyFraction,
      dynamicFraction,
      marketRegime,
      winRate,
      portfolioVol,
      positionSizes,
      recommendations: this.generateRecommendations(marketRegime, winRate, portfolioVol, dynamicFraction)
    };
  }

  generateRecommendations(marketRegime, winRate, portfolioVol, fraction) {
    const recommendations = [];

    // Regime-based recommendations
    if (marketRegime.regime === 'high_volatility') {
      recommendations.push({
        type: 'sizing',
        priority: 'high',
        message: `High volatility detected (${marketRegime.volatility}%). Reducing position sizes by 50%.`
      });
    }

    if (marketRegime.regime === 'decaying') {
      recommendations.push({
        type: 'caution',
        priority: 'high',
        message: 'Edge decay widespread. Consider holding cash or reducing exposure.'
      });
    }

    // Win rate recommendations
    if (winRate.sampleSize >= 10 && winRate.winRate < 0.4) {
      recommendations.push({
        type: 'performance',
        priority: 'critical',
        message: `Recent win rate is ${(winRate.winRate * 100).toFixed(0)}%. Consider reviewing strategy.`
      });
    } else if (winRate.sampleSize >= 10 && winRate.winRate > 0.65) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Strong performance: ${(winRate.winRate * 100).toFixed(0)}% win rate. Consider increasing sizes.`
      });
    }

    // Volatility recommendations
    if (portfolioVol.volatility > 0.3) {
      recommendations.push({
        type: 'risk',
        priority: 'high',
        message: `Portfolio volatility is high (${(portfolioVol.volatility * 100).toFixed(0)}%). Consider hedging.`
      });
    }

    // Kelly fraction recommendation
    if (fraction < 0.3) {
      recommendations.push({
        type: 'sizing',
        priority: 'medium',
        message: `Conservative mode: Using ${(fraction * 100).toFixed(0)}% of base Kelly.`
      });
    } else if (fraction > 0.8) {
      recommendations.push({
        type: 'sizing',
        priority: 'low',
        message: `Aggressive mode: Using ${(fraction * 100).toFixed(0)}% of base Kelly.`
      });
    }

    return recommendations;
  }

  printReport(analysis) {
    console.log('\n📊 DYNAMIC KELLY SIZING ANALYSIS:');
    console.log(`  Bankroll: $${analysis.bankroll.toLocaleString()}`);
    console.log(`  Base Kelly Fraction: ${(analysis.baseKellyFraction * 100).toFixed(0)}%`);
    console.log(`  Dynamic Fraction: ${(analysis.dynamicFraction * 100).toFixed(0)}%`);

    console.log('\n  📈 MARKET REGIME:');
    console.log(`    Regime: ${analysis.marketRegime.regime.toUpperCase()}`);
    console.log(`    Confidence: ${(analysis.marketRegime.confidence * 100).toFixed(0)}%`);
    if (analysis.marketRegime.volatility) {
      console.log(`    Edge Volatility: ${analysis.marketRegime.volatility}%`);
    }

    console.log('\n  🎯 RECENT PERFORMANCE (30 days):');
    console.log(`    Win Rate: ${(analysis.winRate.winRate * 100).toFixed(0)}% (${analysis.winRate.sampleSize} trades)`);
    if (analysis.winRate.totalPnL !== undefined) {
      const pnlEmoji = analysis.winRate.totalPnL >= 0 ? '🟢' : '🔴';
      console.log(`    P&L: ${pnlEmoji} $${analysis.winRate.totalPnL.toFixed(2)}`);
    }

    console.log('\n  📊 PORTFOLIO METRICS:');
    console.log(`    Volatility: ${(analysis.portfolioVol.volatility * 100).toFixed(1)}%`);
    console.log(`    Sharpe Ratio: ${analysis.portfolioVol.sharpe}`);

    console.log('\n  💰 RECOMMENDED POSITION SIZES:');
    analysis.positionSizes.forEach(pos => {
      const sizeEmoji = pos.positionSize >= 200 ? '🔴' : pos.positionSize >= 100 ? '🟠' : '🟢';
      console.log(`    ${sizeEmoji} ${pos.ticker}: $${pos.positionSize}`);
      console.log(`       Kelly: ${(pos.adjustedKelly * 100).toFixed(1)}% (${(pos.fraction * 100).toFixed(0)}% of base)`);
    });

    if (analysis.recommendations.length > 0) {
      console.log('\n  💡 RECOMMENDATIONS:');
      analysis.recommendations.forEach(rec => {
        const emoji = rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : rec.priority === 'medium' ? '🟡' : '🔵';
        console.log(`    ${emoji} ${rec.message}`);
      });
    }
  }
}

async function cachedFetch(key, fetchFn, ttlMs) {
  const cached = cache.get(key);
  if (cached) {
    console.log(`  💾 Cache hit: ${key}`);
    return cached;
  }
  
  console.log(`  🌐 Fetching: ${key}`);
  const result = await fetchFn();
  cache.set(key, result, ttlMs);
  return result;
}

// Save historical data
async function saveHistory(history) {
  try {
    // Clean old data and sanitize keys
    const cutoff = Date.now() - (CONFIG.historyRetentionDays * 24 * 60 * 60 * 1000);
    const sanitizedHistory = {};
    
    for (const ticker in history) {
      const safeTicker = sanitizeTicker(ticker);
      sanitizedHistory[safeTicker] = history[ticker].filter(h => h.timestamp > cutoff);
    }
    
    if (db) {
      await db.ref('v6/kalshi/history').set(sanitizedHistory);
    }
    
    // Also save locally (use original keys for local file)
    const historyPath = path.join(__dirname, '..', 'kalshi_data', 'price_history.json');
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('❌ Failed to save history:', e.message);
  }
}

// Detect whale activity
function detectWhale(currentVolume, history, ticker) {
  if (!history || history.length < 3) return { isWhale: false, avgVolume: 0, spikeRatio: 1 };
  
  const tickerHistory = history[ticker] || [];
  if (tickerHistory.length < 3) return { isWhale: false, avgVolume: 0, spikeRatio: 1 };
  
  // Calculate average volume from last 5 data points
  const recentVolumes = tickerHistory.slice(-5).map(h => h.volume);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  
  // Detect spike
  const spikeRatio = currentVolume / avgVolume;
  const isWhale = spikeRatio >= CONFIG.whaleVolumeMultiplier && currentVolume >= CONFIG.whaleVolumeThreshold;
  
  return { isWhale, avgVolume, spikeRatio };
}

// Calculate price momentum
function calculateMomentum(currentPrice, history, ticker) {
  if (!history || !history[ticker] || history[ticker].length < 2) {
    return { momentum: 0, trend: 'flat', change24h: 0 };
  }
  
  const tickerHistory = history[ticker];
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Find price 24h ago
  const dayAgoEntry = tickerHistory.find(h => h.timestamp > oneDayAgo);
  const price24hAgo = dayAgoEntry ? dayAgoEntry.price : tickerHistory[0].price;
  
  // Calculate momentum (price velocity)
  const recent = tickerHistory.slice(-3);
  const momentum = recent.length >= 2 
    ? (recent[recent.length - 1].price - recent[0].price) / recent.length
    : 0;
  
  // Calculate 24h change
  const change24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
  
  // Determine trend
  let trend = 'flat';
  if (change24h > 5) trend = 'surging';
  else if (change24h > 2) trend = 'rising';
  else if (change24h < -5) trend = 'crashing';
  else if (change24h < -2) trend = 'falling';
  
  return { momentum, trend, change24h };
}

// Calculate historical edge (CLV - Closing Line Value)
function calculateHistoricalEdge(currentEdge, history, ticker) {
  if (!history || !history[ticker] || history[ticker].length < 3) {
    return { edgeChange: 0, avgHistoricalEdge: currentEdge, isEdgeDeteriorating: false };
  }
  
  const tickerHistory = history[ticker];
  const historicalEdges = tickerHistory.map(h => h.edge).filter(e => e !== undefined);
  
  if (historicalEdges.length === 0) {
    return { edgeChange: 0, avgHistoricalEdge: currentEdge, isEdgeDeteriorating: false };
  }
  
  const avgHistoricalEdge = historicalEdges.reduce((a, b) => a + b, 0) / historicalEdges.length;
  const edgeChange = currentEdge - avgHistoricalEdge;
  const isEdgeDeteriorating = edgeChange < -2; // Edge dropped by more than 2%
  
  return { edgeChange, avgHistoricalEdge, isEdgeDeteriorating };
}

// Detect correlated markets within a category
function detectCorrelations(trades) {
  const correlations = [];
  
  // Group by category
  const byCategory = {};
  for (const t of trades) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }
  
  // Check for correlations within each category
  for (const [category, categoryTrades] of Object.entries(byCategory)) {
    if (categoryTrades.length < 2) continue;
    
    for (let i = 0; i < categoryTrades.length; i++) {
      for (let j = i + 1; j < categoryTrades.length; j++) {
        const t1 = categoryTrades[i];
        const t2 = categoryTrades[j];
        
        const t1Base = t1.ticker.split('-').slice(0, 2).join('-');
        const t2Base = t2.ticker.split('-').slice(0, 2).join('-');
        
        if (t1Base === t2Base && t1.ticker !== t2.ticker) {
          const priceDiff = Math.abs(t1.yesPrice - t2.yesPrice);
          const volumeRatio = Math.max(t1.volume, t2.volume) / Math.min(t1.volume, t2.volume);
          
          if (priceDiff < 20 && volumeRatio < 3) {
            correlations.push({
              type: 'same_event',
              category,
              market1: t1.ticker,
              market2: t2.ticker,
              priceDiff,
              correlation: 'high'
            });
          }
        }
      }
    }
  }
  
  return correlations;
}

// Multi-Factor Scoring Model (v3.0)
// Weighted scoring: Edge (40%), Liquidity (20%), Time (15%), History (15%), Sentiment (10%)
const SCORING_WEIGHTS = {
  edgeQuality: 0.40,
  liquidityDepth: 0.20,
  timeToExpiration: 0.15,
  historicalAccuracy: 0.15,
  newsSentiment: 0.10
};

function calculateMultiFactorScore(trade, momentum, clv, whaleData, sentiment = null) {
  const scores = {
    edgeQuality: calculateEdgeQualityScore(trade, clv),
    liquidityDepth: calculateLiquidityScore(trade, whaleData),
    timeToExpiration: calculateTimeScore(trade),
    historicalAccuracy: calculateHistoricalAccuracyScore(trade, momentum),
    newsSentiment: calculateSentimentScore(trade, sentiment)
  };

  // Weighted sum
  let weightedScore = 0;
  let totalWeight = 0;

  for (const [factor, weight] of Object.entries(SCORING_WEIGHTS)) {
    weightedScore += scores[factor] * weight;
    totalWeight += weight;
  }

  const finalScore = weightedScore / totalWeight;

  return {
    total: Math.round(finalScore * 100) / 100,
    breakdown: scores,
    weights: SCORING_WEIGHTS
  };
}

// Edge Quality (40%): Based on R-score and edge stability
function calculateEdgeQualityScore(trade, clv) {
  let score = parseFloat(trade.rScore) || 0;

  // Normalize to 0-10 scale (R-score typically 0-5)
  score = Math.min(10, score * 2);

  // Bonus for stable/improving edge
  if (!clv.isEdgeDeteriorating) score += 1;
  if (clv.edgeChange > 0) score += 0.5;

  // Penalty for decaying edge
  if (clv.isEdgeDeteriorating) score -= 1.5;

  return Math.max(0, Math.min(10, score));
}

// Liquidity Depth (20%): Based on volume, spread, whale activity
function calculateLiquidityScore(trade, whaleData) {
  let score = 5; // Start neutral

  const volume = trade.volume || 0;
  const spread = parseFloat(trade.spread) || 0;

  // Volume scoring (higher = better)
  if (volume > 100000) score += 2;
  else if (volume > 50000) score += 1.5;
  else if (volume > 10000) score += 1;
  else if (volume < 1000) score -= 1;

  // Spread scoring (lower = better)
  if (spread < 2) score += 1.5;
  else if (spread < 5) score += 1;
  else if (spread > 10) score -= 1;

  // Whale activity bonus
  if (whaleData.isWhale) score += 0.5;

  return Math.max(0, Math.min(10, score));
}

// Time to Expiration (15%): Closer expiration = higher confidence
function calculateTimeScore(trade) {
  if (!trade.closeTime) return 5;

  const close = new Date(trade.closeTime);
  const now = new Date();
  const hoursUntil = (close - now) / (1000 * 60 * 60);
  const daysUntil = hoursUntil / 24;

  // Optimal: 1-7 days out (high confidence)
  if (daysUntil <= 1) return 8;
  if (daysUntil <= 3) return 9;
  if (daysUntil <= 7) return 8.5;
  if (daysUntil <= 14) return 7;
  if (daysUntil <= 30) return 6;

  // Too far out = lower confidence
  return 4;
}

// Historical Accuracy (15%): Based on momentum and past performance
function calculateHistoricalAccuracyScore(trade, momentum) {
  let score = 5;

  // Momentum bonus
  if (momentum.trend === 'surging') score += 2;
  else if (momentum.trend === 'rising') score += 1;
  else if (momentum.trend === 'falling') score -= 0.5;
  else if (momentum.trend === 'crashing') score -= 1.5;

  // Volume trend
  const volumeChange = momentum.change24h || 0;
  if (volumeChange > 50) score += 1;
  else if (volumeChange > 20) score += 0.5;
  else if (volumeChange < -30) score -= 0.5;

  return Math.max(0, Math.min(10, score));
}

// News Sentiment (10%): Based on sentiment analysis
function calculateSentimentScore(trade, sentiment) {
  if (!sentiment || !trade.sentimentSignal) return 5; // Neutral if no data

  const score = trade.sentimentSignal.score || 0;

  // Convert -1 to +1 scale to 0-10
  return 5 + (score * 5);
}

// Legacy function - kept for backward compatibility
function calculateCompositeScore(trade, momentum, clv, whaleData) {
  const multiFactor = calculateMultiFactorScore(trade, momentum, clv, whaleData);
  return multiFactor.total;
}

// Brier Score calculation - measures prediction accuracy
// Lower is better (0 = perfect, 1 = worst)
function calculateBrierScore(probability, outcome) {
  // outcome: 1 if event happened, 0 if not
  return Math.pow(parseFloat(probability) / 100 - outcome, 2);
}

// Calculate risk metrics for a trade
function calculateRiskMetrics(trade, bankroll = 10000) {
  const position = trade.position || 0;
  const edge = parseFloat(trade.edge) || 0;
  const price = trade.yesPrice || 50;
  
  // Expected value
  const winProb = edge / 100 + 0.5;
  const winPayout = position * ((100 - price) / price);
  const expectedValue = (winProb * winPayout) - ((1 - winProb) * position);
  
  // Variance and standard deviation
  const variance = winProb * Math.pow(winPayout - expectedValue, 2) + 
                   (1 - winProb) * Math.pow(-position - expectedValue, 2);
  const stdDev = Math.sqrt(variance);
  
  // Sharpe ratio (expected return / risk)
  const sharpeRatio = stdDev > 0 ? expectedValue / stdDev : 0;
  
  // Max drawdown estimate (position size)
  const maxDrawdown = position;
  
  // Risk of ruin (simplified Kelly-based)
  const riskOfRuin = position > bankroll * 0.5 ? 'high' : 
                     position > bankroll * 0.25 ? 'medium' : 'low';
  
  return {
    expectedValue: expectedValue.toFixed(2),
    stdDev: stdDev.toFixed(2),
    sharpeRatio: sharpeRatio.toFixed(2),
    maxDrawdown: maxDrawdown.toFixed(2),
    riskOfRuin,
    positionPctOfBankroll: ((position / bankroll) * 100).toFixed(1)
  };
}

// Check alert thresholds
function checkAlerts(trade, momentum, whaleData, clv) {
  const alerts = [];
  
  // Whale alert
  if (whaleData.isWhale) {
    alerts.push({
      type: 'whale',
      severity: 'high',
      message: `🐋 Whale activity: ${whaleData.spikeRatio.toFixed(1)}x volume spike`,
      ticker: trade.ticker
    });
  }
  
  // Edge deterioration alert
  if (clv.isEdgeDeteriorating && parseFloat(trade.edge) > 10) {
    alerts.push({
      type: 'edge_drop',
      severity: 'urgent',
      message: `🔥 Edge dropping fast: ${clv.edgeChange.toFixed(1)}% decline`,
      ticker: trade.ticker
    });
  }
  
  // Momentum surge alert
  if (momentum.trend === 'surging' && parseFloat(trade.edge) > 5) {
    alerts.push({
      type: 'momentum',
      severity: 'medium',
      message: `🚀 Momentum surge: +${momentum.change24h.toFixed(1)}% in 24h`,
      ticker: trade.ticker
    });
  }
  
  // High R-Score alert
  if (parseFloat(trade.rScore) >= 2.5) {
    alerts.push({
      type: 'high_quality',
      severity: 'info',
      message: `⭐ Exceptional opportunity: R-Score ${trade.rScore}`,
      ticker: trade.ticker
    });
  }
  
  // Closing soon alert
  if (trade.closeTime) {
    const hoursUntil = (new Date(trade.closeTime) - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      alerts.push({
        type: 'closing_soon',
        severity: 'medium',
        message: `⏰ Closing in ${hoursUntil.toFixed(0)}h`,
        ticker: trade.ticker
      });
    }
  }
  
  return alerts;
}

// Performance attribution - what drove the trade's score
function getPerformanceAttribution(trade, momentum, whaleData, clv) {
  const factors = [];
  
  const edgeValue = parseFloat(trade.edge) || 0;
  factors.push({
    factor: 'Base Edge',
    contribution: edgeValue / 10,
    description: 'Fundamental mispricing'
  });
  
  const timeAdjustmentValue = parseFloat(trade.timeAdjustment) || 0;
  if (timeAdjustmentValue !== 0) {
    factors.push({
      factor: 'Time Decay',
      contribution: timeAdjustmentValue / 10,
      description: 'Proximity to event'
    });
  }
  
  const volumeBoostValue = parseFloat(trade.volumeBoost) || 0;
  if (volumeBoostValue > 0) {
    factors.push({
      factor: 'Volume',
      contribution: volumeBoostValue / 10,
      description: 'Liquidity boost'
    });
  }
  
  if (momentum.trend !== 'flat') {
    const momentumContribution = momentum.trend === 'surging' ? 0.5 : 
                                  momentum.trend === 'rising' ? 0.3 : 
                                  momentum.trend === 'crashing' ? -0.5 : -0.3;
    factors.push({
      factor: 'Momentum',
      contribution: momentumContribution,
      description: `${momentum.trend} (${(momentum.change24h || 0).toFixed(1)}% 24h)`
    });
  }
  
  if (whaleData.isWhale) {
    factors.push({
      factor: 'Whale Activity',
      contribution: 0.3,
      description: `${(whaleData.spikeRatio || 1).toFixed(1)}x volume`
    });
  }
  
  if (clv.isEdgeDeteriorating) {
    factors.push({
      factor: 'CLV Deterioration',
      contribution: -0.5,
      description: `Edge down ${(clv.edgeChange || 0).toFixed(1)}%`
    });
  }
  
  return factors.sort((a, b) => b.contribution - a.contribution);
}

async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchOnce(url, options);
    } catch (err) {
      console.error(`  ⚠️ Attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await delay(1000 * (i + 1));
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

function fetchOnce(url, options) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Fetch raw text (for RSS feeds)
function fetchText(url, options = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    
    const req = protocol.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; KalshiScanner/2.6)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        ...options.headers
      },
      timeout: timeoutMs,
      ...options
    }, (res) => {
      // Handle redirects manually
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        fetchText(redirectUrl, options, timeoutMs).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function fetchMarkets(seriesTicker) {
  const url = `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${seriesTicker}&limit=20&status=open`;
  return fetchWithRetry(url);
}

function cleanTitle(title) {
  if (!title) return '';
  return title.replace(/\?/g, '').replace(/high temp/gi, 'High').replace(/low temp/gi, 'Low').trim();
}

function buildUrl(ticker) {
  return `https://kalshi.com/events/${ticker.toLowerCase()}`;
}

// Time-based confidence adjustment
function getTimeConfidence(closeTime, category) {
  if (!closeTime) return 0;
  const close = new Date(closeTime);
  const now = new Date();
  const hoursUntil = (close - now) / (1000 * 60 * 60);
  const daysUntil = hoursUntil / 24;
  
  if (category === 'weather') {
    if (hoursUntil <= 24) return 0.05;
    if (daysUntil <= 3) return 0.02;
    if (daysUntil <= 7) return 0;
    return -0.03;
  }
  if (category === 'economics') {
    if (daysUntil <= 7) return 0.03;
    if (daysUntil <= 30) return 0;
    return -0.02;
  }
  if (category === 'crypto') return 0;
  if (category === 'politics') {
    if (daysUntil <= 14) return 0.04;
    return -0.01;
  }
  return 0;
}

// Market health metrics
function getMarketHealth(m) {
  const yesBid = m.yes_bid || 0;
  const yesAsk = m.yes_ask || m.yes_price || 0;
  const noBid = m.no_bid || 0;
  const noAsk = m.no_ask || (100 - yesAsk);
  
  const yesSpread = yesAsk - yesBid;
  const noSpread = noAsk - noBid;
  const avgSpread = (yesSpread + noSpread) / 2;
  
  const volume = m.volume || 0;
  const liquidityScore = Math.min(100, Math.floor(volume / 100));
  
  let health = 'good';
  if (avgSpread > 10 || liquidityScore < 20) health = 'poor';
  else if (avgSpread > 5 || liquidityScore < 50) health = 'fair';
  
  return { yesSpread, noSpread, avgSpread, liquidityScore, health, isLiquid: avgSpread <= CONFIG.maxSpread };
}

// Calculate edge with time and volume adjustments
function calculateEdge(yesPrice, baseProb, volume, closeTime, category) {
  const marketProb = yesPrice / 100;
  const volumeBoost = Math.min(volume / 10000, 0.05);
  const timeAdjustment = getTimeConfidence(closeTime, category);
  
  let adjustedProb = Math.min(baseProb + volumeBoost + timeAdjustment, 0.99);
  adjustedProb = Math.max(adjustedProb, 0.01);
  
  const edge = (adjustedProb - marketProb) * 100;
  
  return {
    edge,
    adjustedProb,
    marketProb,
    rScore: edge > 0 ? edge / 10 : 0,
    timeAdjustment,
    volumeBoost
  };
}

// Kelly Criterion
function calculateKelly(edge, price, bankroll = 10000) {
  if (edge <= 0) return { kellyPct: 0, position: 0 };
  const b = (100 - price) / price;
  const p = edge / 100 + 0.5;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  const kellyFraction = fullKelly * CONFIG.kellyFraction;
  const position = Math.min(bankroll * Math.max(0, kellyFraction), bankroll * 0.10);
  return { kellyPct: (kellyFraction * 100).toFixed(1), position: Math.floor(position) };
}

function isClosingSoon(closeTime) {
  if (!closeTime) return false;
  const hoursUntil = (new Date(closeTime) - new Date()) / (1000 * 60 * 60);
  return hoursUntil < CONFIG.minHoursToClose;
}

function detectArbitrage(markets) {
  const arbs = [];
  const byEvent = {};
  for (const m of markets) {
    const key = m.ticker.split('-').slice(0, 2).join('-');
    if (!byEvent[key]) byEvent[key] = [];
    byEvent[key].push(m);
  }
  for (const [event, eventMarkets] of Object.entries(byEvent)) {
    if (eventMarkets.length >= 2) {
      const total = eventMarkets.reduce((sum, m) => sum + m.yesPrice, 0);
      if (total > 105) {
        arbs.push({ event, markets: eventMarkets.map(m => m.ticker), total, excess: total - 100 });
      }
    }
  }
  return arbs;
}

// Check Polymarket for arbitrage opportunities
async function fetchPolymarketData() {
  try {
    const url = 'https://gamma-api.polymarket.com/events?active=true&closed=false&archived=false&limit=100';
    const data = await fetchWithRetry(url, {}, 2);
    return data || [];
  } catch (e) {
    console.log('⚠️ Polymarket fetch failed:', e.message);
    return [];
  }
}

function getPolymarketSlug(kalshiTicker) {
  const mapping = {
    'KXBTC': 'bitcoin',
    'KXETH': 'ethereum',
    'KXFED': 'fed-funds-rate',
    'KXCPI': 'cpi-inflation',
    'KXJOBS': 'nonfarm-payrolls',
    'KXTRUMP': 'trump-approval-rating'
  };
  const series = kalshiTicker.split('-')[0];
  return mapping[series];
}

function calculatePolymarketArbitrage(kalshiTrade, pmEvents) {
  const slug = getPolymarketSlug(kalshiTrade.ticker);
  if (!slug) return null;
  
  const pmEvent = pmEvents.find(e => 
    e.title?.toLowerCase().includes(slug) ||
    e.slug?.includes(slug)
  );
  
  if (!pmEvent || !pmEvent.markets || pmEvent.markets.length === 0) return null;
  
  const pmMarket = pmEvent.markets[0];
  const pmYesPrice = pmMarket.outcomePrices ? 
    parseFloat(pmMarket.outcomePrices.split(',')[0]) * 100 : 50;
  
  const kalshiYesPrice = kalshiTrade.yesPrice;
  const priceDiff = Math.abs(kalshiYesPrice - pmYesPrice);
  const percentDiff = (priceDiff / Math.min(kalshiYesPrice, pmYesPrice)) * 100;
  
  if (percentDiff < 5) return null;
  
  const buyOn = kalshiYesPrice < pmYesPrice ? 'Kalshi' : 'Polymarket';
  const sellOn = kalshiYesPrice < pmYesPrice ? 'Polymarket' : 'Kalshi';
  
  return {
    ticker: kalshiTrade.ticker,
    kalshiPrice: kalshiYesPrice,
    polymarketPrice: pmYesPrice.toFixed(1),
    priceDiff: priceDiff.toFixed(1),
    percentDiff: percentDiff.toFixed(1),
    buyOn,
    sellOn,
    profitPotential: priceDiff.toFixed(1),
    pmEventTitle: pmEvent.title,
    pmUrl: `https://polymarket.com/event/${pmEvent.slug}`
  };
}

// ==================== ALTERNATIVE DATA MODULES ====================

// RSS News Feed Parser - fetch news from multiple sources
async function fetchRSSFeeds() {
  const feeds = [
    // Crypto
    { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed/', category: 'crypto' },
    { name: 'BitcoinMagazine', url: 'https://bitcoinmagazine.com/feed', category: 'crypto' },
    { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/', category: 'crypto' },
    { name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/', category: 'crypto' },
    // Politics
    { name: 'RealClearPolitics', url: 'https://www.realclearpolitics.com/index.xml', category: 'politics' },
    { name: 'WashingtonExaminer', url: 'https://www.washingtonexaminer.com/feed/', category: 'politics' },
    { name: 'DailyCaller', url: 'https://dailycaller.com/feed/', category: 'politics' },
    { name: 'NationalReview', url: 'https://www.nationalreview.com/feed/', category: 'politics' },
    // Markets/Finance
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories', category: 'markets' },
    { name: 'Investing', url: 'https://www.investing.com/rss/news.rss', category: 'markets' },
    { name: 'FXStreet', url: 'https://www.fxstreet.com/rss/news', category: 'markets' },
    { name: 'Barron', url: 'https://www.barrons.com/rss', category: 'markets' },
    // General News
    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'general' },
    { name: 'USNews', url: 'https://www.usnews.com/rss/news', category: 'general' },
    { name: 'TheHill', url: 'https://thehill.com/rss/syndicator/19110', category: 'general' },
    // Weather
    { name: 'NOAA', url: 'https://www.weather.gov/rss_page.php?site_name=nws', category: 'weather' },
    { name: 'WeatherNation', url: 'https://weathernation.tv/feed/', category: 'weather' }
  ];
  
  const articles = [];
  
  // Fetch all feeds in parallel with timeout
  const feedPromises = feeds.map(async (feed) => {
    try {
      const data = await fetchText(feed.url, {}, 8000); // 8 second timeout per feed
      
      // Check if we got valid XML
      if (!data || data.length < 100 || !data.includes('<')) {
        return { feed, items: [], error: 'Empty or invalid response' };
      }
      
      const items = parseRSS(data, feed.name, feed.category);
      return { feed, items, error: null };
    } catch (e) {
      return { feed, items: [], error: e.message };
    }
  });
  
  // Wait for all feeds to complete (or timeout)
  const results = await Promise.allSettled(feedPromises);
  
  // Process results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { feed, items, error } = result.value;
      
      if (error) {
        console.log(`  ⚠️ ${feed.name}: ${error.slice(0, 50)}`);
      } else if (items.length > 0) {
        console.log(`  ✅ ${feed.name}: ${items.length} articles`);
        articles.push(...items);
      } else {
        console.log(`  ⚠️ ${feed.name}: No articles parsed`);
      }
    } else {
      console.log(`  ⚠️ Feed failed: ${result.reason?.message?.slice(0, 50) || 'Unknown error'}`);
    }
  }
  
  // Sort by date, newest first
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  return articles.slice(0, 50); // Limit to recent 50 articles
}

function parseRSS(xmlData, source, category = 'general') {
  const items = [];
  
  // Try multiple patterns for different RSS formats
  const itemPatterns = [
    /<item>[\s\S]*?<\/item>/gi,  // Standard RSS
    /<entry>[\s\S]*?<\/entry>/gi  // Atom format
  ];
  
  let matches = [];
  for (const pattern of itemPatterns) {
    const found = xmlData.match(pattern);
    if (found && found.length > 0) {
      matches = found;
      break;
    }
  }
  
  for (const item of matches.slice(0, 10)) {
    // Try multiple patterns for title
    const title = extractField(item, ['title']) || '';
    const description = extractField(item, ['description', 'summary', 'content']) || '';
    const pubDate = extractField(item, ['pubDate', 'published', 'updated', 'date']);
    const link = extractField(item, ['link', 'id']);
    
    if (title && title.length > 5) { // Filter out empty/short titles
      items.push({
        source,
        category,
        title: cleanText(title),
        description: cleanText(description).slice(0, 500),
        pubDate: parseDate(pubDate),
        link: extractLink(link),
        relevance: 0,
        sentiment: 0
      });
    }
  }
  
  return items;
}

function extractField(xml, fieldNames) {
  for (const field of fieldNames) {
    // Try CDATA version first
    const cdataRegex = new RegExp(`<${field}[\s\S]*?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${field}>`, 'i');
    const normalRegex = new RegExp(`<${field}[\s]*[^>]*>([^<]*)<\/${field}>`, 'i');
    
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1].trim();
    
    const normalMatch = xml.match(normalRegex);
    if (normalMatch) return normalMatch[1].trim();
  }
  return null;
}

function extractLink(linkField) {
  if (!linkField) return null;
  // Handle href attribute format: <link href="..." />
  const hrefMatch = linkField.match(/href="([^"]+)"/);
  if (hrefMatch) return hrefMatch[1];
  return linkField.trim();
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ') // Strip HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, match => String.fromCharCode(parseInt(match.slice(2, -1))))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

// NLP Sentiment Analysis - keyword-based scoring
function analyzeSentiment(text) {
  if (!text) return { score: 0, label: 'neutral', confidence: 0 };
  
  const lowerText = text.toLowerCase();
  
  // Positive keywords
  const positiveWords = [
    'surge', 'surges', 'rally', 'rallies', 'gain', 'gains', 'up', 'rise', 'rises', 'rising',
    'bullish', 'strong', 'growth', 'boom', 'soar', 'soars', 'jump', 'jumps', 'outperform',
    'beat', 'beats', 'exceed', 'exceeds', 'positive', 'optimistic', 'confidence', 'confident',
    'support', 'approval', 'approve', 'approves', 'pass', 'passes', 'agreement', 'deal'
  ];
  
  // Negative keywords
  const negativeWords = [
    'drop', 'drops', 'fall', 'falls', 'falling', 'plunge', 'plunges', 'crash', 'crashes',
    'bearish', 'weak', 'decline', 'declines', 'down', 'slide', 'slides', 'tumble', 'tumbles',
    'miss', 'misses', 'underperform', 'negative', 'pessimistic', 'concern', 'worry', 'worries',
    'oppose', 'opposes', 'veto', 'reject', 'rejects', 'block', 'blocks', 'delay', 'delays'
  ];
  
  // Crypto-specific
  const cryptoPositive = ['adoption', 'institutional', 'etf', 'halving', 'upgrade', 'merge'];
  const cryptoNegative = ['ban', 'regulation', 'sec', 'lawsuit', 'hack', 'exploit', 'rug'];
  
  // Politics-specific
  const politicsPositive = ['bipartisan', 'consensus', 'deal', 'agreement', 'pass', 'sign'];
  const politicsNegative = ['shutdown', 'impeachment', 'investigation', 'scandal', 'controversy'];
  
  // Weather-specific
  const weatherHot = ['heat', 'hot', 'warm', 'record high', 'above average', 'drought'];
  const weatherCold = ['cold', 'freeze', 'frost', 'snow', 'blizzard', 'below average'];
  
  let score = 0;
  let matches = 0;
  
  // Count matches
  const countMatches = (words, weight) => {
    words.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const count = (lowerText.match(regex) || []).length;
      score += count * weight;
      matches += count;
    });
  };
  
  countMatches(positiveWords, 1);
  countMatches(negativeWords, -1);
  countMatches(cryptoPositive, 1.5);
  countMatches(cryptoNegative, -1.5);
  countMatches(politicsPositive, 1.2);
  countMatches(politicsNegative, -1.2);
  
  // Weather detection
  const weatherScore = {
    hot: 0,
    cold: 0
  };
  weatherHot.forEach(w => {
    if (lowerText.includes(w)) weatherScore.hot++;
  });
  weatherCold.forEach(w => {
    if (lowerText.includes(w)) weatherScore.cold++;
  });
  
  // Normalize score (-1 to 1 range)
  const normalizedScore = Math.max(-1, Math.min(1, score / Math.max(matches, 3)));
  
  let label = 'neutral';
  if (normalizedScore > 0.2) label = 'positive';
  else if (normalizedScore < -0.2) label = 'negative';
  
  return {
    score: normalizedScore,
    label,
    confidence: Math.min(matches / 5, 1),
    weatherBias: weatherScore.hot > weatherScore.cold ? 'hot' : 
                 weatherScore.cold > weatherScore.hot ? 'cold' : 'neutral'
  };
}

// Match news articles to relevant markets
function matchNewsToMarkets(articles, trades) {
  const keywordMap = {
    'KXBTC': ['bitcoin', 'btc', 'crypto', 'cryptocurrency'],
    'KXETH': ['ethereum', 'eth', 'crypto', 'cryptocurrency'],
    'KXSOL': ['solana', 'sol', 'crypto'],
    'KXTRUMP': ['trump', 'president', 'biden', 'white house'],
    'KXTRUTHSOCIAL': ['truth social', 'trump media', 'djt'],
    'KXFED': ['fed', 'federal reserve', 'interest rate', 'powell'],
    'KXCPI': ['inflation', 'cpi', 'consumer price'],
    'KXJOBS': ['jobs', 'employment', 'unemployment', 'nfp', 'payroll'],
    'KXGDP': ['gdp', 'economy', 'economic growth'],
    'KXHIGHNY': ['new york', 'nyc', 'manhattan', 'weather'],
    'KXHIGHCHI': ['chicago', 'illinois', 'midwest', 'weather'],
    'KXHIGHTSEA': ['seattle', 'washington', 'pacific northwest', 'weather'],
    'KXHIGHMIA': ['miami', 'florida', 'southeast', 'weather']
  };
  
  for (const article of articles) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    const sentiment = analyzeSentiment(text);
    article.sentiment = sentiment.score;
    article.sentimentLabel = sentiment.label;
    article.weatherBias = sentiment.weatherBias;
    
    for (const trade of trades) {
      const series = trade.ticker.split('-')[0];
      const keywords = keywordMap[series] || [];
      
      const isRelevant = keywords.some(kw => text.includes(kw));
      if (isRelevant) {
        article.relevance = Math.max(article.relevance, 0.7);
        trade.sentimentSignal = {
          score: sentiment.score,
          label: sentiment.label,
          source: article.source,
          headline: article.title.slice(0, 100),
          timestamp: article.pubDate
        };
      }
    }
  }
  
  return articles.filter(a => a.relevance > 0);
}

// NWS Weather Lag Detection - compare Kalshi with National Weather Service
async function fetchNWSForecast(city) {
  // NWS API endpoints for major cities
  const nwsStations = {
    'NYC': { station: 'KNYC', grid: 'OKX/33,37', lat: 40.71, lon: -74.01 },
    'CHI': { station: 'KORD', grid: 'LOT/65,77', lat: 41.88, lon: -87.63 },
    'SEA': { station: 'KSEA', grid: 'SEW/124,69', lat: 47.61, lon: -122.33 },
    'MIA': { station: 'KMIA', grid: 'MFL/108,49', lat: 25.76, lon: -80.19 },
    'PHX': { station: 'KPHX', grid: 'PSR/158,58', lat: 33.45, lon: -112.07 }
  };
  
  const station = nwsStations[city];
  if (!station) return null;
  
  try {
    // NWS API requires user agent
    const url = `https://api.weather.gov/gridpoints/${station.grid.split('/')[0]}/${station.grid.split('/')[1]}/forecast`;
    const data = await fetchWithRetry(url, { headers: { 'User-Agent': 'KalshiScanner/2.5' } }, 2);
    
    return parseNWSForecast(data);
  } catch (e) {
    console.log(`  ⚠️ NWS ${city} fetch failed: ${e.message}`);
    return null;
  }
}

function parseNWSForecast(data) {
  const periods = data.properties?.periods || [];
  const highs = [];
  
  for (const period of periods.slice(0, 7)) { // Next 7 days
    if (period.isDaytime) {
      highs.push({
        date: period.startTime,
        day: period.name,
        highTemp: period.temperature,
        shortForecast: period.shortForecast,
        detailedForecast: period.detailedForecast
      });
    }
  }
  
  return highs;
}

function detectWeatherLag(kalshiMarket, nwsForecast) {
  if (!nwsForecast || nwsForecast.length === 0) return null;
  
  // Parse Kalshi market for temperature range and date
  // Example: KXHIGHNY-26MAR08-B44.5 (NYC High March 8, 2026, Below 44.5°F)
  const match = kalshiMarket.ticker.match(/KXHIGH([A-Z]+)-(\d{2})([A-Z]{3})(\d{2})-([AB])(\d+\.?\d*)/);
  if (!match) return null;
  
  const [, cityCode, , monthStr, dayStr, side, tempStr] = match;
  const targetTemp = parseFloat(tempStr);
  const isAbove = side === 'A';
  
  // Map city code to NWS station
  const cityMap = { 'NY': 'NYC', 'CHI': 'CHI', 'SEA': 'SEA', 'MIA': 'MIA', 'TPHX': 'PHX' };
  const city = cityMap[cityCode];
  if (!city) return null;
  
  // Find matching forecast day
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthIdx = monthNames.indexOf(monthStr);
  const day = parseInt(dayStr);
  
  const forecastDay = nwsForecast.find(f => {
    const fDate = new Date(f.date);
    return fDate.getMonth() === monthIdx && fDate.getDate() === day;
  });
  
  if (!forecastDay) return null;
  
  // Calculate probability based on forecast
  const forecastHigh = forecastDay.highTemp;
  const tempDiff = forecastHigh - targetTemp;
  
  // Simple model: 5°F buffer zone where probability is uncertain
  let impliedProb;
  if (isAbove) {
    if (tempDiff > 5) impliedProb = 0.85;
    else if (tempDiff > 0) impliedProb = 0.65;
    else if (tempDiff > -5) impliedProb = 0.35;
    else impliedProb = 0.15;
  } else {
    if (tempDiff < -5) impliedProb = 0.85;
    else if (tempDiff < 0) impliedProb = 0.65;
    else if (tempDiff < 5) impliedProb = 0.35;
    else impliedProb = 0.15;
  }
  
  // Compare with Kalshi market price
  const kalshiProb = kalshiMarket.yesPrice / 100;
  const probabilityDiff = (impliedProb - kalshiProb) * 100; // In percentage points
  
  return {
    city,
    targetDate: `${monthStr}${dayStr}`,
    targetTemp,
    isAbove,
    forecastHigh,
    forecastDay: forecastDay.day,
    nwsForecast: forecastDay.shortForecast,
    impliedProbability: (impliedProb * 100).toFixed(1),
    kalshiProbability: (kalshiProb * 100).toFixed(1),
    probabilityDiff: probabilityDiff.toFixed(1),
    lagDetected: Math.abs(probabilityDiff) > 10, // >10% difference = potential lag
    recommendation: probabilityDiff > 10 ? 'BUY_YES' : probabilityDiff < -10 ? 'BUY_NO' : 'HOLD'
  };
}

async function main() {
  console.log('🔍 Starting Kalshi Trade Fetch v2.2...\n');
  const scanStartTime = Date.now();
  
  // Load historical data
  const history = await loadHistory();
  console.log(`📚 Loaded history for ${Object.keys(history).length} markets\n`);
  
  const allTrades = [];
  const errors = [];
  const whaleAlerts = [];
  const edgeDecayTracker = new EdgeDecayTracker();
  const winRateAnalytics = new WinRateAnalytics();
  const twitterSentiment = new TwitterSentimentAnalyzer();
  
  // Process series in parallel with concurrency limit
  console.log(`📊 Fetching ${SERIES.length} series with max 5 concurrent...\n`);
  
  for (let i = 0; i < SERIES.length; i += 5) {
    const batch = SERIES.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (series) => {
        try {
          const data = await fetchMarkets(series.ticker);
          return { series, data, error: null };
        } catch (err) {
          return { series, data: null, error: err };
        }
      })
    );
    
    // Process batch results
    for (const result of batchResults) {
      const { series, data, error } = result;
      
      if (error) {
        console.error(`  ❌ ${series.name}: ${error.message}`);
        errors.push({ series: series.ticker, error: error.message, timestamp: new Date().toISOString() });
        continue;
      }
      
      const markets = data.markets || [];
      console.log(`✅ ${series.name}: ${markets.length} markets`);
      
      for (const m of markets.slice(0, CONFIG.maxMarketsPerSeries)) {
        const yesPrice = m.yes_ask || m.yes_price || 0;
        const noPrice = m.no_ask || (100 - yesPrice);
        const volume = m.volume || 0;
        
        if (isClosingSoon(m.close_time)) continue;
        
        // Get market health
        const health = getMarketHealth(m);
        if (!health.isLiquid) {
          console.log(`  ⚠️ Skipping ${m.ticker}: poor liquidity (spread=${health.avgSpread.toFixed(1)}¢)`);
          continue;
        }
        
        // Detect whale activity
        const whaleData = detectWhale(volume, history, m.ticker);
        if (whaleData.isWhale) {
          console.log(`  🐋 WHALE ALERT: ${m.ticker} - Volume ${whaleData.spikeRatio.toFixed(1)}x average!`);
          whaleAlerts.push({
            ticker: m.ticker,
            volume,
            avgVolume: whaleData.avgVolume,
            spikeRatio: whaleData.spikeRatio,
            timestamp: new Date().toISOString()
          });
        }
        
        // Calculate momentum
        const momentum = calculateMomentum(yesPrice, history, m.ticker);
        
        // Calculate edge with time adjustment
        const edgeCalc = calculateEdge(yesPrice, series.baseProb, volume, m.close_time, series.category);
        
        // Calculate historical edge (CLV tracking)
        const clv = calculateHistoricalEdge(edgeCalc.edge, history, m.ticker);
        
        if (yesPrice >= CONFIG.minPrice && yesPrice <= CONFIG.maxPrice && 
            volume >= CONFIG.minVolume && edgeCalc.edge >= CONFIG.minEdge) {
          
          const kelly = calculateKelly(edgeCalc.edge, yesPrice);
          let recommendation = 'hold';
          if (edgeCalc.rScore >= 2.0) recommendation = 'strong_buy';
          else if (edgeCalc.rScore >= 1.5) recommendation = 'buy';
          
          // Determine urgency based on edge deterioration
          if (clv.isEdgeDeteriorating && edgeCalc.rScore >= 1.5) {
            recommendation = 'buy_urgent';
          }
          
          // Calculate risk metrics
          const riskMetrics = calculateRiskMetrics({
            ...kelly,
            yesPrice,
            edge: edgeCalc.edge
          });
          
          // Check alerts
          const alerts = checkAlerts(
            { ticker: m.ticker, rScore: edgeCalc.rScore.toFixed(2), edge: edgeCalc.edge.toFixed(1), closeTime: m.close_time },
            momentum,
            whaleData,
            clv
          );
          
          // Get performance attribution
          const attribution = getPerformanceAttribution(
            { rScore: edgeCalc.rScore.toFixed(2), timeAdjustment: (edgeCalc.timeAdjustment * 100).toFixed(1), volumeBoost: (edgeCalc.volumeBoost * 100).toFixed(1) },
            momentum,
            whaleData,
            clv
          );
          
          allTrades.push({
            ticker: m.ticker,
            title: cleanTitle(m.title),
            subtitle: m.subtitle || '',
            category: series.category,
            yesPrice,
            noPrice,
            yesBid: m.yes_bid,
            yesAsk: m.yes_ask,
            volume,
            closeTime: m.close_time,
            expiration: m.expiration_date || m.close_time,
            kalshiUrl: buildUrl(m.ticker),
            edge: edgeCalc.edge.toFixed(1),
            rScore: edgeCalc.rScore.toFixed(2),
            trueProbability: (edgeCalc.adjustedProb * 100).toFixed(1),
            marketProbability: (edgeCalc.marketProb * 100).toFixed(1),
            timeAdjustment: (edgeCalc.timeAdjustment * 100).toFixed(1),
            volumeBoost: (edgeCalc.volumeBoost * 100).toFixed(1),
            kellyPct: kelly.kellyPct,
            position: kelly.position,
            recommendation,
            multiplier: Math.round((100 - yesPrice) / yesPrice * 10) / 10,
            catalyst: `Base ${(series.baseProb * 100).toFixed(0)}% + Time ${edgeCalc.timeAdjustment >= 0 ? '+' : ''}${(edgeCalc.timeAdjustment * 100).toFixed(0)}% + Vol ${(edgeCalc.volumeBoost * 100).toFixed(0)}%`,
            confidence: edgeCalc.rScore >= 2 ? 'high' : edgeCalc.rScore >= 1 ? 'medium' : 'low',
            health: health.health,
            spread: health.avgSpread.toFixed(1),
            liquidityScore: health.liquidityScore,
            // New analytics fields
            whale: whaleData.isWhale,
            whaleSpikeRatio: whaleData.spikeRatio.toFixed(1),
            momentum: momentum.trend,
            momentumChange24h: momentum.change24h.toFixed(1),
            edgeChange: clv.edgeChange.toFixed(1),
            avgHistoricalEdge: clv.avgHistoricalEdge.toFixed(1),
            isEdgeDeteriorating: clv.isEdgeDeteriorating,
            // v2.4 fields - Risk metrics
            riskMetrics,
            alerts,
            attribution,
            sources: ['Kalshi API', 'Volume Analysis', 'Time Decay', 'Momentum', 'CLV', 'Risk Model']
          });
          
          // Record edge for decay tracking
          edgeDecayTracker.recordEdge(m.ticker, edgeCalc.edge.toFixed(1), edgeCalc.rScore.toFixed(2), yesPrice);
          
          // Update history
          if (!history[m.ticker]) history[m.ticker] = [];
          history[m.ticker].push({
            timestamp: Date.now(),
            price: yesPrice,
            volume,
            edge: edgeCalc.edge
          });
        }
      }
    }
  }
  
  const fetchTime = ((Date.now() - scanStartTime) / 1000).toFixed(1);
  console.log(`\n⚡ Fetched ${SERIES.length} series in ${fetchTime}s (parallel mode)\n`);
  
  // Save updated history
  await saveHistory(history);
  
  // Fetch Polymarket data with caching
  console.log('\n🔗 Checking Polymarket for arbitrage...');
  const pmEvents = await cachedFetch('polymarket', fetchPolymarketData, CONFIG.cache.polymarketTtl);
  console.log(`  Found ${pmEvents.length} Polymarket events`);
  
  // Calculate Polymarket arbitrage
  const polymarketArbs = [];
  for (const trade of allTrades) {
    const arb = calculatePolymarketArbitrage(trade, pmEvents);
    if (arb) {
      polymarketArbs.push(arb);
      trade.polymarketArb = arb;
    }
  }
  
  if (polymarketArbs.length > 0) {
    console.log(`  🎯 Found ${polymarketArbs.length} Polymarket arbitrage opportunities!`);
  }
  
  // Detect correlations using the CrossMarketCorrelation class
  const correlationMatrix = new CrossMarketCorrelation();
  const correlations = correlationMatrix.analyzeCorrelations(allTrades);
  
  // ==================== ALTERNATIVE DATA INTEGRATION ====================
  
  // Fetch and analyze RSS news feeds with caching
  console.log('\n📰 Fetching RSS news feeds...');
  const newsArticles = await cachedFetch('rss_feeds', fetchRSSFeeds, CONFIG.cache.rssTtl);
  console.log(`  Found ${newsArticles.length} news articles`);
  
  const relevantNews = matchNewsToMarkets(newsArticles, allTrades);
  console.log(`  ${relevantNews.length} articles relevant to tracked markets`);
  
  // Show top sentiment signals
  const positiveNews = relevantNews.filter(n => n.sentiment > 0.3);
  const negativeNews = relevantNews.filter(n => n.sentiment < -0.3);
  if (positiveNews.length > 0) console.log(`  📈 ${positiveNews.length} bullish signals`);
  if (negativeNews.length > 0) console.log(`  📉 ${negativeNews.length} bearish signals`);

  // Fetch Twitter/X sentiment
  const categorySentiment = await twitterSentiment.fetchCategorySentiment();
  twitterSentiment.printReport(categorySentiment);
  
  // NWS Weather Lag Detection for weather markets
  console.log('\n🌤️ Checking NWS weather forecasts for lag detection...');
  const weatherLags = [];
  const weatherTrades = allTrades.filter(t => t.category === 'weather');
  
  // Fetch forecasts for each unique city
  const nwsForecasts = {};
  for (const trade of weatherTrades) {
    const cityCode = trade.ticker.match(/KXHIGH([A-Z]+)/)?.[1];
    if (!cityCode || nwsForecasts[cityCode]) continue;
    
    const cityMap = { 'NY': 'NYC', 'CHI': 'CHI', 'SEA': 'SEA', 'MIA': 'MIA', 'TPHX': 'PHX' };
    const city = cityMap[cityCode];
    if (city) {
      const forecast = await cachedFetch(`nws_${city}`, () => fetchNWSForecast(city), CONFIG.cache.nwsTtl);
      if (forecast) {
        nwsForecasts[cityCode] = forecast;
        console.log(`  ✅ NWS ${city}: ${forecast.length} days forecast`);
      }
    }
  }
  
  // Detect lag for each weather trade
  for (const trade of weatherTrades) {
    const cityCode = trade.ticker.match(/KXHIGH([A-Z]+)/)?.[1];
    const forecast = nwsForecasts[cityCode];
    if (forecast) {
      const lag = detectWeatherLag(trade, forecast);
      if (lag && lag.lagDetected) {
        weatherLags.push(lag);
        trade.nwsSignal = lag;
        console.log(`  🔥 LAG: ${trade.ticker} - NWS says ${lag.forecastHigh}°F, Kalshi implies ${lag.kalshiProbability}% (diff: ${lag.probabilityDiff}%)`);
      }
    }
  }
  
  if (weatherLags.length > 0) {
    console.log(`  🎯 Found ${weatherLags.length} weather lag opportunities!`);
  }
  
  // ==================== END ALTERNATIVE DATA ====================
  
  // Calculate composite scores for top trades
  for (const trade of allTrades) {
    const tickerHistory = history[trade.ticker] || [];
    const momentum = calculateMomentum(trade.yesPrice, history, trade.ticker);
    const whaleData = detectWhale(trade.volume, history, trade.ticker);
    const clv = calculateHistoricalEdge(parseFloat(trade.edge), history, trade.ticker);
    
    const multiFactorScore = calculateMultiFactorScore(trade, momentum, clv, whaleData, relevantNews);
    trade.compositeScore = multiFactorScore.total.toFixed(2);
    trade.multiFactorScore = multiFactorScore; // Store full breakdown

    // Calculate Twitter/X sentiment for this trade
    const twitterSignal = twitterSentiment.calculateTradeSentiment(trade, categorySentiment, relevantNews);
    if (twitterSignal) {
      trade.twitterSignal = twitterSignal;
    }

    // Record for win rate analytics
    winRateAnalytics.recordTradeOpportunity(trade);
  }
  
  // Re-sort by composite score
  allTrades.sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
  
  // Check threshold-based alerts (AFTER all data is collected)
  console.log('\n🔔 Checking alert thresholds...');
  const alertManager = new AlertManager();
  const triggeredAlerts = alertManager.checkThresholds(allTrades, polymarketArbs, weatherLags);
  alertManager.printSummary();
  
  // Print edge decay report
  edgeDecayTracker.printDecayReport(allTrades);
  edgeDecayTracker.saveToFile();

  // Print correlation matrix report
  correlationMatrix.printCorrelationReport(correlations);

  // Print win rate analytics report
  winRateAnalytics.printReport();

  // Generate Portfolio Heat Map (using empty positions since this is a scanner, not portfolio tracker)
  const portfolioHeatMap = new PortfolioHeatMap(10000);
  const heatMapAnalysis = portfolioHeatMap.analyzePortfolio([], allTrades);
  portfolioHeatMap.printReport(heatMapAnalysis);

  // Dynamic Kelly Sizing Analysis
  const dynamicKelly = new DynamicKellySizing(10000);
  const kellyAnalysis = dynamicKelly.analyze(allTrades);
  dynamicKelly.printReport(kellyAnalysis);
  
  const arbitrage = detectArbitrage(allTrades);
  
  const byCategory = {
    weather: allTrades.filter(t => t.category === 'weather'),
    crypto: allTrades.filter(t => t.category === 'crypto'),
    politics: allTrades.filter(t => t.category === 'politics'),
    economics: allTrades.filter(t => t.category === 'economics')
  };
  
  for (const cat in byCategory) {
    byCategory[cat].sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
  }
  
  const topTrades = [
    ...byCategory.weather.slice(0, 10),
    ...byCategory.crypto.slice(0, 10),
    ...byCategory.politics.slice(0, 10),
    ...byCategory.economics.slice(0, 10)
  ].sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
  
  // Count all alerts
  const totalAlerts = topTrades.reduce((sum, t) => sum + (t.alerts?.length || 0), 0);
  
  // Get threshold alert counts by severity
  const thresholdUrgent = triggeredAlerts.filter(a => a.severity === 'urgent').length;
  const thresholdHigh = triggeredAlerts.filter(a => a.severity === 'high').length;
  const thresholdMedium = triggeredAlerts.filter(a => a.severity === 'medium').length;
  
  const output = {
    scan_time: new Date().toISOString(),
    source: 'kalshi-fetcher-v2.6',
    summary: {
      totalMarkets: SERIES.length * CONFIG.maxMarketsPerSeries,
      analyzed: allTrades.length,
      opportunities: topTrades.length,
      arbitrage: arbitrage.length,
      polymarketArbs: polymarketArbs.length,
      whaleAlerts: whaleAlerts.length,
      correlations: correlations.length,
      newsArticles: newsArticles.length,
      relevantNews: relevantNews.length,
      weatherLags: weatherLags.length,
      twitterSentiment: Object.keys(categorySentiment).filter(k => k !== 'fallback').length,
      totalAlerts,
      triggeredAlerts: {
        urgent: thresholdUrgent,
        high: thresholdHigh,
        medium: thresholdMedium,
        total: triggeredAlerts.length
      },
      errors: errors.length,
      byCategory: {
        weather: byCategory.weather.length,
        crypto: byCategory.crypto.length,
        politics: byCategory.politics.length,
        economics: byCategory.economics.length
      }
    },
    arbitrage,
    polymarketArbs,
    whaleAlerts,
    correlations,
    winRateStats: winRateAnalytics.calculateStats(),
    winRateRecommendations,
    twitterSentiment: categorySentiment,
    backtestResults,
    heatMap: heatMapAnalysis,
    kellyAnalysis,
    news: relevantNews.slice(0, 10), // Top 10 relevant news articles
    weatherLags,
    triggeredAlerts: triggeredAlerts.slice(0, 20), // Top 20 threshold alerts
    errors,
    opportunities: topTrades
  };
  
  const dataDir = path.join(__dirname, '..', 'kalshi_data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  fs.writeFileSync(path.join(dataDir, 'latest_scan.json'), JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved to kalshi_data/latest_scan.json`);
  
  if (db) {
    try {
      await db.ref('v6/kalshi/latest_scan').set(output);
      console.log('✅ Saved to Firebase');
    } catch (e) {
      console.error('❌ Firebase save failed:', e.message);
    }
  }
  
  console.log('\n📊 RESULTS:');
  console.log(`Opportunities: ${topTrades.length} | Arbitrage: ${arbitrage.length} | Polymarket: ${polymarketArbs.length} | Whales: ${whaleAlerts.length} | Correlations: ${correlations.length} | Weather Lags: ${weatherLags.length} | Alerts: ${totalAlerts} | Errors: ${errors.length}`);
  console.log('By category:', output.summary.byCategory);

  // Show multi-factor scoring summary
  if (topTrades.length > 0) {
    console.log('\n🎯 MULTI-FACTOR SCORING (v3.0):');
    console.log('  Weights: Edge 40% | Liquidity 20% | Time 15% | History 15% | Sentiment 10%');
    topTrades.slice(0, 3).forEach((t, i) => {
      if (t.multiFactorScore) {
        const b = t.multiFactorScore.breakdown;
        console.log(`  ${i + 1}. ${t.ticker}: ${t.multiFactorScore.total} total`);
        console.log(`     Edge: ${b.edgeQuality.toFixed(1)} | Liq: ${b.liquidityDepth.toFixed(1)} | Time: ${b.timeToExpiration.toFixed(1)} | Hist: ${b.historicalAccuracy.toFixed(1)} | Sent: ${b.newsSentiment.toFixed(1)}`);
      }
    });
  }
  
  // Show alternative data summary
  if (relevantNews.length > 0) {
    const avgSentiment = relevantNews.reduce((sum, n) => sum + n.sentiment, 0) / relevantNews.length;
    const sentimentEmoji = avgSentiment > 0.2 ? '📈' : avgSentiment < -0.2 ? '📉' : '➡️';
    console.log(`\n📰 NEWS SENTIMENT: ${sentimentEmoji} ${avgSentiment > 0 ? '+' : ''}${avgSentiment.toFixed(2)} (${relevantNews.length} relevant articles)`);
  }
  
  if (weatherLags.length > 0) {
    console.log('\n🌤️ WEATHER LAG OPPORTUNITIES:');
    weatherLags.slice(0, 5).forEach(w => {
      const action = w.recommendation === 'BUY_YES' ? '🔥 BUY YES' : w.recommendation === 'BUY_NO' ? '❄️ BUY NO' : 'HOLD';
      console.log(`  ${w.city} ${w.targetDate}: ${action} - NWS ${w.forecastHigh}°F vs Kalshi ${w.kalshiProbability}% (${w.probabilityDiff > 0 ? '+' : ''}${w.probabilityDiff}%)`);
    });
  }
  
  // Show alerts summary
  const urgentAlerts = topTrades.flatMap(t => t.alerts?.filter(a => a.severity === 'urgent') || []);
  if (urgentAlerts.length > 0) {
    console.log('\n🚨 URGENT ALERTS:');
    urgentAlerts.slice(0, 5).forEach(a => {
      console.log(`  ${a.ticker}: ${a.message}`);
    });
  }
  
  // Show Twitter sentiment signals
  const tradesWithTwitter = topTrades.filter(t => t.twitterSignal && (t.twitterSignal.strength === 'strong' || t.twitterSignal.strength === 'moderate'));
  if (tradesWithTwitter.length > 0) {
    console.log('\n🐦 TWITTER SENTIMENT SIGNALS:');
    tradesWithTwitter.slice(0, 5).forEach(t => {
      const emoji = t.twitterSignal.signal === 'bullish' ? '📈' : t.twitterSignal.signal === 'bearish' ? '📉' : '➡️';
      console.log(`  ${emoji} ${t.ticker}: ${t.twitterSignal.signal.toUpperCase()} (${t.twitterSignal.strength}) | Score: ${t.twitterSignal.score > 0 ? '+' : ''}${t.twitterSignal.score} | Source: ${t.twitterSignal.source}`);
    });
  }
  const corrSignals = correlationMatrix.getCorrelationSignals(correlations);
  if (corrSignals.length > 0) {
    console.log('\n🔗 CORRELATION SIGNALS:');
    corrSignals.slice(0, 5).forEach(s => {
      const signalEmoji = s.signal.direction.includes('UP') ? '📈' : '📉';
      console.log(`  ${signalEmoji} ${s.pair}: ${s.signal.message}`);
    });
  }
  
  if (whaleAlerts.length > 0) {
    console.log('\n🐋 WHALE ALERTS:');
    whaleAlerts.forEach(w => {
      console.log(`  ${w.ticker}: ${w.spikeRatio}x volume spike (${w.volume.toLocaleString()} vs avg ${Math.round(w.avgVolume).toLocaleString()})`);
    });
  }
  
  console.log('\n🎯 TOP 5 OPPORTUNITIES:');
  topTrades.slice(0, 5).forEach((t, i) => {
    const momentumIcon = t.momentum === 'surging' ? '🚀' : t.momentum === 'rising' ? '📈' : t.momentum === 'falling' ? '📉' : t.momentum === 'crashing' ? '💥' : '➡️';
    const whaleIcon = t.whale ? '🐋 ' : '';
    const urgentIcon = t.recommendation === 'buy_urgent' ? '🔥 ' : '';
    console.log(`${i + 1}. ${urgentIcon}${whaleIcon}${t.ticker} | ${t.title.slice(0, 25)}...`);
    console.log(`   📊 Score: ${t.compositeScore} | ${momentumIcon} ${t.yesPrice}¢ | 📈 +${t.edge}% edge | ⭐ ${t.rScore} R-score`);

    // Show multi-factor breakdown
    if (t.multiFactorScore) {
      const b = t.multiFactorScore.breakdown;
      console.log(`   🎯 Factors: Edge=${b.edgeQuality.toFixed(1)} Liq=${b.liquidityDepth.toFixed(1)} Time=${b.timeToExpiration.toFixed(1)} Hist=${b.historicalAccuracy.toFixed(1)} Sent=${b.newsSentiment.toFixed(1)}`);
    }

    if (t.whale) console.log(`   🐋 ${t.whaleSpikeRatio}x volume spike`);
    if (t.isEdgeDeteriorating) console.log(`   ⚠️ Edge deteriorating: ${t.edgeChange}%`);
    if (t.twitterSignal) console.log(`   🐦 Twitter: ${t.twitterSignal.signal.toUpperCase()} (${t.twitterSignal.strength}) | ${t.twitterSignal.score > 0 ? '+' : ''}${t.twitterSignal.score}`);
    if (t.riskMetrics) {
      console.log(`   💰 EV: $${t.riskMetrics.expectedValue} | Sharpe: ${t.riskMetrics.sharpeRatio} | Risk: ${t.riskMetrics.riskOfRuin}`);
    }
    if (t.attribution?.length > 0) {
      const topFactor = t.attribution[0];
      console.log(`   📈 Top factor: ${topFactor.factor} (+${topFactor.contribution.toFixed(2)})`);
    }
  });
  
  return output;
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✨ Done'); process.exit(0); })
    .catch(err => { console.error('\n💥 Fatal:', err); process.exit(1); });
}

module.exports = { main };
