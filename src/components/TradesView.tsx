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
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveData = async () => {
    setIsLoading(true);
    try {
      const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
      const seriesToFetch = [
        { series: 'KXHIGHTSEA', category: 'weather' }, { series: 'KXHIGHNY', category: 'weather' },
        { series: 'KXBTC', category: 'crypto' }, { series: 'KXETH', category: 'crypto' },
      ];
      
      let allMarkets = [];
      for (const { series, category } of seriesToFetch) {
        try {
          await new Promise(r => setTimeout(r, 100));
          const res = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
          if (res.ok) {
            const data = await res.json();
            if (data.markets) {
              data.markets.forEach(m => { m.category = category; });
              allMarkets = [...allMarkets, ...data.markets];
            }
          }
        } catch (e) {}
      }
      
      const transformed = allMarkets.map(m => ({
        id: m.ticker, ticker: m.ticker, title: m.title, category: m.category,
        yesPrice: m.yes_ask || 50, volume: m.volume || 0,
        expiration: m.expiration_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        kalshiUrl: `https://kalshi.com/markets/${m.ticker}`,
        payout: { multiplier: Math.round(100 / (m.yes_ask || 50)) }
      }));
      
      if (transformed.length > 0) { setTrades(transformed); setLastUpdated(new Date()); }
    } catch (e) {}
    setIsLoading(false);
  };

  const sortedTrades = useMemo(() => [...trades].sort((a, b) => {
    let c = sortBy === 'edge' ? (a.yesPrice || 0) - (b.yesPrice || 0) : a.payout.multiplier - b.payout.multiplier;
    return sortDirection === 'desc' ? -c : c;
  }), [trades, sortBy, sortDirection]);

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Kalshi Trades</h1>
        <button onClick={fetchLiveData} disabled={isLoading} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #374151', background: '#374151', color: 'white' }}>{isLoading ? '...' : '↻'}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto' }}>
        {['all', 'weather', 'crypto'].map(cat => {
          const Icon = cat === 'all' ? Filter : CATEGORY_ICONS[cat];
          const selected = selectedCategory === cat;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: 'none', whiteSpace: 'nowrap', background: selected ? '#3b82f6' : '#374151', color: 'white' }}>
              <Icon size={10} /> {cat}
            </button>
          );
        })}
      </div>

      {/* Trade Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sortedTrades.slice(0, 10).map(trade => {
          const Icon = CATEGORY_ICONS[trade.category];
          return (
            <div key={trade.id} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #374151', background: '#1f2937' }}>
              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Icon size={14} color={CATEGORY_COLORS[trade.category]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trade.title}</div>
                </div>
                <a href={trade.kalshiUrl} target="_blank" style={{ fontSize: '11px', color: '#60a5fa' }}>↗</a>
              </div>
              
              {/* 2x2 Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                  <div style={{ fontSize: '8px', color: '#9ca3af' }}>Pay</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{trade.yesPrice}¢</div>
                </div>
                <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                  <div style={{ fontSize: '8px', color: '#9ca3af' }}>Win</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4ade80' }}>${trade.payout.multiplier}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
