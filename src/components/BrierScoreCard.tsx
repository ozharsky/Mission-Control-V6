import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Target, AlertCircle, CheckCircle, Star } from 'lucide-react';
import { getData } from '../lib/firebase';

interface BrierMetrics {
  enabled: boolean;
  hasData: boolean;
  calibration: string;
  trend: string;
  overall?: {
    brier: number;
    msep: number;
    resolved: number;
    total: number;
  };
  last30Days?: {
    avgBrier: number;
    count: number;
  };
  last90Days?: {
    avgBrier: number;
    count: number;
  };
  byCategory?: Record<string, {
    avgBrier: number;
    resolvedTrades: number;
    totalTrades: number;
  }>;
  recommendations?: string[];
  calibrationBuckets?: Array<{
    range: string;
    actualWinRate: number;
    count: number;
  }>;
}

export function BrierScoreCard() {
  const [metrics, setMetrics] = useState<BrierMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadBrierMetrics();
  }, []);

  async function loadBrierMetrics() {
    try {
      // Try to get from Firebase first
      const scanData = await getData('v6/kalshi/latest_scan');
      if (scanData?.brier) {
        setMetrics(scanData.brier);
      }
    } catch (e) {
      console.log('Brier metrics not available:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-5 w-5 bg-gray-700 rounded" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!metrics || !metrics.enabled) {
    return null;
  }

  if (!metrics.hasData) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <h3 className="font-medium text-blue-400">Brier Score Tracking</h3>
        </div>
        <p className="text-sm text-gray-400">
          Collecting prediction data. Check back after markets resolve to see calibration metrics.
        </p>
      </div>
    );
  }

  const { overall, byCategory, trend, recommendations, last30Days, calibrationBuckets } = metrics;
  
  const qualityEmoji = overall?.brier < 0.15 ? '⭐⭐' : overall?.brier < 0.20 ? '⭐' : overall?.brier < 0.25 ? '✅' : '⚠️';
  const trendIcon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';

  const categoryEmojis: Record<string, string> = {
    weather: '🌤️',
    crypto: '🪙',
    politics: '🏛️',
    economics: '📊'
  };

  const getQualityColor = (brier: number) => {
    if (brier < 0.15) return 'text-emerald-400';
    if (brier < 0.20) return 'text-blue-400';
    if (brier < 0.25) return 'text-yellow-400';
    return 'text-rose-400';
  };

  const getQualityBg = (brier: number) => {
    if (brier < 0.15) return 'bg-emerald-500/10 border-emerald-500/30';
    if (brier < 0.20) return 'bg-blue-500/10 border-blue-500/30';
    if (brier < 0.25) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className={`rounded-xl border p-4 ${getQualityBg(overall?.brier || 0.5)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-white" />
          <h3 className="font-medium text-white">Brier Score Analysis</h3>
          <span className="text-lg">{qualityEmoji}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-gray-400 mb-1">Overall Brier</div>
          <div className={`text-xl font-bold ${getQualityColor(overall?.brier || 0.5)}`}>
            {overall?.brier?.toFixed(3) || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {trendIcon} {trend}
          </div>
        </div>

        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-gray-400 mb-1">MSEP</div>
          <div className="text-xl font-bold text-white">
            {overall?.msep?.toFixed(3) || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Model performance</div>
        </div>

        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-gray-400 mb-1">Resolved</div>
          <div className="text-xl font-bold text-white">
            {overall?.resolved || 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            of {overall?.total || 0} predictions
          </div>
        </div>

        <div className="rounded-lg bg-black/30 p-3">
          <div className="text-xs text-gray-400 mb-1">30-Day Avg</div>
          <div className={`text-xl font-bold ${getQualityColor(last30Days?.avgBrier || 0.5)}`}>
            {last30Days?.avgBrier?.toFixed(3) || 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {last30Days?.count || 0} trades
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <>
          {/* By Category */}
          {byCategory && Object.keys(byCategory).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">By Category</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(byCategory).map(([cat, data]) => (
                  <div
                    key={cat}
                    className="rounded-lg bg-black/20 p-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryEmojis[cat] || '📈'}</span>
                      <span className="text-sm capitalize text-gray-300">{cat}</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getQualityColor(data.avgBrier)}`}>
                        {data.avgBrier.toFixed(3)}
                      </div>
                      <div className="text-xs text-gray-500">{data.resolvedTrades} trades</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calibration Buckets */}
          {calibrationBuckets && calibrationBuckets.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Calibration</h4>
              <div className="space-y-1">
                {calibrationBuckets.slice(0, 5).map((bucket) => (
                  <div key={bucket.range} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-16">{bucket.range}</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${bucket.actualWinRate * 100}%` }}
                      />
                    </div>
                    <span className="text-white w-12 text-right">
                      {(bucket.actualWinRate * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-500">({bucket.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Recommendations</h4>
              <div className="space-y-1">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    {rec.includes('overconfident') ? (
                      <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                    ) : rec.includes('well-calibrated') || rec.includes('excellent') ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <Star className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    )}
                    <span className="text-gray-300">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-emerald-400">⭐⭐</span> < 0.15 Excellent
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-400">⭐</span> < 0.20 Good
        </span>
        <span className="flex items-center gap-1">
          <span className="text-yellow-400">✅</span> < 0.25 Fair
        </span>
        <span className="flex items-center gap-1">
          <span className="text-rose-400">⚠️</span> ≥ 0.25 Poor
        </span>
      </div>
    </div>
  );
}
