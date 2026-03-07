import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Target, Activity, BarChart3, 
  Calendar, Clock, Filter, ArrowUpRight, ArrowDownRight, RefreshCw,
  DollarSign, Percent, Award, History, Zap, ChevronDown, ChevronUp,
  Plus, Minus, Trash2, AlertCircle
} from 'lucide-react';
import { getData, setData } from '../lib/firebase';

// Types
interface KalshiTrade {
  id: string;
  ticker: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  expiration: string;
  edge: number;
  rScore: number;
  kellyPct: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid';
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

// Mock data - will be replaced with Firebase integration
const MOCK_TRADES: KalshiTrade[] = [
  {
    id: '1',
    ticker: 'KXHIGHNY-43-44',
    title: 'NYC High Temp 43-44°F',
    category: 'weather',
    yesPrice: 1,
    noPrice: 99,
    volume: 134000,
    expiration: '2026-03-08',
    edge: 15,
    rScore: 2.1,
    kellyPct: 5,
    recommendation: 'strong_buy',
    research: { catalyst: 'Weather models cooling', confidence: 'high', sources: ['NWS'] }
  },
  {
    id: '2', 
    ticker: 'KXBTC-85000-90000',
    title: 'Bitcoin $85k-$90k',
    category: 'crypto',
    yesPrice: 45,
    noPrice: 55,
    volume: 89000,
    expiration: '2026-03-09',
    edge: 8,
    rScore: 1.4,
    kellyPct: 2,
    recommendation: 'buy',
    research: { catalyst: 'Technical support at $85k', confidence: 'medium', sources: ['TradingView'] }
  }
];

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

export function KalshiTradingView() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'portfolio' | 'history'>('opportunities');
  const [trades, setTrades] = useState<KalshiTrade[]>(MOCK_TRADES);
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
                const impliedProb = yesPrice;
                // Simple edge calculation (would be more sophisticated in real implementation)
                const edge = Math.random() * 20 - 5; // Mock edge for now
                const rScore = edge > 0 ? 1 + (edge / 10) : 0;
                
                return {
                  id: m.ticker,
                  ticker: m.ticker,
                  title: m.title,
                  category,
                  yesPrice,
                  noPrice: m.no_ask || (100 - yesPrice),
                  volume: m.volume || 0,
                  expiration: m.close_date || m.expiration_date,
                  edge: Math.round(edge),
                  rScore: Math.round(rScore * 10) / 10,
                  kellyPct: Math.max(1, Math.min(10, edge / 2)),
                  recommendation: edge > 10 ? 'strong_buy' : edge > 5 ? 'buy' : edge > 0 ? 'hold' : 'avoid',
                  research: { catalyst: 'Live market data', confidence: 'medium', sources: [] }
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

  // Close position
  const closePosition = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const pnl = calculatePositionPnL(position);
    const exitValue = position.value + pnl;

    setPositions(prev => prev.map(p => 
      p.id === positionId 
        ? { ...p, status: 'closed', pnl }
        : p
    ));

    setStats(prev => ({
      ...prev,
      bankroll: prev.bankroll + exitValue,
      totalPnl: prev.totalPnl + pnl,
      totalTrades: prev.totalTrades + 1,
      winningTrades: pnl > 0 ? prev.winningTrades + 1 : prev.winningTrades,
      losingTrades: pnl <= 0 ? prev.losingTrades + 1 : prev.losingTrades,
      winRate: ((pnl > 0 ? prev.winningTrades + 1 : prev.winningTrades) / (prev.totalTrades + 1)) * 100,
      roi: ((prev.totalPnl + pnl) / prev.initialBankroll) * 100,
      openPositions: prev.openPositions - 1
    }));
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
                    <p className="text-sm text-gray-400">{trade.ticker}</p>
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
                    <div className="grid gap-4 lg:grid-cols-2">
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
                        <p className="text-sm text-gray-400">Expires</p>
                        <p className="text-white">{new Date(trade.expiration).toLocaleDateString()}</p>
                        <p className="mt-2 text-sm text-gray-400">Kelly %</p>
                        <p className="text-white">{trade.kellyPct.toFixed(1)}% of bankroll</p>
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
          {positions.filter(p => p.status === 'open').length === 0 ? (
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
                    <th className="pb-2 text-right">P&L</th>
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
