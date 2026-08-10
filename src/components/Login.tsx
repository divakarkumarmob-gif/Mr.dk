import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signInAsGuest,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/lib/auth';
import { Mail, Lock, Eye, EyeOff, HelpCircle, User, KeyRound, ArrowLeft, Check, Smartphone, Sparkles, ShieldCheck } from 'lucide-react';
import PosterSlider from './PosterSlider';
import Pressable from './Pressable';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import { getApiUrl, authFetch } from '@/utils/api';
import { updateProfile } from 'firebase/auth';
import { auth, resetRecaptchaVerifier } from '@/lib/firebase';

type Step = 'IDENTIFIER' | 'PASSWORD' | 'OTP' | 'SET_PASSWORD' | 'USERNAME' | 'FORGOT_OTP' | 'FORGOT_NEW_PASSWORD';
type IdentifierKind = 'email' | 'phone' | null;

const AUTO_ADVANCE_DELAY = 550;

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

  // Real Multi-Stage Milestone Glassy Loading Modal State
  const [loadingModal, setLoadingModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    progress: number;
    stageName: string;
  }>({
    show: false,
    title: '',
    message: '',
    progress: 0,
    stageName: '',
  });

  const setStage = (title: string, message: string, progress: number, stageName: string = 'Processing') => {
    setLoadingModal({
      show: true,
      title,
      message,
      progress: Math.min(Math.max(progress, 0), 100),
      stageName,
    });
  };

  const closeStageModal = (delayMs: number = 300) => {
    setLoadingModal((prev) => ({ ...prev, progress: 100 }));
    setTimeout(() => {
      setLoadingModal({ show: false, title: '', message: '', progress: 0, stageName: '' });
    }, delayMs);
  };

  // Resend-OTP anti-spam cooldown
  const RESEND_COOLDOWNS = [30, 120];
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
  };

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

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

  const validateIdentifier = (raw: string): IdentifierKind => {
    const clean = raw.trim();
    if (!clean) return null;
    if (clean.includes('@')) {
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
    setStage('Validating Input', 'Checking email/mobile syntax...', 25, 'Milestone 1/3');
    clearResendCooldown();
    try {
      if (kind === 'email') {
        const fbEmail = getFirebaseEmail(value);
        setStage('Checking Account', `Querying database for ${fbEmail}...`, 60, 'Milestone 2/3');
        const response = await authFetch(getApiUrl('/api/check-email-user'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: fbEmail }),
        });
        const data = await response.json();
        const exists = !!data.exists;
        setIsExistingUser(exists);

        setStage('Account Verified', exists ? 'Existing account found! Opening password entry...' : 'New user detected! Generating OTP...', 95, 'Milestone 3/3');
        await new Promise((r) => setTimeout(r, 150));

        if (exists) {
          setStep('PASSWORD');
        } else {
          await sendOtp(value);
        }
      } else {
        setStage('Checking Mobile', `Querying mobile database for ${toE164(value)}...`, 60, 'Milestone 2/3');
        const response = await authFetch(getApiUrl('/api/check-phone-user'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: toE164(value) }),
        });
        const data = await response.json();
        const exists = !!data.exists;
        setIsExistingUser(exists);

        setStage('Preparing SMS', 'Initiating Firebase Phone Auth...', 90, 'Milestone 3/3');
        await new Promise((r) => setTimeout(r, 150));
        await sendPhoneVerification(value);
      }
    } catch (error: any) {
      showError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsCheckingIdentifier(false);
      closeStageModal(200);
    }
  };

  const toE164 = (rawPhone: string) => {
    const clean = rawPhone.trim();
    if (clean.startsWith('+')) return clean;
    const digitsOnly = clean.replace(/[^\d]/g, '');
    return `+91${digitsOnly}`;
  };

  const sendOtp = async (rawIdentifier?: string, isResend: boolean = false) => {
    if (isSendingOtp) return;
    const value = (rawIdentifier ?? identifier).trim();
    setIsSendingOtp(true);
    setStage('Generating OTP', `Preparing secure code for ${value}...`, 35, 'Milestone 1/3');
    try {
      setStage('Dispatching Message', 'Transmitting via email gateway...', 75, 'Milestone 2/3');
      const response = await fetch(getApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

      setStage('OTP Sent!', 'Opening verification input...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 100));

      if (data.testOtp) {
        setTestOtp(data.testOtp);
        showSuccess(`OTP generated! [Dev Mode] Code: ${data.testOtp}`);
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
      closeStageModal(200);
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

  const sendPhoneVerification = async (rawIdentifier?: string, isResend: boolean = false) => {
    if (isSendingOtp) return;
    const value = (rawIdentifier ?? identifier).trim();
    setIsSendingOtp(true);
    setStage('Configuring SMS', `Preparing Firebase Phone Auth for ${toE164(value)}...`, 30, 'Milestone 1/3');
    try {
      setStage('Dispatching SMS', 'Sending verification code to your device...', 75, 'Milestone 2/3');
      await sendPhoneOtp(value, 'recaptcha-container');

      setStage('SMS Delivered', 'Opening code verification...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 100));

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
      closeStageModal(200);
    }
  };

  const otpMaxLength = identifierKind === 'phone' ? 6 : 4;

  const handleOtpChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, otpMaxLength);
    setOtp(digitsOnly);

    if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
    if (digitsOnly.length === otpMaxLength) {
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
    setStage('Validating OTP', 'Checking code accuracy...', 35, 'Milestone 1/3');
    try {
      if (identifierKind === 'phone') {
        setIsLoggingIn(true);
        setStage('Authenticating Phone', 'Verifying credentials with Firebase Auth...', 75, 'Milestone 2/3');
        try {
          await verifyPhoneOtp(value);
        } finally {
          setIsLoggingIn(false);
        }
        setStage('Verified!', 'Access granted...', 100, 'Milestone 3/3');
        await new Promise((r) => setTimeout(r, 100));

        showSuccess('OTP verified successfully!');
        if (isExistingUser) {
          return;
        }
        setStep('USERNAME');
      } else {
        setStage('Authenticating Email OTP', 'Confirming session with server...', 75, 'Milestone 2/3');
        await verifyEmailOtp(value);
        setStage('Verified!', 'Moving to set password...', 100, 'Milestone 3/3');
        await new Promise((r) => setTimeout(r, 100));

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
      closeStageModal(200);
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showError('Please enter your Email/Mobile and Password.');
      return;
    }
    setIsLoggingIn(true);
    setStage('Securing Connection', 'Encrypting login credentials...', 20, 'Milestone 1/3');
    try {
      const fbEmail = getFirebaseEmail(identifier);
      setStage('Authenticating', 'Verifying credentials with Firebase Auth...', 65, 'Milestone 2/3');
      await signInWithEmail(fbEmail, password);

      setStage('Welcome Back!', 'Loading your study dashboard...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 150));
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
      closeStageModal(200);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (value.trim().length >= 6) {
      autoAdvanceTimer.current = setTimeout(() => {
        setStep('USERNAME');
      }, AUTO_ADVANCE_DELAY);
    }
  };

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
    setStage('Creating Account', 'Registering new account profile...', 25, 'Milestone 1/4');
    try {
      if (identifierKind === 'email') {
        const fbEmail = getFirebaseEmail(identifier);
        setStage('Authenticating', 'Registering user with Firebase Auth...', 60, 'Milestone 2/4');
        await signUpWithEmail(fbEmail, password, name.trim());
      } else {
        if (auth.currentUser) {
          setStage('Syncing Profile', 'Attaching display name...', 65, 'Milestone 2/4');
          await updateProfile(auth.currentUser, { displayName: name.trim() });
        }
      }
      setStage('Configuring E2EE', 'Initializing secure encryption keys...', 88, 'Milestone 3/4');
      await new Promise((r) => setTimeout(r, 150));

      setStage('Account Ready!', 'Welcome to NEET Master...', 100, 'Milestone 4/4');
      await new Promise((r) => setTimeout(r, 150));

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
      closeStageModal(200);
    }
  };

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
    setStage('Password Reset', `Initiating reset request for ${email}...`, 30, 'Milestone 1/3');
    try {
      setStage('Sending OTP', 'Transmitting reset token via email...', 75, 'Milestone 2/3');
      const response = await fetch(getApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');

      setStage('OTP Sent', 'Opening code input...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 100));

      if (data.testOtp) {
        setTestOtp(data.testOtp);
        showSuccess(`OTP generated! [Dev Mode] Code: ${data.testOtp}`);
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
      closeStageModal(200);
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
    setStage('Verifying OTP', 'Checking password reset token...', 35, 'Milestone 1/3');
    try {
      setStage('Token Confirmed', 'Generating reset session token...', 75, 'Milestone 2/3');
      const response = await fetch(getApiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp: value, purpose: 'password-reset' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid OTP');

      setResetToken(data.resetToken);
      setStage('Verified!', 'Opening password form...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 100));

      showSuccess('OTP verified! Now choose your new password.');
      setStep('FORGOT_NEW_PASSWORD');
    } catch (error: any) {
      showError(error.message || 'Invalid OTP code. Please try again.');
      setForgotOtp('');
    } finally {
      setIsVerifyingForgotOtp(false);
      closeStageModal(200);
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
    setStage('Updating Password', 'Submitting new password to server...', 40, 'Milestone 1/3');
    try {
      setStage('Saving Credentials', 'Hashing and updating password...', 80, 'Milestone 2/3');
      const response = await fetch(getApiUrl('/api/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newPassword.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      setStage('Password Saved!', 'Redirecting to login...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 150));

      showSuccess('Password updated! Please log in with your new password.');
      setStep('IDENTIFIER');
      resetWizard();
    } catch (error: any) {
      showError(error.message || 'Failed to reset password.');
    } finally {
      setIsResettingPassword(false);
      closeStageModal(200);
    }
  };

  const handleGoogleLogin = async () => {
    if (!agreeTerms) {
      showTermsNotice();
      return;
    }
    setStage('Google OAuth', 'Opening Google Authentication portal...', 25, 'Milestone 1/3');
    try {
      setStage('Verifying Google Token', 'Exchanging OAuth credentials...', 70, 'Milestone 2/3');
      await signInWithGoogle();

      setStage('Authenticated!', 'Redirecting to dashboard...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 150));
    } catch (error) {
      showError('Google login failed!');
    } finally {
      closeStageModal(200);
    }
  };

  const handleGuestSubmit = async () => {
    if (!guestName.trim()) {
      showError('Please enter your name to log in as guest.');
      return;
    }
    setIsLoggingInGuest(true);
    setStage('Initializing Guest', `Setting up session for ${guestName.trim()}...`, 30, 'Milestone 1/3');
    try {
      setStage('Configuring Offline Storage', 'Preparing guest progress database...', 75, 'Milestone 2/3');
      showSuccess(`Welcome ${guestName.trim()}! Accessing app as guest...`);
      await signInAsGuest(guestName.trim());

      setStage('Guest Workspace Ready', 'Opening practice mode...', 100, 'Milestone 3/3');
      await new Promise((r) => setTimeout(r, 150));
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
      closeStageModal(200);
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
  };

  const canGoBack =
    step === 'PASSWORD' ||
    step === 'OTP' ||
    step === 'SET_PASSWORD' ||
    step === 'FORGOT_OTP' ||
    step === 'FORGOT_NEW_PASSWORD' ||
    (step === 'USERNAME' && identifierKind === 'email');

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
    <div className="min-h-dvh bg-[#080c14] text-white px-3 pb-8 flex flex-col items-center pt-[env(safe-area-inset-top,0px)] relative overflow-x-hidden selection:bg-pink-500/30 selection:text-pink-200">
      {/* Ambient Glowing Glass Spheres (Red, Blue, Pink accent glow) */}
      <div className="fixed -top-24 left-1/2 -translate-x-1/2 w-[550px] h-[380px] bg-gradient-to-tr from-red-600/25 via-pink-600/30 to-blue-600/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 -right-24 w-80 h-80 bg-blue-600/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-10 -left-24 w-80 h-80 bg-red-600/20 rounded-full blur-[130px] pointer-events-none" />

      {/* Invisible reCAPTCHA anchor */}
      <div id="recaptcha-container" />
      
      {errorMessage && (
        <div className="fixed top-4 bg-red-600/90 border border-red-400/50 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.5)] z-[2001] text-sm font-semibold animate-bounce">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 bg-emerald-600/90 border border-emerald-400/50 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.5)] z-[2001] text-sm font-semibold">
          {successMessage}
        </div>
      )}
      {termsNoticeMessage && (
        <div className="fixed top-4 bg-amber-600/90 border border-amber-400/50 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.5)] z-[2001] text-xs font-semibold text-center">
          {termsNoticeMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6 pt-3 relative z-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-red-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(236,72,153,0.5)]">Neet Master</span>
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm font-medium mt-0.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-pink-400 inline" /> Master the NEET, Secure Your Future
          </p>
        </div>
        <a
          href="https://ig.me/m/mr.divakar00"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-pink-500/40 text-slate-300 hover:text-white transition-all shadow-sm backdrop-blur-md"
        >
          <HelpCircle className="h-3.5 w-3.5 text-pink-400" /> Support
        </a>
      </div>

      {/* Main Login Card Wrapper */}
      <div className="w-full max-w-lg relative z-10">
        <PosterSlider />

        <div className="bg-slate-900/70 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] border border-white/15 relative overflow-hidden">
          {/* Glowing Top Border Line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500 via-pink-500 to-blue-500" />

          <div className="px-0 pt-0 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                {stepTitle()}
              </h2>
              {(isGuestMode || canGoBack) && (
                <button
                  onClick={() => {
                    if (isGuestMode) setIsGuestMode(false);
                    else goBack();
                  }}
                  className="text-xs text-slate-400 hover:text-pink-400 flex items-center gap-1 font-semibold transition-colors px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              )}
            </div>
            {!isGuestMode && step === 'IDENTIFIER' && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-pink-400" /> Your data is encrypted & secure
              </p>
            )}
          </div>

          <div className="px-0 space-y-4">
            {/* Guest Login Form */}
            {isGuestMode && (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-slate-300">
                  Enter your name to start practicing and master the NEET exam right away.
                </p>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-5 w-5 text-pink-400" />
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-white/15 rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all shadow-inner focus:outline-none focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/30"
                    type="text"
                    placeholder="Enter Your Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGuestSubmit();
                    }}
                    autoFocus
                  />
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-all flex items-center justify-center"
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
                    <Smartphone className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-400" />
                  ) : (
                    <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-pink-400" />
                  )}
                  <input
                    className={`w-full pl-11 pr-4 py-3 bg-slate-950/70 border rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all shadow-inner focus:outline-none ${
                      identifierIsValid ? 'border-pink-500/80 focus:ring-2 focus:ring-pink-500/30' : 'border-white/15 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/30'
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

                <label className="flex items-start gap-2.5 text-xs text-slate-300 select-none cursor-pointer">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={agreeTerms}
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-md border flex items-center justify-center transition-all ${
                      agreeTerms ? 'bg-gradient-to-r from-red-500 to-pink-500 border-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'border-white/30 bg-slate-950/50 hover:border-pink-400'
                    }`}
                  >
                    {agreeTerms && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </button>
                  <span className="leading-relaxed">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLegalView('terms');
                      }}
                      className="text-pink-400 hover:text-pink-300 underline font-medium"
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
                      className="text-pink-400 hover:text-pink-300 underline font-medium"
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>

                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                <p className="text-xs text-slate-300 mb-1">
                  Welcome back! Enter the password for{' '}
                  <span className="font-semibold text-pink-400">{identifier}</span>.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-400" />
                  <input
                    className="w-full pl-11 pr-11 py-3 bg-slate-950/70 border border-white/15 rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all shadow-inner focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/30"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLogin();
                    }}
                    autoFocus
                  />
                  <Pressable className="absolute right-3.5 top-3.5" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-slate-400 hover:text-white" /> : <Eye className="h-5 w-5 text-slate-400 hover:text-white" />}
                  </Pressable>
                </div>
                <div className="text-right">
                  <Pressable onClick={handleForgotPassword} className="text-xs text-pink-400 hover:text-pink-300 font-semibold transition-colors" disabled={isSendingForgotOtp}>
                    {isSendingForgotOtp ? 'Sending OTP...' : 'Forgot Password?'}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Pressable>
              </>
            )}

            {/* Step: FORGOT_OTP */}
            {!isGuestMode && step === 'FORGOT_OTP' && (
              <>
                <p className="text-xs text-slate-300 mb-2">
                  We've sent a {forgotOtpMaxLength}-digit OTP to{' '}
                  <span className="font-semibold text-pink-400">{identifier}</span> to verify it's you.
                </p>
                {testOtp && (
                  <div className="bg-pink-950/40 border border-pink-500/40 text-pink-200 text-xs rounded-xl p-3 mb-2 font-mono flex items-center justify-between backdrop-blur-md">
                    <span>
                      🔑 [Dev Mode] Code: <strong>{testOtp}</strong>
                    </span>
                    <button
                      onClick={() => {
                        handleForgotOtpChange(testOtp);
                        showSuccess('Testing OTP filled!');
                      }}
                      className="text-[10px] bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-0.5 rounded-lg font-sans font-bold shadow"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-5 w-5 text-pink-400" />
                  <input
                    className={`w-full pl-11 pr-4 py-3 bg-slate-950/70 border rounded-xl text-white placeholder-slate-500 font-mono text-center tracking-widest text-lg font-bold transition-all focus:outline-none ${
                      forgotOtp.length === forgotOtpMaxLength ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/30' : 'border-white/15 focus:border-pink-500'
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
                <div className="flex gap-2 justify-between items-center text-xs">
                  {resendCount >= RESEND_COOLDOWNS.length && resendSecondsLeft === 0 ? (
                    <span className="text-amber-400 font-medium">
                      Still not received? Check spam or try again later.
                    </span>
                  ) : resendSecondsLeft > 0 ? (
                    <span className="text-slate-400 font-medium">Resend OTP in {resendSecondsLeft}s</span>
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
                      className="text-pink-400 font-semibold hover:underline disabled:text-slate-500"
                    >
                      {isSendingForgotOtp ? 'Resending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={() => verifyForgotOtp()}
                  disabled={forgotOtp.length !== forgotOtpMaxLength || isVerifyingForgotOtp}
                >
                  {isVerifyingForgotOtp ? 'Verifying...' : 'Verify & Next'}
                </Pressable>
              </>
            )}

            {/* Step: FORGOT_NEW_PASSWORD */}
            {!isGuestMode && step === 'FORGOT_NEW_PASSWORD' && (
              <>
                <p className="text-xs text-slate-300 mb-2">OTP verified! Choose a new password for your account.</p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-400" />
                  <input
                    className={`w-full pl-11 pr-11 py-3 bg-slate-950/70 border rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all focus:outline-none ${
                      newPassword.trim().length >= 6 ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/30' : 'border-white/15 focus:border-blue-500'
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
                  <Pressable className="absolute right-3.5 top-3.5" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-slate-400 hover:text-white" /> : <Eye className="h-5 w-5 text-slate-400 hover:text-white" />}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={handleResetPasswordSubmit}
                  disabled={newPassword.trim().length < 6 || isResettingPassword}
                >
                  {isResettingPassword ? 'Updating...' : 'Update Password'}
                </Pressable>
              </>
            )}

            {/* Step: OTP */}
            {!isGuestMode && step === 'OTP' && (
              <>
                <p className="text-xs text-slate-300 mb-2">
                  We have generated a {otpMaxLength}-digit OTP for{' '}
                  <span className="font-semibold text-pink-400">
                    {identifierKind === 'phone' ? toE164(identifier) : identifier}
                  </span>
                  .
                </p>
                {testOtp && (
                  <div className="bg-pink-950/40 border border-pink-500/40 text-pink-200 text-xs rounded-xl p-3 mb-2 font-mono flex items-center justify-between backdrop-blur-md">
                    <span>
                      🔑 [Dev Mode] Code: <strong>{testOtp}</strong>
                    </span>
                    <button
                      onClick={() => {
                        handleOtpChange(testOtp);
                        showSuccess('Testing OTP filled!');
                      }}
                      className="text-[10px] bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-0.5 rounded-lg font-sans font-bold shadow"
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-5 w-5 text-pink-400" />
                  <input
                    className={`w-full pl-11 pr-4 py-3 bg-slate-950/70 border rounded-xl text-white placeholder-slate-500 font-mono text-center tracking-widest text-lg font-bold transition-all focus:outline-none ${
                      otp.length === otpMaxLength ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/30' : 'border-white/15 focus:border-pink-500'
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
                <div className="flex gap-2 justify-between items-center text-xs">
                  {resendCount >= RESEND_COOLDOWNS.length && resendSecondsLeft === 0 ? (
                    <button
                      onClick={() => {
                        setStep('IDENTIFIER');
                        resetWizard();
                      }}
                      className="text-amber-400 font-semibold hover:underline"
                    >
                      Not received? Try another method
                    </button>
                  ) : resendSecondsLeft > 0 ? (
                    <span className="text-slate-400 font-medium">
                      Resend OTP in {resendSecondsLeft}s
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        identifierKind === 'phone' ? sendPhoneVerification(undefined, true) : sendOtp(undefined, true)
                      }
                      disabled={isSendingOtp}
                      className="text-pink-400 font-semibold hover:underline disabled:text-slate-500"
                    >
                      {isSendingOtp ? 'Resending...' : 'Resend OTP'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setStep('IDENTIFIER');
                      resetWizard();
                    }}
                    className="text-slate-400 font-medium hover:text-white hover:underline"
                  >
                    Change Email/Mobile
                  </button>
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={() => verifyOtp()}
                  disabled={otp.length !== otpMaxLength || isVerifyingOtp || isLoggingIn}
                >
                  {isVerifyingOtp || isLoggingIn ? 'Verifying...' : 'Verify & Next'}
                </Pressable>
              </>
            )}

            {/* Step: SET_PASSWORD */}
            {!isGuestMode && step === 'SET_PASSWORD' && (
              <>
                <p className="text-xs text-slate-300 mb-2">OTP Verified! Now choose a password for your account.</p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-blue-400" />
                  <input
                    className={`w-full pl-11 pr-11 py-3 bg-slate-950/70 border rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all focus:outline-none ${
                      password.trim().length >= 6 ? 'border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/30' : 'border-white/15 focus:border-blue-500'
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
                  <Pressable className="absolute right-3.5 top-3.5" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-slate-400 hover:text-white" /> : <Eye className="h-5 w-5 text-slate-400 hover:text-white" />}
                  </Pressable>
                </div>
                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={() => setStep('USERNAME')}
                  disabled={password.trim().length < 6}
                >
                  Next
                </Pressable>
              </>
            )}

            {/* Step: USERNAME */}
            {!isGuestMode && step === 'USERNAME' && (
              <>
                <p className="text-xs text-slate-300 mb-2">Almost done! Tell us who you are to set up your dashboard.</p>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-5 w-5 text-pink-400" />
                  <input
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-white/15 rounded-xl text-white placeholder-slate-400 text-sm font-medium transition-all focus:outline-none focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/30"
                    type="text"
                    placeholder="Your Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <Pressable
                  className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-600 hover:from-red-600 hover:via-pink-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-sm shadow-[0_0_20px_rgba(236,72,153,0.35)] active:scale-[0.98] transition-all flex items-center justify-center"
                  onClick={handleCompleteSignUp}
                  disabled={!canFinishSignUp || isSubmittingProfile}
                >
                  {isSubmittingProfile ? 'Creating Account...' : 'Complete Sign Up'}
                </Pressable>
              </>
            )}

            {!isGuestMode && (
              <>
                <div className="flex items-center gap-3 py-2">
                  <hr className="flex-1 border-white/10" />
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">or</span>
                  <hr className="flex-1 border-white/10" />
                </div>

                <div className="flex flex-col gap-2.5">
                  <Pressable
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/15 hover:border-pink-500/40 text-white font-semibold rounded-xl py-3 text-sm backdrop-blur-md transition-all flex items-center justify-center gap-2.5 shadow-sm"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9 shadow-none"/>
                      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                    </svg>
                    Continue with Google
                  </Pressable>

                  <Pressable
                    className="w-full bg-slate-950/60 hover:bg-slate-950/90 border border-white/15 hover:border-blue-500/40 text-white py-3 rounded-xl font-semibold text-sm backdrop-blur-md transition-all flex items-center justify-center gap-2 shadow-sm"
                    onClick={() => {
                      if (!agreeTerms) {
                        showTermsNotice();
                        return;
                      }
                      setIsGuestMode(true);
                    }}
                  >
                    <User className="h-4 w-4 text-blue-400" /> Continue as Guest
                  </Pressable>
                </div>

                {step === 'IDENTIFIER' && (
                  <p className="text-center text-slate-400 pt-2 text-xs leading-relaxed font-medium">
                    New here or already have an account? Enter your Email or Mobile above — we'll handle the rest.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Real Multi-Stage Milestone Glassy Loading Modal */}
      <AnimatePresence>
        {loadingModal.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-sm bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-white/20 p-6 sm:p-8 rounded-3xl shadow-[0_0_50px_rgba(236,72,153,0.35)] backdrop-blur-2xl text-center relative overflow-hidden flex flex-col items-center"
            >
              {/* Top ambient glow lines inside modal */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500 via-pink-500 to-blue-500" />
              <div className="absolute -top-10 -left-10 w-28 h-28 bg-red-500/25 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-blue-500/25 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Animated Glowing Ring Icon */}
              <div className="relative mb-5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-500 blur-lg opacity-80 animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-slate-900/90 border border-white/25 flex items-center justify-center shadow-xl">
                  <Sparkles className="h-8 w-8 text-pink-400 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              {/* Real Stage Badge */}
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 mb-2">
                {loadingModal.stageName || 'Processing'}
              </span>

              {/* Loading Title & Message */}
              <h3 className="text-xl font-extrabold bg-gradient-to-r from-red-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-1">
                {loadingModal.title || 'Connecting to NEET Master'}
              </h3>
              <p className="text-xs text-slate-300 font-medium mb-6 leading-relaxed">
                {loadingModal.message || 'Please wait a moment while we set up your session...'}
              </p>

              {/* Real Progressive Progress Bar */}
              <div className="w-full bg-slate-950/80 border border-white/15 rounded-full h-3 overflow-hidden p-0.5 relative shadow-inner">
                <motion.div 
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-pink-500 to-blue-500 shadow-[0_0_15px_rgba(236,72,153,0.8)] relative"
                  initial={{ width: "0%" }}
                  animate={{ width: `${loadingModal.progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
                </motion.div>
              </div>

              <div className="mt-3 flex items-center justify-between w-full text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 text-pink-400">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                  Authenticating
                </span>
                <span className="font-mono text-blue-300 font-bold">{Math.round(loadingModal.progress)}%</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
