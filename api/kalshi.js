// Vercel Serverless Function - Kalshi Proxy
// This avoids CORS by proxying requests through your own server

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { action, ticker, series } = req.query;

    // Kalshi API base URL
    const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

    let url;
    
    switch (action) {
      case 'markets':
        url = `${KALSHI_API}/markets?status=open&limit=100`;
        break;
      case 'series':
        url = `${KALSHI_API}/series/${series}/markets?status=open`;
        break;
      case 'market':
        url = `${KALSHI_API}/markets/${ticker}`;
        break;
      default:
        url = `${KALSHI_API}/markets?status=open&limit=100`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Kalshi API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Kalshi proxy error:', error);
    res.status(500).json({ 
      error: error.message,
      markets: [] 
    });
  }
}
