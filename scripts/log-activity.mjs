#!/usr/bin/env node
/**
 * Agent Activity Logger
 * Standalone script for all agents to log activity to Mission Control
 * 
 * Usage: node log-activity.mjs <agent-id> <action> <description> [category] [metadata-json]
 * 
 * Examples:
 *   node log-activity.mjs inventor task_start "Designing ZYN dispenser"
 *   node log-activity.mjs inventor task_complete "ZYN dispenser designed" task '{"duration":360000}'
 *   node log-activity.mjs analyst api_call "Called OpenAI" api_call '{"tokens":1500,"cost":0.03}'
 */

const API_KEY = 'Nxc4fUHTmPEzB2mAz7yfjYY2uwPR72n2pGyrX2qH';
const API_URL = 'https://mission-control-v6-kappa.vercel.app/api/log-activity';
const FIREBASE_URL = 'https://mission-control-sync-default-rtdb.firebaseio.com/v6/agentActivity/logs.json';

async function logViaAPI(entry) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function logViaFirebase(entry) {
  const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const response = await fetch(`${FIREBASE_URL.replace('.json', '')}/${id}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, id }),
  });

  if (!response.ok) {
    throw new Error(`Firebase error: ${response.status}`);
  }

  return { success: true, id };
}

async function logActivity(agentId, action, description, category = 'task', metadata = {}) {
  // Parse metadata if string
  const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  
  // Normalize field names (accept tokens/cost or tokensUsed/costEstimate)
  const normalized = {
    ...meta,
    tokensUsed: meta.tokensUsed || meta.tokens || 0,
    costEstimate: meta.costEstimate || meta.cost || 0,
  };
  
  const entry = {
    timestamp: Date.now(),
    agentId,
    action,
    category,
    description,
    metadata: normalized,
  };

  try {
    // Try API first
    const result = await logViaAPI(entry);
    console.log('✅ Logged:', result.id);
    return result.id;
  } catch (apiError) {
    // Fallback to direct Firebase
    try {
      const result = await logViaFirebase(entry);
      console.log('✅ Logged (Direct):', result.id);
      return result.id;
    } catch (fbError) {
      console.error('❌ Log failed:', apiError.message, '|', fbError.message);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const [,, agentId, action, description, category = 'task', metadata = '{}'] = process.argv;

if (!agentId || !action || !description) {
  console.log('Usage: node log-activity.mjs <agent-id> <action> <description> [category] [metadata-json]');
  console.log('');
  console.log('Examples:');
  console.log('  node log-activity.mjs inventor task_start "Designing product"');
  console.log('  node log-activity.mjs inventor task_complete "Product designed" task \'{"duration":360000}\'');
  console.log('  node log-activity.mjs analyst api_call "Called API" api_call \'{"tokens":1500,"cost":0.03}\'');
  console.log('');
  console.log('Categories: task, decision, api_call, file_upload, notification, error');
  console.log('');
  console.log('Agent IDs: architect, inventor, analyst, writer, reviewer, scout, planner, critic, kimiclaw');
  process.exit(1);
}

logActivity(agentId, action, description, category, metadata);
