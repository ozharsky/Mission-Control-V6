// Vercel serverless function - Health check
// GET /api/health

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', timestamp: Date.now() });
}
