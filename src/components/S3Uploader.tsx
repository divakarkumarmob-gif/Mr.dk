import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl, authFetch, getAuthHeaders } from '@/utils/api';
import {
  Database,
  Folder,
  FileText,
  ChevronRight,
  Upload,
  X,
  Check,
  History,
  Trash2,
  Loader2,
  RotateCcw,
  StopCircle,
  AlertTriangle,
} from 'lucide-react';

// ---------- Types ----------

interface S3Folder {
  name: string;
  prefix: string;
}

interface S3File {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
}

type UploadStatus = 'uploading' | 'success' | 'failed' | 'cancelled';

interface UploadItem {
  id: string;
  file: File | null; // kept for retry; cleared once finished to save memory
  name: string;
  bucket: string;
  prefix: string;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  timestamp: number;
  xhr?: XMLHttpRequest | null;
}

// What's persisted to localStorage (no File object, no live xhr handle)
interface HistoryItem {
  id: string;
  name: string;
  bucket: string;
  prefix: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  timestamp: number;
}

const HISTORY_KEY = 'nm_s3_upload_history';

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

// Circular progress ring shown next to each in-flight/history item.
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#3b82f6"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.2s ease' }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-blue-300">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

export default function S3Uploader() {
  // Bucket / folder browsing state
  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  // File selection + popup state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showPopup, setShowPopup] = useState(false);

  // Duplicate-name confirmation state (shown after "Next" if any chosen file
  // already exists at the destination).
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[] | null>(null);

  // Active upload + history state
  const [activeUploads, setActiveUploads] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirror of activeUploads so xhr callbacks always see the latest state
  // without needing to be recreated on every render.
  const activeUploadsRef = useRef<UploadItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    fetchBuckets();
  }, []);

  useEffect(() => {
    activeUploadsRef.current = activeUploads;
  }, [activeUploads]);

  const fetchBuckets = async () => {
    setBucketsLoading(true);
    try {
      const res = await authFetch(getApiUrl('/api/s3/buckets'));
      const data = await res.json();
      if (data.success) {
        setBuckets(data.buckets || []);
      } else {
        setBrowseError(data.error || 'Failed to load buckets');
      }
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load buckets');
    } finally {
      setBucketsLoading(false);
    }
  };

  const browse = async (bucket: string, prefix: string) => {
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const res = await authFetch(
        getApiUrl(`/api/s3/browse?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`)
      );
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } else {
        setBrowseError(data.error || 'Failed to browse bucket');
      }
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to browse bucket');
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleSelectBucket = (bucket: string) => {
    setSelectedBucket(bucket);
    setCurrentPrefix('');
    browse(bucket, '');
  };

  const handleOpenFolder = (folder: S3Folder) => {
    if (!selectedBucket) return;
    setCurrentPrefix(folder.prefix);
    browse(selectedBucket, folder.prefix);
  };

  // Breadcrumb navigation: click a segment to jump back to that level.
  const breadcrumbs = currentPrefix
    ? currentPrefix.replace(/\/$/, '').split('/')
    : [];

  const handleBreadcrumbClick = (index: number) => {
    if (!selectedBucket) return;
    const newPrefix = breadcrumbs.slice(0, index + 1).join('/') + '/';
    setCurrentPrefix(newPrefix);
    browse(selectedBucket, newPrefix);
  };

  const handleGoRootBucket = () => {
    if (!selectedBucket) return;
    setCurrentPrefix('');
    browse(selectedBucket, '');
  };

  const handleChangeBucket = () => {
    setSelectedBucket(null);
    setCurrentPrefix('');
    setFolders([]);
    setFiles([]);
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files;
    if (!chosen || chosen.length === 0) return;
    setPendingFiles(Array.from(chosen));
    setShowPopup(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setShowPopup(false);
      return next;
    });
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setPendingFiles([]);
  };

  // "Next" was clicked in the selection popup: check each chosen file against
  // the current folder for existing files with the same name before uploading.
  const handleNext = async () => {
    if (!selectedBucket || pendingFiles.length === 0) return;
    const filesToCheck = pendingFiles;
    setCheckingDuplicates(true);

    try {
      const existsChecks = await Promise.all(
        filesToCheck.map(async (file) => {
          const key = `${currentPrefix}${file.name}`;
          try {
            const res = await authFetch(
              getApiUrl(`/api/s3/exists?bucket=${encodeURIComponent(selectedBucket)}&key=${encodeURIComponent(key)}`)
            );
            const data = await res.json();
            return { name: file.name, exists: !!data.exists };
          } catch {
            // If the check itself fails, don't block the upload on it.
            return { name: file.name, exists: false };
          }
        })
      );

      const dupes = existsChecks.filter(c => c.exists).map(c => c.name);

      setShowPopup(false);
      if (dupes.length > 0) {
        setDuplicateNames(dupes);
        setPendingUploadFiles(filesToCheck);
      } else {
        setPendingFiles([]);
        filesToCheck.forEach(file => uploadOneFile(file, selectedBucket, currentPrefix, false));
      }
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // User confirmed they want to overwrite the duplicate-named files.
  const handleConfirmOverwrite = () => {
    if (!selectedBucket || !pendingUploadFiles) return;
    const filesToUpload = pendingUploadFiles;
    setDuplicateNames([]);
    setPendingUploadFiles(null);
    setPendingFiles([]);
    filesToUpload.forEach(file => {
      const isDupe = duplicateNames.includes(file.name);
      uploadOneFile(file, selectedBucket, currentPrefix, isDupe);
    });
  };

  const handleCancelDuplicatePrompt = () => {
    setDuplicateNames([]);
    setPendingUploadFiles(null);
    setPendingFiles([]);
  };

  const uploadOneFile = (file: File, bucket: string, prefix: string, overwrite: boolean, existingId?: string) => {
    const id = existingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: UploadItem = {
      id,
      file,
      name: file.name,
      bucket,
      prefix,
      status: 'uploading',
      progress: 0,
      timestamp: Date.now(),
      xhr: null,
    };
    setActiveUploads(prev => [item, ...prev.filter(u => u.id !== id)]);

    const formData = new FormData();
    formData.append('bucket', bucket);
    formData.append('prefix', prefix);
    if (overwrite) formData.append('overwrite', 'true');
    formData.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', getApiUrl('/api/s3/upload'));

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = (evt.loaded / evt.total) * 100;
        setActiveUploads(prev =>
          prev.map(u => (u.id === id ? { ...u, progress: pct } : u))
        );
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
      }
      finalizeUpload(id, success ? 'success' : 'failed', errorMsg);
    };

    xhr.onerror = () => {
      finalizeUpload(id, 'failed', 'Network error during upload');
    };

    xhr.onabort = () => {
      finalizeUpload(id, 'cancelled', 'Cancelled');
    };

    // Track the live xhr so the Cancel button can abort it.
    setActiveUploads(prev => prev.map(u => (u.id === id ? { ...u, xhr } : u)));

    getAuthHeaders().then(headers => {
      Object.entries(headers).forEach(([k, v]) => {
        xhr.setRequestHeader(k, v as string);
      });
      xhr.send(formData);
    }).catch(() => {
      xhr.send(formData);
    });
  };

  // Files kept in memory (not localStorage) so "Retry" can re-send them
  // without asking the user to re-pick the file. Lost on page refresh,
  // in which case Retry will prompt to re-select the file instead.
  const retryFilesRef = useRef<Record<string, File>>({});

  const finalizeUpload = (id: string, status: UploadStatus, error?: string) => {
    const finished = activeUploadsRef.current.find(u => u.id === id);
    setActiveUploads(prev => prev.filter(u => u.id !== id));
    setHistory(prev => {
      const base: HistoryItem = finished
        ? { id: finished.id, name: finished.name, bucket: finished.bucket, prefix: finished.prefix, status: finished.status, progress: finished.progress, timestamp: finished.timestamp }
        : { id, name: 'Unknown file', bucket: selectedBucket || '', prefix: currentPrefix, status: 'failed', progress: 0, timestamp: Date.now() };
      const entry: HistoryItem = {
        ...base,
        status,
        progress: status === 'success' ? 100 : base.progress,
        error,
        timestamp: Date.now(),
      };
      const next = [entry, ...prev.filter(h => h.id !== id)];
      saveHistory(next);
      return next;
    });
    // Keep the File reference around briefly for retry-from-history support.
    if (finished?.file) {
      retryFilesRef.current[id] = finished.file;
    }
  };

  const handleCancelUpload = (id: string) => {
    const item = activeUploadsRef.current.find(u => u.id === id);
    if (item?.xhr) {
      item.xhr.abort();
    }
  };

  const handleRetry = (item: HistoryItem) => {
    const file = retryFilesRef.current[item.id];
    if (!file) {
      setBrowseError('Original file is no longer available in memory. Please re-select and upload it again.');
      return;
    }
    // Remove the old failed entry from history and re-upload with a fresh id.
    setHistory(prev => {
      const next = prev.filter(h => h.id !== item.id);
      saveHistory(next);
      return next;
    });
    uploadOneFile(file, item.bucket, item.prefix, true);
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
    retryFilesRef.current = {};
  };

  return (
    <div className="bg-[#161e38] p-4 rounded-xl border border-white/5 mt-4">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        <Database className="w-5 h-5 text-purple-400" />
        Upload to AWS S3
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Select a bucket, navigate to a folder, then upload any photo, video, or PDF directly.
      </p>

      {/* Bucket selection */}
      {!selectedBucket ? (
        <div>
          {bucketsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading buckets...
            </div>
          ) : buckets.length === 0 ? (
            <p className="text-sm text-red-400">{browseError || 'No buckets found.'}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {buckets.map(bucket => (
                <button
                  key={bucket}
                  onClick={() => handleSelectBucket(bucket)}
                  className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 px-4 py-3 rounded-xl hover:bg-white/10 text-sm font-medium transition-all text-left"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    {bucket}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Breadcrumb / navigation header */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
              <button onClick={handleChangeBucket} className="text-blue-400 hover:underline font-medium">
                {selectedBucket}
              </button>
              {currentPrefix && (
                <button onClick={handleGoRootBucket} className="hover:underline">
                  / root
                </button>
              )}
              {breadcrumbs.map((seg, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="w-3 h-3" />
                  <button onClick={() => handleBreadcrumbClick(i)} className="hover:underline">
                    {seg}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <button
              onClick={handleChangeBucket}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              Change bucket
            </button>
          </div>

          {/* Folder / file explorer */}
          <div className="bg-[#0a0f24] rounded-lg border border-white/10 mb-4 max-h-64 overflow-y-auto">
            {browseLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 p-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : browseError ? (
              <p className="text-sm text-red-400 p-3">{browseError}</p>
            ) : folders.length === 0 && files.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">This folder is empty.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {folders.map(folder => (
                  <button
                    key={folder.prefix}
                    onClick={() => handleOpenFolder(folder)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Folder className="w-4 h-4 text-yellow-400" />
                      {folder.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                ))}
                {files.map(file => (
                  <div
                    key={file.key}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-gray-300"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(file.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload box - uploads into whatever folder the user is currently in */}
          <div className="bg-[#0a0f24] p-3 rounded-lg border border-white/10 mb-2">
            <p className="text-xs text-gray-400 mb-2">
              Uploading into: <span className="text-white font-medium">{selectedBucket}/{currentPrefix || ''}</span>
            </p>
            <label className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-4 py-3 rounded-xl cursor-pointer transition-all">
              <Upload className="h-4 w-4" />
              Upload Photo / Video / PDF
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,application/pdf"
                multiple
                className="hidden"
                onChange={handleFilesChosen}
              />
            </label>
          </div>
        </div>
      )}

      {/* Selection confirmation popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161e38] border border-white/10 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h4 className="font-bold text-sm">Files to upload ({pendingFiles.length})</h4>
              <button onClick={handleClosePopup} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                    <button onClick={() => handleRemovePending(i)} className="text-gray-500 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleNext}
                disabled={checkingDuplicates}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {checkingDuplicates ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking...
                  </>
                ) : (
                  'Next'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate-name warning popup */}
      {duplicateNames.length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161e38] border border-yellow-500/30 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h4 className="font-bold text-sm flex items-center gap-2 text-yellow-400">
                <AlertTriangle className="w-4 h-4" /> Duplicate file name{duplicateNames.length > 1 ? 's' : ''}
              </h4>
              <button onClick={handleCancelDuplicatePrompt} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-gray-400 mb-3">
                A file with the same name already exists in this folder. Uploading will overwrite it:
              </p>
              <div className="flex flex-col gap-2">
                {duplicateNames.map(name => (
                  <div key={name} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-sm text-yellow-200 truncate">
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex gap-2">
              <button
                onClick={handleCancelDuplicatePrompt}
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 font-bold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverwrite}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 font-bold py-3 rounded-xl transition-all"
              >
                Overwrite & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading + history list: newest first, active uploads on top */}
      {(activeUploads.length > 0 || history.length > 0) && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Upload History
            </h4>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {activeUploads.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-[#0a0f24] p-2.5 rounded-lg border border-white/5">
                <span className="text-sm truncate">{item.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleCancelUpload(item.id)}
                    title="Cancel upload"
                    className="text-gray-500 hover:text-red-400"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                  <ProgressRing status={item.status} progress={item.progress} />
                </div>
              </div>
            ))}
            {history.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-[#0a0f24] p-2.5 rounded-lg border border-white/5">
                <div className="truncate">
                  <p className="text-sm truncate">{item.name}</p>
                  {item.error && <p className="text-[10px] text-red-400 truncate">{item.error}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(item.status === 'failed' || item.status === 'cancelled') && (
                    <button
                      onClick={() => handleRetry(item)}
                      title="Retry upload"
                      className="text-gray-500 hover:text-blue-400"
                    >
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
