#!/usr/bin/env node
/**
 * Agent Task Webhook Server
 * Mission Control V6
 * 
 * Simple HTTP server that receives task notifications from Mission Control
 * and triggers agents via OpenClaw sessions_send
 * 
 * Run: node scripts/agent-webhook.js
 */

const http = require('http');
const { exec } = require('child_process');

const PORT = 9876;
const OPENCLAW_BIN = 'openclaw';

// Map agent IDs to their Discord channel IDs
const AGENT_CHANNELS = {
  planner: '1478488078870909088',
  ideator: '1478488081186291928',
  critic: '1478488084386418689',
  scout: '1478488086672441536',
  coder: '1478488318927700091',
  writer: '1478488320454557727',
  reviewer: '1478488321914310758',
  surveyor: '1478488543692194045'
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/trigger-agent') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { agentId, taskId, title, prompt, channelId } = JSON.parse(body);
      
      console.log(`[WEBHOOK] Triggering ${agentId} for task ${taskId}`);
      
      // Send message to Discord channel
      const message = `📋 **New Task Assigned**\n\n` +
        `**${title}**\n` +
        `Task ID: \`${taskId}\`\n\n` +
        `**Prompt:** ${prompt}\n\n` +
        `Reply with your response to complete this task.`;

      // Use openclaw message tool
      const cmd = `${OPENCLAW_BIN} message send --channel discord --target ${channelId} "${message.replace(/"/g, '\\"')}"`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[WEBHOOK ERROR] ${error.message}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        
        console.log(`[WEBHOOK] Message sent to ${channelId}`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Agent triggered' }));
      });
      
    } catch (error) {
      console.error(`[WEBHOOK ERROR] ${error.message}`);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🤖 Agent Task Webhook Server running on port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/trigger-agent`);
});
