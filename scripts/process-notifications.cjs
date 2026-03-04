#!/usr/bin/env node
/**
 * Discord Notification Processor
 * Run this to process pending notifications immediately
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const firebaseConfig = {
  databaseURL: 'https://mission-control-sync-default-rtdb.firebaseio.com'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Channel mappings
const CHANNELS = {
  researcher: '1478488543692194045',
  strategist: '1478488078870909088',
  inventor: '1478488081186291928',
  analyst: '1478488084386418689',
  scout: '1478488086672441536',
  architect: '1478488318927700091',
  wordsmith: '1478488320454557727',
  editor: '1478488321914310758',
  workflow: '1478488567020785867'
};

async function processNotifications() {
  console.log('🔍 Checking for pending notifications...');
  
  const snapshot = await get(ref(db, 'v6/discordNotifications'));
  const notifications = snapshot.val();
  
  if (!notifications) {
    console.log('✅ No notifications to process');
    return;
  }
  
  for (const [id, notif] of Object.entries(notifications)) {
    if (notif.status !== 'pending') continue;
    
    console.log(`📨 Sending notification to ${notif.channelId}: ${notif.message.substring(0, 50)}...`);
    
    try {
      // Use openclaw CLI to send message
      const cmd = `openclaw message send --channel discord --target ${notif.channelId} "${notif.message.replace(/"/g, '\\"')}"`;
      await execAsync(cmd);
      
      // Mark as sent
      await update(ref(db, `v6/discordNotifications/${id}`), {
        status: 'sent',
        sentAt: Date.now()
      });
      
      console.log(`✅ Sent: ${id}`);
    } catch (error) {
      console.error(`❌ Failed to send ${id}:`, error.message);
      await update(ref(db, `v6/discordNotifications/${id}`), {
        status: 'failed',
        error: error.message,
        failedAt: Date.now()
      });
    }
  }
}

processNotifications().then(() => {
  console.log('🏁 Done');
  process.exit(0);
}).catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
