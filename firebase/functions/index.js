const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { exec } = require('child_process');

admin.initializeApp();

// =============================================================================
// KALSHI DATA API - Serves scanner data to Mission Control frontend
// =============================================================================

/**
 * HTTP endpoint to fetch latest Kalshi scanner data
 * Called by Mission Control frontend
 */
exports.getKalshiData = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Fetch latest scan data from Firebase RTDB
    const snapshot = await admin.database().ref('v6/kalshi/latest_scan').once('value');
    const data = snapshot.val();
    
    if (!data) {
      res.status(404).json({
        error: 'No scan data available',
        message: 'Kalshi scanner has not run yet or data not found'
      });
      return;
    }
    
    // Transform backend fields to frontend format
    const transformed = {
      scan_time: data.scan_time,
      source: data.source,
      summary: data.summary,
      opportunities: transformOpportunities(data.opportunities || []),
      arbitrage: data.arbitrage || [],
      polymarketArbs: data.polymarketArbs || [],
      whaleAlerts: data.whaleAlerts || [],
      weatherLags: data.weatherLags || [],
      pennyResults: data.pennyResults || { summary: { totalOpportunities: 0 } },
      tailRiskResults: data.tailRiskResults || { summary: { total: 0 } },
      backtestResults: data.backtestResults || {},
      kellyAnalysis: data.kellyAnalysis || {},
      heatMap: data.heatMap || {}
    };
    
    res.json({
      success: true,
      data: transformed,
      fetched_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching Kalshi data:', error);
    res.status(500).json({
      error: 'Failed to fetch data',
      message: error.message
    });
  }
});

/**
 * Transform backend opportunity format to frontend format
 */
function transformOpportunities(opportunities) {
  return opportunities.map(opp => ({
    // Basic info
    ticker: opp.ticker,
    title: opp.title,
    subtitle: opp.subtitle,
    
    // Type/category mapping
    type: mapCategoryToType(opp.category),
    category: opp.category,
    source: opp.category,
    
    // Price data
    marketPrice: opp.yesPrice,
    yesPrice: opp.yesPrice,
    noPrice: opp.noPrice,
    yesBid: opp.yesBid,
    yesAsk: opp.yesAsk,
    
    // Probability and edge
    modelProb: Math.round((opp.trueProbability || (50 + parseFloat(opp.edge || 0))) * 10) / 10,
    trueProbability: opp.trueProbability,
    marketProbability: opp.marketProbability,
    edge: parseFloat(opp.edge || 0),
    grossEdge: opp.grossEdge,
    
    // Scores
    rScore: parseFloat(opp.rScore || 0),
    compositeScore: opp.compositeScore,
    
    // Time
    closeTime: opp.closeTime,
    daysToExpiry: calculateDaysToExpiry(opp.closeTime),
    
    // Position sizing
    kellyPosition: opp.position,
    kellyPct: opp.kellyPct,
    recommendation: opp.recommendation,
    
    // Volume and liquidity
    volume: opp.volume,
    liquidityScore: opp.liquidityScore,
    spread: opp.spread,
    
    // Signals (frontend currently ignores these - now exposed)
    isFatPitch: !!opp.pennySignal?.isFatPitch,
    isTailRisk: !!opp.tailRiskSignal,
    momentum: opp.momentum,
    isWhale: opp.whale,
    whaleSpikeRatio: opp.whaleSpikeRatio,
    
    // Alerts
    alerts: opp.alerts || [],
    
    // Risk metrics
    riskMetrics: opp.riskMetrics,
    
    // URL
    url: opp.kalshiUrl || `https://kalshi.com/markets/${opp.ticker}`
  }));
}

function mapCategoryToType(category) {
  const map = {
    'weather': 'Weather',
    'crypto': 'Crypto',
    'politics': 'Politics',
    'economics': 'Economics'
  };
  return map[category] || category || 'Other';
}

function calculateDaysToExpiry(closeTime) {
  if (!closeTime) return 999;
  const close = new Date(closeTime);
  const now = new Date();
  return Math.max(0, Math.ceil((close - now) / (1000 * 60 * 60 * 24)));
}

// =============================================================================
// DISCORD NOTIFICATIONS
// =============================================================================

// Trigger when a new notification is created
exports.onDiscordNotificationCreated = functions.database
  .ref('/v6/discordNotifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.val();
    const { notificationId } = context.params;
    
    // Only process pending notifications
    if (notification.status !== 'pending') {
      console.log(`Notification ${notificationId} is not pending, skipping`);
      return null;
    }
    
    const { channelId, message } = notification;
    
    console.log(`Processing notification ${notificationId} for channel ${channelId}`);
    
    try {
      // Mark as sending
      await snapshot.ref.update({ status: 'sending' });
      
      // Send Discord message using OpenClaw CLI
      const cmd = `openclaw message send --channel discord --target ${channelId} -m "${message.replace(/"/g, '\\"')}"`;
      
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.error('Discord send error:', error);
            reject(error);
          } else {
            console.log('Discord message sent successfully');
            resolve(stdout);
          }
        });
      });
      
      // Mark as sent
      await snapshot.ref.update({ 
        status: 'sent',
        sentAt: Date.now()
      });
      
      console.log(`Notification ${notificationId} sent successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`Failed to send notification ${notificationId}:`, error);
      await snapshot.ref.update({ 
        status: 'failed',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
