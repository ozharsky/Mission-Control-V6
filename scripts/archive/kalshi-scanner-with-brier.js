/**
 * Kalshi Scanner with Brier Integration
 * 
 * This is a wrapper around kalshi-trade-fetcher-v2.cjs that adds
 * Brier score tracking without modifying the core scanner.
 * 
 * Usage: node kalshi-scanner-with-brier.js [options]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  recordOpportunities,
  integrateWithScanner,
  printBrierSummary,
  getBrierMetrics
} = require('./brier-integration.js');

// Data directory for storing scan results
const DATA_DIR = path.join(__dirname, '..', 'kalshi_data');
const SCAN_RESULTS_FILE = path.join(DATA_DIR, 'latest_scan.json');

/**
 * Run the scanner and capture output
 */
async function runScanner() {
  console.log('🎯 Kalshi Scanner with Brier Score Tracking');
  console.log('============================================\n');
  
  // Run the original scanner
  const scannerPath = path.join(__dirname, 'kalshi-trade-fetcher-v2.cjs');
  
  console.log('📡 Running Kalshi scanner...\n');
  
  try {
    // Run scanner and capture output
    const result = execSync(`node "${scannerPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 300000, // 5 minutes
      env: { ...process.env, BRIER_ENABLED: 'true' }
    });
    
    console.log(result);
    
    // Parse the JSON output from the scanner
    // The scanner outputs JSON at the end, so we need to extract it
    const jsonMatch = result.match(/\{[\s\S]*"scan_time"[\s\S]*\}$/);
    
    if (jsonMatch) {
      try {
        const scanOutput = JSON.parse(jsonMatch[0]);
        return scanOutput;
      } catch (e) {
        console.log('⚠️ Could not parse scanner JSON output');
        return null;
      }
    }
    
    return null;
  } catch (e) {
    console.error('❌ Scanner failed:', e.message);
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    throw e;
  }
}

/**
 * Load previous scan results
 */
function loadPreviousScan() {
  if (!fs.existsSync(SCAN_RESULTS_FILE)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(SCAN_RESULTS_FILE, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * Record predictions from opportunities
 */
function recordPredictionsFromScan(scanOutput) {
  if (!scanOutput || !scanOutput.opportunities) {
    console.log('⚠️ No opportunities to record');
    return 0;
  }
  
  console.log('\n📝 Recording predictions...');
  
  let totalRecorded = 0;
  
  // Record regular opportunities
  if (scanOutput.opportunities.length > 0) {
    const count = recordOpportunities(scanOutput.opportunities, 'composite_score');
    console.log(`   Recorded ${count} opportunities`);
    totalRecorded += count;
  }
  
  // Record penny picks
  if (scanOutput.pennyOpportunities) {
    const count = recordOpportunities(scanOutput.pennyOpportunities, 'penny_pick');
    console.log(`   Recorded ${count} penny picks`);
    totalRecorded += count;
  }
  
  // Record tail risk
  if (scanOutput.tailRiskOpportunities) {
    const count = recordOpportunities(scanOutput.tailRiskOpportunities, 'tail_risk');
    console.log(`   Recorded ${count} tail risk trades`);
    totalRecorded += count;
  }
  
  return totalRecorded;
}

/**
 * Main function
 */
async function main() {
  try {
    // Run the scanner
    const scanOutput = await runScanner();
    
    if (!scanOutput) {
      console.log('\n⚠️ No scan output available');
      process.exit(1);
    }
    
    // Record predictions
    const recorded = recordPredictionsFromScan(scanOutput);
    
    if (recorded > 0) {
      console.log(`   Total predictions recorded: ${recorded}`);
    }
    
    // Integrate Brier analysis
    console.log('\n📊 Integrating Brier score analysis...');
    const outputWithBrier = await integrateWithScanner(scanOutput);
    
    // Save results
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(SCAN_RESULTS_FILE, JSON.stringify(outputWithBrier, null, 2));
    console.log(`\n💾 Results saved to ${SCAN_RESULTS_FILE}`);
    
    // Print final summary
    console.log('\n✅ Scan complete with Brier tracking');
    
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runScanner, main };
