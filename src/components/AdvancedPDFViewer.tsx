
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

// Configure the worker to use the CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AdvancedPDFViewer({ pdfUrl, title, onClose }: { pdfUrl: string, title: string, onClose: () => void }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(0.73);
    const [error, setError] = useState<string | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
    }
    
    function onDocumentLoadError(error: Error) {
        console.error("PDF load error:", error);
        setError("Failed to load PDF. Please try again later.");
    }
    
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-white z-[600] flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center p-2.5 bg-gray-900 shadow-sm z-10 text-white">
                <h2 className="text-sm font-bold truncate mr-2">{title}</h2>
                <button onClick={() => window.open(pdfUrl, '_blank')} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full"><Download className="h-4 w-4" /></button>
                <div className="flex-grow"></div>
                <button onClick={onClose} className="p-1.5 bg-red-900 hover:bg-red-800 rounded-full transition"><X className="h-4 w-4" /></button>
            </div>
            
            {/* PDF Viewport */}
            <div className="flex-grow overflow-auto bg-gray-600 p-2">
                <div
                    className="flex justify-center min-w-max"
                >
                    {error ? (
                        <div className="p-10 text-white font-bold">{error}</div>
                    ) : (
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                        >
                            <Page 
                                pageNumber={currentPage} 
                                scale={scale}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                            />
                        </Document>
                    )}
                </div>
            </div>

            {/* Pagination & Zoom */}
            <div className="flex items-center justify-between p-1.5 bg-gray-900 text-white border-t border-gray-700">
                {/* Zoom Out - Left */}
                <button onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} className="p-3 hover:bg-gray-800 rounded-lg flex items-center justify-center">
                    <ZoomOut className="h-6 w-6" />
                </button>

                {/* Page Controls - Center */}
                <div className="flex items-center gap-2">
                    <button 
                        disabled={currentPage <= 1} 
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        className="p-1.5 bg-gray-800 rounded-full disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold w-16 text-center">{currentPage} / {numPages}</span>
                        <span className="text-xs font-mono text-gray-400 bg-gray-950 px-1 rounded">{Math.round(scale * 100)}%</span>
                    </div>
                    <button 
                        disabled={currentPage >= (numPages || 1)} 
                        onClick={() => setCurrentPage(p => Math.min(p + 1, numPages || 1))}
                        className="p-1.5 bg-gray-800 rounded-full disabled:opacity-50"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {/* Zoom In - Right */}
                <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-3 hover:bg-gray-800 rounded-lg flex items-center justify-center">
                    <ZoomIn className="h-6 w-6" />
                </button>
            </div>
        </motion.div>
    );
}
