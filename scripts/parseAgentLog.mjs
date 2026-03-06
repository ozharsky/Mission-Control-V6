#!/usr/bin/env node
/**
 * Agent Log Parser
 * Parses structured agent output and logs to Firebase
 * 
 * Usage: echo '{agent output}' | node parseAgentLog.mjs
 */

const API_KEY = process.env.AGENT_API_KEY || ''; 
if (!API_KEY) {
  console.error('Error: AGENT_API_KEY environment variable not set');
  console.error('Set it with: export AGENT_API_KEY=your_api_key');
  process.exit(1);
}
const API_URL = process.env.MC_API_URL || 'https://mission-control-v6-kappa.vercel.app/api';

async function logToFirebase(entry) {
  try {
    const response = await fetch(`${API_URL}/log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      console.error('Failed to log:', await response.text());
      return false;
    }

    const result = await response.json();
    console.log('✅ Logged:', result.id);
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

// Read from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  // Try to find JSON in the input
  const jsonMatch = input.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in input');
    process.exit(1);
  }

  try {
    const entry = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!entry.agentId || !entry.action || !entry.description) {
      console.error('Missing required fields: agentId, action, description');
      process.exit(1);
    }

    // Add timestamp if missing
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }

    const success = await logToFirebase(entry);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Parse error:', error.message);
    process.exit(1);
  }
});
