module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const https = require('https');
  const { action, series, ticker } = req.query;
  
  let path = '/trade-api/v2/markets?status=open&limit=100';
  
  if (action === 'series' && series) {
    path = `/trade-api/v2/series/${series}/markets?status=open`;
  } else if (action === 'market' && ticker) {
    path = `/trade-api/v2/markets/${ticker}`;
  }

  const options = {
    hostname: 'api.elections.kalshi.com',
    path: path,
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const request = https.request(options, (response) => {
    let data = '';
    
    response.on('data', (chunk) => {
      data += chunk;
    });
    
    response.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        res.status(200).json(jsonData);
      } catch (e) {
        res.status(500).json({ error: 'Invalid response from Kalshi', raw: data });
      }
    });
  });

  request.on('error', (error) => {
    res.status(500).json({ error: error.message });
  });

  request.setTimeout(10000, () => {
    request.destroy();
    res.status(500).json({ error: 'Request timeout' });
  });

  request.end();
};
