import { db } from './firebase';
import { collection, deleteDoc, getDocs, doc } from 'firebase/firestore';

export async function clearGuestData(uid: string) {
    if (!uid.startsWith('local_guest_')) {
        console.warn('Attempted to clear non-guest data:', uid);
        return;
    }

    const collectionsToClear = [
        `users/${uid}/results`,
        `users/${uid}/analytics_v2`,
        `users/${uid}/telegramLectures`,
        `users/${uid}/ai-study-plan-chats`
    ];

    for (const path of collectionsToClear) {
        const colRef = collection(db, path);
        const snapshot = await getDocs(colRef);
        for (const document of snapshot.docs) {
            await deleteDoc(document.ref);
        }
    }

    // Delete the user document itself
    const userDocRef = doc(db, 'users', uid);
    await deleteDoc(userDocRef);
}
