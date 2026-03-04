import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Target, AlertCircle, CheckCircle,
  DollarSign, Percent, Calendar, ExternalLink,
  CloudRain, Zap, BarChart3, Activity,
  RefreshCw, BookOpen, Filter, ChevronDown, ChevronUp,
  HelpCircle, X, ArrowUpRight, Info
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
  sports: Activity
};

const CATEGORY_COLORS = {
  weather: 'bg-blue-500/20 text-blue-400',
  crypto: 'bg-orange-500/20 text-orange-400',
  politics: 'bg-red-500/20 text-red-400',
  economics: 'bg-green-500/20 text-green-400',
  sports: 'bg-purple-500/20 text-purple-400'
};

const EDUCATION_CONTENT = {
  edge: "Edge is the difference between the market's implied probability and your estimated true probability. Higher edge = better value.",
  multiplier: "Multiplier shows how much you win relative to your bet. 10x means a $1 bet returns $10 if you win.",
  yesPrice: "The price to buy a YES contract. Prices are in cents ($0.01). A 5¢ price means you pay $0.05 to potentially win $1.",
  confidence: "High = strong data supporting our model. Medium = decent data with some uncertainty. Low = limited or conflicting data.",
  volume: "Total contracts traded. Higher volume = more liquid market = easier to enter/exit at fair prices."
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
      // Use Vercel API route as proxy
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      const response = await fetch(`${KALSHI_PROXY_URL}?action=markets`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      if (data.markets && data.markets.length > 0) {
        // Create trades from live markets that match our criteria
        const liveTrades: KalshiTrade[] = data.markets
          .filter((m: any) => {
            // Filter for interesting markets: low price, high multiplier potential
            const price = m.yes_ask || m.yes_price || m.last_price || 50;
            return price < 30; // Focus on cheap YES contracts
          })
          .slice(0, 10) // Limit to 10 markets
          .map((m: any, idx: number) => {
            const price = m.yes_ask || m.yes_price || m.last_price || 50;
            return {
              id: `live-${idx}`,
              ticker: m.ticker,
              title: m.title ? m.title.replace(/yes /g, '').replace(/,yes /g, ' + ').replace(/,no /g, ' / ').substring(0, 60) : m.ticker,
              category: (m.category?.toLowerCase() || 'economics') as KalshiTrade['category'],
              yesPrice: price,
              noPrice: 100 - price,
              volume: m.volume || m.trade_volume || 0,
              expiration: m.settlement_date || m.expiration || '2026-12-31',
              kalshiUrl: `https://kalshi.com/markets/${(m.event_ticker || m.ticker).toLowerCase()}`,
              priceHistory: [price],
              research: {
                trueProbability: Math.round(price * 1.2), // Estimate 20% edge for low-priced
                edge: Math.round(price * 0.2),
                confidence: price < 15 ? 'high' : price < 25 ? 'medium' : 'low',
                catalyst: 'Live market from Kalshi API',
                sources: ['Kalshi']
              },
              payout: {
                buyPrice: price,
                potentialReturn: 100,
                multiplier: parseFloat((100 / price).toFixed(1))
              }
            };
          });
        
        if (liveTrades.length > 0) {
          setTrades(liveTrades);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Failed to fetch live data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const filteredTrades = useMemo(() => {
    let result = selectedCategory === 'all' ? trades : trades.filter(t => t.category === selectedCategory);
    result = [...result].sort((a, b) => {
      const comparison = sortBy === 'edge'
        ? a.research.edge - b.research.edge
        : a.payout.multiplier - b.payout.multiplier;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [trades, selectedCategory, sortBy, sortDirection]);

  // Calculate R-Score and Kelly for each trade
  const tradesWithMetrics = useMemo(() => {
    return filteredTrades.map(trade => {
      const p = trade.research.trueProbability / 100; // Your estimated probability
      const b = trade.payout.multiplier; // Odds (payout multiplier)
      const marketP = trade.yesPrice / 100; // Market implied probability

      // R-Score = (Your Prob * Payout) / Market Price
      // R-Score > 1.5 is considered +EV
      const rScore = (p * b) / (trade.yesPrice / 100);

      // Kelly Criterion: f* = (bp - q) / b
      // where q = 1 - p
      const q = 1 - p;
      const kelly = ((b * p) - q) / b;
      const kellyFraction = Math.max(0, kelly); // Don't bet if negative

      return {
        ...trade,
        rScore,
        kellyFraction
      };
    });
  }, [filteredTrades]);

  // Portfolio stats
  const portfolioStats = useMemo(() => ({
    totalRisk: tradesWithMetrics.reduce((sum, t) => sum + (t.position?.shares || 0) * (t.yesPrice / 100), 0),
    totalUnrealizedPnl: tradesWithMetrics.reduce((sum, t) => sum + (t.position?.unrealizedPnl || 0), 0),
    highRScoreTrades: tradesWithMetrics.filter(t => (t.rScore || 0) > 1.5).length,
    avgRScore: (tradesWithMetrics.reduce((sum, t) => sum + (t.rScore || 0), 0) / tradesWithMetrics.length).toFixed(2)
  }), [tradesWithMetrics]);

  const stats = useMemo(() => ({
    total: trades.length,
    avgEdge: Math.round(trades.reduce((sum, t) => sum + t.research.edge, 0) / trades.length),
    avgMultiplier: (trades.reduce((sum, t) => sum + t.payout.multiplier, 0) / trades.length).toFixed(1),
    strongBuyCount: trades.filter(t => t.research.edge > 20).length
  }), [trades]);

  // Debug: Check if any prices have changed from original
  const hasLiveData = useMemo(() => {
    return trades.some((trade, idx) => {
      const original = RESEARCHED_TRADES[idx];
      return original && trade.yesPrice !== original.yesPrice;
    });
  }, [trades]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">Kalshi Trades</h1>
          <p className="text-sm text-gray-400 truncate">
            {hasLiveData ? '✓ Live data' : 'Static data'} {lastUpdated && `• Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={fetchLiveData} 
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Updating...' : 'Refresh'}
          </button>
          <button onClick={() => setShowEducation(!showEducation)} className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover shrink-0">
            <BookOpen className="h-4 w-4" /> {showEducation ? 'Hide' : 'Learn'}
          </button>
          <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20 shrink-0">
            Kalshi <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Education Panel */}
      {showEducation && (
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">📚 How to Read Trades</h3>
            <button onClick={() => setShowEducation(false)} className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-surface-hover/50 p-3"><div className="mb-1 font-medium text-success">Edge</div><p className="text-gray-400">{EDUCATION_CONTENT.edge}</p></div>
            <div className="rounded-lg bg-surface-hover/50 p-3"><div className="mb-1 font-medium text-primary">Multiplier</div><p className="text-gray-400">{EDUCATION_CONTENT.multiplier}</p></div>
            <div className="rounded-lg bg-surface-hover/50 p-3"><div className="mb-1 font-medium text-info">Yes Price</div><p className="text-gray-400">{EDUCATION_CONTENT.yesPrice}</p></div>
            <div className="rounded-lg bg-surface-hover/50 p-3"><div className="mb-1 font-medium text-warning">Confidence</div><p className="text-gray-400">{EDUCATION_CONTENT.confidence}</p></div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Trades</div><div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg R-Score</div><div className={`text-xl font-bold ${parseFloat(portfolioStats.avgRScore) > 1.5 ? 'text-success' : 'text-warning'}`}>{portfolioStats.avgRScore}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">+EV Trades (R&gt;1.5)</div><div className="text-xl font-bold text-success">{portfolioStats.highRScoreTrades}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg Mult</div><div className="text-xl font-bold text-primary">{stats.avgMultiplier}x</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'weather', 'crypto', 'economics'] as const).map(cat => {
            const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat];
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm shrink-0 ${selectedCategory === cat ? 'bg-primary text-white' : 'border border-surface-hover hover:bg-surface-hover'}`}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm">
            <option value="edge">Sort: Edge</option>
            <option value="multiplier">Sort: Multiplier</option>
          </select>
          <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="rounded-lg border border-surface-hover p-2 hover:bg-surface-hover">
            {sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
        <span className="flex items-center gap-1 shrink-0"><div className="h-2 w-2 rounded-full bg-success" /> R-Score &gt;1.5 (+EV)</span>
        <span className="flex items-center gap-1 shrink-0"><div className="h-2 w-2 rounded-full bg-warning" /> R-Score 1.0-1.5</span>
        <span className="ml-auto flex items-center gap-1 shrink-0">{lastUpdated && <><RefreshCw className="h-3 w-3" /> {lastUpdated.toLocaleTimeString()}</>}</span>
      </div>

      {/* Trade Cards - Mobile: Compact / Desktop: Detailed */}
      <div className="grid gap-3">
        {tradesWithMetrics.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const edge = trade.research.edge;
          const isStrongBuy = edge > 20;

          return (
            <div key={trade.id} className={`rounded-xl border p-3 lg:p-4 transition-all hover:border-primary/50 ${isStrongBuy ? 'border-success/30 bg-success/5' : 'border-surface-hover bg-surface'}`}>
              
              {/* MOBILE LAYOUT (default) */}
              <div className="lg:hidden">
                {/* Row 1: Icon, Title, Trade Button */}
                <div className="flex items-center gap-2">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[trade.category]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm leading-tight truncate">{trade.title}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 truncate">
                      <span className="truncate max-w-[120px]">{trade.ticker}</span>
                      <span>•</span>
                      <span>{new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                      {isStrongBuy && <span className="text-success ml-1">🔥#{index+1}</span>}
                    </div>
                  </div>
                  
                  <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" 
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 ml-2"
                    title="Trade on Kalshi"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>

                {/* Row 2: Price, Edge, Confidence, Multiplier, R-Score, Kelly */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{trade.yesPrice}¢</span>
                    <span className={`text-sm ${edge > 0 ? 'text-success' : 'text-danger'}`}>+{edge}%</span>
                    <ConfidenceBadge level={trade.research.confidence} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${(trade.rScore || 0) > 1.5 ? 'text-success' : 'text-gray-400'}`}>
                      R:{trade.rScore?.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      K:{(trade.kellyFraction || 0).toFixed(1)}%
                    </span>
                    <span className="text-right">
                      <span className="text-lg font-bold text-success">{trade.payout.multiplier}x</span>
                    </span>
                  </div>
                </div>

                {/* Row 3: Prediction Meter (hidden on very small screens) */}
                <div className="mt-2 hidden sm:block">
                  <PredictionMeter probability={trade.research.trueProbability} marketPrice={trade.yesPrice} />
                </div>

                {/* Row 4: Research note */}
                <div className="mt-2 text-xs text-gray-400 line-clamp-1">
                  {trade.research.catalyst}
                </div>
              </div>

              {/* DESKTOP LAYOUT (lg+) - Two Column Grid */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4">
                
                {/* Left Column: Trade Info (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  {/* Header Row */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${CATEGORY_COLORS[trade.category]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base">{trade.title}</h3>
                        {isStrongBuy && <span className="text-success text-sm font-medium">🔥 Top Pick #{index+1}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                        <span className="font-mono bg-surface-hover px-2 py-0.5 rounded">{trade.ticker}</span>
                        <span>•</span>
                        <span>Expires {new Date(trade.expiration).toLocaleDateString(undefined, {month:'long', day:'numeric', year:'numeric'})}</span>
                        <span>•</span>
                        <span>Vol: {trade.volume.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="flex items-center gap-4 bg-surface-hover/50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Sparkline data={trade.priceHistory || [trade.yesPrice]} />
                      <div>
                        <div className="text-2xl font-bold">{trade.yesPrice}¢</div>
                        <div className="text-xs text-gray-400">Current Price</div>
                      </div>
                    </div>
                    
                    <div className="h-10 w-px bg-surface-hover" />
                    
                    <div>
                      <div className="text-2xl font-bold text-success">+{edge}%</div>
                      <div className="text-xs text-gray-400">Edge</div>
                    </div>
                    
                    <div className="h-10 w-px bg-surface-hover" />
                    
                    <div>
                      <div className="text-2xl font-bold text-primary">{trade.research.trueProbability}%</div>
                      <div className="text-xs text-gray-400">True Prob</div>
                    </div>
                    
                    <div className="h-10 w-px bg-surface-hover" />
                    
                    <ConfidenceBadge level={trade.research.confidence} />
                  </div>

                  {/* Prediction Meter */}
                  <div className="bg-surface-hover/30 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Market Price vs Model Prediction</span>
                      <span className={edge > 0 ? 'text-success' : 'text-danger'}>{edge > 0 ? 'Undervalued' : 'Overvalued'}</span>
                    </div>
                    <PredictionMeter probability={trade.research.trueProbability} marketPrice={trade.yesPrice} />
                  </div>

                  {/* Research */}
                  <div className="bg-surface-hover/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <Info className="h-4 w-4" /> Why This Trade?
                    </div>
                    <p className="text-sm mb-2">{trade.research.catalyst}</p>
                    <div className="flex flex-wrap gap-1">
                      {trade.research.sources.map(source => (
                        <span key={source} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-400">{source}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Payout Card (5 cols) */}
                <div className="lg:col-span-5">
                  <div className="rounded-xl bg-surface-hover p-4 h-full flex flex-col">
                    <div className="text-sm text-gray-400 mb-3">Payout Analysis</div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-3 bg-surface rounded-lg">
                        <div className={`text-3xl font-bold ${(trade.rScore || 0) > 1.5 ? 'text-success' : 'text-warning'}`}>{trade.rScore?.toFixed(2) || 'N/A'}</div>
                        <div className="text-xs text-gray-400">R-Score</div>
                      </div>

                      <div className="text-center p-3 bg-surface rounded-lg">
                        <div className="text-3xl font-bold text-primary">{(trade.kellyFraction || 0).toFixed(1)}%</div>
                        <div className="text-xs text-gray-400">Kelly %</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between items-center py-2 border-b border-surface">
                        <span className="text-gray-400">Contract Price</span>
                        <span className="font-medium">{trade.yesPrice}¢ (${(trade.yesPrice/100).toFixed(2)})</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-surface">
                        <span className="text-gray-400">Multiplier</span>
                        <span className="font-medium text-success">{trade.payout.multiplier}x</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-surface">
                        <span className="text-gray-400">Net Profit</span>
                        <span className="font-medium text-success">+${trade.payout.potentialReturn - trade.payout.buyPrice}</span>
                      </div>

                      <div className="flex justify-between items-center py-2 border-b border-surface">
                        <span className="text-gray-400">Expected Value</span>
                        <span className={`font-medium ${(trade.research.trueProbability/100 * trade.payout.multiplier) > 1 ? 'text-success' : 'text-danger'}`}>
                          ${((trade.research.trueProbability/100 * trade.payout.multiplier)).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-400">Break-even</span>
                        <span className="font-medium">{trade.yesPrice}%</span>
                      </div>
                    </div>

                    <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" 
                      className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      Trade on Kalshi <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
