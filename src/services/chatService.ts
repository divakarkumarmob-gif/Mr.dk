import { db, storage, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { Message } from '../types';

export const initializeChat = async (userId: string) => {
    const chatRef = doc(db, 'chats', userId);
    try {
        const docSnap = await getDoc(chatRef);
        if (!docSnap.exists()) {
            await setDoc(chatRef, { 
                participants: [userId, 'admin'], 
                isSupportChat: true, 
                lastMessage: '', 
                updatedAt: serverTimestamp() 
            });
        }
        return userId;
    } catch (error) {
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
  const messageData = {
    senderId,
    text,
    timestamp: serverTimestamp(),
    ...(mediaUrl && { mediaUrl, mediaType }),
  };
  try {
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text || 'Media message',
        updatedAt: serverTimestamp(),
      });
  } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
  }
};

export const uploadMedia = async (file: File, path: string) => {
    try {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true,
            };
            fileToUpload = await imageCompression(file, options);
        }
        
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, fileToUpload);
        return getDownloadURL(snapshot.ref);
    } catch (error) {
        console.error('Error uploading media:', error);
        throw error;
    }
};
