// LIVE MARKETS - March 5, 2026 (Crypto, Weather, Politics - NO SPORTS)
import type { KalshiTrade } from './TradesView';

export const RESEARCHED_TRADES: KalshiTrade[] = [
  {
    id: '1',
    ticker: 'KXBTC-26MAR0416-B73875',
    title: 'Bitcoin Price Range: Below $73,875 on Mar 4',
    category: 'crypto',
    yesPrice: 13,
    noPrice: 87,
    volume: 5200,
    expiration: '2026-03-04',
    kalshiUrl: 'https://kalshi.com/markets/kxbtc-26mar0416',
    priceHistory: [13, 12, 13, 14, 13],
    research: {
      trueProbability: 25,
      edge: 12,
      confidence: 'medium',
      catalyst: 'BTC trading around $74k. 13¢ for 7.7x payout if price drops below $73,875.',
      sources: ['Kalshi', 'Coinbase']
    },
    payout: { buyPrice: 13, potentialReturn: 100, multiplier: 7.7 }
  },
  {
    id: '2',
    ticker: 'KXBTC-26MAR0416-B74125',
    title: 'Bitcoin Price Range: Below $74,125 on Mar 4',
    category: 'crypto',
    yesPrice: 3,
    noPrice: 97,
    volume: 4800,
    expiration: '2026-03-04',
    kalshiUrl: 'https://kalshi.com/markets/kxbtc-26mar0416',
    priceHistory: [3, 3, 3, 4, 3],
    research: {
      trueProbability: 12,
      edge: 9,
      confidence: 'high',
      catalyst: 'Longshot bet - BTC must drop $1k+ from current levels. 33x payout.',
      sources: ['Kalshi']
    },
    payout: { buyPrice: 3, potentialReturn: 100, multiplier: 33.3 }
  },
  {
    id: '3',
    ticker: 'KXHIGHNY-26MAR05-T48',
    title: 'NYC High Temp >48°F on March 5',
    category: 'weather',
    yesPrice: 3,
    noPrice: 97,
    volume: 3200,
    expiration: '2026-03-05',
    kalshiUrl: 'https://kalshi.com/markets/kxhighny-26mar05',
    priceHistory: [5, 4, 3, 3, 3],
    research: {
      trueProbability: 15,
      edge: 12,
      confidence: 'medium',
      catalyst: 'Late winter warming possible. 33x payout if NYC hits 48°F+ today.',
      sources: ['NWS NYC', 'Kalshi']
    },
    payout: { buyPrice: 3, potentialReturn: 100, multiplier: 33.3 }
  },
  {
    id: '4',
    ticker: 'KXHIGHNY-26MAR05-T41',
    title: 'NYC High Temp <41°F on March 5',
    category: 'weather',
    yesPrice: 9,
    noPrice: 91,
    volume: 2800,
    expiration: '2026-03-05',
    kalshiUrl: 'https://kalshi.com/markets/kxhighny-26mar05',
    priceHistory: [8, 9, 9, 10, 9],
    research: {
      trueProbability: 22,
      edge: 13,
      confidence: 'medium',
      catalyst: 'Cold snap continuation. 11x payout if NYC stays below 41°F.',
      sources: ['NWS NYC']
    },
    payout: { buyPrice: 9, potentialReturn: 100, multiplier: 11.1 }
  }
];