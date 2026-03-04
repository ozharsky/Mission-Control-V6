import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Target, AlertCircle, CheckCircle, 
  DollarSign, Percent, Calendar, ExternalLink,
  Thermometer, CloudRain, Sun, Wind,
  Activity, BarChart3, Zap, Info, RefreshCw,
  Smartphone, BookOpen, Filter, ArrowUpDown,
  HelpCircle, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';

// Educational tooltip component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <div 
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
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
  if (data.length < 2) return <div className="h-8 w-24 bg-surface-hover rounded" />;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-8 w-24" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
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
}

// Sample researched trades with price history
const RESEARCHED_TRADES: KalshiTrade[] = [
  {
    id: '1',
    ticker: 'KXHIGHSEA-26MAR10-T54',
    title: 'Seattle High Temp >54°F on March 10',
    category: 'weather',
    yesPrice: 4,
    noPrice: 96,
    volume: 1247,
    expiration: '2026-03-10',
    kalshiUrl: 'https://kalshi.com/markets/kxhighsea/26MAR10-T54',
    priceHistory: [2, 3, 3, 4, 4, 5, 4, 4],
    research: {
      trueProbability: 35,
      edge: 31,
      confidence: 'medium',
      catalyst: 'Historical March 10 temps avg 52°F, but warming trend + El Niño pattern',
      sources: ['NOAA', 'Weather Underground', 'Climate.gov']
    },
    payout: { buyPrice: 4, potentialReturn: 96, multiplier: 24 }
  },
  {
    id: '2',
    ticker: 'KXBTC-26MAR15-T92000',
    title: 'Bitcoin >$92,000 on March 15',
    category: 'crypto',
    yesPrice: 12,
    noPrice: 88,
    volume: 8934,
    expiration: '2026-03-15',
    kalshiUrl: 'https://kalshi.com/markets/kxbtc/26MAR15-T92000',
    priceHistory: [8, 9, 10, 11, 12, 11, 12, 12],
    research: {
      trueProbability: 28,
      edge: 16,
      confidence: 'medium',
      catalyst: 'ETF inflows strong, but resistance at $90k. Fed speech March 14 could move price',
      sources: ['CoinGlass', 'CryptoQuant', 'Fed Calendar']
    },
    payout: { buyPrice: 12, potentialReturn: 88, multiplier: 7.3 }
  },
  {
    id: '3',
    ticker: 'KXUNEMP-26MAR07-T4.2',
    title: 'Unemployment Rate >4.2% in March Report',
    category: 'economics',
    yesPrice: 18,
    noPrice: 82,
    volume: 5621,
    expiration: '2026-03-07',
    kalshiUrl: 'https://kalshi.com/markets/kxunemp/26MAR07-T4.2',
    priceHistory: [12, 14, 15, 16, 17, 18, 18, 18],
    research: {
      trueProbability: 42,
      edge: 24,
      confidence: 'high',
      catalyst: 'Initial claims trending up. ADP report suggests softening labor market',
      sources: ['BLS', 'ADP', 'Initial Claims Data']
    },
    payout: { buyPrice: 18, potentialReturn: 82, multiplier: 4.6 }
  },
  {
    id: '4',
    ticker: 'KXHIGHNY-26MAR08-T55',
    title: 'NYC High Temp >55°F on March 8',
    category: 'weather',
    yesPrice: 8,
    noPrice: 92,
    volume: 2156,
    expiration: '2026-03-08',
    kalshiUrl: 'https://kalshi.com/markets/kxhighny/26MAR08-T55',
    priceHistory: [5, 6, 7, 7, 8, 8, 8, 8],
    research: {
      trueProbability: 25,
      edge: 17,
      confidence: 'medium',
      catalyst: 'Early March warming pattern. 10-day forecast shows 50% chance of warm front',
      sources: ['NWS NYC', 'AccuWeather', 'ECMWF Model']
    },
    payout: { buyPrice: 8, potentialReturn: 92, multiplier: 11.5 }
  },
  {
    id: '5',
    ticker: 'KXETH-26MAR20-T2800',
    title: 'Ethereum >$2,800 on March 20',
    category: 'crypto',
    yesPrice: 15,
    noPrice: 85,
    volume: 4532,
    expiration: '2026-03-20',
    kalshiUrl: 'https://kalshi.com/markets/kxeth/26MAR20-T2800',
    priceHistory: [10, 11, 12, 13, 14, 15, 15, 15],
    research: {
      trueProbability: 38,
      edge: 23,
      confidence: 'medium',
      catalyst: 'Dencun upgrade momentum, but correlation with BTC remains high',
      sources: ['DeFiLlama', 'Glassnode', 'ETH Research']
    },
    payout: { buyPrice: 15, potentialReturn: 85, multiplier: 5.7 }
  },
  {
    id: '6',
    ticker: 'KXCPI-26MAR12-T2.9',
    title: 'CPI YoY >2.9% in February Report',
    category: 'economics',
    yesPrice: 22,
    noPrice: 78,
    volume: 7891,
    expiration: '2026-03-12',
    kalshiUrl: 'https://kalshi.com/markets/kxcpi/26MAR12-T2.9',
    priceHistory: [15, 17, 19, 20, 21, 22, 22, 22],
    research: {
      trueProbability: 45,
      edge: 23,
      confidence: 'high',
      catalyst: 'Shelter costs sticky. Core PCE trending higher. Market underestimating inflation persistence',
      sources: ['Cleveland Fed Nowcast', 'Truflation', 'CoreLogic']
    },
    payout: { buyPrice: 22, potentialReturn: 78, multiplier: 3.5 }
  },
  {
    id: '7',
    ticker: 'KXSPX-26MAR21-T5800',
    title: 'S&P 500 >5,800 on March 21',
    category: 'economics',
    yesPrice: 28,
    noPrice: 72,
    volume: 9234,
    expiration: '2026-03-21',
    kalshiUrl: 'https://kalshi.com/markets/kxspx/26MAR21-T5800',
    priceHistory: [22, 24, 25, 26, 27, 28, 28, 28],
    research: {
      trueProbability: 40,
      edge: 12,
      confidence: 'low',
      catalyst: 'Earnings season winding down. Fed meeting March 18-19 creates uncertainty',
      sources: ['FactSet', 'CME FedWatch', 'VIX Futures']
    },
    payout: { buyPrice: 28, potentialReturn: 72, multiplier: 2.6 }
  },
  {
    id: '8',
    ticker: 'KXSNOWBOS-26MAR14-T5',
    title: 'Boston Snowfall >5 inches March 14',
    category: 'weather',
    yesPrice: 6,
    noPrice: 94,
    volume: 892,
    expiration: '2026-03-14',
    kalshiUrl: 'https://kalshi.com/markets/kxsnowbos/26MAR14-T5',
    priceHistory: [3, 4, 5, 6, 6, 6, 6, 6],
    research: {
      trueProbability: 18,
      edge: 12,
      confidence: 'medium',
      catalyst: 'Late season storm possible. Jet stream pattern favors Northeast snow',
      sources: ['NWS Boston', 'SnowDay Calculator', 'GFS Model']
    },
    payout: { buyPrice: 6, potentialReturn: 94, multiplier: 15.7 }
  },
  {
    id: '9',
    ticker: 'KXRAINSEA-26MAR09-T0.3',
    title: 'Seattle Rain >0.3 inches March 9',
    category: 'weather',
    yesPrice: 35,
    noPrice: 65,
    volume: 1567,
    expiration: '2026-03-09',
    kalshiUrl: 'https://kalshi.com/markets/kxrainsea/26MAR09-T0.3',
    priceHistory: [30, 32, 33, 34, 35, 35, 35, 35],
    research: {
      trueProbability: 55,
      edge: 20,
      confidence: 'high',
      catalyst: 'Pacific storm track active. Historical March 9 rainfall 0.4" average',
      sources: ['NWS Seattle', 'PRISM Climate', 'CPC Outlook']
    },
    payout: { buyPrice: 35, potentialReturn: 65, multiplier: 1.9 }
  },
  {
    id: '10',
    ticker: 'KXFED-26MAR19-T4.5',
    title: 'Fed Funds Rate >4.5% after March Meeting',
    category: 'economics',
    yesPrice: 42,
    noPrice: 58,
    volume: 12453,
    expiration: '2026-03-19',
    kalshiUrl: 'https://kalshi.com/markets/kxfed/26MAR19-T4.5',
    priceHistory: [38, 39, 40, 41, 42, 42, 42, 42],
    research: {
      trueProbability: 48,
      edge: 6,
      confidence: 'medium',
      catalyst: 'Fed dot plot suggests cuts, but sticky inflation may pause. 60% chance of no change',
      sources: ['CME FedWatch', 'Fed Speaker Calendar', 'Core PCE Trend']
    },
    payout: { buyPrice: 42, potentialReturn: 58, multiplier: 1.4 }
  }
];

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

// Educational content
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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Tooltip text={EDUCATION_CONTENT.yesPrice}>
          <span className="flex items-center gap-1 text-gray-400 cursor-help">
            Market: {marketPrice}¢ <HelpCircle className="h-3 w-3" />
          </span>
        </Tooltip>
        <Tooltip text={EDUCATION_CONTENT.edge}>
          <span className="flex items-center gap-1 text-gray-400 cursor-help">
            Our Model: {probability}% <HelpCircle className="h-3 w-3" />
          </span>
        </Tooltip>
      </div>
      
      <div className="relative h-3 rounded-full bg-surface-hover overflow-hidden">
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
          style={{ left: `${marketPrice}%` }}
        />
        <div 
          className={`h-full rounded-full transition-all ${
            edge > 15 ? 'bg-success' : edge > 5 ? 'bg-warning' : 'bg-danger'
          }`}
          style={{ width: `${Math.min(probability, 100)}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className={edge > 0 ? 'text-success font-medium' : 'text-danger'}>
          Edge: {edge > 0 ? '+' : ''}{edge}%
        </span>
        <span className={edge > 15 ? 'text-success font-medium' : 'text-gray-500'}>
          {edge > 20 ? '🔥 Strong Buy' : edge > 10 ? '✅ Good Value' : edge > 0 ? '⚡ Small Edge' : '❌ Avoid'}
        </span>
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-success/20 text-success border-success/30',
    medium: 'bg-warning/20 text-warning border-warning/30',
    low: 'bg-danger/20 text-danger border-danger/30'
  };
  
  return (
    <Tooltip text={EDUCATION_CONTENT.confidence}>
      <span className={`rounded-full border px-2 py-0.5 text-xs cursor-help ${colors[level]}`}>
        {level === 'high' ? 'High Confidence' : level === 'medium' ? 'Medium Confidence' : 'Low Confidence'}
      </span>
    </Tooltip>
  );
}

export function TradesView() {
  const [selectedCategory, setSelectedCategory] = useState<KalshiTrade['category'] | 'all'>('all');
  const [sortBy, setSortBy] = useState<'edge' | 'multiplier' | 'volume' | 'expiration'>('edge');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [trades, setTrades] = useState<KalshiTrade[]>(RESEARCHED_TRADES);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showEducation, setShowEducation] = useState(false);
  
  // Auto-refresh simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const filteredTrades = useMemo(() => {
    let result = selectedCategory === 'all' ? trades : trades.filter(t => t.category === selectedCategory);
    
    // Sort trades
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'edge':
          comparison = a.research.edge - b.research.edge;
          break;
        case 'multiplier':
          comparison = a.payout.multiplier - b.payout.multiplier;
          break;
        case 'volume':
          comparison = a.volume - b.volume;
          break;
        case 'expiration':
          comparison = new Date(a.expiration).getTime() - new Date(b.expiration).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [trades, selectedCategory, sortBy, sortDirection]);

  const stats = useMemo(() => ({
    total: trades.length,
    avgEdge: Math.round(trades.reduce((sum, t) => sum + t.research.edge, 0) / trades.length),
    avgMultiplier: (trades.reduce((sum, t) => sum + t.payout.multiplier, 0) / trades.length).toFixed(1),
    bestTrade: trades.reduce((best, t) => t.payout.multiplier > best.payout.multiplier ? t : best, trades[0]),
    strongBuyCount: trades.filter(t => t.research.edge > 20).length
  }), [trades]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kalshi Trades</h1>
          <p className="text-sm text-gray-400">Researched +EV opportunities with prediction modeling</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEducation(!showEducation)}
            className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover"
          >
            <BookOpen className="h-4 w-4" />
            {showEducation ? 'Hide Guide' : 'Learn'}
          </button>
          
          <a 
            href="https://kalshi.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
          >
            Open Kalshi <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Education Panel */}
      {showEducation && (
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">📚 How to Read These Trades</h3>
            <button onClick={() => setShowEducation(false)} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-surface-hover/50 p-3">
              <div className="mb-1 font-medium text-success">Edge (Most Important)</div>
              <p className="text-gray-400">{EDUCATION_CONTENT.edge}</p>
            </div>
            
            <div className="rounded-lg bg-surface-hover/50 p-3">
              <div className="mb-1 font-medium text-primary">Multiplier</div>
              <p className="text-gray-400">{EDUCATION_CONTENT.multiplier}</p>
            </div>
            
            <div className="rounded-lg bg-surface-hover/50 p-3">
              <div className="mb-1 font-medium text-info">Yes Price</div>
              <p className="text-gray-400">{EDUCATION_CONTENT.yesPrice}</p>
            </div>
            
            <div className="rounded-lg bg-surface-hover/50 p-3">
              <div className="mb-1 font-medium text-warning">Confidence</div>
              <p className="text-gray-400">{EDUCATION_CONTENT.confidence}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Target className="h-4 w-4" /> Active Trades
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <TrendingUp className="h-4 w-4" /> Avg Edge
          </div>
          <div className="text-2xl font-bold text-success">+{stats.avgEdge}%</div>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <DollarSign className="h-4 w-4" /> Avg Multiplier
          </div>
          <div className="text-2xl font-bold text-primary">{stats.avgMultiplier}x</div>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Zap className="h-4 w-4" /> Best Multiplier
          </div>
          <div className="text-2xl font-bold text-warning">{stats.bestTrade?.payout.multiplier}x</div>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle className="h-4 w-4" /> Strong Buys
          </div>
          <div className="text-2xl font-bold text-success">{stats.strongBuyCount}</div>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'weather', 'crypto', 'economics'] as const).map(cat => {
            const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat] || Filter;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  selectedCategory === cat 
                    ? 'bg-primary text-white' 
                    : 'border border-surface-hover hover:bg-surface-hover'
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm"
          >
            <option value="edge">Edge %</option>
            <option value="multiplier">Multiplier</option>
            <option value="volume">Volume</option>
            <option value="expiration">Expiration</option>
          </select>
          
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="rounded-lg border border-surface-hover p-2 hover:bg-surface-hover"
          >
            {sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-surface-hover bg-surface/50 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-4 text-gray-400">
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success" /> Strong Buy (&gt;20% edge)</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-warning" /> Good Value (10-20%)</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-primary" /> Small Edge (5-10%)</span>
          <span className="ml-auto flex items-center gap-1 text-xs">
            <RefreshCw className="h-3 w-3" /> Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Mobile-Optimized Trade Cards */}
      <div className="grid gap-4">
        {filteredTrades.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const edge = trade.research.edge;
          const isStrongBuy = edge > 20;
          
          return (
            <div 
              key={trade.id}
              className={`rounded-xl border p-4 transition-all hover:border-primary/50 ${
                isStrongBuy ? 'border-success/30 bg-success/5' : 'border-surface-hover bg-surface'
              }`}
            >
              {/* Mobile Layout */}
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${CATEGORY_COLORS[trade.category]}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight">{trade.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="truncate">{trade.ticker}</span>
                        <span>•</span>
                        <span>{new Date(trade.expiration).toLocaleDateString()}</span>
                        {isStrongBuy && (
                          <>
                            <span>•</span>
                            <span className="text-success font-medium">🔥 Top Pick #{index + 1}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <ConfidenceBadge level={trade.research.confidence} />
                </div>

                {/* Price Chart & Prediction Meter */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Price Trend (7 days)</span>
                      <span className={trade.priceHistory && trade.priceHistory[trade.priceHistory.length - 1] > trade.priceHistory[0] ? 'text-success' : 'text-danger'}>
                        {trade.priceHistory && trade.priceHistory[trade.priceHistory.length - 1] > trade.priceHistory[0] ? '↗' : '↘'}
                        {' '}
                        {trade.priceHistory ? Math.abs(trade.priceHistory[trade.priceHistory.length - 1] - trade.priceHistory[0]) : 0}¢
                      </span>
                    </div>
                    <div className="flex h-10 items-center gap-3 rounded-lg bg-surface-hover px-3">
                      <Sparkline data={trade.priceHistory || [trade.yesPrice]} />
                      <span className="text-lg font-bold">{trade.yesPrice}¢</span>
                    </div>
                    
                    <PredictionMeter probability={trade.research.trueProbability} marketPrice={trade.yesPrice} />
                  </div>

                  {/* Payout Card */}
                  <div className="rounded-xl bg-surface-hover p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Tooltip text={EDUCATION_CONTENT.multiplier}>
                        <div className="text-center cursor-help">
                          <div className="text-3xl font-bold text-success">{trade.payout.multiplier}x</div>
                          <div className="text-xs text-gray-400">Multiplier</div>
                        </div>
                      </Tooltip>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium text-success">+${trade.payout.potentialReturn - trade.payout.buyPrice}</div>
                        <div className="text-xs text-gray-400">Profit if win</div>
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">You Pay:</span>
                        <span className="font-medium">${trade.payout.buyPrice}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">You Win:</span>
                        <span className="font-medium text-success">${trade.payout.potentialReturn}</span>
                      </div>
                      
                      <Tooltip text={EDUCATION_CONTENT.volume}>
                        <div className="flex justify-between cursor-help">
                          <span className="flex items-center gap-1 text-gray-400">
                            Volume <HelpCircle className="h-3 w-3" />
                          </span>
                          <span>{trade.volume.toLocaleString()}</span>
                        </div>
                      </Tooltip>
                    </div>

                    <a
                      href={trade.kalshiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                    >
                      Trade on Kalshi <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Research Notes */}
                <div className="rounded-lg bg-surface-hover/50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
                    <Info className="h-4 w-4" /> Why This Trade?
                  </div>
                  <p className="text-sm">{trade.research.catalyst}</p>
                  
                  <div className="mt-2 flex flex-wrap gap-1">
                    {trade.research.sources.map(source => (
                      <span key={source} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTrades.length === 0 && (
        <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-gray-400">No trades found in this category</p>
        </div>
      )}
    </div>
  );
}
