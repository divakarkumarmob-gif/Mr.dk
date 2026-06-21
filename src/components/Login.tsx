import {useState, useEffect} from 'react';
import {signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword} from '@/lib/auth';
import {Mail, Lock, Eye, EyeOff, HelpCircle} from 'lucide-react';
import EarthGraphics from './EarthGraphics';
import Pressable from './Pressable';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const showError = (message: string) => {
    setErrorMessage(message);
  };
  
  // New state for multi-step signup
  const [signUpStep, setSignUpStep] = useState<'INPUT' | 'OTP' | 'PASSWORD'>('INPUT');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');

  const handleNext = async () => {
      try {
          const response = await fetch('/api/send-otp', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ identifier })
          });
          if (!response.ok) throw new Error('Failed to send OTP');
          setSignUpStep('OTP');
      } catch (error) {
          showError('Failed to send OTP');
      }
  };

  const handleVerifyOtp = async () => {
    try {
        const response = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ identifier, otp })
        });
        if (!response.ok) throw new Error('Invalid OTP');
        setSignUpStep('PASSWORD');
    } catch (error) {
        showError('Invalid OTP.');
    }
  };

  const handleCreatePassword = async () => {
      const isEmail = identifier.includes('@');
      if (!isEmail) {
          showError("Currently only email registration is supported.");
          return;
      }
      try {
        await signUpWithEmail(identifier, password);
        alert('Account created successfully!');
        setSignUpStep('INPUT');
        setIsSignUp(false);
      } catch (error: any) {
        showError(error.message || 'Sign-up failed!');
      }
  };
  
  const handleEmailAction = async () => {
    try {
      await signInWithEmail(email, password);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            showError('Invalid email or password.');
        } else if (error.code === 'auth/wrong-password') {
            showError('Wrong password.');
        } else {
            showError('Login failed!');
        }
    }
  };

  const handleForgotPassword = async () => {
      if (!email) {
          showError('Please enter your email first.');
          return;
      }
      try {
          await resetPassword(email);
          alert('Password reset email sent!');
      } catch (error: any) {
          showError(error.message || 'Failed to send reset email.');
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      {errorMessage && (
          <div className="fixed top-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-[1001]">
              {errorMessage}
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
          <div className="px-0 pt-0 pb-6">
            <h2 className="text-xl font-bold text-gray-900">
                {isSignUp ? (signUpStep === 'INPUT' ? 'Sign Up' : signUpStep === 'OTP' ? 'Enter OTP' : 'Create Password') : 'Login to your account'}
            </h2>
          </div>
          <div className="px-0 space-y-4">
            
            {/* Conditional Rendering Steps */}
            {!isSignUp && (
                <>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </Pressable>
                </div>
                <div className="text-right">
                    <Pressable onClick={handleForgotPassword} className="text-sm text-purple-700 font-semibold">Forgot Password?</Pressable>
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold" onClick={handleEmailAction}>Login</Pressable>
                </>
            )}

            {isSignUp && signUpStep === 'INPUT' && (
                <>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" type="text" placeholder="Email or Phone Number" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold" onClick={handleNext}>Next</Pressable>
                </>
            )}

            {isSignUp && signUpStep === 'OTP' && (
                <>
                <div className="relative">
                    <input className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" type="text" placeholder="Enter 4-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold" onClick={handleVerifyOtp}>Verify</Pressable>
                </>
            )}

            {isSignUp && signUpStep === 'PASSWORD' && (
                <>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <input className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500" type={showPassword ? "text" : "password"} placeholder="Create Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Pressable className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                    </Pressable>
                </div>
                <Pressable className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold" onClick={handleCreatePassword}>Create</Pressable>
                </>
            )}
            
            <div className="flex items-center gap-2">
                <hr className="flex-1 border-gray-300" />
                <span className="text-gray-600">or</span>
                <hr className="flex-1 border-gray-300" />
            </div>

            <Pressable className="w-full border border-gray-300 py-2 rounded-md font-semibold hover:bg-gray-50 text-gray-900" onClick={handleGoogleLogin}>Continue with Google</Pressable>
            
            <div className="text-center text-gray-700">
                {isSignUp ? 'Already have an account?' : 'Don\'t have an account?'} <Pressable onClick={() => { setIsSignUp(!isSignUp); setSignUpStep('INPUT'); }} className="text-purple-700 font-semibold">{isSignUp ? 'Login' : 'Sign Up'}</Pressable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
