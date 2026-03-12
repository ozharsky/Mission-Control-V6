#!/usr/bin/env node
/**
 * Kalshi Historical Data Fetcher
 * Fetches resolved markets from Kalshi historical API for ML training
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load from main scanner config
const CONFIG = {
  kalshiApiHost: 'api.elections.kalshi.com',
  outputDir: path.join(__dirname, '..', 'kalshi_data', 'historical'),
  batchSize: 100,
  maxMarkets: 1000 // Limit for initial fetch
};

// Ensure output directory exists (including parents)
async function ensureOutputDir() {
  const parentDir = path.dirname(CONFIG.outputDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

// Get API credentials from env
const KALSHI_ACCESS_KEY = process.env.KALSHI_API_KEY || process.env.KALSHI_ACCESS_KEY || '';
const KALSHI_PRIVATE_KEY = process.env.KALSHI_PRIVATE_KEY || '';

// Helper: Make authenticated request to Kalshi API
async function kalshiRequest(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    
    const path = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    const options = {
      hostname: CONFIG.kalshiApiHost,
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KalshiHistoricalFetcher/1.0'
      }
    };

    // Add auth if available
    if (KALSHI_ACCESS_KEY && KALSHI_PRIVATE_KEY) {
      const timestamp = Date.now().toString();
      const signature = signRequest('GET', path, timestamp);
      options.headers['KALSHI-ACCESS-KEY'] = KALSHI_ACCESS_KEY;
      options.headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
      options.headers['KALSHI-ACCESS-SIGNATURE'] = signature;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

// Proper RSA-PSS signing (same as main scanner)
function signRequest(method, path, timestamp) {
  if (!KALSHI_PRIVATE_KEY) {
    throw new Error('KALSHI_PRIVATE_KEY not set');
  }
  
  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${timestamp}${method}${path}`);
  sign.end();
  
  return sign.sign({
    key: KALSHI_PRIVATE_KEY,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, 'base64');
}

// Fetch historical cutoff timestamps
async function getHistoricalCutoff() {
  console.log('Fetching historical cutoff timestamps...');
  try {
    const data = await kalshiRequest('/trade-api/v2/historical/cutoff');
    console.log('Cutoff timestamps:', JSON.stringify(data, null, 2));
    return data;
  } catch (e) {
    console.error('Failed to fetch cutoff:', e.message);
    return null;
  }
}

// Fetch historical markets
async function fetchHistoricalMarkets(seriesTicker = null, limit = 100, cursor = null) {
  const params = {
    limit: Math.min(limit, 100),
    status: 'closed' // Only resolved markets
  };
  
  if (seriesTicker) {
    params.series_ticker = seriesTicker;
  }
  
  if (cursor) {
    params.cursor = cursor;
  }

  console.log(`Fetching historical markets${seriesTicker ? ` for ${seriesTicker}` : ''}...`);
  
  try {
    const data = await kalshiRequest('/trade-api/v2/historical/markets', params);
    return data;
  } catch (e) {
    console.error('Failed to fetch markets:', e.message);
    return null;
  }
}

// Fetch single market details
async function fetchHistoricalMarket(ticker) {
  try {
    const data = await kalshiRequest(`/trade-api/v2/historical/markets/${ticker}`);
    return data.market;
  } catch (e) {
    console.error(`Failed to fetch market ${ticker}:`, e.message);
    return null;
  }
}

// Fetch candlestick data for a market
async function fetchMarketCandlesticks(ticker, startDate, endDate) {
  const params = {
    start_date: startDate,
    end_date: endDate,
    period: '1d'
  };
  
  try {
    const data = await kalshiRequest(
      `/trade-api/v2/historical/markets/${ticker}/candlesticks`,
      params
    );
    return data.candlesticks || [];
  } catch (e) {
    console.error(`Failed to fetch candlesticks for ${ticker}:`, e.message);
    return [];
  }
}

// Build training dataset from historical markets
async function buildTrainingDataset() {
  console.log('\n=== Building ML Training Dataset ===\n');
  
  const allMarkets = [];
  let cursor = null;
  let fetched = 0;
  
  // Fetch markets in batches
  while (fetched < CONFIG.maxMarkets) {
    const batch = await fetchHistoricalMarkets(null, CONFIG.batchSize, cursor);
    
    if (!batch || !batch.markets || batch.markets.length === 0) {
      console.log('No more markets to fetch');
      break;
    }
    
    // Filter to markets with resolution (yes/no outcome)
    const resolved = batch.markets.filter(m => 
      m.status === 'closed' && 
      m.result !== null && 
      m.result !== undefined
    );
    
    console.log(`Batch: ${batch.markets.length} markets, ${resolved.length} resolved`);
    
    // Process each resolved market
    for (const market of resolved) {
      const trainingRecord = {
        ticker: market.ticker,
        title: market.title,
        series_ticker: market.series_ticker,
        category: inferCategory(market.series_ticker),
        open_time: market.open_time,
        close_time: market.close_time,
        result: market.result, // 'yes' or 'no' - the label!
        
        // Features we can extract
        yes_price: market.yes_price,
        no_price: market.no_price,
        volume: market.volume,
        open_interest: market.open_interest,
        
        // Would need to fetch candlesticks for price history
        // Would need to calculate: edge, rScore, sentiment, etc.
      };
      
      allMarkets.push(trainingRecord);
    }
    
    fetched += batch.markets.length;
    cursor = batch.cursor;
    
    if (!cursor) break;
    
    // Rate limiting
    await delay(500);
  }
  
  console.log(`\nTotal resolved markets: ${allMarkets.length}`);
  
  // Ensure output directory exists before saving
  await ensureOutputDir();
  
  // Save dataset
  const outputPath = path.join(CONFIG.outputDir, 'training_dataset.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    fetched_at: new Date().toISOString(),
    count: allMarkets.length,
    markets: allMarkets
  }, null, 2));
  
  console.log(`Dataset saved to: ${outputPath}`);
  
  // Print statistics
  const byCategory = {};
  const byResult = { yes: 0, no: 0 };
  
  for (const m of allMarkets) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    byResult[m.result] = (byResult[m.result] || 0) + 1;
  }
  
  console.log('\n=== Dataset Statistics ===');
  console.log('By Category:', byCategory);
  console.log('By Result:', byResult);
  console.log(`Yes rate: ${(byResult.yes / allMarkets.length * 100).toFixed(1)}%`);
  
  return allMarkets;
}

// Infer category from series ticker
function inferCategory(seriesTicker) {
  const prefixes = {
    'KXHIGH': 'weather',
    'KXBTC': 'crypto',
    'KXETH': 'crypto',
    'KXSOL': 'crypto',
    'KXADA': 'crypto',
    'KXDOT': 'crypto',
    'KXTRUMP': 'politics',
    'KX538': 'politics',
    'KXFED': 'economics',
    'KXCPI': 'economics',
    'KXJOBS': 'economics',
    'KXGDP': 'economics'
  };
  
  for (const [prefix, category] of Object.entries(prefixes)) {
    if (seriesTicker.startsWith(prefix)) return category;
  }
  
  return 'other';
}

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
async function main() {
  console.log('=== Kalshi Historical Data Fetcher ===\n');
  
  // Check credentials
  if (!KALSHI_ACCESS_KEY) {
    console.error('❌ KALSHI_API_KEY not set');
    process.exit(1);
  }
  
  // Get cutoff info
  const cutoff = await getHistoricalCutoff();
  if (cutoff) {
    console.log(`\nMarkets settled before ${cutoff.market_settled_ts} are in historical API`);
  }
  
  // Build dataset
  const dataset = await buildTrainingDataset();
  
  console.log('\n=== Done ===');
  console.log(`Next steps:`);
  console.log(`1. Fetch candlestick data for price history`);
  console.log(`2. Calculate features (edge, rScore, sentiment)`);
  console.log(`3. Train ML model on outcomes`);
}

// Run if called directly
if (require.main === module) {
  main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

module.exports = {
  fetchHistoricalMarkets,
  fetchHistoricalMarket,
  fetchMarketCandlesticks,
  buildTrainingDataset
};