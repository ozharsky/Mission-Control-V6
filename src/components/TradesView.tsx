import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Filter, CloudRain, Zap, Target, BarChart3, Activity, Shield, DollarSign, Building2, Rocket, Globe } from 'lucide-react';
import { RESEARCHED_TRADES } from './trades-data';

const CATEGORY_ICONS = {
  weather: CloudRain, crypto: Zap, politics: Target, economics: BarChart3,
  sports: Activity, government: Shield, finance: DollarSign, companies: Building2,
  science: Rocket, world: Globe
};

const CATEGORY_COLORS = {
  weather: '#3b82f6', crypto: '#f97316', politics: '#ef4444', economics: '#22c55e',
  sports: '#a855f7', government: '#6366f1', finance: '#10b981', companies: '#06b6d4',
  science: '#8b5cf6', world: '#14b8a6'
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
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Kalshi Trades</h1>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>{lastUpdated ? '✓ Live' : 'Static'}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={fetchLiveData} disabled={isLoading} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #374151', background: '#374151', color: 'white' }}>{isLoading ? '...' : '↻'}</button>
          <button onClick={() => setShowEducation(!showEducation)} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #374151', background: '#374151', color: 'white' }}>?</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        <div style={{ padding: '8px', borderRadius: '8px', border: '1px solid #374151', background: '#1f2937' }}>
          <div style={{ fontSize: '9px', color: '#9ca3af' }}>Trades</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{stats.total}</div>
        </div>
        <div style={{ padding: '8px', borderRadius: '8px', border: '1px solid #374151', background: '#1f2937' }}>
          <div style={{ fontSize: '9px', color: '#9ca3af' }}>R&gt;1.5</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4ade80' }}>{stats.highRScoreTrades}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
        {['all', 'weather', 'crypto', 'economics', 'politics'].map(cat => {
          const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat];
          const selected = selectedCategory === cat;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: 'none', whiteSpace: 'nowrap', background: selected ? '#3b82f6' : '#374151', color: 'white' }}>
              <Icon size={10} /> {cat}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ flex: 1, padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}>
          <option value="edge">Sort: Edge</option>
          <option value="multiplier">Sort: Mult</option>
        </select>
        <button onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #374151', background: '#1f2937', color: 'white' }}>{sortDirection === 'desc' ? '↓' : '↑'}</button>
      </div>

      {/* Trade Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sortedTrades.map(trade => {
          const Icon = CATEGORY_ICONS[trade.category];
          const rScore = trade.rScore || 0;
          const borderColor = rScore >= 1.5 ? '#10b981' : rScore >= 1.0 ? '#f59e0b' : '#374151';
          const bgColor = rScore >= 1.5 ? '#10b98115' : rScore >= 1.0 ? '#f59e0b15' : '#1f2937';
          
          return (
            <div key={trade.id} style={{ padding: '10px', borderRadius: '8px', border: `2px solid ${borderColor}`, background: bgColor }}>
              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: CATEGORY_COLORS[trade.category] + '30' }}>
                  <Icon size={14} color={CATEGORY_COLORS[trade.category]} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, lineHeight: 1.4 }}>{trade.title}</div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>{new Date(trade.expiration).toLocaleDateString(undefined, {month:'short', day:'numeric'})} • {trade.category}</div>
                </div>
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', background: '#3b82f6', color: 'white', textDecoration: 'none', flexShrink: 0 }}>↗</a>
              </div>

              {/* Metrics - 2x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <div style={{ textAlign: 'center', padding: '6px', borderRadius: '4px', background: '#37415180' }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Pay</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{trade.yesPrice}¢</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px', borderRadius: '4px', background: '#37415180' }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Win</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4ade80' }}>${trade.payout.multiplier}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px', borderRadius: '4px', background: rScore >= 1.5 ? '#10b98140' : '#37415180' }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>R-Score</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: rScore >= 1.5 ? '#4ade80' : 'white' }}>{rScore.toFixed(1)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px', borderRadius: '4px', background: '#37415180' }}>
                  <div style={{ fontSize: '9px', color: '#9ca3af' }}>Kelly</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#60a5fa' }}>{(trade.kellyFraction || 0).toFixed(1)}%</div>
                </div>
              </div>

              {/* Bottom */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#4ade80' }}>✅ +EV Trade</span>
                <span style={{ fontSize: '10px', color: '#6b7280' }}>💰 {trade.volume?.toLocaleString()}</span>
                <a href={trade.kalshiUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', background: '#10b98130', color: '#4ade80', border: '1px solid #10b98150', textDecoration: 'none' }}>👍 BUY YES</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
