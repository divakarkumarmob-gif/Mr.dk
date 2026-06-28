import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
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

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
        }
        return userCredential;
    } catch (error) {
        console.error('Email Sign-Up error:', error);
        throw error;
    }
};

export const resetPassword = async (email: string) => {
    try {
        return await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error('Reset Password error:', error);
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
