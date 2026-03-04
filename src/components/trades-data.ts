// LIVE MARKETS - March 5, 2026 (Crypto, Weather, Politics - NO SPORTS)
import type { KalshiTrade } from './TradesView';

export const RESEARCHED_TRADES: KalshiTrade[] = [
  {
    id: '1',
    ticker: 'KXHIGHTSEA-26MAR05-T54',
    title: 'Seattle High Temp >54°F on March 5',
    category: 'weather',
    yesPrice: 4,
    noPrice: 96,
    volume: 1247,
    expiration: '2026-03-05',
    kalshiUrl: 'https://kalshi.com/markets/kxhightsea',
    priceHistory: [3, 4, 4, 4],
    research: {
      trueProbability: 35,
      edge: 31,
      confidence: 'medium',
      catalyst: 'Historical March 5 temps avg 52°F, but warming trend + El Niño pattern',
      sources: ['NOAA', 'Weather Underground', 'Climate.gov']
    },
    payout: { buyPrice: 4, potentialReturn: 100, multiplier: 25 }
  },
  {
    id: '2',
    ticker: 'KXHIGHTSEA-26MAR05-T47',
    title: 'Seattle High Temp <47°F on March 5',
    category: 'weather',
    yesPrice: 6,
    noPrice: 94,
    volume: 890,
    expiration: '2026-03-05',
    kalshiUrl: 'https://kalshi.com/markets/kxhightsea',
    priceHistory: [5, 6, 6, 6],
    research: {
      trueProbability: 28,
      edge: 22,
      confidence: 'medium',
      catalyst: 'Cold snap possible. 16.7x payout if temps stay below 47°F.',
      sources: ['NWS Seattle', 'Kalshi']
    },
    payout: { buyPrice: 6, potentialReturn: 100, multiplier: 16.7 }
  },
  {
    id: '3',
    ticker: 'KXHIGHTSEA-26MAR05-B53.5',
    title: 'Seattle Temp 53-54°F on March 5',
    category: 'weather',
    yesPrice: 13,
    noPrice: 87,
    volume: 650,
    expiration: '2026-03-05',
    kalshiUrl: 'https://kalshi.com/markets/kxhightsea',
    priceHistory: [12, 13, 13, 14],
    research: {
      trueProbability: 35,
      edge: 22,
      confidence: 'high',
      catalyst: 'Most likely range based on forecasts. 7.7x payout.',
      sources: ['Weather.com', 'AccuWeather']
    },
    payout: { buyPrice: 13, potentialReturn: 100, multiplier: 7.7 }
  },
  {
    id: '4',
    ticker: 'KXHIGHTSEA-26MAR04-T56',
    title: 'Seattle High Temp >56°F on March 4 (TODAY)',
    category: 'weather',
    yesPrice: 1,
    noPrice: 99,
    volume: 420,
    expiration: '2026-03-04',
    kalshiUrl: 'https://kalshi.com/markets/kxhightsea',
    priceHistory: [1, 1, 1, 1],
    research: {
      trueProbability: 8,
      edge: 7,
      confidence: 'low',
      catalyst: 'Longshot for today - temps would need to spike 10+ degrees. 100x payout.',
      sources: ['NWS Seattle']
    },
    payout: { buyPrice: 1, potentialReturn: 100, multiplier: 100 }
  }
];