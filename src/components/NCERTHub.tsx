
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Eye, Search, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import Pressable from './Pressable';
import { getApiUrl, getPdfViewerUrl } from '@/utils/api';
import { savePdfToPublicDownloads } from '../utils/publicDownload';
import { fetchAndCachePdf, fetchAndCacheByStableKey, getRamCachedPdf, getCachedPdf } from '../lib/pdfCache';
import { scheduleNcertRereadNotification } from '../utils/studyNotificationEngine';
import { getAwsPdfUrl } from '../services/awsConfig';

// Simple IndexedDB wrapper for PDF storage
const dbName = 'NCERT_OFFLINE_DB';
const storeName = 'books';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const savePDF = async (id: string, blob: Blob) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(blob, id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

const getPDF = async (id: string): Promise<Blob | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

const deletePDF = async (id: string) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

const getAllDownloadedIds = async (): Promise<string[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
    });
};

interface Book {
    id: string;
    class: '11' | '12';
    subject: 'Physics' | 'Chemistry' | 'Biology';
    title: string;
    code: string;
    chapterNames: string[];
}

const NCERT_BOOKS: Book[] = [
    // PHYSICS CLASS 11
    { 
        id: '11p1', class: '11', subject: 'Physics', title: 'Physics Part I', code: 'keph1', 
        chapterNames: ['Units and Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy and Power', 'System of Particles and Rotational Motion', 'Gravitation'] 
    },
    { 
        id: '11p2', class: '11', subject: 'Physics', title: 'Physics Part II', code: 'keph2', 
        chapterNames: ['Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'] 
    },
    // PHYSICS CLASS 12
    { 
        id: '12p1', class: '12', subject: 'Physics', title: 'Physics Part I', code: 'leph1', 
        chapterNames: ['Electric Charges and Fields', 'Electrostatic Potential and Capacitance', 'Current Electricity', 'Moving Charges and Magnetism', 'Magnetism and Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves'] 
    },
    { 
        id: '12p2', class: '12', subject: 'Physics', title: 'Physics Part II', code: 'leph2', 
        chapterNames: ['Ray Optics and Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics'] 
    },
    // CHEMISTRY CLASS 11
    { 
        id: '11c1', class: '11', subject: 'Chemistry', title: 'Chemistry Part I', code: 'kech1', 
        chapterNames: ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity in Properties', 'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium'] 
    },
    { 
        id: '11c2', class: '11', subject: 'Chemistry', title: 'Chemistry Part II', code: 'kech2', 
        chapterNames: ['Redox Reactions', 'Organic Chemistry – Some Basic Principles and Techniques', 'Hydrocarbons'] 
    },
    // CHEMISTRY CLASS 12
    { 
        id: '12c1', class: '12', subject: 'Chemistry', title: 'Chemistry Part I', code: 'lech1', 
        chapterNames: ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'The d-and f-Block Elements', 'Coordination Compounds'] 
    },
    { 
        id: '12c2', class: '12', subject: 'Chemistry', title: 'Chemistry Part II', code: 'lech2', 
        chapterNames: ['Haloalkanes and Haloarenes', 'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines', 'Biomolecules'] 
    },
    // BIOLOGY
    { 
        id: '11b1', class: '11', subject: 'Biology', title: 'Biology', code: 'kebo1', 
        chapterNames: ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development', 'Breathing and Exchange of Gases', 'Body Fluids and Circulation', 'Excretory Products and their Elimination', 'Locomotion and Movement', 'Neural Control and Coordination', 'Chemical Coordination and Integration'] 
    },
    { 
        id: '12b1', class: '12', subject: 'Biology', title: 'Biology', code: 'lebo1', 
        chapterNames: ['Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health and Disease', 'Microbes in Human Welfare', 'Biotechnology: Principles and Processes', 'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation'] 
    },
];

export default function NCERTHub({ onBack }: { onBack: () => void }) {
    const [selectedClass, setSelectedClass] = useState<'11' | '12'>('11');
    const [selectedSubject, setSelectedSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [viewerUrl, setViewerUrl] = useState<{url: string, title: string} | null>(null);
    const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [s3Files, setS3Files] = useState<{key: string, url: string, name: string}[]>([]);
    const [isLoadingS3, setIsLoadingS3] = useState(false);
    const [ncertDebug, setNcertDebug] = useState<string>('');

    useEffect(() => {
        refreshDownloads();
    }, []);

    useEffect(() => {
        const fetchFiles = async () => {
            setIsLoadingS3(true);
            try {
                const subjectFolder = selectedSubject.toLowerCase();
                const bucket = selectedClass === '12' ? 'class-12th' : 'class-11th';
                const res = await fetch(getApiUrl(`/api/ncert-list?bucket=${bucket}&prefix=${subjectFolder}`));
                const data = await res.json();
                if (data.success) {
                    console.log("S3 files fetched:", data.files);
                    setS3Files(data.files);
                }
            } catch (e) {
                console.error("Failed to fetch S3 files", e);
            } finally {
                setIsLoadingS3(false);
            }
        };
        fetchFiles();
    }, [selectedSubject, selectedClass]);

    const refreshDownloads = async () => {
        const ids = await getAllDownloadedIds();
        setDownloadedIds(new Set(ids));
    };

    const filteredBooks = NCERT_BOOKS.filter(book => 
        book.class === selectedClass && 
        book.subject === selectedSubject &&
        (book.title.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === '')
    );

    // Robust S3 filename matcher: chapter titles rarely match S3 filenames
    // character-for-character (e.g. "measurements" vs "MEASUREMENT.pdf"),
    // so first try matching by the leading chapter number S3 files are
    // named with ("1-...", "2-...", etc.), then fall back to comparing
    // individual significant words so small wording/plural differences
    // don't cause a false "not found".
    const findS3Match = (files: {key: string, url: string, name: string}[], chNum: number, title: string) => {
        const chapterPrefix = `${chNum}-`;
        const byNumber = files.find(f => f.name?.toLowerCase().startsWith(chapterPrefix.toLowerCase()));
        if (byNumber) return byNumber;

        const titleWords = title.split('.').slice(1).join('.').trim().toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3); // skip short filler words

        if (titleWords.length === 0) return undefined;

        return files.find(f => {
            const fname = f.name?.toLowerCase().replace(/[^a-z0-9\s]/g, ' ') || '';
            return titleWords.every(w => fname.includes(w) || fname.includes(w.replace(/s$/, '')));
        });
    };

    const handleView = async (bookCode: string, chNum: number, title: string) => {
        const id = `${bookCode}_ch${chNum}`;
        const offlineBlob = await getPDF(id);
        if (offlineBlob) {
            console.log("Loading offline PDF for:", id);
            const url = URL.createObjectURL(offlineBlob);
            setViewerUrl({ url, title });
            return;
        }

        // This chapter was viewed before (even without an explicit
        // "Download") — fetchAndCachePdf already stored it in RAM/disk in
        // pdfCache.ts. Re-using that here skips BOTH the S3 list fetch and
        // the proxy-token round trip entirely on repeat opens, which is
        // where the real "still slow on 2nd open" delay was coming from.
        const cacheKey = `${bookCode}_ch${chNum}`;
        const ramUrl = getRamCachedPdf(cacheKey);
        if (ramUrl) {
            console.log("Loading RAM-cached PDF for:", id);
            setViewerUrl({ url: ramUrl, title });
            return;
        }
        try {
            const diskUrl = await getCachedPdf(cacheKey);
            if (diskUrl) {
                console.log("Loading disk-cached PDF for:", id);
                setViewerUrl({ url: diskUrl, title });
                return;
            }
        } catch {
            // fall through to network fetch below
        }

        console.log("Fetching online PDF for:", id);
        setIsLoadingS3(true);
        try {
            const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const awsSubFolder = `class-${selectedClass}/${selectedSubject.toLowerCase()}`;
            const s3DirectUrl = getAwsPdfUrl(awsSubFolder, `${cleanSlug}.pdf`);

            console.log("Using S3 Direct URL from ncert-books-dk:", s3DirectUrl);
            setNcertDebug(`OK: S3 direct url=${s3DirectUrl}`);
            setViewerUrl({ url: s3DirectUrl, title });

            fetchAndCacheByStableKey(s3DirectUrl, cacheKey).catch(() => {});
        } catch (e: any) {
            console.error("Failed to fetch S3 files", e);
            setNcertDebug(`ERROR: ${e?.message || String(e)}`);
            alert("Failed to load PDF. Please check your connection and try again.");
        } finally {
            setIsLoadingS3(false);
        }
    };

    const handleDownload = async (bookCode: string, chNum: number, title: string) => {
        const id = `${bookCode}_ch${chNum}`;
        if (downloadedIds.has(id)) return;
        
        setDownloadingId(id);
        try {
            const s3Match = findS3Match(s3Files, chNum, title);
            
            if (!s3Match) {
                alert("This chapter's PDF is not available on server yet.");
                setDownloadingId(null);
                return;
            }
            
            let blob: Blob | null = null;
            try {
                const response = await fetch(s3Match.url);
                if (response.ok) {
                    blob = await response.blob();
                }
            } catch (err) {
                console.warn("Direct fetch CORS check:", err);
            }

            if (blob) {
                await savePDF(id, blob);
            }

            const filename = `${title.replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
            const saved = await savePdfToPublicDownloads(s3Match.url, filename);
            if (!blob && !saved) {
                const link = document.createElement('a');
                link.href = s3Match.url;
                link.download = filename;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            await refreshDownloads();
        } catch (error) {
            console.error("Download error:", error);
            const s3Match = findS3Match(s3Files, chNum, title);
            if (s3Match?.url) {
                window.open(s3Match.url, '_blank');
            }
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        await deletePDF(id);
        await refreshDownloads();
    };

    const handlePop = () => {
        // Handle popstate for sub-views
        const state = window.history.state;
        if (viewerUrl && !state?.isPdfOpen) {
            if (viewerUrl.url.startsWith('blob:')) {
                URL.revokeObjectURL(viewerUrl.url);
            }
            setViewerUrl(null);
            return;
        }
        if (selectedBook && !state?.isBookOpen) {
            setSelectedBook(null);
            return;
        }
    };

    useEffect(() => {
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [selectedBook, viewerUrl]);

    const handleSelectBook = (book: Book) => {
        setSelectedBook(book);
        window.history.pushState({ ...window.history.state, isBookOpen: true }, '', window.location.href);
    };

    const handleOpenPdf = (bookCode: string, chNum: number, title: string) => {
        handleView(bookCode, chNum, title);
        scheduleNcertRereadNotification(title).catch(console.warn);
        window.history.pushState({ ...window.history.state, isPdfOpen: true }, '', window.location.href);
    };

    const handleChapterBack = () => {
        setSelectedBook(null);
    };

    const handlePdfClose = () => {
        if (viewerUrl?.url && viewerUrl.url.startsWith('blob:')) {
            URL.revokeObjectURL(viewerUrl.url);
        }
        setViewerUrl(null);
    };

    return (
        <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-1 min-h-0 w-full bg-[#0a0f24] text-white font-sans overflow-y-auto">
            <div className="pt-[env(safe-area-inset-top,0px)] pb-40 max-w-5xl mx-auto px-4 sm:px-6 w-full">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Pressable onClick={selectedBook ? handleChapterBack : onBack} className="p-2 bg-white/5 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Pressable>
                    <div>
                        <h1 className="text-xl font-bold">{selectedBook ? selectedBook.title : 'NCERT Library'}</h1>
                        <p className="text-xs text-gray-400">{selectedBook ? `${selectedBook.subject} • Class ${selectedBook.class}` : 'Physics, Chemistry, Biology'}</p>
                    </div>
                </div>

                {/* Temporary visible debug banner - shows NCERT fetch/proxy status directly on screen */}
                {ncertDebug ? (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-[10px] text-yellow-300 break-all">
                        DEBUG: {ncertDebug}
                    </div>
                ) : null}

                {!selectedBook ? (
                    <>
                        {/* Selector Controls */}
                        <div className="space-y-4 mb-8">
                            <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-purple-500/25 backdrop-blur-xl shadow-lg">
                                {(['11', '12'] as const).map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setSelectedClass(c)}
                                        className={`py-2.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer ${
                                            selectedClass === c 
                                                ? 'gradient-btn-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        Class {c}th NCERT
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {(['Physics', 'Chemistry', 'Biology'] as const).map(s => {
                                    const isActive = selectedSubject === s;
                                    let activeGlow = 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-cyan-400/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]';
                                    if (s === 'Chemistry') activeGlow = 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-pink-400/50 shadow-[0_0_15px_rgba(236,72,153,0.4)]';
                                    if (s === 'Biology') activeGlow = 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.4)]';

                                    return (
                                        <button 
                                            key={s}
                                            onClick={() => setSelectedSubject(s)}
                                            className={`py-2.5 rounded-xl font-extrabold text-xs transition-all border cursor-pointer ${
                                                isActive ? activeGlow : 'bg-slate-900/60 border-purple-500/20 text-slate-400 hover:text-slate-200 hover:border-purple-500/40 backdrop-blur-md'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
                                <input 
                                    type="text" 
                                    placeholder="Search NCERT book title or chapter..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900/80 border border-purple-500/30 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 backdrop-blur-xl transition-all shadow-md"
                                />
                            </div>
                        </div>

                        {/* Book Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredBooks.map(book => (
                                <motion.div 
                                    key={book.id}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSelectBook(book)}
                                    className="glass-card glass-card-hover p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border border-purple-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                                >
                                    <div className={`w-12 h-16 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg ${
                                        book.subject === 'Physics' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/30' : book.subject === 'Chemistry' ? 'bg-gradient-to-br from-purple-600 to-pink-600 shadow-purple-500/30' : 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/30'
                                    }`}>
                                        {book.subject[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-extrabold text-sm text-white truncate group-hover:text-purple-200">{book.title}</h3>
                                        <p className="text-[10px] text-purple-300 font-bold uppercase tracking-widest mt-0.5">{book.chapterNames.length} Chapters</p>
                                    </div>
                                    <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300">
                                        <BookOpen className="w-5 h-5 text-purple-300" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </>

                ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        {selectedBook.chapterNames.map((chName, idx) => {
                            const chNum = idx + 1;
                            const id = `${selectedBook.code}_ch${chNum}`;
                            const isDownloaded = downloadedIds.has(id);
                            const isDownloading = downloadingId === id;

                            return (
                                <div key={chNum} className="glass-card p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 border border-purple-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 font-extrabold text-[11px]">
                                            {chNum}
                                        </div>
                                        <span className="font-extrabold text-xs sm:text-sm truncate leading-tight text-white">
                                            {chNum}. {chName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {isDownloaded && (
                                            <>
                                                <button onClick={() => handleDelete(id)} className="p-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <div className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                                                    <CheckCircle2 className="w-3 h-3" /> OFFLINE
                                                </div>
                                            </>
                                        )}
                                        <Pressable 
                                            onClick={() => handleOpenPdf(selectedBook.code, chNum, `${chNum}. ${chName}`)}
                                            className="gradient-btn-primary px-3.5 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-purple-500/20 cursor-pointer"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> VIEW
                                        </Pressable>
                                    </div>
                                </div>
                            );

                        })}
                    </motion.div>
                )}
            </div>

        </motion.div>
        {viewerUrl && (
            <AdvancedPDFViewer 
                pdfUrl={viewerUrl.url}
                title={viewerUrl.title}
                onClose={handlePdfClose}
            />
        )}
        </>
    );
}
