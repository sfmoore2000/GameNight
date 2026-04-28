import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import firebaseConfigImport from '../../firebase-applet-config.json';

const getFirebaseConfig = () => {
  const config = {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || (firebaseConfigImport as any).apiKey,
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || (firebaseConfigImport as any).authDomain,
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || (firebaseConfigImport as any).projectId,
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || (firebaseConfigImport as any).storageBucket,
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || (firebaseConfigImport as any).messagingSenderId,
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || (firebaseConfigImport as any).appId,
    measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || (firebaseConfigImport as any).measurementId,
    firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_DATABASE_ID as string) || (firebaseConfigImport as any).firestoreDatabaseId,
  };

  // Mask sensitive values for logging to help user verify they are loaded
  const maskedConfig = {
    ...config,
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 5)}...` : 'MISSING',
    projectId: config.projectId || 'MISSING',
    appId: config.appId ? 'PRESENT' : 'MISSING',
  };

  console.log('Firebase Config loaded:', maskedConfig);

  if (!config.apiKey || !config.projectId) {
    console.error('CRITICAL: Firebase Configuration is missing fields. Ensure VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID are set in Vercel.', maskedConfig);
  }

  return config;
};

const firebaseConfig = getFirebaseConfig();

let app: any;
let db: any;
let auth: any;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    auth = getAuth(app);
  } else {
    console.warn("Firebase was not initialized: missing API Key or Project ID.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

export { db, auth };

// Critical connection test helper
export async function testConnection() {
  if (!db) {
    console.error("Cannot test connection: Firestore (db) is not initialized.");
    return;
  }
  try {
    // Explicitly check server connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection test successful.");
  } catch (error) {
    const err = error as any;
    if (err.message?.includes('the client is offline') || err.code === 'unavailable') {
      console.error("Firebase Connection Error: The client is offline.");
      console.error("This usually means the Project ID or API Key is incorrect, or the Firebase project hasn't been fully provisioned/configured.");
      console.error("Current Project ID being used:", firebaseConfig.projectId);
    } else if (err.code === 'permission-denied') {
      console.log("Firebase connection test: Reachable, but access denied (expected if rules are strict).");
    } else {
      console.error("Connection test failed with unknown error:", err);
    }
  }
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const authInfo = auth.currentUser ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || '',
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerInfo: auth.currentUser.providerData.map(p => ({
      providerId: p.providerId,
      displayName: p.displayName || '',
      email: p.email || '',
    }))
  } : {
    userId: 'anonymous',
    email: '',
    emailVerified: false,
    isAnonymous: true,
    providerInfo: []
  };

  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo
  };

  throw new Error(JSON.stringify(errorInfo));
}
