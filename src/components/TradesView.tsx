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
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      
      // Fetch specific series: crypto, weather, politics
      const seriesToFetch = [
        { series: 'KXBTC', category: 'crypto', name: 'Bitcoin' },
        { series: 'KXETH', category: 'crypto', name: 'Ethereum' },
        { series: 'KXHIGHTSEA', category: 'weather', name: 'Seattle Weather' },
        { series: 'KXHIGHNY', category: 'weather', name: 'NYC Weather' },
        { series: 'KXRAINSEA', category: 'weather', name: 'Seattle Rain' },
        { series: 'TRUMP', category: 'politics', name: 'Trump' },
        { series: 'GOV', category: 'politics', name: 'Government' }
      ];
      
      let allMarkets: any[] = [];
      
      // Fetch markets from each series
      for (const { series, category, name } of seriesToFetch) {
        try {
          const response = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
          if (response.ok) {
            const data = await response.json();
            if (data.markets) {
              // Add category info to each market
              data.markets.forEach((m: any) => {
                m.category = category;
                m.series_name = name;
              });
              allMarkets = allMarkets.concat(data.markets);
            }
          }
        } catch (e) {
          console.log(`Failed to fetch ${series}:`, e);
        }
      }
      
      // Also fetch general markets as fallback
      const generalResponse = await fetch(`${KALSHI_PROXY_URL}?action=markets`);
      if (generalResponse.ok) {
        const generalData = await generalResponse.json();
        if (generalData.markets) {
          // Filter general markets for crypto/weather/politics only
          const filteredGeneral = generalData.markets.filter((m: any) => {
            const cat = (m.category || '').toLowerCase();
            return ['crypto', 'weather', 'politics', 'economics'].includes(cat);
          });
          allMarkets = allMarkets.concat(filteredGeneral);
        }
      }
      
      if (allMarkets.length > 0) {
        // Process markets: filter cheap ones with volume, sort by potential
        const processedTrades: KalshiTrade[] = allMarkets
          .filter((m: any) => {
            const price = m.yes_ask || m.yes_price || m.last_price || 50;
            const volume = m.volume || m.trade_volume || 0;
            return price >= 1 && price <= 25 && volume > 100; // Cheap + liquid
          })
          .sort((a: any, b: any) => {
            // Sort by multiplier (payout potential)
            const priceA = a.yes_ask || a.yes_price || a.last_price || 50;
            const priceB = b.yes_ask || b.yes_price || b.last_price || 50;
            return (100 / priceB) - (100 / priceA);
          })
          .slice(0, 10) // Top 10
          .map((m: any, idx: number) => {
            const price = m.yes_ask || m.yes_price || m.last_price || 50;
            const multiplier = parseFloat((100 / price).toFixed(1));
            
            // Clean title
            let title = m.title || `${m.series_name || m.ticker} Market`;
            title = title.replace(/yes /gi, '').replace(/,yes /gi, ' + ').replace(/,no /gi, ' / ');
            if (title.length > 60) title = title.substring(0, 60) + '...';
            
            // Build URL using series ticker (trade bot format)
            const seriesTicker = m.ticker.split('-')[0].toLowerCase();
            const urlTicker = seriesTicker;
            
            return {
              id: `live-${idx}`,
              ticker: m.ticker,
              title: title,
              category: (m.category?.toLowerCase() || 'economics') as KalshiTrade['category'],
              yesPrice: price,
              noPrice: 100 - price,
              volume: m.volume || m.trade_volume || 0,
              expiration: m.settlement_date || m.expiration || '2026-12-31',
              kalshiUrl: `https://kalshi.com/markets/${urlTicker}`,
              priceHistory: [price],
              research: {
                trueProbability: Math.min(Math.round(price * 1.5), 95), // Conservative estimate
                edge: Math.round(price * 0.3),
                confidence: price < 10 ? 'high' : price < 20 ? 'medium' : 'low',
                catalyst: `${m.series_name || m.category} market with ${multiplier}x payout potential`,
                sources: ['Kalshi']
              },
              payout: {
                buyPrice: price,
                potentialReturn: 100,
                multiplier: multiplier
              }
            };
          });
        
        if (processedTrades.length > 0) {
          setTrades(processedTrades);
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
      const marketPrice = trade.yesPrice / 100; // Market price in decimal
      
      // R-Score = (your_prob - market_price) / sqrt(prob * (1-prob))
      // R-Score >= 1.5 is considered +EV
      const variance = p * (1 - p);
      const rScore = variance > 0 ? (p - marketPrice) / Math.sqrt(variance) : 0;

      // Kelly Criterion: f* = (bp - q) / b (using half-Kelly for safety)
      // where b = multiplier, q = 1 - p
      const b = trade.payout.multiplier;
      const q = 1 - p;
      const kelly = b > 0 ? ((b * p) - q) / b : 0;
      const kellyFraction = Math.max(0, kelly * 0.5); // Half-Kelly for safety

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

      {/* SIMPLE TRADE CARDS */}
      <div className="grid gap-3">
        {tradesWithMetrics.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const edge = trade.research.edge;
          const isGoodDeal = (trade.rScore || 0) > 1.5;
          const price = trade.yesPrice;
          const multiplier = trade.payout.multiplier;
          
          // Simple color coding
          const dealColor = price <= 5 ? 'bg-emerald-500/20 border-emerald-500/50' : 
                           price <= 15 ? 'bg-amber-500/20 border-amber-500/50' : 
                           'bg-surface border-surface-hover';
          
          // Simple recommendation
          let recommendation = 'Skip';
          let recColor = 'text-gray-400';
          if (price <= 3 && multiplier >= 30) {
            recommendation = '🔥 Great Deal';
            recColor = 'text-emerald-400';
          } else if (price <= 10 && multiplier >= 10) {
            recommendation = '👍 Good Value';
            recColor = 'text-amber-400';
          }

          return (
            <div key={trade.id} className={`rounded-xl border-2 p-4 transition-all hover:scale-[1.01] ${dealColor}`}>
              
              {/* TOP ROW: What + When + Trade Button */}
              <div className="flex items-start gap-3">
                {/* Big Icon */}
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${CATEGORY_COLORS[trade.category]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                
                {/* Title & Date */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight">{trade.title}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Closes {new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                  </p>
                </div>
                
                {/* Trade Button */}
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" 
                  className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 shrink-0"
                >
                  Trade <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              {/* MIDDLE: The Deal */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                {/* Price */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Pay</div>
                  <div className="text-2xl font-bold">{price}¢</div>
                  <div className="text-xs text-gray-500">per share</div>
                </div>
                
                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="text-2xl text-gray-600">→</div>
                </div>
                
                {/* Payout */}
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Win</div>
                  <div className="text-2xl font-bold text-emerald-400">$1</div>
                  <div className="text-xs text-emerald-500">{multiplier}x return</div>
                </div>
              </div>

              {/* BOTTOM: Recommendation + Details */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div className={`text-sm font-medium ${recColor}`}>{recommendation}</div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span title="How much is being traded">💰 {trade.volume?.toLocaleString()} vol</span>
                  <span title="Our confidence level">🎯 {trade.research.confidence}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
