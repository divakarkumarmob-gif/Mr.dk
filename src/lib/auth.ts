import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signInAnonymously, signInWithCredential, fetchSignInMethodsForEmail, signInWithCustomToken, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth, getRecaptchaVerifier, resetRecaptchaVerifier } from './firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
    try {
        if (Capacitor.isNativePlatform()) {
            const webClientId = '900766773228-18ih7jtctcqv60up90djcg1ifee2h270.apps.googleusercontent.com';
            
            // For Capacitor Firebase Auth, it's often better to specify the clientId if it fails
            const result = await FirebaseAuthentication.signInWithGoogle();
            
            if (!result.credential?.idToken) {
                console.error('Missing ID Token in result');
                throw new Error('No ID Token returned from Google Sign-In. Check SHA-1/SHA-256 in Firebase Console.');
            }
            
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            const userCredential = await signInWithCredential(auth, credential);
            return userCredential;
        } else {
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

// Checks whether an account already exists for this Firebase email.
// Used by the new single-box login/signup flow to auto-detect
// "existing" vs "naya" user right after the identifier step.
export const checkAccountExists = async (email: string): Promise<boolean> => {
    try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        return methods.length > 0;
    } catch (error) {
        console.error('checkAccountExists error:', error);
        // Fail open to "new user" flow so we never hard-block sign up
        return false;
    }
};

// Signs in an existing user with a Firebase custom token issued by the
// backend after a successful OTP verification (passwordless login).
export const signInWithOtpToken = async (token: string) => {
    try {
        return await signInWithCustomToken(auth, token);
    } catch (error) {
        console.error('OTP custom-token Sign-In error:', error);
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

// ---- Phone Auth (real SMS via Firebase) ------------------------------------
// Native Android/iOS: @capacitor-firebase/authentication handles app
// verification (Play Integrity / silent verification) internally, no
// reCAPTCHA widget needed.
// Web: uses an invisible reCAPTCHA + the Firebase JS SDK's signInWithPhoneNumber.

// Holds the pending web confirmation so verifyPhoneOtp can complete it.
let webConfirmationResult: ConfirmationResult | null = null;

// Normalizes a raw 10-digit (or already-plus-prefixed) number into E.164
// format. Defaults to India (+91) since that's the only allowed SMS region
// configured in the Firebase console for this project.
const toE164 = (rawPhone: string) => {
    const clean = rawPhone.trim();
    if (clean.startsWith('+')) return clean;
    const digitsOnly = clean.replace(/[^\d]/g, '');
    return `+91${digitsOnly}`;
};

// Sends a real SMS OTP to the given phone number. Returns nothing on native
// (the plugin manages verification state internally); on web it stashes the
// confirmationResult so verifyPhoneOtp can use it.
export const sendPhoneOtp = async (rawPhone: string, recaptchaContainerId?: string) => {
    const phoneNumber = toE164(rawPhone);
    try {
        if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
            return;
        }
        const verifier = getRecaptchaVerifier(recaptchaContainerId);
        webConfirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    } catch (error) {
        console.error('sendPhoneOtp error:', error);
        resetRecaptchaVerifier();
        throw error;
    }
};

// Confirms the SMS code the user typed in. Completes sign-in on success.
export const verifyPhoneOtp = async (code: string) => {
    try {
        if (Capacitor.isNativePlatform()) {
            const result = await FirebaseAuthentication.confirmVerificationCode({ verificationCode: code });
            return result;
        }
        if (!webConfirmationResult) {
            throw new Error('No pending phone verification. Please request a new OTP.');
        }
        const userCredential = await webConfirmationResult.confirm(code);
        webConfirmationResult = null;
        return userCredential;
    } catch (error) {
        console.error('verifyPhoneOtp error:', error);
        throw error;
    }
};

import { storageService } from './storageService';

export const logOut = async () => {
    try {
        await storageService.removeItem('guest_user');
        if (Capacitor.isNativePlatform()) {
            await FirebaseAuthentication.signOut();
        }
        return await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};
