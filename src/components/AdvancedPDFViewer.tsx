
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

// Configure the worker to use the CDN matching the exact version installed
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function AdvancedPDFViewer({ pdfUrl, title, onClose }: { pdfUrl: string, title: string, onClose: () => void }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(0.5);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-white z-[600] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-gray-900 shadow-sm z-10 text-white">
                <h2 className="text-xs font-bold truncate mr-1">{title}</h2>
                <div className="flex gap-1 shrink-0">
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomIn className="h-4 w-4" /></button>
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomOut className="h-4 w-4" /></button>
                    <button onClick={() => window.open(pdfUrl, '_blank')} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-full"><Download className="h-4 w-4" /></button>
                    <button onClick={onClose} className="p-1.5 bg-red-900 hover:bg-red-800 rounded-full transition"><X className="h-4 w-4" /></button>
                </div>
            </div>
            
            {/* PDF Viewport */}
            <div className="flex-grow overflow-auto bg-gray-600 flex flex-col items-center justify-center p-2">
                <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex flex-col items-center"
                >
                    <Page 
                        pageNumber={currentPage} 
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        renderInteractiveForms={false}
                        className="shadow-2xl"
                    />
                </Document>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 p-2 bg-gray-900 text-white">
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
