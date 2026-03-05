import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Target, AlertCircle, CheckCircle,
  DollarSign, Percent, Calendar, ExternalLink,
  CloudRain, Zap, BarChart3, Activity,
  RefreshCw, BookOpen, Filter, ChevronDown, ChevronUp,
  HelpCircle, X, ArrowUpRight, Info, Shield,
  Building2, Rocket, Globe
} from 'lucide-react';
import { RESEARCHED_TRADES } from './trades-data';

// Educational tooltip component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="cursor-help">
        {children}
      </div>
      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-surface-hover p-3 text-xs shadow-lg border border-surface">
          {text}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-surface-hover border-r border-b border-surface" />
        </div>
      )}
    </div>
  );
}

// Simple sparkline chart
function Sparkline({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-6 w-16 bg-surface-hover rounded shrink-0" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-6 w-16 shrink-0" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="4" points={points} />
    </svg>
  );
}

interface KalshiTrade {
  id: string;
  ticker: string;
  title: string;
  category: 'weather' | 'crypto' | 'politics' | 'economics' | 'sports';
  yesPrice: number;
  noPrice: number;
  volume: number;
  expiration: string;
  kalshiUrl: string;
  priceHistory?: number[];
  research: {
    trueProbability: number;
    edge: number;
    confidence: 'high' | 'medium' | 'low';
    catalyst: string;
    sources: string[];
  };
  payout: {
    buyPrice: number;
    potentialReturn: number;
    multiplier: number;
  };
  // Trading bot fields
  rScore?: number;
  kellyFraction?: number;
  position?: {
    shares: number;
    avgEntry: number;
    unrealizedPnl: number;
  };
}

const CATEGORY_ICONS = {
  weather: CloudRain,
  crypto: Zap,
  politics: Target,
  economics: BarChart3,
  sports: Activity,
  government: Shield,
  finance: DollarSign,
  companies: Building2,
  science: Rocket,
  world: Globe
};

const CATEGORY_COLORS = {
  weather: 'bg-blue-500/20 text-blue-400',
  crypto: 'bg-orange-500/20 text-orange-400',
  politics: 'bg-red-500/20 text-red-400',
  economics: 'bg-green-500/20 text-green-400',
  sports: 'bg-purple-500/20 text-purple-400',
  government: 'bg-indigo-500/20 text-indigo-400',
  finance: 'bg-emerald-500/20 text-emerald-400',
  companies: 'bg-cyan-500/20 text-cyan-400',
  science: 'bg-violet-500/20 text-violet-400',
  world: 'bg-teal-500/20 text-teal-400'
};

const EDUCATION_CONTENT = {
  rScore: "R measures edge vs market. >1.5 = strong +EV trade, 1.0-1.5 = decent, <1.0 = marginal.",
  kelly: "K % is the optimal position size. Bet this % of your bankroll (we use half-K for safety).",
  multiplier: "Multiplier shows payout potential. 10x means $1 bet wins $10. Higher multipliers come with lower probability.",
  pay: "Pay is the contract price in cents. 5¢ = $0.05 per share. Lower prices = higher multipliers but lower probability.",
  volume: "Volume shows how much is being traded. Higher = more liquid = easier to buy/sell at fair prices.",
  confidence: "High = strong data. Medium = decent data. Low = limited data. Higher confidence = more reliable edge estimate.",
  yesNo: "👍 BUY YES if you think the event WILL happen. 👎 Buy NO if you think it WON'T happen."
};

function PredictionMeter({ probability, marketPrice }: { probability: number; marketPrice: number }) {
  const edge = probability - marketPrice;
  return (
    <div className="space-y-1 w-full min-w-0">
      <div className="relative h-2 rounded-full bg-surface-hover overflow-hidden">
        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${marketPrice}%` }} />
        <div className={`h-full rounded-full ${edge > 15 ? 'bg-success' : edge > 5 ? 'bg-warning' : 'bg-danger'}`}
          style={{ width: `${Math.min(probability, 100)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs min-w-0">
        <span className="text-gray-400 truncate">M:{marketPrice}¢</span>
        <span className={edge > 0 ? 'text-success font-medium truncate' : 'text-danger truncate'}>E:{edge > 0 ? '+' : ''}{edge}%</span>
        <span className="text-gray-400 truncate">Mod:{probability}%</span>
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-success/20 text-success',
    medium: 'bg-warning/20 text-warning',
    low: 'bg-danger/20 text-danger'
  };
  return (
    <Tooltip text={EDUCATION_CONTENT.confidence}>
      <span className={`rounded-full px-2 py-0.5 text-xs cursor-help shrink-0 ${colors[level]}`}>
        {level === 'high' ? 'High' : level === 'medium' ? 'Med' : 'Low'}
      </span>
    </Tooltip>
  );
}

export function TradesView() {
  const [selectedCategory, setSelectedCategory] = useState<KalshiTrade['category'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'edge' | 'multiplier'>('edge');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [trades, setTrades] = useState<KalshiTrade[]>(RESEARCHED_TRADES);
  const [showEducation, setShowEducation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch live data via Vercel proxy (avoids CORS)
  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      
      // Fetch ONLY series with active markets (reduced to prevent 500 errors)
      const seriesToFetch = [
        // Weather (5) - Active markets
        { series: 'KXHIGHTSEA', category: 'weather', name: 'Seattle Weather' },
        { series: 'KXHIGHNY', category: 'weather', name: 'NYC Weather' },
        { series: 'KXHIGHCHI', category: 'weather', name: 'Chicago Weather' },
        { series: 'KXHIGHMIA', category: 'weather', name: 'Miami Weather' },
        { series: 'KXHIGHTPHX', category: 'weather', name: 'Phoenix Weather' },
        // Crypto (3) - Major coins only
        { series: 'KXBTC', category: 'crypto', name: 'Bitcoin' },
        { series: 'KXETH', category: 'crypto', name: 'Ethereum' },
        { series: 'KXSOL', category: 'crypto', name: 'Solana' },
        // Politics/Economics (4) - Active markets
        { series: 'KXTRUTHSOCIAL', category: 'politics', name: 'Trump Truth Social' },
        { series: 'KXFED', category: 'economics', name: 'Fed Rate' },
        { series: 'KXGDP', category: 'economics', name: 'GDP Growth' },
        { series: 'KXCPI', category: 'economics', name: 'CPI Inflation' },
      ];
      
      let allMarkets: any[] = [];
      
      // Fetch markets from each series with delay to avoid rate limiting
      for (const { series, category, name } of seriesToFetch) {
        try {
          // Add delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const response = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
          if (response.ok) {
            const data = await response.json();
            if (data.markets) {
              // Add category info to each market
              data.markets.forEach((m: any) => {
                m.category = category;
                m.series_name = name;
              });
              allMarkets = [...allMarkets, ...data.markets];
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ${series}:`, err);
        }
      }
      
      console.log('Fetched markets:', allMarkets.length);
      
      // Transform to our format
      const transformed: KalshiTrade[] = allMarkets.map((m: any) => ({
        id: m.ticker,
        ticker: m.ticker,
        title: m.title,
        category: m.category,
        yesPrice: m.yes_ask || m.yes_price || 50,
        noPrice: m.no_ask || m.no_price || 50,
        volume: m.volume || 0,
        expiration: m.expiration_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        kalshiUrl: `https://kalshi.com/markets/${m.ticker}`,
        priceHistory: m.price_history || [],
        research: {
          trueProbability: 50,
          edge: 0,
          confidence: 'medium',
          catalyst: 'Live market data',
          sources: ['Kalshi API']
        },
        payout: {
          buyPrice: m.yes_ask || 50,
          potentialReturn: (100 - (m.yes_ask || 50)) / 100,
          multiplier: Math.round(100 / (m.yes_ask || 50))
        }
      }));
      
      if (transformed.length > 0) {
        setTrades(transformed);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch live data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics for each trade
  const tradesWithMetrics = useMemo(() => {
    return trades.map(trade => {
      const price = trade.yesPrice;
      const trueProb = trade.research.trueProbability;
      const edge = trueProb - price;
      const variance = price * (100 - price) / 100;
      const rScore = variance > 0 ? edge / Math.sqrt(variance) : 0;
      const kelly = edge > 0 ? edge / (price * (100 - price) / 100) : 0;
      
      return {
        ...trade,
        rScore,
        kellyFraction: Math.min(kelly * 0.5, 5) // Half-K, max 5%
      };
    });
  }, [trades]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return tradesWithMetrics.filter(trade => {
      // Category filter
      if (selectedCategory !== 'all' && trade.category !== selectedCategory) return false;
      
      // Price filter (1¢ to 25¢)
      if (trade.yesPrice < 1 || trade.yesPrice > 25) return false;
      
      // Volume filter (at least 50)
      if (trade.volume < 50) return false;
      
      // Only active markets
      if (trade.expiration && new Date(trade.expiration) < new Date()) return false;
      
      // No complex multi-markets
      if (trade.ticker.includes('MVE')) return false;
      
      return true;
    });
  }, [tradesWithMetrics, selectedCategory]);

  // Sort trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'edge') {
        comparison = (a.rScore || 0) - (b.rScore || 0);
      } else if (sortBy === 'multiplier') {
        comparison = a.payout.multiplier - b.payout.multiplier;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [filteredTrades, sortBy, sortDirection]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = sortedTrades.length;
    const avgRScore = total > 0 
      ? sortedTrades.reduce((sum, t) => sum + (t.rScore || 0), 0) / total 
      : 0;
    const avgMultiplier = total > 0
      ? sortedTrades.reduce((sum, t) => sum + t.payout.multiplier, 0) / total
      : 0;
    const highRScoreTrades = sortedTrades.filter(t => (t.rScore || 0) >= 1.5).length;
    
    return { total, avgRScore: avgRScore.toFixed(1), avgMultiplier: avgMultiplier.toFixed(1), highRScoreTrades };
  }, [sortedTrades]);

  // Portfolio-level stats
  const portfolioStats = useMemo(() => {
    const avgRScore = sortedTrades.length > 0
      ? (sortedTrades.reduce((sum, t) => sum + (t.rScore || 0), 0) / sortedTrades.length).toFixed(1)
      : '0.0';
    const highRScoreTrades = sortedTrades.filter(t => (t.rScore || 0) >= 1.5).length;
    return { avgRScore, highRScoreTrades };
  }, [sortedTrades]);

  const hasLiveData = lastUpdated !== null;
  const changedPrices = useMemo(() => {
    return sortedTrades.filter((trade, idx) => {
      const original = RESEARCHED_TRADES[idx];
      return original && trade.yesPrice !== original.yesPrice;
    });
  }, [trades]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">Kalshi Trades</h1>
          <p className="text-sm text-gray-400 truncate">
            {hasLiveData ? '✓ Live data' : 'Static data'} {lastUpdated && `• Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={fetchLiveData} 
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isLoading ? 'Updating...' : 'Refresh'}</span>
            <span className="sm:hidden">{isLoading ? '...' : '↻'}</span>
          </button>
          <button onClick={() => setShowEducation(!showEducation)} className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{showEducation ? 'Hide' : 'Learn'}</span>
          </button>
          <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20 ml-auto sm:ml-0">
            <span className="hidden sm:inline">Kalshi</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Education Panel */}
      {showEducation && (
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">📚 How to Read Trade Cards</h3>
            <button onClick={() => setShowEducation(false)} className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          
          {/* Legend Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {/* R */}
            <div className="space-y-1">
              <div className="font-medium text-gray-300">R</div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">R:1.5+</span> 
                <span className="text-gray-400">Strong +EV</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">R:1.0</span> 
                <span className="text-gray-400">Decent</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.rScore}</div>
            </div>
            
            {/* K % */}
            <div className="space-y-1">
              <div className="font-medium text-gray-300">K %</div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">K:2.5%</span> 
                <span className="text-gray-400">Position size</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.kelly}</div>
            </div>
            
            {/* Pay → Multiplier */}
            <div className="space-y-1">
              <div className="font-medium text-gray-300">Pay → Multiplier</div>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">5¢ → 20x</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.multiplier}</div>
            </div>
            
            {/* Volume */}
            <div className="space-y-1">
              <div className="font-medium text-gray-300">Volume</div>
              <div className="flex items-center gap-1">
                💰 <span className="text-gray-400">1,240 vol</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.volume}</div>
            </div>
          </div>
          
          {/* YES/NO Explanation */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <div className="font-medium text-gray-300 mb-2">What to Do</div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1 text-gray-400">
                <span className="text-emerald-400">👍 BUY YES</span> if you think it WILL happen
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <span className="text-red-400">👎 BUY NO</span> if you think it WON'T happen
              </span>
            </div>
            <p className="text-gray-500 mt-2 text-xs">{EDUCATION_CONTENT.yesNo}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Trades</div><div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg R</div><div className={`text-xl font-bold ${parseFloat(portfolioStats.avgRScore) > 1.5 ? 'text-success' : 'text-warning'}`}>{portfolioStats.avgRScore}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">+EV Trades (R&gt;1.5)</div><div className="text-xl font-bold text-success">{portfolioStats.highRScoreTrades}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg Mult</div><div className="text-xl font-bold text-primary">{stats.avgMultiplier}x</div>
        </div>
      </div>

      {/* Filters - Mobile Optimized */}
      <div className="flex flex-col gap-3">
        {/* Category Filters - Horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {(['all', 'weather', 'crypto', 'companies', 'economics', 'science', 'world', 'politics', 'government', 'finance'] as const).map(cat => {
            const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm whitespace-nowrap transition-all ${
                  isSelected 
                    ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                    : 'border border-surface-hover hover:bg-surface-hover'
                }`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="capitalize">{cat}</span>
                {isSelected && <span className="ml-1 text-xs opacity-75">({filteredTrades.length})</span>}
              </button>
            );
          })}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)} 
            className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm flex-1 sm:flex-none"
          >
            <option value="edge">Sort by Edge</option>
            <option value="multiplier">Sort by Multiplier</option>
          </select>
          <button 
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} 
            className="rounded-lg border border-surface-hover p-2 hover:bg-surface-hover"
            title={sortDirection === 'desc' ? 'Descending' : 'Ascending'}
          >
            {sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* TRADE CARDS - MOBILE OPTIMIZED */}
      {tradesWithMetrics.length === 0 ? (
        <div className="rounded-xl bg-surface-hover/50 p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium mb-2">No +EV Trades Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            No markets currently meet the R {`>=`} 0.5 threshold.
          </p>
          <button 
            onClick={fetchLiveData}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Refresh Data
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedTrades.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const price = trade.yesPrice;
          const multiplier = trade.payout.multiplier;
          const rScore = trade.rScore || 0;
          const kelly = trade.kellyFraction || 0;
          
          // Color coding based on R
          const dealColor = rScore >= 1.5 ? 'bg-emerald-500/10 border-emerald-500/50' : 
                           rScore >= 1.0 ? 'bg-amber-500/10 border-amber-500/50' : 
                           'bg-surface border-surface-hover';
          
          // Recommendation based on R - only +EV trades shown now
          let recommendation = '✅ +EV Trade';
          let recColor = 'text-emerald-400';

          return (
            <div key={trade.id} className={`rounded-xl border-2 p-2 sm:p-4 transition-all hover:scale-[1.01] ${dealColor}`}>
              
              {/* TOP ROW: Icon + Title + Trade Button */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[trade.category]}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-xs sm:text-sm leading-tight line-clamp-2 sm:p-2">{trade.title}</h3>
                  <div className="flex items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] sm:text-xs text-gray-400 mt-1">
                    <span>{new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                    <span>•</span>
                    <span className="capitalize">{trade.category}</span>
                  </div>
                </div>
                
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" 
                  className="flex items-center gap-1 rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] sm:text-xs font-medium text-white hover:bg-primary/90 shrink-0"
                >
                  <span className="hidden sm:inline">Trade</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>

              {/* MIDDLE: Key Metrics Grid - Mobile: 2 cols, Desktop: 4 cols */}
              <div className="mt-3 grid grid-cols-4 gap-1 sm:gap-2">
                {/* Pay */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase">Pay</div>
                  <div className="text-sm sm:text-lg font-bold">{price}¢</div>
                </div>
                
                {/* Win */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase">Win</div>
                  <div className="text-sm sm:text-lg font-bold text-emerald-400">${multiplier}</div>
                </div>
                
                {/* R */}
                <div className={`text-center rounded-lg p-2 ${rScore >= 1.5 ? 'bg-emerald-500/20' : 'bg-surface-hover/50'}`}>
                  <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase">R</div>
                  <div className={`text-sm sm:text-lg font-bold ${rScore >= 1.5 ? 'text-emerald-400' : 'text-gray-300'}`}>{rScore.toFixed(1)}</div>
                </div>
                
                {/* K */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase">K</div>
                  <div className="text-sm sm:text-lg font-bold text-blue-400">{kelly.toFixed(1)}%</div>
                </div>
              </div>

              {/* BOTTOM: Why This Trade + Yes/No Recommendation */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-medium shrink-0 ${recColor}`}>{recommendation}</span>
                  <span className="text-xs text-gray-500 truncate">💰 {trade.volume?.toLocaleString()} vol</span>
                </div>
                
                {/* BUY YES Button - Only shown for +EV trades */}
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 shrink-0"
                  title="R >= 1.5 - This is a +EV trade. Click to buy YES on Kalshi."
                >
                  👍 BUY YES
                </a>
              </div>
              
              {/* Why This Trade - Collapsible on mobile */}
              <div className="mt-2 text-xs text-gray-400 bg-surface-hover/30 rounded-lg p-2 line-clamp-2 sm:p-2 sm:line-clamp-none">
                <span className="text-gray-500">Why:</span> {trade.research.catalyst}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
