import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {initializeFirestore} from 'firebase/firestore';
import {getStorage} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

console.log("Firebase config loaded:", firebaseConfig);
console.log("Firebase SDK Version: 12.12.1");

const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
};
console.log("Final config being used (API key redacted):", { ...config, apiKey: "***" });

const app = initializeApp(config);
console.log("Firebase app initialized. name:", app.name, "options:", { ...app.options, apiKey: "***" });

const dbId = firebaseConfig.firestoreDatabaseId;
console.log("Attempting to initialize Firestore with DB ID:", dbId);
export const db = initializeFirestore(app, {}, dbId);
console.log("Firestore successfully initialized with DB ID:", dbId);

export const auth = getAuth();
console.log("Auth initialized.");

export const storage = getStorage(app, firebaseConfig.storageBucket);
console.log("Storage initialized.");

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: any; // Simplified for this implementation
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    // @ts-ignore
    code: error?.code, // Try to capture Firebase error code
    authInfo: {
      userId: auth.currentUser?.uid,
      // email and provider email removed for security
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Detailed:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
