import { db, auth } from '../../lib/firebase';
import {
    doc, setDoc, deleteDoc, collection,
    query, orderBy, getDocs, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const MAX_SESSIONS = 2;
const SESSION_TOKEN_KEY = 'neet_session_token';

function detectDeviceType(): 'mobile' | 'desktop' {
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone/i.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

function getOrCreateSessionToken(): string {
    let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
        token = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
}

export async function registerSession(uid: string): Promise<void> {
    const token = getOrCreateSessionToken();
    const sessRef = doc(db, 'users', uid, 'sessions', token);

    await setDoc(sessRef, {
        token,
        deviceType: detectDeviceType(),
        userAgent: navigator.userAgent.substring(0, 200),
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp()
    }, { merge: true });

    try {
        const sessQ = query(
            collection(db, 'users', uid, 'sessions'),
            orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(sessQ);
        const total = snap.docs.length;
        if (total > MAX_SESSIONS) {
            const toEvict = snap.docs.slice(0, total - MAX_SESSIONS);
            await Promise.all(toEvict.map(d => deleteDoc(d.ref)));
        }
    } catch (e) {
        console.warn('Session eviction error:', e);
    }
}

export async function refreshSession(uid: string): Promise<void> {
    const token = getOrCreateSessionToken();
    const sessRef = doc(db, 'users', uid, 'sessions', token);
    await setDoc(sessRef, { lastActive: serverTimestamp() }, { merge: true }).catch(() => {});
}

export async function removeSession(uid: string): Promise<void> {
    const token = getOrCreateSessionToken();
    const sessRef = doc(db, 'users', uid, 'sessions', token);
    await deleteDoc(sessRef).catch(() => {});
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function watchSessionValidity(uid: string, onForcedLogout: () => void): () => void {
    const token = getOrCreateSessionToken();
    const sessRef = doc(db, 'users', uid, 'sessions', token);

    const unsubscribe = onSnapshot(sessRef, (snap) => {
        if (!snap.exists()) {
            sessionStorage.removeItem(SESSION_TOKEN_KEY);
            signOut(auth).catch(() => {});
            onForcedLogout();
        }
    }, (err) => {
        console.warn('Session watch error:', err);
    });

    return unsubscribe;
}
