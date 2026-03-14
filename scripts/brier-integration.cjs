/**
 * Brier Score Integration for Kalshi Scanner v2
 *
 * This module integrates Brier score tracking into the existing
 * kalshi-trade-fetcher-v2 scanner without modifying the core file.
 *
 * Usage:
 *   const { recordTradePrediction, getBrierMetrics, addBrierToOutput } = require('./brier-integration.js');
 *
 *   // In scanner, when processing opportunities:
 *   recordTradePrediction(trade, ourProb, signalType);
 *
 *   // At end of scan:
 *   output.brierAnalysis = getBrierMetrics();
 *   output = addBrierToOutput(output);
 */

const {
  recordPrediction,
  loadMetrics,
  generateBrierAnalysis,
  getEdgeCalibration,
  updateMetrics
} = require('./brier-tracker.cjs');

const {
  runResolutionFetch
} = require('./kalshi-resolution-fetcher.cjs');

/**
 * Record a prediction for a trade opportunity
 *
 * @param {Object} trade - Trade opportunity object
 * @param {number} ourProb - Our estimated probability (0-1)
 * @param {string} signalType - Type of signal
 * @returns {Object} Recorded prediction
 */
function recordTradePrediction(trade, ourProb, signalType = 'unknown') {
  return recordPrediction(trade, ourProb, signalType);
}

/**
 * Calculate our probability estimate for a trade
 * This should match how the scanner calculates edge
 *
 * @param {Object} trade - Trade opportunity
 * @returns {number} Estimated probability (0-1)
 */
function calculateOurProbability(trade) {
  // Calculate market-implied probability from price
  const marketProb = trade.marketProb || (trade.price || trade.yesPrice || 50) / 100;
  const edge = parseFloat(trade.edge) || 0;

  // Convert edge from percentage points to decimal and add to market prob
  // Edge represents our advantage over market (e.g., 10 = 10 percentage points)
  const ourProb = Math.max(0.01, Math.min(0.99, marketProb + (edge / 100)));

  // Override for specific high-confidence signal types
  if (trade.pennySignal?.isFatPitch) return 0.90;
  if (trade.isFatPitch) return 0.90;
  if (trade.tailRiskSignal?.confidence === 'very_high') return 0.95;
  if (trade.tailRiskSignal) return 0.85;
  if (trade.pennySignal) return 0.85;

  return ourProb;
}

/**
 * Get Brier metrics for scanner output
 *
 * @returns {Object} Brier analysis object
 */
function getBrierMetrics() {
  return generateBrierAnalysis();
}

/**
 * Apply edge calibration based on Brier scores
 *
 * @param {Object} trade - Trade object
 * @param {number} originalEdge - Original edge calculation
 * @returns {number} Calibrated edge
 */
function applyEdgeCalibration(trade, originalEdge) {
  const category = trade.category || 'unknown';
  const calibration = getEdgeCalibration(category);

  return originalEdge * calibration;
}

/**
 * Add Brier analysis to scanner output
 *
 * @param {Object} output - Scanner output object
 * @returns {Object} Updated output with Brier data
 */
function addBrierToOutput(output) {
  const brierAnalysis = generateBrierAnalysis();

  return {
    ...output,
    brier: {
      enabled: true,
      ...brierAnalysis
    }
  };
}

/**
 * Add Brier score column to opportunities
 * Shows predicted Brier score for informational purposes
 *
 * @param {Array} opportunities - List of trade opportunities
 * @returns {Array} Opportunities with Brier info
 */
function addBrierToOpportunities(opportunities) {
  return opportunities.map(trade => {
    const ourProb = calculateOurProbability(trade);

    // Calculate hypothetical Brier scores
    // If outcome is YES: Brier = (ourProb - 1)²
    // If outcome is NO: Brier = (ourProb - 0)²
    const brierIfYes = Math.pow(ourProb - 1, 2);
    const brierIfNo = Math.pow(ourProb - 0, 2);

    // Expected Brier = P(YES) * Brier(1) + P(NO) * Brier(0)
    // Using market implied probability as baseline
    const marketProb = trade.marketProb || (trade.price || 50) / 100;
    const expectedBrier = marketProb * brierIfYes + (1 - marketProb) * brierIfNo;

    return {
      ...trade,
      brier: {
        ourProb: parseFloat(ourProb.toFixed(3)),
        expectedBrier: parseFloat(expectedBrier.toFixed(4)),
        brierIfYes: parseFloat(brierIfYes.toFixed(4)),
        brierIfNo: parseFloat(brierIfNo.toFixed(4))
      }
    };
  });
}

/**
 * Run resolution fetch as part of scanner
 *
 * @param {Object} options - Options
 * @returns {Promise} Resolution results
 */
async function resolvePredictions(options = {}) {
  return await runResolutionFetch(options);
}

/**
 * Print Brier summary to console
 *
 * @param {Object} brierAnalysis - Brier analysis object
 */
function printBrierSummary(brierAnalysis) {
  if (!brierAnalysis.hasData) {
    console.log('\n📊 Brier Score Analysis: Collecting data...');
    return;
  }

  console.log('\n📊 Brier Score Analysis');
  console.log('======================');

  const overall = brierAnalysis.overall;
  console.log(`Overall: ${overall.brier?.toFixed(4) || 'N/A'} (${brierAnalysis.calibration}) ${brierAnalysis.trend === 'improving' ? '📈' : '📉'}`);
  console.log(`Resolved: ${overall.resolved}/${overall.total} trades`);

  if (overall.msep) {
    console.log(`MSEP: ${overall.msep.toFixed(4)} (model performance)`);
  }

  if (brierAnalysis.last30Days?.avgBrier) {
    console.log(`30-day: ${brierAnalysis.last30Days.avgBrier.toFixed(4)}`);
  }

  if (Object.keys(brierAnalysis.byCategory).length > 0) {
    console.log('\nBy Category:');
    for (const [cat, metrics] of Object.entries(brierAnalysis.byCategory)) {
      const emoji = cat === 'weather' ? '🌤️' : cat === 'crypto' ? '🪙' : cat === 'economics' ? '📊' : cat === 'politics' ? '🏛️' : '📈';
      const quality = metrics.avgBrier < 0.15 ? '⭐⭐' : metrics.avgBrier < 0.20 ? '⭐' : metrics.avgBrier < 0.25 ? '✅' : '⚠️';
      console.log(`  ${emoji} ${cat}: ${metrics.avgBrier.toFixed(4)} ${quality} (${metrics.resolvedTrades} trades)`);
    }
  }

  if (brierAnalysis.recommendations?.length > 0) {
    console.log('\nRecommendations:');
    brierAnalysis.recommendations.forEach(rec => {
      console.log(`  💡 ${rec}`);
    });
  }

  if (brierAnalysis.bestCategory && brierAnalysis.worstCategory) {
    console.log(`\nBest: ${brierAnalysis.bestCategory} | Worst: ${brierAnalysis.worstCategory}`);
  }
}

/**
 * Integration hook for main scanner
 * Call this at the end of the main() function before returning output
 *
 * @param {Object} scanOutput - The scanner's output object
 * @returns {Promise} Updated output
 */
async function integrateWithScanner(scanOutput) {
  // Update metrics
  updateMetrics();

  // Try to resolve any pending predictions (non-blocking)
  try {
    await resolvePredictions({ batchMode: true, daysBack: 7 });
  } catch (e) {
    // Silently fail - resolution fetch is optional
    console.log('   (Resolution fetch skipped)');
  }

  // Add Brier analysis to output
  const output = addBrierToOutput(scanOutput);

  // Print summary
  printBrierSummary(output.brier);

  return output;
}

/**
 * Record predictions for a batch of opportunities
 * Call this after identifying opportunities in the scanner
 *
 * @param {Array} opportunities - Trade opportunities
 * @param {string} signalType - Type of signal
 * @returns {number} Number of predictions recorded
 */
function recordOpportunities(opportunities, signalType = 'unknown') {
  let recorded = 0;
  
  // DEBUG: Log input
  console.log(`   Brier DEBUG: Received ${opportunities?.length || 0} opportunities for ${signalType}`);

  for (const trade of opportunities) {
    const ourProb = calculateOurProbability(trade);
    const edge = parseFloat(trade.edge) || 0;
    
    // FIX: Lower threshold from 0.6 to 0.15 (15% probability)
    // Also record if edge is positive and meaningful
    const shouldRecord = (ourProb > 0.15 || edge > 5) && edge > 0;
    
    // DEBUG: Log each trade
    if (!shouldRecord) {
      console.log(`   Brier SKIP: ${trade.ticker} - edge: ${edge}, ourProb: ${ourProb.toFixed(2)}`);
    } else {
      console.log(`   Brier RECORD: ${trade.ticker} - edge: ${edge}, ourProb: ${ourProb.toFixed(2)}`);
    }

    // FIX: Record if we have positive edge and reasonable probability
    if (shouldRecord) {
      recordTradePrediction(trade, ourProb, signalType);
      recorded++;
    }
  }
  
  console.log(`   Brier DEBUG: Recorded ${recorded} for ${signalType}`);

  return recorded;
}

// Export integration functions
module.exports = {
  // Core functions
  recordTradePrediction,
  calculateOurProbability,
  getBrierMetrics,
  applyEdgeCalibration,
  addBrierToOutput,
  addBrierToOpportunities,
  resolvePredictions,
  printBrierSummary,
  integrateWithScanner,
  recordOpportunities,

  // Passthrough from brier-tracker
  updateMetrics,
  getEdgeCalibration
};

// If run directly, show metrics
if (require.main === module) {
  console.log('🎯 Brier Score Integration Module');
  console.log('=================================');

  const args = process.argv.slice(2);

  if (args[0] === 'metrics') {
    const metrics = getBrierMetrics();
    console.log('\n📊 Current Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
  } else if (args[0] === 'resolve') {
    resolvePredictions({ batchMode: true })
      .then(results => {
        console.log('\n✅ Resolution complete');
        process.exit(0);
      })
      .catch(err => {
        console.error('\n❌ Error:', err);
        process.exit(1);
      });
  } else {
    console.log('\nUsage:');
    console.log('  node brier-integration.js metrics  - Show current metrics');
    console.log('  node brier-integration.js resolve  - Resolve pending predictions');
  }
}
