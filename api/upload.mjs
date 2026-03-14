/**
 * Agent File Upload API
 * Mission Control V6
 * 
 * Allows agents to upload files to Firebase Storage via HTTP POST
 * Files are stored and metadata is saved to Firebase Realtime DB
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin (will use Application Default Credentials or env vars)
let firebaseApp;
let storage;
let db;

try {
  // Check if we have service account credentials
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Try to use default credentials (works on Firebase/GCP)
    firebaseApp = initializeApp();
  }
  
  storage = getStorage();
  db = getDatabase();
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authorization (simple API key check)
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!storage || !db) {
    return res.status(500).json({ error: 'Firebase not initialized' });
  }

  try {
    const { fileData, fileName, contentType, category, projectId, agentId, metadata } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'Missing fileData or fileName' });
    }

    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64');

    // Create unique filename
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `files/${category || 'agents'}/${timestamp}_${safeName}`;

    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType || 'application/octet-stream',
        metadata: {
          uploadedBy: agentId || 'unknown',
          uploadedAt: new Date().toISOString(),
          originalName: fileName,
          ...metadata,
        },
      },
    });

    // Get download URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future
    });

    // Save metadata to Firebase Realtime DB
    const fileItem = {
      id: `${timestamp}`,
      name: fileName,
      size: buffer.length,
      type: contentType || 'application/octet-stream',
      url: url,
      uploadedAt: new Date().toISOString(),
      category: category || 'agents',
      projectId: projectId || null,
      storagePath: storagePath,
      uploadedBy: agentId || 'unknown',
      metadata: metadata || {},
    };

    // Save to v6/files/{category}/{id}
    const dbRef = db.ref(`v6/files/${fileItem.id}`);
    await dbRef.set(fileItem);

    return res.status(200).json({
      success: true,
      file: fileItem,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
}
