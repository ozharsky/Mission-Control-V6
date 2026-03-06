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

async function logActivity(agentId, action, description, category = 'task', metadata = {}) {
  const entry = {
    timestamp: Date.now(),
    agentId,
    action,
    category,
    description,
    metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Log failed:', error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Logged:', result.id);
    return result.id;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
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
  console.log('  node log-activity.mjs analyst api_call "Called API" api_call \'{"tokens":1500}\'');
  console.log('');
  console.log('Categories: task, decision, api_call, file_upload, notification, error');
  process.exit(1);
}

logActivity(agentId, action, description, category, metadata);
