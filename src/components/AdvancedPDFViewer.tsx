import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight, AlertTriangle, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCachedPdf, cachePdf, isPdfCached, downloadPdfToDevice, getRamCachedPdf, fetchAndCachePdf } from '../lib/pdfCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { openExternalLink } from '../utils/browser';
import { getPdfViewerUrl } from '../utils/api';
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
const BASE_RENDER_SCALE = 1.8; // Ultra-crisp high-definition vector rendering scale

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

export default function AdvancedPDFViewer({ pdfUrl, title, onClose, originalUrl, initialScale = 1.0 }: { pdfUrl: string, title: string, onClose: () => void, originalUrl?: string, initialScale?: number }) {
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
            const scaleRatio = displayZoom > 0 ? zoom / displayZoom : 1;
            wrapRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scaleRatio})`;
        }
    }, [displayZoom]);

    const applyTransform = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            applyTransformNow();
        });
    }, [applyTransformNow]);

    const resetTransform = useCallback((targetZoom = initialScale) => {
        if (!Capacitor.isNativePlatform()) {
            setDisplayZoom(targetZoom);
            return;
        }
        const stage = stageRef.current;
        const stageWidth = stage?.clientWidth || window.innerWidth;

        const scaledW = pageWidthRef.current * targetZoom;
        const initialX = scaledW >= stageWidth ? 0 : Math.max(0, (stageWidth - scaledW) / 2);
        const initialY = 0; // Top of page for natural reading

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
            
            // Step 1: Ultra-fast 0ms RAM Memory Cache Check
            const ramUrl = getRamCachedPdf(filename);
            if (ramUrl && isMounted) {
                setActivePdfUrl(ramUrl);
                setIsDownloaded(true);
                return;
            }

            // Step 2: Millisecond Persistent Storage (IndexedDB / Disk) Check (<5ms)
            try {
                const cachedBlobUrl = await getCachedPdf(filename);
                if (cachedBlobUrl && isMounted) {
                    setActivePdfUrl(cachedBlobUrl);
                    setIsDownloaded(true);
                    return;
                }
            } catch (err) {
                console.warn('[AdvancedPDFViewer] Local disk cache check notice:', err);
            }

            // Step 3: Local Cache Miss -> Server Stream Fallback (<200ms Range Stream)
            if (pdfUrl && isMounted) {
                setActivePdfUrl(pdfUrl);
                // Save to local IndexedDB & RAM cache in background for future 0ms loads
                fetchAndCachePdf(pdfUrl, filename).then(() => {
                    if (isMounted) setIsDownloaded(true);
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

    const lastTapTimeRef = useRef<number>(0);

    const toggleControlsOnTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e && e.target) {
            const target = e.target as HTMLElement;
            if (target.closest('button, input, form, a')) return;
        }
        const now = Date.now();
        if (now - lastTapTimeRef.current < 350) return;
        lastTapTimeRef.current = now;
        setShowControls(prev => !prev);
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const handleScroll = () => {
            if (numPages) {
                const pageElements = stage.querySelectorAll('.pdf-page-item');
                const stageRect = stage.getBoundingClientRect();
                const stageCenter = stageRect.top + stageRect.height / 3;

                let closestPage = 1;
                let minDistance = Infinity;

                pageElements.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    const distance = Math.abs(rect.top - stageCenter);
                    if (distance < minDistance) {
                        minDistance = distance;
                        const p = el.getAttribute('data-page');
                        if (p) closestPage = parseInt(p, 10);
                    }
                });

                setCurrentPage(closestPage);
            }
        };

        stage.addEventListener('scroll', handleScroll, { passive: true });
        return () => stage.removeEventListener('scroll', handleScroll);
    }, [numPages]);

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
            const stageRect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
            const stageWidth = stageRect.width || window.innerWidth;

            // Fit 100% Edge-to-Edge across full screen width (Mobile & Desktop like major apps)
            const fitWidthZoom = stageWidth / viewport.width;
            const fitZoom = Math.min(Math.max(fitWidthZoom, MIN_SCALE), MAX_SCALE);
            resetTransform(fitZoom);
        }).catch(() => {});
    }

    async function onDocumentLoadError(err: Error) {
        console.error("PDF load error:", err);

        // Automatic CORS / Network Fetch Proxy Fallback!
        if (pdfUrl && !activePdfUrl?.includes('/api/proxy-pdf')) {
            try {
                console.log('[AdvancedPDFViewer] Direct PDF load failed, attempting backend CORS proxy fallback...');
                const proxyUrl = await getPdfViewerUrl(pdfUrl);
                setActivePdfUrl(proxyUrl);
                return;
            } catch (proxyErr) {
                console.warn('[AdvancedPDFViewer] Proxy fallback error:', proxyErr);
            }
        }

        setError(`Failed to load PDF: ${err?.message || String(err)} | URL: ${activePdfUrl}`);
        setIsLoading(false);
    }

    const handleDownload = async () => {
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        setIsDownloading(true);

        try {
            // 1. Cache locally for offline viewing inside app
            const sourceUrl = activePdfUrl || originalUrl || pdfUrl;
            await cachePdf(sourceUrl, filename);
            setIsDownloaded(true);

            // 2. Download raw PDF file to device local storage
            const success = await downloadPdfToDevice(sourceUrl, title);
            setIsDownloading(false);
            if (!success) {
                // Fallback attempt with raw pdfUrl if activePdfUrl failed
                if (activePdfUrl && pdfUrl && activePdfUrl !== pdfUrl) {
                    await downloadPdfToDevice(pdfUrl, title);
                }
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

    // Desktop Horizontal Slide Helper (< and > buttons)
    const slideHorizontal = useCallback((direction: 'left' | 'right') => {
        const stage = stageRef.current;
        if (stage) {
            const amount = Math.max(250, stage.clientWidth * 0.35);
            stage.scrollBy({
                left: direction === 'right' ? amount : -amount,
                behavior: 'smooth',
            });
        }
    }, []);

    // ---- Universal Touch & Pinch Handlers (Native Mobile & Mobile Web) ----

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        const state = gestureState.current;

        if (wrapRef.current) {
            wrapRef.current.style.transition = 'none';
        }

        if (touches.length >= 2) {
            state.active = true;
            state.touchCount = 2;
            state.startDistance = getTouchDistance(touches as any);
            state.startZoom = displayZoom; // Sync touch zoom with displayZoom
            transformRef.current.zoom = displayZoom;
            state.moved = true;
        } else if (touches.length === 1) {
            state.active = true;
            state.touchCount = 1;
            state.tapStartX = touches[0].clientX;
            state.tapStartY = touches[0].clientY;
            state.tapStartTime = Date.now();
            state.moved = false;
        }
    }, [displayZoom]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        const state = gestureState.current;
        if (!state.active) return;

        if (touches.length >= 2 && state.touchCount === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(touches as any);
            const rawZoom = state.startZoom * (currentDistance / state.startDistance);
            const clampedZoom = Math.min(Math.max(rawZoom, MIN_SCALE), MAX_SCALE);

            transformRef.current.zoom = clampedZoom;
            setDisplayZoom(clampedZoom);

            if (wrapRef.current) {
                wrapRef.current.style.transition = 'none';
                wrapRef.current.style.transform = `scale(${clampedZoom / BASE_RENDER_SCALE})`;
            }
        } else if (touches.length === 1 && state.touchCount === 1) {
            const totalDx = touches[0].clientX - state.tapStartX;
            const totalDy = touches[0].clientY - state.tapStartY;
            if (Math.hypot(totalDx, totalDy) > 10) {
                state.moved = true;
            }
        }
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const state = gestureState.current;
        const remaining = e.touches.length;

        if (state.touchCount === 1 && remaining === 0 && !state.moved) {
            const elapsed = Date.now() - state.tapStartTime;
            if (elapsed < 300) {
                toggleControlsOnTap(e);
            }
        }

        if (state.touchCount === 2 && remaining < 2) {
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
    }, [toggleControlsOnTap]);

    const zoomButton = (delta: number) => {
        setDisplayZoom(prev => {
            const nextZoom = Math.min(Math.max(prev + delta * 0.15, MIN_SCALE), MAX_SCALE);
            transformRef.current.zoom = nextZoom;
            if (wrapRef.current) {
                wrapRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
                wrapRef.current.style.transform = `scale(${nextZoom / BASE_RENDER_SCALE})`;
            }
            return nextZoom;
        });
    };

    const goToPage = useCallback((updater: (p: number) => number) => {
        setCurrentPage(prev => {
            const nextPage = updater(prev);
            const el = document.getElementById(`pdf-page-${nextPage}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return nextPage;
        });
    }, []);

    const pdfOptions = useMemo(() => ({
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
        disableAutoFetch: false,
        disableStream: false,
        rangeChunkSize: 65536,
    }), []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#05070A] z-[999] flex flex-col font-sans pt-[env(safe-area-inset-top,12px)] select-none"
        >
            {/* Superior Toolbar */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -60, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between px-3 py-1.5 bg-[#0F172A] border-b border-white/5 shadow-2xl relative z-50 shrink-0"
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
                                disabled={isDownloading}
                                className={`p-2.5 rounded-xl transition ${
                                    isDownloading
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 active:scale-95'
                                }`}
                                title="Save PDF to device Downloads folder"
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

            {/* Search Bar */}
            <AnimatePresence>
                {showSearch && showControls && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="p-3 bg-[#0F172A] border-b border-white/5 z-50 shrink-0"
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

            {/* Continuous Vertical Scroll Viewer Stage */}
            <div
                ref={stageRef}
                onTouchStart={(e) => {
                    if (Capacitor.isNativePlatform()) {
                        handleTouchStart(e);
                    }
                }}
                onTouchMove={(e) => {
                    if (Capacitor.isNativePlatform()) {
                        handleTouchMove(e);
                    }
                }}
                onTouchEnd={(e) => {
                    if (Capacitor.isNativePlatform()) {
                        handleTouchEnd(e);
                    }
                }}
                onClick={toggleControlsOnTap}
                className="flex-grow relative overflow-y-auto overflow-x-auto bg-slate-950 w-full h-full custom-scrollbar pt-4 pb-0"
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
                        <h3 className="text-white font-bold text-lg">Initializing High-Definition Document</h3>
                        <p className="text-xs text-gray-400 mt-2 max-w-xs">Loading pages...</p>
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
                    <div
                        ref={wrapRef}
                        className="flex flex-col items-center origin-top transform-gpu transition-transform duration-75"
                        style={{
                            transform: `scale(${displayZoom / BASE_RENDER_SCALE})`,
                            transformOrigin: 'top center',
                            width: `${Math.max(100, (displayZoom / BASE_RENDER_SCALE) * 100)}%`,
                        }}
                    >
                        <Document
                            file={activePdfUrl}
                            options={pdfOptions}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            onLoadProgress={(p) => setProgress(Math.round((p.loaded / p.total) * 100))}
                            className="flex flex-col items-center gap-6 px-1 pb-0"
                        >
                            {Array.from(new Array(numPages || 0), (_, index) => {
                                const pageNum = index + 1;
                                return (
                                    <div
                                        key={`pdf_page_${pageNum}`}
                                        id={`pdf-page-${pageNum}`}
                                        data-page={pageNum}
                                        className="pdf-page-item flex justify-center w-full shadow-2xl"
                                    >
                                        <Page
                                            pageNumber={pageNum}
                                            scale={BASE_RENDER_SCALE}
                                            canvasBackground="white"
                                            renderTextLayer={true}
                                            renderAnnotationLayer={false}
                                            className="bg-white rounded-md overflow-hidden ring-1 ring-black/10 shadow-2xl"
                                            loading={null}
                                        />
                                    </div>
                                );
                            })}

                            {/* End of Document — Thank You Card (Strict Bottom Stop) */}
                            {numPages && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mt-6 mb-0 px-8 py-6 bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900/80 border border-blue-500/20 rounded-3xl text-center shadow-2xl max-w-sm mx-auto backdrop-blur-xl shrink-0"
                                >
                                    <div className="text-3xl mb-2">✨ 🩺 ✨</div>
                                    <h3 className="text-base font-bold text-white mb-1">Thank You & Best of Luck for NEET!</h3>
                                    <p className="text-xs text-blue-300 font-medium">Keep Practicing • Revision is the Key to Success!</p>
                                </motion.div>
                            )}
                        </Document>
                    </div>
                )}
            </div>

            {/* Desktop Horizontal Slide Controls (< and >) */}
            {!error && numPages && !isLoading && (
                <>
                    <div className="hidden md:flex fixed left-5 top-1/2 -translate-y-1/2 z-40">
                        <button
                            onClick={() => slideHorizontal('left')}
                            className="p-3.5 bg-slate-900/90 hover:bg-blue-600 border border-white/10 text-white rounded-full shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-110 active:scale-95 group"
                            title="Slide Left"
                        >
                            <ChevronLeft className="h-6 w-6 text-gray-300 group-hover:text-white" />
                        </button>
                    </div>
                    <div className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-40">
                        <button
                            onClick={() => slideHorizontal('right')}
                            className="p-3.5 bg-slate-900/90 hover:bg-blue-600 border border-white/10 text-white rounded-full shadow-2xl backdrop-blur-xl transition-all duration-200 hover:scale-110 active:scale-95 group"
                            title="Slide Right"
                        >
                            <ChevronRight className="h-6 w-6 text-gray-300 group-hover:text-white" />
                        </button>
                    </div>
                </>
            )}

            {/* Smart Control Bar — Zoom & Page Navigation */}
            <AnimatePresence>
                {!error && numPages && !isLoading && showControls && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="px-4 py-2 bg-[#0F172A] border-t border-white/5 safe-bottom z-50 flex items-center justify-center gap-4 shrink-0"
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
