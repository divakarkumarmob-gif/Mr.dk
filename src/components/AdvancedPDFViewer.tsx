
import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink, Loader2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Configure the worker to use the CDN - Using MJS for modern compatibility with PDF.js 5.x
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AdvancedPDFViewer({ pdfUrl, title, onClose, originalUrl, initialScale = 0.6 }: { pdfUrl: string, title: string, onClose: () => void, originalUrl?: string, initialScale?: number }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(initialScale);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [useNativeViewer, setUseNativeViewer] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        setNumPages(null);
        setCurrentPage(1);

        // Auto-detect if we should use native viewer (for non-direct PDF sites)
        if (pdfUrl.includes('selfstudys.com') || pdfUrl.includes('vedantu.com') || pdfUrl.includes('byjus.com') && !pdfUrl.toLowerCase().endsWith('.pdf') && !pdfUrl.includes('blob:')) {
            setUseNativeViewer(true);
            setIsLoading(false);
        }
    }, [pdfUrl]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
        setIsLoading(false);
    }
    
    function onDocumentLoadError(err: Error) {
        console.error("PDF load error:", err);
        setError("Failed to load interactive PDF. The file might be protected or the server is unresponsive.");
        setIsLoading(false);
        // Fallback to native viewer automatically if it's not a blob
        if (!pdfUrl.includes('blob:')) {
            setUseNativeViewer(true);
        }
    }

    const handleDownload = async () => {
        try {
            const response = await fetch(pdfUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed:", err);
            // Fallback: open in new tab if blob fetch fails
            window.open(originalUrl || pdfUrl, '_blank');
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#05070A] z-[999] flex flex-col font-sans"
        >
            {/* Superior Toolbar */}
            <div className="flex items-center justify-between p-3 bg-[#0F172A] border-b border-white/5 shadow-2xl relative z-50">
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
                        title="Download PDF"
                    >
                        <Download className="h-5 w-5" />
                    </button>

                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Viewer Stage */}
            <div className="flex-grow relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
                <AnimatePresence mode="wait">
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

                    {useNativeViewer ? (
                        <motion.div 
                            key="native"
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="w-full h-full bg-white relative"
                        >
                            <iframe
                                src={pdfUrl}
                                className="w-full h-full border-none shadow-inner"
                                title={title}
                                onLoad={() => setIsLoading(false)}
                            />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="interactive"
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="w-full h-full overflow-auto p-4 flex flex-col items-center scrollbar-thin scrollbar-thumb-white/10"
                        >
                            {error ? (
                                <div className="max-w-sm text-center p-12 bg-gray-900/50 rounded-[40px] border border-white/5 backdrop-blur-xl mt-12">
                                     <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                                        <AlertTriangle className="text-red-400 w-12 h-12" />
                                     </div>
                                     <h3 className="text-white font-bold text-xl mb-4">View Blocked</h3>
                                     <p className="text-sm text-gray-400 mb-10 leading-relaxed">The source server is preventing embedded display. Try our fallback browser mode.</p>
                                     <div className="grid gap-3">
                                        <button 
                                            onClick={() => setUseNativeViewer(true)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                                        >
                                            Try Native View
                                        </button>
                                        <button 
                                            onClick={() => window.open(pdfUrl, '_blank')}
                                            className="w-full bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-sm font-bold text-gray-300 transition active:scale-95"
                                        >
                                            Open in External Browser
                                        </button>
                                     </div>
                                </div>
                            ) : (
                                <Document
                                    file={pdfUrl}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    onLoadError={onDocumentLoadError}
                                    className="flex flex-col items-center"
                                >
                                    <Page 
                                        pageNumber={currentPage} 
                                        scale={scale}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className="shadow-2xl !bg-white rounded-md overflow-hidden ring-1 ring-white/10"
                                        loading={<div className="h-[600px] w-[400px] bg-white/5 animate-pulse rounded-md" />}
                                    />
                                </Document>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Smart Control Bar */}
            <AnimatePresence>
                {!useNativeViewer && !error && numPages && !isLoading && (
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="p-4 bg-[#0F172A] border-t border-white/5 safe-bottom z-50 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1">
                            <button 
                                onClick={() => setScale(s => Math.max(s - 0.25, 0.25))} 
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400"
                            >
                                <ZoomOut className="h-6 w-6" />
                            </button>
                            <span className="text-[10px] font-mono text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
                            <button 
                                onClick={() => setScale(s => Math.min(s + 0.25, 3))} 
                                className="p-3 hover:bg-white/10 rounded-xl transition text-gray-400"
                            >
                                <ZoomIn className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-1 px-2">
                            <button 
                                disabled={currentPage <= 1} 
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
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
                                onClick={() => setCurrentPage(p => Math.min(p + 1, numPages || 1))}
                                className="p-3 text-blue-500 hover:bg-white/10 rounded-xl disabled:opacity-20 transition"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </div>

                        <button 
                            onClick={handleDownload}
                            className="p-3.5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20 active:scale-95"
                            title="Download PDF"
                        >
                            <Download className="h-6 w-6" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
