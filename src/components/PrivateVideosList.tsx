import { useState, useEffect } from 'react';
import { FolderOpen, ChevronRight, BookOpen, X, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/utils/api';

export default function PrivateVideosList({ subjects, onNavigate, onClose, debugInfo }: { subjects: any[], onNavigate: (subj: any, chap: any) => void, onClose: () => void, debugInfo?: string }) {
  return (
    <div className="min-h-dvh bg-[#060a17] text-white p-4 safe-pt">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">Private Lecture Hub</h2>
        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl"><X className="h-5 w-5"/></button>
      </div>

      {/* Temporary visible debug banner - shows fetch status directly on screen */}
      {debugInfo ? (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-[10px] text-yellow-300 break-all">
          DEBUG: {debugInfo}
        </div>
      ) : null}

      {subjects.length === 0 ? (
        <div className="p-4 bg-white/5 rounded-xl text-xs text-gray-400 text-center">
          No subjects loaded yet (subjects array is empty).
        </div>
      ) : null}
      
      <div className="space-y-4">
        {subjects.map((subject) => (
        <div key={subject.name} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">{subject.name} Chapters</span>
            </div>
            {subject.chapters.map((chapter: any) => (
            <div 
                key={chapter.name}
                onClick={() => onNavigate(subject, chapter)}
                className="bg-[#0e142e] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer"
            >
                <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><FolderOpen className="h-5 w-5 text-blue-400" /></div>
                <div>
                    <h4 className="text-sm font-bold text-gray-100">{chapter.name}</h4>
                    <p className="text-[10px] text-gray-500">{chapter.videos.length} Lectures</p>
                </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500" />
            </div>
            ))}
        </div>
        ))}
      </div>
    </div>
  );
}
