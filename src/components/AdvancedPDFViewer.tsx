import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight, AlertTriangle, Loader2, Search, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCachedPdf, cachePdf, isPdfCached, downloadPdfToDevice, getRamCachedPdf, fetchAndCachePdf } from '../lib/pdfCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { openExternalLink } from '../utils/browser';
import { getPdfViewerUrl } from '../utils/api';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { keepAwake, allowSleep } from '../utils/keepAwake';
import { useModalBackButton } from '../utils/hardwareBackButton';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

try {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || '5.4.296'}/build/pdf.worker.min.mjs`;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 4.0;

function getTouchDistance(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches: React.TouchList) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}

export default function AdvancedPDFViewer({ pdfUrl, title, onClose, originalUrl, initialScale = 1.0 }: { pdfUrl: string, title: string, onClose: () => void, originalUrl?: string, initialScale?: number }) {
    useModalBackButton(true, onClose);
    const [activePdfUrl, setActivePdfUrl] = useState(pdfUrl);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    
    // GPU-accelerated visual scale for 0ms lag & 0 flashing zoom
    const [visualScale, setVisualScale] = useState(initialScale);
    const [isPinching, setIsPinching] = useState(false);
    const [isDraggingMouse, setIsDraggingMouse] = useState(false);
    
    // Stable base canvas resolution for react-pdf
    const [renderScale, setRenderScale] = useState(1.2);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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

    const gestureState = useRef({
        active: false,
        startDistance: 0,
        startScale: 1.0,
        focalX: 0,
        focalY: 0,
        tapStartX: 0,
        tapStartY: 0,
        tapStartTime: 0,
        lastTapTime: 0,
        moved: false,
        rafId: null as number | null,
    });

    const mousePanState = useRef({
        isDown: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        hasDragged: false,
    });

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        setNumPages(null);
        setCurrentPage(1);

        let isMounted = true;

        const loadContent = async () => {
            const ramUrl = getRamCachedPdf(title, pdfUrl);
            if (ramUrl && isMounted) {
                setActivePdfUrl(ramUrl);
                setIsDownloaded(true);
                return;
            }

            try {
                const cachedBlobUrl = await getCachedPdf(title, pdfUrl);
                if (cachedBlobUrl && isMounted) {
                    setActivePdfUrl(cachedBlobUrl);
                    setIsDownloaded(true);
                    return;
                }
            } catch (err) {
                console.warn('[AdvancedPDFViewer] Local disk cache check notice:', err);
            }

            if (pdfUrl && isMounted) {
                setActivePdfUrl(pdfUrl);
                fetchAndCachePdf(pdfUrl, title).then(() => {
                    if (isMounted) setIsDownloaded(true);
                }).catch(async (fetchErr) => {
                    console.warn('[AdvancedPDFViewer] Direct fetch notice, trying proxy:', fetchErr);
                    if (isMounted && pdfUrl && !pdfUrl.includes('/api/proxy-pdf')) {
                        try {
                            const proxyUrl = await getPdfViewerUrl(pdfUrl);
                            if (isMounted) setActivePdfUrl(proxyUrl);
                        } catch (proxyErr) {
                            console.warn('[AdvancedPDFViewer] Proxy fallback error:', proxyErr);
                        }
                    }
                });
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
        };
    }, [pdfUrl, title]);

    useEffect(() => {
        keepAwake();
        return () => {
            allowSleep();
        };
    }, []);

    const toggleControlsOnTap = useCallback((e?: any) => {
        if (e && e.target) {
            const target = e.target as HTMLElement;
            if (target.closest('button, input, form, a')) return;
        }
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

    // Calculate Default Full-Width Fit for Edge-to-Edge Screen Coverage
    const fitToScreenWidth = useCallback(() => {
        const stage = stageRef.current;
        const availableWidth = stage ? stage.clientWidth - 24 : window.innerWidth - 24;
        if (pageWidthRef.current > 0 && availableWidth > 0) {
            const autoFitScale = Math.min(Math.max(availableWidth / (pageWidthRef.current * renderScale), 0.5), 3.0);
            setIsPinching(false);
            setVisualScale(autoFitScale);
        }
    }, [renderScale]);

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
            const availableWidth = stage ? stage.clientWidth - 24 : window.innerWidth - 24;
            if (viewport.width > 0 && availableWidth > 0) {
                const autoFitScale = Math.min(Math.max(availableWidth / (viewport.width * renderScale), 0.5), 3.0);
                setVisualScale(autoFitScale);
            }
        }).catch(() => {});
    }

    async function onDocumentLoadError(err: Error) {
        console.error("PDF load error:", err);

        if (pdfUrl && !activePdfUrl?.includes('/api/proxy-pdf')) {
            try {
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
            const sourceUrl = activePdfUrl || originalUrl || pdfUrl;
            await cachePdf(sourceUrl, filename);
            setIsDownloaded(true);

            const success = await downloadPdfToDevice(sourceUrl, title);
            setIsDownloading(false);
            if (!success) {
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

    // Fast GPU-accelerated Zoom Control (0ms lag, 0 flashing)
    const zoomButton = (delta: number) => {
        setIsPinching(false);
        setVisualScale(prev => {
            const nextScale = Math.min(Math.max(prev + delta * 0.25, MIN_SCALE), MAX_SCALE);
            return nextScale;
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

    // ---- Desktop Mouse Click-and-Hold Drag-to-Pan (Hand Tool) ----
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, input, form, a')) return;

        const stage = stageRef.current;
        if (!stage) return;

        mousePanState.current = {
            isDown: true,
            startX: e.clientX,
            startY: e.clientY,
            scrollLeft: stage.scrollLeft,
            scrollTop: stage.scrollTop,
            hasDragged: false,
        };
        setIsDraggingMouse(true);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const state = mousePanState.current;
        if (!state.isDown) return;

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        if (Math.hypot(dx, dy) > 5) {
            state.hasDragged = true;
        }

        const stage = stageRef.current;
        if (stage) {
            stage.scrollLeft = state.scrollLeft - dx;
            stage.scrollTop = state.scrollTop - dy;
        }
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const state = mousePanState.current;
        if (state.isDown) {
            state.isDown = false;
            setIsDraggingMouse(false);
        }
    }, []);

    const currentScaleRef = useRef(initialScale);
    useEffect(() => {
        currentScaleRef.current = visualScale;
    }, [visualScale]);

    // ---- Native Non-Passive Touch Event Listener for 60 FPS Lag-Free Finger Pinch Zoom ----
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        const state = gestureState.current;

        const onTouchStart = (e: TouchEvent) => {
            const touches = e.touches;
            if (touches.length >= 2) {
                if (e.cancelable) e.preventDefault();

                state.active = true;
                setIsPinching(true);
                state.startDistance = getTouchDistance(touches as any);
                state.startScale = currentScaleRef.current;
                state.moved = true;

                const center = getTouchCenter(touches as any);
                const rect = stage.getBoundingClientRect();
                state.focalX = center.x - rect.left + stage.scrollLeft;
                state.focalY = center.y - rect.top + stage.scrollTop;

                if (wrapRef.current) {
                    wrapRef.current.style.transition = 'none';
                    wrapRef.current.style.transformOrigin = 'top center';
                }
            } else if (touches.length === 1) {
                state.active = true;
                state.tapStartX = touches[0].clientX;
                state.tapStartY = touches[0].clientY;
                state.tapStartTime = Date.now();
                state.moved = false;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            const touches = e.touches;
            if (!state.active) return;

            if (touches.length >= 2) {
                // CRITICAL: Prevent native browser pinch/scroll conflict to eliminate jitter
                if (e.cancelable) e.preventDefault();

                const currentDistance = getTouchDistance(touches as any);
                if (state.startDistance > 0) {
                    const ratio = currentDistance / state.startDistance;
                    const newScale = Math.min(Math.max(state.startScale * ratio, MIN_SCALE), MAX_SCALE);
                    
                    const oldScale = currentScaleRef.current;
                    currentScaleRef.current = newScale;

                    // Smooth scroll tracking relative to pinch center
                    if (oldScale > 0 && newScale !== oldScale) {
                        const scaleRatio = newScale / oldScale;
                        const center = getTouchCenter(touches as any);
                        const rect = stage.getBoundingClientRect();
                        const currentTouchFocalY = center.y - rect.top;
                        
                        stage.scrollTop = (stage.scrollTop + currentTouchFocalY) * scaleRatio - currentTouchFocalY;
                    }

                    // Direct GPU DOM scale for 0ms lag
                    if (wrapRef.current) {
                        wrapRef.current.style.transform = `scale(${newScale})`;
                    }
                }
            } else if (touches.length === 1) {
                const totalDx = touches[0].clientX - state.tapStartX;
                const totalDy = touches[0].clientY - state.tapStartY;
                if (Math.hypot(totalDx, totalDy) > 10) {
                    state.moved = true;
                }
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            const remaining = e.touches.length;

            if (remaining < 2) {
                if (state.startDistance > 0) {
                    setIsPinching(false);
                    state.startDistance = 0;

                    // Sync final visual scale to React state
                    const finalScale = currentScaleRef.current;
                    setVisualScale(finalScale);

                    if (wrapRef.current) {
                        wrapRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
                        wrapRef.current.style.transform = `scale(${finalScale})`;
                    }
                }
            }

            if (remaining === 0) {
                const now = Date.now();
                if (!state.moved && (now - state.tapStartTime < 300)) {
                    if (now - state.lastTapTime < 300) {
                        // Double tap toggle
                        setIsPinching(false);
                        const targetScale = currentScaleRef.current > 1.5 ? 1.0 : 2.0;
                        currentScaleRef.current = targetScale;
                        setVisualScale(targetScale);
                        if (wrapRef.current) {
                            wrapRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
                            wrapRef.current.style.transform = `scale(${targetScale})`;
                        }
                        state.lastTapTime = 0;
                    } else {
                        state.lastTapTime = now;
                        toggleControlsOnTap(e);
                    }
                }
                state.active = false;
            }
        };

        stage.addEventListener('touchstart', onTouchStart, { passive: false });
        stage.addEventListener('touchmove', onTouchMove, { passive: false });
        stage.addEventListener('touchend', onTouchEnd, { passive: true });
        stage.addEventListener('touchcancel', onTouchEnd, { passive: true });

        return () => {
            stage.removeEventListener('touchstart', onTouchStart);
            stage.removeEventListener('touchmove', onTouchMove);
            stage.removeEventListener('touchend', onTouchEnd);
            stage.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [toggleControlsOnTap]);

    // ---- High-Precision Case-Insensitive Transparent Red Highlight Engine ----
    const highlightSearchText = useCallback((query: string) => {
        const stage = stageRef.current;
        if (!stage) return;

        // Clear previous highlights safely
        const prevMarks = stage.querySelectorAll('.pdf-search-red-mark');
        prevMarks.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
                parent.normalize();
            }
        });

        if (!query || !query.trim()) return;

        const trimmedQuery = query.trim();
        const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        const spans = stage.querySelectorAll('.react-pdf__Page__textContent span');
        spans.forEach(span => {
            const text = span.textContent;
            if (text && regex.test(text)) {
                const highlighted = text.replace(
                    regex,
                    `<mark class="pdf-search-red-mark bg-red-500/40 text-white font-bold border border-red-500/70 rounded-[3px] px-0.5 shadow-[0_0_10px_rgba(239,68,68,0.6)] transition-all duration-200">$1</mark>`
                );
                span.innerHTML = highlighted;
            }
        });
    }, []);

    // Search helpers
    const performSearch = async (query: string) => {
        if (!pdfDocRef.current || !query) return;
        setIsSearching(true);
        const results: number[] = [];
        const lowerQuery = query.toLowerCase().trim();

        for (let i = 1; i <= pdfDocRef.current.numPages; i++) {
            const page = await pdfDocRef.current.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map((item: any) => item.str).join(' ');
            if (text.toLowerCase().includes(lowerQuery)) {
                results.push(i);
            }
        }
        setSearchResults(results);
        setCurrentSearchIndex(0);
        setIsSearching(false);

        if (results.length > 0) {
            setCurrentPage(results[0]);
        }
    };

    // Auto-trigger transparent red highlight on page render or search update
    useEffect(() => {
        if (searchQuery.trim()) {
            const timer = setTimeout(() => {
                highlightSearchText(searchQuery);
            }, 250);
            return () => clearTimeout(timer);
        } else {
            highlightSearchText('');
        }
    }, [currentPage, searchQuery, searchResults, highlightSearchText]);

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
                setSearchQuery('');
                setSearchResults([]);
                setCurrentSearchIndex(0);
                highlightSearchText('');
            } else {
                setTimeout(() => searchInputRef.current?.focus(), 100);
            }
            return !prev;
        });
    }, [highlightSearchText]);

    const slideHorizontal = useCallback((direction: 'left' | 'right') => {
        const stage = stageRef.current;
        if (stage) {
            const amount = Math.max(300, stage.clientWidth * 0.4);
            stage.scrollBy({
                left: direction === 'right' ? amount : -amount,
                behavior: 'smooth',
            });
        }
    }, []);

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
                                onClick={fitToScreenWidth}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition active:scale-95 flex items-center gap-1.5 text-xs"
                                title="Full Screen Width Fit"
                            >
                                <Maximize2 className="h-4 w-4 text-blue-400" />
                                <span className="hidden sm:inline text-[11px] font-medium text-gray-300">Fit Width</span>
                            </button>

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
                                        type="button"
                                        onClick={() => navigateSearchResult('prev')}
                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="text-[10px] text-gray-500 w-10 text-center">{currentSearchIndex + 1}/{searchResults.length}</span>
                                    <button
                                        type="button"
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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(e) => {
                    if (!mousePanState.current.hasDragged) {
                        toggleControlsOnTap(e);
                    }
                    mousePanState.current.hasDragged = false;
                }}
                style={{
                    cursor: isDraggingMouse ? 'grabbing' : 'grab',
                    touchAction: isPinching ? 'none' : 'pan-x pan-y',
                }}
                className="flex-grow relative overflow-y-auto overflow-x-auto bg-slate-950 w-full h-full custom-scrollbar pt-4 pb-0 overscroll-contain select-none"
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
                        <h3 className="text-white font-bold text-lg">Initializing Document</h3>
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
                        className="w-full flex flex-col items-center justify-start mx-auto px-0 pt-2 sm:pt-4 pb-0 mb-0 shrink-0"
                        style={{
                            transform: `scale(${visualScale})`,
                            transformOrigin: 'top center',
                            transition: isPinching ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            willChange: 'transform',
                        }}
                    >
                        <Document
                            file={activePdfUrl}
                            options={pdfOptions}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            className="flex flex-col items-center gap-6 px-1 pb-0 mb-0"
                        >
                            {Array.from(new Array(numPages || 0), (_, index) => {
                                const pageNum = index + 1;
                                const isVisible = pageNum >= Math.max(1, currentPage - 2) && pageNum <= Math.min(numPages || 1, currentPage + 3);

                                return (
                                    <div
                                        key={`pdf_page_${pageNum}`}
                                        id={`pdf-page-${pageNum}`}
                                        data-page={pageNum}
                                        className="pdf-page-item flex justify-center shadow-2xl my-2 min-h-[350px] min-w-[300px]"
                                        style={{
                                            width: pageWidthRef.current ? `${pageWidthRef.current * renderScale}px` : '100%',
                                            minHeight: pageHeightRef.current ? `${pageHeightRef.current * renderScale}px` : '500px',
                                        }}
                                    >
                                        {isVisible ? (
                                            <Page
                                                pageNumber={pageNum}
                                                scale={renderScale}
                                                canvasBackground="white"
                                                renderTextLayer={true}
                                                renderAnnotationLayer={false}
                                                className="bg-white rounded-md overflow-hidden ring-1 ring-black/10 shadow-2xl"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-slate-900/60 rounded-md border border-white/5 flex items-center justify-center text-xs text-gray-500 font-mono">
                                                Page {pageNum}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* End of Document — Thank You Card */}
                            {numPages && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mt-6 mb-2 px-8 py-5 bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900/80 border border-blue-500/20 rounded-3xl text-center shadow-2xl max-w-sm mx-auto backdrop-blur-xl shrink-0"
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
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400 active:scale-90"
                            >
                                <ZoomOut className="h-6 w-6" />
                            </button>
                            <span className="text-[10px] font-mono text-gray-400 w-12 text-center">{Math.round(visualScale * 100)}%</span>
                            <button
                                onClick={() => zoomButton(1)}
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400 active:scale-90"
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
