import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight, AlertTriangle, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCachedPdf, cachePdf, isPdfCached, downloadPdfToDevice } from '../lib/pdfCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { openExternalLink } from '../utils/browser';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { keepAwake, allowSleep } from '../utils/keepAwake';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

try {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4.0;
const BASE_RENDER_SCALE = 1.5; // High-definition crisp rendering scale

function getTouchCenter(touches: TouchList) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}

function getTouchDistance(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export default function AdvancedPDFViewer({ pdfUrl, title, onClose, originalUrl, initialScale = 0.6 }: { pdfUrl: string, title: string, onClose: () => void, originalUrl?: string, initialScale?: number }) {
    const [activePdfUrl, setActivePdfUrl] = useState(pdfUrl);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [displayZoom, setDisplayZoom] = useState(initialScale);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Auto-hide status bar while viewing PDF on mobile
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        SafeArea.hideSystemBars({}).catch(() => {});
        return () => {
            SafeArea.showSystemBars({}).catch(() => {});
        };
    }, []);

    const pdfDocRef = useRef<any>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const pageWidthRef = useRef<number>(600);
    const pageHeightRef = useRef<number>(800);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);

    // Single source of truth for visual scale & position
    const transformRef = useRef({ zoom: initialScale, x: 0, y: 0 });

    const gestureState = useRef({
        active: false,
        touchCount: 0,
        startDistance: 0,
        startZoom: 1,
        startX: 0,
        startY: 0,
        startOrigX: 0,
        startOrigY: 0,
        lastSingleX: 0,
        lastSingleY: 0,
        tapStartX: 0,
        tapStartY: 0,
        tapStartTime: 0,
        moved: false,
    });

    const rafRef = useRef<number | null>(null);

    const applyTransformNow = useCallback(() => {
        if (wrapRef.current) {
            const { zoom, x, y } = transformRef.current;
            const cssScale = zoom / BASE_RENDER_SCALE;
            wrapRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${cssScale})`;
        }
    }, []);

    const applyTransform = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            applyTransformNow();
        });
    }, [applyTransformNow]);

    const resetTransform = useCallback((targetZoom = initialScale) => {
        const stage = stageRef.current;
        const stageWidth = stage?.clientWidth || (window.innerWidth - 16);
        const stageHeight = stage?.clientHeight || (window.innerHeight - 100);

        const scaledW = pageWidthRef.current * targetZoom;
        const scaledH = pageHeightRef.current * targetZoom;
        const initialX = Math.max(0, (stageWidth - scaledW) / 2);
        const initialY = Math.max(0, (stageHeight - scaledH) / 2);

        transformRef.current = { zoom: targetZoom, x: initialX, y: initialY };
        setDisplayZoom(targetZoom);
        applyTransformNow();
    }, [applyTransformNow, initialScale]);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        setNumPages(null);
        setCurrentPage(1);

        let isMounted = true;

        const loadContent = async () => {
            const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            
            // 1. Try local cache first for sub-second instant load
            const cachedBlobUrl = await getCachedPdf(filename);
            if (cachedBlobUrl && isMounted) {
                setActivePdfUrl(cachedBlobUrl);
                setIsDownloaded(true);
                return;
            }

            // 2. Load online/passed URL
            if (isMounted) {
                setActivePdfUrl(pdfUrl);
            }

            // 3. Auto cache in background so next load is instant
            if (pdfUrl) {
                cachePdf(pdfUrl, filename).then((cached) => {
                    if (cached && isMounted) setIsDownloaded(true);
                }).catch(() => {});
            }
        };
        loadContent();

        const loadProgress = async () => {
            if (auth.currentUser && pdfUrl) {
                const encodedUrl = btoa(encodeURIComponent(pdfUrl)).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
                const docRef = doc(db, 'user_reading_progress', `${auth.currentUser.uid}_${encodedUrl}`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && isMounted) {
                    setCurrentPage(docSnap.data().page);
                }
            }
        };
        loadProgress();

        return () => {
            isMounted = false;
            allowSleep();
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [pdfUrl, title]);

    useEffect(() => {
        keepAwake();
        return () => {
            allowSleep();
        };
    }, []);

    useEffect(() => {
        const saveProgress = async () => {
            if (auth.currentUser && numPages && pdfUrl) {
                const encodedUrl = btoa(encodeURIComponent(pdfUrl)).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
                const docRef = doc(db, 'user_reading_progress', `${auth.currentUser.uid}_${encodedUrl}`);
                await setDoc(docRef, { page: currentPage, lastUpdated: new Date() }, { merge: true });
            }
        };
        saveProgress();
    }, [currentPage, pdfUrl, numPages]);

    function onDocumentLoadSuccess(pdf: any) {
        setNumPages(pdf.numPages);
        pdfDocRef.current = pdf;
        setError(null);
        setIsLoading(false);

        pdf.getPage(1).then((page: any) => {
            const viewport = page.getViewport({ scale: 1.0 });
            pageWidthRef.current = viewport.width;
            pageHeightRef.current = viewport.height;

            const stage = stageRef.current;
            const stageRect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 100 };
            const stageWidth = stageRect.width || (window.innerWidth - 16);
            const stageHeight = (stageRect as DOMRect).height || (window.innerHeight - 100);

            // Fit-to-screen: consider BOTH width AND height
            const fitWidth = (stageWidth - 16) / viewport.width;
            const fitHeight = (stageHeight - 16) / viewport.height;
            const fitZoom = Math.min(Math.max(Math.min(fitWidth, fitHeight), MIN_SCALE), MAX_SCALE);
            resetTransform(fitZoom);
        }).catch(() => {});
    }

    function onDocumentLoadError(err: Error) {
        console.error("PDF load error:", err);
        setError(`Failed to load PDF: ${err?.message || String(err)} | URL: ${activePdfUrl}`);
        setIsLoading(false);
    }

    const handleDownload = async () => {
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        setIsDownloading(true);

        try {
            // 1. Cache locally for offline viewing inside app
            await cachePdf(activePdfUrl || pdfUrl, filename);
            setIsDownloaded(true);

            // 2. Download raw PDF file to device local storage
            const success = await downloadPdfToDevice(activePdfUrl || pdfUrl, title);
            setIsDownloading(false);
            if (success) {
                alert("✅ PDF successfully downloaded & saved to your local storage!");
            } else {
                openExternalLink(pdfUrl);
            }
        } catch (err) {
            console.error("Download failed:", err);
            setIsDownloading(false);
            openExternalLink(pdfUrl);
        }
    };

    // ---- Enhanced Search with Text Highlighting ----

    const highlightSearchText = useCallback((query: string) => {
        if (!pageContainerRef.current || !query) return;

        // Clear previous highlights
        const prevHighlights = pageContainerRef.current.querySelectorAll('.pdf-search-highlight, .pdf-search-highlight-active');
        prevHighlights.forEach(el => {
            el.classList.remove('pdf-search-highlight', 'pdf-search-highlight-active');
        });

        // Find text spans in the text layer
        const textLayer = pageContainerRef.current.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) return;

        const spans = textLayer.querySelectorAll('span');
        const lowerQuery = query.toLowerCase();

        spans.forEach(span => {
            const text = span.textContent?.toLowerCase() || '';
            if (text.includes(lowerQuery)) {
                span.classList.add('pdf-search-highlight');
            }
        });
    }, []);

    const clearHighlights = useCallback(() => {
        if (!pageContainerRef.current) return;
        const highlights = pageContainerRef.current.querySelectorAll('.pdf-search-highlight, .pdf-search-highlight-active');
        highlights.forEach(el => {
            el.classList.remove('pdf-search-highlight', 'pdf-search-highlight-active');
        });
    }, []);

    const performSearch = async (query: string) => {
        if (!pdfDocRef.current || !query) return;
        setIsSearching(true);
        const results: number[] = [];
        for (let i = 1; i <= pdfDocRef.current.numPages; i++) {
            const page = await pdfDocRef.current.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');
            if (text.toLowerCase().includes(query.toLowerCase())) {
                results.push(i);
            }
        }
        setSearchResults(results);
        setCurrentSearchIndex(0);
        setIsSearching(false);

        // Navigate to first result and highlight
        if (results.length > 0) {
            setCurrentPage(results[0]);
            // Highlight after a small delay to let page render
            setTimeout(() => highlightSearchText(query), 500);
        }
    };

    // Re-highlight when page changes and we have active search
    useEffect(() => {
        if (searchQuery && searchResults.length > 0) {
            // Wait for page to render then highlight
            const timer = setTimeout(() => highlightSearchText(searchQuery), 600);
            return () => clearTimeout(timer);
        } else {
            clearHighlights();
        }
    }, [currentPage, searchQuery, searchResults, highlightSearchText, clearHighlights]);

    const navigateSearchResult = useCallback((direction: 'next' | 'prev') => {
        if (searchResults.length === 0) return;
        let newIndex: number;
        if (direction === 'next') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }
        setCurrentSearchIndex(newIndex);
        setCurrentPage(searchResults[newIndex]);
    }, [searchResults, currentSearchIndex]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            performSearch(searchQuery.trim());
        }
    };

    const toggleSearch = useCallback(() => {
        setShowSearch(prev => {
            if (prev) {
                // Closing search — clear everything
                setSearchQuery('');
                setSearchResults([]);
                setCurrentSearchIndex(0);
                clearHighlights();
            } else {
                // Opening search — focus input
                setTimeout(() => searchInputRef.current?.focus(), 100);
            }
            return !prev;
        });
    }, [clearHighlights]);

    // ---- Native touch handlers ----

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        const state = gestureState.current;

        if (wrapRef.current) {
            wrapRef.current.style.transition = 'none';
        }

        const stage = stageRef.current;
        const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };

        if (touches.length >= 2) {
            const centerClient = getTouchCenter(touches as any);
            const centerStage = {
                x: centerClient.x - stageRect.left,
                y: centerClient.y - stageRect.top,
            };

            state.active = true;
            state.touchCount = 2;
            state.startDistance = getTouchDistance(touches as any);
            state.startZoom = transformRef.current.zoom;
            state.startX = transformRef.current.x;
            state.startY = transformRef.current.y;
            state.startOrigX = (centerStage.x - state.startX) / state.startZoom;
            state.startOrigY = (centerStage.y - state.startY) / state.startZoom;
            state.moved = true;
        } else if (touches.length === 1) {
            state.active = true;
            state.touchCount = 1;
            state.lastSingleX = touches[0].clientX;
            state.lastSingleY = touches[0].clientY;
            state.tapStartX = touches[0].clientX;
            state.tapStartY = touches[0].clientY;
            state.tapStartTime = Date.now();
            state.moved = false;
        }
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        const state = gestureState.current;
        if (!state.active) return;

        const stage = stageRef.current;
        const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };

        if (touches.length >= 2 && state.touchCount === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(touches as any);
            const centerClient = getTouchCenter(touches as any);
            const centerStage = {
                x: centerClient.x - stageRect.left,
                y: centerClient.y - stageRect.top,
            };

            const rawZoom = state.startZoom * (currentDistance / state.startDistance);
            const clampedZoom = Math.min(Math.max(rawZoom, MIN_SCALE), MAX_SCALE);

            transformRef.current = {
                zoom: clampedZoom,
                x: centerStage.x - state.startOrigX * clampedZoom,
                y: centerStage.y - state.startOrigY * clampedZoom,
            };
            applyTransform();
        } else if (touches.length === 1 && state.touchCount === 1) {
            e.preventDefault();
            const dx = touches[0].clientX - state.lastSingleX;
            const dy = touches[0].clientY - state.lastSingleY;
            state.lastSingleX = touches[0].clientX;
            state.lastSingleY = touches[0].clientY;

            const totalDx = touches[0].clientX - state.tapStartX;
            const totalDy = touches[0].clientY - state.tapStartY;
            if (Math.hypot(totalDx, totalDy) > 10) {
                state.moved = true;
            }

            transformRef.current = {
                ...transformRef.current,
                x: transformRef.current.x + dx,
                y: transformRef.current.y + dy,
            };
            applyTransform();
        }
    }, [applyTransform]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const state = gestureState.current;
        const remaining = e.touches.length;

        if (state.touchCount === 1 && remaining === 0 && !state.moved) {
            const elapsed = Date.now() - state.tapStartTime;
            if (elapsed < 300) {
                setShowControls(prev => !prev);
            }
        }

        if (state.touchCount === 2 && remaining < 2) {
            // Finger released! Touch zoom stays EXACTLY at the pinched zoom ratio — ZERO RE-RENDER!
            setDisplayZoom(transformRef.current.zoom);
            if (remaining === 1) {
                state.touchCount = 1;
                state.lastSingleX = e.touches[0].clientX;
                state.lastSingleY = e.touches[0].clientY;
            } else {
                state.active = false;
                state.touchCount = 0;
            }
        } else if (state.touchCount === 1 && remaining === 0) {
            state.active = false;
            state.touchCount = 0;
        }
    }, []);

    const zoomButton = useCallback((direction: 1 | -1) => {
        const step = 0.25 * direction;
        const currentZoom = transformRef.current.zoom;
        const targetZoom = Math.min(Math.max(currentZoom + step, MIN_SCALE), MAX_SCALE);

        const stage = stageRef.current;
        const stageRect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
        const stageX = stageRect.width / 2;
        const stageY = stageRect.height / 2;

        const anchorX = (stageX - transformRef.current.x) / currentZoom;
        const anchorY = (stageY - transformRef.current.y) / currentZoom;

        const newX = stageX - anchorX * targetZoom;
        const newY = stageY - anchorY * targetZoom;

        if (wrapRef.current) {
            wrapRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
        }

        transformRef.current = { zoom: targetZoom, x: newX, y: newY };
        setDisplayZoom(targetZoom);
        applyTransformNow();
    }, [applyTransformNow]);

    const goToPage = useCallback((updater: (p: number) => number) => {
        setCurrentPage(updater);
    }, []);

    const pdfOptions = useMemo(() => ({
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    }), []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#05070A] z-[999] flex flex-col font-sans pt-[env(safe-area-inset-top,12px)]"
        >
            {/* Superior Toolbar */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -60, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between px-3 py-1.5 bg-[#0F172A] border-b border-white/5 shadow-2xl relative z-50"
                    >
                        <div className="flex items-center gap-3 overflow-hidden flex-grow mr-2">
                            <button
                                onClick={onClose}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition active:scale-90"
                            >
                                <ChevronLeft className="h-6 w-6 text-gray-300" />
                            </button>
                            <div className="flex flex-col min-w-0">
                                <h2 className="text-sm font-bold text-white truncate leading-tight">{title}</h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading || isDownloaded}
                                className={`p-2.5 rounded-xl transition ${
                                    isDownloaded 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : isDownloading
                                            ? 'bg-white/5 text-gray-500'
                                            : 'bg-white/5 hover:bg-white/10 text-gray-300'
                                }`}
                                title={isDownloaded ? "Already saved offline" : Capacitor.isNativePlatform() ? "Save for offline" : "Download PDF"}
                            >
                                {isDownloading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Download className="h-5 w-5" />
                                )}
                            </button>

                            <button
                                onClick={toggleSearch}
                                className={`p-2.5 rounded-xl transition ${
                                    showSearch 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                                }`}
                                title="Search in PDF"
                            >
                                <Search className="h-5 w-5" />
                            </button>

                            <button
                                onClick={onClose}
                                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Bar — shown from bottom search button */}
            <AnimatePresence>
                {showSearch && showControls && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="p-3 bg-[#0F172A] border-b border-white/5 z-50"
                    >
                        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                            <div className="flex-grow relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="PDF mein search karo..."
                                    className="w-full bg-white/5 text-white pl-10 pr-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 placeholder-gray-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSearching || !searchQuery.trim()}
                                className="p-2.5 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-red-400 transition disabled:opacity-40"
                            >
                                {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={toggleSearch}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </form>

                        {/* Search results navigation */}
                        {searchResults.length > 0 && (
                            <div className="flex items-center justify-between mt-2 px-1">
                                <span className="text-xs text-gray-400">
                                    {searchResults.length} page{searchResults.length > 1 ? 's' : ''} mein mila — Page {searchResults[currentSearchIndex]}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => navigateSearchResult('prev')}
                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-[10px] text-gray-500 w-10 text-center">{currentSearchIndex + 1}/{searchResults.length}</span>
                                    <button
                                        onClick={() => navigateSearchResult('next')}
                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {searchResults.length === 0 && searchQuery && !isSearching && (
                            <p className="text-xs text-gray-500 mt-2 px-1">Kuch nahi mila 😕 — koi aur word try karo</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Viewer Stage */}
            <div
                ref={stageRef}
                className="flex-grow relative overflow-hidden bg-slate-950 w-full h-full touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
                {isLoading && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                        <h3 className="text-white font-bold text-lg">Initializing High-Definition Preview</h3>
                        <p className="text-xs text-gray-400 mt-2 max-w-xs">Connecting to secure document server. This may take a few seconds...</p>
                    </motion.div>
                )}

                {error ? (
                    <div className="max-w-sm text-center p-12 bg-gray-900/50 rounded-[40px] border border-white/5 backdrop-blur-xl mx-auto mt-12">
                        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                            <AlertTriangle className="text-red-400 w-12 h-12" />
                        </div>
                        <h3 className="text-white font-bold text-xl mb-4">View Blocked</h3>
                        <p className="text-[10px] text-yellow-300 mb-6 leading-relaxed break-all bg-black/30 p-3 rounded-xl">{error}</p>
                        <div className="grid gap-3">
                            <button
                                onClick={() => openExternalLink(pdfUrl)}
                                className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-sm font-bold text-gray-300 transition active:scale-95"
                            >
                                Open in External Browser
                            </button>
                        </div>
                    </div>
                ) : (
                    <Document
                        file={activePdfUrl}
                        options={pdfOptions}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        onLoadProgress={(p) => setProgress(Math.round((p.loaded / p.total) * 100))}
                        className="relative w-full h-full"
                    >
                        <div
                            ref={wrapRef}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                willChange: 'transform',
                                transformOrigin: '0 0',
                                background: '#0F172A',
                                borderRadius: 6
                            }}
                        >
                            <div ref={pageContainerRef}>
                                <Page
                                    pageNumber={currentPage}
                                    scale={BASE_RENDER_SCALE}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={false}
                                    className="shadow-2xl bg-white rounded-md overflow-hidden ring-1 ring-white/10"
                                    loading={null}
                                />
                            </div>
                        </div>
                    </Document>
                )}
            </div>

            {/* Smart Control Bar — Zoom & Page Navigation only */}
            <AnimatePresence>
                {!error && numPages && !isLoading && showControls && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="px-4 py-2 bg-[#0F172A] border-t border-white/5 safe-bottom z-50 flex items-center justify-center gap-4"
                    >
                        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
                            <button
                                onClick={() => zoomButton(-1)}
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400"
                            >
                                <ZoomOut className="h-6 w-6" />
                            </button>
                            <span className="text-[10px] font-mono text-gray-500 w-12 text-center">{Math.round(displayZoom * 100)}%</span>
                            <button
                                onClick={() => zoomButton(1)}
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400"
                            >
                                <ZoomIn className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-1 px-2">
                            <button
                                disabled={currentPage <= 1}
                                onClick={() => goToPage(p => Math.max(p - 1, 1))}
                                className="p-3 text-blue-500 hover:bg-white/10 rounded-xl disabled:opacity-20 transition"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <div className="text-center px-2">
                                <p className="text-xs font-bold text-white leading-none">{currentPage} / {numPages}</p>
                                <p className="text-[9px] text-gray-500 font-medium uppercase tracking-widest mt-1">Page</p>
                            </div>
                            <button
                                disabled={currentPage >= (numPages || 1)}
                                onClick={() => goToPage(p => Math.min(p + 1, numPages || 1))}
                                className="p-3 text-blue-500 hover:bg-white/10 rounded-xl disabled:opacity-20 transition"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
