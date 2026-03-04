// Vercel Serverless Function - Kalshi Proxy
const https = require('https');

module.exports = async (req, res) => {
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
    const KALSHI_API = 'api.elections.kalshi.com';

    let path;
    
    switch (action) {
      case 'markets':
        path = '/trade-api/v2/markets?status=open&limit=100';
        break;
      case 'series':
        path = `/trade-api/v2/series/${series}/markets?status=open`;
        break;
      case 'market':
        path = `/trade-api/v2/markets/${ticker}`;
        break;
      default:
        path = '/trade-api/v2/markets?status=open&limit=100';
    }

    // Use Node.js https module instead of fetch
    const data = await new Promise((resolve, reject) => {
      const request = https.get({
        hostname: KALSHI_API,
        path: path,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });
      
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Kalshi proxy error:', error);
    res.status(500).json({ 
      error: error.message,
      markets: [] 
    });
  }
};
