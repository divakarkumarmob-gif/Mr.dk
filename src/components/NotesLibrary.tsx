import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Search, X, Eye } from 'lucide-react';
import { CHAPTER_DATA } from '../constants';

function PDFViewer({ chapterName, onClose }: { chapterName: string, onClose: () => void }) {
    // Construct the URL based on the chapter name (mapping spaces to lowercase or directory format)
    const pdfUrl = `https://raw.githubusercontent.com/divakarkumarmob-gif/shortnotes/main/${chapterName.toLowerCase().replace(/ /g, '_')}/${chapterName.toLowerCase().replace(/ /g, '_')}.pdf`;

    return (
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="fixed inset-0 bg-black/80 z-[500] p-0 sm:p-6 overflow-y-auto"
           onClick={onClose}
        >
            <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-2xl p-6 text-gray-900" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                   <h2 className="text-xl font-bold">{chapterName}</h2>
                   <div className="flex gap-2">
                       <button onClick={() => window.open(pdfUrl, '_blank')} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"><Download className="h-5 w-5" /></button>
                       <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X className="h-6 w-6" /></button>
                   </div>
               </div>
               
               <div className="w-full h-[calc(100vh-120px)]">
                    <iframe 
                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`} 
                        className="w-full h-full"
                        title={chapterName}
                    />
               </div>
            </div>
        </motion.div>
    );
}

export default function NotesLibrary({ onBack }: { onBack: () => void }) {
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [activeClass, setActiveClass] = useState<'Class 11' | 'Class 12'>('Class 11');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

    const chapters = CHAPTER_DATA[activeSubject][activeClass].filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-h-screen bg-background text-foreground p-6 pb-24"
        >
         <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onBack} className="bg-white/10 p-1.5 rounded-full"><ArrowLeft /></button>
                    <h1 className="text-lg font-bold">Notes Library</h1>
                </div>
                
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-2.5 text-gray-500 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search chapters..."
                        className="w-full bg-card p-2 pl-9 rounded-lg outline-none text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex bg-card p-0.5 rounded-lg mb-4">
                    {(['Physics', 'Chemistry', 'Biology'] as const).map(sub => (
                        <button key={sub} className={`flex-1 py-1 text-xs font-bold rounded-lg ${activeSubject === sub ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} onClick={() => setActiveSubject(sub)}>{sub}</button>
                    ))}
                </div>

                <div className="flex bg-card p-0.5 rounded-lg mb-4">
                    {(['Class 11', 'Class 12'] as const).map(cls => (
                        <button key={cls} className={`flex-1 py-1 text-xs font-bold rounded-lg ${activeClass === cls ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} onClick={() => setActiveClass(cls)}>{cls}</button>
                    ))}
                </div>

                <div className="space-y-2">
                    {chapters.map((chapter, idx) => (
                        <div key={idx} className="bg-card p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-muted transition-all">
                             <div className="flex items-center gap-2">
                                 <BookOpen className="text-orange-500 h-5 w-5"/>
                                 <span className="font-bold text-sm text-foreground">{chapter} ({activeClass} {activeSubject})</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <Eye onClick={() => setSelectedChapter(chapter)} className="text-muted-foreground h-4 w-4 hover:text-foreground" />
                                <Download className="text-muted-foreground h-4 w-4 hover:text-foreground" />
                             </div>
                         </div>
                    ))}
                </div>
             </div>

             {selectedChapter && (
                 <PDFViewer chapterName={selectedChapter} onClose={() => setSelectedChapter(null)} />
             )}
        </motion.div>
    );
}
