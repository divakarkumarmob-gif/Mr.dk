import { useState } from 'react';
import { Check } from 'lucide-react';

export default function Onboarding({ onComplete }: { onComplete: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const canProceed = username.trim() !== '' && agreePrivacy && agreeTerms;

  return (
    <div className="fixed inset-0 bg-[#0a0e1a] z-[1000] p-6 flex flex-col justify-center items-center text-white">
      <h2 className="text-2xl font-bold mb-6">Complete Your Profile</h2>
      
      <div className="w-full max-w-sm space-y-4">
        <input 
          type="text"
          placeholder="Enter Username"
          className="w-full p-3 rounded bg-gray-800 border border-gray-600 text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={agreePrivacy} onChange={() => setAgreePrivacy(!agreePrivacy)} className="accent-[#3B82F6]" />
          <span>I agree to the <button className="text-[#3B82F6] underline" onClick={() => window.alert('Privacy Policy Link')}>Privacy Policy</button></span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={agreeTerms} onChange={() => setAgreeTerms(!agreeTerms)} className="accent-[#3B82F6]" />
          <span>I agree to the <button className="text-[#3B82F6] underline" onClick={() => window.alert('Terms of Service Link')}>Terms of Service</button></span>
        </label>

        <button 
          disabled={!canProceed}
          onClick={() => onComplete(username)}
          className={`w-full p-3 rounded font-bold ${canProceed ? 'bg-[#3B82F6] text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
