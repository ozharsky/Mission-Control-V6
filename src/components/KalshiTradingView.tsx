import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Wallet, Target, Activity, BarChart3, 
  Calendar, Clock, Filter, ArrowUpRight, ArrowDownRight, RefreshCw,
  DollarSign, Percent, Award, History, Zap, ChevronDown, ChevronUp,
  Plus, Minus, Trash2, AlertCircle, CloudRain, Zap as ZapIcon, Scale, Landmark, Trophy
} from 'lucide-react';
import { getData, setData } from '../lib/firebase';
import { RESEARCHED_TRADES } from './trades-data';

// Types
interface KalshiTrade {
  id: string;
  ticker: string;
  title: string;
  subtitle?: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  yesBid?: number;
  yesAsk?: number;
  volume: number;
  expiration: string;
  edge: number;
  rScore: number;
  kellyPct: number;
  recommendation: 'strong_buy' | 'buy' | 'buy_urgent' | 'hold' | 'avoid';
  strikePrice?: number;
  floor?: number;
  cap?: number;
  trueProbability?: number;
  multiplier?: number;
  timeAdjustment?: string;
  volumeBoost?: string;
  health?: 'good' | 'fair' | 'poor';
  spread?: string;
  liquidityScore?: number;
  // v2.2 fields
  whale?: boolean;
  whaleSpikeRatio?: string;
  momentum?: 'surging' | 'rising' | 'flat' | 'falling' | 'crashing';
  momentumChange24h?: string;
  edgeChange?: string;
  avgHistoricalEdge?: string;
  isEdgeDeteriorating?: boolean;
  // v2.4 fields
  compositeScore?: string;
  riskMetrics?: {
    expectedValue: string;
    stdDev: string;
    sharpeRatio: string;
    maxDrawdown: string;
    riskOfRuin: 'low' | 'medium' | 'high';
    positionPctOfBankroll: string;
  };
  alerts?: Array<{
    type: string;
    severity: 'info' | 'medium' | 'high' | 'urgent';
    message: string;
    ticker: string;
  }>;
  attribution?: Array<{
    factor: string;
    contribution: number;
    description: string;
  }>;
  // v2.5 fields - Polymarket
  polymarketArb?: {
    kalshiPrice: number;
    polymarketPrice: string;
    priceDiff: string;
    percentDiff: string;
    buyOn: string;
    sellOn: string;
    profitPotential: string;
    pmUrl: string;
  };
  // v2.6 fields - Alternative Data
  sentimentSignal?: {
    score: number;
    label: string;
    source: string;
    headline: string;
    timestamp: string;
  };
  nwsSignal?: {
    city: string;
    targetDate: string;
    targetTemp: number;
    isAbove: boolean;
    forecastHigh: number;
    forecastDay: string;
    nwsForecast: string;
    impliedProbability: string;
    kalshiProbability: string;
    probabilityDiff: string;
    lagDetected: boolean;
    recommendation: string;
  };
  // v3.0 fields - Multi-Factor Scoring
  multiFactorScore?: {
    total: number;
    breakdown: {
      edgeQuality: number;
      liquidityDepth: number;
      timeToExpiration: number;
      historicalAccuracy: number;
      newsSentiment: number;
    };
    weights: {
      edgeQuality: number;
      liquidityDepth: number;
      timeToExpiration: number;
      historicalAccuracy: number;
      newsSentiment: number;
    };
  };
  // v3.0 fields - Twitter/X Sentiment
  twitterSignal?: {
    score: number;
    confidence: number;
    signal: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    socialScore: number;
    source: 'twitter' | 'news' | 'none';
    matchedKeywords: string[];
    sampleData?: string[] | number;
  };
  // v3.0 fields - Edge Decay
  decayAnalysis?: {
    decayRate: number;
    trend: 'improving_fast' | 'improving' | 'stable' | 'decaying' | 'decaying_fast';
    edge24hAgo: number;
    edgeChange24h: number;
    decayRateWeek?: number;
    weekTrend?: 'strong_improvement' | 'strong_decay' | null;
    entriesCount: number;
  };
  stabilityScore?: number;
  // v3.0 fields - Heat Map
  riskMetrics?: {
    expectedValue: string;
    stdDev: string;
    sharpeRatio: string;
    maxDrawdown: string;
    riskOfRuin: 'low' | 'medium' | 'high';
    positionPctOfBankroll: string;
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
  grossPnl?: number;
  fees?: number;
  marketTitle?: string;
  currentPrice?: number; // Store last known price for P&L calc
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

// Heat Map Types
interface HeatMapAnalysis {
  timestamp: string;
  bankroll: number;
  totalExposure: number;
  concentration: Record<string, {
    exposure: number;
    percentage: number;
    riskLevel: {
      level: 'critical' | 'high' | 'medium' | 'low';
      color: string;
      emoji: string;
    };
  }>;
  correlationRisk: Array<{
    pair: string;
    category?: string;
    type?: 'hedge';
    correlation?: number;
    riskLevel?: 'high' | 'medium' | 'low';
    note?: string;
  }>;
  heatMap: Array<{
    ticker: string;
    title: string;
    category: string;
    exposure: number;
    percentageOfBankroll: number;
    riskScore: number;
    riskLevel: {
      level: string;
      color: string;
      emoji: string;
    };
    factors: {
      concentration: number;
      edge: number;
      quality: number;
    };
    edge?: string;
    rScore?: string;
    isDeteriorating?: boolean;
  }>;
  riskScore: number;
  warnings: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
  }>;
}

// Kelly Analysis Types
interface KellyAnalysis {
  timestamp: string;
  bankroll: number;
  baseKellyFraction: number;
  dynamicFraction: number;
  marketRegime: {
    regime: 'high_volatility' | 'trending' | 'decaying' | 'high_edge' | 'neutral';
    confidence: number;
    volatility?: number;
  };
  winRate: {
    winRate: number;
    sampleSize: number;
    totalPnL?: number;
  };
  portfolioVol: {
    volatility: number;
    sharpe: number;
    avgReturn?: number;
  };
  positionSizes: Array<{
    ticker: string;
    positionSize: number;
    fullKelly: number;
    adjustedKelly: number;
    fraction: number;
    winProb: number;
    maxPosition: number;
    regime: string;
    regimeConfidence: number;
  }>;
  recommendations: Array<{
    type: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    message: string;
  }>;
}

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

const HEALTH_COLORS: Record<string, string> = {
  good: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  fair: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  poor: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
};

// Liquidity bar component
function LiquidityBar({ score, spread }: { score?: number; spread?: string }) {
  if (!score && !spread) return null;
  
  const width = score ? `${Math.min(100, score)}%` : '50%';
  const color = score && score >= 70 ? 'bg-emerald-500' : score && score >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width }} />
      </div>
      <span className="text-xs text-gray-500">
        {score ? `${score}/100` : ''} {spread ? `· ${spread}¢` : ''}
      </span>
    </div>
  );
}

// Trade Detail Panel Component - Organized with tabs
function TradeDetailPanel({ 
  trade, 
  kellyAnalysis, 
  onBuy, 
  bankroll 
}: { 
  trade: KalshiTrade; 
  kellyAnalysis: KellyAnalysis | null;
  onBuy: (side: 'yes' | 'no', amount: number) => void;
  bankroll: number;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'risk' | 'signals' | 'sizing'>('overview');
  
  const kellyPosition = kellyAnalysis?.positionSizes.find(p => p.ticker === trade.ticker);
  
  return (
    <div className="mt-4 border-t border-surface-hover pt-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 border-b border-surface-hover">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'risk', label: 'Risk & Score', icon: Activity },
          { id: 'signals', label: 'Signals', icon: Zap },
          { id: 'sizing', label: 'Position Sizing', icon: DollarSign },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id 
                ? 'text-primary border-primary' 
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Core Metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Core Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-surface-hover/50 rounded p-2">
                  <span className="text-gray-500">True Probability</span>
                  <p className="text-white font-medium">{trade.trueProbability}%</p>
                </div>
                <div className="bg-surface-hover/50 rounded p-2">
                  <span className="text-gray-500">Market Price</span>
                  <p className="text-white font-medium">{trade.yesPrice}¢</p>
                </div>
                <div className="bg-surface-hover/50 rounded p-2">
                  <span className="text-gray-500">Edge</span>
                  <p className="text-success font-medium">+{trade.edge}¢</p>
                </div>
                <div className="bg-surface-hover/50 rounded p-2">
                  <span className="text-gray-500">R-Score</span>
                  <p className={`font-medium ${(trade.rScore || 0) >= 1.5 ? 'text-success' : 'text-primary'}`}>
                    {(trade.rScore || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              
              {trade.multiplier && (
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">Multiplier</span>
                  <span className="text-primary font-medium">{(trade.multiplier || 0).toFixed(1)}x</span>
                </div>
              )}
              
              {trade.health && (
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">Liquidity</span>
                  <span className={`font-medium ${
                    trade.health === 'good' ? 'text-success' : 
                    trade.health === 'fair' ? 'text-warning' : 'text-danger'
                  }`}>
                    {trade.health.toUpperCase()}
                  </span>
                </div>
              )}
              
              <div className="pt-2 border-t border-surface-hover">
                <p className="text-sm text-gray-400 mb-1">Research</p>
                <p className="text-sm text-white">{trade.research?.catalyst || 'Scanner-identified opportunity'}</p>
                
                {/* Fee/Spread Breakdown */}
                {(trade.grossEdge !== undefined || trade.spreadCost !== undefined || trade.estimatedFees !== undefined) && (
                  <div className="mt-3 p-2 bg-surface-hover/30 rounded text-xs">
                    <p className="text-gray-500 mb-1">Edge Breakdown:</p>
                    <div className="space-y-0.5">
                      {trade.grossEdge !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Gross Edge</span>
                          <span className="text-gray-300">+{trade.grossEdge.toFixed(1)}%</span>
                        </div>
                      )}
                      {trade.spreadCost && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Spread Cost</span>
                          <span className="text-danger">-{trade.spreadCost.toFixed(1)}%</span>
                        </div>
                      )}
                      {trade.estimatedFees && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Est. Fees ($100)</span>
                          <span className="text-danger">-${trade.estimatedFees.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-surface-hover">
                        <span className="text-gray-400 font-medium">Net Edge</span>
                        <span className="text-success font-medium">+{trade.edge}%</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-2 flex flex-wrap gap-1">
                  {trade.research?.sources?.map((source, i) => (
                    <span key={i} className="text-xs bg-surface-hover px-2 py-0.5 rounded text-gray-400">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Quick Stats</h4>
              
              {trade.momentum && trade.momentum !== 'flat' && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-500">Momentum</span>
                  <span className={`text-sm font-medium ${
                    trade.momentum === 'surging' ? 'text-emerald-400' :
                    trade.momentum === 'rising' ? 'text-green-400' :
                    trade.momentum === 'falling' ? 'text-amber-400' :
                    'text-rose-400'
                  }`}>
                    {trade.momentum === 'surging' ? '🚀' : 
                     trade.momentum === 'rising' ? '📈' : 
                     trade.momentum === 'falling' ? '📉' : '💥'} {trade.momentum}
                  </span>
                </div>
              )}
              
              {trade.whale && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-500">Whale Activity</span>
                  <span className="text-sm text-purple-400 font-medium">
                    🐋 {trade.whaleSpikeRatio}x spike
                  </span>
                </div>
              )}
              
              {trade.compositeScore && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-gray-500">Composite Score</span>
                  <span className="text-sm text-primary font-bold">{trade.compositeScore}</span>
                </div>
              )}
              
              <div className="pt-2 border-t border-surface-hover">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">Expires</span>
                  <span className="text-white">
                    {new Date(trade.expiration).toLocaleDateString('en-US', { 
                      weekday: 'short', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">Base Kelly</span>
                  <span className="text-white">{(trade.kellyPct || 0).toFixed(1)}%</span>
                </div>
              </div>
              
              {/* Buy Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onBuy('yes', Math.min(100, bankroll * 0.05))}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-success/20 px-3 py-2 text-sm font-medium text-success hover:bg-success/30"
                >
                  <Plus className="h-4 w-4" />
                  Buy Yes @{trade.yesPrice}¢
                </button>
                <button
                  onClick={() => onBuy('no', Math.min(100, bankroll * 0.05))}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-danger/20 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/30"
                >
                  <Plus className="h-4 w-4" />
                  Buy No @{trade.noPrice}¢
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RISK & SCORE TAB */}
        {activeTab === 'risk' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Multi-Factor Score */}
            {trade.multiFactorScore && trade.multiFactorScore.total !== undefined && (
              <div className="bg-surface-hover/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-400 mb-3">
                  Multi-Factor Score: <span className="text-primary">{(trade.multiFactorScore.total || 0).toFixed(2)}</span>
                </h4>
                <div className="space-y-2">
                  {Object.entries(trade.multiFactorScore.breakdown).map(([key, value]) => {
                    const weight = trade.multiFactorScore!.weights[key as keyof typeof trade.multiFactorScore.weights];
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">{label} ({Math.round(weight * 100)}%)</span>
                            <span className={value >= 7 ? 'text-success' : value >= 4 ? 'text-warning' : 'text-gray-400'}>
                              {(value || 0).toFixed(1)}/10
                            </span>
                          </div>
                          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                value >= 7 ? 'bg-emerald-500' : value >= 4 ? 'bg-amber-500' : 'bg-gray-500'
                              }`}
                              style={{ width: `${value * 10}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Risk Metrics */}
            {trade.riskMetrics && (
              <div className="bg-surface-hover/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Risk Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expected Value</span>
                    <span className={parseFloat(trade.riskMetrics.expectedValue) >= 0 ? 'text-success' : 'text-danger'}>
                      ${trade.riskMetrics.expectedValue}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sharpe Ratio</span>
                    <span className={parseFloat(trade.riskMetrics.sharpeRatio) >= 1 ? 'text-success' : 'text-gray-300'}>
                      {trade.riskMetrics.sharpeRatio}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risk Level</span>
                    <span className={
                      trade.riskMetrics.riskOfRuin === 'low' ? 'text-success' : 
                      trade.riskMetrics.riskOfRuin === 'medium' ? 'text-warning' : 'text-danger'
                    }>
                      {trade.riskMetrics.riskOfRuin.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max Drawdown</span>
                    <span className="text-gray-300">${trade.riskMetrics.maxDrawdown}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Edge Decay */}
            {trade.decayAnalysis && (
              <div className={`rounded-lg p-3 border ${
                trade.decayAnalysis.trend.includes('improving') ? 'bg-emerald-500/10 border-emerald-500/30' :
                trade.decayAnalysis.trend.includes('decaying') ? 'bg-rose-500/10 border-rose-500/30' :
                'bg-gray-500/10 border-gray-500/30'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  trade.decayAnalysis.trend.includes('improving') ? 'text-emerald-400' :
                  trade.decayAnalysis.trend.includes('decaying') ? 'text-rose-400' :
                  'text-gray-400'
                }`}>
                  Edge Trend: {trade.decayAnalysis.trend.replace('_', ' ').toUpperCase()}
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-surface-hover/50 rounded p-2 text-center">
                    <p className="text-gray-500">24h Change</p>
                    <p className={(trade.decayAnalysis.edgeChange24h || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(trade.decayAnalysis.edgeChange24h || 0) > 0 ? '+' : ''}{(trade.decayAnalysis.edgeChange24h || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-surface-hover/50 rounded p-2 text-center">
                    <p className="text-gray-500">Rate</p>
                    <p className={(trade.decayAnalysis.decayRate || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(trade.decayAnalysis.decayRate || 0) > 0 ? '+' : ''}{(trade.decayAnalysis.decayRate || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-surface-hover/50 rounded p-2 text-center">
                    <p className="text-gray-500">Stability</p>
                    <p className={trade.stabilityScore && trade.stabilityScore > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {trade.stabilityScore ? (trade.stabilityScore > 0 ? '+' : '') + trade.stabilityScore.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Attribution */}
            {trade.attribution && trade.attribution.length > 0 && (
              <div className="bg-surface-hover/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Score Attribution</h4>
                <div className="space-y-1">
                  {trade.attribution.slice(0, 4).map((attr, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-500">{attr.factor}</span>
                      <span className={(attr.contribution || 0) >= 0 ? 'text-success' : 'text-danger'}>
                        {(attr.contribution || 0) >= 0 ? '+' : ''}{(attr.contribution || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGNALS TAB */}
        {activeTab === 'signals' && (
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Alerts */}
            {trade.alerts && trade.alerts.length > 0 && (
              <div className="lg:col-span-2 space-y-2">
                <h4 className="text-sm font-medium text-gray-400">Active Alerts</h4>
                {trade.alerts.map((alert, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded text-sm flex items-center gap-2 ${
                      alert.severity === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      alert.severity === 'high' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                      'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    <span>{alert.severity === 'urgent' ? '🚨' : alert.severity === 'high' ? '⚠️' : 'ℹ️'}</span>
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Twitter Sentiment */}
            {trade.twitterSignal && trade.twitterSignal.signal !== 'neutral' && (
              <div className={`p-3 rounded-lg border ${
                trade.twitterSignal.signal === 'bullish' ? 'bg-emerald-500/10 border-emerald-500/30' :
                'bg-rose-500/10 border-rose-500/30'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  trade.twitterSignal.signal === 'bullish' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  🐦 Twitter: {trade.twitterSignal.signal.toUpperCase()}
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Strength</span>
                    <span className="text-white">{trade.twitterSignal.strength}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Score</span>
                    <span className={(trade.twitterSignal.score || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(trade.twitterSignal.score || 0) > 0 ? '+' : ''}{(trade.twitterSignal.score || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Confidence</span>
                    <span className="text-white">{Math.round(trade.twitterSignal.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Decay Analysis */}
            {trade.decayAnalysis && (
              <div className={`p-3 rounded-lg border ${
                trade.decayAnalysis.trend.includes('improving') ? 'bg-emerald-500/10 border-emerald-500/30' :
                trade.decayAnalysis.trend.includes('decaying') ? 'bg-rose-500/10 border-rose-500/30' :
                'bg-gray-500/10 border-gray-500/30'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  trade.decayAnalysis.trend.includes('improving') ? 'text-emerald-400' :
                  trade.decayAnalysis.trend.includes('decaying') ? 'text-rose-400' :
                  'text-gray-400'
                }`}>
                  📊 Edge Decay Analysis
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trend</span>
                    <span className={
                      trade.decayAnalysis.trend.includes('improving') ? 'text-emerald-400' :
                      trade.decayAnalysis.trend.includes('decaying') ? 'text-rose-400' :
                      'text-gray-300'
                    }>
                      {trade.decayAnalysis.trend.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">24h Change</span>
                    <span className={(trade.decayAnalysis.edgeChange24h || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(trade.decayAnalysis.edgeChange24h || 0) > 0 ? '+' : ''}{(trade.decayAnalysis.edgeChange24h || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Decay Rate</span>
                    <span className="text-white">{(trade.decayAnalysis.decayRate || 0).toFixed(2)}%/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stability</span>
                    <span className={
                      (trade.stabilityScore || 0) >= 7 ? 'text-emerald-400' :
                      (trade.stabilityScore || 0) >= 4 ? 'text-amber-400' :
                      'text-rose-400'
                    }>
                      {trade.stabilityScore?.toFixed(1) || 'N/A'}/10
                    </span>
                  </div>
                  {trade.decayAnalysis.weekTrend && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Week Trend</span>
                      <span className={
                        trade.decayAnalysis.weekTrend === 'strong_improvement' ? 'text-emerald-400' :
                        trade.decayAnalysis.weekTrend === 'strong_decay' ? 'text-rose-400' :
                        'text-gray-300'
                      }>
                        {trade.decayAnalysis.weekTrend.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>              </div>
            )}

            {/* News Sentiment */}
            {trade.sentimentSignal && (
              <div className={`p-3 rounded-lg border ${
                trade.sentimentSignal.label === 'positive' ? 'bg-emerald-500/10 border-emerald-500/30' :
                trade.sentimentSignal.label === 'negative' ? 'bg-rose-500/10 border-rose-500/30' :
                'bg-gray-500/10 border-gray-500/30'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  trade.sentimentSignal.label === 'positive' ? 'text-emerald-400' :
                  trade.sentimentSignal.label === 'negative' ? 'text-rose-400' :
                  'text-gray-400'
                }`}>
                  📰 News: {trade.sentimentSignal.label.toUpperCase()}
                </h4>
                <p className="text-xs text-gray-300 line-clamp-2 mb-2">"{trade.sentimentSignal.headline}"</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Source</span>
                  <span className="text-white">{trade.sentimentSignal.source}</span>
                </div>
              </div>
            )}

            {/* Weather Lag */}
            {trade.nwsSignal && trade.nwsSignal.lagDetected && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <h4 className="text-sm font-medium text-amber-400 mb-2">🌤️ Weather Lag</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">NWS Forecast</span>
                    <span className="text-white">{trade.nwsSignal.forecastHigh}°F</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Market Implied</span>
                    <span className="text-white">{trade.nwsSignal.kalshiProbability}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Edge</span>
                    <span className={parseFloat(trade.nwsSignal.probabilityDiff) > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {parseFloat(trade.nwsSignal.probabilityDiff) > 0 ? '+' : ''}{trade.nwsSignal.probabilityDiff}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Action</span>
                    <span className={trade.nwsSignal.recommendation === 'BUY_YES' ? 'text-emerald-400' : 'text-rose-400'}>
                      {trade.nwsSignal.recommendation.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Polymarket Arb */}
            {trade.polymarketArb && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <h4 className="text-sm font-medium text-emerald-400 mb-2">🔗 Polymarket Arbitrage</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Spread</span>
                    <span className="text-emerald-400">{trade.polymarketArb.percentDiff}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Buy On</span>
                    <span className="text-white">{trade.polymarketArb.buyOn}</span>
                  </div>
                  <a 
                    href={trade.polymarketArb.pmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-emerald-400 hover:text-emerald-300 text-xs"
                  >
                    View on Polymarket <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* No Signals Message */}
            {!trade.alerts?.length && 
             !trade.twitterSignal?.signal && 
             !trade.sentimentSignal && 
             !trade.nwsSignal?.lagDetected && 
             !trade.polymarketArb &&
             !trade.decayAnalysis && (
              <div className="p-6 rounded-lg bg-surface-hover/30 text-center">
                <p className="text-sm text-gray-400">🔍 No special signals detected for this trade</p>
                <p className="text-xs text-gray-500 mt-1">Scanner monitors: Twitter sentiment, news, weather lag, arbitrage, and edge decay</p>
              </div>
            )}
          </div>
        )}

        {/* POSITION SIZING TAB */}
        {activeTab === 'sizing' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Dynamic Kelly */}
            {kellyPosition ? (
              <div className="bg-surface-hover/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-primary mb-3">Dynamic Kelly Sizing</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Recommended Size</span>
                    <span className="text-2xl font-bold text-primary">${kellyPosition.positionSize.toLocaleString()}</span>
                  </div>
                  
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (kellyPosition.positionSize / kellyPosition.maxPosition) * 100)}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-surface-hover/50 rounded p-2">
                      <span className="text-gray-500 block">Kelly %</span>
                      <span className="text-white font-medium">{(kellyPosition.adjustedKelly * 100).toFixed(1)}%</span>
                    </div>
                    <div className="bg-surface-hover/50 rounded p-2">
                      <span className="text-gray-500 block">Win Probability</span>
                      <span className="text-white font-medium">{(kellyPosition.winProb * 100).toFixed(1)}%</span>
                    </div>
                    <div className="bg-surface-hover/50 rounded p-2">
                      <span className="text-gray-500 block">Fraction Used</span>
                      <span className={kellyPosition.fraction >= 0.8 ? 'text-emerald-400' : kellyPosition.fraction >= 0.5 ? 'text-amber-400' : 'text-rose-400'}>
                        {(kellyPosition.fraction * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-surface-hover/50 rounded p-2">
                      <span className="text-gray-500 block">Market Regime</span>
                      <span className="text-white capitalize">{kellyPosition.regime.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-hover/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Dynamic Kelly Sizing</h4>
                <p className="text-sm text-gray-500">No position sizing data available for this trade.</p>
              </div>
            )}

            {/* Position Guidelines */}
            <div className="bg-surface-hover/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Position Guidelines</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-surface-hover">
                  <span className="text-gray-500">Base Kelly %</span>
                  <span className="text-white">{trade.kellyPct.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-hover">
                  <span className="text-gray-500">Max Position</span>
                  <span className="text-white">${(bankroll * 0.1).toLocaleString()} (10%)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-hover">
                  <span className="text-gray-500">Suggested Min</span>
                  <span className="text-white">$10</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Available Bankroll</span>
                  <span className="text-white">${bankroll.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onBuy('yes', kellyPosition?.positionSize || Math.min(100, bankroll * 0.05))}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-success/20 px-3 py-2 text-sm font-medium text-success hover:bg-success/30"
                >
                  <Plus className="h-4 w-4" />
                  Buy Yes
                </button>
                <button
                  onClick={() => onBuy('no', kellyPosition?.positionSize || Math.min(100, bankroll * 0.05))}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-danger/20 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/30"
                >
                  <Plus className="h-4 w-4" />
                  Buy No
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Kalshi Link */}
      <div className="mt-4 pt-3 border-t border-surface-hover">
        <a
          href={`https://kalshi.com/events/${trade.ticker.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          View on Kalshi <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

// Transform RESEARCHED_TRADES to KalshiTrade format
function transformResearchedTrades(): KalshiTrade[] {
  return RESEARCHED_TRADES.map((trade: any) => {
    // Calculate R-Score from edge
    const edge = trade.research?.edge || 0;
    const rScore = edge > 0 ? Math.max(1, edge / 10 + 1) : 0;
    
    // Determine recommendation based on R-Score
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'avoid' = 'avoid';
    if (rScore >= 2.0) recommendation = 'strong_buy';
    else if (rScore >= 1.5) recommendation = 'buy';
    else if (rScore >= 1.0) recommendation = 'hold';
    
    // Calculate Kelly percentage (half-Kelly for safety)
    const kellyPct = edge > 0 ? Math.min(10, edge / 2) : 0;
    
    // Parse title for range info
    let floor: number | undefined;
    let cap: number | undefined;
    
    // Check for temperature ranges in title (e.g., "<48°F", ">54°F", "43-44°F")
    const tempRangeMatch = trade.title.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/);
    const tempLessMatch = trade.title.match(/<(\d+)[°\s]*F/);
    const tempGreaterMatch = trade.title.match(/>(\d+)[°\s]*F/);
    
    if (tempRangeMatch) {
      floor = parseInt(tempRangeMatch[1], 10);
      cap = parseInt(tempRangeMatch[2], 10);
    } else if (tempLessMatch) {
      floor = -100; // Effectively no lower bound
      cap = parseInt(tempLessMatch[1], 10);
    } else if (tempGreaterMatch) {
      floor = parseInt(tempGreaterMatch[1], 10);
      cap = 150; // Effectively no upper bound
    }
    
    // Check for price ranges (e.g., "$85k-$90k", ">$50k")
    const priceRangeMatch = trade.title.match(/\$?(\d+)[kK]?[\s-]+\$?(\d+)[kK]?/);
    if (priceRangeMatch && !floor) {
      floor = parseInt(priceRangeMatch[1], 10) * (trade.title.includes('k') || trade.title.includes('K') ? 1000 : 1);
      cap = parseInt(priceRangeMatch[2], 10) * (trade.title.includes('k') || trade.title.includes('K') ? 1000 : 1);
    }
    
    // Check for post count ranges
    const postsMatch = trade.title.match(/(\d+)[\s-]+(\d+)\s*posts/i);
    if (postsMatch && !floor) {
      floor = parseInt(postsMatch[1], 10);
      cap = parseInt(postsMatch[2], 10);
    }
    
    return {
      id: trade.id,
      ticker: trade.ticker,
      title: trade.title,
      category: trade.category,
      yesPrice: trade.yesPrice,
      noPrice: trade.noPrice,
      volume: trade.volume,
      expiration: trade.expiration,
      edge: edge,
      rScore: Math.round(rScore * 10) / 10,
      kellyPct: kellyPct,
      recommendation: recommendation,
      floor,
      cap,
      trueProbability: trade.research?.trueProbability,
      multiplier: trade.payout?.multiplier,
      research: {
        catalyst: trade.research?.catalyst || '',
        confidence: trade.research?.confidence || 'medium',
        sources: trade.research?.sources || []
      }
    };
  }).filter(t => t.edge > 0); // Only show +EV trades
}

// Transform scanner output to KalshiTrade format
function transformScannerOutput(scannerData: any): KalshiTrade[] {
  if (!scannerData?.opportunities || !Array.isArray(scannerData.opportunities)) {
    return [];
  }
  
  return scannerData.opportunities.map((opp: any) => {
    // Edge is now a number from scanner (was string in v2.5)
    const edge = typeof opp.edge === 'number' ? opp.edge : parseFloat(opp.edge?.replace('%', '') || '0');
    const rScore = typeof opp.rScore === 'number' ? opp.rScore : parseFloat(opp.rScore || '0');
    
    // Determine recommendation (fallback if not provided by scanner)
    let recommendation: 'strong_buy' | 'buy' | 'buy_urgent' | 'hold' | 'avoid' = opp.recommendation || 'avoid';
    if (!recommendation || recommendation === 'avoid') {
      if (rScore >= 2.0) recommendation = 'strong_buy';
      else if (rScore >= 1.5) recommendation = 'buy';
      else if (rScore >= 1.0) recommendation = 'hold';
    }
    
    // Use scanner's Kelly % if available, otherwise calculate
    const kellyPct = opp.kellyPct || (edge > 0 ? Math.min(10, edge / 2) : 0);
    
    // Parse floor/cap from title or subtitle
    let floor: number | undefined;
    let cap: number | undefined;
    const title = opp.title || '';
    const subtitle = opp.subtitle || '';
    
    // Try to extract range from title/subtitle
    const tempRangeMatch = title.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/) || subtitle.match(/(\d+)[°\s]*-\s*(\d+)[°\s]*F/);
    const tempLessMatch = title.match(/<(\d+)[°\s]*F/) || subtitle.match(/<(\d+)[°\s]*F/);
    const tempGreaterMatch = title.match(/>(\d+)[°\s]*F/) || subtitle.match(/>(\d+)[°\s]*F/);
    
    if (tempRangeMatch) {
      floor = parseInt(tempRangeMatch[1], 10);
      cap = parseInt(tempRangeMatch[2], 10);
    } else if (tempLessMatch) {
      floor = -100;
      cap = parseInt(tempLessMatch[1], 10);
    } else if (tempGreaterMatch) {
      floor = parseInt(tempGreaterMatch[1], 10);
      cap = 150;
    }
    
    return {
      id: opp.ticker || `opp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ticker: opp.ticker,
      title: opp.title,
      subtitle: opp.subtitle,
      category: opp.category || 'unknown',
      yesPrice: opp.yesPrice || opp.price,
      noPrice: opp.noPrice || (100 - (opp.yesPrice || opp.price || 50)),
      volume: opp.volume || 0,
      expiration: opp.closeTime || opp.expiration,
      edge,
      rScore: Math.round(rScore * 10) / 10,
      kellyPct,
      recommendation: opp.recommendation || recommendation,
      floor,
      cap,
      trueProbability: opp.trueProbability,
      multiplier: opp.multiplier,
      // v2.2 fields
      whale: opp.whale,
      whaleSpikeRatio: opp.whaleSpikeRatio,
      momentum: opp.momentum,
      momentumChange24h: opp.momentumChange24h,
      edgeChange: opp.edgeChange,
      avgHistoricalEdge: opp.avgHistoricalEdge,
      isEdgeDeteriorating: opp.isEdgeDeteriorating,
      // v2.3 fields
      compositeScore: opp.compositeScore,
      health: opp.health,
      spread: opp.spread,
      liquidityScore: opp.liquidityScore,
      timeAdjustment: opp.timeAdjustment,
      volumeBoost: opp.volumeBoost,
      // v2.4 fields
      riskMetrics: opp.riskMetrics,
      alerts: opp.alerts,
      attribution: opp.attribution,
      research: {
        catalyst: opp.catalyst || subtitle || 'Scanner-identified opportunity',
        confidence: opp.confidence || 'medium',
        sources: opp.sources || ['Kalshi API']
      },
      // v2.5 fields
      polymarketArb: opp.polymarketArb,
      // v2.6 fields
      sentimentSignal: opp.sentimentSignal,
      nwsSignal: opp.nwsSignal,
      // v3.0 fields
      multiFactorScore: opp.multiFactorScore,
      twitterSignal: opp.twitterSignal,
      decayAnalysis: opp.decayAnalysis,
      stabilityScore: opp.stabilityScore
    };
  }); // Removed edge > 0 filter since scanner already filters
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  weather: CloudRain,
  crypto: ZapIcon,
  politics: Scale,
  economics: Landmark,
  sports: Trophy,
  all: Filter
};

const CATEGORY_LABELS: Record<string, string> = {
  weather: 'Weather',
  crypto: 'Crypto',
  politics: 'Politics',
  economics: 'Economics',
  sports: 'Sports',
  all: 'All'
};

export function KalshiTradingView() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'portfolio' | 'history' | 'heatmap'>('opportunities');
  const [trades, setTrades] = useState<KalshiTrade[]>([]); // Start empty, load from scanner
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
  const [sortBy, setSortBy] = useState<'composite' | 'edge' | 'rScore' | 'volume'>('composite');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [scanSummary, setScanSummary] = useState<any>(null);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [heatMap, setHeatMap] = useState<HeatMapAnalysis | null>(null);
  const [kellyAnalysis, setKellyAnalysis] = useState<KellyAnalysis | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Advanced filters
  const [minEdge, setMinEdge] = useState<number>(0);
  const [maxEdge, setMaxEdge] = useState<number>(100);
  const [minRScore, setMinRScore] = useState<number>(0);
  const [hasAlert, setHasAlert] = useState<'any' | 'urgent' | 'high' | 'none'>('any');
  const [sentimentFilter, setSentimentFilter] = useState<'any' | 'bullish' | 'bearish' | 'neutral'>('any');
  const [showOnlyWhales, setShowOnlyWhales] = useState(false);
  const [showOnlyWeatherLag, setShowOnlyWeatherLag] = useState(false);
  const [showOnlyArbitrage, setShowOnlyArbitrage] = useState(false);
  const [positionHistory, setPositionHistory] = useState<PaperPosition[]>([]);
  const hasLoadedScanner = useRef(false);

  // Load positions and stats from Firebase on mount
  useEffect(() => {
    const loadFromFirebase = async () => {
      try {
        console.log('Loading Kalshi data from Firebase...');
        const savedPositions = await getData('v6/kalshi/positions');
        const savedStats = await getData('v6/kalshi/portfolio');
        
        console.log('Loaded positions:', savedPositions);
        console.log('Loaded stats:', savedStats);
        
        if (savedPositions && Array.isArray(savedPositions) && savedPositions.length > 0) {
          console.log(`Restoring ${savedPositions.length} positions`);
          setPositions(savedPositions);
        } else {
          console.log('No saved positions found');
        }
        
        if (savedStats && typeof savedStats === 'object') {
          console.log('Restoring portfolio stats');
          setStats(prev => ({
            ...prev,
            ...savedStats,
            // Ensure these are calculated fresh
            openPositions: savedPositions?.filter((p: PaperPosition) => p.status === 'open').length || 0
          }));
        }
      } catch (e) {
        console.error('Failed to load from Firebase:', e);
      }
      setIsDataLoaded(true);
    };
    
    loadFromFirebase();
  }, []);

  // Load scanner data - MAIN SOURCE
  useEffect(() => {
    if (hasLoadedScanner.current) return;
    hasLoadedScanner.current = true;
    
    const loadScannerData = async () => {
      setIsLoadingTrades(true);
      try {
        console.log('=== LOADING KALSHI DATA ===');
        
        // 1. Load base data from Firebase (scanner writes here)
        const scannerOutput = await getData('v6/kalshi/latest_scan');
        
        if (scannerOutput?.opportunities && Array.isArray(scannerOutput.opportunities) && scannerOutput.opportunities.length > 0) {
          console.log(`Base data: ${scannerOutput.opportunities.length} opportunities from scanner`);
          let transformed = transformScannerOutput(scannerOutput);
          
          // 2. Fetch live prices to update
          console.log('Fetching live price updates...');
          const updatedTrades = await updateWithLivePrices(transformed);
          
          setTrades(updatedTrades);
          setLastUpdated(new Date());
          setScanSummary(scannerOutput.summary);
          
          // Load heat map data if available
          if (scannerOutput.heatMap) {
            setHeatMap(scannerOutput.heatMap);
          }
          
          // Load Kelly analysis if available
          if (scannerOutput.kellyAnalysis) {
            setKellyAnalysis(scannerOutput.kellyAnalysis);
          }
          
          console.log(`✅ Displaying ${updatedTrades.length} trades with live prices`);
        } else {
          console.log('No scanner data - using fallback');
          setTrades(transformResearchedTrades());
        }
      } catch (e) {
        console.error('Failed:', e);
        setTrades(transformResearchedTrades());
      } finally {
        setIsLoadingTrades(false);
      }
    };
    
    loadScannerData();
  }, []);
  
  // Update trades with live prices from Kalshi API
  const updateWithLivePrices = async (trades: KalshiTrade[]): Promise<KalshiTrade[]> => {
    const KALSHI_PROXY_URL = 'https://mission-control-v6-kappa.vercel.app/api/kalshi';
    const updated = [...trades];
    
    // Get unique series from trades
    const seriesSet = new Set(trades.map(t => t.ticker.split('-')[0]));
    const livePrices = new Map<string, { yes: number; no: number; volume: number }>();
    
    // Fetch live data for each series
    for (const series of seriesSet) {
      try {
        const res = await fetch(`${KALSHI_PROXY_URL}?action=series&series=${series}`);
        if (res.ok) {
          const data = await res.json();
          if (data.markets) {
            for (const m of data.markets) {
              livePrices.set(m.ticker, {
                yes: m.yes_ask || m.yes_price || 50,
                no: m.no_ask || (100 - (m.yes_ask || m.yes_price || 50)),
                volume: m.volume || 0
              });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to fetch ${series}:`, e);
      }
    }
    
    // Update trades with live prices
    for (let i = 0; i < updated.length; i++) {
      const live = livePrices.get(updated[i].ticker);
      if (live) {
        updated[i] = {
          ...updated[i],
          yesPrice: live.yes,
          noPrice: live.no,
          volume: live.volume
        };
      }
    }
    
    return updated;
  };

  // Save positions to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      console.log(`Saving ${positions.length} positions to Firebase...`);
      setData('v6/kalshi/positions', positions)
        .then(() => console.log('✅ Positions saved'))
        .catch(err => console.error('❌ Failed to save positions:', err));
    }
  }, [positions, isDataLoaded]);

  // Save stats to Firebase when they change
  useEffect(() => {
    if (isDataLoaded) {
      console.log('Saving stats to Firebase...');
      setData('v6/kalshi/portfolio', stats)
        .then(() => console.log('✅ Stats saved'))
        .catch(err => console.error('❌ Failed to save stats:', err));
    }
  }, [stats, isDataLoaded]);

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
                const noPrice = m.no_ask || m.no_bid || (100 - yesPrice);
                
                // Extract strike price or range from subtitle or title
                const subtitle = m.subtitle || m.event_title || '';
                const title = m.title || '';
                
                // Try to extract range info from subtitle or parse ticker
                let floor: number | undefined;
                let cap: number | undefined;
                let strikePrice: number | undefined;
                
                // Parse ticker for range info (e.g., KXBTC-85000-90000)
                const tickerParts = m.ticker?.split('-');
                if (tickerParts && tickerParts.length >= 3) {
                  floor = parseInt(tickerParts[tickerParts.length - 2], 10);
                  cap = parseInt(tickerParts[tickerParts.length - 1], 10);
                }
                
                // Also check subtitle for range patterns like "$85,000 - $90,000" or "43° - 44°"
                const rangeMatch = subtitle.match(/\$?([\d,]+).{0,3}\$?([\d,]+)/) || 
                                   subtitle.match(/(\d+)[°\s].{0,3}(\d+)[°\s]/);
                if (rangeMatch) {
                  floor = parseInt(rangeMatch[1].replace(/,/g, ''), 10);
                  cap = parseInt(rangeMatch[2].replace(/,/g, ''), 10);
                }
                
                // Calculate edge based on price vs probability
                // For now use mock - would be replaced with actual research data
                const edge = Math.random() * 20 - 5;
                const rScore = edge > 0 ? 1 + (edge / 10) : 0;
                
                return {
                  id: m.ticker,
                  ticker: m.ticker,
                  title: title,
                  subtitle: subtitle,
                  category,
                  yesPrice,
                  noPrice,
                  volume: m.volume || 0,
                  expiration: m.close_date || m.expiration_date,
                  edge: Math.round(edge),
                  rScore: Math.round(rScore * 10) / 10,
                  kellyPct: Math.max(1, Math.min(10, edge / 2)),
                  recommendation: edge > 10 ? 'strong_buy' : edge > 5 ? 'buy' : edge > 0 ? 'hold' : 'avoid',
                  strikePrice,
                  floor,
                  cap,
                  research: { catalyst: subtitle || 'Live market data', confidence: 'medium', sources: [] }
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

  // Filter and sort trades with advanced filters
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }
    
    // Edge range filter
    result = result.filter(t => t.edge >= minEdge && t.edge <= maxEdge);
    
    // R-Score minimum filter
    result = result.filter(t => t.rScore >= minRScore);
    
    // Alert severity filter
    if (hasAlert !== 'any') {
      if (hasAlert === 'none') {
        result = result.filter(t => !t.alerts || t.alerts.length === 0);
      } else {
        result = result.filter(t => 
          t.alerts?.some(a => a.severity === hasAlert)
        );
      }
    }
    
    // Sentiment filter
    if (sentimentFilter !== 'any') {
      result = result.filter(t => {
        if (sentimentFilter === 'bullish') {
          return t.twitterSignal?.signal === 'bullish' || t.sentimentSignal?.label === 'positive';
        }
        if (sentimentFilter === 'bearish') {
          return t.twitterSignal?.signal === 'bearish' || t.sentimentSignal?.label === 'negative';
        }
        if (sentimentFilter === 'neutral') {
          return !t.twitterSignal && !t.sentimentSignal;
        }
        return true;
      });
    }
    
    // Whale activity filter
    if (showOnlyWhales) {
      result = result.filter(t => t.whale === true);
    }
    
    // Weather lag filter
    if (showOnlyWeatherLag) {
      result = result.filter(t => t.nwsSignal?.lagDetected === true);
    }
    
    // Arbitrage filter
    if (showOnlyArbitrage) {
      result = result.filter(t => !!t.polymarketArb);
    }
    
    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'composite') {
        const aScore = parseFloat(a.compositeScore || '0');
        const bScore = parseFloat(b.compositeScore || '0');
        return bScore - aScore;
      }
      if (sortBy === 'edge') return b.edge - a.edge;
      if (sortBy === 'rScore') return b.rScore - a.rScore;
      if (sortBy === 'volume') return b.volume - a.volume;
      return 0;
    });
    
    return result;
  }, [trades, selectedCategory, sortBy, minEdge, maxEdge, minRScore, hasAlert, sentimentFilter, showOnlyWhales, showOnlyWeatherLag, showOnlyArbitrage]);

  // Calculate position P&L - uses live prices from trades or stored current price
  const calculatePositionPnL = (position: PaperPosition) => {
    if (position.status !== 'open') return position.pnl || 0;
    
    // Find current market data in trades
    const currentTrade = trades.find(t => t.ticker === position.ticker);
    
    let currentPrice: number;
    
    if (currentTrade) {
      // Use live price from trades
      currentPrice = position.side === 'yes' ? currentTrade.yesPrice : currentTrade.noPrice;
    } else if (position.currentPrice) {
      // Use stored current price from last update
      currentPrice = position.currentPrice;
      console.log(`Using stored price for ${position.ticker}: ${currentPrice}¢`);
    } else {
      // No price data available - P&L is 0 (price hasn't changed from entry)
      console.log(`No price data for ${position.ticker}, assuming entry price`);
      return 0;
    }
    
    const priceDiff = (currentPrice - position.entryPrice) / 100;
    const pnl = priceDiff * position.shares;
    
    console.log(`P&L for ${position.ticker}: entry=${position.entryPrice}¢, current=${currentPrice}¢, shares=${position.shares}, pnl=$${pnl.toFixed(2)}`);
    
    return pnl;
  };

  // Execute paper trade
  const executeTrade = (trade: KalshiTrade, side: 'yes' | 'no', amount: number) => {
    console.log(`Executing trade: ${trade.ticker} ${side} $${amount}`);
    const price = side === 'yes' ? trade.yesPrice : trade.noPrice;
    const priceDollars = price / 100;
    const shares = Math.floor(amount / priceDollars);
    const value = shares * priceDollars;

    console.log(`Price: ${price}¢, Shares: ${shares}, Value: $${value.toFixed(2)}`);

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

    console.log('New position:', newPosition);

    setPositions(prev => {
      const updated = [...prev, newPosition];
      console.log(`Positions updated: ${updated.length} total`);
      return updated;
    });
    
    setStats(prev => {
      const newStats = {
        ...prev,
        bankroll: prev.bankroll - value,
        openPositions: prev.openPositions + 1
      };
      console.log(`Stats updated: bankroll $${newStats.bankroll.toFixed(2)}, openPositions ${newStats.openPositions}`);
      return newStats;
    });
  };

  // Close position with 7% fee on winning trades (matching kalshi_paper_trading.js)
  const closePosition = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const grossPnl = calculatePositionPnL(position);
    
    // Apply 7% fee on winning trades (matching your kalshi_paper_trading.js config)
    const FEE_RATE = 0.07;
    const fees = grossPnl > 0 ? grossPnl * FEE_RATE : 0;
    const netPnl = grossPnl - fees;
    
    const exitValue = position.value + netPnl;

    setPositions(prev => prev.map(p => 
      p.id === positionId 
        ? { ...p, status: 'closed', pnl: netPnl, grossPnl, fees }
        : p
    ));

    setStats(prev => ({
      ...prev,
      bankroll: prev.bankroll + exitValue,
      totalPnl: prev.totalPnl + netPnl,
      totalTrades: prev.totalTrades + 1,
      winningTrades: netPnl > 0 ? prev.winningTrades + 1 : prev.winningTrades,
      losingTrades: netPnl <= 0 ? prev.losingTrades + 1 : prev.losingTrades,
      winRate: ((netPnl > 0 ? prev.winningTrades + 1 : prev.winningTrades) / (prev.totalTrades + 1)) * 100,
      roi: ((prev.totalPnl + netPnl) / prev.initialBankroll) * 100,
      openPositions: prev.openPositions - 1
    }));

    // Show fee notification if fees were applied
    if (fees > 0) {
      console.log(`Position closed: ${position.ticker} | Gross P&L: +$${grossPnl.toFixed(2)} | Fees (7%): -$${fees.toFixed(2)} | Net P&L: +$${netPnl.toFixed(2)}`);
    }
  };

  // Memoize open positions with calculated P&L so it updates when trades change
  const openPositionsWithPnL = useMemo(() => {
    return positions
      .filter(p => p.status === 'open')
      .map(p => {
        // Find current price from trades
        const currentTrade = trades.find(t => t.ticker === p.ticker);
        const currentPrice = currentTrade 
          ? (p.side === 'yes' ? currentTrade.yesPrice : currentTrade.noPrice)
          : p.currentPrice; // Fallback to stored price
        
        // Calculate P&L
        const priceForCalc = currentPrice || p.entryPrice; // Use entry price if no current price
        const priceDiff = (priceForCalc - p.entryPrice) / 100;
        const pnl = priceDiff * p.shares;
        
        return { 
          ...p, 
          pnl, 
          pnlPct: (pnl / p.value) * 100,
          currentPrice: priceForCalc // Store current price for next calc
        };
      })
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)); // Sort by biggest P&L first
  }, [positions, trades]); // Recalculate when either changes

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
            onClick={() => setActiveTab('heatmap')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'heatmap' ? 'bg-primary text-white' : 'bg-surface text-gray-300 hover:bg-surface-hover'
            }`}
          >
            Risk Heat Map
          </button>
          <button
            onClick={async () => {
              setIsLoading(true);
              const updated = await updateWithLivePrices(trades);
              setTrades(updated);
              
              // Also update positions with current prices
              setPositions(prev => prev.map(p => {
                if (p.status !== 'open') return p;
                const trade = updated.find(t => t.ticker === p.ticker);
                if (trade) {
                  const currentPrice = p.side === 'yes' ? trade.yesPrice : trade.noPrice;
                  return { ...p, currentPrice };
                }
                return p;
              }));
              
              setLastUpdated(new Date());
              setIsLoading(false);
            }}
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
          {/* Scan Summary */}
          {scanSummary && (
            <div className="rounded-xl border border-surface-hover bg-surface p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span className="text-sm text-gray-400">Markets Analyzed:</span>
                  <span className="font-bold text-white">{scanSummary.analyzed || scanSummary.totalMarkets}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-success" />
                  <span className="text-sm text-gray-400">Opportunities:</span>
                  <span className="font-bold text-success">{scanSummary.opportunities}</span>
                </div>
                {scanSummary.whaleAlerts > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🐋</span>
                    <span className="text-sm text-gray-400">Whales:</span>
                    <span className="font-bold text-purple-400">{scanSummary.whaleAlerts}</span>
                  </div>
                )}
                {scanSummary.polymarketArbs > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    <span className="text-sm text-gray-400">Polymarket:</span>
                    <span className="font-bold text-emerald-400">{scanSummary.polymarketArbs}</span>
                  </div>
                )}
                {scanSummary.totalAlerts > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚨</span>
                    <span className="text-sm text-gray-400">Alerts:</span>
                    <span className="font-bold text-rose-400">{scanSummary.totalAlerts}</span>
                  </div>
                )}
                {scanSummary.correlations > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    <span className="text-sm text-gray-400">Correlations:</span>
                    <span className="font-bold text-blue-400">{scanSummary.correlations}</span>
                  </div>
                )}
                {scanSummary.byCategory && Object.entries(scanSummary.byCategory).map(([cat, count]) => (
                  count > 0 && (
                    <div key={cat} className="flex items-center gap-1 text-xs">
                      <span className="capitalize text-gray-500">{cat}:</span>
                      <span className="text-white">{count as number}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoadingTrades && (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-gray-400">Loading opportunities from scanner...</p>
            </div>
          )}

          {!isLoadingTrades && (
            <>
              {/* Category Buttons */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'weather', 'crypto', 'politics', 'economics'] as const).map((cat) => {
                  const Icon = CATEGORY_ICONS[cat];
                  const count = cat === 'all' 
                    ? filteredTrades.length 
                    : filteredTrades.filter(t => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        selectedCategory === cat 
                          ? 'bg-primary text-white' 
                          : 'bg-surface text-gray-300 hover:bg-surface-hover'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{CATEGORY_LABELS[cat]}</span>
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${
                        selectedCategory === cat ? 'bg-white/20' : 'bg-surface-hover'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm text-white"
                >
                  <option value="composite">Composite Score</option>
                  <option value="rScore">R-Score</option>
                  <option value="edge">Edge</option>
                  <option value="volume">Volume</option>
                </select>
                <span className="ml-auto text-sm text-gray-500">
                  Showing <span className="font-medium text-white">{filteredTrades.length}</span> trades
                  {scanSummary?.opportunities && (
                    <span className="text-gray-400"> (scanner found {scanSummary.opportunities})</span>
                  )}
                </span>
              </div>
            </>
          )}

          {/* Advanced Filters */}
          {!isLoadingTrades && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                  {(minEdge > 0 || maxEdge < 100 || minRScore > 0 || hasAlert !== 'any' || sentimentFilter !== 'any' || showOnlyWhales || showOnlyWeatherLag || showOnlyArbitrage) && (
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">Active</span>
                  )}
                </button>
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="rounded-xl border border-surface-hover bg-surface p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Min Edge %</label>
                      <input
                        type="number"
                        value={minEdge}
                        onChange={(e) => setMinEdge(Number(e.target.value))}
                        className="w-full bg-surface-hover border border-surface-hover rounded px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Max Edge %</label>
                      <input
                        type="number"
                        value={maxEdge}
                        onChange={(e) => setMaxEdge(Number(e.target.value))}
                        className="w-full bg-surface-hover border border-surface-hover rounded px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Min R-Score</label>
                      <input
                        type="number"
                        step="0.1"
                        value={minRScore}
                        onChange={(e) => setMinRScore(Number(e.target.value))}
                        className="w-full bg-surface-hover border border-surface-hover rounded px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Alerts</label>
                      <select
                        value={hasAlert}
                        onChange={(e) => setHasAlert(e.target.value as any)}
                        className="w-full bg-surface-hover border border-surface-hover rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="any">Any</option>
                        <option value="urgent">🚨 Urgent</option>
                        <option value="high">⚠️ High</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Sentiment</label>
                      <select
                        value={sentimentFilter}
                        onChange={(e) => setSentimentFilter(e.target.value as any)}
                        className="w-full bg-surface-hover border border-surface-hover rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="any">Any</option>
                        <option value="bullish">📈 Bullish</option>
                        <option value="bearish">📉 Bearish</option>
                        <option value="neutral">➡️ Neutral/None</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowOnlyWhales(!showOnlyWhales)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        showOnlyWhales 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                          : 'bg-surface-hover text-gray-400 hover:text-white'
                      }`}
                    >
                      🐋 Whale Activity
                    </button>
                    <button
                      onClick={() => setShowOnlyWeatherLag(!showOnlyWeatherLag)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        showOnlyWeatherLag 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                          : 'bg-surface-hover text-gray-400 hover:text-white'
                      }`}
                    >
                      🌤️ Weather Lag
                    </button>
                    <button
                      onClick={() => setShowOnlyArbitrage(!showOnlyArbitrage)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        showOnlyArbitrage 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-surface-hover text-gray-400 hover:text-white'
                      }`}
                    >
                      🔗 Polymarket Arb
                    </button>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-surface-hover">
                    <button
                      onClick={() => {
                        setMinEdge(0);
                        setMaxEdge(100);
                        setMinRScore(0);
                        setHasAlert('any');
                        setSentimentFilter('any');
                        setShowOnlyWhales(false);
                        setShowOnlyWeatherLag(false);
                        setShowOnlyArbitrage(false);
                      }}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trade Cards - Only show when not loading */}
          {!isLoadingTrades && (
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
                        {trade.recommendation === 'buy_urgent' ? '🔥 BUY URGENT' : trade.recommendation.replace('_', ' ').toUpperCase()}
                      </span>
                      {trade.health && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_COLORS[trade.health] || 'bg-gray-500/20 text-gray-400'}`}>
                          {trade.health}
                        </span>
                      )}
                      {trade.whale && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          🐋 {trade.whaleSpikeRatio}x whale
                        </span>
                      )}
                      {trade.momentum && trade.momentum !== 'flat' && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          trade.momentum === 'surging' ? 'bg-emerald-500/20 text-emerald-400' :
                          trade.momentum === 'rising' ? 'bg-green-500/20 text-green-400' :
                          trade.momentum === 'falling' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {trade.momentum === 'surging' ? '🚀' : trade.momentum === 'rising' ? '📈' : trade.momentum === 'falling' ? '📉' : '💥'} {trade.momentumChange24h}%
                        </span>
                      )}
                      {trade.alerts?.map((alert, idx) => (
                        <span 
                          key={idx}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            alert.severity === 'urgent' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' :
                            alert.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {alert.severity === 'urgent' ? '🚨' : alert.severity === 'high' ? '⚠️' : 'ℹ️'} {alert.type}
                        </span>
                      ))}
                    </div>
                    <h3 className="mt-2 truncate text-lg font-semibold text-white">{trade.title}</h3>
                    
                    {/* Show range/subtitle prominently */}
                    <div className="mt-1 flex items-center gap-2">
                      {trade.floor !== undefined && trade.cap !== undefined ? (
                        <span className="rounded bg-surface-hover px-2 py-1 text-sm font-medium text-primary">
                          {trade.category === 'crypto' || trade.category === 'economics' 
                            ? `$${trade.floor.toLocaleString()} - $${trade.cap.toLocaleString()}`
                            : `${trade.floor}° - ${trade.cap}°`
                          }
                        </span>
                      ) : trade.subtitle ? (
                        <span className="truncate text-sm text-gray-300">{trade.subtitle}</span>
                      ) : null}
                      <span className="text-xs text-gray-500">{trade.ticker}</span>
                    </div>
                    
                    {/* Expiration date */}
                    <p className="mt-1 text-xs text-gray-500">
                      Expires: {new Date(trade.expiration).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                    
                    {/* Liquidity indicator */}
                    {(trade.liquidityScore || trade.spread) && (
                      <LiquidityBar score={trade.liquidityScore} spread={trade.spread} />
                    )}
                  </div>

                  {/* Center: Metrics */}
                  <div className="flex gap-4 sm:gap-6">
                    {trade.compositeScore && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Composite</p>
                        <p className="text-lg font-bold text-primary">{trade.compositeScore}</p>
                      </div>
                    )}
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
                  <TradeDetailPanel 
                    trade={trade} 
                    kellyAnalysis={kellyAnalysis}
                    onBuy={(side, amount) => executeTrade(trade, side, amount)}
                    bankroll={stats.bankroll}
                  />
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
          )}
        </>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          {/* Portfolio Header with Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface rounded-xl border border-surface-hover p-4">
              <p className="text-sm text-gray-400">Bankroll</p>
              <p className="text-2xl font-bold text-white">${stats.bankroll.toLocaleString()}</p>
              <p className={`text-xs ${stats.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} total
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-hover p-4">
              <p className="text-sm text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold text-white">{openPositionsWithPnL.length}</p>
              <p className="text-xs text-gray-500">{stats.openPositions} tracked</p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-hover p-4">
              <p className="text-sm text-gray-400">Win Rate</p>
              <p className="text-2xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">{stats.winningTrades}W / {stats.losingTrades}L</p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-hover p-4">
              <p className="text-sm text-gray-400">ROI</p>
              <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">Total Return</p>
            </div>
          </div>

          {/* Portfolio Actions */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Open Positions ({openPositionsWithPnL.length})</h2>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Reset Portfolio
              </button>
            </div>
          </div>

          {/* Reset Confirmation Modal */}
          {showResetConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-surface rounded-xl border border-surface-hover p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-white mb-2">Reset Portfolio?</h3>
                <p className="text-gray-400 text-sm mb-4">
                  This will close all open positions and reset your bankroll to $10,000. 
                  Your trade history will be preserved.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-surface-hover text-gray-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      // Save current positions to history
                      const closedPositions = positions.map(p => ({
                        ...p,
                        status: 'closed' as const,
                        closedAt: new Date().toISOString(),
                        closeReason: 'portfolio_reset',
                        pnl: 0 // Would calculate from current price
                      }));
                      
                      // Update stats
                      setStats({
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
                      
                      // Clear positions
                      setPositions([]);
                      
                      // Save to Firebase
                      await setData('v6/kalshi/positions', []);
                      await setData('v6/kalshi/portfolio', {
                        bankroll: 10000,
                        initialBankroll: 10000,
                        totalPnl: 0,
                        totalTrades: 0,
                        winningTrades: 0,
                        losingTrades: 0,
                        winRate: 0,
                        roi: 0,
                        maxDrawdown: 0,
                        openPositions: 0,
                        resetAt: new Date().toISOString()
                      });
                      
                      setShowResetConfirm(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isDataLoaded ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-500" />
              <p className="mt-4 text-gray-400">Loading portfolio...</p>
            </div>
          ) : openPositionsWithPnL.length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <Wallet className="mx-auto h-12 w-12 text-gray-500" />
              <p className="mt-4 text-gray-400">No open positions</p>
              <p className="text-sm text-gray-500">Start trading from the Opportunities tab</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openPositionsWithPnL.map((position) => (
                <div key={position.id} className="rounded-xl border border-surface-hover bg-surface p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${position.side === 'yes' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                          {position.side.toUpperCase()}
                        </span>
                        <p className="text-sm text-gray-400">{position.ticker}</p>
                        <span className="text-xs text-gray-500">
                          {new Date(position.openedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-white">{position.marketTitle}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Entry</p>
                        <p className="text-white">{position.entryPrice}¢ × {position.shares}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Current</p>
                        <p className="text-white">{position.currentPrice || position.entryPrice}¢</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Value</p>
                        <p className="text-white">${position.value.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">P&L</p>
                        <p className={`font-medium ${position.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                          {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ({position.pnlPct >= 0 ? '+' : ''}{position.pnlPct.toFixed(1)}%)
                        </p>
                      </div>
                      <button
                        onClick={() => closePosition(position.id)}
                        className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-gray-300 hover:bg-success/20 hover:text-success"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                    <th className="pb-2 text-right">Gross P&L</th>
                    <th className="pb-2 text-right">Fees (7%)</th>
                    <th className="pb-2 text-right">Net P&L</th>
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
                      <td className={`py-3 text-right ${(position.grossPnl || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {(position.grossPnl || 0) >= 0 ? '+' : ''}${(position.grossPnl || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-gray-500">
                        {position.fees ? `-$${position.fees.toFixed(2)}` : '-'}
                      </td>
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

      {/* Heat Map Tab */}
      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Portfolio Risk Heat Map</h2>
          {!heatMap ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
              <Activity className="mx-auto h-12 w-12 text-gray-500" />
              <p className="mt-4 text-gray-400">Heat Map data not available</p>
              <p className="text-sm text-gray-500">Run a scan to generate risk analysis</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Risk Score */}
              <div className="rounded-xl border border-surface-hover bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Overall Risk Score</p>
                    <p className={`text-3xl font-bold ${
                      heatMap.riskScore >= 70 ? 'text-red-500' :
                      heatMap.riskScore >= 50 ? 'text-orange-500' :
                      heatMap.riskScore >= 30 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {heatMap.riskScore}/100
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Total Exposure</p>
                    <p className="text-xl font-bold text-white">${heatMap.totalExposure?.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">
                      {heatMap.bankroll > 0 ? ((heatMap.totalExposure / heatMap.bankroll) * 100).toFixed(1) : 0}% of bankroll
                    </p>
                  </div>
                </div>
              </div>

              {/* Concentration by Category */}
              <div className="rounded-xl border border-surface-hover bg-surface p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Concentration by Category</h3>
                <div className="space-y-2">
                  {Object.entries(heatMap.concentration || {}).map(([cat, data]: [string, any]) => {
                    if (data.exposure <= 0) return null;
                    return (
                      <div key={cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full`} style={{ backgroundColor: data.riskLevel?.color }} />
                          <span className="capitalize text-white">{cat}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-medium">${data.exposure?.toLocaleString()}</span>
                          <span className="text-gray-400 text-sm ml-2">({data.percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warnings */}
              {heatMap.warnings && heatMap.warnings.length > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <h3 className="text-sm font-medium text-rose-400 mb-3">⚠️ Risk Warnings</h3>
                  <div className="space-y-2">
                    {heatMap.warnings.map((warning: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={
                          warning.severity === 'critical' ? 'text-red-500' :
                          warning.severity === 'high' ? 'text-orange-500' :
                          'text-yellow-500'
                        }>
                          {warning.severity === 'critical' ? '🔴' : warning.severity === 'high' ? '🟠' : '🟡'}
                        </span>
                        <span className="text-sm text-gray-300">{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Heat Map Grid */}
              {heatMap.heatMap && heatMap.heatMap.length > 0 && (
                <div className="rounded-xl border border-surface-hover bg-surface p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Position Risk Map</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {heatMap.heatMap.map((cell: any) => (
                      <div
                        key={cell.ticker}
                        className="rounded-lg border p-3 transition-all"
                        style={{
                          borderColor: cell.riskLevel?.color || '#4b5563',
                          backgroundColor: `${cell.riskLevel?.color}20` || '#1f2937'
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium text-sm">{cell.ticker}</span>
                          <span className="text-lg">{cell.riskLevel?.emoji}</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Risk Score:</span>
                            <span className="text-white">{cell.riskScore?.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Exposure:</span>
                            <span className="text-white">{cell.percentageOfBankroll}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Category:</span>
                            <span className="capitalize text-white">{cell.category}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Correlation Risks */}
              {heatMap.correlationRisk && heatMap.correlationRisk.length > 0 && (
                <div className="rounded-xl border border-surface-hover bg-surface p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Correlation Analysis</h3>
                  <div className="space-y-2">
                    {heatMap.correlationRisk.slice(0, 5).map((risk: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {risk.type === 'hedge' ? (
                            <span className="text-green-400">💚</span>
                          ) : (
                            <span className={
                              risk.riskLevel === 'high' ? 'text-red-400' :
                              risk.riskLevel === 'medium' ? 'text-orange-400' :
                              'text-green-400'
                            }>
                              {risk.riskLevel === 'high' ? '🔴' : risk.riskLevel === 'medium' ? '🟠' : '🟢'}
                            </span>
                          )}
                          <span className="text-gray-300">{risk.pair}</span>
                        </div>
                        {risk.note && (
                          <span className="text-xs text-gray-500">{risk.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
