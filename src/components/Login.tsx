import {useState} from 'react';
import {signInWithGoogle, signInWithEmail} from '@/lib/auth';
import {Mail, Lock, Eye, EyeOff, HelpCircle} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async () => {
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      alert('Login failed!');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert('Google login failed!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">Welcome to NeetMaster</h1>
           <p className="text-gray-600">Master the NEET, Secure Your Future</p>
        </div>
        <a href="#" className="flex items-center text-gray-600"><HelpCircle className="mr-1 h-4 w-4"/> Support</a>
      </div>

      <div className="w-full max-w-lg">
        {/* Placeholder for the graphic */}
        <div className="h-48 bg-purple-100 rounded-2xl mb-8 flex items-center justify-center text-purple-600 font-bold">
            [Graphic]
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="px-0 pt-0 pb-6">
            <h2 className="text-xl font-bold">Login to your account</h2>
            <p className="text-sm text-gray-500">Continue your learning journey</p>
          </div>
          <div className="px-0 space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input className="w-full pl-10 pr-4 py-2 border rounded-md" type="email" placeholder="Email or Phone Number" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input className="w-full pl-10 pr-10 py-2 border rounded-md" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="absolute right-3 top-3" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
              </button>
            </div>
            
            <div className="text-right">
                <a href="#" className="text-sm text-purple-700 font-semibold">Forgot Password?</a>
            </div>

            <button className="w-full bg-purple-700 hover:bg-purple-800 text-white rounded-md py-2 font-semibold" onClick={handleEmailLogin}>Login</button>
            
            <div className="flex items-center gap-2">
                <hr className="flex-1" />
                <span className="text-gray-400">or</span>
                <hr className="flex-1" />
            </div>

            <button className="w-full border py-2 rounded-md font-semibold hover:bg-gray-50" onClick={handleGoogleLogin}>Continue with Google</button>
            
            <div className="text-center text-gray-600">
                Don't have an account? <a href="#" className="text-purple-700 font-semibold">Sign Up</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
