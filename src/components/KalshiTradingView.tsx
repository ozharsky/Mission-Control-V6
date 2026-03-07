import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Target, Activity, BarChart3, 
  Calendar, Clock, Filter, ArrowUpRight, ArrowDownRight, RefreshCw,
  DollarSign, Percent, Award, History, Zap, ChevronDown, ChevronUp,
  Plus, Minus, Trash2, AlertCircle, CloudRain, Zap as ZapIcon, Scale, Landmark, Trophy
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
  yesBid?: number;
  yesAsk?: number;
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
  timeAdjustment?: string;
  volumeBoost?: string;
  health?: 'good' | 'fair' | 'poor';
  spread?: string;
  liquidityScore?: number;
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
  currentPrice?: number; // Store last known price for P&L calc
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

const HEALTH_COLORS: Record<string, string> = {
  good: 'bg-success/20 text-success',
  fair: 'bg-warning/20 text-warning',
  poor: 'bg-danger/20 text-danger'
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
  }); // Removed edge > 0 filter since scanner already filters
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  weather: CloudRain,
  crypto: ZapIcon,
  politics: Scale,
  economics: Landmark,
  sports: Trophy,
  all: Filter
};

const CATEGORY_LABELS: Record<string, string> = {
  weather: 'Weather',
  crypto: 'Crypto',
  politics: 'Politics',
  economics: 'Economics',
  sports: 'Sports',
  all: 'All'
};

export function KalshiTradingView() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'portfolio' | 'history'>('opportunities');
  const [trades, setTrades] = useState<KalshiTrade[]>([]); // Start empty, load from scanner
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
  const [scanSummary, setScanSummary] = useState<any>(null);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const hasLoadedScanner = useRef(false);

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

  // Load scanner data - MAIN SOURCE
  useEffect(() => {
    if (hasLoadedScanner.current) return;
    hasLoadedScanner.current = true;
    
    const loadScannerData = async () => {
      setIsLoadingTrades(true);
      try {
        console.log('=== LOADING KALSHI DATA ===');
        
        // 1. Load base data from Firebase (scanner writes here)
        const scannerOutput = await getData('v6/kalshi/latest_scan');
        
        if (scannerOutput?.opportunities && Array.isArray(scannerOutput.opportunities) && scannerOutput.opportunities.length > 0) {
          console.log(`Base data: ${scannerOutput.opportunities.length} opportunities from scanner`);
          let transformed = transformScannerOutput(scannerOutput);
          
          // 2. Fetch live prices to update
          console.log('Fetching live price updates...');
          const updatedTrades = await updateWithLivePrices(transformed);
          
          setTrades(updatedTrades);
          setLastUpdated(new Date());
          setScanSummary(scannerOutput.summary);
          console.log(`✅ Displaying ${updatedTrades.length} trades with live prices`);
        } else {
          console.log('No scanner data - using fallback');
          setTrades(transformResearchedTrades());
        }
      } catch (e) {
        console.error('Failed:', e);
        setTrades(transformResearchedTrades());
      } finally {
        setIsLoadingTrades(false);
      }
    };
    
    loadScannerData();
  }, []);
  
  // Update trades with live prices from Kalshi API
  const updateWithLivePrices = async (trades: KalshiTrade[]): Promise<KalshiTrade[]> => {
    const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
    const updated = [...trades];
    
    // Get unique series from trades
    const seriesSet = new Set(trades.map(t => t.ticker.split('-')[0]));
    const livePrices = new Map<string, { yes: number; no: number; volume: number }>();
    
    // Fetch live data for each series
    for (const series of seriesSet) {
      try {
        const res = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
        if (res.ok) {
          const data = await res.json();
          if (data.markets) {
            for (const m of data.markets) {
              livePrices.set(m.ticker, {
                yes: m.yes_ask || m.yes_price || 50,
                no: m.no_ask || (100 - (m.yes_ask || m.yes_price || 50)),
                volume: m.volume || 0
              });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to fetch ${series}:`, e);
      }
    }
    
    // Update trades with live prices
    for (let i = 0; i < updated.length; i++) {
      const live = livePrices.get(updated[i].ticker);
      if (live) {
        updated[i] = {
          ...updated[i],
          yesPrice: live.yes,
          noPrice: live.no,
          volume: live.volume
        };
      }
    }
    
    return updated;
  };

  // Save positions to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      console.log(`Saving ${positions.length} positions to Firebase...`);
      setData('v6/kalshi/positions', positions)
        .then(() => console.log('✅ Positions saved'))
        .catch(err => console.error('❌ Failed to save positions:', err));
    }
  }, [positions, isDataLoaded]);

  // Save stats to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      console.log('Saving stats to Firebase...');
      setData('v6/kalshi/portfolio', stats)
        .then(() => console.log('✅ Stats saved'))
        .catch(err => console.error('❌ Failed to save stats:', err));
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

  // Calculate position P&L - uses live prices from trades or stored current price
  const calculatePositionPnL = (position: PaperPosition) => {
    if (position.status !== 'open') return position.pnl || 0;
    
    // Find current market data in trades
    const currentTrade = trades.find(t => t.ticker === position.ticker);
    
    let currentPrice: number;
    
    if (currentTrade) {
      // Use live price from trades
      currentPrice = position.side === 'yes' ? currentTrade.yesPrice : currentTrade.noPrice;
    } else if (position.currentPrice) {
      // Use stored current price from last update
      currentPrice = position.currentPrice;
      console.log(`Using stored price for ${position.ticker}: ${currentPrice}¢`);
    } else {
      // No price data available - P&L is 0 (price hasn't changed from entry)
      console.log(`No price data for ${position.ticker}, assuming entry price`);
      return 0;
    }
    
    const priceDiff = (currentPrice - position.entryPrice) / 100;
    const pnl = priceDiff * position.shares;
    
    console.log(`P&L for ${position.ticker}: entry=${position.entryPrice}¢, current=${currentPrice}¢, shares=${position.shares}, pnl=$${pnl.toFixed(2)}`);
    
    return pnl;
  };

  // Execute paper trade
  const executeTrade = (trade: KalshiTrade, side: 'yes' | 'no', amount: number) => {
    console.log(`Executing trade: ${trade.ticker} ${side} $${amount}`);
    const price = side === 'yes' ? trade.yesPrice : trade.noPrice;
    const priceDollars = price / 100;
    const shares = Math.floor(amount / priceDollars);
    const value = shares * priceDollars;

    console.log(`Price: ${price}¢, Shares: ${shares}, Value: $${value.toFixed(2)}`);

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

    console.log('New position:', newPosition);

    setPositions(prev => {
      const updated = [...prev, newPosition];
      console.log(`Positions updated: ${updated.length} total`);
      return updated;
    });
    
    setStats(prev => {
      const newStats = {
        ...prev,
        bankroll: prev.bankroll - value,
        openPositions: prev.openPositions + 1
      };
      console.log(`Stats updated: bankroll $${newStats.bankroll.toFixed(2)}, openPositions ${newStats.openPositions}`);
      return newStats;
    });
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

  // Memoize open positions with calculated P&L so it updates when trades change
  const openPositionsWithPnL = useMemo(() => {
    return positions
      .filter(p => p.status === 'open')
      .map(p => {
        // Find current price from trades
        const currentTrade = trades.find(t => t.ticker === p.ticker);
        const currentPrice = currentTrade 
          ? (p.side === 'yes' ? currentTrade.yesPrice : currentTrade.noPrice)
          : p.currentPrice; // Fallback to stored price
        
        // Calculate P&L
        const priceForCalc = currentPrice || p.entryPrice; // Use entry price if no current price
        const priceDiff = (priceForCalc - p.entryPrice) / 100;
        const pnl = priceDiff * p.shares;
        
        return { 
          ...p, 
          pnl, 
          pnlPct: (pnl / p.value) * 100,
          currentPrice: priceForCalc // Store current price for next calc
        };
      })
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)); // Sort by biggest P&L first
  }, [positions, trades]); // Recalculate when either changes

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
            onClick={async () => {
              setIsLoading(true);
              const updated = await updateWithLivePrices(trades);
              setTrades(updated);
              
              // Also update positions with current prices
              setPositions(prev => prev.map(p => {
                if (p.status !== 'open') return p;
                const trade = updated.find(t => t.ticker === p.ticker);
                if (trade) {
                  const currentPrice = p.side === 'yes' ? trade.yesPrice : trade.noPrice;
                  return { ...p, currentPrice };
                }
                return p;
              }));
              
              setLastUpdated(new Date());
              setIsLoading(false);
            }}
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
          {/* Scan Summary */}
          {scanSummary && (
            <div className="rounded-xl border border-surface-hover bg-surface p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span className="text-sm text-gray-400">Markets Analyzed:</span>
                  <span className="font-bold text-white">{scanSummary.analyzed || scanSummary.totalMarkets}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-success" />
                  <span className="text-sm text-gray-400">Opportunities:</span>
                  <span className="font-bold text-success">{scanSummary.opportunities}</span>
                </div>
                {scanSummary.byCategory && Object.entries(scanSummary.byCategory).map(([cat, count]) => (
                  count > 0 && (
                    <div key={cat} className="flex items-center gap-1 text-xs">
                      <span className="capitalize text-gray-500">{cat}:</span>
                      <span className="text-white">{count as number}</span>
                    </div>
                  )
                ))}
              </div>            </div>
          )}

          {/* Loading State */}
          {isLoadingTrades && (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-gray-400">Loading opportunities from scanner...</p>
            </div>
          )}

          {!isLoadingTrades && (
            <>
              {/* Category Buttons */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'weather', 'crypto', 'politics', 'economics'] as const).map((cat) => {
                  const Icon = CATEGORY_ICONS[cat];
                  const count = cat === 'all' 
                    ? filteredTrades.length 
                    : filteredTrades.filter(t => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        selectedCategory === cat 
                          ? 'bg-primary text-white' 
                          : 'bg-surface text-gray-300 hover:bg-surface-hover'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                        selectedCategory === cat ? 'bg-white/20' : 'bg-surface-hover'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm text-white"
                >
                  <option value="rScore">R-Score</option>
                  <option value="edge">Edge</option>
                  <option value="volume">Volume</option>
                </select>
                <span className="ml-auto text-sm text-gray-500">
                  Showing <span className="font-medium text-white">{filteredTrades.length}</span> trades
                  {scanSummary?.opportunities && (
                    <span className="text-gray-400"> (scanner found {scanSummary.opportunities})</span>
                  )}
                </span>
              </div>
            </>
          )}

          {/* Trade Cards - Only show when not loading */}
          {!isLoadingTrades && (
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
                      {trade.health && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_COLORS[trade.health] || 'bg-gray-500/20 text-gray-400'}`}>
                          {trade.health} {trade.spread && `(${trade.spread}¢ spread)`}
                        </span>
                      )}
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
                          </div>
                        ) : trade.subtitle ? (
                          <p className="mt-1 text-white">{trade.subtitle}</p>
                        ) : null}
                        
                        {/* Liquidity Info */}
                        {trade.health && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">Liquidity</p>
                            <p className={`text-sm font-medium ${trade.health === 'good' ? 'text-success' : trade.health === 'fair' ? 'text-warning' : 'text-danger'}`}>
                              {trade.health.toUpperCase()} - {trade.spread}¢ spread, Score: {trade.liquidityScore}/100
                            </p>
                          </div>
                        )}
                        
                        {/* Edge Breakdown */}
                        {(trade.timeAdjustment || trade.volumeBoost) && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">Edge Breakdown</p>
                            <p className="text-xs text-gray-400">
                              {trade.trueProbability}% true prob
                              {parseFloat(trade.timeAdjustment || '0') > 0 && ` (+${trade.timeAdjustment}% time)`}
                              {parseFloat(trade.volumeBoost || '0') > 0 && ` (+${trade.volumeBoost}% volume)`}
                            </p>
                          </div>
                        )}
                        
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
          )}
        </>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Open Positions ({openPositionsWithPnL.length})</h2>
          {!isDataLoaded ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-500" />
              <p className="mt-4 text-gray-400">Loading portfolio...</p>
            </div>
          ) : openPositionsWithPnL.length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <Wallet className="mx-auto h-12 w-12 text-gray-500" />
              <p className="mt-4 text-gray-400">No open positions</p>
              <p className="text-sm text-gray-500">Start trading from the Opportunities tab</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openPositionsWithPnL.map((position) => (
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
                        <p className={`font-medium ${position.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                          {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnlPct >= 0 ? '+' : ''}{position.pnlPct.toFixed(1)}%)
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
              ))}
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
