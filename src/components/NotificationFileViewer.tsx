import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { getNotificationFileViewUrl, downloadAndOpenNotificationFile } from '../utils/notificationFileDownload';

interface NotificationFileViewerProps {
    file: {
        key: string;
        name: string;
        fileType: 'image' | 'pdf';
    };
    onClose: () => void;
}

/**
 * Renders every page of a PDF onto stacked <canvas> elements using pdfjs-dist.
 * This does NOT rely on the device/WebView's native PDF support, so it looks
 * and behaves the same on every Android version and on web.
 */
function PdfCanvasViewer({ url }: { url: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const renderTasks: any[] = [];

        (async () => {
            try {
                const pdfjsLib = await import('pdfjs-dist');
                // Vite-friendly worker bundling: resolves to a hashed URL at build time.
                const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                if (cancelled) return;
                setNumPages(pdf.numPages);

                const container = containerRef.current;
                if (!container) return;
                container.innerHTML = '';

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    if (cancelled) return;
                    const page = await pdf.getPage(pageNum);
                    const containerWidth = container.clientWidth || 360;
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = containerWidth / baseViewport.width;
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    canvas.className = 'block mx-auto mb-3 shadow-lg';
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) continue;
                    container.appendChild(canvas);

                    const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
                    renderTasks.push(renderTask);
                    await renderTask.promise;
                }
            } catch (err: any) {
                console.error('[PdfCanvasViewer] Failed to render PDF:', err);
                if (!cancelled) setError(err.message || 'Failed to render PDF');
            }
        })();

        return () => {
            cancelled = true;
            renderTasks.forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
        };
    }, [url]);

    if (error) {
        return (
            <div className="text-center px-6">
                <AlertCircle className="w-8 h-8 text-red-500/60 mx-auto mb-3" />
                <p className="text-sm text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-auto py-3 px-2">
            {numPages === null && (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                </div>
            )}
            <div ref={containerRef} className="w-full max-w-2xl mx-auto" />
        </div>
    );
}

/**
 * Full-screen in-app viewer for notification attachments (image or PDF).
 * Opens directly inside the app — no external browser / gallery / PDF app
 * needed. Images use a plain <img>; PDFs are rendered page-by-page with
 * pdfjs-dist so behavior is identical across every device. A "Save" button
 * is still offered for anyone who explicitly wants a local copy.
 */
export default function NotificationFileViewer({ file, onClose }: NotificationFileViewerProps) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const signedUrl = await getNotificationFileViewUrl(file.key);
                if (!cancelled) setUrl(signedUrl);
            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Failed to load file');
            }
        })();
        return () => { cancelled = true; };
    }, [file.key]);

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await downloadAndOpenNotificationFile(file.key, file.name);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 flex-shrink-0">
                <span className="text-sm text-white truncate flex-1 pr-3">{file.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={saving || !url}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-medium disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Save
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-md bg-white/10 hover:bg-white/20">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto flex items-center justify-center">
                {error ? (
                    <div className="text-center px-6">
                        <AlertCircle className="w-8 h-8 text-red-500/60 mx-auto mb-3" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                ) : !url ? (
                    <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                ) : file.fileType === 'image' ? (
                    <img
                        src={url}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain"
                    />
                ) : (
                    <PdfCanvasViewer url={url} />
                )}
            </div>
        </div>
    );
}
