import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            console.log('Initiating Native Google Sign-In...');
            const webClientId = '900766773228-18ih7jtctcqv60up90djcg1ifee2h270.apps.googleusercontent.com';
            console.log('Using Web Client ID:', webClientId);
            
            // For Capacitor Firebase Auth, it's often better to specify the clientId if it fails
            const result = await FirebaseAuthentication.signInWithGoogle();
            console.log('Native Google Sign-In result:', JSON.stringify(result));
            
            if (!result.credential?.idToken) {
                console.error('Missing ID Token in result');
                throw new Error('No ID Token returned from Google Sign-In. Check SHA-1/SHA-256 in Firebase Console.');
            }
            
            console.log('Creating Firebase credential with ID Token...');
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            const userCredential = await signInWithCredential(auth, credential);
            console.log('Firebase Sign-In successful for native platform');
            return userCredential;
        } else {
            console.log('Initiating Web Google Sign-In (Popup)...');
            return await signInWithPopup(auth, googleProvider);
        }
    } catch (error: any) {
        console.error('Google Sign-In comprehensive error:', error);
        const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
        console.error('Stringified error:', JSON.stringify(error));
        
        // Detailed error for native debugging
        if (Capacitor.isNativePlatform()) {
            alert(`Google Login Error: ${errorMessage}\n\nMake sure SHA-1 and SHA-256 are added to Firebase Console.`);
        }
        
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

import { storageService } from './storageService';
...
export const logOut = async () => {
    try {
        await storageService.removeItem('guest_user');
        if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signOut();
        }
        return await signOut(auth);
    } catch (error) {
...        console.error('Logout error:', error);
        throw error;
    }
};
