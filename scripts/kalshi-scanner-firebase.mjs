#!/usr/bin/env node
/**
 * Kalshi Scanner - Firebase Output Version
 * Runs scanner and writes results to Firebase for Mission Control
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase if service account provided
let db = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com'
    });
    db = getDatabase();
    console.log('✅ Firebase initialized');
  } catch (e) {
    console.error('❌ Firebase init failed:', e.message);
  }
}

// Run the actual scanner
async function runScanner() {
  console.log('\n🔍 Starting Kalshi Scan...\n');
  
  // Import and run the scanner logic
  // This is a simplified version - you can replace with full scanner
  const scannerOutput = await fetchKalshiMarkets();
  
  // Save to Firebase
  if (db) {
    try {
      await db.ref('v6/kalshi/latest_scan').set({
        scan_time: new Date().toISOString(),
        opportunities: scannerOutput.opportunities,
        summary: scannerOutput.summary
      });
      console.log('✅ Saved to Firebase: v6/kalshi/latest_scan');
    } catch (e) {
      console.error('❌ Firebase save failed:', e.message);
    }
  }
  
  // Also save to local file
  const fs = await import('fs');
  const dataDir = join(process.cwd(), 'kalshi_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(
    join(dataDir, 'latest_scan.json'),
    JSON.stringify(scannerOutput, null, 2)
  );
  console.log('✅ Saved to kalshi_data/latest_scan.json');
  
  return scannerOutput;
}

// Simplified market fetcher (replace with full scanner logic)
async function fetchKalshiMarkets() {
  const fetch = (await import('node-fetch')).default;
  const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';
  
  const seriesToFetch = [
    { series: 'KXHIGHTSEA', category: 'weather', name: 'Seattle High' },
    { series: 'KXHIGHNY', category: 'weather', name: 'NYC High' },
    { series: 'KXHIGHCHI', category: 'weather', name: 'Chicago High' },
    { series: 'KXBTC', category: 'crypto', name: 'Bitcoin' },
    { series: 'KXETH', category: 'crypto', name: 'Ethereum' },
    { series: 'KXTRUTHSOCIAL', category: 'politics', name: 'Trump Posts' },
    { series: 'KXFED', category: 'economics', name: 'Fed Rates' },
    { series: 'KXGDP', category: 'economics', name: 'GDP' },
  ];
  
  const opportunities = [];
  
  for (let i = 0; i < seriesToFetch.length; i++) {
    const { series, category, name } = seriesToFetch[i];
    
    // Add delay between requests to avoid rate limiting
    if (i > 0) {
      await new Promise(r => setTimeout(r, 500)); // 500ms delay
    }
    
    try {
      // Correct Kalshi API endpoint
      const res = await fetch(`${KALSHI_API}/markets?series_ticker=${series}&limit=20&status=open`);
      if (!res.ok) {
        console.error(`  ❌ ${series}: HTTP ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      if (!data.markets || data.markets.length === 0) {
        console.error(`  ⚠️ ${series}: No markets found`);
        continue;
      }
      
      console.log(`  ✅ ${series}: Found ${data.markets.length} markets`);
      
      for (const market of data.markets.slice(0, 5)) {
        // Kalshi API returns yes_ask, yes_bid, etc.
        const yesPrice = market.yes_ask || market.yes_price || market.yes_bid || 50;
        const noPrice = market.no_ask || market.no_price || market.no_bid || (100 - yesPrice);
        const volume = market.volume || 0;
        
        // Simple edge calculation - replace with your real edge logic
        // For now, just look for cheap YES contracts that might be +EV
        const mockTrueProb = Math.random() * 30 + 10; // 10-40%
        const edge = mockTrueProb - yesPrice;
        
        if (edge > 0) {
          opportunities.push({
            ticker: market.ticker,
            title: market.title || market.subtitle || `${name}`,
            subtitle: market.subtitle || market.event_title || '',
            category,
            yesPrice,
            noPrice,
            volume,
            closeTime: market.close_date || market.expiration_date || market.closing_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            edge: edge.toFixed(1),
            confidence: {
              score: Math.floor(Math.random() * 40) + 60,
              level: edge > 10 ? 'High' : 'Medium',
              isContrarian: yesPrice < 20
            },
            signals: {
              baseSignal: {
                trueProbability: mockTrueProb.toFixed(1),
                catalyst: `Scanner identified +${edge.toFixed(1)}¢ edge in ${category} market`
              }
            }
          });
        }
      }
    } catch (e) {
      console.error(`  ❌ ${series}: ${e.message}`);
    }
  }
  
  // Sort by edge descending
  opportunities.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));
  
  return {
    scan_time: new Date().toISOString(),
    summary: {
      totalMarkets: seriesToFetch.length * 5,
      analyzed: opportunities.length,
      opportunities: opportunities.length,
      byCategory: {
        weather: opportunities.filter(o => o.category === 'weather').length,
        crypto: opportunities.filter(o => o.category === 'crypto').length,
        politics: opportunities.filter(o => o.category === 'politics').length,
        economics: opportunities.filter(o => o.category === 'economics').length,
      }
    },
    opportunities: opportunities.slice(0, 20) // Top 20
  };
}

// Run it
runScanner()
  .then(output => {
    console.log('\n✅ Scan complete');
    console.log(`📊 Found ${output.opportunities.length} opportunities`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Scan failed:', err);
    process.exit(1);
  });
