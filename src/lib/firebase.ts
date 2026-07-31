import {initializeApp} from 'firebase/app';
import {getAuth, RecaptchaVerifier} from 'firebase/auth';
import {initializeFirestore} from 'firebase/firestore';
import {getStorage} from 'firebase/storage';
import {getMessaging} from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const config = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
};

const app = initializeApp(config);

const dbId = firebaseConfig.firestoreDatabaseId;
export const db = initializeFirestore(app, {}, dbId);

export const auth = getAuth();

export const storage = getStorage(app, firebaseConfig.storageBucket);

export const messaging = getMessaging(app);

// ---- Phone Auth: invisible reCAPTCHA verifier (web only) ------------------
// Native Android/iOS uses @capacitor-firebase/authentication instead, which
// handles app verification natively (no reCAPTCHA widget needed there).
let recaptchaVerifier: RecaptchaVerifier | null = null;

export function getRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    });
  }
  return recaptchaVerifier;
}

export function resetRecaptchaVerifier() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {
      console.warn('Error clearing reCAPTCHA verifier:', e);
    }
  }
  recaptchaVerifier = null;
  // .clear() removes the widget's own children, but on some retries a stray
  // wrapper node can be left behind. Force the container empty so the next
  // getRecaptchaVerifier() call always renders into a clean element.
  const container = document.getElementById('recaptcha-container');
  if (container) {
    container.innerHTML = '';
  }
}

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

// IMPORTANT: never throw from here. Callers use this from onSnapshot
// listener error callbacks (chatService, StudyDashboard, Flashcards,
// NeuralSolver, etc.) as well as from catch blocks. Throwing inside a
// listener's error callback is an uncaught exception with no one left to
// catch it, which crashes the entire app for every user whose listener
// happens to hit that error at the same time — e.g. right after a fresh
// install, or the instant an admin broadcast trips a Firestore rule.
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
}
