import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            const result = await FirebaseAuthentication.signInWithGoogle();
            if (!result.credential?.idToken) {
                throw new Error('No ID Token returned from Google Sign-In');
            }
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            return await signInWithCredential(auth, credential);
        } else {
            await signInWithPopup(auth, googleProvider);
        }
    } catch (error) {
        console.error('Google Sign-In error details:', JSON.stringify(error));
        alert('Google Sign-In failed. Please check the logs.');
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

export const signInAsGuest = async (displayName: string) => {
    try {
        const userCredential = await signInAnonymously(auth);
        if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
        }
        return userCredential;
    } catch (error) {
        console.error('Anonymous Sign-In error:', error);
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
        localStorage.removeItem('guest_user');
        if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signOut();
        }
        return await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};
