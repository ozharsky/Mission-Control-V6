// Vercel serverless function for batch Discord messages
// POST /api/send-batch

import { exec } from 'child_process';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { notifications } = req.body;

  if (!Array.isArray(notifications)) {
    return res.status(400).json({ error: 'notifications must be an array' });
  }

  const results = [];

  for (const notif of notifications) {
    const { channelId, message, id } = notif;

    try {
      const cmd = `openclaw message send --channel discord --target ${channelId} -m "${message.replace(/"/g, '\\"')}"`;

      await new Promise((resolve, reject) => {
        exec(cmd, (error) => {
          if (error) reject(error);
          else resolve(null);
        });
      });

      results.push({ id, success: true, channelId });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }

  res.json({ results });
}
