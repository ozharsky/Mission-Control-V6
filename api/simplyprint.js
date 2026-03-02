// Vercel Serverless Function for SimplyPrint Proxy
// This file should be at: api/simplyprint.js

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.query.path || '';
  const apiKey = req.headers.authorization?.replace('Bearer ', '');

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  const targetUrl = `https://api.simplyprint.io/v1/${path}`;

  // Use node-fetch or built-in https
  const https = require('https');
  const url = new URL(targetUrl);

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: req.method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => data += chunk);
    proxyRes.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        res.status(proxyRes.statusCode).json(jsonData);
      } catch (e) {
        res.status(500).json({ error: 'Invalid JSON response', data });
      }
    });
  });

  proxyReq.on('error', (error) => {
    res.status(500).json({ error: 'Proxy error', message: error.message });
  });

  if (req.method !== 'GET' && req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }

  proxyReq.end();
};