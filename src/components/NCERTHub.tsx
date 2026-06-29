
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, BookOpen, Download, Eye, Search, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import Pressable from './Pressable';
import { getApiUrl } from '@/utils/api';

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

    useEffect(() => {
        refreshDownloads();
    }, []);

    const refreshDownloads = async () => {
        const ids = await getAllDownloadedIds();
        setDownloadedIds(new Set(ids));
    };

    const filteredBooks = NCERT_BOOKS.filter(book => 
        book.class === selectedClass && 
        book.subject === selectedSubject &&
        (book.title.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === '')
    );

    const getChapterUrl = (bookCode: string, chNum: number) => {
        const fixedChNum = chNum.toString().padStart(2, '0');
        return `https://ncert.nic.in/textbook/pdf/${bookCode}${fixedChNum}.pdf`;
    };

    const handleView = async (bookCode: string, chNum: number, title: string) => {
        const id = `${bookCode}_ch${chNum}`;
        const offlineBlob = await getPDF(id);
        if (offlineBlob) {
            const url = URL.createObjectURL(offlineBlob);
            setViewerUrl({ url, title });
        } else {
            const ncertUrl = getChapterUrl(bookCode, chNum);
            const proxyUrl = getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(ncertUrl)}`);
            setViewerUrl({ url: proxyUrl, title });
        }
    };

    const handleDownload = async (bookCode: string, chNum: number) => {
        const id = `${bookCode}_ch${chNum}`;
        if (downloadedIds.has(id)) return;
        
        setDownloadingId(id);
        try {
            const ncertUrl = getChapterUrl(bookCode, chNum);
            const proxyUrl = getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(ncertUrl)}`);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Download failed");
            const blob = await response.blob();
            await savePDF(id, blob);
            await refreshDownloads();
        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to download. Please check your internet.");
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#0a0f24] text-white pb-20 font-sans">
            <div className="max-w-2xl mx-auto">
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
                                        {isDownloaded ? (
                                            <>
                                                <button onClick={() => handleDelete(id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-center gap-1 text-[9px] text-green-400 bg-green-400/10 px-2 py-1 rounded-full font-bold">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> OFFLINE
                                                </div>
                                            </>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownload(selectedBook.code, chNum); }}
                                                className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-full transition-all"
                                                disabled={isDownloading}
                                            >
                                                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                            </button>
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
