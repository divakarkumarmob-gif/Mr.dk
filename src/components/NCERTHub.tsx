
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Eye, Search, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import Pressable from './Pressable';
import { getApiUrl, getPdfViewerUrl } from '@/utils/api';
import { savePdfToPublicDownloads } from '../utils/publicDownload';
import { fetchAndCachePdf } from '../lib/pdfCache';

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
        } else {
            console.log("Fetching online PDF for:", id);
            // Refresh S3 list to ensure we have fresh URLs
            setIsLoadingS3(true);
            const bucket = selectedClass === '12' ? 'class-12th' : 'class-11th';
            const listUrl = getApiUrl(`/api/ncert-list?bucket=${bucket}&prefix=${selectedSubject.toLowerCase()}`);
            setNcertDebug(`fetching list url=${listUrl}`);
            try {
                const subjectFolder = selectedSubject.toLowerCase();
                const res = await fetch(getApiUrl(`/api/ncert-list?bucket=${bucket}&prefix=${subjectFolder}`));
                setNcertDebug(`list status=${res.status}`);
                const data = await res.json();
                console.log("NCERT list fetch result:", data);
                if (data.success && Array.isArray(data.files)) {
                    setS3Files(data.files);

                    // Background pre-fetch chapter PDFs into RAM cache for 0ms instant first-time open
                    data.files.slice(0, 10).forEach((file: any) => {
                        if (file.url && file.name) {
                            const cleanName = `${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
                            fetchAndCachePdf(file.url, cleanName).catch(() => {});
                        }
                    });
                    
                    const s3Match = findS3Match(data.files, chNum, title);
                    if (s3Match) {
                        console.log("Using S3 match:", s3Match);
                        // Always route through our backend proxy, even on web.
                        // Direct S3 URLs can send CORS headers that block the
                        // browser from embedding/fetching them directly
                        // (react-pdf sees this as a load error / "blocked" view).
                        const proxyUrl = await getPdfViewerUrl(s3Match.url);
                        setNcertDebug(`OK: matched "${s3Match.name}" -> proxy=${proxyUrl}`);
                        setViewerUrl({ url: proxyUrl, title });
                    } else {
                        console.error("No matching file found on S3 for:", title);
                        setNcertDebug(`NO MATCH: chNum=${chNum} title="${title}" among ${data.files.length} S3 files: [${data.files.map((f:any)=>f.name).join(', ')}]`);
                        alert("This chapter's PDF is not available on S3 yet.");
                    }
                } else {
                    setNcertDebug(`list success=false: ${JSON.stringify(data)}`);
                }
            } catch (e: any) {
                console.error("Failed to fetch S3 files", e);
                setNcertDebug(`ERROR: ${e?.message || String(e)}`);
                alert("Failed to load PDF. Please check your connection and try again.");
            } finally {
                setIsLoadingS3(false);
            }
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
        window.history.pushState({ ...window.history.state, isPdfOpen: true }, '', window.location.href);
    };

    const handleChapterBack = () => {
        window.history.back();
    };

    const handlePdfClose = () => {
        window.history.back();
    };

    return (
        <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-1 min-h-0 w-full bg-[#0a0f24] text-white font-sans overflow-y-auto">
            <div className="pt-[env(safe-area-inset-top,0px)] pl-[max(env(safe-area-inset-left),16px)] pb-40 max-w-full mx-auto px-3">
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
                            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl">
                                {(['11', '12'] as const).map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setSelectedClass(c)}
                                        className={`py-2 rounded-lg font-bold text-sm transition-all ${selectedClass === c ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                    >
                                        Class {c}th
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {(['Physics', 'Chemistry', 'Biology'] as const).map(s => (
                                    <button 
                                        key={s}
                                        onClick={() => setSelectedSubject(s)}
                                        className={`py-2 rounded-lg font-bold text-[10px] sm:text-xs transition-all border ${selectedSubject === s ? 'bg-green-600 border-green-500 text-white' : 'bg-transparent border-white/10 text-gray-400'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="Search book title..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Book Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {filteredBooks.map(book => (
                                <motion.div 
                                    key={book.id}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleSelectBook(book)}
                                    className="bg-[#161e38] border border-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-blue-500/50 transition-all"
                                >
                                    <div className={`w-12 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl ${
                                        book.subject === 'Physics' ? 'bg-blue-600' : book.subject === 'Chemistry' ? 'bg-orange-600' : 'bg-green-600'
                                    }`}>
                                        {book.subject[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm truncate">{book.title}</h3>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">{book.chapterNames.length} Chapters</p>
                                    </div>
                                    <BookOpen className="w-5 h-5 text-white/20" />
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
                                <div key={chNum} className="bg-[#161e38] border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-extrabold text-[10px]">
                                            {chNum}
                                        </div>
                                        <span className="font-bold text-[11px] sm:text-xs truncate leading-tight text-gray-200">
                                            {chNum}. {chName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {isDownloaded && (
                                            <>
                                                <button onClick={() => handleDelete(id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-center gap-1 text-[9px] text-green-400 bg-green-400/10 px-2 py-1 rounded-full font-bold">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> OFFLINE
                                                </div>
                                            </>
                                        )}
                                        <Pressable 
                                            onClick={() => handleOpenPdf(selectedBook.code, chNum, `${chNum}. ${chName}`)}
                                            className="bg-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
                                        >
                                            <Eye className="w-3 h-3" /> VIEW
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
