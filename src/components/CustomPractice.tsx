import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { CHAPTER_DATA } from '../constants';

export default function CustomPractice({ onBack, onStart }: { onBack: () => void, onStart: (chapters: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[]) => void }) {
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [activeClass, setActiveClass] = useState<'Class 11' | 'Class 12'>('Class 11');
    const [searchQuery, setSearchQuery] = useState('');
    const [difficulty, setDifficulty] = useState<'Medium' | 'Hard'>('Medium');
    const [selectedChapters, setSelectedChapters] = useState<{name: string, subject: string, numQuestions: number}[]>([]);
    const [popupState, setPopupState] = useState<{
        open: boolean;
        chapter: {name: string, subject: string} | null;
        count: number;
    }>({ open: false, chapter: null, count: 10 });

    const allChapters = Object.entries(CHAPTER_DATA).flatMap(([subject, classes]) =>
        Object.entries(classes).flatMap(([className, chapters]) =>
            chapters.map(chapter => ({ name: chapter, subject, className }))
        )
    );

    const filteredSuggestions = searchQuery
        ? allChapters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const chapters = CHAPTER_DATA[activeSubject][activeClass].filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSelectChapter = (chapter: string, subject: string) => {
        if (selectedChapters.some(c => c.name === chapter)) {
            setSelectedChapters(prev => prev.filter(c => c.name !== chapter));
        } else {
            setPopupState({ open: true, chapter: {name: chapter, subject}, count: 10 });
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen bg-[#0a0f24] text-white p-4 sm:p-6 pb-24"
        >
            <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="bg-white/10 p-2 rounded-full"><ArrowLeft /></button>
                <h1 className="text-xl font-bold">Custom Practice</h1>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3.5 text-gray-500 h-5 w-5" />
                <input
                    type="text"
                    placeholder="Search chapters..."
                    className="w-full bg-[#161e38] p-3 pl-10 rounded-xl outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                {(['Physics', 'Chemistry', 'Biology'] as const).map(sub => (
                    <button key={sub} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeSubject === sub ? 'bg-blue-600' : ''}`} onClick={() => { setActiveSubject(sub); setSearchQuery(''); }}>{sub}</button>
                ))}
            </div>

            <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                {(['Class 11', 'Class 12'] as const).map(cls => (
                    <button key={cls} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeClass === cls ? 'bg-blue-600' : ''}`} onClick={() => { setActiveClass(cls); setSearchQuery(''); }}>{cls}</button>
                ))}
            </div>
            
            <div className="mb-6">
                <p className="text-gray-400 mb-2">Difficulty</p>
                <div className="flex bg-[#161e38] p-1 rounded-xl">
                    {(['Medium', 'Hard'] as const).map(diff => (
                        <button key={diff} className={`flex-1 py-2 text-sm font-bold rounded-lg ${difficulty === diff ? 'bg-blue-600' : ''}`} onClick={() => setDifficulty(diff)}>{diff}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {(searchQuery ? filteredSuggestions : chapters.map(c => ({name: c, subject: activeSubject, className: activeClass}))).map((chapter, index) => (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={`${chapter.name}-${chapter.subject}-${chapter.className}`} 
                        className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between hover:bg-[#1f2a4a] transition-colors cursor-pointer" 
                        onClick={() => {
                            if (searchQuery) {
                                setActiveSubject(chapter.subject as any);
                                setActiveClass(chapter.className as any);
                                setSearchQuery('');
                            }
                            handleSelectChapter(chapter.name, chapter.subject);
                        }}
                    >
                        <div>
                            <span className={selectedChapters.some(c => c.name === chapter.name) ? 'text-blue-400 font-bold' : ''}>{chapter.name}</span>
                            {searchQuery && <p className="text-xs text-gray-400">{chapter.subject} - {chapter.className}</p>}
                        </div>
                        <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={selectedChapters.some(c => c.name === chapter.name)} readOnly />
                    </motion.div>
                ))}
            </div>

            {popupState.open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPopupState({...popupState, open: false})}>
                    <div className="bg-[#161e38] p-6 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Select Questions for {popupState.chapter?.name}</h2>
                        <input type="range" min="5" max="50" step="5" value={popupState.count} onChange={(e) => setPopupState({...popupState, count: parseInt(e.target.value)})} className="w-full mb-4" />
                        <div className="text-center font-bold text-lg mb-6">{popupState.count} Questions</div>
                        <button onClick={() => {
                            const chapter = popupState.chapter;
                            if (chapter) {
                                setSelectedChapters(prev => [...prev, {...chapter, numQuestions: popupState.count}]);
                            }
                            setPopupState({...popupState, open: false});
                        }} className="w-full bg-blue-600 p-3 rounded-xl font-bold">OK</button>
                    </div>
                </div>
            )}
            
            <button className="fixed bottom-6 left-6 right-6 bg-blue-600 p-4 rounded-2xl font-bold text-center" 
                    disabled={selectedChapters.length === 0}
                    onClick={() => onStart(selectedChapters.map(c => ({...c, difficulty})))}>
                {selectedChapters.length > 0 ? `Start Practice (${selectedChapters.reduce((acc, c) => acc + c.numQuestions, 0)} Total Questions)` : 'Select Chapters'}
            </button>
          </div>
        </motion.div>
    );
}
