import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, BookOpen, Filter, ChevronDown, ChevronUp,
  X, ArrowUpRight, CloudRain, Zap, Target, BarChart3, Activity,
  Shield, DollarSign, Building2, Rocket, Globe
} from 'lucide-react';
import { RESEARCHED_TRADES } from './trades-data';

const CATEGORY_ICONS = {
  weather: CloudRain, crypto: Zap, politics: Target, economics: BarChart3,
  sports: Activity, government: Shield, finance: DollarSign, companies: Building2,
  science: Rocket, world: Globe
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
  rScore: "R-Score measures edge vs market. >1.5 = strong +EV trade, 1.0-1.5 = decent, <1.0 = marginal.",
  kelly: "Kelly % is the optimal position size. Bet this % of your bankroll (we use half-Kelly for safety).",
  multiplier: "Multiplier shows payout potential. 10x means $1 bet wins $10. Higher multipliers come with lower probability.",
  pay: "Pay is the contract price in cents. 5¢ = $0.05 per share. Lower prices = higher multipliers but lower probability.",
  volume: "Volume shows how much is being traded. Higher = more liquid = easier to buy/sell at fair prices.",
  confidence: "High = strong data. Medium = decent data. Low = limited data. Higher confidence = more reliable edge estimate.",
  yesNo: "👍 BUY YES if you think the event WILL happen. 👎 Buy NO if you think it WON'T happen."
};

export function TradesView() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('edge');
  const [sortDirection, setSortDirection] = useState('desc');
  const [trades, setTrades] = useState(RESEARCHED_TRADES);
  const [showEducation, setShowEducation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      const seriesToFetch = [
        { series: 'KXHIGHTSEA', category: 'weather' }, { series: 'KXHIGHNY', category: 'weather' },
        { series: 'KXHIGHCHI', category: 'weather' }, { series: 'KXHIGHMIA', category: 'weather' },
        { series: 'KXHIGHTPHX', category: 'weather' }, { series: 'KXBTC', category: 'crypto' },
        { series: 'KXETH', category: 'crypto' }, { series: 'KXSOL', category: 'crypto' },
        { series: 'KXTRUTHSOCIAL', category: 'politics' }, { series: 'KXFED', category: 'economics' },
        { series: 'KXGDP', category: 'economics' }, { series: 'KXCPI', category: 'economics' },
      ];
      
      let allMarkets = [];
      for (const { series, category } of seriesToFetch) {
        try {
          await new Promise(r => setTimeout(r, 100));
          const res = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
          if (res.ok) {
            const data = await res.json();
            if (data.markets) {
              data.markets.forEach(m => { 
                m.category = category; 
                m.seriesTicker = series;
              });
              allMarkets = [...allMarkets, ...data.markets];
            }
          }
        } catch (e) {}
      }
      
      const transformed = allMarkets.map(m => ({
        id: m.ticker, 
        ticker: m.ticker, 
        title: m.title, 
        category: m.category,
        yesPrice: m.yes_ask || m.yes_price || 50, 
        noPrice: m.no_ask || 50, 
        volume: m.volume || 0,
        expiration: m.expiration_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        kalshiUrl: `https://kalshi.com/events/${(m.seriesTicker || '').toLowerCase()}`,
        research: { trueProbability: 50, edge: 0, confidence: 'medium', catalyst: 'Live market data', sources: [] },
        payout: { buyPrice: m.yes_ask || 50, potentialReturn: (100 - (m.yes_ask || 50)) / 100, multiplier: Math.round(100 / (m.yes_ask || 50)) }
      }));
      
      if (transformed.length > 0) { setTrades(transformed); setLastUpdated(new Date()); }
    } catch (e) {}
    setIsLoading(false);
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const tradesWithMetrics = useMemo(() => trades.map(trade => {
    const price = trade.yesPrice;
    const trueProb = trade.research.trueProbability;
    const edge = trueProb - price;
    const variance = price * (100 - price) / 100;
    const rScore = variance > 0 ? edge / Math.sqrt(variance) : 0;
    const kelly = edge > 0 ? edge / (price * (100 - price) / 100) : 0;
    return { ...trade, rScore, kellyFraction: Math.min(kelly * 0.5, 5) };
  }), [trades]);

  const filteredTrades = useMemo(() => tradesWithMetrics.filter(t => {
    if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
    if (t.yesPrice < 1 || t.yesPrice > 25) return false;
    if (t.volume < 50) return false;
    if (t.expiration && new Date(t.expiration) < new Date()) return false;
    if (t.ticker.includes('MVE')) return false;
    return true;
  }), [tradesWithMetrics, selectedCategory]);

  const sortedTrades = useMemo(() => [...filteredTrades].sort((a, b) => {
    let c = sortBy === 'edge' ? (a.rScore || 0) - (b.rScore || 0) : a.payout.multiplier - b.payout.multiplier;
    return sortDirection === 'desc' ? -c : c;
  }), [filteredTrades, sortBy, sortDirection]);

  const stats = useMemo(() => ({
    total: sortedTrades.length,
    avgRScore: sortedTrades.length > 0 ? (sortedTrades.reduce((s, t) => s + (t.rScore || 0), 0) / sortedTrades.length).toFixed(1) : '0.0',
    highRScoreTrades: sortedTrades.filter(t => (t.rScore || 0) >= 1.5).length
  }), [sortedTrades]);

  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 max-w-full overflow-hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">Kalshi Trades</h1>
          <p className="text-sm text-gray-400 truncate">
            {lastUpdated ? '✓ Live data' : 'Static data'} {lastUpdated && `• Updated ${lastUpdated.toLocaleTimeString()}`}
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
          <button 
            onClick={() => setShowEducation(!showEducation)} 
            className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{showEducation ? 'Hide' : 'Learn'}</span>
          </button>
          <a 
            href="https://kalshi.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20 ml-auto sm:ml-0"
          >
            <span className="hidden sm:inline">Kalshi</span>
            <ArrowUpRight className="h-4 w-4" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium text-gray-300">R-Score</div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">R:1.5+</span> 
                <span className="text-gray-400">Strong +EV</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.rScore}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-gray-300">Kelly %</div>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">K:2.5%</span> 
                <span className="text-gray-400">Position size</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.kelly}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-gray-300">Pay → Multiplier</div>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">5¢ → 20x</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.multiplier}</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium text-gray-300">Volume</div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">💰 1,240 vol</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">{EDUCATION_CONTENT.volume}</div>
            </div>
          </div>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Trades</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg R-Score</div>
          <div className={`text-xl font-bold ${parseFloat(stats.avgRScore) > 1.5 ? 'text-success' : 'text-warning'}`}>{stats.avgRScore}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">+EV Trades (R&gt;1.5)</div>
          <div className="text-xl font-bold text-success">{stats.highRScoreTrades}</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-3">
          <div className="text-xs text-gray-400">Avg Mult</div>
          <div className="text-xl font-bold text-primary">{stats.avgMultiplier || '0.0'}x</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 max-w-full overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide max-w-full">
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

      {/* Trade Cards */}
      <div className="grid gap-3">
        {sortedTrades.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const price = trade.yesPrice;
          const multiplier = trade.payout.multiplier;
          const rScore = trade.rScore || 0;
          const kelly = trade.kellyFraction || 0;
          
          const dealColor = rScore >= 1.5 ? 'bg-emerald-500/10 border-emerald-500/50' : 
                           rScore >= 1.0 ? 'bg-amber-500/10 border-amber-500/50' : 
                           'bg-surface border-surface-hover';
          
          let recommendation = '✅ +EV Trade';
          let recColor = 'text-emerald-400';

          return (
            <div key={trade.id} className={`rounded-xl border-2 p-3 sm:p-4 transition-all hover:scale-[1.01] ${dealColor}`}>
              {/* TOP ROW: Icon + Title + Trade Button */}
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[trade.category]}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-xs sm:text-sm leading-tight">{trade.title}</h3>
                  <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-400 mt-1">
                    <span>{new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                    <span>•</span>
                    <span className="capitalize">{trade.category}</span>
                  </div>
                </div>
                
                <a 
                  href={trade.kalshiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1 rounded-lg bg-primary px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white hover:bg-primary/90 shrink-0"
                >
                  <span className="hidden sm:inline">Trade</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>

              {/* MIDDLE: Key Metrics Grid - 2x2 on mobile, 4x1 on desktop */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Pay</div>
                  <div className="text-base sm:text-lg font-bold">{price}¢</div>
                </div>
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Win</div>
                  <div className="text-base sm:text-lg font-bold text-emerald-400">${multiplier}</div>
                </div>
                <div className={`text-center rounded-lg p-2 ${rScore >= 1.5 ? 'bg-emerald-500/20' : 'bg-surface-hover/50'}`}>
                  <div className="text-[10px] text-gray-400 uppercase">R-Score</div>
                  <div className={`text-base sm:text-lg font-bold ${rScore >= 1.5 ? 'text-emerald-400' : 'text-gray-300'}`}>{rScore.toFixed(1)}</div>
                </div>
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Kelly</div>
                  <div className="text-base sm:text-lg font-bold text-blue-400">{kelly.toFixed(1)}%</div>
                </div>
              </div>

              {/* BOTTOM: Why This Trade + Yes/No Recommendation */}
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-medium shrink-0 ${recColor}`}>{recommendation}</span>
                  <span className="text-xs text-gray-500 truncate">💰 {trade.volume?.toLocaleString()} vol</span>
                </div>
                <a 
                  href={trade.kalshiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 shrink-0"
                >
                  👍 BUY YES
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
