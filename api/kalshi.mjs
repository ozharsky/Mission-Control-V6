export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, series } = req.query;
    
    let url;
    if (action === 'series' && series) {
      // Fetch markets for a specific series
      url = `https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=${series}&status=open&limit=20`;
    } else {
      // Default: fetch all open markets
      url = 'https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=100';
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
