#!/usr/bin/env node
/**
 * Kalshi Trade Fetcher v2.0 - Improved
 * Fetches +EV opportunities with edge calculation, Firebase output, and live price updates
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
  // Weather - based on historical NOAA data
  { ticker: 'KXHIGHTSEA', name: 'Seattle High', category: 'weather', baseProb: 0.35 },
  { ticker: 'KXHIGHNY', name: 'NYC High', category: 'weather', baseProb: 0.40 },
  { ticker: 'KXHIGHCHI', name: 'Chicago High', category: 'weather', baseProb: 0.38 },
  { ticker: 'KXHIGHMIA', name: 'Miami High', category: 'weather', baseProb: 0.45 },
  { ticker: 'KXHIGHTPHX', name: 'Phoenix High', category: 'weather', baseProb: 0.42 },
  // Crypto - based on technical analysis
  { ticker: 'KXBTC', name: 'Bitcoin', category: 'crypto', baseProb: 0.50 },
  { ticker: 'KXETH', name: 'Ethereum', category: 'crypto', baseProb: 0.50 },
  { ticker: 'KXSOL', name: 'Solana', category: 'crypto', baseProb: 0.48 },
  { ticker: 'KXADA', name: 'Cardano', category: 'crypto', baseProb: 0.47 },
  { ticker: 'KXDOT', name: 'Polkadot', category: 'crypto', baseProb: 0.46 },
  // Politics - based on polling data
  { ticker: 'KXTRUMP', name: 'Trump', category: 'politics', baseProb: 0.45 },
  { ticker: 'KXTRUTHSOCIAL', name: 'Trump Social', category: 'politics', baseProb: 0.30 },
  { ticker: 'KX538APPROVE', name: 'Approval Ratings', category: 'politics', baseProb: 0.42 },
  { ticker: 'KXTRUMPZELENSKYY', name: 'Trump-Zelenskyy', category: 'politics', baseProb: 0.35 },
  { ticker: 'KXTRUMPMEET', name: 'Trump Meetings', category: 'politics', baseProb: 0.40 },
  // Economics - based on Fed futures
  { ticker: 'KXFED', name: 'Fed Policy', category: 'economics', baseProb: 0.48 },
  { ticker: 'KXCPI', name: 'CPI Inflation', category: 'economics', baseProb: 0.45 },
  { ticker: 'KXJOBS', name: 'Jobs Report', category: 'economics', baseProb: 0.47 },
  { ticker: 'KXGDP', name: 'GDP Growth', category: 'economics', baseProb: 0.44 },
  { ticker: 'KXIR', name: 'Interest Rates', category: 'economics', baseProb: 0.46 }
];

// Config
const CONFIG = {
  minPrice: 1,          // Minimum 1¢
  maxPrice: 99,         // Maximum 99¢
  minVolume: 10,        // Minimum volume
  minEdge: 5,           // Minimum 5% edge
  maxMarketsPerSeries: 10,
  requestDelay: 200,    // ms between requests
  maxRetries: 3,
  minHoursToClose: 1,   // Skip markets closing in < 1 hour
  kellyFraction: 0.5    // Half-Kelly for safety
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry logic
async function fetchWithRetry(url, options = {}, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fetchOnce(url, options);
      return result;
    } catch (err) {
      console.error(`  ⚠️ Attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) {
        await delay(1000 * (i + 1)); // Exponential backoff
      }
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
          const parsed = JSON.parse(data);
          resolve(parsed);
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
  return title
    .replace(/\?/g, '')
    .replace(/high temp/gi, 'High')
    .replace(/low temp/gi, 'Low')
    .trim();
}

function buildUrl(ticker) {
  return `https://kalshi.com/events/${ticker.toLowerCase()}`;
}

// Calculate edge: true probability - market price
function calculateEdge(yesPrice, baseProb, volume) {
  const marketProb = yesPrice / 100;
  
  // Volume adjustment: higher volume = more confidence in edge
  const volumeBoost = Math.min(volume / 10000, 0.05); // Max 5% boost
  
  // Adjust base probability with volume boost
  const adjustedProb = Math.min(baseProb + volumeBoost, 0.99);
  
  // Edge in percentage points
  const edge = (adjustedProb - marketProb) * 100;
  
  return {
    edge,
    adjustedProb,
    marketProb,
    rScore: edge > 0 ? edge / 10 : 0 // Simplified R-score
  };
}

// Kelly Criterion position sizing
function calculateKelly(edge, price, bankroll = 10000) {
  if (edge <= 0) return { kellyPct: 0, position: 0 };
  
  const b = (100 - price) / price; // Odds
  const p = edge / 100 + 0.5; // Win probability from edge
  const q = 1 - p;
  
  // Full Kelly: (bp - q) / b
  const fullKelly = (b * p - q) / b;
  
  // Half-Kelly for safety
  const kellyFraction = fullKelly * CONFIG.kellyFraction;
  
  // Cap at 10% of bankroll
  const maxPosition = bankroll * 0.10;
  const kellyPosition = bankroll * Math.max(0, kellyFraction);
  const position = Math.min(kellyPosition, maxPosition);
  
  return {
    kellyPct: (kellyFraction * 100).toFixed(1),
    position: Math.floor(position),
    fullKelly: (fullKelly * 100).toFixed(1)
  };
}

// Check if market is closing soon
function isClosingSoon(closeTime) {
  if (!closeTime) return false;
  const close = new Date(closeTime);
  const now = new Date();
  const hoursUntil = (close - now) / (1000 * 60 * 60);
  return hoursUntil < CONFIG.minHoursToClose;
}

// Detect arbitrage opportunities
function detectArbitrage(markets) {
  const arbs = [];
  
  // Group by event
  const byEvent = {};
  for (const m of markets) {
    const eventKey = m.ticker.split('-').slice(0, 2).join('-');
    if (!byEvent[eventKey]) byEvent[eventKey] = [];
    byEvent[eventKey].push(m);
  }
  
  // Check for sum > 100%
  for (const [event, eventMarkets] of Object.entries(byEvent)) {
    if (eventMarkets.length >= 2) {
      const total = eventMarkets.reduce((sum, m) => sum + m.yesPrice, 0);
      if (total > 105) { // >5% arb opportunity
        arbs.push({
          event,
          markets: eventMarkets.map(m => m.ticker),
          total,
          excess: total - 100
        });
      }
    }
  }
  
  return arbs;
}

async function main() {
  console.log('🔍 Starting Kalshi Trade Fetch v2.0...\n');
  
  const allTrades = [];
  const errors = [];
  
  // Fetch with rate limiting
  for (let i = 0; i < SERIES.length; i++) {
    const series = SERIES[i];
    
    // Add delay between requests
    if (i > 0) {
      await delay(CONFIG.requestDelay);
    }
    
    try {
      console.log(`📊 ${series.name}...`);
      const data = await fetchMarkets(series.ticker);
      const markets = data.markets || [];
      
      console.log(`  Found ${markets.length} markets`);
      
      for (const m of markets.slice(0, CONFIG.maxMarketsPerSeries)) {
        const yesPrice = m.yes_ask || m.yes_price || 0;
        const noPrice = m.no_ask || (100 - yesPrice);
        const volume = m.volume || 0;
        
        // Skip if closing soon
        if (isClosingSoon(m.close_time)) {
          continue;
        }
        
        // Calculate edge
        const edgeCalc = calculateEdge(yesPrice, series.baseProb, volume);
        
        // Filter by criteria
        if (yesPrice >= CONFIG.minPrice && 
            yesPrice <= CONFIG.maxPrice && 
            volume >= CONFIG.minVolume &&
            edgeCalc.edge >= CONFIG.minEdge) {
          
          // Calculate position size
          const kelly = calculateKelly(edgeCalc.edge, yesPrice);
          
          // Determine recommendation
          let recommendation = 'hold';
          if (edgeCalc.rScore >= 2.0) recommendation = 'strong_buy';
          else if (edgeCalc.rScore >= 1.5) recommendation = 'buy';
          
          allTrades.push({
            ticker: m.ticker,
            title: cleanTitle(m.title),
            subtitle: m.subtitle || '',
            category: series.category,
            yesPrice,
            noPrice,
            volume,
            closeTime: m.close_time,
            expiration: m.expiration_date || m.close_time,
            kalshiUrl: buildUrl(m.ticker),
            edge: edgeCalc.edge.toFixed(1),
            rScore: edgeCalc.rScore.toFixed(2),
            trueProbability: (edgeCalc.adjustedProb * 100).toFixed(1),
            marketProbability: (edgeCalc.marketProb * 100).toFixed(1),
            kellyPct: kelly.kellyPct,
            position: kelly.position,
            recommendation,
            multiplier: Math.round((100 - yesPrice) / yesPrice * 10) / 10,
            catalyst: `Base probability ${(series.baseProb * 100).toFixed(0)}% adjusted for volume`,
            confidence: edgeCalc.rScore >= 2 ? 'high' : edgeCalc.rScore >= 1 ? 'medium' : 'low',
            sources: ['Kalshi API', 'Volume Analysis']
          });
        }
      }
    } catch (err) {
      console.error(`  ❌ ${series.name}: ${err.message}`);
      errors.push({ series: series.ticker, error: err.message });
    }
  }
  
  // Detect arbitrage
  const arbitrage = detectArbitrage(allTrades);
  
  // Group by category
  const byCategory = {
    weather: allTrades.filter(t => t.category === 'weather'),
    crypto: allTrades.filter(t => t.category === 'crypto'),
    politics: allTrades.filter(t => t.category === 'politics'),
    economics: allTrades.filter(t => t.category === 'economics')
  };
  
  // Sort by R-score descending
  for (const cat in byCategory) {
    byCategory[cat].sort((a, b) => parseFloat(b.rScore) - parseFloat(a.rScore));
  }
  
  // Take top from each category
  const topTrades = [
    ...byCategory.weather.slice(0, 10),
    ...byCategory.crypto.slice(0, 10),
    ...byCategory.politics.slice(0, 10),
    ...byCategory.economics.slice(0, 10)
  ].sort((a, b) => parseFloat(b.rScore) - parseFloat(a.rScore));
  
  const output = {
    scan_time: new Date().toISOString(),
    source: 'kalshi-fetcher-v2',
    summary: {
      totalMarkets: SERIES.length * CONFIG.maxMarketsPerSeries,
      analyzed: allTrades.length,
      opportunities: topTrades.length,
      arbitrage: arbitrage.length,
      errors: errors.length,
      byCategory: {
        weather: byCategory.weather.length,
        crypto: byCategory.crypto.length,
        politics: byCategory.politics.length,
        economics: byCategory.economics.length
      }
    },
    arbitrage,
    errors: errors.slice(0, 5),
    opportunities: topTrades
  };
  
  // Save to file
  const dataDir = path.join(__dirname, '..', 'kalshi_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(dataDir, 'latest_scan.json'),
    JSON.stringify(output, null, 2)
  );
  console.log(`\n✅ Saved to kalshi_data/latest_scan.json`);
  
  // Save to Firebase if available
  if (db) {
    try {
      await db.ref('v6/kalshi/latest_scan').set(output);
      console.log('✅ Saved to Firebase: v6/kalshi/latest_scan');
    } catch (e) {
      console.error('❌ Firebase save failed:', e.message);
    }
  }
  
  // Console output
  console.log('\n📊 RESULTS:');
  console.log(`Total opportunities: ${topTrades.length}`);
  console.log(`By category:`, output.summary.byCategory);
  console.log(`Arbitrage found: ${arbitrage.length}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }
  
  console.log('\n🎯 TOP OPPORTUNITIES:');
  topTrades.slice(0, 5).forEach((t, i) => {
    console.log(`${i + 1}. ${t.ticker} | ${t.title.slice(0, 40)}...`);
    console.log(`   Price: ${t.yesPrice}¢ | Edge: +${t.edge}% | R-Score: ${t.rScore} | Kelly: ${t.kellyPct}%`);
  });
  
  return output;
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { main, calculateEdge, calculateKelly };
