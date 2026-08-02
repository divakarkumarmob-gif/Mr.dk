import { useState, useEffect, useRef } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff, HelpCircle, User, KeyRound, ArrowLeft, Check, Smartphone } from 'lucide-react';
import PosterSlider from './PosterSlider';
import Pressable from './Pressable';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import { getApiUrl, authFetch } from '@/utils/api';
import { updateProfile } from 'firebase/auth';
import { auth, resetRecaptchaVerifier } from '@/lib/firebase';

// ---- Wizard step machine -------------------------------------------------
// IDENTIFIER       -> single box, auto-detects email vs phone
// PASSWORD         -> existing email user, password + login
// OTP              -> new email / existing phone / new phone, 4-digit code
// SET_PASSWORD     -> new email user only, choose a password after OTP
// USERNAME         -> new user only, name + terms checkbox, then finish
// FORGOT_OTP       -> existing email user forgot password: OTP sent to email
// FORGOT_NEW_PASSWORD -> after OTP verified, choose a new password
type Step = 'IDENTIFIER' | 'PASSWORD' | 'OTP' | 'SET_PASSWORD' | 'USERNAME' | 'FORGOT_OTP' | 'FORGOT_NEW_PASSWORD';
type IdentifierKind = 'email' | 'phone' | null;

const AUTO_ADVANCE_DELAY = 550; // ms - feels instant but lets the user finish typing

export default function Login() {
  const [step, _setStep] = useState<Step>('IDENTIFIER');
  const setStep = (v: Step) => {
    window.history.pushState({ ...window.history.state, loginStep: v }, '');
    _setStep(v);
  };

  const [identifier, setIdentifier] = useState('');
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>(null);
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null);

  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Forgot-password flow
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState(false);
  const [isVerifyingForgotOtp, setIsVerifyingForgotOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCheckingIdentifier, setIsCheckingIdentifier] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Resend-OTP anti-spam cooldown: 1st resend waits 30s, 2nd waits 2min,
  // after that we stop offering a timer and show "Try another method" instead.
  const RESEND_COOLDOWNS = [30, 120]; // seconds, indexed by resend attempt number
  const [resendCount, setResendCount] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendCooldown = (seconds: number) => {
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    setResendSecondsLeft(seconds);
    resendIntervalRef.current = setInterval(() => {
      setResendSecondsLeft((prev) => {
        if (prev <= 1) {
          if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearResendCooldown = () => {
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = null;
    setResendSecondsLeft(0);
    setResendCount(0);
  };

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [termsNoticeMessage, setTermsNoticeMessage] = useState<string | null>(null);
  const termsNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isGuestMode, _setIsGuestMode] = useState(false);
  const setIsGuestMode = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, loginSubView: 'guest' }, '');
    _setIsGuestMode(v);
  };
  const [guestName, setGuestName] = useState('');
  const [isLoggingInGuest, setIsLoggingInGuest] = useState(false);

  const [legalView, _setLegalView] = useState<'terms' | 'privacy' | null>(null);
  const setLegalView = (v: 'terms' | 'privacy' | null) => {
    if (v) window.history.pushState({ ...window.history.state, legalView: v }, '');
    _setLegalView(v);
  };

  // Debounce handle for auto-advance on the identifier box
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoVerifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (legalView && !e.state?.legalView) {
        _setLegalView(null);
      } else if (isGuestMode && !e.state?.loginSubView) {
        _setIsGuestMode(false);
      } else if (e.state?.loginStep) {
        _setStep(e.state.loginStep);
      } else if (!e.state?.loginStep) {
        _setStep('IDENTIFIER');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGuestMode, legalView]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
      if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
      if (termsNoticeTimer.current) clearTimeout(termsNoticeTimer.current);
    };
  }, []);

  const showError = (message: string) => setErrorMessage(message);
  const showSuccess = (message: string) => setSuccessMessage(message);
  const showTermsNotice = () => {
    if (termsNoticeTimer.current) clearTimeout(termsNoticeTimer.current);
    setTermsNoticeMessage('Please accept the Terms and Privacy Policy to continue');
    termsNoticeTimer.current = setTimeout(() => setTermsNoticeMessage(null), 1000);
  };

  const resetWizard = () => {
    setIdentifier('');
    setIdentifierKind(null);
    setIsExistingUser(null);
    setPassword('');
    setName('');
    setOtp('');
    setTestOtp(null);
    setAgreeTerms(false);
    setForgotOtp('');
    setNewPassword('');
    setResetToken(null);
    resetRecaptchaVerifier();
    clearResendCooldown();
  };

  const getFirebaseEmail = (ident: string) => {
    const clean = ident.trim();
    if (clean.includes('@')) return clean;
    return `${clean}@neetmaster.com`;
  };

  // ---- Step 1: Identifier (single box, auto-detect + auto-advance) -------

  const validateIdentifier = (raw: string): IdentifierKind => {
    const clean = raw.trim();
    if (!clean) return null;
    if (clean.includes('@')) {
      // simple, forgiving email shape check
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
      return looksLikeEmail ? 'email' : null;
    }
    const digitsOnly = clean.replace(/[+\-\s]/g, '');
    if (/^\d{10,15}$/.test(digitsOnly)) return 'phone';
    return null;
  };

  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    const kind = validateIdentifier(value);
    setIdentifierKind(kind);
  };

  const proceedFromIdentifier = async (rawValue?: string, kindOverride?: IdentifierKind) => {
    const value = (rawValue ?? identifier).trim();
    const kind = kindOverride ?? identifierKind;
    if (isCheckingIdentifier) return;
    if (!value || !kind) {
      showError('Please enter a valid Gmail address or 10-digit Mobile Number.');
      return;
    }

    setIsCheckingIdentifier(true);
    clearResendCooldown();
    try {
      if (kind === 'email') {
        const fbEmail = getFirebaseEmail(value);
        const response = await authFetch(getApiUrl('/api/check-email-user'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: fbEmail }),
        });
        const data = await response.json();
        const exists = !!data.exists;
        setIsExistingUser(exists);

        if (exists) {
          // Existing email -> password box -> login
          setStep('PASSWORD');
        } else {
          // New email -> OTP box (Brevo-delivered code)
          await sendOtp(value);
        }
      } else {
        // Phone: check existing/new via backend, then send a real SMS via Firebase
        const response = await authFetch(getApiUrl('/api/check-phone-user'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: toE164(value) }),
        });
        const data = await response.json();
        const exists = !!data.exists;
        setIsExistingUser(exists);
        await sendPhoneVerification(value);
      }
    } catch (error: any) {
      showError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsCheckingIdentifier(false);
    }
  };

  // Formats a raw 10-digit number into E.164 (+91XXXXXXXXXX), matching auth.ts
  const toE164 = (rawPhone: string) => {
    const clean = rawPhone.trim();
    if (clean.startsWith('+')) return clean;
    const digitsOnly = clean.replace(/[^\d]/g, '');
    return `+91${digitsOnly}`;
  };

  // ---- Email OTP (custom 4-digit code via backend + Brevo) ------------------

  const sendOtp = async (rawIdentifier?: string, isResend: boolean = false) => {
    if (isSendingOtp) return;
    const value = (rawIdentifier ?? identifier).trim();
    setIsSendingOtp(true);
    try {
      const response = await fetch(getApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

      if (data.testOtp) {
        setTestOtp(data.testOtp);
        showSuccess(`OTP generated! [Dev Mode] Testing Code: ${data.testOtp}`);
      } else {
        setTestOtp(null);
        showSuccess(`OTP sent successfully to ${value}!`);
      }
      setOtp('');
      setStep('OTP');

      if (isResend) {
        const nextCount = resendCount + 1;
        setResendCount(nextCount);
        const cooldown = RESEND_COOLDOWNS[Math.min(nextCount - 1, RESEND_COOLDOWNS.length - 1)];
        startResendCooldown(cooldown);
      }
    } catch (error: any) {
      showError(error.message || 'Failed to send OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyEmailOtp = async (code: string) => {
    const response = await fetch(getApiUrl('/api/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim(), otp: code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Invalid OTP');
  };

  // ---- Phone OTP (real SMS via Firebase Phone Auth) --------------------------

  const sendPhoneVerification = async (rawIdentifier?: string, isResend: boolean = false) => {
    if (isSendingOtp) return;
    const value = (rawIdentifier ?? identifier).trim();
    setIsSendingOtp(true);
    try {
      await sendPhoneOtp(value, 'recaptcha-container');
      setTestOtp(null);
      showSuccess(`OTP sent successfully to ${toE164(value)}!`);
      setOtp('');
      setStep('OTP');

      if (isResend) {
        const nextCount = resendCount + 1;
        setResendCount(nextCount);
        const cooldown = RESEND_COOLDOWNS[Math.min(nextCount - 1, RESEND_COOLDOWNS.length - 1)];
        startResendCooldown(cooldown);
      }
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/invalid-phone-number') {
        showError('Please enter a valid 10-digit mobile number.');
      } else if (code === 'auth/too-many-requests') {
        showError('Too many attempts. Please try again later.');
      } else {
        showError(error.message || 'Failed to send OTP.');
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ---- Combined OTP box (routes to email or phone verification) -------------

  const otpMaxLength = identifierKind === 'phone' ? 6 : 4;

  const handleOtpChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, otpMaxLength);
    setOtp(digitsOnly);

    if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
    if (digitsOnly.length === otpMaxLength) {
      // Auto-verify as soon as the last digit lands
      autoVerifyTimer.current = setTimeout(() => {
        verifyOtp(digitsOnly);
      }, 150);
    }
  };

  const verifyOtp = async (code?: string) => {
    const value = code ?? otp;
    if (isVerifyingOtp) return;
    if (value.length !== otpMaxLength) {
      showError(`Please enter the ${otpMaxLength}-digit OTP.`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      if (identifierKind === 'phone') {
        // Real Firebase Phone Auth verification - this itself completes sign-in
        // for BOTH existing and new phone users (Firebase creates the account
        // automatically on first-time verification).
        setIsLoggingIn(true);
        try {
          await verifyPhoneOtp(value);
        } finally {
          setIsLoggingIn(false);
        }
        showSuccess('OTP verified successfully!');

        if (isExistingUser) {
          // Existing phone user is now fully signed in - nothing else to do.
          return;
        }
        // New phone user is signed in too, but still needs a display name.
        setStep('USERNAME');
      } else {
        // Email OTP goes through our own backend + Brevo
        await verifyEmailOtp(value);
        showSuccess('OTP verified successfully!');
        setStep('SET_PASSWORD');
      }
    } catch (error: any) {
      const code2 = error?.code || '';
      if (code2 === 'auth/invalid-verification-code' || code2 === 'auth/code-expired') {
        showError('Invalid or expired OTP. Please try again.');
      } else {
        showError(error.message || 'Invalid OTP code. Please try again.');
      }
      setOtp('');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ---- Existing email login (password box) --------------------------------

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showError('Please enter your Email/Mobile and Password.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const fbEmail = getFirebaseEmail(identifier);
      await signInWithEmail(fbEmail, password);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        showError('Invalid Email/Mobile or password.');
      } else if (error.code === 'auth/wrong-password') {
        showError('Wrong password.');
      } else {
        showError(error.message || 'Login failed!');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ---- New user: set password (email only) then continue to username -----

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (value.trim().length >= 6) {
      autoAdvanceTimer.current = setTimeout(() => {
        setStep('USERNAME');
      }, AUTO_ADVANCE_DELAY);
    }
  };

  // ---- New user: username + terms, then create account --------------------

  const canFinishSignUp = name.trim() !== '' && agreeTerms;

  const handleCompleteSignUp = async () => {
    if (!name.trim()) {
      showError('Please enter your Name.');
      return;
    }
    if (!agreeTerms) {
      showError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    if (identifierKind === 'email' && (!password.trim() || password.length < 6)) {
      showError('Password must be at least 6 characters.');
      setStep('SET_PASSWORD');
      return;
    }

    setIsSubmittingProfile(true);
    try {
      if (identifierKind === 'email') {
        const fbEmail = getFirebaseEmail(identifier);
        await signUpWithEmail(fbEmail, password, name.trim());
      } else {
        // Phone signup: Firebase Phone Auth already created and signed in the
        // account the moment the OTP was verified. Just attach the display name.
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: name.trim() });
        }
      }
      showSuccess(`Welcome ${name.trim()}! Account created successfully.`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        showError('This Email or Mobile Number is already registered.');
      } else if (error.code === 'auth/weak-password') {
        showError('Password is too weak.');
      } else {
        showError(error.message || 'Registration failed.');
      }
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // ---- Misc -----------------------------------------------------------------


  // ---- Forgot password (OTP-based) -----------------------------------------
  // 1. Send a 4-digit OTP to the user's email (same backend/Brevo path as signup OTP)
  // 2. User enters the OTP -> verified against backend, returns a short-lived resetToken
  // 3. User chooses a new password -> sent to backend along with resetToken
  // 4. Back to the identifier box; user re-enters email, system detects existing
  //    user again, and they log in with the new password.

  const handleForgotPassword = async () => {
    if (isSendingForgotOtp) return;
    const email = identifier.trim();
    if (!email) {
      showError('Please enter your Email address first.');
      return;
    }
    if (!email.includes('@')) {
      showError('Forgot password is only supported for Email accounts right now.');
      return;
    }
    setIsSendingForgotOtp(true);
    try {
      const response = await fetch(getApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

      if (data.testOtp) {
        setTestOtp(data.testOtp);
        showSuccess(`OTP generated! [Dev Mode] Testing Code: ${data.testOtp}`);
      } else {
        setTestOtp(null);
        showSuccess(`OTP sent to ${email} to reset your password.`);
      }
      setForgotOtp('');
      setNewPassword('');
      setResetToken(null);
      clearResendCooldown();
      setStep('FORGOT_OTP');
    } catch (error: any) {
      showError(error.message || 'Failed to send OTP.');
    } finally {
      setIsSendingForgotOtp(false);
    }
  };

  const forgotOtpMaxLength = 4;

  const handleForgotOtpChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, forgotOtpMaxLength);
    setForgotOtp(digitsOnly);

    if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
    if (digitsOnly.length === forgotOtpMaxLength) {
      autoVerifyTimer.current = setTimeout(() => {
        verifyForgotOtp(digitsOnly);
      }, 150);
    }
  };

  const verifyForgotOtp = async (code?: string) => {
    const value = code ?? forgotOtp;
    if (isVerifyingForgotOtp) return;
    if (value.length !== forgotOtpMaxLength) {
      showError(`Please enter the ${forgotOtpMaxLength}-digit OTP.`);
      return;
    }
    setIsVerifyingForgotOtp(true);
    try {
      const response = await fetch(getApiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp: value, purpose: 'password-reset' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid OTP');

      setResetToken(data.resetToken);
      showSuccess('OTP verified! Now choose your new password.');
      setStep('FORGOT_NEW_PASSWORD');
    } catch (error: any) {
      showError(error.message || 'Invalid OTP code. Please try again.');
      setForgotOtp('');
    } finally {
      setIsVerifyingForgotOtp(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (isResettingPassword) return;
    if (newPassword.trim().length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }
    if (!resetToken) {
      showError('Reset session expired. Please verify OTP again.');
      setStep('PASSWORD');
      return;
    }
    setIsResettingPassword(true);
    try {
      const response = await fetch(getApiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newPassword.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      showSuccess('Password updated! Please log in with your new password.');
      // Back to the identifier box, fully reset, so the user re-enters their
      // email and the system re-detects them as an existing user.
      setStep('IDENTIFIER');
      resetWizard();
    } catch (error: any) {
      showError(error.message || 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!agreeTerms) {
      showTermsNotice();
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      showError('Google login failed!');
    }
  };

  const handleGuestSubmit = async () => {
    if (!guestName.trim()) {
      showError('Please enter your name to log in as guest.');
      return;
    }
    setIsLoggingInGuest(true);
    try {
      showSuccess(`Welcome ${guestName.trim()}! Accessing app as guest...`);
      await signInAsGuest(guestName.trim());
    } catch (error: any) {
      console.warn('Firebase Anonymous Sign-In failed, attempting local fallback:', error);
      const mockUid = 'local_guest_' + Math.random().toString(36).substring(2, 11);
      const mockUser = {
        uid: mockUid,
        displayName: guestName.trim(),
        email: 'guest@neetmaster.com',
        isAnonymous: true,
        emailVerified: false,
      };
      localStorage.setItem('guest_user', JSON.stringify(mockUser));
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    } finally {
      setIsLoggingInGuest(false);
    }
  };

  const goBack = () => {
    if (step === 'PASSWORD' || step === 'OTP') {
      setStep('IDENTIFIER');
      setOtp('');
      setTestOtp(null);
      resetRecaptchaVerifier();
    } else if (step === 'SET_PASSWORD') {
      setStep('OTP');
    } else if (step === 'USERNAME' && identifierKind === 'email') {
      setStep('SET_PASSWORD');
    } else if (step === 'FORGOT_OTP') {
      setStep('PASSWORD');
      setForgotOtp('');
      setTestOtp(null);
    } else if (step === 'FORGOT_NEW_PASSWORD') {
      setStep('FORGOT_OTP');
      setNewPassword('');
    }
    // Phone USERNAME step: no back button shown (see canGoBack below) since
    // the Firebase account is already created/signed-in at that point.
  };

  const canGoBack =
    step === 'PASSWORD' ||
    step === 'OTP' ||
    step === 'SET_PASSWORD' ||
    step === 'FORGOT_OTP' ||
    step === 'FORGOT_NEW_PASSWORD' ||
    (step === 'USERNAME' && identifierKind === 'email');

  // ---- Legal pages (Terms / Privacy) shown as full overlay, then back to previous step ----
  if (legalView === 'terms') {
    return <TermsOfService onBack={() => window.history.back()} />;
  }
  if (legalView === 'privacy') {
    return <PrivacyPolicy onBack={() => window.history.back()} />;
  }

  const stepTitle = () => {
    if (isGuestMode) return 'Continue as Guest';
    switch (step) {
      case 'IDENTIFIER':
        return 'Login or Sign Up';
      case 'PASSWORD':
        return 'Welcome Back';
      case 'OTP':
        return 'Enter OTP Verification';
      case 'SET_PASSWORD':
        return 'Set a Password';
      case 'USERNAME':
        return 'Complete Profile';
      case 'FORGOT_OTP':
        return 'Reset Password';
      case 'FORGOT_NEW_PASSWORD':
        return 'Choose New Password';
      default:
        return '';
    }
  };

  const identifierIsValid = !!identifierKind;

  return (
    <div className="min-h-dvh bg-gray-50 px-3 pb-8 flex flex-col items-center pt-[env(safe-area-inset-top,0px)]">
      {/* Invisible reCAPTCHA anchor for web Phone Auth. Native platforms don't use this. */}
      <div id="recaptcha-container" />
      {errorMessage && (
        <div className="fixed top-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-[1001]">{errorMessage}</div>
      )}
      {successMessage && (
        <div className="fixed top-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-[1001]">{successMessage}</div>
      )}
      {termsNoticeMessage && (
        <div className="fixed top-4 bg-orange-500 text-white p-4 rounded-lg shadow-lg z-[1001] text-center">
          {termsNoticeMessage}
        </div>
      )}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to <span className="text-blue-600">Neet Master</span>
          </h1>
          <p className="text-gray-600">Master the NEET, Secure Your Future</p>
        </div>
        <a
          href="https://ig.me/m/mr.divakar00"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-gray-600"
        >
          <HelpCircle className="mr-1 h-4 w-4" /> Support
        </a>
      </div>

      <div className="w-full max-w-lg">
        <PosterSlider />

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="px-0 pt-0 pb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{stepTitle()}</h2>
              {(isGuestMode || canGoBack) && (
                <button
                  onClick={() => {
                    if (isGuestMode) setIsGuestMode(false);
                    else goBack();
                  }}
                  className="text-xs text-gray-500 hover:text-purple-700 flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              )}
            </div>
            {!isGuestMode && step === 'IDENTIFIER' && (
              <p className="text-xs text-gray-500 mt-0">🔐 your data is secure with us</p>
            )}
          </div>

          <div className="px-0 space-y-4">
            {/* Guest Login Form */}
            {isGuestMode && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter your name to start practicing and master the NEET exam right away.
                </p>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500"
                    type="text"
                    placeholder="Enter Your Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGuestSubmit();
                    }}
                  />
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold text-center flex items-center justify-center"
                  onClick={handleGuestSubmit}
                  disabled={isLoggingInGuest}
                >
                  {isLoggingInGuest ? 'Connecting...' : 'Start Learning as Guest'}
                </Pressable>
              </div>
            )}

            {/* Step: IDENTIFIER - single box, auto-detects Gmail vs Mobile Number */}
            {!isGuestMode && step === 'IDENTIFIER' && (
              <>
                <div className="relative">
                  {identifierKind === 'phone' ? (
                    <Smartphone className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  ) : (
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  )}
                  <input
                    className={`w-full pl-10 pr-4 py-2 border rounded-md text-gray-900 placeholder-gray-500 transition-colors ${
                      identifierIsValid ? 'border-green-500 focus:border-green-500' : 'border-gray-300'
                    }`}
                    type="text"
                    placeholder="Email or 10-digit Mobile Number"
                    value={identifier}
                    onChange={(e) => handleIdentifierChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && identifierIsValid && agreeTerms) proceedFromIdentifier();
                    }}
                    autoFocus
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-gray-600 select-none cursor-pointer">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={agreeTerms}
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                      agreeTerms ? 'bg-purple-700 border-purple-700' : 'border-gray-400 bg-white'
                    }`}
                  >
                    {agreeTerms && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLegalView('terms');
                      }}
                      className="text-purple-700 underline font-medium"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLegalView('privacy');
                      }}
                      className="text-purple-700 underline font-medium"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>

                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md py-2 font-semibold text-center"
                  onClick={() => proceedFromIdentifier()}
                  disabled={!identifierIsValid || !agreeTerms || isCheckingIdentifier}
                >
                  {isCheckingIdentifier ? 'Checking...' : 'Next'}
                </Pressable>
              </>
            )}

            {/* Step: PASSWORD - existing email/mobile user */}
            {!isGuestMode && step === 'PASSWORD' && (
              <>
                <p className="text-xs text-gray-500 mb-1">
                  Welcome back! Enter the password for{' '}
                  <span className="font-semibold text-gray-800">{identifier}</span>.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                    autoFocus
                  />
                  <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                  </Pressable>
                </div>
                <div className="text-right">
                  <Pressable onClick={handleForgotPassword} className="text-sm text-purple-700 font-semibold" disabled={isSendingForgotOtp}>
                    {isSendingForgotOtp ? 'Sending OTP...' : 'Forgot Password?'}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 text-white rounded-md py-2 font-semibold text-center"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Pressable>
              </>
            )}

            {/* Step: FORGOT_OTP - OTP sent to email to verify identity before reset */}
            {!isGuestMode && step === 'FORGOT_OTP' && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  We've sent a {forgotOtpMaxLength}-digit OTP to{' '}
                  <span className="font-semibold text-gray-800">{identifier}</span> to verify it's you.
                </p>
                {testOtp && (
                  <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-md p-3 mb-2 font-mono flex items-center justify-between">
                    <span>
                      🔑 [Dev Mode] Your OTP Code is: <strong>{testOtp}</strong>
                    </span>
                    <button
                      onClick={() => {
                        handleForgotOtpChange(testOtp);
                        showSuccess('Testing OTP filled!');
                      }}
                      className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded font-sans font-bold"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className={`w-full pl-10 pr-4 py-2 border rounded-md text-gray-950 placeholder-gray-500 font-mono text-center tracking-widest text-lg font-bold transition-colors ${
                      forgotOtp.length === forgotOtpMaxLength ? 'border-green-500' : 'border-gray-300'
                    }`}
                    type="text"
                    inputMode="numeric"
                    maxLength={forgotOtpMaxLength}
                    placeholder={`Enter ${forgotOtpMaxLength}-digit OTP`}
                    value={forgotOtp}
                    onChange={(e) => handleForgotOtpChange(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-between items-center">
                  {resendCount >= RESEND_COOLDOWNS.length && resendSecondsLeft === 0 ? (
                    <span className="text-xs text-orange-600 font-semibold">
                      Still not received? Check spam or try again later.
                    </span>
                  ) : resendSecondsLeft > 0 ? (
                    <span className="text-xs text-gray-400 font-semibold">Resend OTP in {resendSecondsLeft}s</span>
                  ) : (
                    <button
                      onClick={async () => {
                        await handleForgotPassword();
                        const nextCount = resendCount + 1;
                        setResendCount(nextCount);
                        const cooldown = RESEND_COOLDOWNS[Math.min(nextCount - 1, RESEND_COOLDOWNS.length - 1)];
                        startResendCooldown(cooldown);
                      }}
                      disabled={isSendingForgotOtp}
                      className="text-xs text-purple-700 font-semibold hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {isSendingForgotOtp ? 'Resending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 text-white rounded-md py-2 font-semibold text-center"
                  onClick={() => verifyForgotOtp()}
                  disabled={forgotOtp.length !== forgotOtpMaxLength || isVerifyingForgotOtp}
                >
                  {isVerifyingForgotOtp ? 'Verifying...' : 'Verify & Next'}
                </Pressable>
              </>
            )}

            {/* Step: FORGOT_NEW_PASSWORD - choose a new password after OTP verified */}
            {!isGuestMode && step === 'FORGOT_NEW_PASSWORD' && (
              <>
                <p className="text-xs text-gray-500 mb-2">OTP verified! Choose a new password for your account.</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className={`w-full pl-10 pr-10 py-2 border rounded-md text-gray-900 placeholder-gray-500 transition-colors ${
                      newPassword.trim().length >= 6 ? 'border-green-500' : 'border-gray-300'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New Password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPassword.trim().length >= 6) handleResetPasswordSubmit();
                    }}
                    autoFocus
                  />
                  <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 text-white rounded-md py-2 font-semibold text-center"
                  onClick={handleResetPasswordSubmit}
                  disabled={newPassword.trim().length < 6 || isResettingPassword}
                >
                  {isResettingPassword ? 'Updating...' : 'Update Password'}
                </Pressable>
              </>
            )}

            {/* Step: OTP - new email / existing phone / new phone */}
            {!isGuestMode && step === 'OTP' && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  We have generated a {otpMaxLength}-digit OTP for{' '}
                  <span className="font-semibold text-gray-800">
                    {identifierKind === 'phone' ? toE164(identifier) : identifier}
                  </span>
                  .
                </p>
                {testOtp && (
                  <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-md p-3 mb-2 font-mono flex items-center justify-between">
                    <span>
                      🔑 [Dev Mode] Your OTP Code is: <strong>{testOtp}</strong>
                    </span>
                    <button
                      onClick={() => {
                        handleOtpChange(testOtp);
                        showSuccess('Testing OTP filled!');
                      }}
                      className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded font-sans font-bold"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className={`w-full pl-10 pr-4 py-2 border rounded-md text-gray-950 placeholder-gray-500 font-mono text-center tracking-widest text-lg font-bold transition-colors ${
                      otp.length === otpMaxLength ? 'border-green-500' : 'border-gray-300'
                    }`}
                    type="text"
                    inputMode="numeric"
                    maxLength={otpMaxLength}
                    placeholder={`Enter ${otpMaxLength}-digit OTP`}
                    value={otp}
                    onChange={(e) => handleOtpChange(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-between items-center">
                  {resendCount >= RESEND_COOLDOWNS.length && resendSecondsLeft === 0 ? (
                    <button
                      onClick={() => {
                        setStep('IDENTIFIER');
                        resetWizard();
                      }}
                      className="text-xs text-orange-600 font-semibold hover:underline"
                    >
                      Not received? Try another method
                    </button>
                  ) : resendSecondsLeft > 0 ? (
                    <span className="text-xs text-gray-400 font-semibold">
                      Resend OTP in {resendSecondsLeft}s
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        identifierKind === 'phone' ? sendPhoneVerification(undefined, true) : sendOtp(undefined, true)
                      }
                      disabled={isSendingOtp}
                      className="text-xs text-purple-700 font-semibold hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      {isSendingOtp ? 'Resending...' : 'Resend OTP'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setStep('IDENTIFIER');
                      resetWizard();
                    }}
                    className="text-xs text-gray-500 font-semibold hover:underline"
                  >
                    Change Email/Mobile
                  </button>
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 text-white rounded-md py-2 font-semibold text-center"
                  onClick={() => verifyOtp()}
                  disabled={otp.length !== otpMaxLength || isVerifyingOtp || isLoggingIn}
                >
                  {isVerifyingOtp || isLoggingIn ? 'Verifying...' : 'Verify & Next'}
                </Pressable>
              </>
            )}

            {/* Step: SET_PASSWORD - new email user chooses a password */}
            {!isGuestMode && step === 'SET_PASSWORD' && (
              <>
                <p className="text-xs text-gray-500 mb-2">OTP Verified! Now choose a password for your account.</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className={`w-full pl-10 pr-10 py-2 border rounded-md text-gray-900 placeholder-gray-500 transition-colors ${
                      password.trim().length >= 6 ? 'border-green-500' : 'border-gray-300'
                    }`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Choose Password (min 6 chars)"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && password.trim().length >= 6) setStep('USERNAME');
                    }}
                    autoFocus
                  />
                  <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 text-white rounded-md py-2 font-semibold text-center"
                  onClick={() => setStep('USERNAME')}
                  disabled={password.trim().length < 6}
                >
                  Next
                </Pressable>
              </>
            )}

            {/* Step: USERNAME - new user: name only (terms already agreed on identifier step) */}
            {!isGuestMode && step === 'USERNAME' && (
              <>
                <p className="text-xs text-gray-500 mb-2">Almost done! Tell us who you are to set up your dashboard.</p>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                  <input
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500"
                    type="text"
                    placeholder="Your Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <Pressable
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md py-2 font-semibold text-center"
                  onClick={handleCompleteSignUp}
                  disabled={!canFinishSignUp || isSubmittingProfile}
                >
                  {isSubmittingProfile ? 'Creating Account...' : 'Complete Sign Up'}
                </Pressable>
              </>
            )}

            {!isGuestMode && (
              <>
                <div className="flex items-center gap-2 py-2">
                  <hr className="flex-1 border-gray-300" />
                  <span className="text-gray-600 text-xs">or</span>
                  <hr className="flex-1 border-gray-300" />
                </div>

                <div className="flex flex-col gap-2">
                  <Pressable
                    className="w-full border border-gray-300 py-2 rounded-md font-semibold hover:bg-gray-50 text-gray-900 text-center"
                    onClick={handleGoogleLogin}
                  >
                    Continue with Google
                  </Pressable>

                  <Pressable
                    className="w-full bg-gray-950 hover:bg-black text-white py-2 rounded-md font-semibold text-center flex items-center justify-center gap-2"
                    onClick={() => {
                      if (!agreeTerms) {
                        showTermsNotice();
                        return;
                      }
                      setIsGuestMode(true);
                    }}
                  >
                    <User className="h-4 w-4" /> Continue as Guest
                  </Pressable>
                </div>

                {step === 'IDENTIFIER' && (
                  <p className="text-center text-gray-500 pt-2 text-xs">
                    New here or already have an account? Just enter your Email/Mobile above — we'll figure it out.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
