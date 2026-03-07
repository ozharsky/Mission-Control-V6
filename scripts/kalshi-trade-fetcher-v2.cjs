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
  whaleVolumeThreshold: 50000,  // Volume spike threshold for whale detection
  whaleVolumeMultiplier: 3,      // 3x average volume = whale
  historyRetentionDays: 7       // Keep 7 days of price history
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load historical data for comparison
async function loadHistory() {
  try {
    if (db) {
      const snapshot = await db.ref('v6/kalshi/history').get();
      return snapshot.val() || {};
    }
    // Try local file fallback
    const historyPath = path.join(__dirname, '..', 'kalshi_data', 'price_history.json');
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
  } catch (e) {
    console.log('⚠️ Could not load history:', e.message);
  }
  return {};
}

// Save historical data
async function saveHistory(history) {
  try {
    // Clean old data
    const cutoff = Date.now() - (CONFIG.historyRetentionDays * 24 * 60 * 60 * 1000);
    for (const ticker in history) {
      history[ticker] = history[ticker].filter(h => h.timestamp > cutoff);
    }
    
    if (db) {
      await db.ref('v6/kalshi/history').set(history);
    }
    
    // Also save locally
    const historyPath = path.join(__dirname, '..', 'kalshi_data', 'price_history.json');
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

// Calculate composite score combining all factors
function calculateCompositeScore(trade, momentum, clv, whaleData) {
  let score = parseFloat(trade.rScore);
  
  if (momentum.trend === 'surging') score += 0.5;
  else if (momentum.trend === 'rising') score += 0.3;
  else if (momentum.trend === 'crashing') score -= 0.5;
  
  if (whaleData.isWhale) score += 0.3;
  if (clv.isEdgeDeteriorating) score -= 0.5;
  
  return Math.max(0, score);
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

async function main() {
  console.log('🔍 Starting Kalshi Trade Fetch v2.2...\n');
  
  // Load historical data
  const history = await loadHistory();
  console.log(`📚 Loaded history for ${Object.keys(history).length} markets\n`);
  
  const allTrades = [];
  const errors = [];
  const whaleAlerts = [];
  
  for (let i = 0; i < SERIES.length; i++) {
    const series = SERIES[i];
    if (i > 0) await delay(CONFIG.requestDelay);
    
    try {
      console.log(`📊 ${series.name}...`);
      const data = await fetchMarkets(series.ticker);
      const markets = data.markets || [];
      console.log(`  Found ${markets.length} markets`);
      
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
            sources: ['Kalshi API', 'Volume Analysis', 'Time Decay', 'Momentum', 'CLV']
          });
          
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
    } catch (err) {
      console.error(`  ❌ ${series.name}: ${err.message}`);
      errors.push({ series: series.ticker, error: err.message, timestamp: new Date().toISOString() });
    }
  }
  
  // Save updated history
  await saveHistory(history);
  
  // Detect correlations
  const correlations = detectCorrelations(allTrades);
  
  // Calculate composite scores for top trades
  for (const trade of allTrades) {
    const tickerHistory = history[trade.ticker] || [];
    const momentum = calculateMomentum(trade.yesPrice, history, trade.ticker);
    const whaleData = detectWhale(trade.volume, history, trade.ticker);
    const clv = calculateHistoricalEdge(parseFloat(trade.edge), history, trade.ticker);
    
    trade.compositeScore = calculateCompositeScore(trade, momentum, clv, whaleData).toFixed(2);
  }
  
  // Re-sort by composite score
  allTrades.sort((a, b) => parseFloat(b.compositeScore) - parseFloat(a.compositeScore));
  
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
  
  const output = {
    scan_time: new Date().toISOString(),
    source: 'kalshi-fetcher-v2.3',
    summary: {
      totalMarkets: SERIES.length * CONFIG.maxMarketsPerSeries,
      analyzed: allTrades.length,
      opportunities: topTrades.length,
      arbitrage: arbitrage.length,
      whaleAlerts: whaleAlerts.length,
      correlations: correlations.length,
      errors: errors.length,
      byCategory: {
        weather: byCategory.weather.length,
        crypto: byCategory.crypto.length,
        politics: byCategory.politics.length,
        economics: byCategory.economics.length
      }
    },
    arbitrage,
    whaleAlerts,
    correlations,
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
  console.log(`Opportunities: ${topTrades.length} | Arbitrage: ${arbitrage.length} | Whales: ${whaleAlerts.length} | Correlations: ${correlations.length} | Errors: ${errors.length}`);
  console.log('By category:', output.summary.byCategory);
  
  if (correlations.length > 0) {
    console.log('\n🔗 CORRELATIONS:');
    correlations.slice(0, 5).forEach(c => {
      console.log(`  ${c.category}: ${c.market1} ↔ ${c.market2} (${c.correlation})`);
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
    console.log(`   📊 Composite: ${t.compositeScore} | ${momentumIcon} ${t.yesPrice}¢ | 📈 +${t.edge}% edge | ⭐ ${t.rScore} R-score`);
    if (t.whale) console.log(`   🐋 ${t.whaleSpikeRatio}x volume spike`);
    if (t.isEdgeDeteriorating) console.log(`   ⚠️ Edge deteriorating: ${t.edgeChange}%`);
  });
  
  return output;
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✨ Done'); process.exit(0); })
    .catch(err => { console.error('\n💥 Fatal:', err); process.exit(1); });
}

module.exports = { main };
