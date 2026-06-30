import {useState, useEffect} from 'react';
import {signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signInAsGuest} from '@/lib/auth';
import {Mail, Lock, Eye, EyeOff, HelpCircle, User, Smartphone, KeyRound, ArrowLeft} from 'lucide-react';
import EarthGraphics from './EarthGraphics';
import Pressable from './Pressable';
import { getApiUrl } from '@/utils/api';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<'IDENTIFIER' | 'OTP' | 'PROFILE'>('IDENTIFIER');
  const [testOtp, setTestOtp] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isLoggingInGuest, setIsLoggingInGuest] = useState(false);

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

  const showError = (message: string) => {
    setErrorMessage(message);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
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
      console.warn("Firebase Anonymous Sign-In failed, attempting local fallback:", error);
      // Fallback: Create a mock local guest user and save it to localStorage
      const mockUid = 'local_guest_' + Math.random().toString(36).substring(2, 11);
      const mockUser = {
        uid: mockUid,
        displayName: guestName.trim(),
        email: 'guest@neetmaster.com',
        isAnonymous: true,
        emailVerified: false,
      };
      localStorage.setItem('guest_user', JSON.stringify(mockUser));
      
      // Trigger instant boot
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    } finally {
      setIsLoggingInGuest(false);
    }
  };

  const getFirebaseEmail = (ident: string) => {
    const clean = ident.trim();
    if (clean.includes('@')) {
      return clean;
    }
    return `${clean}@neetmaster.com`;
  };

  const handleSendOtp = async () => {
    if (!identifier.trim()) {
      showError('Please enter your Email or Mobile Number.');
      return;
    }
    
    const cleanIdent = identifier.trim();
    const isEmail = cleanIdent.includes('@');
    const isPhone = /^\d{10,15}$/.test(cleanIdent.replace(/[+\-\s]/g, ''));
    
    if (!isEmail && !isPhone) {
      showError('Please enter a valid Gmail address or 10-digit Mobile Number.');
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanIdent })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      if (data.testOtp) {
        setTestOtp(data.testOtp);
        showSuccess(`OTP generated! [Dev Mode] Testing Code: ${data.testOtp}`);
      } else {
        showSuccess(`OTP sent successfully to ${cleanIdent}!`);
      }
      setSignUpStep('OTP');
    } catch (error: any) {
      showError(error.message || 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      showError('Please enter the 4-digit OTP.');
      return;
    }
    try {
      const response = await fetch(getApiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp: otp.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }
      showSuccess('OTP verified successfully!');
      setSignUpStep('PROFILE');
    } catch (error: any) {
      showError(error.message || 'Invalid OTP code. Please try again.');
    }
  };

  const handleCompleteSignUp = async () => {
    if (!name.trim()) {
      showError('Please enter your Name.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }
    try {
      const fbEmail = getFirebaseEmail(identifier);
      await signUpWithEmail(fbEmail, password, name.trim());
      showSuccess(`Welcome ${name.trim()}! Account created successfully.`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        showError('This Email or Mobile Number is already registered.');
      } else if (error.code === 'auth/weak-password') {
        showError('Password is too weak.');
      } else {
        showError(error.message || 'Registration failed.');
      }
    }
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      showError('Please enter both Email/Mobile and Password.');
      return;
    }
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
    }
  };

  const handleForgotPassword = async () => {
    if (!identifier.trim()) {
      showError('Please enter your Email address first.');
      return;
    }
    if (!identifier.trim().includes('@')) {
      showError('Please enter your Email address (forgot password is not supported for mobile numbers directly).');
      return;
    }
    try {
      await resetPassword(identifier.trim());
      showSuccess('Password reset email sent successfully!');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        showError('No account found with this email.');
      } else {
        showError(error.message || 'Failed to send reset email.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      showError('Google login failed!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top,0px)] px-4 pb-8 md:px-8 flex flex-col items-center">
      {errorMessage && (
          <div className="fixed top-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-[1001]">
              {errorMessage}
          </div>
      )}
      {successMessage && (
          <div className="fixed top-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-[1001]">
              {successMessage}
          </div>
      )}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Welcome to NeetMaster</h1>
           <p className="text-gray-600">Master the NEET, Secure Your Future</p>
        </div>
        <a href="https://ig.me/m/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center text-gray-600"><HelpCircle className="mr-1 h-4 w-4"/> Support</a>
      </div>

      <div className="w-full max-w-lg">
        {/* Graphic component */}
        <EarthGraphics />

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="px-0 pt-0 pb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
                {isGuestMode ? 'Continue as Guest' : isSignUp ? (
                  signUpStep === 'IDENTIFIER' ? 'Sign Up' :
                  signUpStep === 'OTP' ? 'Enter OTP Verification' : 'Complete Profile'
                ) : 'Login to your account'}
            </h2>
            {(isGuestMode || (isSignUp && signUpStep !== 'IDENTIFIER')) && (
              <button 
                onClick={() => {
                  if (isGuestMode) {
                    setIsGuestMode(false);
                  } else if (signUpStep === 'OTP') {
                    setSignUpStep('IDENTIFIER');
                  } else if (signUpStep === 'PROFILE') {
                    setSignUpStep('OTP');
                  }
                }}
                className="text-xs text-gray-500 hover:text-purple-700 flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
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
            
            {/* Login View */}
            {!isSignUp && !isGuestMode && (
              <>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" 
                      type="text" 
                      placeholder="Email or Mobile Number" 
                      value={identifier} 
                      onChange={(e) => setIdentifier(e.target.value)} 
                    />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input 
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                    />
                    <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </Pressable>
                </div>
                <div className="text-right">
                    <Pressable onClick={handleForgotPassword} className="text-sm text-purple-700 font-semibold">Forgot Password?</Pressable>
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold text-center" onClick={handleLogin}>
                  Login
                </Pressable>
              </>
            )}

            {/* SignUp - Step 1: Identifier Input */}
            {isSignUp && !isGuestMode && signUpStep === 'IDENTIFIER' && (
              <>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" 
                      type="text" 
                      placeholder="Email or 10-digit Mobile Number" 
                      value={identifier} 
                      onChange={(e) => setIdentifier(e.target.value)} 
                    />
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold text-center" onClick={handleSendOtp}>
                  Send OTP
                </Pressable>
              </>
            )}

            {/* SignUp - Step 2: OTP Input */}
            {isSignUp && !isGuestMode && signUpStep === 'OTP' && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  We have generated a 4-digit OTP for <span className="font-semibold text-gray-800">{identifier}</span>.
                </p>
                {testOtp && (
                  <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-md p-3 mb-2 font-mono flex items-center justify-between">
                    <span>🔑 [Dev Mode] Your OTP Code is: <strong>{testOtp}</strong></span>
                    <button 
                      onClick={() => {
                        setOtp(testOtp);
                        showSuccess("Testing OTP filled!");
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
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-950 placeholder-gray-500 font-mono text-center tracking-widest text-lg font-bold" 
                      type="text" 
                      maxLength={4}
                      placeholder="Enter 4-digit OTP" 
                      value={otp} 
                      onChange={(e) => setOtp(e.target.value)} 
                    />
                </div>
                <div className="flex gap-2 justify-between">
                  <button onClick={handleSendOtp} className="text-xs text-purple-700 font-semibold hover:underline">
                    Resend OTP
                  </button>
                  <button onClick={() => setSignUpStep('IDENTIFIER')} className="text-xs text-gray-500 font-semibold hover:underline">
                    Change Email/Mobile
                  </button>
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold text-center" onClick={handleVerifyOtp}>
                  Verify & Next
                </Pressable>
              </>
            )}

            {/* SignUp - Step 3: Name & Password Setup */}
            {isSignUp && !isGuestMode && signUpStep === 'PROFILE' && (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  OTP Verified! Tell us who you are to set up your dashboard.
                </p>
                <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" 
                      type="text" 
                      placeholder="Your Full Name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                    />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input 
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Choose Password (min 6 chars)" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                    />
                    <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </Pressable>
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold text-center" onClick={handleCompleteSignUp}>
                  Complete Sign Up
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
                  <Pressable className="w-full border border-gray-300 py-2 rounded-md font-semibold hover:bg-gray-50 text-gray-900 text-center" onClick={handleGoogleLogin}>
                    Continue with Google
                  </Pressable>
                  
                  <Pressable className="w-full bg-gray-950 hover:bg-black text-white py-2 rounded-md font-semibold text-center flex items-center justify-center gap-2" onClick={() => setIsGuestMode(true)}>
                    <User className="h-4 w-4" /> Continue as Guest
                  </Pressable>
                </div>
                
                <div className="text-center text-gray-700 pt-2 text-sm">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <Pressable 
                      onClick={() => { 
                        setIsSignUp(!isSignUp); 
                        setSignUpStep('IDENTIFIER'); 
                        setTestOtp(null);
                        setOtp('');
                      }} 
                      className="text-purple-700 font-semibold hover:underline"
                    >
                      {isSignUp ? 'Login' : 'Sign Up'}
                    </Pressable>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
