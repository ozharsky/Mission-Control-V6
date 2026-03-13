import { useState, useEffect, useCallback } from 'react';
import { KalshiPosition, KalshiPortfolioStats } from '../types/kalshi';
import { useFirebase } from './useFirebase';

const initialBankroll = 10000;

export function useKalshiPortfolio() {
  const { portfolioData, updatePortfolioData, loading, error } = useFirebase();
  const [positions, setPositions] = useState<KalshiPosition[]>([]);
  const [stats, setStats] = useState<KalshiPortfolioStats>({
    bankroll: initialBankroll,
    initialBankroll,
    totalPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalReturn: 0,
    openPositions: 0,
    closedPositions: 0,
    totalTrades: 0,
    winRate: 0,
    availableCash: initialBankroll,
    maxDrawdown: 0,
    dailyPnl: 0,
    lastUpdated: new Date().toISOString()
  });

  // Load portfolio from Firebase
  useEffect(() => {
    if (portfolioData) {
      setPositions(portfolioData.positions || []);
      setStats(portfolioData.stats || {
        bankroll: initialBankroll,
        initialBankroll,
        totalPnl: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalReturn: 0,
        openPositions: 0,
        closedPositions: 0,
        totalTrades: 0,
        winRate: 0,
        availableCash: initialBankroll,
        maxDrawdown: 0,
        dailyPnl: 0,
        lastUpdated: new Date().toISOString()
      });
    }
  }, [portfolioData]);

  // Calculate portfolio stats - FIX: Proper bankroll calculation
  const calculateStats = (positions: KalshiPosition[]): KalshiPortfolioStats => {
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    // Calculate total invested in open positions
    const totalInvested = openPositions.reduce((sum, p) => sum + p.cost, 0);
    
    // Calculate unrealized P&L (from open positions)
    const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    
    // Calculate realized P&L (from closed positions)
    const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);
    
    // Total P&L
    const totalPnl = unrealizedPnl + realizedPnl;
    
    // Current value of open positions
    const currentValue = openPositions.reduce((sum, p) => sum + (p.currentValue || p.cost), 0);
    
    // Calculate bankroll correctly: Initial + realized P&L + unrealized P&L
    const bankroll = initialBankroll + realizedPnl + unrealizedPnl;
    
    // Available cash = Bankroll - invested in open positions
    const availableCash = bankroll - totalInvested;
    
    // Total return percentage
    const totalReturn = initialBankroll > 0 
      ? (totalPnl / initialBankroll) * 100 
      : 0;
    
    // Calculate win rate from closed positions
    const winningTrades = closedPositions.filter(p => (p.realizedPnl || 0) > 0).length;
    const winRate = closedPositions.length > 0 
      ? (winningTrades / closedPositions.length) * 100 
      : 0;
    
    return {
      bankroll,
      initialBankroll,
      totalPnl,
      realizedPnl,
      unrealizedPnl,
      totalReturn,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      totalTrades: positions.length,
      winRate,
      availableCash,
      maxDrawdown: 0, // TODO: Implement max drawdown calculation
      dailyPnl: 0, // TODO: Track daily P&L
      lastUpdated: new Date().toISOString()
    };
  };

  // Add a new position
  const addPosition = useCallback(async (position: Omit<KalshiPosition, 'id' | 'entryTime'>) => {
    const newPosition: KalshiPosition = {
      ...position,
      id: `${position.marketId}-${Date.now()}`,
      entryTime: new Date().toISOString(),
      currentPrice: position.entryPrice,
      currentValue: position.contracts * position.entryPrice,
      pnl: 0,
      pnlPercent: 0
    };

    const newPositions = [...positions, newPosition];
    const newStats = calculateStats(newPositions);
    
    setPositions(newPositions);
    setStats(newStats);
    
    await updatePortfolioData({ positions: newPositions, stats: newStats });
    return newPosition;
  }, [positions, updatePortfolioData]);

  // Close a position
  const closePosition = useCallback(async (positionId: string, closePrice: number) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const priceChange = closePrice - position.entryPrice;
    const realizedPnl = (priceChange / 100) * position.contracts * position.entryPrice;
    const pnlPercent = (priceChange / position.entryPrice) * 100;

    const updatedPosition: KalshiPosition = {
      ...position,
      status: 'closed',
      exitPrice: closePrice,
      exitTime: new Date().toISOString(),
      realizedPnl,
      pnlPercent
    };

    const newPositions = positions.map(p => p.id === positionId ? updatedPosition : p);
    const newStats = calculateStats(newPositions);
    
    setPositions(newPositions);
    setStats(newStats);
    
    await updatePortfolioData({ positions: newPositions, stats: newStats });
    return updatedPosition;
  }, [positions, updatePortfolioData]);

  // Update position prices from scanner data - FIX: Proper bankroll calculation
  const updatePositionPrices = (positions: KalshiPosition[], stats: KalshiPortfolioStats, scannerData: any) => {
    let updatedCount = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;
    
    const updatedPositions = positions.map(position => {
      // Find matching market in scanner data
      const opportunity = scannerData.opportunities?.find((opp: any) => 
        opp.ticker === position.marketId
      );
      
      if (opportunity && opportunity.yesPrice !== undefined) {
        const currentPrice = position.side === 'YES' 
          ? opportunity.yesPrice 
          : 100 - opportunity.yesPrice;
        
        const priceChange = currentPrice - position.entryPrice;
        const unrealizedPnl = (priceChange / 100) * position.contracts * position.entryPrice;
        const pnlPercent = (priceChange / position.entryPrice) * 100;
        
        if (position.status === 'closed') {
          totalRealizedPnl += position.realizedPnl || 0;
        } else {
          totalUnrealizedPnl += unrealizedPnl;
        }
        
        updatedCount++;
        
        return {
          ...position,
          currentPrice,
          pnl: unrealizedPnl,
          pnlPercent,
          currentValue: position.contracts * currentPrice,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Position not found in scanner, keep as is
      if (position.status === 'closed') {
        totalRealizedPnl += position.realizedPnl || 0;
      } else {
        totalUnrealizedPnl += position.pnl || 0;
      }
      
      return position;
    });
    
    // Calculate bankroll correctly: Initial + realized P&L + unrealized P&L
    const newBankroll = stats.initialBankroll + totalRealizedPnl + totalUnrealizedPnl;
    
    const newStats: KalshiPortfolioStats = {
      ...stats,
      bankroll: newBankroll,
      unrealizedPnl: totalUnrealizedPnl,
      realizedPnl: totalRealizedPnl,
      totalPnl: totalRealizedPnl + totalUnrealizedPnl,
      totalReturn: stats.initialBankroll > 0 
        ? ((totalRealizedPnl + totalUnrealizedPnl) / stats.initialBankroll) * 100 
        : 0,
      availableCash: newBankroll - updatedPositions
        .filter(p => p.status === 'open')
        .reduce((sum, p) => sum + p.cost, 0),
      lastUpdated: new Date().toISOString()
    };
    
    return { updatedPositions, newStats, updatedCount };
  };

  // Auto-update prices from scanner
  useEffect(() => {
    const handleScannerUpdate = (event: CustomEvent) => {
      const scannerData = event.detail;
      if (scannerData?.opportunities) {
        const { updatedPositions, newStats, updatedCount } = updatePositionPrices(positions, stats, scannerData);
        
        if (updatedCount > 0) {
          setPositions(updatedPositions);
          setStats(newStats);
          updatePortfolioData({ positions: updatedPositions, stats: newStats });
          console.log(`✅ Updated ${updatedCount} position prices from scanner`);
        }
      }
    };

    window.addEventListener('kalshiScannerUpdate', handleScannerUpdate as EventListener);
    return () => window.removeEventListener('kalshiScannerUpdate', handleScannerUpdate as EventListener);
  }, [positions, stats, updatePortfolioData]);

  return {
    positions,
    stats,
    loading,
    error,
    addPosition,
    closePosition,
    updatePositionPrices,
    refreshPortfolio: async () => {
      // Refresh from Firebase
      const data = await updatePortfolioData({ positions, stats });
      return data;
    }
  };
}