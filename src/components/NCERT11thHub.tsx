
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Download, X, Eye } from 'lucide-react';
import { CHAPTER_DATA } from '../constants';
import AdvancedPDFViewer from './AdvancedPDFViewer';

export default function NCERT11thHub({ onBack }: { onBack: () => void }) {
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

    const chapters = CHAPTER_DATA[activeSubject]['Class 11'];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="min-h-screen bg-[#0a0f24] text-white p-6 pb-24">
            <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="bg-white/10 p-2 rounded-full"><ArrowLeft /></button>
                    <h1 className="text-xl font-bold">NCERT 11th</h1>
                </div>

                <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                    {(['Physics', 'Chemistry', 'Biology'] as const).map(sub => (
                        <button key={sub} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeSubject === sub ? 'bg-blue-600' : ''}`} onClick={() => setActiveSubject(sub)}>{sub}</button>
                    ))}
                </div>

                <div className="space-y-4">
                    {chapters.map((chapter, idx) => (
                        <div key={idx} onClick={() => setSelectedChapter(chapter)} className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#1f2a4a] transition-all">
                             <div className="flex items-center gap-3">
                                 <BookOpen className="text-orange-500 h-6 w-6"/>
                                 <span className="font-bold">{chapter}</span>
                             </div>
                             <Eye className="text-gray-400 h-5 w-5 hover:text-white" />
                        </div>
                    ))}
                </div>
            </div>

            {selectedChapter && (
                <AdvancedPDFViewer pdfUrl={`https://raw.githubusercontent.com/divakarkumarmob-gif/ncert-11th/main/${activeSubject.toLowerCase()}/${selectedChapter.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '')}.pdf`} title={selectedChapter} onClose={() => setSelectedChapter(null)} />
            )}
        </motion.div>
    );
}

