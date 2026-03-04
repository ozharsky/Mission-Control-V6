#!/usr/bin/env node
/**
 * Discord Notification Worker
 * Mission Control V6
 * 
 * Watches Firebase for pending Discord notifications and sends them
 * Run with: node scripts/discord-worker.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onChildAdded, update, remove } = require('firebase/database');

// Firebase config - same as V6
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Discord bot tokens from OpenClaw config
const DISCORD_TOKENS = {
  default: process.env.DISCORD_DEFAULT_TOKEN || ''
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log('🤖 Discord Notification Worker started');
console.log('📡 Watching v6/discordNotifications...');

// Watch for new notifications
const notificationsRef = ref(db, 'v6/discordNotifications');

onChildAdded(notificationsRef, async (snapshot) => {
  const notification = snapshot.val();
  
  if (notification.status !== 'pending') return;
  
  console.log(`📨 Sending notification to ${notification.channelId}:`, notification.message.substring(0, 50) + '...');
  
  try {
    // Send to Discord via webhook
    const success = await sendDiscordMessage(notification.channelId, notification.message);
    
    if (success) {
      // Mark as sent
      await update(ref(db, `v6/discordNotifications/${notification.id}`), {
        status: 'sent',
        sentAt: Date.now()
      });
      console.log(`✅ Sent: ${notification.id}`);
      
      // Clean up after 1 hour
      setTimeout(() => {
        remove(ref(db, `v6/discordNotifications/${notification.id}`));
      }, 3600000);
    } else {
      throw new Error('Discord API returned error');
    }
  } catch (error) {
    console.error(`❌ Failed to send ${notification.id}:`, error);
    await update(ref(db, `v6/discordNotifications/${notification.id}`), {
      status: 'failed',
      error: error.message,
      failedAt: Date.now()
    });
  }
});

async function sendDiscordMessage(channelId, message) {
  try {
    // Use Discord bot API
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_TOKENS.default}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: message })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Discord API error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Discord send error:', error);
    return false;
  }
}

// Keep alive
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
