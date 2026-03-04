// Vercel serverless function for Discord webhook
// POST /api/send-discord

import { exec } from 'child_process';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelId, message } = req.body;

  if (!channelId || !message) {
    return res.status(400).json({ error: 'Missing channelId or message' });
  }

  try {
    // Use openclaw CLI to send message
    const cmd = `openclaw message send --channel discord --target ${channelId} -m "${message.replace(/"/g, '\\"')}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Discord send error:', error);
        return res.status(500).json({
          error: 'Failed to send Discord message',
          details: error.message
        });
      }

      console.log(`[DISCORD SENT] Channel ${channelId}`);
      res.json({ success: true, channelId });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
