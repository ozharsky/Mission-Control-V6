import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update } from 'firebase/database';

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
export const db = getDatabase(app);

// Helper functions
export const subscribeToData = (path: string, callback: (data: any) => void) => {
  const dataRef = ref(db, path);
  return onValue(dataRef, (snapshot) => {
    callback(snapshot.val());
  });
};

export const updateData = (path: string, data: any) => {
  const dataRef = ref(db, path);
  return update(dataRef, data);
};

export const setData = (path: string, data: any) => {
  const dataRef = ref(db, path);
  return set(dataRef, data);
};

export const pushData = (path: string, data: any) => {
  const dataRef = ref(db, path);
  return push(dataRef, data);
};