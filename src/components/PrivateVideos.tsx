import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Play, Loader2, Lock, AlertCircle, RefreshCw, KeyRound, 
  Film, ChevronDown, ChevronRight, Folder, FolderOpen, BookOpen
} from 'lucide-react';
import CustomVideoPlayer from './CustomVideoPlayer';

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
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  // Expanded levels trackers
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/private-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch videos from AWS S3');
      }
      setSubjects(data.subjects || []);
      
      // Auto-expand the first subject if available
      if (data.subjects && data.subjects.length > 0) {
        setExpandedSubjects({ [data.subjects[0].name]: true });
      }
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

  const toggleSubject = (subjName: string) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjName]: !prev[subjName]
    }));
  };

  const toggleChapter = (subjName: string, chapName: string) => {
    const key = `${subjName}::${chapName}`;
    setExpandedChapters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper to count total videos in a Subject
  const getTotalSubjectVideos = (subj: Subject) => {
    return subj.chapters.reduce((total, chap) => total + chap.videos.length, 0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-[#0a0f24] z-[1000] flex flex-col p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/20">
            <Lock className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">Private Lecture Hub</h2>
            <p className="text-[10px] text-gray-400">AWS S3 Secured Subject Browser</p>
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
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 flex flex-col">
        {/* Active Player Row */}
        {activeVideoUrl && (
          <div className="bg-[#121933] border border-white/5 rounded-2xl overflow-hidden shadow-2xl p-3 shrink-0">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-semibold text-orange-400 flex items-center gap-1">
                <Film className="h-3 w-3 animate-pulse" /> Playing: {activeVideoTitle}
              </span>
              <button 
                onClick={() => { setActiveVideoUrl(null); setActiveVideoTitle(null); }}
                className="text-[10px] text-gray-400 hover:text-white underline font-medium"
              >
                Close Player
              </button>
            </div>
            <div className="w-full">
              <CustomVideoPlayer 
                src={activeVideoUrl} 
                title={activeVideoTitle || 'Lecture Stream'} 
              />
            </div>
          </div>
        )}

        {/* Dynamic S3 Loading / Errors / Groups */}
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
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="h-9 w-9 animate-spin text-orange-500 mb-3" />
            <p className="text-sm font-semibold text-gray-300">Connecting to S3 bucket...</p>
            <p className="text-[11px] text-gray-500 mt-1 font-medium">Reading lecture structures & files</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-[#121933] border border-white/5 rounded-2xl p-8 text-center space-y-3 my-auto">
            <div className="h-11 w-11 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
              <Film className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">No Lecture Directories Found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                We successfully connected to your S3 bucket, but could not find any subject folders or video files formatted as <span className="text-orange-400 font-mono">subject/chapter/lecture.mp4</span>.
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
          <div className="space-y-3 flex-1">
            {/* Subjects Header / Stats Info */}
            <div className="flex justify-between items-center bg-[#121933]/40 border border-white/5 px-4 py-2.5 rounded-xl shrink-0">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                STRUCTURED SUBJECT DIRECTORIES
              </span>
              <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/15 px-2.5 py-0.5 rounded-full">
                {subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'} Available
              </span>
            </div>

            {/* Hierarchical Tree Container */}
            <div className="space-y-3 pb-8">
              {subjects.map((subject) => {
                const isSubjExpanded = !!expandedSubjects[subject.name];
                const totalVids = getTotalSubjectVideos(subject);
                
                return (
                  <div key={subject.name} className="bg-[#121933]/50 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                    {/* Level 1: Subject Header */}
                    <button
                      onClick={() => toggleSubject(subject.name)}
                      className="w-full flex items-center justify-between p-4 hover:bg-[#121933]/80 transition select-none text-left"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 bg-orange-500/10 rounded-xl flex items-center justify-center border border-orange-500/15 shrink-0">
                          <BookOpen className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-white tracking-wide truncate">
                            {subject.name}
                          </h3>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                            {subject.chapters.length} {subject.chapters.length === 1 ? 'Chapter' : 'Chapters'} • {totalVids} {totalVids === 1 ? 'Video' : 'Videos'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSubjExpanded ? (
                          <ChevronDown className="h-5 w-5 text-orange-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-500 shrink-0" />
                        )}
                      </div>
                    </button>

                    {/* Level 2: Chapters under Subject */}
                    <AnimatePresence initial={false}>
                      {isSubjExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="border-t border-white/5 bg-[#0e142e]/60 divide-y divide-white/[0.02]"
                        >
                          {subject.chapters.map((chapter) => {
                            const chapKey = `${subject.name}::${chapter.name}`;
                            const isChapExpanded = !!expandedChapters[chapKey];
                            
                            return (
                              <div key={chapter.name} className="overflow-hidden">
                                {/* Chapter Row Trigger */}
                                <button
                                  onClick={() => toggleChapter(subject.name, chapter.name)}
                                  className="w-full flex items-center justify-between py-3.5 px-6 hover:bg-white/[0.02] transition text-left select-none"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="shrink-0">
                                      {isChapExpanded ? (
                                        <FolderOpen className="h-4.5 w-4.5 text-blue-400 fill-blue-400/10" />
                                      ) : (
                                        <Folder className="h-4.5 w-4.5 text-gray-400 fill-gray-400/10" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-sm text-gray-200 truncate">
                                        {chapter.name}
                                      </h4>
                                      <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
                                        {chapter.videos.length} {chapter.videos.length === 1 ? 'Lecture Video' : 'Lecture Videos'}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    {isChapExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-blue-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-600" />
                                    )}
                                  </div>
                                </button>

                                {/* Level 3: Videos/Lectures inside Chapter */}
                                <AnimatePresence initial={false}>
                                  {isChapExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                                      className="bg-black/20 pl-10 pr-4 py-1.5 space-y-1.5 border-l-2 border-dashed border-blue-500/20 ml-8 my-1"
                                    >
                                      {chapter.videos.map((vid) => {
                                        const isPlayingThis = activeVideoUrl === vid.url;
                                        
                                        return (
                                          <div
                                            key={vid.key}
                                            onClick={() => {
                                              setActiveVideoUrl(vid.url);
                                              setActiveVideoTitle(vid.title);
                                            }}
                                            className={`group flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                                              isPlayingThis 
                                                ? 'bg-orange-500/10 border-orange-500/30' 
                                                : 'bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.04] hover:border-white/10'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border transition ${
                                                isPlayingThis
                                                  ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                                                  : 'bg-white/5 border-white/5 text-gray-400 group-hover:text-orange-400 group-hover:bg-orange-500/10 group-hover:border-orange-500/20'
                                              }`}>
                                                <Play className={`h-3.5 w-3.5 ${isPlayingThis ? 'fill-orange-400 text-orange-400' : ''}`} />
                                              </div>
                                              <div className="min-w-0">
                                                <h5 className={`text-xs font-bold truncate transition ${
                                                  isPlayingThis ? 'text-orange-400' : 'text-gray-300 group-hover:text-orange-400'
                                                }`}>
                                                  {vid.title}
                                                </h5>
                                                <p className="text-[9px] font-mono text-gray-500 mt-0.5 truncate">
                                                  {vid.key.split('/').pop()}
                                                </p>
                                              </div>
                                            </div>
                                            
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveVideoUrl(vid.url);
                                                setActiveVideoTitle(vid.title);
                                              }}
                                              className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shrink-0 transition select-none ${
                                                isPlayingThis
                                                  ? 'bg-orange-600 text-white'
                                                  : 'bg-white/5 hover:bg-orange-600 text-gray-400 hover:text-white border border-white/5 hover:border-orange-600'
                                              }`}
                                            >
                                              {isPlayingThis ? 'Playing' : 'Stream'}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-white/5 text-center mt-auto shrink-0">
        <span className="font-bold text-[10px] tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 uppercase">
          Powered by AWS Secured Engine
        </span>
      </div>
    </motion.div>
  );
}
