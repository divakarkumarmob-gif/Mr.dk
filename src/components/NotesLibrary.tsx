import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Search, X, Eye, CheckCircle, Trash2, Heart, Clock } from 'lucide-react';
import { CHAPTER_DATA } from '../constants';
import { saveNoteOffline, getNoteOffline, isNoteDownloaded, clearOfflineNotes, toggleFavorite, isFavorite, addRecentlyViewed, getRecentlyViewed } from '../lib/offlineStorage';
import { storageService } from '../lib/storageService';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { getApiUrl } from '@/utils/api';

function PDFViewer({ chapterName, onClose }: { chapterName: string, onClose: () => void }) {
    const pdfUrl = `https://raw.githubusercontent.com/divakarkumarmob-gif/shortnotes/main/${chapterName.toLowerCase().replace(/ /g, '_')}/${chapterName.toLowerCase().replace(/ /g, '_')}.pdf`;
    const [localUrl, setLocalUrl] = useState<string | null>(null);
    const [checkedCache, setCheckedCache] = useState(false);

    useEffect(() => {
        (async () => {
            const localData = await getNoteOffline(chapterName);
            if (localData) {
                setLocalUrl(localData);
            }
            setCheckedCache(true);
        })();
    }, [chapterName]);

    if (!checkedCache) return null;

    // If we have an offline-cached copy, pass its data URL straight through.
    // Otherwise route the remote PDF through our backend proxy — embedding
    // GitHub raw URLs (or Google Docs Viewer) directly gets blocked by
    // X-Frame-Options / CSP inside the Android WebView.
    const viewerUrl = localUrl || getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}`);

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
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [activeClass, setActiveClass] = useState<'Class 11' | 'Class 12'>('Class 11');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [, setDownloadedUpdate] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [downloaded, setDownloaded] = useState<string[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            const favs = await storageService.getItem<string[]>('favorites') || [];
            setFavorites(favs);
            
            const history = await getRecentlyViewed();
            setRecentlyViewed(history);
            
            // For downloaded, this is harder to get efficiently, 
            // but we can at least initialize the favorites and recent views.
        })();
    }, []);

    const isFavoriteChapter = (chapter: string) => favorites.includes(chapter);
    const isDownloadedChapter = (chapter: string) => downloaded.includes(chapter);

    const chapters = CHAPTER_DATA[activeSubject][activeClass].filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const checkDownloaded = async (chapter: string) => {
        return await isNoteDownloaded(chapter);
    }
    return (
        <>
         <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="bg-white/10 p-1.5 rounded-full"><ArrowLeft /></button>
                        <h1 className="text-lg font-bold">Notes Library</h1>
                    </div>
                    <button onClick={() => { clearOfflineNotes(); setDownloadedUpdate(prev => !prev); }} className="bg-white/10 p-1.5 rounded-full"><Trash2 className="h-4 w-4 text-red-500" /></button>
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
                                <Heart 
                                    className={`${isFavorite(chapter) ? 'text-red-500 fill-red-500' : 'text-muted-foreground'} h-4 w-4 hover:text-red-500 cursor-pointer`} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFavorite(chapter);
                                        setDownloadedUpdate(prev => !prev);
                                    }}
                                />
                                <Eye onClick={() => { addRecentlyViewed(chapter); setSelectedChapter(chapter); }} className="text-muted-foreground h-4 w-4 hover:text-foreground" />
                                {isNoteDownloaded(chapter) ? <CheckCircle className="text-green-500 h-4 w-4" /> : <Download className="text-muted-foreground h-4 w-4 hover:text-foreground" />}
                             </div>
                         </div>
                    ))}
                </div>
                
                {recentlyViewed.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
                             <Clock className="h-4 w-4" /> Recently Viewed
                        </h3>
                        <div className="space-y-2">
                             {recentlyViewed.map((chapter: string, idx: number) => (
                                 <div key={idx} className="bg-card/50 p-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-muted" onClick={() => { addRecentlyViewed(chapter); setSelectedChapter(chapter); }}>
                                     {chapter}
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
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
