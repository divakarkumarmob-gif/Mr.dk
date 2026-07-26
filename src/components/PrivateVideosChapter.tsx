import { ArrowLeft, Play } from 'lucide-react';
import { motion } from 'motion/react';

export default function PrivateVideosChapter({ selectedSubject, selectedChapter, onBack, onNavigate }: { selectedSubject: any, selectedChapter: any, onBack: () => void, onNavigate: (vid: any) => void }) {
  return (
    <div className="min-h-dvh bg-[#060a17] text-white p-4 safe-pt">
      <button onClick={onBack} className="p-2 mb-4 bg-white/5 hover:bg-white/10 rounded-xl inline-block"><ArrowLeft className="h-5 w-5"/></button>
      <div className="bg-gradient-to-br from-[#12193a] to-[#0d122b] p-5 rounded-2xl mb-6">
        <span className="text-[10px] font-extrabold uppercase text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full">{selectedSubject.name}</span>
        <h1 className="text-2xl font-black mt-3">{selectedChapter.name}</h1>
      </div>
      <h3 className="text-[10px] font-extrabold text-gray-500 uppercase px-1 mb-2">LECTURES ({selectedChapter.videos.length})</h3>
      <div className="space-y-2">
        {selectedChapter.videos.map((vid: any, idx: number) => (
          <div key={vid.key} onClick={() => onNavigate(vid)} className="bg-[#0e142e] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer">
            <span className="text-xs font-bold truncate">{vid.title}</span>
            <Play className="h-4 w-4 text-orange-400" />
          </div>
        ))}
      </div>
    </div>
  );
}
