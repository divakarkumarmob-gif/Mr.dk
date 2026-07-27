import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import CustomVideoPlayer from './CustomVideoPlayer';

export default function PrivateVideosPlayer({ activeVideo, selectedSubject, selectedChapter, onBack, onNavigate }: { activeVideo: any, selectedSubject: any, selectedChapter: any, onBack: () => void, onNavigate: (vid: any) => void }) {
  return (
    <div className="min-h-dvh bg-[#060a17] text-white flex flex-col safe-pt">
      <div className="p-4 border-b border-white/5 flex items-center gap-3">
        <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="text-sm font-bold truncate">{activeVideo.title}</h2>
      </div>
      <div className="flex-grow">
        <CustomVideoPlayer src={activeVideo.url} title={activeVideo.title} />
      </div>
      <div className="p-4">
         <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Playlist</h3>
         <div className="space-y-2">
            {selectedChapter.videos.map((vid: any, idx: number) => (
                <div key={vid.key} onClick={() => onNavigate(vid)} className={`p-3 rounded-2xl flex items-center justify-between ${vid.key === activeVideo.key ? 'bg-orange-500/10' : 'bg-[#0e142e]'}`}>
                   <span>{vid.title}</span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
}
