// Initialize V6 data structure in Firebase
// Run this once to set up the database

import { db } from '../src/lib/firebase';
import { ref, set } from 'firebase/database';

const initialData = {
  v6: {
    agent: {
      status: 'online',
      currentTask: 'Initializing Mission Control V6',
      lastSeen: new Date().toISOString(),
      model: 'kimi-coding/k2p5'
    },
    tasks: {
      pending: {},
      inProgress: {},
      completed: {}
    },
    notifications: {
      welcome: {
        id: 'welcome',
        type: 'success',
        title: 'Mission Control V6 Initialized',
        message: 'Welcome to the new dashboard!',
        timestamp: new Date().toISOString(),
        read: false
      }
    },
    chat: {
      messages: {}
    }
  }
};

async function initializeV6() {
  try {
    await set(ref(db), initialData);
    console.log('✅ V6 data structure initialized');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
  }
}

initializeV6();