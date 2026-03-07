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
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', category: 'crypto' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', category: 'crypto' },
    // Politics
    { name: 'Politico', url: 'https://www.politico.com/rss/politics08.xml', category: 'politics' },
    { name: 'TheHill', url: 'https://thehill.com/rss/syndicator/19110', category: 'politics' },
    // Markets/Finance
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories', category: 'markets' },
    { name: 'YahooFinance', url: 'https://finance.yahoo.com/news/rssindex', category: 'markets' },
    // General News
    { name: 'BBC', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', category: 'general' },
    { name: 'CNN', url: 'http://rss.cnn.com/rss/edition.rss', category: 'general' },
    // Weather
    { name: 'WeatherChannel', url: 'https://weather.com/en-us/weather/today/l/98354:4:US', category: 'weather', isWeather: true }
  ];
  
  const articles = [];
  
  for (const feed of feeds) {
    try {
      // Add timeout and better headers
      const data = await fetchWithRetry(feed.url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; KalshiScanner/2.6)',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        }
      }, 1);
      
      // Check if we got valid XML
      if (!data || typeof data !== 'string' || data.length < 100) {
        console.log(`  ⚠️ RSS ${feed.name}: Empty or invalid response`);
        continue;
      }
      
      const items = parseRSS(data, feed.name, feed.category);
      if (items.length > 0) {
        console.log(`  ✅ ${feed.name}: ${items.length} articles`);
        articles.push(...items);
      } else {
        console.log(`  ⚠️ ${feed.name}: No articles parsed`);
      }
    } catch (e) {
      console.log(`  ⚠️ RSS ${feed.name}: ${e.message.slice(0, 50)}`);
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
  
  // Fetch Polymarket data
  console.log('\n🔗 Checking Polymarket for arbitrage...');
  const pmEvents = await fetchPolymarketData();
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
  
  // Detect correlations
  const correlations = detectCorrelations(allTrades);
  
  // ==================== ALTERNATIVE DATA INTEGRATION ====================
  
  // Fetch and analyze RSS news feeds
  console.log('\n📰 Fetching RSS news feeds...');
  const newsArticles = await fetchRSSFeeds();
  console.log(`  Found ${newsArticles.length} news articles`);
  
  const relevantNews = matchNewsToMarkets(newsArticles, allTrades);
  console.log(`  ${relevantNews.length} articles relevant to tracked markets`);
  
  // Show top sentiment signals
  const positiveNews = relevantNews.filter(n => n.sentiment > 0.3);
  const negativeNews = relevantNews.filter(n => n.sentiment < -0.3);
  if (positiveNews.length > 0) console.log(`  📈 ${positiveNews.length} bullish signals`);
  if (negativeNews.length > 0) console.log(`  📉 ${negativeNews.length} bearish signals`);
  
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
      const forecast = await fetchNWSForecast(city);
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
  
  // Count all alerts
  const totalAlerts = topTrades.reduce((sum, t) => sum + (t.alerts?.length || 0), 0);
  
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
      totalAlerts,
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
    news: relevantNews.slice(0, 10), // Top 10 relevant news articles
    weatherLags,
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
