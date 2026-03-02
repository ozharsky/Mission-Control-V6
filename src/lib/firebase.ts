import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update } from 'firebase/database';

// Get Firebase config from localStorage (same as V5)
function getFirebaseConfig() {
  return {
    apiKey: localStorage.getItem('mc_firebase_api_key') || '',
    authDomain: localStorage.getItem('mc_firebase_auth_domain') || '',
    databaseURL: localStorage.getItem('mc_firebase_url') || '',
    projectId: localStorage.getItem('mc_firebase_project_id') || '',
    storageBucket: localStorage.getItem('mc_firebase_storage_bucket') || '',
    messagingSenderId: localStorage.getItem('mc_firebase_messaging_sender_id') || '',
    appId: localStorage.getItem('mc_firebase_app_id') || ''
  };
}

// Initialize Firebase only if configured
let app: any = null;
let db: any = null;

export function initFirebase() {
  const config = getFirebaseConfig();
  
  if (!config.databaseURL) {
    console.log('⚠️ Firebase not configured - set credentials in Settings');
    return null;
  }
  
  try {
    app = initializeApp(config);
    db = getDatabase(app);
    console.log('✅ Firebase initialized');
    return { app, db };
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return null;
  }
}

// Auto-initialize
const firebase = initFirebase();
if (firebase) {
  app = firebase.app;
  db = firebase.db;
}

export { db, app };

// Helper functions
export const subscribeToData = (path: string, callback: (data: any) => void) => {
  if (!db) {
    console.warn('Firebase not initialized');
    return () => {};
  }
  const dataRef = ref(db, path);
  return onValue(dataRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const updateData = (path: string, data: any) => {
  if (!db) return Promise.reject('Firebase not initialized');
  const dataRef = ref(db, path);
  return update(dataRef, data);
};

export const setData = (path: string, data: any) => {
  if (!db) return Promise.reject('Firebase not initialized');
  const dataRef = ref(db, path);
  return set(dataRef, data);
};

export const pushData = (path: string, data: any) => {
  if (!db) return Promise.reject('Firebase not initialized');
  const dataRef = ref(db, path);
  return push(dataRef, data);
};

// Get data once (for exports)
export const getData = (path: string): Promise<any> => {
  if (!db) return Promise.reject('Firebase not initialized');
  const dataRef = ref(db, path);
  return new Promise((resolve, reject) => {
    onValue(dataRef, (snapshot) => {
      resolve(snapshot.val());
    }, reject, { onlyOnce: true });
  });
};