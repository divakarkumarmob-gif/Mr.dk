import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getApiUrl } from '@/utils/api';
import { showToast } from '../utils/toast';
import {
  Bell,
  Upload,
  X,
  Check,
  History,
  Trash2,
  Loader2,
  RotateCcw,
  StopCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

// ---------- Types ----------

type UploadStatus = 'uploading' | 'success' | 'failed' | 'cancelled';

interface UploadItem {
  id: string;
  file: File | null;
  name: string;
  fileType: 'image' | 'pdf';
  status: UploadStatus;
  progress: number; // 0-100
  key?: string;
  error?: string;
  timestamp: number;
  xhr?: XMLHttpRequest | null;
}

// Persisted history (no live File/xhr handles)
interface HistoryItem {
  id: string;
  name: string;
  fileType: 'image' | 'pdf';
  status: UploadStatus;
  progress: number;
  error?: string;
  timestamp: number;
}

const HISTORY_KEY = 'nm_notification_upload_history';

// ---------- Helpers ----------

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function detectType(file: File): 'image' | 'pdf' {
  return file.type.startsWith('image/') ? 'image' : 'pdf';
}

// Circular progress ring — matches the Import tab's uploader for consistency.
function ProgressRing({ status, progress }: { status: UploadStatus; progress: number }) {
  const size = 36;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  if (status === 'success') {
    return (
      <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 text-green-400" />
      </div>
    );
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center flex-shrink-0">
        <X className="w-4 h-4 text-red-400" />
      </div>
    );
  }

  return (
    <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f97316"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.2s ease' }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-orange-300">{Math.round(progress)}%</span>
    </div>
  );
}

export default function NotificationUploader() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  const [activeUploads, setActiveUploads] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sendingNotification, setSendingNotification] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef<UploadItem[]>([]);
  // Tracks which batch each active upload belongs to, so we know when a whole
  // batch has finished and can create the single Firestore notification.
  const batchRef = useRef<{ id: string; title: string; comment: string; total: number; remaining: Set<string>; succeeded: { key: string; name: string; fileType: 'image' | 'pdf'; size: number }[] } | null>(null);
  const retryFilesRef = useRef<Record<string, File>>({});

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files;
    if (!chosen || chosen.length === 0) return;
    setPendingFiles(prev => [...prev, ...Array.from(chosen)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const finalizeUpload = (id: string, status: UploadStatus, error?: string) => {
    const finished = activeUploadsRef.current.find(u => u.id === id);
    setActiveUploads(prev => prev.filter(u => u.id !== id));
    setHistory(prev => {
      const base: HistoryItem = finished
        ? { id: finished.id, name: finished.name, fileType: finished.fileType, status: finished.status, progress: finished.progress, timestamp: finished.timestamp }
        : { id, name: 'Unknown file', fileType: 'pdf', status: 'failed', progress: 0, timestamp: Date.now() };
      const entry: HistoryItem = { ...base, status, progress: status === 'success' ? 100 : base.progress, error, timestamp: Date.now() };
      const next = [entry, ...prev.filter(h => h.id !== id)];
      saveHistory(next);
      return next;
    });
    if (finished?.file) retryFilesRef.current[id] = finished.file;

    // Batch bookkeeping: once every file in this batch has settled, create
    // the single bell notification (only for the files that succeeded).
    const batch = batchRef.current;
    if (batch && batch.remaining.has(id)) {
      batch.remaining.delete(id);
      if (status === 'success' && finished?.key) {
        batch.succeeded.push({ key: finished.key, name: finished.name, fileType: finished.fileType, size: finished.file?.size || 0 });
      }
      if (batch.remaining.size === 0) {
        finalizeBatch(batch);
        batchRef.current = null;
      }
    }
  };

  const finalizeBatch = async (batch: { title: string; comment: string; total: number; succeeded: { key: string; name: string; fileType: 'image' | 'pdf'; size: number }[] }) => {
    if (batch.succeeded.length === 0) {
      showToast('All files failed to upload — notification not sent');
      return;
    }
    setSendingNotification(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: batch.title || null,
        message: batch.comment || '',
        files: batch.succeeded,
        timestamp: serverTimestamp(),
        readBy: [],
      });

      const notifRes = await fetch(getApiUrl('/api/send-notification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: batch.title || 'New Notification', message: batch.comment || 'New file uploaded' }),
      });
      if (!notifRes.ok) {
        const d = await notifRes.json().catch(() => ({}));
        showToast(`Files uploaded, but push notification failed: ${d.error || notifRes.status}`);
      } else {
        showToast(batch.succeeded.length < batch.total ? 'Notification sent (some files failed)' : 'Notification sent!');
      }
    } catch (error) {
      console.error('Failed to create notification doc:', error);
      showToast('Files uploaded, but failed to create notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const uploadOneFile = (file: File, existingId?: string): string => {
    const id = existingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fileType = detectType(file);
    const item: UploadItem = {
      id, file, name: file.name, fileType, status: 'uploading', progress: 0, timestamp: Date.now(), xhr: null,
    };
    setActiveUploads(prev => [item, ...prev.filter(u => u.id !== id)]);

    const formData = new FormData();
    formData.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', getApiUrl('/api/notifications/upload'));

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = (evt.loaded / evt.total) * 100;
        setActiveUploads(prev => prev.map(u => (u.id === id ? { ...u, progress: pct } : u)));
      }
    };

    xhr.onload = () => {
      let success = xhr.status >= 200 && xhr.status < 300;
      let errorMsg: string | undefined;
      let key: string | undefined;
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.results && data.results[0]) {
          success = !!data.results[0].success;
          errorMsg = data.results[0].error;
          key = data.results[0].key;
        } else if (!data.success) {
          success = false;
          errorMsg = data.error;
        }
      } catch {
        success = xhr.status >= 200 && xhr.status < 300;
      }
      if (success && key) {
        setActiveUploads(prev => prev.map(u => (u.id === id ? { ...u, key } : u)));
        activeUploadsRef.current = activeUploadsRef.current.map(u => (u.id === id ? { ...u, key } : u));
      }
      finalizeUpload(id, success ? 'success' : 'failed', errorMsg);
    };

    xhr.onerror = () => finalizeUpload(id, 'failed', 'Network error during upload');
    xhr.onabort = () => finalizeUpload(id, 'cancelled', 'Cancelled');

    setActiveUploads(prev => prev.map(u => (u.id === id ? { ...u, xhr } : u)));
    xhr.send(formData);
    return id;
  };

  const handleUpload = () => {
    if (pendingFiles.length === 0) return;
    const filesToUpload = pendingFiles;
    const batchTitle = title.trim();
    const batchComment = comment.trim();

    setPendingFiles([]);
    setTitle('');
    setComment('');

    const ids = filesToUpload.map(file => uploadOneFile(file));
    batchRef.current = { id: `${Date.now()}`, title: batchTitle, comment: batchComment, total: ids.length, remaining: new Set(ids), succeeded: [] };
  };

  const handleCancelUpload = (id: string) => {
    const item = activeUploadsRef.current.find(u => u.id === id);
    if (item?.xhr) item.xhr.abort();
  };

  const handleRetry = (item: HistoryItem) => {
    const file = retryFilesRef.current[item.id];
    if (!file) {
      showToast('Original file no longer available — please re-select and upload again.');
      return;
    }
    setHistory(prev => {
      const next = prev.filter(h => h.id !== item.id);
      saveHistory(next);
      return next;
    });
    // Standalone retry: sends its own notification once done.
    const id = uploadOneFile(file, undefined);
    batchRef.current = { id: `${Date.now()}`, title: '', comment: '', total: 1, remaining: new Set([id]), succeeded: [] };
  };

  const handleClearHistory = () => {
    // Only clears this local upload-progress list — does NOT touch the
    // notifications already sent to users' bell.
    setHistory([]);
    saveHistory([]);
    retryFilesRef.current = {};
  };

  return (
    <div className="bg-[#161e38] p-4 rounded-xl border border-white/5 mt-4">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        <Bell className="w-5 h-5 text-orange-400" />
        Upload &amp; Notify
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Photo ya PDF upload karo — ye seedha users ke notification bell me chala jayega, download &amp; view ke liye.
      </p>

      {/* File picker */}
      <label className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 font-bold px-4 py-3 rounded-xl cursor-pointer transition-all mb-3">
        <Upload className="h-4 w-4" />
        Choose Photo / PDF
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFilesChosen}
        />
      </label>

      {pendingFiles.length > 0 && (
        <div className="bg-[#0a0f24] rounded-xl border border-white/10 p-3 mb-3 space-y-3">
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
            {pendingFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  {detectType(file) === 'image' ? <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" /> : <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  <span className="truncate">{file.name}</span>
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                  <button onClick={() => handleRemovePending(i)} className="text-gray-500 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name (shown as notification title)"
            className="w-full bg-white/5 p-2.5 rounded-lg border border-white/10 focus:border-orange-500/50 focus:outline-none text-sm placeholder:text-gray-500"
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (about this file, shown below the title)"
            rows={3}
            className="w-full bg-white/5 p-2.5 rounded-lg border border-white/10 focus:border-orange-500/50 focus:outline-none resize-none text-sm placeholder:text-gray-500"
          />

          <button
            onClick={handleUpload}
            disabled={sendingNotification}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 font-bold py-3 rounded-xl transition-all"
          >
            <Upload className="h-4 w-4" />
            Upload {pendingFiles.length > 1 ? `(${pendingFiles.length} files)` : ''}
          </button>
        </div>
      )}

      {sendingNotification && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating notification...
        </div>
      )}

      {/* Uploading + history: newest first, active uploads on top */}
      {(activeUploads.length > 0 || history.length > 0) && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Upload History
            </h4>
            {history.length > 0 && (
              <button onClick={handleClearHistory} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {activeUploads.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-[#0a0f24] p-2.5 rounded-lg border border-white/5">
                <span className="text-sm truncate flex items-center gap-2">
                  {item.fileType === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  {item.name}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleCancelUpload(item.id)} title="Cancel upload" className="text-gray-500 hover:text-red-400">
                    <StopCircle className="w-4 h-4" />
                  </button>
                  <ProgressRing status={item.status} progress={item.progress} />
                </div>
              </div>
            ))}
            {history.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-[#0a0f24] p-2.5 rounded-lg border border-white/5">
                <div className="truncate">
                  <p className="text-sm truncate flex items-center gap-2">
                    {item.fileType === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    {item.name}
                  </p>
                  {item.error && <p className="text-[10px] text-red-400 truncate">{item.error}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(item.status === 'failed' || item.status === 'cancelled') && (
                    <button onClick={() => handleRetry(item)} title="Retry upload" className="text-gray-500 hover:text-blue-400">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <ProgressRing status={item.status} progress={item.progress} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
