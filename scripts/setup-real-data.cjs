#!/usr/bin/env node
/**
 * Setup script to populate Mission Control V6 with real tasks and projects
 * Run: node scripts/setup-real-data.js
 */

const https = require('https');

// Firebase config - you'll need to update these with your actual values
const FIREBASE_URL = process.env.FIREBASE_URL || 'https://mission-control-sync-default-rtdb.firebaseio.com';

// Helper to push data to Firebase
function pushToFirebase(path, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const options = {
      hostname: FIREBASE_URL.replace('https://', '').replace('http://', '').split('/')[0],
      path: `/v6/${path}.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log(`✅ Added to ${path}:`, parsed.name || 'OK');
          resolve(parsed);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(jsonData);
    req.end();
  });
}

// Real Projects
const PROJECTS = [
  {
    name: 'OZ3DPrint Etsy Growth',
    description: 'Grow Etsy shop from current sales to $450/month target. Focus on nicotine pouch accessories.',
    status: 'inprogress',
    progress: 35,
    tasksCompleted: 3,
    tasksTotal: 8,
    dueDate: '2025-06-01',
    tags: ['etsy', 'revenue', '3d-printing'],
    board: 'etsy',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Photography Business Development',
    description: 'Build photography business in Seattle. Event photography, portfolio development.',
    status: 'inprogress',
    progress: 20,
    tasksCompleted: 1,
    tasksTotal: 5,
    dueDate: '2025-04-30',
    tags: ['photography', 'freelance', 'seattle'],
    board: 'photography',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Mission Control V6',
    description: 'Project management application for business operations. Firebase, React, TypeScript.',
    status: 'inprogress',
    progress: 85,
    tasksCompleted: 17,
    tasksTotal: 20,
    dueDate: '2025-03-15',
    tags: ['development', 'productivity', 'firebase'],
    board: 'general',
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Wholesale Opportunities',
    description: 'Explore wholesale opportunities for 3D printed products. Bulk orders, B2B sales.',
    status: 'backlog',
    progress: 0,
    tasksCompleted: 0,
    tasksTotal: 3,
    tags: ['wholesale', 'b2b', 'growth'],
    board: 'wholesale',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Real Tasks
const TASKS = [
  // OZ3DPrint Tasks
  {
    title: 'List 5 new nicotine pouch accessories on Etsy',
    description: 'Create new product listings with optimized titles, photos, and descriptions',
    priority: 'high',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-07',
    projectId: null,
    assignee: 'Oleg',
    tags: ['etsy', 'listing', 'products'],
  },
  {
    title: 'Review and optimize Etsy SEO keywords',
    description: 'Analyze current listings and improve keywords for better search ranking',
    priority: 'high',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-10',
    projectId: null,
    assignee: 'Oleg',
    tags: ['etsy', 'seo', 'marketing'],
  },
  {
    title: 'Print inventory for top 3 selling items',
    description: 'Ensure stock levels are maintained for bestsellers',
    priority: 'medium',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-05',
    projectId: null,
    assignee: 'Oleg',
    tags: ['inventory', 'printing', 'production'],
  },
  
  // Photography Tasks
  {
    title: 'Apply to 3 event photography jobs',
    description: 'Review opportunities in Jobs section and submit applications',
    priority: 'high',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-08',
    projectId: null,
    assignee: 'Oleg',
    tags: ['photography', 'jobs', 'applications'],
  },
  {
    title: 'Update photography portfolio website',
    description: 'Add recent work, optimize for SEO, improve loading speed',
    priority: 'medium',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-15',
    projectId: null,
    assignee: 'Oleg',
    tags: ['photography', 'portfolio', 'website'],
  },
  
  // Mission Control Tasks
  {
    title: 'Test Mission Control V6 in daily workflow',
    description: 'Use the app for a week, note any issues or improvements needed',
    priority: 'high',
    status: 'in-progress',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-11',
    projectId: null,
    assignee: 'Oleg',
    tags: ['mission-control', 'testing', 'feedback'],
  },
  {
    title: 'Import historical Etsy revenue data',
    description: 'Upload CSV with past sales to populate revenue charts',
    priority: 'medium',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-06',
    projectId: null,
    assignee: 'Oleg',
    tags: ['mission-control', 'data', 'revenue'],
  },
  
  // General Business Tasks
  {
    title: 'Review monthly financials',
    description: 'Check P&L, expenses, and revenue trends for February',
    priority: 'medium',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-05',
    projectId: null,
    assignee: 'Oleg',
    tags: ['finance', 'monthly', 'review'],
  },
  {
    title: 'Order filament and supplies',
    description: 'Check inventory levels and order PLA, PETG, packaging materials',
    priority: 'medium',
    status: 'pending',
    createdBy: 'user',
    createdAt: new Date().toISOString(),
    dueDate: '2025-03-04',
    projectId: null,
    assignee: 'Oleg',
    tags: ['inventory', 'supplies', 'purchasing'],
  },
];

// Sample Inventory Items
const INVENTORY = [
  {
    sku: 'FIL-PLA-BLK',
    name: 'PLA Filament Black',
    description: 'Standard PLA filament for general printing',
    category: 'material',
    status: 'in-stock',
    quantity: 8,
    minStock: 3,
    maxStock: 15,
    unitCost: 20,
    sellingPrice: 0,
    location: 'Shelf A1',
    supplier: 'Amazon',
    tags: ['filament', 'pla', 'materials'],
    notes: 'Good for most prints',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalSold: 0,
  },
  {
    sku: 'FIL-PETG-CLR',
    name: 'PETG Filament Clear',
    description: 'Clear PETG for durable prints',
    category: 'material',
    status: 'low-stock',
    quantity: 2,
    minStock: 3,
    maxStock: 10,
    unitCost: 25,
    sellingPrice: 0,
    location: 'Shelf A2',
    supplier: 'MatterHackers',
    tags: ['filament', 'petg', 'materials'],
    notes: 'Running low, need to reorder',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalSold: 0,
  },
  {
    sku: 'PKG-BOX-SM',
    name: 'Shipping Boxes Small',
    description: '6x4x4 shipping boxes for small items',
    category: 'supply',
    status: 'in-stock',
    quantity: 50,
    minStock: 20,
    maxStock: 100,
    unitCost: 0.5,
    sellingPrice: 0,
    location: 'Storage B',
    supplier: 'Uline',
    tags: ['packaging', 'shipping', 'supplies'],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalSold: 0,
  },
];

async function setupData() {
  console.log('🚀 Setting up real data in Mission Control V6...\n');
  
  try {
    // Add Projects
    console.log('📁 Adding Projects...');
    for (const project of PROJECTS) {
      await pushToFirebase('data/projects', project);
    }
    
    // Add Tasks
    console.log('\n✅ Adding Tasks...');
    for (const task of TASKS) {
      await pushToFirebase('tasks/pending', task);
    }
    
    // Add Inventory
    console.log('\n📦 Adding Inventory...');
    for (const item of INVENTORY) {
      await pushToFirebase('inventory', item);
    }
    
    console.log('\n✅ Setup complete!');
    console.log(`   ${PROJECTS.length} projects added`);
    console.log(`   ${TASKS.length} tasks added`);
    console.log(`   ${INVENTORY.length} inventory items added`);
    console.log('\n🎉 Mission Control is ready to use!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure FIREBASE_URL is set correctly');
    console.log('   export FIREBASE_URL=https://your-project.firebaseio.com');
  }
}

// Run if called directly
if (require.main === module) {
  setupData();
}

module.exports = { setupData, PROJECTS, TASKS, INVENTORY };