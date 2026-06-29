import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Play, Loader2, Lock, AlertCircle, RefreshCw, KeyRound, 
  Film, ChevronRight, BookOpen, ArrowLeft, FolderOpen, Tv, CheckCircle2
} from 'lucide-react';
import CustomVideoPlayer from './CustomVideoPlayer';
import { getApiUrl } from '@/utils/api';

interface VideoItem {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
  title: string;
}

interface Chapter {
  name: string;
  videos: VideoItem[];
}

interface Subject {
  name: string;
  chapters: Chapter[];
}

export default function PrivateVideos({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const checkConnection = async () => {
    setIsChecking(true);
    setConnectionStatus('idle');
    try {
      const url = getApiUrl('/api/s3/health');
      const response = await fetch(url);
      
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Possible routing error: ${text.slice(0, 50)}...`);
      }

      const data = await response.json();
      if (data.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setError(data.error || 'Connection failed');
      }
    } catch (err: any) {
      console.error('AWS Health check failed:', err);
      setConnectionStatus('error');
      setError(err.message);
    } finally {
      setIsChecking(false);
    }
  };

  // Dynamic Navigation states
  const [currentView, setCurrentView] = useState<'list' | 'chapter' | 'player'>('list');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  const currentIndexRef = useRef(0);
  const isClosingRef = useRef(false);

  useEffect(() => {
    // Push the initial 'list' state
    window.history.pushState({ privateVideoView: 'list', index: 0 }, '');
    currentIndexRef.current = 0;

    const handlePopState = (event: PopStateEvent) => {
      if (isClosingRef.current) return;

      const state = event.state;
      if (state && typeof state.index === 'number' && state.privateVideoView) {
        currentIndexRef.current = state.index;
        const view = state.privateVideoView as 'list' | 'chapter' | 'player';
        setCurrentView(view);
        if (view === 'list') {
          setSelectedChapter(null);
          setSelectedSubject(null);
          setActiveVideo(null);
        } else if (view === 'chapter') {
          setActiveVideo(null);
        }
      } else {
        // No state or we backed out of our initial 'list' view
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);

  const navigateToChapter = (subj: Subject, chap: Chapter) => {
    const nextIndex = currentIndexRef.current + 1;
    window.history.pushState({ privateVideoView: 'chapter', index: nextIndex }, '');
    currentIndexRef.current = nextIndex;
    setSelectedSubject(subj);
    setSelectedChapter(chap);
    setCurrentView('chapter');
  };

  const navigateToPlayer = (video: VideoItem) => {
    const nextIndex = currentIndexRef.current + 1;
    window.history.pushState({ privateVideoView: 'player', index: nextIndex }, '');
    currentIndexRef.current = nextIndex;
    setActiveVideo(video);
    setCurrentView('player');
  };

  const handleClose = () => {
    isClosingRef.current = true;
    if (currentIndexRef.current >= 0) {
      window.history.go(-(currentIndexRef.current + 1));
    }
    onClose();
  };

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = getApiUrl('/api/private-videos');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Possible routing error: ${text.slice(0, 50)}...`);
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch videos from AWS S3');
      }
      setSubjects(data.subjects || []);
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

  // Helper to count total videos in a Subject
  const getTotalSubjectVideos = (subj: Subject) => {
    return subj.chapters.reduce((total, chap) => total + chap.videos.length, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-[#060a17] z-[1000] flex flex-col p-4 sm:p-6 text-white font-sans overflow-hidden"
    >
      {/* Dynamic Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/5 shrink-0 mb-4">
        <div className="flex items-center gap-2.5">
          {currentView !== 'list' ? (
            <button 
              onClick={() => {
                window.history.back();
              }}
              className="p-2 -ml-1 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-xl transition flex items-center justify-center border border-white/5 mr-1"
            >
              <ArrowLeft className="h-5 w-5 text-gray-200" />
            </button>
          ) : (
            <div className="h-9 w-9 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
              <Lock className="h-5 w-5 text-orange-400" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
              {currentView === 'list' && "Private Lecture Hub"}
              {currentView === 'chapter' && "Chapter Details"}
              {currentView === 'player' && "Playing Lecture"}
            </h2>
            <p className="text-[10px] text-gray-400 font-semibold tracking-wider">AWS SECURED DIRECTORY STREAM</p>
          </div>
        </div>
        
        <button 
          onClick={handleClose} 
          className="p-2 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-xl transition border border-white/5"
        >
          <X className="h-5 w-5 text-gray-300" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Connection states or views */}
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

            <div className="flex gap-2">
              <button 
                onClick={fetchVideos}
                disabled={loading}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 active:bg-white/20 text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Loading...' : 'Retry Connection'}
              </button>
              <button 
                onClick={checkConnection}
                disabled={isChecking}
                className={`flex-1 ${connectionStatus === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : connectionStatus === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'} border text-[10px] font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50`}
              >
                {isChecking ? <RefreshCw className="h-3 w-3 animate-spin" /> : connectionStatus === 'success' ? <CheckCircle2 className="h-3 w-3" /> : connectionStatus === 'error' ? <AlertCircle className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isChecking ? 'Checking...' : connectionStatus === 'success' ? 'Connected!' : connectionStatus === 'error' ? 'Failed' : 'Check Status'}
              </button>
            </div>
            
            <div className="p-2 bg-white/5 rounded-lg border border-white/10 text-[8px] text-gray-500 font-mono break-all text-center">
                API Base: <span className="text-gray-400">{getApiUrl('/')}</span>
            </div>

            {connectionStatus === 'error' && error && (
                <div className="p-2 bg-red-500/5 rounded-lg border border-red-500/10 text-[9px] text-red-400 font-mono break-all">
                    Error: {error}
                </div>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-6 animate-pulse">
            {/* Subject 1 skeleton */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-4 bg-gray-800/80 rounded-md shrink-0 animate-pulse" />
                <div className="h-3 w-32 bg-gray-800/80 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-[#0e142e]/60 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-gray-800/70 flex items-center justify-center shrink-0 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3.5 w-36 bg-gray-800/70 rounded animate-pulse" />
                        <div className="h-2.5 w-24 bg-gray-800/40 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-4 w-4 bg-gray-800/60 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Subject 2 skeleton */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-4 bg-gray-800/80 rounded-md shrink-0 animate-pulse" />
                <div className="h-3 w-40 bg-gray-800/80 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-[#0e142e]/60 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-gray-800/70 flex items-center justify-center shrink-0 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3.5 w-44 bg-gray-800/70 rounded animate-pulse" />
                        <div className="h-2.5 w-28 bg-gray-800/40 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-4 w-4 bg-gray-800/60 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-[#0c1124] border border-white/5 rounded-2xl p-6 text-center space-y-3">
            <div className="h-10 w-10 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
              <Film className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-white">No Lecture Directories Found</h3>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Connected successfully, but could not find any subject folders or video files formatted as <span className="text-orange-400 font-mono">subject/chapter/lecture.mp4</span>.
              </p>
            </div>
            <button 
              onClick={fetchVideos}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-xs font-bold rounded-xl transition"
            >
              Refresh Bucket
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* VIEW 1: SUBJECT & CHAPTER BROWSER */}
            {currentView === 'list' && (
              <motion.div
                key="list-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {subjects.map((subject) => (
                  <div key={subject.name} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <BookOpen className="h-4 w-4 text-orange-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">
                        {subject.name} Chapters
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {subject.chapters.map((chapter) => (
                        <div 
                          key={chapter.name}
                          onClick={() => {
                            navigateToChapter(subject, chapter);
                          }}
                          className="bg-[#0e142e] border border-white/5 hover:border-orange-500/20 rounded-2xl p-3.5 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                              <FolderOpen className="h-5 w-5 text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-gray-100 truncate">{chapter.name}</h4>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">
                                {chapter.videos.length} {chapter.videos.length === 1 ? 'Lecture' : 'Lectures'} available
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* VIEW 2: CHAPTER PAGE (Big Heading, Lectures Listed Below) */}
            {currentView === 'chapter' && selectedChapter && (
              <motion.div
                key="chapter-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* BIG CHAPTER HEADING */}
                <div className="bg-gradient-to-br from-[#12193a] to-[#0d122b] border border-white/5 rounded-2xl p-5 shadow-xl">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
                    {selectedSubject?.name || "SUBJECT"}
                  </span>
                  <h1 className="text-2xl font-black text-white tracking-tight mt-3 mb-1.5 leading-tight">
                    {selectedChapter.name}
                  </h1>
                  <p className="text-xs text-gray-400 font-semibold">
                    Select a lecture from the list below to begin streaming instantly.
                  </p>
                </div>

                {/* LECTURES LIST */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-extrabold tracking-widest text-gray-500 uppercase px-1">
                    LECTURES IN THIS CHAPTER ({selectedChapter.videos.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {selectedChapter.videos.map((vid, idx) => (
                      <div
                        key={vid.key}
                        onClick={() => {
                          navigateToPlayer(vid);
                        }}
                        className="bg-[#0e142e] border border-white/5 hover:border-orange-500/25 rounded-2xl p-3.5 flex items-center justify-between gap-3 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0 text-orange-400 font-mono text-sm font-extrabold">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-100 truncate">{vid.title}</h4>
                          </div>
                        </div>

                        <button
                          className="px-3 py-1.5 bg-orange-500/10 text-orange-400 hover:bg-orange-600 hover:text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition border border-orange-500/10 shrink-0"
                        >
                          Stream
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: LECTURE PLAYER PAGE (Video Player Top, Lectures Listed Below) */}
            {currentView === 'player' && selectedChapter && activeVideo && (
              <motion.div
                key="player-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* VIDEO PLAYER ON TOP */}
                <div className="bg-[#0c1124] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <CustomVideoPlayer 
                    src={activeVideo.url} 
                    title={activeVideo.title} 
                  />
                </div>

                {/* CURRENT PLAYING TITLE AND INFO */}
                <div className="px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 mb-1">
                    <Tv className="h-4 w-4 animate-pulse text-orange-500" />
                    <span>NOW STREAMING LECTURE</span>
                  </div>
                  <h2 className="text-lg font-black text-white leading-snug">{activeVideo.title}</h2>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                    {selectedSubject?.name} • {selectedChapter.name}
                  </p>
                </div>

                {/* LECTURES LIST BELOW */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <h3 className="text-[10px] font-extrabold tracking-widest text-gray-500 uppercase px-1">
                    PLAYLIST ({selectedChapter.videos.length} LECTURES)
                  </h3>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {selectedChapter.videos.map((vid, idx) => {
                      const isCurrent = vid.key === activeVideo.key;
                      return (
                        <div
                          key={vid.key}
                          onClick={() => {
                            if (!isCurrent) {
                              setActiveVideo(vid);
                            }
                          }}
                          className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                            isCurrent 
                              ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_4px_20px_rgba(249,115,22,0.1)]' 
                              : 'bg-[#0e142e] border-white/5 hover:border-orange-500/10 active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-extrabold border ${
                              isCurrent 
                                ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' 
                                : 'bg-white/5 border-white/5 text-gray-400'
                            }`}>
                              {isCurrent ? <Play className="h-3.5 w-3.5 fill-orange-400 text-orange-400" /> : idx + 1}
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-orange-400' : 'text-gray-200'}`}>
                                {vid.title}
                              </h4>
                            </div>
                          </div>

                          {isCurrent ? (
                            <span className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                              Playing
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 bg-white/5 text-gray-400 rounded-lg">
                              Select
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/5 text-center mt-auto shrink-0">
        <span className="font-extrabold text-[9px] tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 uppercase">
          Powered by AWS Secured Engine
        </span>
      </div>
    </motion.div>
  );
}
