// API route for sending Discord notifications from Mission Control
// This would be a serverless function (Vercel, Netlify Functions, or similar)

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelId, message } = req.body;

  if (!channelId || !message) {
    return res.status(400).json({ error: 'Missing channelId or message' });
  }

  try {
    // Call OpenClaw gateway to send message
    const response = await fetch('http://127.0.0.1:18789/api/v1/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENCLAW_TOKEN}`
      },
      body: JSON.stringify({
        channel: 'discord',
        target: channelId,
        message
      })
    });

    if (!response.ok) {
      throw new Error(`OpenClaw error: ${await response.text()}`);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
