import React, { useEffect, useState } from 'react';
import { X, Download, Loader2, AlertCircle } from 'lucide-react';
import { getNotificationFileViewUrl, downloadAndOpenNotificationFile } from '../utils/notificationFileDownload';
import { getPdfViewerUrl } from '../utils/api';
import { fetchAndCachePdf } from '../lib/pdfCache';
import AdvancedPDFViewer from './AdvancedPDFViewer';

interface NotificationFileViewerProps {
    file: {
        key: string;
        name: string;
        fileType: 'image' | 'pdf';
    };
    onClose: () => void;
}

/**
 * Full-screen in-app viewer for notification attachments (image or PDF).
 * Opens directly inside the app — no external browser / gallery / PDF app
 * needed.
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
                if (!cancelled) {
                    if (file.fileType === 'pdf') {
                        try {
                            const proxyUrl = await getPdfViewerUrl(signedUrl);
                            if (!cancelled) setUrl(proxyUrl);
                            const cleanName = `${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
                            fetchAndCachePdf(proxyUrl, cleanName).catch(() => {});
                        } catch (proxyErr) {
                            console.warn('[NotificationFileViewer] Proxy fetch warning, fallback to signedUrl:', proxyErr);
                            if (!cancelled) setUrl(signedUrl);
                        }
                    } else {
                        setUrl(signedUrl);
                    }
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Failed to load file');
            }
        })();
        return () => { cancelled = true; };
    }, [file.key, file.name, file.fileType]);

    // PDFs get their own full viewer (header, zoom controls, save button
    // included) — just hand off to it once we have the signed URL.
    if (file.fileType === 'pdf') {
        if (error) {
            return (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center safe-pt safe-bottom">
                    <div className="text-center px-6">
                        <AlertCircle className="w-8 h-8 text-red-500/60 mx-auto mb-3" />
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-white/10 rounded-md text-white text-sm">Close</button>
                    </div>
                </div>
            );
        }
        if (!url) {
            return (
                <div className="fixed inset-0 z-50 bg-black flex items-center justify-center safe-pt safe-bottom">
                    <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                </div>
            );
        }
        return <AdvancedPDFViewer pdfUrl={url} title={file.name} onClose={onClose} />;
    }

    // Image viewer
    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await downloadAndOpenNotificationFile(file.key, file.name, 'image');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header — safe-pt keeps this clear of the status bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10 flex-shrink-0 safe-pt">
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
            <div className="flex-1 overflow-auto flex items-center justify-center safe-bottom">
                {error ? (
                    <div className="text-center px-6">
                        <AlertCircle className="w-8 h-8 text-red-500/60 mx-auto mb-3" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                ) : !url ? (
                    <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
                ) : (
                    <img
                        src={url}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain"
                    />
                )}
            </div>
        </div>
    );
}
