import { db, storage, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { Message } from '../types';

// Firestore security rules for chats/{chatId}/messages require the parent
// chats/{chatId} doc to already exist with a participants array containing
// the current user — otherwise every read/write to the subcollection is
// silently denied (the error only surfaces once the write's catch handler
// calls handleFirestoreError, and even then, callers that don't await/log
// it never see anything). initializeChat() creates that parent doc for
// support chats, but the "{uid}_ai" personal AI chat used by the live
// voice interface and the WhatsApp-style chat history never went through
// initializeChat, so its parent doc frequently doesn't exist — silently
// blocking every message in that chat. This helper is called from
// sendMessage/saveAIMessage so any chat gets its parent doc created
// on-demand the first time something is written to it.
const ensureChatDocExists = async (chatId: string, userId: string) => {
    try {
        const chatRef = doc(db, 'chats', chatId);
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
            await setDoc(chatRef, {
                participants: [userId],
                isSupportChat: false,
                lastMessage: '',
                updatedAt: serverTimestamp(),
            });
        }
    } catch (error) {
        // Don't block the actual message send on this — if it fails here,
        // the subsequent addDoc will fail too and surface its own error.
        console.error(`[Chat] Failed to ensure parent doc for ${chatId}:`, error);
    }
};

export const initializeChat = async (userId: string) => {
    const chatRef = doc(db, 'chats', userId);
    try {
        const docSnap = await getDoc(chatRef);
        if (!docSnap.exists()) {
            await setDoc(chatRef, { 
                participants: [userId, 'admin'], 
                isSupportChat: true, 
                lastMessage: '', 
                updatedAt: serverTimestamp(),
                lastInteraction: Date.now(),
                summaryGenerated: false,
                sessionActive: true
            });
        } else {
            await updateLastInteraction(userId); // Ensure it's active
        }
        return userId;
    } catch (error) {
        console.error(`[Chat] Initialize error for ${userId}:`, error);
        handleFirestoreError(error, OperationType.WRITE, `chats/${userId}`);
        throw error;
    }
};

export const getUserName = async (userId: string) => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return 'Unknown User';
        const data = userDoc.data();
        return data.displayName || data.username || (data.email ? data.email.split('@')[0] : null) || 'User';
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
        return 'Unknown User';
    }
};

export const getUserPhone = async (userId: string): Promise<string | null> => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return null;
        const data = userDoc.data();
        return data.phone || data.phoneNumber || null;
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
        return null;
    }
};

export const subscribeToMessages = (chatId: string, callback: (messages: Message[]) => void) => {
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });
};

export const subscribeToChats = (callback: (chats: any[]) => void) => {
    if (!auth.currentUser) {
        throw new Error('User not logged in');
    }
    
    const currentUser = auth.currentUser;
    let unsub: (() => void) | null = null;
    let isSubscribed = true;

    currentUser.getIdTokenResult().then((idTokenResult) => {
        if (!isSubscribed) return;
        const isAdmin = idTokenResult.claims.admin === true;
        let q;
        if (isAdmin) {
            q = query(
                collection(db, 'chats'), 
                where('isSupportChat', '==', true),
                orderBy('updatedAt', 'desc')
            );
        } else {
            q = query(
                collection(db, 'chats'), 
                where('participants', 'array-contains', currentUser.uid),
                orderBy('updatedAt', 'desc')
            );
        }
        unsub = onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'chats');
        });
    }).catch((error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => {
        isSubscribed = false;
        if (unsub) unsub();
    };
};

export const subscribeToSupportChats = (callback: (chats: any[]) => void) => {
    if (!auth.currentUser) return () => {};
    
    const currentUser = auth.currentUser;
    let unsub: (() => void) | null = null;
    let isSubscribed = true;

    currentUser.getIdTokenResult().then((idTokenResult) => {
        if (!isSubscribed) return;
        const isAdmin = idTokenResult.claims.admin === true;
        let q;
        if (isAdmin) {
            q = query(collection(db, 'chats'), where('isSupportChat', '==', true), orderBy('updatedAt', 'desc'));
        } else {
            q = query(
                collection(db, 'chats'), 
                where('isSupportChat', '==', true), 
                where('participants', 'array-contains', currentUser.uid),
                orderBy('updatedAt', 'desc')
            );
        }
        unsub = onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'chats');
        });
    }).catch((error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => {
        isSubscribed = false;
        if (unsub) unsub();
    };
};

export const updateUserPresence = async (userId: string, isOnline: boolean) => {
    try {
        await setDoc(doc(db, 'users', userId), {
            online: isOnline,
            lastSeen: serverTimestamp(),
        }, { merge: true });
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    }
};

export const subscribeToUserPresence = (userId: string, callback: (presence: { online: boolean; lastSeen: any }) => void) => {
    if (!userId) return () => {};
    return onSnapshot(doc(db, 'users', userId), (snap) => {
        if (!snap.exists()) {
            callback({ online: false, lastSeen: null });
            return;
        }
        const data = snap.data();
        callback({ online: !!data.online, lastSeen: data.lastSeen || null });
    }, (error) => {
        console.error('[Presence] Subscription error:', error);
    });
};

export const updateLastInteraction = async (chatId: string) => {
    try {
        await updateDoc(doc(db, 'chats', chatId), {
            lastInteraction: Date.now(),
            summaryGenerated: false,
            sessionActive: true
        });
    } catch (error) {
        console.error(`[Chat] Update interaction error:`, error);
        handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}`);
    }
};

export const starMessage = async (chatId: string, messageId: string, starred: boolean) => {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, { starred });
};

export const sendMessage = async (chatId: string, senderId: string, text: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio', replyTo?: { text: string; senderId: string } | null) => {
  if (auth.currentUser) {
      await ensureChatDocExists(chatId, auth.currentUser.uid);
  }
  const messageData = {
    senderId,
    text,
    timestamp: serverTimestamp(),
    ...(mediaUrl && { mediaUrl, mediaType }),
    ...(replyTo && { replyTo }),
  };
  try {
      const messagesCol = collection(db, `chats/${chatId}/messages`);
      await addDoc(messagesCol, messageData);
      
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text || 'Media message',
        updatedAt: serverTimestamp(),
      });
      await updateLastInteraction(chatId);
  } catch (error) {
      console.error(`[Chat] Send message error:`, error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
  }
};

export const saveAIMessage = async (userId: string, messageData: any) => {
    try {
        const aiChatId = `${userId}_ai`;
        await ensureChatDocExists(aiChatId, userId);
        const messagesCol = collection(db, `chats/${aiChatId}/messages`);
        await addDoc(messagesCol, {
            ...messageData,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error(`[Chat] Error saving AI message:`, error);
        handleFirestoreError(error, OperationType.WRITE, `chats/${userId}_ai/messages`);
    }
};

export const uploadMedia = async (file: File, path: string) => {
    const convertToBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    try {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
            try {
                const options = {
                    maxSizeMB: 0.15,
                    maxWidthOrHeight: 800,
                    useWebWorker: false,
                };
                fileToUpload = await imageCompression(file, options);
            } catch (compErr) {
                console.error('[ChatService] Image compression failed, trying original:', compErr);
                // Continue with original file if compression fails
            }
        } else if (file.size > 600 * 1024) {
            throw new Error(`Media file is too large. Max allowed size is 600KB.`);
        }
        
        console.log('[ChatService] Attempting to upload to:', path);
        const storageRef = ref(storage, path);
        
        try {
            // Attempt standard Cloud Storage upload with 2.5s timeout
            const url = await new Promise<string>(async (resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Firebase Storage timeout.'));
                }, 2500);

                try {
                    const snapshot = await uploadBytes(storageRef, fileToUpload);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    clearTimeout(timeoutId);
                    resolve(downloadURL);
                } catch (err) {
                    clearTimeout(timeoutId);
                    reject(err);
                }
            });
            return url;
        } catch (storageErr) {
            console.warn('[ChatService] Storage upload failed, attempting Base64 fallback:', storageErr);
            const base64 = await convertToBase64(fileToUpload);
            if (base64.length > 800000) {
                throw new Error('Media file is too large for offline/fallback upload. Max size 600KB.');
            }
            return base64;
        }
    } catch (error) {
        console.error('[ChatService] Error uploading media:', error);
        throw error;
    }
};
