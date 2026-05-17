
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Download, X } from 'lucide-react';
import { motion } from 'motion/react';
// Configure the worker to use the CDN matching the react-pdf version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;



export default function AdvancedPDFViewer({ pdfUrl, title, onClose }: { pdfUrl: string, title: string, onClose: () => void }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [scale, setScale] = useState(1.0);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-white z-[600] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700 shadow-sm z-10 text-white">
                <h2 className="text-sm font-bold truncate mr-2">{title}</h2>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomIn className="h-5 w-5" /></button>
                    <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><ZoomOut className="h-5 w-5" /></button>
                    <button onClick={() => window.open(pdfUrl, '_blank')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full"><Download className="h-5 w-5" /></button>
                    <button onClick={onClose} className="p-2 bg-red-900 hover:bg-red-800 rounded-full transition"><X className="h-5 w-5" /></button>
                </div>
            </div>
            
            {/* PDF Viewport */}
            <div className="flex-grow overflow-auto bg-gray-600 flex justify-center p-2">
                <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex flex-col items-center gap-2"
                >
                    {Array.from(new Array(numPages), (_, index) => (
                        <Page 
                            key={`page_${index + 1}`} 
                            pageNumber={index + 1} 
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="shadow-2xl"
                        />
                    ))}
                </Document>
            </div>
        </motion.div>
    );
}
