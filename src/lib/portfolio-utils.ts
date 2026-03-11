// Portfolio Auto-Update and Settlement Module
// This module handles automatic price updates and position settlement

import { getData, setData } from '../lib/firebase';
import type { KalshiTrade, PaperPosition, PortfolioStats } from '../components/KalshiTradingView';

/**
 * Update positions with latest prices from scanner data
 * This should be called whenever new scan data is loaded
 */
export function updatePositionsWithLatestPrices(
  positions: PaperPosition[],
  trades: KalshiTrade[]
): PaperPosition[] {
  return positions.map(position => {
    // Only update open positions
    if (position.status !== 'open') return position;

    // Find matching trade in scanner data
    const trade = trades.find(t => t.ticker === position.ticker);
    
    if (trade) {
      // Update with latest price
      const currentPrice = position.side === 'yes' ? trade.yesPrice : trade.noPrice;
      return {
        ...position,
        currentPrice
      };
    }

    // If no trade found, position keeps its last known currentPrice
    return position;
  });
}

/**
 * Auto-settle positions when markets have results
 * This checks for closed markets in the scan data and settles positions
 */
export function settlePositionsFromScan(
  positions: PaperPosition[],
  scanData: any,
  stats: PortfolioStats
): { positions: PaperPosition[]; stats: PortfolioStats; settled: PaperPosition[] } {
  const settled: PaperPosition[] = [];
  
  // Look for market results in scan data
  // Scanner stores resolved markets in brier.resolved or similar
  const resolvedMarkets = scanData?.brier?.resolved || [];
  
  const updatedPositions = positions.map(position => {
    if (position.status !== 'open') return position;

    // Check if this position's market has been resolved
    const resolution = resolvedMarkets.find((r: any) => r.ticker === position.ticker);
    
    if (resolution && resolution.outcome !== null) {
      // Market has resolved - settle the position
      const outcome = resolution.outcome; // 0 or 1
      const won = position.side === 'yes' ? outcome === 1 : outcome === 0;
      
      // Calculate P&L
      const grossPnl = won ? position.shares * (1 - position.entryPrice / 100) : -position.value;
      
      // Apply 7% fee on winning trades
      const FEE_RATE = 0.07;
      const fees = grossPnl > 0 ? grossPnl * FEE_RATE : 0;
      const netPnl = grossPnl - fees;
      
      const settledPosition = {
        ...position,
        status: 'closed' as const,
        pnl: netPnl,
        grossPnl,
        fees,
        currentPrice: won ? 100 : 0 // Final price
      };
      
      settled.push(settledPosition);
      return settledPosition;
    }

    return position;
  });

  // Update stats with settled positions
  const newStats = settled.reduce((acc, pos) => {
    const exitValue = pos.value + (pos.pnl || 0);
    return {
      ...acc,
      bankroll: acc.bankroll + exitValue,
      totalPnl: acc.totalPnl + (pos.pnl || 0),
      totalTrades: acc.totalTrades + 1,
      winningTrades: (pos.pnl || 0) > 0 ? acc.winningTrades + 1 : acc.winningTrades,
      losingTrades: (pos.pnl || 0) <= 0 ? acc.losingTrades + 1 : acc.losingTrades,
      openPositions: acc.openPositions - 1
    };
  }, stats);

  // Recalculate win rate and ROI
  newStats.winRate = newStats.totalTrades > 0 
    ? (newStats.winningTrades / newStats.totalTrades) * 100 
    : 0;
  newStats.roi = (newStats.totalPnl / newStats.initialBankroll) * 100;

  return { positions: updatedPositions, stats: newStats, settled };
}

/**
 * Calculate unrealized P&L for a position using stored current price
 * This works even when the trade is no longer in the active scanner data
 */
export function calculateUnrealizedPnL(position: PaperPosition): number {
  if (position.status !== 'open') return position.pnl || 0;
  
  // Use stored current price (updated by auto-price updater)
  const currentPrice = position.currentPrice;
  if (!currentPrice) return 0;
  
  const priceDiff = (currentPrice - position.entryPrice) / 100;
  return priceDiff * position.shares;
}

/**
 * Get total portfolio value including unrealized P&L
 */
export function getPortfolioValue(
  bankroll: number,
  positions: PaperPosition[]
): { totalValue: number; unrealizedPnl: number } {
  const openPositions = positions.filter(p => p.status === 'open');
  const positionValues = openPositions.reduce((sum, p) => {
    const pnl = calculateUnrealizedPnL(p);
    return sum + p.value + pnl;
  }, 0);
  
  return {
    totalValue: bankroll + positionValues,
    unrealizedPnl: positionValues - openPositions.reduce((s, p) => s + p.value, 0)
  };
}

/**
 * Debug function to log position status
 */
export function logPositionStatus(positions: PaperPosition[]) {
  console.log('=== Portfolio Status ===');
  console.log(`Total positions: ${positions.length}`);
  console.log(`Open: ${positions.filter(p => p.status === 'open').length}`);
  console.log(`Closed: ${positions.filter(p => p.status === 'closed').length}`);
  
  positions.filter(p => p.status === 'open').forEach(p => {
    const pnl = calculateUnrealizedPnL(p);
    console.log(`  ${p.ticker}: ${p.side} ${p.shares} shares @ ${p.entryPrice}¢ → ${p.currentPrice || '?'}¢ = $${pnl.toFixed(2)}`);
  });
}
