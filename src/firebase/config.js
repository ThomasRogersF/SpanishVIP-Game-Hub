import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);

let app, db, rtdb, auth;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  auth = getAuth(app);
} else {
  console.warn("Firebase not configured — running in demo mode. Add .env variables to enable multiplayer.");
  // Export null-safe stubs so imports don't break
  db = null;
  rtdb = null;
  auth = null;
}

export { db, rtdb, auth };
