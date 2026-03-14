/**
 * Discord Webhook Server
 * Simple Express server to receive HTTP requests from Mission Control
 * and send Discord messages
 * 
 * Run: node server/discord-webhook.js
 */

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.DISCORD_WEBHOOK_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Send Discord message
app.post('/send-discord', async (req, res) => {
  const { channelId, message } = req.body;
  
  if (!channelId || !message) {
    return res.status(400).json({ 
      error: 'Missing channelId or message' 
    });
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
});

// Batch send multiple messages
app.post('/send-batch', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`🤖 Discord Webhook Server running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`  POST /send-discord - Send single message`);
  console.log(`  POST /send-batch   - Send multiple messages`);
  console.log(`  GET  /health       - Health check`);
});
