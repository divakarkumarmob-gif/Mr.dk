import { useState } from 'react';
import { Check } from 'lucide-react';

export default function Onboarding({ onComplete }: { onComplete: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const canProceed = username.trim() !== '' && agreePrivacy && agreeTerms;

  return (
    <div className="fixed inset-0 bg-[#0a0f24] z-[1000] p-6 flex flex-col justify-center items-center text-white select-none">
      <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl p-8 rounded-3xl border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.3)] text-center space-y-5">
        <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-blue-300 to-pink-300">Complete Your Profile</h2>
        
        <input 
          type="text"
          placeholder="Enter Your Name"
          className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 text-white outline-none focus:border-purple-400 placeholder-slate-400 text-sm font-medium transition"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 text-left">
          <input type="checkbox" checked={agreePrivacy} onChange={() => setAgreePrivacy(!agreePrivacy)} className="accent-purple-500 w-4 h-4 rounded cursor-pointer" />
          <span>I agree to the <button className="text-purple-300 font-semibold underline" onClick={() => window.alert('Privacy Policy Link')}>Privacy Policy</button></span>
        </label>
        
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 text-left">
          <input type="checkbox" checked={agreeTerms} onChange={() => setAgreeTerms(!agreeTerms)} className="accent-purple-500 w-4 h-4 rounded cursor-pointer" />
          <span>I agree to the <button className="text-purple-300 font-semibold underline" onClick={() => window.alert('Terms of Service Link')}>Terms of Service</button></span>
        </label>

        <button 
          disabled={!canProceed}
          onClick={() => onComplete(username)}
          className={`w-full p-3.5 rounded-2xl font-extrabold text-sm transition-all cursor-pointer ${canProceed ? 'gradient-btn-primary text-white shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
        >
          Get Started Now
        </button>
      </div>
    </div>
  );
}

