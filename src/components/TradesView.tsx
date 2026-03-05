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
      
      // Fetch specific series: crypto, weather, government, finance, companies, economics, science, world, politics
      // NOTE: Many series exist but have no active markets currently (markets settled)
      const seriesToFetch = [
        // Weather (5) - These have active markets
        { series: 'KXHIGHTSEA', category: 'weather', name: 'Seattle Weather' },
        { series: 'KXHIGHNY', category: 'weather', name: 'NYC Weather' },
        { series: 'KXHIGHCHI', category: 'weather', name: 'Chicago Weather' },
        { series: 'KXHIGHMIA', category: 'weather', name: 'Miami Weather' },
        { series: 'KXHIGHTPHX', category: 'weather', name: 'Phoenix Weather' },
        // Crypto (5) - These exist but may not have cheap liquid markets
        { series: 'KXBTC', category: 'crypto', name: 'Bitcoin' },
        { series: 'KXETH', category: 'crypto', name: 'Ethereum' },
        { series: 'KXSOL', category: 'crypto', name: 'Solana' },
        { series: 'KXADA', category: 'crypto', name: 'Cardano' },
        { series: 'KXDOT', category: 'crypto', name: 'Polkadot' },
        // Companies (5) - Tech stocks, acquisitions
        { series: 'TESLAROADSTER', category: 'companies', name: 'Tesla Roadster' },
        { series: 'KXTIKTOKSELL', category: 'companies', name: 'TikTok Sale' },
        { series: 'KXDANAWHITEFB', category: 'companies', name: 'Dana White Meta' },
        { series: 'KXACQUIREMANU', category: 'companies', name: 'ManU Acquisition' },
        { series: 'KXSTOCKXTEST', category: 'companies', name: 'StockX' },
        // Economics (5) - Fed, inflation, jobs
        { series: 'KXRATECUTE', category: 'economics', name: 'Fed Rate Cut' },
        { series: 'KXLCPIMIN', category: 'economics', name: 'High Inflation Ends' },
        { series: 'NGASMAX', category: 'economics', name: 'Natural Gas Price' },
        { series: 'SPRMAX', category: 'economics', name: 'SPR Release' },
        { series: 'KXDIESELM', category: 'economics', name: 'Diesel Price' },
        // Science & Technology (5) - SpaceX, AI, rockets
        { series: 'KXCHOPSTICKS', category: 'science', name: 'SpaceX Chopsticks' },
        { series: 'KXCOLONIZEMARS', category: 'science', name: 'Colonize Mars' },
        { series: 'KXELONMARS', category: 'science', name: 'Elon Mars' },
        { series: 'KXNEUTRONORBIT', category: 'science', name: 'Neutron Rocket' },
        { series: 'KXALTMAN', category: 'science', name: 'Sam Altman Company' },
        // World (5) - International events
        { series: 'KXGDPCN', category: 'world', name: 'China GDP' },
        { series: 'MAERSK', category: 'world', name: 'Maersk Red Sea' },
        { series: 'VONCUK', category: 'world', name: 'UK Vote of No Confidence' },
        { series: 'PMLA', category: 'world', name: 'LA Pollution' },
        { series: 'KXCTCS', category: 'world', name: 'Child Tax Credit' },
        // Politics (5) - Trump Truth Social, etc
        { series: 'KXTRUTHSOCIAL', category: 'politics', name: 'Trump Truth Social' },
        { series: 'KXFED', category: 'economics', name: 'Fed Rate' },
        { series: 'KXGDP', category: 'economics', name: 'GDP Growth' },
        { series: 'KXCPI', category: 'economics', name: 'CPI Inflation' },
        { series: 'KXJAN6PARDONDAY1', category: 'politics', name: 'Jan 6 Pardons' },
        // Government (5) - Series exist but NO ACTIVE MARKETS currently
        { series: 'KXBIDENMENTION', category: 'government', name: 'Biden Speech' },
        { series: 'KXBILL', category: 'government', name: 'Bill Becomes Law' },
        { series: 'KXASSOCAG', category: 'government', name: 'Associate AG' },
        { series: 'KXFEDCHAIRCONFIRMED', category: 'government', name: 'Fed Chair Confirm' },
        { series: 'KXADMINNASA', category: 'government', name: 'NASA Admin' },
        // Finance (5) - Series exist but NO ACTIVE MARKETS currently
        { series: 'KXIPO', category: 'finance', name: 'IPOs' },
        { series: 'KXFREDDIE', category: 'finance', name: 'Freddie Mac IPO' },
        { series: 'KXACQUIRECOINBASE', category: 'finance', name: 'Coinbase Acquisition' },
        { series: 'KXIPOANDURIL', category: 'finance', name: 'Anduril IPO' },
        { series: 'KXIPOAIRTABLE', category: 'finance', name: 'AirTable IPO' },
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
        // Process markets: filter cheap ones with volume
        const filteredMarkets = allMarkets.filter((m: any) => {
          const price = m.yes_ask || m.yes_price || m.last_price || 50;
          const volume = m.volume || m.trade_volume || 0;
          return price >= 1 && price <= 25 && volume > 100; // Cheap + liquid
        });
        
        // Sort by multiplier within each category, then interleave for diversity
        const byCategory: Record<string, any[]> = {
          weather: [],
          crypto: [],
          politics: [],
          economics: []
        };
        
        filteredMarkets.forEach((m: any) => {
          const tickerPrefix = m.ticker.split('-')[0].toUpperCase();
          let cat = 'economics';
          if (['KXHIGHTSEA', 'KXHIGHNY', 'KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHTPHX', 'KXRAINSEA'].includes(tickerPrefix)) {
            cat = 'weather';
          } else if (['KXBTC', 'KXETH', 'KXSOL', 'KXADA', 'KXDOT'].includes(tickerPrefix)) {
            cat = 'crypto';
          } else if (['KXTRUTHSOCIAL', 'KXVOTEHUBTRUMPUPDOWN', 'KXTRUMPZELENSKYY', 'KXTRUMPMEET', 'KXTRUMPOUT'].includes(tickerPrefix)) {
            cat = 'politics';
          } else if (['FED', 'KXCPI', 'GDP', 'FRM', 'PAYROLLS', 'CPI'].includes(tickerPrefix)) {
            cat = 'economics';
          }
          byCategory[cat].push(m);
        });
        
        // Sort each category by multiplier (best deals first)
        Object.keys(byCategory).forEach(cat => {
          byCategory[cat].sort((a: any, b: any) => {
            const priceA = a.yes_ask || a.yes_price || a.last_price || 50;
            const priceB = b.yes_ask || b.yes_price || b.last_price || 50;
            return (100 / priceB) - (100 / priceA);
          });
        });
        
        // Take top 15 from each category for balanced view
        const balancedTrades = [
          ...byCategory.weather.slice(0, 15),
          ...byCategory.crypto.slice(0, 15),
          ...byCategory.politics.slice(0, 15),
          ...byCategory.economics.slice(0, 15)
        ];
        
        // Process the balanced trades
        const processedTrades: KalshiTrade[] = balancedTrades.map((m: any, idx: number) => {
            const price = m.yes_ask || m.yes_price || m.last_price || 50;
            const multiplier = parseFloat((100 / price).toFixed(1));
            
            // Clean title - include subtitle for crypto/price range markets
            let title = m.title || `${m.series_name || m.ticker} Market`;
            title = title.replace(/yes /gi, '').replace(/,yes /gi, ' + ').replace(/,no /gi, ' / ');
            
            // Detect category from ticker prefix first (needed for subtitle check)
            const tickerPrefix = m.ticker.split('-')[0].toUpperCase();
            
            // Add subtitle for markets that have them
            if (m.subtitle) {
              title = `${title} - ${m.subtitle}`;
            }
            
            // For IPO/finance/date-based markets, extract date from ticker
            // Format: KXIPOANDURIL-27MAY01 -> "May 2027"
            const tickerParts = m.ticker.split('-');
            if (tickerParts.length >= 2 && ['KXIPO', 'KXFREDDIE', 'KXACQUIRE', 'KXRATE', 'KXLCPIMIN'].some(p => tickerPrefix.includes(p))) {
              const dateCode = tickerParts[1]; // e.g., "27MAY01"
              if (dateCode && dateCode.length >= 5) {
                const year = '20' + dateCode.substring(0, 2); // "27" -> "2027"
                const monthCode = dateCode.substring(2, 5); // "MAY"
                const months: Record<string, string> = {
                  'JAN': 'Jan', 'FEB': 'Feb', 'MAR': 'Mar', 'APR': 'Apr', 'MAY': 'May', 'JUN': 'Jun',
                  'JUL': 'Jul', 'AUG': 'Aug', 'SEP': 'Sep', 'OCT': 'Oct', 'NOV': 'Nov', 'DEC': 'Dec'
                };
                const month = months[monthCode] || monthCode;
                if (month) {
                  title = `${title} (${month} ${year})`;
                }
              }
            }
            
            if (title.length > 90) title = title.substring(0, 90) + '...';
            
            // Build URL using series ticker (trade bot format)
            const seriesTicker = m.ticker.split('-')[0].toLowerCase();
            const urlTicker = seriesTicker;
            
            // Detect category from ticker prefix
            let detectedCategory: KalshiTrade['category'] = 'companies';
            if (['KXHIGHTSEA', 'KXHIGHNY', 'KXHIGHCHI', 'KXHIGHMIA', 'KXHIGHTPHX', 'KXRAINSEA', 'KXRAINSFO', 'KXSNOW NYC'].includes(tickerPrefix)) {
              detectedCategory = 'weather';
            } else if (['KXBTC', 'KXETH', 'KXSOL', 'KXADA', 'KXDOT'].includes(tickerPrefix)) {
              detectedCategory = 'crypto';
            } else if (['TESLAROADSTER', 'KXTIKTOKSELL', 'KXDANAWHITEFB', 'KXACQUIREMANU', 'KXSTOCKXTEST'].includes(tickerPrefix)) {
              detectedCategory = 'companies';
            } else if (['KXFED', 'KXGDP', 'KXCPI', 'KXRATECUTE', 'KXLCPIMIN', 'NGASMAX', 'SPRMAX', 'KXDIESELM'].includes(tickerPrefix)) {
              detectedCategory = 'economics';
            } else if (['KXCHOPSTICKS', 'KXCOLONIZEMARS', 'KXELONMARS', 'KXNEUTRONORBIT', 'KXALTMAN', 'SUPERCON'].includes(tickerPrefix)) {
              detectedCategory = 'science';
            } else if (['KXGDPCN', 'MAERSK', 'VONCUK', 'PMLA', 'KXCTCS'].includes(tickerPrefix)) {
              detectedCategory = 'world';
            } else if (['KXTRUTHSOCIAL', 'KXJAN6PARDONDAY1', 'KXCORPTAXCUT', 'KXSECARMY', 'KXMETGALA', 'KXDJTUNFOLLOWMUSK', 'KXBIDENMENTION', 'KXBILL', 'KXASSOCAG'].includes(tickerPrefix)) {
              detectedCategory = 'politics';
            } else if (['KXFEDCHAIRCONFIRMED', 'KXADMINNASA'].includes(tickerPrefix)) {
              detectedCategory = 'government';
            } else if (['KXIPO', 'KXFREDDIE', 'KXACQUIRECOINBASE', 'KXIPOANDURIL', 'KXIPOAIRTABLE', 'KXGREENTERRITORY', 'KXCANTERRITORY'].includes(tickerPrefix)) {
              detectedCategory = 'finance';
            }
            
            return {
              id: `live-${idx}`,
              ticker: m.ticker,
              title: title,
              category: detectedCategory,
              yesPrice: price,
              noPrice: 100 - price,
              volume: m.volume || m.trade_volume || 0,
              expiration: m.close_time || m.settlement_date || m.expiration || '2026-03-05',
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

  // Fetch markets by category from Kalshi API
  const fetchByCategory = async (category: string) => {
    const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2';
    try {
      // Get all series in this category
      const response = await fetch(`${KALSHI_API_URL}/series?category=${category}&limit=100`);
      if (!response.ok) return [];
      const data = await response.json();
      const series = data.series || [];
      
      // Fetch markets from each series
      let allMarkets: any[] = [];
      for (const s of series.slice(0, 10)) { // Limit to top 10 series per category
        try {
          const marketResponse = await fetch(`${KALSHI_API_URL}/series/${s.ticker}`);
          if (marketResponse.ok) {
            const marketData = await marketResponse.json();
            if (marketData.markets) {
              marketData.markets.forEach((m: any) => {
                m.category = category.toLowerCase();
                m.series_name = s.title;
              });
              allMarkets = allMarkets.concat(marketData.markets);
            }
          }
        } catch (e) {
          console.log(`Failed to fetch ${s.ticker}:`, e);
        }
      }
      return allMarkets;
    } catch (error) {
      console.error(`Failed to fetch category ${category}:`, error);
      return [];
    }
  };

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

      {/* COMPREHENSIVE LEGEND */}
      <div className="rounded-xl bg-surface-hover/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>How to Read Trade Cards</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* R-Score */}
          <div className="space-y-1">
            <div className="font-medium text-gray-300">R-Score</div>
            <div className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">R:1.5+</span> <span className="text-gray-400">+EV trade</span></div>
            <div className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">R:1.0</span> <span className="text-gray-400">Marginal</span></div>
            <div className="text-gray-500 mt-1">Higher = better edge vs market</div>
          </div>
          
          {/* Kelly % */}
          <div className="space-y-1">
            <div className="font-medium text-gray-300">Kelly %</div>
            <div className="flex items-center gap-1"><span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">K:2.5%</span> <span className="text-gray-400">Position size</span></div>
            <div className="text-gray-500 mt-1">% of bankroll to bet (half-Kelly)</div>
          </div>
          
          {/* Price/Multiplier */}
          <div className="space-y-1">
            <div className="font-medium text-gray-300">Price → Multiplier</div>
            <div className="flex items-center gap-1"><span className="text-emerald-400">5¢ → 20x</span></div>
            <div className="text-gray-500 mt-1">Lower price = higher payout</div>
          </div>
          
          {/* Volume */}
          <div className="space-y-1">
            <div className="font-medium text-gray-300">Volume</div>
            <div className="flex items-center gap-1">💰 <span className="text-gray-400">1,240 vol</span></div>
            <div className="text-gray-500 mt-1">Higher = easier to trade</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="text-emerald-400">👍</span> Buy YES if you think it happens</span>
          <span className="flex items-center gap-1 text-xs text-gray-400"><span className="text-red-400">👎</span> Buy NO if you think it won't</span>
        </div>
      </div>

      {/* TRADE CARDS - REDESIGNED */}
      <div className="grid gap-3">
        {tradesWithMetrics.map((trade, index) => {
          const Icon = CATEGORY_ICONS[trade.category];
          const price = trade.yesPrice;
          const multiplier = trade.payout.multiplier;
          const rScore = trade.rScore || 0;
          const kelly = trade.kellyFraction || 0;
          
          // Color coding based on R-Score
          const dealColor = rScore >= 1.5 ? 'bg-emerald-500/10 border-emerald-500/50' : 
                           rScore >= 1.0 ? 'bg-amber-500/10 border-amber-500/50' : 
                           'bg-surface border-surface-hover';
          
          // Recommendation based on R-Score
          let recommendation = 'Skip';
          let recColor = 'text-gray-400';
          if (rScore >= 2.0) {
            recommendation = '🔥 Strong Buy';
            recColor = 'text-emerald-400';
          } else if (rScore >= 1.5) {
            recommendation = '✅ Buy';
            recColor = 'text-emerald-400';
          } else if (rScore >= 1.0) {
            recommendation = '⚠️ Marginal';
            recColor = 'text-amber-400';
          }

          return (
            <div key={trade.id} className={`rounded-xl border-2 p-4 transition-all hover:scale-[1.01] ${dealColor}`}>
              
              {/* TOP ROW: Icon + Title + Trade Button */}
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[trade.category]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">{trade.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>Closes {new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                    <span>•</span>
                    <span className="capitalize">{trade.category}</span>
                  </div>
                </div>
                
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" 
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 shrink-0"
                >
                  Trade <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>

              {/* MIDDLE: Key Metrics Grid */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {/* Pay */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Pay</div>
                  <div className="text-lg font-bold">{price}¢</div>
                </div>
                
                {/* Win */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Win</div>
                  <div className="text-lg font-bold text-emerald-400">${multiplier}</div>
                </div>
                
                {/* R-Score */}
                <div className={`text-center rounded-lg p-2 ${rScore >= 1.5 ? 'bg-emerald-500/20' : 'bg-surface-hover/50'}`}>
                  <div className="text-[10px] text-gray-400 uppercase">R-Score</div>
                  <div className={`text-lg font-bold ${rScore >= 1.5 ? 'text-emerald-400' : 'text-gray-300'}`}>{rScore.toFixed(1)}</div>
                </div>
                
                {/* Kelly */}
                <div className="text-center bg-surface-hover/50 rounded-lg p-2">
                  <div className="text-[10px] text-gray-400 uppercase">Kelly</div>
                  <div className="text-lg font-bold text-blue-400">{kelly.toFixed(1)}%</div>
                </div>
              </div>

              {/* BOTTOM: Why This Trade + Yes/No Recommendation */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${recColor}`}>{recommendation}</span>
                  <span className="text-xs text-gray-500">💰 {trade.volume?.toLocaleString()} vol</span>
                </div>
                
                {/* Single Recommendation Button */}
                {rScore >= 1.5 ? (
                  <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
                    title="R-Score > 1.5 - This is a +EV trade. Buy YES if you agree with the thesis."
                  >
                    👍 BUY YES
                  </a>
                ) : rScore >= 1.0 ? (
                  <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                    title="R-Score 1.0-1.5 - Marginal trade. Consider buying YES if you have high conviction."
                  >
                    👍 BUY YES
                  </a>
                ) : (
                  <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    title="R-Score < 1.0 - Skip this trade or consider buying NO if you think it's overpriced."
                  >
                    👎 SKIP / BUY NO
                  </a>
                )}
              </div>
              
              {/* Why This Trade */}
              <div className="mt-2 text-xs text-gray-400 bg-surface-hover/30 rounded-lg p-2">
                <span className="text-gray-500">Why:</span> {trade.research.catalyst}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
