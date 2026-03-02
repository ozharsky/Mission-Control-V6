#!/usr/bin/env node
/**
 * Mission Control V5 → V6 Data Migration Script
 * 
 * This script migrates data from the existing V5 Firebase structure
 * to the new V6 structure.
 * 
 * Usage: node migrate-v5-to-v6.js
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDzDQQ2CjM3Y4lE1oaFq2e6f0Y8X8X8X8X",
  authDomain: "mission-control-sync.firebaseapp.com",
  databaseURL: "https://mission-control-sync-default-rtdb.firebaseio.com",
  projectId: "mission-control-sync",
  storageBucket: "mission-control-sync.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function migrateData() {
  console.log('🚀 Starting V5 → V6 Migration...\n');

  try {
    // 1. Migrate Priorities
    console.log('📋 Migrating Priorities...');
    const prioritiesSnapshot = await get(ref(db, 'data/priorities'));
    const priorities = prioritiesSnapshot.val() || {};
    
    const migratedPriorities = Object.entries(priorities).map(([id, p]: [string, any]) => ({
      id,
      text: p.text || '',
      board: p.board || 'all',
      completed: p.completed || false,
      dueDate: p.dueDate || null,
      tags: p.tags || [],
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString()
    }));

    await set(ref(db, 'v6/data/priorities'), migratedPriorities);
    console.log(`  ✓ Migrated ${migratedPriorities.length} priorities\n`);

    // 2. Migrate Projects
    console.log('📁 Migrating Projects...');
    const projectsSnapshot = await get(ref(db, 'data/projects'));
    const projects = projectsSnapshot.val() || {};
    
    await set(ref(db, 'v6/data/projects'), projects);
    console.log(`  ✓ Migrated projects\n`);

    // 3. Migrate Revenue History
    console.log('💰 Migrating Revenue History...');
    const revenueSnapshot = await get(ref(db, 'data/revenueHistory'));
    const revenue = revenueSnapshot.val() || {};
    
    await set(ref(db, 'v6/data/revenue'), revenue);
    console.log(`  ✓ Migrated revenue data\n`);

    // 4. Migrate Notes
    console.log('📝 Migrating Notes...');
    const notesSnapshot = await get(ref(db, 'data/notes'));
    const notes = notesSnapshot.val() || {};
    
    await set(ref(db, 'v6/data/notes'), notes);
    console.log(`  ✓ Migrated notes\n`);

    // 5. Migrate Printers
    console.log('🖨️  Migrating Printers...');
    const printersSnapshot = await get(ref(db, 'data/printers'));
    const printers = printersSnapshot.val() || {};
    
    await set(ref(db, 'v6/data/printers'), printers);
    console.log(`  ✓ Migrated printers\n`);

    // 6. Initialize V6 Agent Structure
    console.log('🤖 Initializing Agent Structure...');
    await set(ref(db, 'v6/agent'), {
      status: 'online',
      currentTask: 'V6 Migration Complete',
      lastSeen: new Date().toISOString(),
      model: 'kimi-coding/k2p5'
    });
    console.log('  ✓ Agent initialized\n');

    // 7. Initialize V6 Tasks Structure
    console.log('✅ Initializing Tasks Structure...');
    await set(ref(db, 'v6/tasks'), {
      pending: {},
      inProgress: {},
      completed: {}
    });
    console.log('  ✓ Tasks initialized\n');

    // 8. Initialize V6 Notifications
    console.log('🔔 Initializing Notifications...');
    await set(ref(db, 'v6/notifications'), {
      'welcome': {
        id: 'welcome',
        type: 'success',
        title: 'Welcome to Mission Control V6',
        message: 'Migration completed successfully!',
        timestamp: new Date().toISOString(),
        read: false
      }
    });
    console.log('  ✓ Notifications initialized\n');

    // 9. Initialize V6 Chat
    console.log('💬 Initializing Chat...');
    await set(ref(db, 'v6/chat/messages'), {
      'welcome': {
        id: 'welcome',
        from: 'agent',
        text: 'Welcome to Mission Control V6! I\'m ready to help.',
        timestamp: new Date().toISOString()
      }
    });
    console.log('  ✓ Chat initialized\n');

    console.log('🎉 Migration Complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy V6 to GitHub Pages');
    console.log('2. Enable GitHub Pages in repo settings');
    console.log('3. Access V6 at: https://ozharsky.github.io/Mission-Control-V6/');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateData();