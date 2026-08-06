import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Play, Tv, Sparkles, CheckCircle2, 
  ChevronRight, SkipForward, BookOpen, MessageSquare, 
  Clock, Share2, Award, BookmarkPlus, StickyNote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

interface PrivateVideosPlayerProps {
  activeVideo: VideoItem;
  selectedSubject: Subject | null;
  selectedChapter: Chapter;
  onBack: () => void;
  onNavigate: (vid: VideoItem) => void;
}

export default function PrivateVideosPlayer({ 
  activeVideo, 
  selectedSubject, 
  selectedChapter, 
  onBack, 
  onNavigate 
}: PrivateVideosPlayerProps) {
  const [activeTab, setActiveTab] = useState<'playlist' | 'notes' | 'doubts'>('playlist');
  const [userNotes, setUserNotes] = useState<{ id: string; time: string; text: string }[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [autoPlayNext, setAutoPlayNext] = useState(true);

  // Find index of current video
  const currentIndex = selectedChapter.videos.findIndex(v => v.key === activeVideo.key);
  const nextVideo = currentIndex < selectedChapter.videos.length - 1 ? selectedChapter.videos[currentIndex + 1] : null;

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    setUserNotes(prev => [
      { id: Date.now().toString(), time: 'Bookmark', text: noteInput.trim() },
      ...prev
    ]);
    setNoteInput('');
  };

  return (
    <div className="min-h-dvh bg-[#050814] text-white flex flex-col font-sans selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Header Navbar with Safe Area Top Padding */}
      <header 
        className="sticky top-0 z-40 bg-[#080d1e]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-lg"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack} 
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 flex-shrink-0"
            title="Back to lectures"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSubject && (
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {selectedSubject.name}
                </span>
              )}
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 truncate max-w-[150px]">
                {selectedChapter.name}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate mt-0.5">
              {activeVideo.title}
            </h1>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {nextVideo && (
            <button
              onClick={() => onNavigate(nextVideo)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all"
            >
              <span>Next Lecture</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        
        {/* Left Column: Video Player & Info */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Cinema Player Container */}
          <div className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800/80 relative group">
            <CustomVideoPlayer src={activeVideo.url} title={activeVideo.title} />
          </div>

          {/* Video Title & Meta Bar */}
          <div className="bg-[#0b1126] border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
                  {activeVideo.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>Chapter: <strong className="text-slate-200">{selectedChapter.name}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> High Quality Stream
                  </span>
                </p>
              </div>

              {/* Action Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: activeVideo.title, url: window.location.href }).catch(() => {});
                    }
                  }}
                  className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/50"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Next Lecture Banner (Mobile) */}
            {nextVideo && (
              <div className="sm:hidden flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] uppercase font-bold text-blue-400">Up Next</p>
                  <p className="text-xs font-semibold text-slate-200 truncate">{nextVideo.title}</p>
                </div>
                <button
                  onClick={() => onNavigate(nextVideo)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 flex-shrink-0 shadow-md shadow-blue-500/20"
                >
                  <span>Play</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Playlist & Notes Sidebar */}
        <div className="flex flex-col bg-[#0b1126] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl h-[550px] lg:h-[calc(100vh-120px)] sticky top-20">
          {/* Tab Navigation Header */}
          <div className="flex border-b border-slate-800/80 bg-[#080d1e] p-1.5">
            <button
              onClick={() => setActiveTab('playlist')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'playlist'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              <span>Lectures ({selectedChapter.videos.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'notes'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span>Notes</span>
            </button>
          </div>

          {/* Tab 1: Lecture Playlist */}
          {activeTab === 'playlist' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Chapter Lectures</span>
                <span className="text-[10px] text-emerald-400 font-medium">Auto-play Next: ON</span>
              </div>

              {selectedChapter.videos.map((vid, idx) => {
                const isActive = vid.key === activeVideo.key;
                return (
                  <motion.div
                    key={vid.key || idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onNavigate(vid)}
                    className={`p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-transparent border-blue-500/40 shadow-lg shadow-blue-500/5'
                        : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    {/* Index or Equalizer */}
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <div className="h-8 w-8 rounded-lg bg-blue-500/20 border border-blue-400/40 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-4">
                            <span className="w-1 bg-blue-400 rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 bg-cyan-300 rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 bg-blue-400 rounded-full animate-bounce h-4/5" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-blue-300 font-bold' : 'text-slate-200'}`}>
                        {vid.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Lecture #{idx + 1}</span>
                        {isActive && <span className="text-blue-400 font-semibold">• Playing Now</span>}
                      </p>
                    </div>

                    {/* Play Icon */}
                    <div className="flex-shrink-0 text-slate-400">
                      <Play className={`h-4 w-4 ${isActive ? 'text-blue-400 fill-blue-400' : ''}`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Timestamp Notes */}
          {activeTab === 'notes' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl mb-3">
                <p className="text-xs font-semibold text-slate-300 mb-2">Add Key Note / Bookmark</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                    placeholder="Type lecture note or formula..."
                    className="flex-1 bg-slate-800 text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddNote}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {userNotes.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No notes saved yet.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Bookmark key formulas & points while watching!</p>
                  </div>
                ) : (
                  userNotes.map((note) => (
                    <div key={note.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-blue-400 mb-1">
                        <span>{note.time}</span>
                      </div>
                      <p className="text-xs text-slate-200">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
