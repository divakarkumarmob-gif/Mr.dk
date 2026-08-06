import { useState, useMemo } from 'react';
import { 
  ArrowLeft, Play, Tv, CheckCircle2, 
  ChevronRight, Share2, BookmarkPlus, StickyNote,
  Search, Lock, FolderOpen, Video
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
  const [activeTab, setActiveTab] = useState<'notes' | 'overview'>('notes');
  const [userNotes, setUserNotes] = useState<{ id: string; time: string; text: string }[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [lectureSearch, setLectureSearch] = useState('');

  // Find index of current video
  const currentIndex = selectedChapter.videos.findIndex(v => v.key === activeVideo.key);
  const nextVideo = currentIndex < selectedChapter.videos.length - 1 ? selectedChapter.videos[currentIndex + 1] : null;

  const filteredVideos = useMemo(() => {
    if (!lectureSearch.trim()) return selectedChapter.videos;
    return selectedChapter.videos.filter(v => v.title.toLowerCase().includes(lectureSearch.toLowerCase()));
  }, [selectedChapter.videos, lectureSearch]);

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    setUserNotes(prev => [
      { id: Date.now().toString(), time: 'Bookmark', text: noteInput.trim() },
      ...prev
    ]);
    setNoteInput('');
  };

  return (
    <div className="min-h-dvh bg-[#050814] text-white flex flex-col font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Top Header Navbar */}
      <header 
        className="sticky top-0 z-40 bg-[#080d1e]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-lg"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack} 
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all shadow-sm active:scale-95 flex-shrink-0"
            title="Back to Chapter Hub"
          >
            <ArrowLeft className="h-5 w-5 text-orange-400" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSubject && (
                <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  {selectedSubject.name}
                </span>
              )}
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate max-w-[200px]">
                {selectedChapter.name}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-100 truncate mt-0.5">
              {activeVideo.title}
            </h1>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {nextVideo && (
            <button
              onClick={() => onNavigate(nextVideo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold transition-all"
            >
              <span className="hidden sm:inline">Next Lecture</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Desktop & Mobile Responsive Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        
        {/* --- LEFT SIDE: LECTURES LIST (DESKTOP & MOBILE PLAYLIST) --- */}
        <aside className="lg:col-span-4 flex flex-col bg-[#0b1126] border border-white/10 rounded-2xl overflow-hidden shadow-xl lg:h-[calc(100vh-100px)] sticky lg:top-20 order-2 lg:order-1">
          {/* Header of Left Sidebar */}
          <div className="p-4 bg-[#080d1e] border-b border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-orange-400" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Chapter Lectures ({selectedChapter.videos.length})
                </h2>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-md">
                1st Video Playing
              </span>
            </div>

            <p className="text-[11px] font-bold text-gray-400 truncate">
              {selectedChapter.name}
            </p>

            {/* Lecture Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search lecture name..."
                value={lectureSearch}
                onChange={(e) => setLectureSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          {/* Lectures List Scrollable Box */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 max-h-[400px] lg:max-h-none">
            {filteredVideos.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                No lectures match your search.
              </div>
            ) : (
              filteredVideos.map((vid, idx) => {
                const isActive = vid.key === activeVideo.key;
                const realIndex = selectedChapter.videos.findIndex(v => v.key === vid.key);
                return (
                  <motion.div
                    key={vid.key || idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onNavigate(vid)}
                    className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/20 via-orange-600/10 to-transparent border-orange-500/40 shadow-lg shadow-orange-500/10'
                        : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-slate-300'
                    }`}
                  >
                    {/* Index or Animated Equalizer */}
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-400/40 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-4">
                            <span className="w-1 bg-orange-400 rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 bg-amber-300 rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 bg-orange-400 rounded-full animate-bounce h-4/5" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-xs font-bold text-gray-400 font-mono">
                          {realIndex >= 0 ? realIndex + 1 : idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Video Title & Meta */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-orange-400 font-black' : 'text-slate-200'}`}>
                        {vid.title}
                      </p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-0.5 flex items-center gap-2">
                        <span>Lecture #{realIndex >= 0 ? realIndex + 1 : idx + 1}</span>
                        {isActive && <span className="text-orange-400 font-extrabold uppercase tracking-wider">• Now Playing</span>}
                      </p>
                    </div>

                    {/* Play Icon */}
                    <div className="flex-shrink-0 text-slate-400">
                      <Play className={`h-4 w-4 ${isActive ? 'text-orange-400 fill-orange-400' : ''}`} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </aside>

        {/* --- RIGHT SIDE: AUTOMATIC VIDEO PLAYER & DESKTOP MODAL --- */}
        <section className="lg:col-span-8 flex flex-col gap-4 order-1 lg:order-2">
          {/* Cinema Video Player Modal Box */}
          <div className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 relative group">
            <CustomVideoPlayer src={activeVideo.url} title={activeVideo.title} />
          </div>

          {/* Video Title & Action Toolbar */}
          <div className="bg-[#0b1126] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-extrabold text-orange-400 mb-1 uppercase tracking-wider">
                  <Tv className="h-4 w-4 animate-pulse text-orange-500" />
                  <span>PLAYING PRIVATE LECTURE STREAM</span>
                </div>
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight leading-snug">
                  {activeVideo.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Subject: <strong className="text-gray-200">{selectedSubject?.name}</strong></span>
                  <span>•</span>
                  <span>Chapter: <strong className="text-gray-200">{selectedChapter.name}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> High Quality Auto-Play
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
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10"
                  title="Share Lecture"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Notes & Lecture Info Drawer */}
          <div className="bg-[#0b1126] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-orange-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Lecture Notes & Formulas
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Save notes while watching</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                placeholder="Add important formula or key note..."
                className="flex-1 bg-white/5 text-white text-xs px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-orange-500/50"
              />
              <button
                onClick={handleAddNote}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition"
              >
                <BookmarkPlus className="h-4 w-4" />
                <span>Save Note</span>
              </button>
            </div>

            {/* Saved Notes List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {userNotes.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-xs font-medium">
                  No notes added yet for this lecture. Type above to bookmark key points!
                </div>
              ) : (
                userNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-200">
                    <span className="text-[10px] font-extrabold text-orange-400 uppercase tracking-widest block mb-1">
                      {note.time}
                    </span>
                    <p className="font-medium leading-relaxed">{note.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
