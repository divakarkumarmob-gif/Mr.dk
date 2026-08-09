import VideoPlayer from './VideoPlayer';
import { ArrowLeft } from 'lucide-react';

export default function LectureView({ topic, onBack }: { topic: string, onBack: () => void }) {
    return (
        <div className="min-h-dvh bg-[#0a0f24] text-white flex flex-col pt-[env(safe-area-inset-top,0px)]">
            <div className="p-4 sm:p-6 flex items-center gap-4 bg-slate-900/80 border-b border-purple-500/20 backdrop-blur-xl shadow-lg">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-2 text-sm font-bold bg-white/10 text-white p-2 px-4 rounded-full hover:bg-white/20 border border-white/15 backdrop-blur-md cursor-pointer transition"
                >
                    <ArrowLeft className="h-4 w-4 text-purple-300" /> Back
                </button>
                <h1 className="text-lg sm:text-xl font-extrabold text-white truncate bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">
                    {topic}
                </h1>
            </div>
            <div className="flex-grow">
                <VideoPlayer topic={topic} onClose={onBack} />
            </div>
        </div>
    );
}

