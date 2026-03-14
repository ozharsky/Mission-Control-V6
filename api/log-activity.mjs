/**
 * Simple Activity Log API
 * For agents who don't have direct Firebase access
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin
let db;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const app = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    db = getDatabase(app);
  }
} catch (error) {
  console.error('Firebase init error:', error);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Firebase not initialized' });
  }

  try {
    const { timestamp, agentId, action, category, description, metadata } = req.body;

    // Generate ID
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save to Firebase
    const logRef = db.ref(`v6/agentActivity/logs/${id}`);
    await logRef.set({
      id,
      timestamp: timestamp || Date.now(),
      agentId,
      action,
      category,
      description,
      metadata: metadata || {},
    });

    // Update metrics
    await updateMetrics(agentId, category, metadata);

    return res.status(200).json({ success: true, id });

  } catch (error) {
    console.error('Log error:', error);
    return res.status(500).json({ error: 'Failed to log' });
  }
}

async function updateMetrics(agentId, category, metadata) {
  try {
    const metricsRef = db.ref(`v6/agentActivity/metrics/${agentId}`);
    const snapshot = await metricsRef.once('value');
    const current = snapshot.val() || {
      agentId,
      totalActions: 0,
      actionsByCategory: {},
      totalTokensUsed: 0,
      totalCostEstimate: 0,
      successRate: 100,
      lastActive: Date.now(),
    };

    current.totalActions++;
    current.actionsByCategory[category] = (current.actionsByCategory[category] || 0) + 1;
    current.lastActive = Date.now();

    if (metadata?.tokensUsed) {
      current.totalTokensUsed += metadata.tokensUsed;
    }
    if (metadata?.costEstimate) {
      current.totalCostEstimate += metadata.costEstimate;
    }

    await metricsRef.set(current);
  } catch (e) {
    console.error('Metrics update error:', e);
  }
}
