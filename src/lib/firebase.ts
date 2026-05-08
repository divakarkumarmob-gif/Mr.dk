import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore, enableIndexedDbPersistence} from 'firebase/firestore';
import {getStorage} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
};
const app = initializeApp(config);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn('Multiple tabs open, persistence failed.');
  } else if (err.code == 'unimplemented') {
    console.warn('Browser does not support persistence.');
  }
});
export const auth = getAuth();
export const storage = getStorage(app, firebaseConfig.storageBucket);

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
