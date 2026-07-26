import { Play } from 'lucide-react';

export default function ChapterView({ chapterName, onBack, onNavigate }: { chapterName: string, onBack: () => void, onNavigate: (view: string, params: Record<string, string>) => void }) {
    return (
        <div className="min-h-dvh bg-[#0a0e1a] text-white pt-10 px-4">
            <button onClick={onBack} className="text-gray-400 mb-4">⬅️ Back</button>
            <h1 className="text-2xl font-bold mb-4">{chapterName}</h1>
            <div className="space-y-2">
                {['Lecture 1', 'Lecture 2', 'Lecture 3'].map(lecture => (
                    <div key={lecture} onClick={() => onNavigate('watch', { topic: lecture })} className="p-4 bg-[#0F1729] rounded-lg cursor-pointer flex justify-between items-center">
                        <span>{lecture}</span>
                        <Play className="h-4 w-4 text-[#3B82F6]" />
                    </div>
                ))}
            </div>
        </div>
    );
}
