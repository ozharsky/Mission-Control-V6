#!/usr/bin/env node
/**
 * Kalshi Trade Reporter
 * Simple version: Reports top markets by cheap price + volume
 * Posts to Discord every hour
 */

const https = require('https');

// Series to monitor
const SERIES = [
  // Weather
  { ticker: 'KXHIGHTSEA', name: 'Seattle Weather', category: 'weather' },
  { ticker: 'KXHIGHNY', name: 'NYC Weather', category: 'weather' },
  { ticker: 'KXHIGHCHI', name: 'Chicago Weather', category: 'weather' },
  { ticker: 'KXHIGHMIA', name: 'Miami Weather', category: 'weather' },
  { ticker: 'KXHIGHTPHX', name: 'Phoenix Weather', category: 'weather' },
  // Crypto
  { ticker: 'KXBTC', name: 'Bitcoin', category: 'crypto' },
  { ticker: 'KXETH', name: 'Ethereum', category: 'crypto' },
  { ticker: 'KXSOL', name: 'Solana', category: 'crypto' },
  { ticker: 'KXADA', name: 'Cardano', category: 'crypto' },
  { ticker: 'KXDOT', name: 'Polkadot', category: 'crypto' },
  // Politics
  { ticker: 'KXTRUMP', name: 'Trump', category: 'politics' },
  { ticker: 'KXTRUTHSOCIAL', name: 'Trump Social', category: 'politics' },
  { ticker: 'KX538APPROVE', name: 'Approval Ratings', category: 'politics' },
  { ticker: 'KXTRUMPZELENSKYY', name: 'Trump-Zelenskyy', category: 'politics' },
  { ticker: 'KXTRUMPMEET', name: 'Trump Meetings', category: 'politics' },
  // Economics
  { ticker: 'KXFED', name: 'Fed Policy', category: 'economics' },
  { ticker: 'KXCPI', name: 'CPI Inflation', category: 'economics' },
  { ticker: 'KXJOBS', name: 'Jobs Report', category: 'economics' },
  { ticker: 'KXGDP', name: 'GDP Growth', category: 'economics' },
  { ticker: 'KXIR', name: 'Interest Rates', category: 'economics' }
];

function fetchMarkets(seriesTicker) {
  return new Promise((resolve, reject) => {
    const url = `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${seriesTicker}&limit=20`;
    
    https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).markets || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/Will the /gi, '')
    .replace(/Will /gi, '')
    .replace(/on Mar \d+, 2026\?/gi, '')
    .replace(/\?/g, '')
    .replace(/high temp/gi, 'High')
    .replace(/low temp/gi, 'Low')
    .trim();
}

function buildUrl(ticker, series) {
  return `https://kalshi.com/markets/${(series || ticker.split('-')[0]).toLowerCase()}`;
}

async function main() {
  const allTrades = [];
  
  for (const series of SERIES) {
    try {
      const markets = await fetchMarkets(series.ticker);
      
      for (const m of markets) {
        const price = m.yes_ask || 0;
        const volume = m.volume || 0;
        
        // Filter: cheap price, decent volume, active
        if (price >= 1 && price <= 25 && volume >= 50 && m.status === 'active') {
          allTrades.push({
            ticker: m.ticker,
            title: cleanTitle(m.title),
            full_title: m.title,
            category: series.category,
            yes_price: price,
            kalshi_url: buildUrl(m.ticker, series.ticker),
            volume: volume,
            close_time: m.close_time,
            multiplier: Math.round((100 - price) / price)
          });
        }
      }
    } catch (err) {
      console.error(`Error: ${series.name} - ${err.message}`);
    }
  }
  
  // Group by category
  const byCategory = {
    weather: allTrades.filter(t => t.category === 'weather'),
    crypto: allTrades.filter(t => t.category === 'crypto'),
    politics: allTrades.filter(t => t.category === 'politics'),
    economics: allTrades.filter(t => t.category === 'economics')
  };
  
  // Sort each category by: cheap price first, then high volume
  for (const cat in byCategory) {
    byCategory[cat].sort((a, b) => {
      if (a.yes_price !== b.yes_price) return a.yes_price - b.yes_price;
      return b.volume - a.volume;
    });
  }
  
  // Take top 10 from each category
  const topTrades = [
    ...byCategory.weather.slice(0, 10),
    ...byCategory.crypto.slice(0, 10),
    ...byCategory.politics.slice(0, 10),
    ...byCategory.economics.slice(0, 10)
  ];
  
  // Output with breakdown
  const output = {
    trades_update: true,
    timestamp: new Date().toISOString(),
    source: 'kalshi-trader',
    total_found: topTrades.length,
    breakdown: {
      weather: byCategory.weather.length,
      crypto: byCategory.crypto.length,
      politics: byCategory.politics.length,
      economics: byCategory.economics.length
    },
    trades: topTrades
  };
  
  console.log(JSON.stringify(output, null, 2));
}

main();
