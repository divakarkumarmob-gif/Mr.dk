import { db, storage, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { Message } from '../types';

export const initializeChat = async (userId: string) => {
    console.log(`[Chat] Initializing chat for user: ${userId}`);
    const chatRef = doc(db, 'chats', userId);
    try {
        const docSnap = await getDoc(chatRef);
        if (!docSnap.exists()) {
            console.log(`[Chat] Creating new support chat for: ${userId}`);
            await setDoc(chatRef, { 
                participants: [userId, 'admin'], 
                isSupportChat: true, 
                lastMessage: '', 
                updatedAt: serverTimestamp() 
            });
        } else {
            console.log(`[Chat] Chat already exists for: ${userId}`);
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
        return userDoc.exists() ? userDoc.data().displayName || 'User' : 'Unknown User';
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
        return 'Unknown User';
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
    
    const adminEmails = ['divakarkumarmob@gmail.com', 'shashikumarmob@gmail.com'];
    const isAdmin = adminEmails.includes(auth.currentUser.email || '');
    
    console.log('DEBUG: currentUser email:', auth.currentUser.email, 'isAdmin:', isAdmin);
    
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
            where('participants', 'array-contains', auth.currentUser.uid),
            orderBy('updatedAt', 'desc')
        );
    }
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
    });
};

export const subscribeToSupportChats = (callback: (chats: any[]) => void) => {
    if (!auth.currentUser) return () => {};
    
    const adminEmails = ['divakarkumarmob@gmail.com', 'shashikumarmob@gmail.com'];
    const isAdmin = adminEmails.includes(auth.currentUser.email || '');
    
    let q;
    if (isAdmin) {
        q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
    } else {
        q = query(
            collection(db, 'chats'), 
            where('isSupportChat', '==', true), 
            orderBy('updatedAt', 'desc')
        );
    }
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
    });
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

export const sendMessage = async (chatId: string, senderId: string, text: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
  console.log(`[Chat] Sending message to ${chatId} from ${senderId}`);
  const messageData = {
    senderId,
    text,
    timestamp: serverTimestamp(),
    ...(mediaUrl && { mediaUrl, mediaType }),
  };
  try {
      const messagesCol = collection(db, `chats/${chatId}/messages`);
      await addDoc(messagesCol, messageData);
      console.log(`[Chat] Message added to subcollection`);
      
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text || 'Media message',
        updatedAt: serverTimestamp(),
      });
      console.log(`[Chat] Parent chat doc updated`);
  } catch (error) {
      console.error(`[Chat] Send message error:`, error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
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
            const options = {
                maxSizeMB: 0.15,
                maxWidthOrHeight: 800,
                useWebWorker: false,
            };
            fileToUpload = await imageCompression(file, options);
        } else if (file.size > 600 * 1024) {
            throw new Error(`Media file is too large. Max allowed size is 600KB.`);
        }
        
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
            console.warn('Storage chat media upload bypassed or timed out, using secure Base64 local format:', storageErr);
            return await convertToBase64(fileToUpload);
        }
    } catch (error) {
        console.error('Error uploading media:', error);
        throw error;
    }
};
