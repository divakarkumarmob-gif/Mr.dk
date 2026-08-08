import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Search, X, Eye, CheckCircle, Trash2, Heart, Clock, Sparkles } from 'lucide-react';
import { CHAPTER_DATA } from '../constants';
import { saveNoteOffline, getNoteOffline, isNoteDownloaded, clearOfflineNotes, toggleFavorite, isFavorite, addRecentlyViewed, getRecentlyViewed } from '../lib/offlineStorage';
import { storageService } from '../lib/storageService';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { getApiUrl, getPdfViewerUrl } from '@/utils/api';
import { useModalBackButton } from '../utils/hardwareBackButton';

function PDFViewer({ chapterName, onClose }: { chapterName: string, onClose: () => void }) {
    const pdfUrl = `https://raw.githubusercontent.com/divakarkumarmob-gif/shortnotes/main/${chapterName.toLowerCase().replace(/ /g, '_')}/${chapterName.toLowerCase().replace(/ /g, '_')}.pdf`;
    const [localUrl, setLocalUrl] = useState<string | null>(null);
    const [remoteViewerUrl, setRemoteViewerUrl] = useState<string | null>(null);
    const [checkedCache, setCheckedCache] = useState(false);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            const localData = await getNoteOffline(chapterName);
            if (!isMounted) return;
            if (localData) {
                setLocalUrl(localData);
            } else {
                try {
                    const url = await getPdfViewerUrl(pdfUrl);
                    if (isMounted) setRemoteViewerUrl(url);
                } catch (e) {
                    console.error("Failed to get PDF token for note:", e);
                    if (isMounted) setRemoteViewerUrl(getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`));
                }
            }
            if (isMounted) setCheckedCache(true);
        })();
        return () => { isMounted = false; };
    }, [chapterName, pdfUrl]);

    if (!checkedCache || (!localUrl && !remoteViewerUrl)) return null;

    const viewerUrl = localUrl || remoteViewerUrl!;

    return (
        <AdvancedPDFViewer
            pdfUrl={viewerUrl}
            title={chapterName}
            originalUrl={pdfUrl}
            onClose={onClose}
        />
    );
}

export default function NotesLibrary({ onBack }: { onBack: () => void }) {
    useModalBackButton(true, onBack);

    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [activeClass, setActiveClass] = useState<'Class 11' | 'Class 12'>('Class 11');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [, setDownloadedUpdate] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const favs = await storageService.getItem<string[]>('favorites') || [];
            setFavorites(favs);
            
            const history = await getRecentlyViewed();
            setRecentlyViewed(history);
        })();
    }, []);

    const chapters = CHAPTER_DATA[activeSubject][activeClass].filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <>
            <div className="min-h-dvh bg-[#030610] text-white p-4 pb-24 selection:bg-cyan-500/30">
                <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl space-y-4">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                            <button onClick={onBack} className="p-2.5 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 transition active:scale-90 text-slate-300 hover:text-white cursor-pointer">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
                                    <BookOpen className="h-5 w-5 text-cyan-400" /> NCERT High-Yield Notes
                                </h1>
                                <p className="text-[11px] text-cyan-400/80 font-medium">Handwritten Revision PDFs & Important Formulas</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => { clearOfflineNotes(); setDownloadedUpdate(prev => !prev); }} 
                            className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl text-rose-400 transition cursor-pointer"
                            title="Clear Local PDF Cache"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search chapter or topic (e.g., Optics, Genetics, Chemical Kinetics)..."
                            className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-500 pl-10 pr-4 py-3 rounded-2xl border border-slate-800 text-xs focus:outline-none focus:border-cyan-400 backdrop-blur-md transition"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Subject Tabs */}
                    <div className="grid grid-cols-3 bg-slate-900/80 border border-slate-800 p-1 rounded-2xl backdrop-blur-md gap-1">
                        {(['Physics', 'Chemistry', 'Biology'] as const).map(sub => {
                            const isActive = activeSubject === sub;
                            let activeClass = 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20';
                            if (sub === 'Chemistry') activeClass = 'bg-gradient-to-r from-cyan-600 to-teal-500 text-white shadow-md shadow-cyan-500/20';
                            if (sub === 'Biology') activeClass = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20';

                            return (
                                <button
                                    key={sub}
                                    className={`py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                                        isActive ? activeClass : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                    }`}
                                    onClick={() => setActiveSubject(sub)}
                                >
                                    {sub}
                                </button>
                            );
                        })}
                    </div>

                    {/* Class Selector Tabs */}
                    <div className="grid grid-cols-2 bg-slate-900/80 border border-slate-800 p-1 rounded-2xl backdrop-blur-md gap-1">
                        {(['Class 11', 'Class 12'] as const).map(cls => (
                            <button
                                key={cls}
                                className={`py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                                    activeClass === cls 
                                        ? 'bg-slate-800 border border-slate-700 text-cyan-300 shadow-sm' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                onClick={() => setActiveClass(cls)}
                            >
                                {cls}
                            </button>
                        ))}
                    </div>

                    {/* Chapters Grid / List */}
                    <div className="space-y-2.5 pt-1">
                        {chapters.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/80 border border-slate-800 rounded-3xl backdrop-blur-md">
                                <p className="text-sm font-bold text-slate-300">Koi chapter nahi mila 😕</p>
                                <p className="text-xs text-slate-500 mt-1">Dusra query try karein ya subject switch karein.</p>
                            </div>
                        ) : (
                            chapters.map((chapter, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ x: 4 }}
                                    onClick={() => { addRecentlyViewed(chapter); setSelectedChapter(chapter); }}
                                    className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer backdrop-blur-xl shadow-md transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl group-hover:bg-cyan-500 group-hover:text-slate-950 transition duration-300 text-cyan-400">
                                            <BookOpen className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <span className="font-extrabold text-xs text-slate-100 group-hover:text-cyan-300 transition block leading-tight">{chapter}</span>
                                            <span className="text-[10px] text-cyan-400/70 font-medium">{activeClass} • {activeSubject}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavorite(chapter);
                                                setFavorites(prev => isFavorite(chapter) ? prev.filter(f => f !== chapter) : [...prev, chapter]);
                                            }} 
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                                        >
                                            <Heart className={`h-4 w-4 ${isFavorite(chapter) ? 'fill-rose-500 text-rose-500' : ''}`} />
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-950 bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-1 rounded-full shadow-sm">
                                            View PDF
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* Recently Viewed Section */}
                    {recentlyViewed.length > 0 && (
                        <div className="pt-4">
                            <h3 className="text-xs font-black text-slate-500 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
                                <Clock className="h-3.5 w-3.5 text-cyan-500" /> Recently Opened Notes
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {recentlyViewed.map((chapter: string, idx: number) => (
                                    <div
                                        key={idx}
                                        onClick={() => { addRecentlyViewed(chapter); setSelectedChapter(chapter); }}
                                        className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-gray-300 truncate cursor-pointer hover:bg-white/10 hover:text-white transition flex items-center gap-2"
                                    >
                                        <BookOpen className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                        <span className="truncate">{chapter}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedChapter ? (
                <PDFViewer 
                    chapterName={selectedChapter} 
                    onClose={() => { 
                        setSelectedChapter(null); 
                        setDownloadedUpdate(prev => !prev); 
                    }} 
                />
            ) : null}
        </>
    );
}
