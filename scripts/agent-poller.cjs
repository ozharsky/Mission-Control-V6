#!/usr/bin/env node
/**
 * Agent Task Poller
 * Researcher bot polls Firebase for assigned tasks
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');
const { exec } = require('child_process');

const firebaseConfig = {
  databaseURL: 'https://mission-control-sync-default-rtdb.firebaseio.com'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const AGENT_ID = 'surveyor';
const DISCORD_CHANNEL = '1478488543692194045';

async function pollForTasks() {
  console.log(`[${AGENT_ID}] Polling for tasks...`);
  
  // Get tasks assigned to this agent
  const snapshot = await get(ref(db, 'v6/agentTasks'));
  const tasks = snapshot.val();
  
  if (!tasks) return;
  
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.assignee !== AGENT_ID) continue;
    if (task.status !== 'active' && task.status !== 'pending') continue;
    
    console.log(`[${AGENT_ID}] Found task: ${task.title}`);
    
    // Post to Discord that we're working on it
    const prompt = task.input?.topic || task.description;
    const message = `📚 **Researcher here!**\n\n` +
      `I see my task: "${task.title}"\n\n` +
      `Prompt: ${prompt}\n\n` +
      `Let me research this and get back to you...`;
    
    exec(`openclaw message send --channel discord --target ${DISCORD_CHANNEL} "${message.replace(/"/g, '\\"')}"`, (err) => {
      if (err) console.error('Failed to send:', err);
    });
    
    // Mark as acknowledged
    await update(ref(db, `v6/agentTasks/${taskId}`), {
      status: 'active',
      acknowledgedAt: Date.now()
    });
  }
}

pollForTasks().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
