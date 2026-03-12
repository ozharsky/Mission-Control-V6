/**
 * Kalshi Resolution Fetcher
 *
 * Fetches resolved market outcomes from Kalshi API
 * and updates Brier scores for recorded predictions.
 */

const https = require('https');
const crypto = require('crypto');
const {
  loadPredictions,
  resolvePrediction,
  updateMetrics,
  savePredictions
} = require('./brier-tracker.cjs');

const KALSHI_API_HOST = 'api.elections.kalshi.com';

/**
 * Sign request for Kalshi API authentication
 */
function signKalshiRequest(privateKey, method, path, timestamp) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${timestamp}${method}${path}`);
  sign.end();

  return sign.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, 'base64');
}

/**
 * Make authenticated request to Kalshi API
 *
 * @param {string} path - API path
 * @param {Object} auth - Auth object with accessKey and privateKey
 * @returns {Promise} API response
 */
async function kalshiRequest(path, auth) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();

    const options = {
      hostname: KALSHI_API_HOST,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Kalshi-Resolution-Fetcher/1.0'
      }
    };

    // Add proper Kalshi authentication
    if (auth && auth.accessKey && auth.privateKey) {
      const signature = signKalshiRequest(auth.privateKey, 'GET', path, timestamp);
      options.headers['KALSHI-ACCESS-KEY'] = auth.accessKey;
      options.headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;
      options.headers['KALSHI-ACCESS-SIGNATURE'] = signature;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetch closed markets from Kalshi
 *
 * @param {Object} auth - Auth credentials
 * @param {Object} options - Query options
 * @returns {Promise} List of markets
 */
async function fetchClosedMarkets(auth, options = {}) {
  const {
    limit = 100,
    cursor = null,
    eventTicker = null,
    seriesTicker = null,
    withNestedMarkets = true
  } = options;

  let path = `/trade-api/v2/markets?status=closed&limit=${limit}`;

  if (cursor) path += `&cursor=${cursor}`;
  if (eventTicker) path += `&event_ticker=${eventTicker}`;
  if (seriesTicker) path += `&series_ticker=${seriesTicker}`;
  if (withNestedMarkets) path += `&with_nested_markets=true`;

  console.log(`🔍 Fetching closed markets: ${path}`);

  const response = await kalshiRequest(path, auth);
  return response;
}

/**
 * Fetch a specific market by ticker
 *
 * @param {string} ticker - Market ticker
 * @param {Object} auth - Auth credentials
 * @returns {Promise} Market data
 */
async function fetchMarket(ticker, auth) {
  const path = `/trade-api/v2/markets/${ticker}`;
  console.log(`🔍 Fetching market: ${ticker}`);

  try {
    const response = await kalshiRequest(path, auth);
    return response.market;
  } catch (e) {
    console.error(`❌ Failed to fetch ${ticker}: ${e.message}`);
    return null;
  }
}

/**
 * Parse market outcome
 *
 * @param {Object} market - Market data from Kalshi
 * @returns {number|null} 0 for NO, 1 for YES, null if not resolved
 */
function parseMarketOutcome(market) {
  if (!market) return null;

  // Check if market is resolved
  if (market.status !== 'closed') {
    return null;
  }

  // Get result from market
  const result = market.result || market.settlement_result || market.outcome;

  if (!result) {
    return null;
  }

  // Parse result
  const resultLower = String(result).toLowerCase().trim();

  if (resultLower === 'yes' || resultLower === '1' || resultLower === true) {
    return 1;
  }
  if (resultLower === 'no' || resultLower === '0' || resultLower === false) {
    return 0;
  }

  console.log(`⚠️ Unknown outcome format: ${result}`);
  return null;
}

/**
 * Resolve pending predictions
 *
 * @param {Object} auth - Kalshi auth credentials
 * @returns {Promise} Resolution results
 */
async function resolvePendingPredictions(auth) {
  const predictions = loadPredictions();
  const pending = predictions.filter(p => p.status === 'pending');

  console.log(`\n🎯 Resolving ${pending.length} pending predictions...`);

  const results = {
    checked: 0,
    resolved: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (const prediction of pending) {
    results.checked++;

    try {
      // Check if close date has passed
      if (prediction.closeDate) {
        const closeDate = new Date(prediction.closeDate);
        const now = new Date();
        if (closeDate > now) {
          console.log(`⏳ ${prediction.ticker} not yet closed`);
          results.skipped++;
          continue;
        }
      }

      // Fetch market data
      const market = await fetchMarket(prediction.ticker, auth);

      if (!market) {
        results.failed++;
        results.errors.push({ ticker: prediction.ticker, error: 'Market not found' });
        continue;
      }

      // Parse outcome
      const outcome = parseMarketOutcome(market);

      if (outcome === null) {
        console.log(`⏳ ${prediction.ticker} not yet resolved`);
        results.skipped++;
        continue;
      }

      // Resolve prediction
      const resolved = resolvePrediction(prediction.ticker, outcome);

      if (resolved) {
        results.resolved++;
        console.log(`✅ Resolved ${prediction.ticker}: ${outcome} (Brier: ${resolved.brierScore.toFixed(4)})`);
      } else {
        results.failed++;
      }

      // Rate limiting - wait between requests
      await new Promise(r => setTimeout(r, 500));

    } catch (e) {
      console.error(`❌ Error resolving ${prediction.ticker}: ${e.message}`);
      results.failed++;
      results.errors.push({ ticker: prediction.ticker, error: e.message });
    }
  }

  // Update metrics after resolving
  if (results.resolved > 0) {
    console.log('\n📊 Updating metrics...');
    updateMetrics();
  }

  return results;
}

/**
 * Fetch recent closed markets and try to match with predictions
 * This is useful for batch resolution
 *
 * @param {Object} auth - Kalshi auth credentials
 * @param {number} daysBack - How many days back to look
 * @returns {Promise} Results
 */
async function batchResolveFromClosedMarkets(auth, daysBack = 7) {
  console.log(`\n📦 Batch resolving from closed markets (last ${daysBack} days)...`);

  const predictions = loadPredictions();
  const pending = predictions.filter(p => p.status === 'pending');

  if (pending.length === 0) {
    console.log('No pending predictions to resolve');
    return { resolved: 0, checked: 0 };
  }

  // Get unique event tickers from pending predictions
  const eventTickers = [...new Set(pending.map(p => p.eventTicker).filter(Boolean))];

  console.log(`Found ${pending.length} pending predictions across ${eventTickers.length} events`);

  const results = {
    checked: 0,
    resolved: 0,
    failed: 0,
    marketsChecked: 0
  };

  // Fetch closed markets for each event
  for (const eventTicker of eventTickers) {
    try {
      console.log(`\n🔍 Checking event: ${eventTicker}`);

      const response = await fetchClosedMarkets(auth, {
        eventTicker,
        limit: 100
      });

      const markets = response.markets || [];
      results.marketsChecked += markets.length;

      console.log(`   Found ${markets.length} closed markets`);

      // Check each market against pending predictions
      for (const market of markets) {
        const matchingPrediction = pending.find(p => p.ticker === market.ticker);

        if (!matchingPrediction) continue;

        results.checked++;

        const outcome = parseMarketOutcome(market);

        if (outcome !== null) {
          const resolved = resolvePrediction(market.ticker, outcome);
          if (resolved) {
            results.resolved++;
            console.log(`   ✅ ${market.ticker}: outcome=${outcome}, brier=${resolved.brierScore.toFixed(4)}`);
          }
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));

    } catch (e) {
      console.error(`❌ Error fetching event ${eventTicker}: ${e.message}`);
    }
  }

  // Update metrics
  if (results.resolved > 0) {
    console.log('\n📊 Updating metrics...');
    updateMetrics();
  }

  return results;
}

/**
 * Run resolution fetch
 *
 * @param {Object} options - Options
 * @returns {Promise} Results
 */
async function runResolutionFetch(options = {}) {
  const {
    batchMode = true,
    daysBack = 7
  } = options;

  console.log('🎯 Kalshi Resolution Fetcher');
  console.log('============================');

  // Check for auth
  const auth = {
    accessKey: process.env.KALSHI_ACCESS_KEY || process.env.KALSHI_API_KEY || ''
  };

  if (!auth.accessKey) {
    console.error('❌ No Kalshi access key found. Set KALSHI_ACCESS_KEY env var.');
    return { error: 'No auth' };
  }

  console.log(`✅ Using Kalshi key: ${auth.accessKey.substring(0, 8)}...`);

  let results;

  if (batchMode) {
    results = await batchResolveFromClosedMarkets(auth, daysBack);
  } else {
    results = await resolvePendingPredictions(auth);
  }

  console.log('\n📊 Results:');
  console.log(`   Markets checked: ${results.marketsChecked || results.checked}`);
  console.log(`   Predictions resolved: ${results.resolved}`);
  console.log(`   Failed: ${results.failed || 0}`);
  console.log(`   Skipped: ${results.skipped || 0}`);

  return results;
}

// Export functions
module.exports = {
  fetchClosedMarkets,
  fetchMarket,
  parseMarketOutcome,
  resolvePendingPredictions,
  batchResolveFromClosedMarkets,
  runResolutionFetch
};

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const batchMode = !args.includes('--single');
  const daysBack = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1]) || 7;

  runResolutionFetch({ batchMode, daysBack })
    .then(results => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Error:', err);
      process.exit(1);
    });
}
