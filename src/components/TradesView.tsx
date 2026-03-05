import { useState, useEffect, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { RESEARCHED_TRADES } from './trades-data';

export function TradesView() {
  const [trades, setTrades] = useState(RESEARCHED_TRADES);
  const [lastUpdated, setLastUpdated] = useState(null);

  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Kalshi Trades</h1>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 12px 0' }}>{lastUpdated ? '✓ Live' : 'Static'}</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {trades.slice(0, 5).map(trade => (
          <div key={trade.id} style={{ 
            padding: '8px', 
            borderRadius: '8px', 
            border: '1px solid #374151', 
            background: '#1f2937',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%'
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 500, 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {trade.title}
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '4px',
              marginTop: '8px'
            }}>
              <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px' }}>{trade.yesPrice}¢</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px' }}>${trade.payout.multiplier}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px' }}>R</div>
              </div>
              <div style={{ textAlign: 'center', padding: '4px', background: '#374151', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px' }}>K</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
