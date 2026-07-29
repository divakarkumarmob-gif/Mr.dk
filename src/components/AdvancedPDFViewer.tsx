import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink, Loader2, Maximize2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCachedPdf, cachePdf } from '../lib/pdfCache';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { openExternalLink } from '../utils/browser';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { keepAwake, allowSleep } from '../utils/keepAwake';
// Bundle the pdf.js worker locally instead of fetching it from a CDN at
// runtime. Loading pdf.worker.min.mjs from unpkg.com works fine in a regular
// browser, but inside the Capacitor Android WebView that cross-origin script
// load is unreliable (silently fails / times out), which means the worker
// never initializes and PDFs never start rendering — this is what shows up
// to the user as the viewer being "blocked". Importing with `?url` makes
// Vite copy the worker file into dist/assets and gives us a same-origin URL
// that ships inside the APK, so no network/CDN access is needed at all.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MIN_SCALE = 0.25;
const MAX_SCALE = 3.0;

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

    // committedScale = the scale react-pdf actually renders the <Page> canvas
    // at. This only ever changes AFTER a gesture ends (or a zoom button is
    // pressed) — never during a live pinch. During the pinch itself, zoom is
    // purely a CSS transform on top of whatever canvas is already rendered.
    const [committedScale, setCommittedScale] = useState(initialScale);
    const committedScaleRef = useRef(committedScale);
    useEffect(() => {
        committedScaleRef.current = committedScale;
    }, [committedScale]);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Immersive reading mode: single tap on the page toggles the toolbar,
    // search bar, and bottom controls together with the device status bar —
    // same pattern as Google PDF Viewer / Kindle / YouTube fullscreen.
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        if (showControls) {
            SafeArea.showSystemBars().catch(() => {});
        } else {
            SafeArea.hideSystemBars().catch(() => {});
            setShowSearch(false);
        }
    }, [showControls]);

    // Always restore the status bar when leaving the PDF viewer entirely.
    useEffect(() => {
        return () => {
            if (Capacitor.isNativePlatform()) {
                SafeArea.showSystemBars().catch(() => {});
            }
        };
    }, []);

    const pdfDocRef = useRef<any>(null);
    const wrapRef = useRef<HTMLDivElement>(null); // pan/zoom transform target (visual only)
    const stageRef = useRef<HTMLDivElement>(null);

    // Live visual transform (CSS only, never triggers a React re-render).
    // While a pinch/pan gesture is active, this is the ONLY thing that
    // changes — we just paint translate3d()+scale() on top of the single,
    // already-rendered <Page> canvas. No react-pdf re-render happens until
    // the gesture ends.
    const liveTransform = useRef({ scale: 1, x: 0, y: 0 });

    // Content-space anchor snapshot, captured the instant a scale commit is
    // requested (gesture end / zoom button) and consumed once by
    // collapseLiveScale after the fresh canvas paints. This is the single
    // source of truth for "what content point must render at what screen
    // point" across the commit — see captureViewportAnchor / collapseLiveScale.
    // Using content-space coordinates (rather than carrying forward a CSS
    // translation delta) means the math is exact regardless of how
    // committedScale, liveScale, or clamping interact — it never depends on
    // old-scale/new-scale cancelling out algebraically.
    const pendingAnchor = useRef<{ contentX: number; contentY: number; screenX: number; screenY: number } | null>(null);

    // Gesture bookkeeping — supports pinch+pan simultaneously with 2 fingers,
    // and pan with 1 finger.
    const gestureState = useRef<{
        active: boolean;
        touchCount: number;
        startDistance: number;
        startScale: number;
        startX: number;
        startY: number;
        // The pinch-center's position in *unscaled content space*, captured
        // once when the gesture begins. This is the point that must stay
        // pinned under the fingers for the whole gesture — it must NOT be
        // recomputed from the live/moving center on every touchmove, or the
        // anchor drifts every frame and the page visibly slides around.
        startOrigX: number;
        startOrigY: number;
        // Last known pinch center (screen coords), updated every touchmove.
        // Used to anchor the commit-time content-space capture to exactly
        // where the fingers are, rather than an arbitrary point.
        lastCenterXRef: number;
        lastCenterYRef: number;
        lastSingleX: number;
        lastSingleY: number;
        // Tap detection: recorded at touch-start, compared at touch-end.
        tapStartX: number;
        tapStartY: number;
        tapStartTime: number;
        moved: boolean;
    }>({
        active: false,
        touchCount: 0,
        startDistance: 0,
        startScale: 1,
        startX: 0,
        startY: 0,
        startOrigX: 0,
        startOrigY: 0,
        lastCenterXRef: 0,
        lastCenterYRef: 0,
        lastSingleX: 0,
        lastSingleY: 0,
        tapStartX: 0,
        tapStartY: 0,
        tapStartTime: 0,
        moved: false,
    });

    // rAF batching so touchmove never applies more than one style write per
    // animation frame, avoiding layout thrashing on rapid multi-touch events.
    const rafRef = useRef<number | null>(null);
    const pendingTransform = useRef<{ scale: number; x: number; y: number } | null>(null);

    const applyTransformNow = useCallback(() => {
        if (wrapRef.current) {
            const { scale, x, y } = liveTransform.current;
            wrapRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        }
    }, []);

    // Queues a transform write for the next animation frame instead of
    // writing to style directly on every touchmove callback.
    const applyTransform = useCallback(() => {
        pendingTransform.current = liveTransform.current;
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingTransform.current && wrapRef.current) {
                const { scale, x, y } = pendingTransform.current;
                wrapRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
            }
        });
    }, []);

    const resetLiveTransform = useCallback(() => {
        liveTransform.current = { scale: 1, x: 0, y: 0 };
        pendingAnchor.current = null;
        applyTransformNow();
    }, [applyTransformNow]);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        setNumPages(null);
        setCurrentPage(1);
        setCommittedScale(initialScale);
        resetLiveTransform();

        const loadContent = async () => {
            let urlToLoad = pdfUrl;
            if (Capacitor.isNativePlatform()) {
                const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
                const cachedUri = await getCachedPdf(filename);
                if (cachedUri) {
                    urlToLoad = cachedUri;
                }
            }
            setActivePdfUrl(urlToLoad);
        };
        loadContent();

        const loadProgress = async () => {
            if (auth.currentUser && pdfUrl) {
                const encodedUrl = btoa(encodeURIComponent(pdfUrl)).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
                const docRef = doc(db, 'user_reading_progress', `${auth.currentUser.uid}_${encodedUrl}`);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCurrentPage(docSnap.data().page);
                }
            }
        };
        loadProgress();

        return () => {
            allowSleep();
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfUrl]);

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

        // Auto-fit: measure the first page's native width, then compute a scale
        // so it exactly fills the available stage width (minus tiny padding).
        // This replaces the old fixed `initialScale` guess, so text is never
        // cut off on narrow screens nor left with huge empty margins on wide
        // ones.
        pdf.getPage(1).then((page: any) => {
            const viewport = page.getViewport({ scale: 1 });
            const stageWidth = stageRef.current?.clientWidth ?? 400;
            // Leave a very small margin (8px total) instead of the old large padding.
            const fitScale = Math.min(Math.max((stageWidth - 8) / viewport.width, MIN_SCALE), MAX_SCALE);
            setCommittedScale(fitScale);
        }).catch(() => {
            // If measurement fails for any reason, silently keep the existing
            // initialScale fallback — never block rendering on this.
        });
    }

    function onDocumentLoadError(err: Error) {
        console.error("PDF load error:", err);
        setError(`Failed to load PDF: ${err?.message || String(err)} | URL: ${activePdfUrl}`);
        setIsLoading(false);
    }

    const handleDownload = async () => {
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

        if (Capacitor.isNativePlatform()) {
            const cached = await cachePdf(pdfUrl, filename);
            if (cached) {
                alert("Saved for offline use in app. You can reopen it here anytime, even without internet — it won't appear in your phone's Downloads folder.");
                return;
            }
        }

        try {
            const response = await fetch(pdfUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed:", err);
            openExternalLink(pdfUrl);
        }
    };

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
        setIsSearching(false);
    };

    // Captures "what content point is at what screen point" right now, in
    // PDF CONTENT coordinates (i.e. independent of committedScale), and
    // stores it directly in pendingAnchor for collapseLiveScale to consume
    // once the fresh canvas has painted. The wrapper's on-screen mapping at
    // any instant is:
    //   screenPos = liveX + liveScale * (committedScaleOld * contentPos)
    // so solving for contentPos given a target screen point gives:
    //   contentPos = (screenPos - liveX) / (liveScale * committedScaleOld)
    // This is the inverse of the transform actually painted on screen, so it
    // is exact regardless of what liveScale/committedScaleOld currently are.
    const captureViewportAnchor = useCallback((screenX: number, screenY: number) => {
        const { scale: liveScale, x: liveX, y: liveY } = liveTransform.current;
        const totalScale = liveScale * committedScaleRef.current;
        pendingAnchor.current = {
            contentX: (screenX - liveX) / totalScale,
            contentY: (screenY - liveY) / totalScale,
            screenX,
            screenY,
        };
    }, []);

    // Commits a new render scale to react-pdf. This is the ONLY place that
    // triggers an actual canvas re-render (a React state update). It is
    // called after a gesture ends, or from the zoom buttons — never during
    // a live touchmove.
    //
    // Before changing committedScale, we snapshot the current viewport
    // anchor in CONTENT space (see captureViewportAnchor) into
    // pendingAnchor. Once the fresh canvas paints at the new committedScale,
    // collapseLiveScale re-solves the forward equation for the translation
    // that puts that same content point back at that same screen point —
    // this is viewport-space math, not CSS-space math: it does not depend
    // on committedScaleNew being algebraically related to committedScaleOld
    // and liveScale (e.g. it stays correct even if commitZoom's clamping
    // changes the scale independently, or the scale change came from the
    // zoom buttons rather than a pinch).
    const commitZoom = useCallback((finalScale: number, anchorScreenX?: number, anchorScreenY?: number) => {
        const clamped = Math.min(Math.max(finalScale, MIN_SCALE), MAX_SCALE);

        // Default anchor: the center of the visible stage — used for the
        // +/- zoom buttons, which have no finger position to anchor to.
        const stage = stageRef.current;
        const fallbackX = anchorScreenX ?? (stage ? stage.clientWidth / 2 : 0);
        const fallbackY = anchorScreenY ?? (stage ? stage.clientHeight / 2 : 0);
        captureViewportAnchor(fallbackX, fallbackY);

        setCommittedScale(clamped);
    }, [captureViewportAnchor]);

    // ---- Native touch handlers ----
    // 2 fingers: pinch (zoom) AND pan (move) simultaneously, tracked from the
    //            midpoint between the two touches.
    // 1 finger:  pan only.

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touches = e.touches;
        const state = gestureState.current;

        if (wrapRef.current) {
            wrapRef.current.style.transition = 'none';
        }

        if (touches.length >= 2) {
            const center = getTouchCenter(touches as any);
            state.active = true;
            state.touchCount = 2;
            state.startDistance = getTouchDistance(touches as any);
            state.startScale = liveTransform.current.scale;
            state.startX = liveTransform.current.x;
            state.startY = liveTransform.current.y;
            // Fixed anchor in unscaled content space — computed once, here,
            // from the start center. Used for the whole gesture so the
            // zoom stays pinned under the fingers instead of drifting.
            state.startOrigX = (center.x - state.startX) / state.startScale;
            state.startOrigY = (center.y - state.startY) / state.startScale;
            state.lastCenterXRef = center.x;
            state.lastCenterYRef = center.y;
            state.moved = true; // two-finger gestures are never a "tap"
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

        if (touches.length >= 2 && state.touchCount === 2) {
            e.preventDefault();
            const currentDistance = getTouchDistance(touches as any);
            const center = getTouchCenter(touches as any);

            const rawScale = state.startScale * (currentDistance / state.startDistance);
            const minLive = MIN_SCALE / committedScaleRef.current;
            const maxLive = MAX_SCALE / committedScaleRef.current;
            const clampedLiveScale = Math.min(Math.max(rawScale, minLive), maxLive);

            // Use the anchor captured once at gesture start (state.startOrigX/Y),
            // not one recomputed from the live center every frame — that was
            // the bug: recomputing it here made the anchor drift on every
            // touchmove, which is what made the page appear to slide/move
            // during a pinch instead of zooming cleanly in place.
            // Re-anchoring against the CURRENT center still gives correct
            // simultaneous pan (the page follows the fingers), because the
            // anchor's content-space position is fixed while its target
            // screen position (center.x/y) tracks the fingers each frame.
            liveTransform.current = {
                scale: clampedLiveScale,
                x: center.x - state.startOrigX * clampedLiveScale,
                y: center.y - state.startOrigY * clampedLiveScale,
            };
            applyTransform();

            // Keep the last known pinch center around so touch-end can
            // anchor the commit to exactly where the fingers currently are,
            // in content-space terms, rather than the stage center.
            state.lastCenterXRef = center.x;
            state.lastCenterYRef = center.y;

            // No React state update here — this is a pure CSS transform,
            // no react-pdf re-render happens until the gesture ends.
        } else if (touches.length === 1 && state.touchCount === 1) {
            e.preventDefault();
            const dx = touches[0].clientX - state.lastSingleX;
            const dy = touches[0].clientY - state.lastSingleY;
            state.lastSingleX = touches[0].clientX;
            state.lastSingleY = touches[0].clientY;

            // Tap-vs-drag: once total movement from the tap start exceeds a
            // small threshold, this is a drag/pan, not a tap.
            const totalDx = touches[0].clientX - state.tapStartX;
            const totalDy = touches[0].clientY - state.tapStartY;
            if (Math.hypot(totalDx, totalDy) > 10) {
                state.moved = true;
            }

            liveTransform.current = {
                ...liveTransform.current,
                x: liveTransform.current.x + dx,
                y: liveTransform.current.y + dy,
            };
            applyTransform();
        }
    }, [applyTransform]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const state = gestureState.current;
        const remaining = e.touches.length;

        if (wrapRef.current) {
            wrapRef.current.style.transition = '';
        }

        // Tap detection: single finger, didn't move past the threshold,
        // and released quickly — toggle immersive reading mode.
        if (state.touchCount === 1 && remaining === 0 && !state.moved) {
            const elapsed = Date.now() - state.tapStartTime;
            if (elapsed < 300) {
                setShowControls(prev => !prev);
            }
        }

        if (state.touchCount === 2 && remaining < 2) {
            // Gesture end: fold the live CSS scale into the committed scale
            // and let react-pdf render exactly ONE new canvas at that scale.
            // The anchor for this commit is the pinch center itself — so the
            // exact content point under the fingers is what gets pinned back
            // to the exact same screen point once the new canvas paints.
            const finalScale = committedScaleRef.current * liveTransform.current.scale;
            commitZoom(finalScale, state.lastCenterXRef, state.lastCenterYRef);

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
    }, [commitZoom]);

    // Discrete zoom via +/- buttons.
    const zoomButton = useCallback((direction: 1 | -1) => {
        const step = 0.2 * direction;
        const current = committedScaleRef.current;
        const target = Math.min(Math.max(current + step, MIN_SCALE), MAX_SCALE);
        commitZoom(target);
    }, [commitZoom]);

    // Page navigation preserves whatever zoom/pan the user currently has —
    // same as Google Drive / Xodo, flipping pages never snaps you back to
    // fit-width. The live transform is untouched; committedScale stays as-is.
    const goToPage = useCallback((updater: (p: number) => number) => {
        setCurrentPage(updater);
    }, []);

    // Fires once the single <Page> canvas finishes painting at the new
    // committedScale — whether that came from a pinch-end, a zoom button, or
    // simply a page change (react-pdf re-renders the <Page> on every
    // pageNumber change too, even when committedScale didn't move).
    //
    // This is where we solve the VIEWPORT-SPACE equation, not a CSS-space
    // shortcut. pendingAnchor holds a content-space point (contentX/contentY,
    // independent of any scale) and the exact screen point it must continue
    // to render at (screenX/screenY). The new canvas is native at
    // committedScaleRef.current, so under transform translate(x,y) scale(1):
    //   screenX = x + committedScaleNew * contentX
    //   screenY = y + committedScaleNew * contentY
    // Solving for the translation:
    //   x = screenX - committedScaleNew * contentX
    //   y = screenY - committedScaleNew * contentY
    // This holds regardless of how committedScaleNew relates to whatever
    // scale was committed before, or to whatever liveScale was mid-gesture —
    // there is no reliance on the two cancelling out algebraically. It is
    // exact for pinch-end, zoom-button, and (if ever needed) any other
    // scale-changing path, because it is re-derived from the anchor itself
    // every time rather than carried forward as a CSS delta.
    //
    // If there's no pending anchor (e.g. a plain page change with no scale
    // commit involved), the live transform is already correct as-is and is
    // left untouched — no jump, because nothing about the transform needs
    // to change.
    const collapseLiveScale = useCallback(() => {
        const anchor = pendingAnchor.current;
        if (!anchor) return;
        pendingAnchor.current = null;

        const committedScaleNew = committedScaleRef.current;
        liveTransform.current = {
            scale: 1,
            x: anchor.screenX - committedScaleNew * anchor.contentX,
            y: anchor.screenY - committedScaleNew * anchor.contentY,
        };
        applyTransformNow();
    }, [applyTransformNow]);

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
                                className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition"
                                title={Capacitor.isNativePlatform() ? "Save for offline" : "Download PDF"}
                            >
                                <Download className="h-5 w-5" />
                            </button>

                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className={`p-2.5 ${showSearch ? 'bg-blue-600/20' : 'bg-white/5'} hover:bg-white/10 text-gray-300 rounded-xl transition`}
                                title="Search PDF"
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

            {showSearch && showControls && (
                <div className="p-3 bg-[#0F172A] border-b border-white/5 z-50 flex items-center gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="flex-grow bg-white/5 text-white p-2 rounded-xl text-sm"
                    />
                    <button
                        onClick={() => performSearch(searchQuery)}
                        className="p-2 bg-blue-600 rounded-xl text-white"
                    >
                        {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                    </button>
                    {searchResults.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 overflow-x-auto">
                            {searchResults.map((page) => (
                                <button key={page} onClick={() => { setCurrentPage(page); setShowSearch(false); }} className="hover:text-blue-500 px-2">
                                    {page}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Viewer Stage */}
            <div
                ref={stageRef}
                className="flex-grow relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center"
                style={{ touchAction: 'none' }}
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

                <div className="w-full h-full overflow-hidden p-1 flex flex-col items-center justify-center">
                    {error ? (
                        <div className="max-w-sm text-center p-12 bg-gray-900/50 rounded-[40px] border border-white/5 backdrop-blur-xl mt-12">
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
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            onLoadProgress={(p) => setProgress(Math.round((p.loaded / p.total) * 100))}
                            className="flex flex-col items-center"
                        >
                            {/* Single transform target. During a pinch/pan gesture only
                                this element's inline `transform` style changes (via refs
                                + rAF) — no React state update, no re-render. Once the
                                gesture ends, committedScale changes and react-pdf
                                re-renders the ONE <Page> below at the new scale; when
                                that finishes painting, collapseLiveScale drops just the
                                `scale` term of the transform (translation untouched), so
                                the viewport position never moves and nothing jumps. */}
                            <div
                                ref={wrapRef}
                                style={{ willChange: 'transform', position: 'relative', transformOrigin: '0 0' }}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={committedScale}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    className="shadow-2xl bg-white rounded-md overflow-hidden ring-1 ring-white/10"
                                    loading={null}
                                    onRenderSuccess={collapseLiveScale}
                                />
                            </div>
                        </Document>
                    )}
                </div>
            </div>

            {/* Smart Control Bar */}
            <AnimatePresence>
                {!error && numPages && !isLoading && showControls && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="px-4 py-2 bg-[#0F172A] border-t border-white/5 safe-bottom z-50 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
                            <button
                                onClick={() => zoomButton(-1)}
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400"
                            >
                                <ZoomOut className="h-6 w-6" />
                            </button>
                            <span className="text-[10px] font-mono text-gray-500 w-12 text-center">{Math.round(committedScale * 100)}%</span>
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

                        <button
                            onClick={handleDownload}
                            className="p-3.5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20 active:scale-95"
                            title={Capacitor.isNativePlatform() ? "Save for offline" : "Download PDF"}
                        >
                            <Download className="h-6 w-6" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
