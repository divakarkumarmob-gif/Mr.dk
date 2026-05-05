import {GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword} from 'firebase/auth';
import {auth} from './firebase';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        return await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error('Google Sign-In error:', error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, password: string) => {
    try {
        return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error('Email Sign-In error:', error);
        throw error;
    }
};

export const logOut = async () => {
    try {
        return await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};
