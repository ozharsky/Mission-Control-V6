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

// Initialize Firebase only if config exists
const config = getFirebaseConfig();
let app: any = null;
let db: any = null;

if (config.apiKey && config.databaseURL) {
  app = initializeApp(config);
  db = getDatabase(app);
} else {
  console.warn('Firebase not configured. Please set credentials in Settings.');
}

export { db };

// Helper functions with null checks
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
  if (!db) {
    console.warn('Firebase not initialized');
    return Promise.reject('Firebase not initialized');
  }
  const dataRef = ref(db, path);
  return update(dataRef, data);
};

export const setData = (path: string, data: any) => {
  if (!db) {
    console.warn('Firebase not initialized');
    return Promise.reject('Firebase not initialized');
  }
  const dataRef = ref(db, path);
  return set(dataRef, data);
};

export const pushData = (path: string, data: any) => {
  if (!db) {
    console.warn('Firebase not initialized');
    return Promise.reject('Firebase not initialized');
  }
  const dataRef = ref(db, path);
  return push(dataRef, data);
};