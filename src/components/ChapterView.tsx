import { ArrowLeft, Play } from 'lucide-react';

export default function ChapterView({ chapterName, onBack, onNavigate }: { chapterName: string, onBack: () => void, onNavigate: (view: string, params: Record<string, string>) => void }) {
    return (
        <div className="min-h-dvh bg-[#0a0f24] text-white pt-6 sm:pt-10 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-2 text-sm font-bold bg-white/10 text-white p-2 px-4 rounded-full hover:bg-white/20 border border-white/15 backdrop-blur-md cursor-pointer transition mb-6"
                >
                    <ArrowLeft className="h-4 w-4 text-purple-300" /> Back
                </button>
                
                <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-200 via-blue-300 to-pink-300">
                    {chapterName}
                </h1>

                <div className="space-y-3">
                    {['Lecture 1', 'Lecture 2', 'Lecture 3'].map(lecture => (
                        <div 
                            key={lecture} 
                            onClick={() => onNavigate('watch', { topic: lecture })} 
                            className="p-4 sm:p-5 bg-slate-900/60 backdrop-blur-xl rounded-2xl cursor-pointer flex justify-between items-center border border-purple-500/20 hover:border-purple-500/50 hover:bg-slate-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300 group"
                        >
                            <span className="font-bold text-base text-white group-hover:text-purple-200">{lecture}</span>
                            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 group-hover:scale-110 transition-transform">
                                <Play className="h-4 w-4 text-purple-300 fill-purple-300/30" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

