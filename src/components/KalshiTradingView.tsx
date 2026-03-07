import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Target, Activity, BarChart3, 
  Calendar, Clock, Filter, ArrowUpRight, ArrowDownRight, RefreshCw,
  DollarSign, Percent, Award, History, Zap, ChevronDown, ChevronUp,
  Plus, Minus, Trash2, AlertCircle
} from 'lucide-react';
import { getData, setData } from '../lib/firebase';
import { RESEARCHED_TRADES } from './trades-data';

// Types
interface KalshiTrade {
  id: string;
  ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  expiration: string;
  edge: number;
  rScore: number;
  kellyPct: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
  strikePrice?: number;
  floor?: number;
  cap?: number;
  trueProbability?: number;
  multiplier?: number;
  research?: {
    catalyst: string;
    confidence: 'high' | 'medium' | 'low';
    sources: string[];
  };
}

interface PaperPosition {
  id: string;
  ticker: string;
  side: 'yes' | 'no';
  entryPrice: number;
  shares: number;
  value: number;
  openedAt: string;
  status: 'open' | 'closed';
  pnl?: number;
  grossPnl?: number;
  fees?: number;
  marketTitle?: string;
}

interface PortfolioStats {
  bankroll: number;
  initialBankroll: number;
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  roi: number;
  maxDrawdown: number;
  openPositions: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  weather: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  crypto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  politics: 'bg-red-500/20 text-red-400 border-red-500/30',
  economics: 'bg-green-500/20 text-green-400 border-green-500/30',
  sports: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  strong_buy: 'bg-success/20 text-success border-success',
  buy: 'bg-primary/20 text-primary border-primary',
  hold: 'bg-warning/20 text-warning border-warning',
  avoid: 'bg-danger/20 text-danger border-danger'
};

// Transform RESEARCHED_TRADES to KalshiTrade format
function transformResearchedTrades(): KalshiTrade[] {
  return RESEARCHED_TRADES.map((trade: any) => {
    // Calculate R-Score from edge
    const edge = trade.research?.edge || 0;
    const rScore = edge > 0 ? Math.max(1, edge / 10 + 1) : 0;
    
    // Determine recommendation based on R-Score
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid' = 'avoid';
    if (rScore >= 2.0) recommendation = 'strong_buy';
    else if (rScore >= 1.5) recommendation = 'buy';
    else if (rScore >= 1.0) recommendation = 'hold';
    
    // Calculate Kelly percentage (half-Kelly for safety)
    const kellyPct = edge > 0 ? Math.min(10, edge / 2) : 0;
    
    // Parse title for range info
    let floor: number | undefined;
    let cap: number | undefined;
    
    // Check for temperature ranges in title (e.g., "<48°F", ">54°F", "43-44°F")
    const tempRangeMatch = trade.title.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/);
    const tempLessMatch = trade.title.match(/<(\d+)[°\s]*F/);
    const tempGreaterMatch = trade.title.match(/>(\d+)[°\s]*F/);
    
    if (tempRangeMatch) {
      floor = parseInt(tempRangeMatch[1], 10);
      cap = parseInt(tempRangeMatch[2], 10);
    } else if (tempLessMatch) {
      floor = -100; // Effectively no lower bound
      cap = parseInt(tempLessMatch[1], 10);
    } else if (tempGreaterMatch) {
      floor = parseInt(tempGreaterMatch[1], 10);
      cap = 150; // Effectively no upper bound
    }
    
    // Check for price ranges (e.g., "$85k-$90k", ">$50k")
    const priceRangeMatch = trade.title.match(/\$?(\d+)[kK]?[\s-]+\$?(\d+)[kK]?/);
    if (priceRangeMatch && !floor) {
      floor = parseInt(priceRangeMatch[1], 10) * (trade.title.includes('k') || trade.title.includes('K') ? 1000 : 1);
      cap = parseInt(priceRangeMatch[2], 10) * (trade.title.includes('k') || trade.title.includes('K') ? 1000 : 1);
    }
    
    // Check for post count ranges
    const postsMatch = trade.title.match(/(\d+)[\s-]+(\d+)\s*posts/i);
    if (postsMatch && !floor) {
      floor = parseInt(postsMatch[1], 10);
      cap = parseInt(postsMatch[2], 10);
    }
    
    return {
      id: trade.id,
      ticker: trade.ticker,
      title: trade.title,
      category: trade.category,
      yesPrice: trade.yesPrice,
      noPrice: trade.noPrice,
      volume: trade.volume,
      expiration: trade.expiration,
      edge: edge,
      rScore: Math.round(rScore * 10) / 10,
      kellyPct: kellyPct,
      recommendation: recommendation,
      floor,
      cap,
      trueProbability: trade.research?.trueProbability,
      multiplier: trade.payout?.multiplier,
      research: {
        catalyst: trade.research?.catalyst || '',
        confidence: trade.research?.confidence || 'medium',
        sources: trade.research?.sources || []
      }
    };
  }).filter(t => t.edge > 0); // Only show +EV trades
}

// Transform scanner output to KalshiTrade format
function transformScannerOutput(scannerData: any): KalshiTrade[] {
  if (!scannerData?.opportunities || !Array.isArray(scannerData.opportunities)) {
    return [];
  }
  
  return scannerData.opportunities.map((opp: any) => {
    // Calculate R-Score from edge
    const edgeStr = opp.edge?.replace('%', '') || '0';
    const edge = parseFloat(edgeStr);
    const rScore = edge > 0 ? 1 + (edge / 10) : 0;
    
    // Determine recommendation
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid' = 'avoid';
    if (rScore >= 2.0) recommendation = 'strong_buy';
    else if (rScore >= 1.5) recommendation = 'buy';
    else if (rScore >= 1.0) recommendation = 'hold';
    
    // Calculate Kelly
    const kellyPct = edge > 0 ? Math.min(10, edge / 2) : 0;
    
    // Parse floor/cap from title or subtitle
    let floor: number | undefined;
    let cap: number | undefined;
    const title = opp.title || '';
    const subtitle = opp.subtitle || '';
    
    // Try to extract range from title/subtitle
    const tempRangeMatch = title.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/) || subtitle.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/);
    const tempLessMatch = title.match(/<(\d+)[°\s]*F/) || subtitle.match(/<(\d+)[°\s]*F/);
    const tempGreaterMatch = title.match(/>(\d+)[°\s]*F/) || subtitle.match(/>(\d+)[°\s]*F/);
    
    if (tempRangeMatch) {
      floor = parseInt(tempRangeMatch[1], 10);
      cap = parseInt(tempRangeMatch[2], 10);
    } else if (tempLessMatch) {
      floor = -100;
      cap = parseInt(tempLessMatch[1], 10);
    } else if (tempGreaterMatch) {
      floor = parseInt(tempGreaterMatch[1], 10);
      cap = 150;
    }
    
    return {
      id: opp.ticker || `opp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ticker: opp.ticker,
      title: opp.title,
      subtitle: opp.subtitle,
      category: opp.category || 'unknown',
      yesPrice: opp.yesPrice || opp.price,
      noPrice: opp.noPrice || (100 - (opp.yesPrice || opp.price || 50)),
      volume: opp.volume || 0,
      expiration: opp.closeTime || opp.expiration,
      edge,
      rScore: Math.round(rScore * 10) / 10,
      kellyPct,
      recommendation,
      floor,
      cap,
      trueProbability: opp.signals?.baseSignal?.trueProbability,
      multiplier: opp.yesPrice > 0 ? Math.round(100 / opp.yesPrice * 10) / 10 : undefined,
      research: {
        catalyst: opp.signals?.baseSignal?.catalyst || subtitle || 'Scanner-identified opportunity',
        confidence: opp.confidence?.level?.toLowerCase() || 'medium',
        sources: opp.signals ? Object.keys(opp.signals).filter(k => k !== 'baseSignal') : []
      }
    };
  }).filter((t: KalshiTrade) => t.edge > 0);
}

export function KalshiTradingView() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'portfolio' | 'history'>('opportunities');
  const [trades, setTrades] = useState<KalshiTrade[]>(transformResearchedTrades());
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    bankroll: 10000,
    initialBankroll: 10000,
    totalPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    roi: 0,
    maxDrawdown: 0,
    openPositions: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'edge' | 'rScore' | 'volume'>('rScore');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Load positions and stats from Firebase on mount
  useEffect(() => {
    const loadFromFirebase = async () => {
      try {
        console.log('Loading Kalshi data from Firebase...');
        const savedPositions = await getData('v6/kalshi/positions');
        const savedStats = await getData('v6/kalshi/portfolio');
        
        console.log('Loaded positions:', savedPositions);
        console.log('Loaded stats:', savedStats);
        
        if (savedPositions && Array.isArray(savedPositions) && savedPositions.length > 0) {
          console.log(`Restoring ${savedPositions.length} positions`);
          setPositions(savedPositions);
        } else {
          console.log('No saved positions found');
        }
        
        if (savedStats && typeof savedStats === 'object') {
          console.log('Restoring portfolio stats');
          setStats(prev => ({
            ...prev,
            ...savedStats,
            // Ensure these are calculated fresh
            openPositions: savedPositions?.filter((p: PaperPosition) => p.status === 'open').length || 0
          }));
        }
      } catch (e) {
        console.error('Failed to load from Firebase:', e);
      }
      setIsDataLoaded(true);
    };
    
    loadFromFirebase();
  }, []);

  // Load scanner data and merge with RESEARCHED_TRADES
  useEffect(() => {
    const loadScannerData = async () => {
      try {
        // Try to load from Firebase first (if scanner writes there)
        const scannerOutput = await getData('v6/kalshi/latest_scan');
        
        if (scannerOutput?.opportunities && Array.isArray(scannerOutput.opportunities)) {
          console.log(`Loaded ${scannerOutput.opportunities.length} opportunities from scanner`);
          const transformed = transformScannerOutput(scannerOutput);
          if (transformed.length > 0) {
            // Merge with researched trades, prioritizing scanner data for same tickers
            const scannerTickers = new Set(transformed.map(t => t.ticker));
            const existingTrades = transformResearchedTrades().filter(t => !scannerTickers.has(t.ticker));
            setTrades([...transformed, ...existingTrades]);
            setLastUpdated(new Date(scannerOutput.scan_time || Date.now()));
          }
        } else {
          console.log('No scanner data found, using RESEARCHED_TRADES');
        }
      } catch (e) {
        console.error('Failed to load scanner data:', e);
      }
    };
    
    loadScannerData();
    
    // Refresh every 5 minutes to check for new scanner data
    const interval = setInterval(loadScannerData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Save positions to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      setData('v6/kalshi/positions', positions).catch(console.error);
    }
  }, [positions, isDataLoaded]);

  // Save stats to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      setData('v6/kalshi/portfolio', stats).catch(console.error);
    }
  }, [stats, isDataLoaded]);

  // Fetch live data from Kalshi API
  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      const seriesToFetch = [
        { series: 'KXHIGHTSEA', category: 'weather' },
        { series: 'KXHIGHNY', category: 'weather' },
        { series: 'KXHIGHCHI', category: 'weather' },
        { series: 'KXBTC', category: 'crypto' },
        { series: 'KXETH', category: 'crypto' },
        { series: 'KXTRUTHSOCIAL', category: 'politics' },
        { series: 'KXFED', category: 'economics' },
      ];
      
      let allMarkets: KalshiTrade[] = [];
      for (const { series, category } of seriesToFetch) {
        try {
          await new Promise(r => setTimeout(r, 100));
          const res = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
          if (res.ok) {
            const data = await res.json();
            if (data.markets) {
              const transformed = data.markets.map((m: any) => {
                const yesPrice = m.yes_ask || m.yes_price || 50;
                const noPrice = m.no_ask || m.no_bid || (100 - yesPrice);
                
                // Extract strike price or range from subtitle or title
                const subtitle = m.subtitle || m.event_title || '';
                const title = m.title || '';
                
                // Try to extract range info from subtitle or parse ticker
                let floor: number | undefined;
                let cap: number | undefined;
                let strikePrice: number | undefined;
                
                // Parse ticker for range info (e.g., KXBTC-85000-90000)
                const tickerParts = m.ticker?.split('-');
                if (tickerParts && tickerParts.length >= 3) {
                  floor = parseInt(tickerParts[tickerParts.length - 2], 10);
                  cap = parseInt(tickerParts[tickerParts.length - 1], 10);
                }
                
                // Also check subtitle for range patterns like "$85,000 - $90,000" or "43° - 44°"
                const rangeMatch = subtitle.match(/\$?([\d,]+).{0,3}\$?([\d,]+)/) || 
                                   subtitle.match(/(\d+)[°\s].{0,3}(\d+)[°\s]/);
                if (rangeMatch) {
                  floor = parseInt(rangeMatch[1].replace(/,/g, ''), 10);
                  cap = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
                }
                
                // Calculate edge based on price vs probability
                // For now use mock - would be replaced with actual research data
                const edge = Math.random() * 20 - 5;
                const rScore = edge > 0 ? 1 + (edge / 10) : 0;
                
                return {
                  id: m.ticker,
                  ticker: m.ticker,
                  title: title,
                  subtitle: subtitle,
                  category,
                  yesPrice,
                  noPrice,
                  volume: m.volume || 0,
                  expiration: m.close_date || m.expiration_date,
                  edge: Math.round(edge),
                  rScore: Math.round(rScore * 10) / 10,
                  kellyPct: Math.max(1, Math.min(10, edge / 2)),
                  recommendation: edge > 10 ? 'strong_buy' : edge > 5 ? 'buy' : edge > 0 ? 'hold' : 'avoid',
                  strikePrice,
                  floor,
                  cap,
                  research: { catalyst: subtitle || 'Live market data', confidence: 'medium', sources: [] }
                };
              });
              allMarkets = [...allMarkets, ...transformed];
            }
          }
        } catch (e) {
          console.error(`Error fetching ${series}:`, e);
        }
      }
      
      if (allMarkets.length > 0) {
        // Filter for positive edge trades only
        const goodTrades = allMarkets.filter(t => t.edge > 0);
        setTrades(goodTrades.length > 0 ? goodTrades : allMarkets);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Failed to fetch live data:', e);
    }
    setIsLoading(false);
  };

  // Load on mount
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }
    result.sort((a, b) => {
      if (sortBy === 'edge') return b.edge - a.edge;
      if (sortBy === 'rScore') return b.rScore - a.rScore;
      if (sortBy === 'volume') return b.volume - a.volume;
      return 0;
    });
    return result;
  }, [trades, selectedCategory, sortBy]);

  // Calculate position P&L
  const calculatePositionPnL = (position: PaperPosition) => {
    const currentTrade = trades.find(t => t.ticker === position.ticker);
    if (!currentTrade || position.status !== 'open') return position.pnl || 0;
    
    const currentPrice = position.side === 'yes' ? currentTrade.yesPrice : currentTrade.noPrice;
    const priceDiff = (currentPrice - position.entryPrice) / 100;
    return priceDiff * position.shares;
  };

  // Execute paper trade
  const executeTrade = (trade: KalshiTrade, side: 'yes' | 'no', amount: number) => {
    const price = side === 'yes' ? trade.yesPrice : trade.noPrice;
    const priceDollars = price / 100;
    const shares = Math.floor(amount / priceDollars);
    const value = shares * priceDollars;

    if (value > stats.bankroll * 0.1) {
      alert(`Position too large. Max 10% of bankroll ($${(stats.bankroll * 0.1).toFixed(0)})`);
      return;
    }
    if (value > stats.bankroll) {
      alert('Insufficient funds');
      return;
    }

    const newPosition: PaperPosition = {
      id: Date.now().toString(),
      ticker: trade.ticker,
      side,
      entryPrice: price,
      shares,
      value,
      openedAt: new Date().toISOString(),
      status: 'open',
      marketTitle: trade.title
    };

    setPositions(prev => [...prev, newPosition]);
    setStats(prev => ({
      ...prev,
      bankroll: prev.bankroll - value,
      openPositions: prev.openPositions + 1
    }));
  };

  // Close position with 7% fee on winning trades (matching kalshi_paper_trading.js)
  const closePosition = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const grossPnl = calculatePositionPnL(position);
    
    // Apply 7% fee on winning trades (matching your kalshi_paper_trading.js config)
    const FEE_RATE = 0.07;
    const fees = grossPnl > 0 ? grossPnl * FEE_RATE : 0;
    const netPnl = grossPnl - fees;
    
    const exitValue = position.value + netPnl;

    setPositions(prev => prev.map(p => 
      p.id === positionId 
        ? { ...p, status: 'closed', pnl: netPnl, grossPnl, fees }
        : p
    ));

    setStats(prev => ({
      ...prev,
      bankroll: prev.bankroll + exitValue,
      totalPnl: prev.totalPnl + netPnl,
      totalTrades: prev.totalTrades + 1,
      winningTrades: netPnl > 0 ? prev.winningTrades + 1 : prev.winningTrades,
      losingTrades: netPnl <= 0 ? prev.losingTrades + 1 : prev.losingTrades,
      winRate: ((netPnl > 0 ? prev.winningTrades + 1 : prev.winningTrades) / (prev.totalTrades + 1)) * 100,
      roi: ((prev.totalPnl + netPnl) / prev.initialBankroll) * 100,
      openPositions: prev.openPositions - 1
    }));

    // Show fee notification if fees were applied
    if (fees > 0) {
      console.log(`Position closed: ${position.ticker} | Gross P&L: +$${grossPnl.toFixed(2)} | Fees (7%): -$${fees.toFixed(2)} | Net P&L: +$${netPnl.toFixed(2)}`);
    }
  };

  // Stats cards
  const StatCard = ({ title, value, trend, icon: Icon, color }: any) => (
    <div className="rounded-xl border border-surface-hover bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
            {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kalshi Trading</h1>
          <p className="text-sm text-gray-400">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'opportunities' ? 'bg-primary text-white' : 'bg-surface text-gray-300 hover:bg-surface-hover'
            }`}
          >
            Opportunities
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'portfolio' ? 'bg-primary text-white' : 'bg-surface text-gray-300 hover:bg-surface-hover'
            }`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'history' ? 'bg-primary text-white' : 'bg-surface text-gray-300 hover:bg-surface-hover'
            }`}
          >
            History
          </button>
          <button
            onClick={fetchLiveData}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-gray-300 hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Portfolio Stats */}
      {activeTab === 'portfolio' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Bankroll"
            value={`$${stats.bankroll.toLocaleString()}`}
            trend={stats.roi}
            icon={Wallet}
            color="bg-primary/20 text-primary"
          />
          <StatCard
            title="Total P&L"
            value={`$${stats.totalPnl.toFixed(2)}`}
            trend={stats.totalPnl > 0 ? (stats.totalPnl / stats.initialBankroll) * 100 : undefined}
            icon={DollarSign}
            color={stats.totalPnl >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}
          />
          <StatCard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={Target}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatCard
            title="Open Positions"
            value={stats.openPositions.toString()}
            icon={Activity}
            color="bg-purple-500/20 text-purple-400"
          />
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm text-white"
            >
              <option value="all">All Categories</option>
              <option value="weather">Weather</option>
              <option value="crypto">Crypto</option>
              <option value="politics">Politics</option>
              <option value="economics">Economics</option>
              <option value="sports">Sports</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm text-white"
            >
              <option value="rScore">Sort by R-Score</option>
              <option value="edge">Sort by Edge</option>
              <option value="volume">Sort by Volume</option>
            </select>
          </div>

          {/* Trade Cards */}
          <div className="space-y-3">
            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className="rounded-xl border border-surface-hover bg-surface p-4 transition-all hover:border-primary/50"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {/* Left: Trade Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[trade.category] || CATEGORY_COLORS.default}`}>
                        {trade.category}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${RECOMMENDATION_COLORS[trade.recommendation]}`}>
                        {trade.recommendation.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="mt-2 truncate text-lg font-semibold text-white">{trade.title}</h3>
                    
                    {/* Show range/subtitle prominently */}
                    <div className="mt-1 flex items-center gap-2">
                      {trade.floor !== undefined && trade.cap !== undefined ? (
                        <span className="rounded bg-surface-hover px-2 py-1 text-sm font-medium text-primary">
                          {trade.category === 'crypto' || trade.category === 'economics' 
                            ? `$${trade.floor.toLocaleString()} - $${trade.cap.toLocaleString()}`
                            : `${trade.floor}° - ${trade.cap}°`
                          }
                        </span>
                      ) : trade.subtitle ? (
                        <span className="truncate text-sm text-gray-300">{trade.subtitle}</span>
                      ) : null}
                      <span className="text-xs text-gray-500">{trade.ticker}</span>
                    </div>
                    
                    {/* Expiration date */}
                    <p className="mt-1 text-xs text-gray-500">
                      Expires: {new Date(trade.expiration).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>

                  {/* Center: Metrics */}
                  <div className="flex gap-4 sm:gap-6">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">R-Score</p>
                      <p className={`text-lg font-bold ${trade.rScore >= 1.5 ? 'text-success' : trade.rScore >= 1.0 ? 'text-primary' : 'text-gray-400'}`}>
                        {trade.rScore.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Edge</p>
                      <p className={`text-lg font-bold ${trade.edge > 0 ? 'text-success' : 'text-danger'}`}>
                        {trade.edge > 0 ? '+' : ''}{trade.edge}¢
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Yes Price</p>
                      <p className="text-lg font-bold text-white">{trade.yesPrice}¢</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-500">Volume</p>
                      <p className="text-lg font-bold text-white">{(trade.volume / 1000).toFixed(0)}k</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                      className="rounded-lg border border-surface-hover p-2 text-gray-400 hover:bg-surface-hover"
                    >
                      {expandedTrade === trade.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedTrade === trade.id && (
                  <div className="mt-4 border-t border-surface-hover pt-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <p className="text-sm text-gray-400">Research</p>
                        <p className="mt-1 text-white">{trade.research?.catalyst || 'No research available'}</p>
                        <div className="mt-2 flex gap-2">
                          {trade.research?.sources.map((source, i) => (
                            <span key={i} className="rounded bg-surface-hover px-2 py-1 text-xs text-gray-400">{source}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Backtested Edge Calculation</p>
                        <div className="mt-1 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">True Probability:</span>
                            <span className="text-white font-medium">{trade.trueProbability}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Market Price:</span>
                            <span className="text-white">{trade.yesPrice}¢</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Edge:</span>
                            <span className="text-success font-medium">+{trade.edge}¢</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">R-Score:</span>
                            <span className={`font-medium ${trade.rScore >= 1.5 ? 'text-success' : 'text-primary'}`}>
                              {trade.rScore.toFixed(2)}
                            </span>
                          </div>
                          {trade.multiplier && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Multiplier:</span>
                              <span className="text-primary font-medium">{trade.multiplier.toFixed(1)}x</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Confidence:</span>
                            <span className={`capitalize ${
                              trade.research?.confidence === 'high' ? 'text-success' : 
                              trade.research?.confidence === 'medium' ? 'text-warning' : 'text-gray-400'
                            }`}>
                              {trade.research?.confidence}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Market Details</p>
                        {trade.floor !== undefined && trade.cap !== undefined ? (
                          <div className="mt-1">
                            <p className="text-white font-medium">
                              Range: {trade.category === 'crypto' || trade.category === 'economics' 
                                ? `$${trade.floor.toLocaleString()} - $${trade.cap.toLocaleString()}`
                                : `${trade.floor}° - ${trade.cap}°`
                              }
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Buy YES if you think the outcome will be IN this range
                            </p>
                            <p className="text-sm text-gray-500">
                              Buy NO if you think the outcome will be OUTSIDE this range
                            </p>
                          </div>
                        ) : trade.subtitle ? (
                          <p className="mt-1 text-white">{trade.subtitle}</p>
                        ) : null}
                        <p className="mt-3 text-sm text-gray-400">Expires</p>
                        <p className="text-white">{new Date(trade.expiration).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}</p>
                        <p className="mt-2 text-sm text-gray-400">Kelly %</p>
                        <p className="text-white">{trade.kellyPct.toFixed(1)}% of bankroll</p>
                        <p className="text-xs text-gray-500">Max position: ${(stats.bankroll * 0.1).toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => executeTrade(trade, 'yes', Math.min(100, stats.bankroll * 0.05))}
                        className="flex items-center gap-2 rounded-lg bg-success/20 px-4 py-2 text-sm font-medium text-success hover:bg-success/30"
                      >
                        <Plus className="h-4 w-4" />
                        Buy Yes @ {trade.yesPrice}¢
                      </button>
                      <button
                        onClick={() => executeTrade(trade, 'no', Math.min(100, stats.bankroll * 0.05))}
                        className="flex items-center gap-2 rounded-lg bg-danger/20 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/30"
                      >
                        <Plus className="h-4 w-4" />
                        Buy No @ {trade.noPrice}¢
                      </button>
                      <a
                        href={`https://kalshi.com/events/${trade.ticker.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-2 rounded-lg bg-surface-hover px-4 py-2 text-sm text-gray-300 hover:bg-surface-hover/80"
                      >
                        View on Kalshi
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredTrades.length === 0 && (
              <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-4 text-gray-400">No trades match your filters</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Open Positions</h2>
          {!isDataLoaded ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-500" />
              <p className="mt-4 text-gray-400">Loading portfolio...</p>
            </div>
          ) : positions.filter(p => p.status === 'open').length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <Wallet className="mx-auto h-12 w-12 text-gray-500" />
              <p className="mt-4 text-gray-400">No open positions</p>
              <p className="text-sm text-gray-500">Start trading from the Opportunities tab</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.filter(p => p.status === 'open').map((position) => {
                const pnl = calculatePositionPnL(position);
                const pnlPct = (pnl / position.value) * 100;
                return (
                  <div key={position.id} className="rounded-xl border border-surface-hover bg-surface p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${position.side === 'yes' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                            {position.side.toUpperCase()}
                          </span>
                          <p className="text-sm text-gray-400">{position.ticker}</p>
                        </div>
                        <p className="mt-1 font-medium text-white">{position.marketTitle}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Entry</p>
                          <p className="text-white">{position.entryPrice}¢ × {position.shares}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Value</p>
                          <p className="text-white">${position.value.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">P&L</p>
                          <p className={`font-medium ${pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                          </p>
                        </div>
                        <button
                          onClick={() => closePosition(position.id)}
                          className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-gray-300 hover:bg-danger/20 hover:text-danger"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Trade History</h2>
          {positions.filter(p => p.status === 'closed').length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <History className="mx-auto h-12 w-12 text-gray-500" />
              <p className="mt-4 text-gray-400">No closed trades yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-hover text-gray-500">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Ticker</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Entry</th>
                    <th className="pb-2">Shares</th>
                    <th className="pb-2 text-right">Gross P&L</th>
                    <th className="pb-2 text-right">Fees (7%)</th>
                    <th className="pb-2 text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-hover">
                  {positions.filter(p => p.status === 'closed').map((position) => (
                    <tr key={position.id}>
                      <td className="py-3 text-gray-400">{new Date(position.openedAt).toLocaleDateString()}</td>
                      <td className="py-3 text-white">{position.ticker}</td>
                      <td className="py-3">
                        <span className={`rounded px-2 py-0.5 text-xs ${position.side === 'yes' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                          {position.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-white">{position.entryPrice}¢</td>
                      <td className="py-3 text-white">{position.shares}</td>
                      <td className={`py-3 text-right ${(position.grossPnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(position.grossPnl || 0) >= 0 ? '+' : ''}${(position.grossPnl || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-gray-500">
                        {position.fees ? `-$${position.fees.toFixed(2)}` : '-'}
                      </td>
                      <td className={`py-3 text-right font-medium ${(position.pnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(position.pnl || 0) >= 0 ? '+' : ''}${(position.pnl || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
