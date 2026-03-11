/**
 * Brier Score Tracker Module for Kalshi Scanner
 * 
 * Tracks predictions and calculates Brier scores to measure
 * calibration and prediction accuracy.
 * 
 * Brier Score = (predictedProb - actualOutcome)²
 * Lower is better. Perfect = 0, Worst = 1.
 */

const fs = require('fs');
const path = require('path');

// Data storage paths
const DATA_DIR = path.join(__dirname, '..', 'kalshi_data');
const PREDICTIONS_FILE = path.join(DATA_DIR, 'brier_predictions.json');
const RESOLVED_FILE = path.join(DATA_DIR, 'brier_resolved.json');
const METRICS_FILE = path.join(DATA_DIR, 'brier_metrics.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load predictions from file
 */
function loadPredictions() {
  ensureDataDir();
  if (!fs.existsSync(PREDICTIONS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(PREDICTIONS_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading predictions:', e.message);
    return [];
  }
}

/**
 * Save predictions to file
 */
function savePredictions(predictions) {
  ensureDataDir();
  fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
}

/**
 * Load resolved outcomes from file
 */
function loadResolved() {
  ensureDataDir();
  if (!fs.existsSync(RESOLVED_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(RESOLVED_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading resolved:', e.message);
    return [];
  }
}

/**
 * Save resolved outcomes to file
 */
function saveResolved(resolved) {
  ensureDataDir();
  fs.writeFileSync(RESOLVED_FILE, JSON.stringify(resolved, null, 2));
}

/**
 * Load metrics from file
 */
function loadMetrics() {
  ensureDataDir();
  if (!fs.existsSync(METRICS_FILE)) {
    return {
      lastUpdated: null,
      overall: { avgBrier: null, msep: null, totalTrades: 0, resolvedTrades: 0 },
      byCategory: {},
      calibrationBuckets: [],
      last30Days: null,
      last90Days: null
    };
  }
  try {
    return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
  } catch (e) {
    return {
      lastUpdated: null,
      overall: { avgBrier: null, msep: null, totalTrades: 0, resolvedTrades: 0 },
      byCategory: {},
      calibrationBuckets: [],
      last30Days: null,
      last90Days: null
    };
  }
}

/**
 * Save metrics to file
 */
function saveMetrics(metrics) {
  ensureDataDir();
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
}

/**
 * Record a prediction for later Brier score calculation
 * 
 * @param {Object} trade - The trade opportunity
 * @param {number} ourProb - Our estimated probability (0-1)
 * @param {string} signalType - Type of signal (fat_pitch, penny_pick, etc.)
 */
function recordPrediction(trade, ourProb, signalType = 'unknown') {
  const predictions = loadPredictions();
  
  // Check if we already have this prediction
  const existingIndex = predictions.findIndex(p => p.ticker === trade.ticker);
  
  const prediction = {
    ticker: trade.ticker,
    eventTicker: trade.eventTicker || trade.ticker.split('-')[0],
    marketTitle: trade.marketTitle || trade.title,
    category: trade.category || 'unknown',
    side: trade.side,
    entryTime: new Date().toISOString(),
    closeDate: trade.closeDate || trade.expiration,
    entryPrice: trade.price || trade.noPrice || trade.yesPrice,
    marketProb: (trade.price || trade.noPrice || trade.yesPrice) / 100,
    ourProb: ourProb,
    edge: (ourProb - ((trade.price || trade.noPrice || trade.yesPrice) / 100)),
    signalType: signalType,
    status: 'pending', // pending -> resolved
    outcome: null,
    brierScore: null,
    resolvedAt: null
  };
  
  if (existingIndex >= 0) {
    // Update existing
    predictions[existingIndex] = { ...predictions[existingIndex], ...prediction };
  } else {
    // Add new
    predictions.push(prediction);
  }
  
  savePredictions(predictions);
  console.log(`📝 Recorded prediction for ${trade.ticker}: ourProb=${(ourProb*100).toFixed(1)}%, edge=${(prediction.edge*100).toFixed(1)}%`);
  
  return prediction;
}

/**
 * Resolve a prediction with actual outcome
 * 
 * @param {string} ticker - Market ticker
 * @param {number} outcome - Actual outcome (0 or 1)
 * @returns {Object|null} The resolved prediction or null if not found
 */
function resolvePrediction(ticker, outcome) {
  const predictions = loadPredictions();
  const index = predictions.findIndex(p => p.ticker === ticker && p.status === 'pending');
  
  if (index < 0) {
    console.log(`⚠️ No pending prediction found for ${ticker}`);
    return null;
  }
  
  const prediction = predictions[index];
  
  // Calculate Brier score
  // For binary outcomes: BS = (predictedProb - outcome)²
  const brierScore = Math.pow(prediction.ourProb - outcome, 2);
  
  prediction.status = 'resolved';
  prediction.outcome = outcome;
  prediction.brierScore = brierScore;
  prediction.resolvedAt = new Date().toISOString();
  
  savePredictions(predictions);
  
  // Also add to resolved list for quick access
  const resolved = loadResolved();
  resolved.push({
    ticker: prediction.ticker,
    category: prediction.category,
    ourProb: prediction.ourProb,
    outcome: prediction.outcome,
    brierScore: prediction.brierScore,
    edge: prediction.edge,
    resolvedAt: prediction.resolvedAt
  });
  saveResolved(resolved);
  
  console.log(`✅ Resolved ${ticker}: outcome=${outcome}, brier=${brierScore.toFixed(4)}`);
  
  return prediction;
}

/**
 * Calculate Brier score for a single prediction
 * 
 * @param {number} predictedProb - Predicted probability (0-1)
 * @param {number} outcome - Actual outcome (0 or 1)
 * @returns {number} Brier score
 */
function calculateBrierScore(predictedProb, outcome) {
  return Math.pow(predictedProb - outcome, 2);
}

/**
 * Calculate MSEP (Mean Square Error for Probability)
 * This removes the variance component from Brier score
 * 
 * @param {Array} predictions - Array of predictions with ourProb and outcome
 * @returns {number} MSEP value
 */
function calculateMSEP(predictions) {
  const resolved = predictions.filter(p => p.outcome !== null && p.outcome !== undefined);
  if (resolved.length === 0) return null;
  
  // MSEP = average of (ourProb - trueProb)²
  // Since we don't know trueProb, we approximate with outcome
  // For binary: MSEP ≈ Brier - Variance
  const brierSum = resolved.reduce((sum, p) => sum + Math.pow(p.ourProb - p.outcome, 2), 0);
  const avgBrier = brierSum / resolved.length;
  
  // Variance of binary outcome = p * (1-p)
  // We approximate using the average outcome rate
  const avgOutcome = resolved.reduce((sum, p) => sum + p.outcome, 0) / resolved.length;
  const variance = avgOutcome * (1 - avgOutcome);
  
  const msep = Math.max(0, avgBrier - variance);
  return msep;
}

/**
 * Calculate metrics for predictions
 * 
 * @param {Array} predictions - Array of predictions
 * @returns {Object} Calculated metrics
 */
function calculateMetrics(predictions) {
  const resolved = predictions.filter(p => p.status === 'resolved' && p.brierScore !== null);
  
  if (resolved.length === 0) {
    return {
      avgBrier: null,
      msep: null,
      totalTrades: predictions.length,
      resolvedTrades: 0
    };
  }
  
  const brierSum = resolved.reduce((sum, p) => sum + p.brierScore, 0);
  const avgBrier = brierSum / resolved.length;
  const msep = calculateMSEP(resolved);
  
  return {
    avgBrier: parseFloat(avgBrier.toFixed(4)),
    msep: msep ? parseFloat(msep.toFixed(4)) : null,
    totalTrades: predictions.length,
    resolvedTrades: resolved.length
  };
}

/**
 * Calculate metrics by category
 * 
 * @param {Array} predictions - Array of predictions
 * @returns {Object} Metrics by category
 */
function calculateMetricsByCategory(predictions) {
  const resolved = predictions.filter(p => p.status === 'resolved' && p.brierScore !== null);
  
  const categories = {};
  resolved.forEach(p => {
    const cat = p.category || 'unknown';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(p);
  });
  
  const metrics = {};
  for (const [cat, preds] of Object.entries(categories)) {
    metrics[cat] = calculateMetrics(preds.map(p => ({ ...p, category: cat })));
  }
  
  return metrics;
}

/**
 * Calculate calibration buckets
 * Shows predicted probability vs actual win rate
 * 
 * @param {Array} predictions - Array of resolved predictions
 * @returns {Array} Calibration buckets
 */
function calculateCalibrationBuckets(predictions) {
  const resolved = predictions.filter(p => p.status === 'resolved' && p.brierScore !== null);
  
  // Create 10% buckets
  const buckets = [
    { range: '0-10%', min: 0, max: 0.1, actualWinRate: 0, count: 0 },
    { range: '10-20%', min: 0.1, max: 0.2, actualWinRate: 0, count: 0 },
    { range: '20-30%', min: 0.2, max: 0.3, actualWinRate: 0, count: 0 },
    { range: '30-40%', min: 0.3, max: 0.4, actualWinRate: 0, count: 0 },
    { range: '40-50%', min: 0.4, max: 0.5, actualWinRate: 0, count: 0 },
    { range: '50-60%', min: 0.5, max: 0.6, actualWinRate: 0, count: 0 },
    { range: '60-70%', min: 0.6, max: 0.7, actualWinRate: 0, count: 0 },
    { range: '70-80%', min: 0.7, max: 0.8, actualWinRate: 0, count: 0 },
    { range: '80-90%', min: 0.8, max: 0.9, actualWinRate: 0, count: 0 },
    { range: '90-100%', min: 0.9, max: 1.0, actualWinRate: 0, count: 0 }
  ];
  
  resolved.forEach(p => {
    const bucket = buckets.find(b => p.ourProb >= b.min && p.ourProb < b.max);
    if (bucket) {
      bucket.count++;
      bucket.actualWinRate += p.outcome; // Sum of outcomes
    }
  });
  
  // Calculate actual win rates
  buckets.forEach(b => {
    if (b.count > 0) {
      b.actualWinRate = parseFloat((b.actualWinRate / b.count).toFixed(3));
    }
  });
  
  return buckets.filter(b => b.count > 0);
}

/**
 * Calculate rolling metrics for time windows
 * 
 * @param {Array} predictions - Array of predictions
 * @param {number} days - Number of days for window
 * @returns {Object} Metrics for the time window
 */
function calculateRollingMetrics(predictions, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  const recent = predictions.filter(p => {
    const resolvedDate = p.resolvedAt ? new Date(p.resolvedAt) : null;
    return resolvedDate && resolvedDate >= cutoff && p.status === 'resolved';
  });
  
  if (recent.length === 0) {
    return { avgBrier: null, msep: null, count: 0 };
  }
  
  const brierSum = recent.reduce((sum, p) => sum + p.brierScore, 0);
  const avgBrier = brierSum / recent.length;
  const msep = calculateMSEP(recent);
  
  return {
    avgBrier: parseFloat(avgBrier.toFixed(4)),
    msep: msep ? parseFloat(msep.toFixed(4)) : null,
    count: recent.length
  };
}

/**
 * Update all metrics
 */
function updateMetrics() {
  const predictions = loadPredictions();
  
  const metrics = {
    lastUpdated: new Date().toISOString(),
    overall: calculateMetrics(predictions),
    byCategory: calculateMetricsByCategory(predictions),
    calibrationBuckets: calculateCalibrationBuckets(predictions),
    last30Days: calculateRollingMetrics(predictions, 30),
    last90Days: calculateRollingMetrics(predictions, 90)
  };
  
  saveMetrics(metrics);
  console.log('📊 Updated Brier metrics');
  console.log(`   Overall: ${metrics.overall.avgBrier?.toFixed(4) || 'N/A'} (${metrics.overall.resolvedTrades} resolved)`);
  
  return metrics;
}

/**
 * Get calibration quality label
 * 
 * @param {number} brier - Brier score
 * @returns {string} Quality label
 */
function getCalibrationQuality(brier) {
  if (brier === null || brier === undefined) return 'unknown';
  if (brier < 0.15) return 'excellent';
  if (brier < 0.20) return 'good';
  if (brier < 0.25) return 'fair';
  return 'poor';
}

/**
 * Get calibration emoji
 * 
 * @param {string} quality - Quality label
 * @returns {string} Emoji
 */
function getCalibrationEmoji(quality) {
  const map = {
    excellent: '⭐⭐',
    good: '⭐',
    fair: '✅',
    poor: '⚠️',
    unknown: '❓'
  };
  return map[quality] || '❓';
}

/**
 * Generate Brier analysis for scanner output
 * 
 * @returns {Object} Brier analysis object
 */
function generateBrierAnalysis() {
  const metrics = loadMetrics();
  
  if (!metrics.overall.avgBrier) {
    return {
      enabled: true,
      hasData: false,
      message: 'Collecting prediction data...',
      recommendations: ['Record predictions to build calibration metrics']
    };
  }
  
  const quality = getCalibrationQuality(metrics.overall.avgBrier);
  const trend = metrics.last30Days?.avgBrier && metrics.last90Days?.avgBrier
    ? (metrics.last30Days.avgBrier < metrics.last90Days.avgBrier ? 'improving' : 'declining')
    : 'stable';
  
  // Find best and worst categories
  let bestCategory = null;
  let worstCategory = null;
  let bestBrier = Infinity;
  let worstBrier = -Infinity;
  
  for (const [cat, catMetrics] of Object.entries(metrics.byCategory)) {
    if (catMetrics.avgBrier !== null) {
      if (catMetrics.avgBrier < bestBrier) {
        bestBrier = catMetrics.avgBrier;
        bestCategory = cat;
      }
      if (catMetrics.avgBrier > worstBrier) {
        worstBrier = catMetrics.avgBrier;
        worstCategory = cat;
      }
    }
  }
  
  // Generate recommendations
  const recommendations = [];
  
  for (const [cat, catMetrics] of Object.entries(metrics.byCategory)) {
    if (catMetrics.avgBrier > 0.20) {
      recommendations.push(`${cat} predictions are overconfident (Brier: ${catMetrics.avgBrier.toFixed(3)})`);
    }
  }
  
  if (metrics.overall.avgBrier < 0.15) {
    recommendations.push('Overall calibration is excellent - maintain current edge calculations');
  }
  
  return {
    enabled: true,
    hasData: true,
    calibration: quality,
    trend: trend,
    overall: {
      brier: metrics.overall.avgBrier,
      msep: metrics.overall.msep,
      resolved: metrics.overall.resolvedTrades,
      total: metrics.overall.totalTrades
    },
    last30Days: metrics.last30Days,
    last90Days: metrics.last90Days,
    byCategory: metrics.byCategory,
    bestCategory,
    worstCategory,
    recommendations,
    calibrationBuckets: metrics.calibrationBuckets
  };
}

/**
 * Get edge calibration factor for a category
 * Uses Brier scores to tune edge calculations
 * 
 * @param {string} category - Category name
 * @returns {number} Calibration factor (multiply edge by this)
 */
function getEdgeCalibration(category) {
  const metrics = loadMetrics();
  const catMetrics = metrics.byCategory[category];
  
  if (!catMetrics || !catMetrics.avgBrier) {
    return 1.0; // No data, use as-is
  }
  
  // If Brier score is high, we're overconfident - reduce edge
  // If Brier score is low, we're underconfident - increase edge
  // Target Brier: 0.15 (excellent)
  const targetBrier = 0.15;
  const currentBrier = catMetrics.avgBrier;
  
  // Calculate adjustment: if Brier is 0.25 (poor), reduce edge by ~20%
  // If Brier is 0.10 (exceptional), increase edge by ~10%
  const ratio = targetBrier / Math.max(0.05, currentBrier);
  const calibration = Math.sqrt(ratio); // Square root to dampen effect
  
  // Clamp between 0.7 and 1.3
  return Math.max(0.7, Math.min(1.3, calibration));
}

// Export functions
module.exports = {
  // Core functions
  recordPrediction,
  resolvePrediction,
  calculateBrierScore,
  calculateMSEP,
  updateMetrics,
  
  // Data loading
  loadPredictions,
  loadResolved,
  loadMetrics,
  
  // Analysis
  calculateMetrics,
  calculateMetricsByCategory,
  calculateCalibrationBuckets,
  calculateRollingMetrics,
  generateBrierAnalysis,
  
  // Utilities
  getCalibrationQuality,
  getCalibrationEmoji,
  getEdgeCalibration,
  
  // Constants
  DATA_DIR,
  PREDICTIONS_FILE,
  RESOLVED_FILE,
  METRICS_FILE
};

// If run directly, update metrics
if (require.main === module) {
  console.log('🎯 Brier Score Tracker');
  console.log('======================');
  
  const args = process.argv.slice(2);
  
  if (args[0] === 'update') {
    updateMetrics();
    const metrics = loadMetrics();
    console.log('\n📊 Current Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
  } else if (args[0] === 'status') {
    const predictions = loadPredictions();
    const pending = predictions.filter(p => p.status === 'pending');
    const resolved = predictions.filter(p => p.status === 'resolved');
    
    console.log(`\n📋 Predictions: ${predictions.length} total`);
    console.log(`   Pending: ${pending.length}`);
    console.log(`   Resolved: ${resolved.length}`);
    
    if (resolved.length > 0) {
      const avgBrier = resolved.reduce((sum, p) => sum + p.brierScore, 0) / resolved.length;
      console.log(`   Average Brier: ${avgBrier.toFixed(4)}`);
    }
  } else {
    console.log('\nUsage:');
    console.log('  node brier-tracker.js update    - Update all metrics');
    console.log('  node brier-tracker.js status    - Show status');
  }
}
