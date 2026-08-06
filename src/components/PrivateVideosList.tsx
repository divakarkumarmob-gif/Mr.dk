import { useState } from 'react';
import { FolderOpen, ChevronRight, BookOpen, X, Search, Lock, Play } from 'lucide-react';

export default function PrivateVideosList({ subjects, onNavigate, onClose, debugInfo }: { subjects: any[], onNavigate: (subj: any, chap: any) => void, onClose: () => void, debugInfo?: string }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubjects = subjects.map(subject => ({
    ...subject,
    chapters: subject.chapters.filter((chap: any) => 
      chap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subject.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(subject => subject.chapters.length > 0);

  return (
    <div className="min-h-dvh bg-[#050814] text-white p-4 sm:p-6 lg:p-8 safe-pt">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
              <Lock className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">Private Lecture Hub</h1>
              <p className="text-xs text-gray-400 font-medium">Select a chapter to start streaming lectures directly</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search chapter or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>

            <button 
              onClick={onClose} 
              className="p-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-xl transition border border-white/10 shrink-0"
              title="Close"
            >
              <X className="h-5 w-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Debug Info Banner if present */}
        {debugInfo && !debugInfo.startsWith('OK') ? (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-[11px] text-yellow-300 break-all font-mono">
            DEBUG STATUS: {debugInfo}
          </div>
        ) : null}

        {/* Empty State */}
        {subjects.length === 0 ? (
          <div className="p-8 bg-[#0a0e1e] border border-white/5 rounded-3xl text-center space-y-3 max-w-md mx-auto my-12">
            <div className="h-12 w-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto text-orange-400">
              <FolderOpen className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Private Lectures Found</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              No private video folders found in AWS S3 storage. Please verify S3 credentials or upload videos to S3 bucket.
            </p>
          </div>
        ) : null}

        {/* Subject wise Chapter Cards Grid */}
        <div className="space-y-8">
          {(searchQuery ? filteredSubjects : subjects).map((subject) => (
            <div key={subject.name} className="space-y-4">
              <div className="flex items-center gap-2.5 px-1">
                <BookOpen className="h-5 w-5 text-orange-400" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-orange-400">
                  {subject.name} ({subject.chapters.reduce((acc: number, c: any) => acc + c.videos.length, 0)} Lectures)
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subject.chapters.map((chapter: any) => (
                  <div 
                    key={chapter.name}
                    onClick={() => onNavigate(subject, chapter)}
                    className="group bg-gradient-to-br from-[#0c1228] to-[#080d1e] hover:from-[#111938] hover:to-[#0d142d] border border-white/10 hover:border-orange-500/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-orange-500/10 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FolderOpen className="h-5 w-5 text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-100 group-hover:text-orange-300 transition-colors line-clamp-2 leading-snug">
                            {chapter.name}
                          </h3>
                          <p className="text-[11px] font-semibold text-gray-400 mt-1">
                            {chapter.videos.length} {chapter.videos.length === 1 ? 'Lecture' : 'Lectures'} Available
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold">
                      <span className="text-orange-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <Play className="h-3.5 w-3.5 fill-orange-400" /> Stream Chapter
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
