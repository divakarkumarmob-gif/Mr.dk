import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Loader2, Lock, AlertCircle, RefreshCw, KeyRound, Film, CheckCircle } from 'lucide-react';

interface S3Video {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
  title: string;
}

export default function PrivateVideos({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<S3Video[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/private-videos', {
        method: 'POST', // Using POST to trigger/lazy-verify S3 securely
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch videos from AWS S3');
      }
      setVideos(data.videos || []);
    } catch (err: any) {
      console.error('Fetch private videos failed:', err);
      setError(err.message || 'Failed to connect to AWS S3. Please make sure S3 credentials are set in secrets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-[#0a0f24] z-[1000] flex flex-col p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
            <Lock className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">Private Lecture Hub</h2>
            <p className="text-[10px] text-gray-400">AWS S3 Secured Stream</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-2 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-full transition"
        >
          <X className="h-5 w-5 text-gray-300" />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {activeVideoUrl && (
          <div className="bg-[#121933] border border-white/5 rounded-2xl overflow-hidden shadow-2xl p-3">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                <Film className="h-3 w-3" /> Playing: {activeVideoTitle}
              </span>
              <button 
                onClick={() => { setActiveVideoUrl(null); setActiveVideoTitle(null); }}
                className="text-[10px] text-gray-400 hover:text-white underline font-medium"
              >
                Close Player
              </button>
            </div>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden relative">
              <video 
                src={activeVideoUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-red-400">AWS Authentication Needed</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  We could not list files from your S3 Bucket because the AWS credentials are empty or incorrect.
                </p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-gray-300 flex items-center gap-1.5 mb-1">
                <KeyRound className="h-4 w-4 text-orange-400" /> AWS Credentials Configuration:
              </div>
              <p className="text-gray-400 text-[11px]">
                Please go to <span className="text-orange-400 font-mono">Secrets</span> settings in the editor and provide:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-400 text-[11px] pl-1 font-mono">
                <li><span className="text-gray-300 font-sans">Access Key ID:</span> AWS_ACCESS_KEY_ID</li>
                <li><span className="text-gray-300 font-sans">Secret Key:</span> AWS_SECRET_ACCESS_KEY</li>
                <li><span className="text-gray-300 font-sans">Region:</span> AWS_REGION</li>
                <li><span className="text-gray-300 font-sans">S3 Bucket Name:</span> S3_BUCKET</li>
              </ul>
            </div>

            <div className="flex gap-2.5">
              <button 
                onClick={fetchVideos}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 active:bg-white/20 text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry Connection
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-9 w-9 animate-spin text-orange-500 mb-3" />
            <p className="text-sm font-semibold text-gray-300">Connecting to S3 bucket...</p>
            <p className="text-[11px] text-gray-500 mt-1">Generating secure download links securely</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-[#121933] border border-white/5 rounded-2xl p-8 text-center space-y-3">
            <div className="h-11 w-11 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
              <Film className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">No Videos Found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                AWS connection is verified and successful, but your S3 bucket "<span className="text-orange-400 font-mono text-[10px]">neetmaster-videos-01</span>" appears to be empty or has no supported video formats (MP4, MKV, etc.).
              </p>
            </div>
            <button 
              onClick={fetchVideos}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-xs font-bold rounded-xl transition"
            >
              Check Again
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="bg-green-500/15 border border-green-500/25 p-3 rounded-xl flex items-center gap-2.5 text-xs text-green-400 mb-1">
              <CheckCircle className="h-4.5 w-4.5 shrink-0" />
              <span>AWS S3 Connection Secured! Listing private lectures.</span>
            </div>
            
            {videos.map((vid) => (
              <div 
                key={vid.key} 
                className="bg-[#121933] hover:bg-[#182142] active:bg-[#121933] p-3.5 rounded-xl border border-white/5 flex items-center justify-between transition group cursor-pointer"
                onClick={() => {
                  setActiveVideoUrl(vid.url);
                  setActiveVideoTitle(vid.title);
                }}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 bg-orange-500/10 group-hover:bg-orange-500/20 rounded-xl flex items-center justify-center border border-orange-500/15 transition shrink-0">
                    <Play className="h-4.5 w-4.5 text-orange-400 fill-orange-400/20" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white group-hover:text-orange-400 transition truncate">{vid.title}</h3>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{vid.key}</p>
                  </div>
                </div>
                <button 
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg shrink-0 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveVideoUrl(vid.url);
                    setActiveVideoTitle(vid.title);
                  }}
                >
                  Stream
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-white/5 text-center mt-auto">
        <span className="font-bold text-[10px] tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 uppercase">
          Powered by AWS Secured Engine
        </span>
      </div>
    </motion.div>
  );
}
