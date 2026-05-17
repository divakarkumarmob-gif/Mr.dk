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
            className="min-h-screen bg-[#0a0f24] text-white p-6 pb-24"
        >
             <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="bg-white/10 p-2 rounded-full"><ArrowLeft /></button>
                    <h1 className="text-xl font-bold">Notes Library</h1>
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
                        <button key={sub} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeSubject === sub ? 'bg-blue-600' : ''}`} onClick={() => setActiveSubject(sub)}>{sub}</button>
                    ))}
                </div>

                <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                    {(['Class 11', 'Class 12'] as const).map(cls => (
                        <button key={cls} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeClass === cls ? 'bg-blue-600' : ''}`} onClick={() => setActiveClass(cls)}>{cls}</button>
                    ))}
                </div>

                <div className="space-y-4">
                    {chapters.map((chapter, idx) => (
                        <div key={idx} className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#1f2a4a] transition-all">
                             <div className="flex items-center gap-3">
                                 <BookOpen className="text-orange-500 h-6 w-6"/>
                                 <span className="font-bold">{chapter} ({activeClass} {activeSubject})</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <Eye onClick={() => setSelectedChapter(chapter)} className="text-gray-400 h-5 w-5 hover:text-white" />
                                <Download className="text-gray-400 h-5 w-5 hover:text-white" />
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
