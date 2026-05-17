
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

// Configure the worker to use the CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AdvancedPDFViewer({ pdfUrl, title, onClose }: { pdfUrl: string, title: string, onClose: () => void }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(0.8);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-white z-[600] flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-900 shadow-sm z-10 text-white">
                <h2 className="text-sm font-bold truncate mr-2">{title}</h2>
                <div className="flex gap-2 shrink-0 items-center">
                    <span className="text-xs font-mono text-gray-400 bg-gray-950 px-2 py-1 rounded">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomIn className="h-5 w-5" /></button>
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomOut className="h-5 w-5" /></button>
                    <button onClick={() => window.open(pdfUrl, '_blank')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><Download className="h-5 w-5" /></button>
                    <button onClick={onClose} className="p-2 bg-red-900 hover:bg-red-800 rounded-full transition"><X className="h-5 w-5" /></button>
                </div>
            </div>
            
            {/* PDF Viewport */}
            <div className="flex-grow overflow-auto bg-gray-600 p-2">
                <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex justify-center"
                >
                    <Page 
                        pageNumber={currentPage} 
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                    />
                </Document>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 p-4 bg-gray-900 text-white border-t border-gray-700">
                <button 
                    disabled={currentPage <= 1} 
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    className="p-2 bg-gray-800 rounded-full disabled:opacity-50"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-bold">{currentPage} / {numPages}</span>
                <button 
                    disabled={currentPage >= (numPages || 1)} 
                    onClick={() => setCurrentPage(p => Math.min(p + 1, numPages || 1))}
                    className="p-2 bg-gray-800 rounded-full disabled:opacity-50"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </motion.div>
    );
}
