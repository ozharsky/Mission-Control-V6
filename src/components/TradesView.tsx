import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, BookOpen, Filter, ChevronDown, ChevronUp, X, ArrowUpRight, CloudRain, Zap, Target, BarChart3, Activity, Shield, DollarSign, Building2, Rocket, Globe } from 'lucide-react';
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
  multiplier: "Multiplier shows payout potential. 10x means $1 bet wins $10.",
  pay: "Pay is the contract price in cents. 5¢ = $0.05 per share.",
  volume: "Volume shows how much is being traded. Higher = more liquid.",
  yesNo: "👍 BUY YES if you think the event WILL happen."
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
        { series: 'KXBTC', category: 'crypto' }, { series: 'KXETH', category: 'crypto' },
        { series: 'KXSOL', category: 'crypto' }, { series: 'KXTRUTHSOCIAL', category: 'politics' },
        { series: 'KXFED', category: 'economics' }, { series: 'KXGDP', category: 'economics' },
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
    <div style={{ 
      width: '100%', 
      maxWidth: '100vw', 
      boxSizing: 'border-box',
      overflowX: 'hidden',
      padding: '0 8px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Kalshi Trades</h1>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
          {lastUpdated ? '✓ Live' : 'Static'}
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button 
          onClick={fetchLiveData} 
          disabled={isLoading}
          style={{ 
            padding: '6px 12px', 
            fontSize: '12px', 
            borderRadius: '6px', 
            border: '1px solid #374151', 
            background: '#374151', 
            color: 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? '...' : '↻'}
        </button>
        <button 
          onClick={() => setShowEducation(!showEducation)}
          style={{ 
            padding: '6px 12px', 
            fontSize: '12px', 
            borderRadius: '6px', 
            border: '1px solid #374151', 
            background: '#374151', 
            color: 'white' 
          }}
        >
          ?
        </button>
      </div>

      {/* Education Panel */}
      {showEducation && (
        <div style={{ 
          padding: '12px', 
          borderRadius: '8px', 
          border: '1px solid #374151', 
          background: '#1f2937',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>📚 How to Read</h3>
            <button onClick={() => setShowEducation(false)} style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>
            <p><strong style={{ color: '#4ade80' }}>R-Score:</strong> {EDUCATION_CONTENT.rScore}</p>
            <p style={{ marginTop: '8px' }}><strong style={{ color: '#60a5fa' }}>Kelly:</strong> {EDUCATION_CONTENT.kelly}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '8px', 
        marginBottom: '12px' 
      }}>
        <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#1f2937' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>Trades</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{stats.total}</div>
        </div>
        <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #374151', background: '#1f2937' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>R&gt;1.5</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>{stats.highRScoreTrades}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '6px', 
        marginBottom: '12px', 
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {['all', 'weather', 'crypto', 'economics'].map(cat => {
          const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat];
          const selected = selectedCategory === cat;
          return (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                padding: '6px 10px', 
                fontSize: '11px', 
                borderRadius: '6px', 
                border: 'none', 
                whiteSpace: 'nowrap',
                background: selected ? '#3b82f6' : '#374151', 
                color: 'white',
                flexShrink: 0
              }}
            >
              <Icon size={12} />
              {cat}
              {selected && <span style={{ fontSize: '10px', opacity: 0.8 }}>({filteredTrades.length})</span>}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          style={{ 
            flex: 1, 
            padding: '6px', 
            fontSize: '12px', 
            borderRadius: '6px', 
            border: '1px solid #374151', 
            background: '#1f2937', 
            color: 'white' 
          }}
        >
          <option value="edge">Sort: Edge</option>
          <option value="multiplier">Sort: Mult</option>
        </select>
        <button 
          onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
          style={{ 
            padding: '6px 12px', 
            fontSize: '12px', 
            borderRadius: '6px', 
            border: '1px solid #374151', 
            background: '#1f2937', 
            color: 'white' 
          }}
        >
          {sortDirection === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      {/* Trade Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedTrades.map(trade => {
          const Icon = CATEGORY_ICONS[trade.category];
          const rScore = trade.rScore || 0;
          const borderColor = rScore >= 1.5 ? '#10b981' : rScore >= 1.0 ? '#f59e0b' : '#374151';
          const bgColor = rScore >= 1.5 ? '#10b98110' : rScore >= 1.0 ? '#f59e0b10' : '#1f2937';
          
          return (
            <div 
              key={trade.id} 
              style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                border: `2px solid ${borderColor}`, 
                background: bgColor,
                boxSizing: 'border-box',
                width: '100%'
              }}
            >
              {/* Title Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: '#374151'
                }}>
                  <Icon size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, lineHeight: 1.3 }}>{trade.title}</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
                    {new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                  </div>
                </div>
                <a 
                  href={trade.kalshiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px', 
                    borderRadius: '4px', 
                    background: '#3b82f6', 
                    color: 'white', 
                    textDecoration: 'none',
                    flexShrink: 0
                  }}
                >
                  ↗
                </a>
              </div>

              {/* Metrics - 2x2 Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '6px',
                marginBottom: '10px'
              }}>
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  background: '#37415160' 
                }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Pay</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{trade.yesPrice}¢</div>
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  background: '#37415160' 
                }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Win</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>${trade.payout.multiplier}</div>
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  background: rScore >= 1.5 ? '#10b98130' : '#37415160' 
                }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>R</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: rScore >= 1.5 ? '#4ade80' : 'white' }}>{rScore.toFixed(1)}</div>
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  background: '#37415160' 
                }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>K</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>{(trade.kellyFraction || 0).toFixed(1)}%</div>
                </div>
              </div>

              {/* Bottom */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between' 
              }}>
                <span style={{ fontSize: '11px', color: '#4ade80' }}>✅ +EV</span>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>💰 {trade.volume?.toLocaleString()}</span>
                <a 
                  href={trade.kalshiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    borderRadius: '6px', 
                    background: '#10b98120', 
                    color: '#4ade80', 
                    border: '1px solid #10b98140',
                    textDecoration: 'none'
                  }}
                >
                  👍 YES
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
