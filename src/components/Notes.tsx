import React, { useState, useEffect } from 'react';
import { 
  Plus, Camera, FileUp, X, BookOpen, Download, 
  ArrowLeft, FileText, Loader2, Trash2, Image as ImageIcon, 
  AlertTriangle, Eye, CheckCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import Pressable from './Pressable';

interface SelectedFile {
  id: string;
  file: File;
  type: 'image' | 'pdf';
  previewUrl: string;
}

interface UploadedFile {
  url: string;
  name: string;
  type: 'image' | 'pdf';
}

interface NoteDocument {
  id: string;
  name: string;
  files?: UploadedFile[];
  url?: string;
  type?: 'image' | 'pdf';
  createdAt: any;
}

export default function Notes({ onNavigate }: { onNavigate: (view: any) => void }) {
  // Navigation View: main (Important Notes), uploads (My Private Uploads page), view_note (Detail note viewer)
  const [view, setView] = useState<'main' | 'uploads' | 'view_note'>('main');
  
  // Notes List from Firestore
  const [uploadedNotes, setUploadedNotes] = useState<NoteDocument[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteDocument | null>(null);

  // Popup States
  const [isPopup1Open, setIsPopup1Open] = useState(false);
  const [isPopup2Open, setIsPopup2Open] = useState(false);
  const [name, setName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [showAddOptions, setShowAddOptions] = useState(false);
  
  // Warning & Error Messages
  const [warningMessage, setWarningMessage] = useState('');

  // Expanded zoom preview URLs
  const [expandedPreviewUrl, setExpandedPreviewUrl] = useState<string | null>(null);
  const [expandedUploadedUrl, setExpandedUploadedUrl] = useState<string | null>(null);

  // Upload progress states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Realtime load notes from Firestore (Scoped strictly to Current User for private access)
  useEffect(() => {
    if (!auth.currentUser || view !== 'uploads') return;
    
    const notesRef = collection(db, 'users', auth.currentUser.uid, 'notes');
    const q = query(notesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: NoteDocument[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name || '',
          files: data.files || [],
          url: data.url || '',
          type: data.type || 'image',
          createdAt: data.createdAt,
        });
      });
      setUploadedNotes(items);
    }, (error) => {
      console.error("Failed to fetch user notes:", error);
    });

    return () => unsubscribe();
  }, [view]);

  // Clean up Object URLs to prevent memory leaks
  const clearSelectedFiles = () => {
    selectedFiles.forEach(f => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setSelectedFiles([]);
  };

  const handleDownloadFile = (url: string, filename: string) => {
    if ((window as any).Capacitor) {
      if (url.startsWith('data:')) {
        const w = window.open();
        if (w) {
          w.document.write(`<iframe src="${url}" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        } else {
          alert("Please allow popups to view this document.");
        }
        return;
      }
      window.open(url, '_system');
      return;
    }

    // Standard web download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Select file in Popup 1
  const handlePopup1FileSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf') => {
    const files = e.target.files;
    if (!files) return;

    const newSelected: SelectedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const previewUrl = fileType === 'image' ? URL.createObjectURL(f) : '';
      newSelected.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        type: fileType,
        previewUrl,
      });
    }

    setSelectedFiles(prev => [...prev, ...newSelected]);
    e.target.value = ''; // reset value to allow picking the same file again
  };

  // Add more files in Popup 2 (+ button)
  const handlePopupAddSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf') => {
    const files = e.target.files;
    if (!files) return;

    const newSelected: SelectedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const previewUrl = fileType === 'image' ? URL.createObjectURL(f) : '';
      newSelected.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        type: fileType,
        previewUrl,
      });
    }

    setSelectedFiles(prev => [...prev, ...newSelected]);
    setShowAddOptions(false);
    e.target.value = '';
  };

  const removeSelectedFile = (id: string) => {
    const fileToRemove = selectedFiles.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Multi-upload Process to Firebase Storage and Firestore
  const handleMultiUpload = async () => {
    if (!name.trim()) {
      setWarningMessage('⚠️ Please write name');
      return;
    }
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to upload');
      return;
    }
    if (!auth.currentUser) {
      alert('Please sign in to upload files');
      return;
    }

    setWarningMessage('');
    setUploadError(null);
    setIsPopup2Open(false);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadingName(name);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const sf = selectedFiles[i];
        let fileToUpload: File = sf.file;

        // Compress image to save bandwidth and storage limit
        if (sf.type === 'image') {
          try {
            // Disable Web Worker to ensure seamless operation in sandboxed iframes
            // Compress heavily (max 150KB) so Base64 backup fits comfortably in Firestore's 1MB limit
            const options = { maxSizeMB: 0.15, maxWidthOrHeight: 800, useWebWorker: false };
            fileToUpload = await imageCompression(sf.file, options);
          } catch (compressErr) {
            console.error('Image compression failed, using original:', compressErr);
          }
        } else if (sf.type === 'pdf') {
          // If PDF is larger than 600KB, warn the user to protect Firestore document bounds
          if (sf.file.size > 600 * 1024) {
            throw new Error(`PDF file "${sf.file.name}" is too large (${Math.round(sf.file.size / 1024)}KB). Please upload a smaller PDF (max 600KB) for secure local persistence.`);
          }
        }

        const uniqueId = Math.random().toString(36).substring(2, 9);
        const fileNameClean = sf.file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storagePath = `users/${auth.currentUser.uid}/notes/${Date.now()}_${uniqueId}_${fileNameClean}`;
        const storageRef = ref(storage, storagePath);

        let downloadUrl = '';

        try {
          // Attempt Firebase Storage Upload with a 2.5-second timeout fallback
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

          downloadUrl = await new Promise<string>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              uploadTask.cancel();
              reject(new Error('Firebase Storage timeout. Falling back to secure local document database...'));
            }, 2500);

            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const fileProgress = snapshot.totalBytes > 0 
                  ? (snapshot.bytesTransferred / snapshot.totalBytes) 
                  : 0;
                // Calculate global progress across all selected files
                const baseProgress = (i / selectedFiles.length) * 100;
                const fileWeight = 100 / selectedFiles.length;
                const currentProgress = Math.round(baseProgress + (fileProgress * fileWeight));
                setUploadProgress(currentProgress);
              },
              (error) => {
                clearTimeout(timeoutId);
                reject(error);
              },
              async () => {
                clearTimeout(timeoutId);
                try {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(url);
                } catch (urlErr) {
                  reject(urlErr);
                }
              }
            );
          });
          console.log('Successfully uploaded file via standard Storage Bucket.');
        } catch (storageErr) {
          console.warn('Storage upload bypassed or timed out, falling back to secure local document database (Base64 format):', storageErr);
          // Convert file directly to Base64 to bypass all storage bucket / CORS / provisioning blocks
          downloadUrl = await convertToBase64(fileToUpload);
        }

        uploadedFiles.push({
          url: downloadUrl,
          name: sf.file.name,
          type: sf.type
        });

        // Set live progress ratio for the completed file
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      }

      // Save note info under private user subcollection
      const notesRef = collection(db, 'users', auth.currentUser.uid, 'notes');
      await addDoc(notesRef, {
        name,
        files: uploadedFiles,
        url: uploadedFiles[0]?.url || '',
        type: uploadedFiles[0]?.type || 'image',
        createdAt: new Date(),
      });

      // Clear state variables on success
      clearSelectedFiles();
      setName('');
    } catch (err) {
      console.error('Upload Failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setUploadError(errMsg);
      try {
        alert('Upload failed: ' + errMsg);
      } catch (e) {}
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingName('');
    }
  };

  // Delete an Uploaded Note
  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    if (confirm("Are you sure you want to delete this note? This action cannot be undone.")) {
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid, 'notes', noteId);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Failed to delete note:", err);
        alert("Failed to delete note.");
      }
    }
  };

  return (
    <div id="notes-root" className="min-h-screen text-slate-100 pb-24 px-0">
      <AnimatePresence mode="wait">
        
        {/* VIEW 1: Main View (Important Notes Dashboard) */}
        {view === 'main' && (
          <motion.div 
            key="main-view"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <h1 className="text-2xl font-bold mb-6 text-slate-100 flex items-center gap-2">
              <BookOpen className="text-orange-500 h-6 w-6" /> Important Notes
            </h1>
            
            {/* Main "Upload & My Private Notes" Button */}
            <button 
              id="upload-my-private-notes-btn"
              onClick={() => setView('uploads')}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.98] rounded-xl p-3.5 flex items-center justify-center gap-2 text-white shadow-lg shadow-orange-500/10 transition-all text-sm font-extrabold mb-5"
            >
              <FileUp className="h-5 w-5" /> Upload & My Private Notes
            </button>

            {/* Other hub navigations */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Pressable 
                onClick={() => onNavigate('ncertHub')} 
                className="bg-green-600 text-white p-3 rounded-2xl flex flex-col items-start gap-2 cursor-pointer shadow-lg active:scale-95 transition-transform"
              >
                <div className="bg-white/20 p-2 rounded-xl"><BookOpen className="h-5 w-5 text-white"/></div>
                <div>
                  <p className="font-bold text-sm">NCERT 📚</p>
                  <p className="text-[10px] opacity-80 leading-tight">Digital Textbooks Hub</p>
                </div>
              </Pressable>

              <Pressable 
                onClick={() => onNavigate('ntaQuestionsHub')} 
                className="bg-blue-600 text-white p-3 rounded-2xl flex flex-col items-start gap-2 cursor-pointer shadow-lg active:scale-95 transition-transform"
              >
                <div className="bg-white/20 p-2 rounded-xl"><FileUp className="h-5 w-5 text-white"/></div>
                <div>
                  <p className="font-bold text-sm">Question Bank 📚</p>
                  <p className="text-[10px] opacity-80 leading-tight">Official NTA PDFs Hub</p>
                </div>
              </Pressable>

              <Pressable 
                onClick={() => onNavigate('oldPyqHistory')} 
                className="bg-slate-800 text-white p-3 rounded-2xl flex flex-col items-start gap-2 cursor-pointer shadow-lg active:scale-95 transition-transform border border-white/10 hover:border-orange-500/50"
              >
                <div className="bg-orange-600 p-2 rounded-xl"><Download className="h-4 w-4 text-white"/></div>
                <div>
                  <p className="font-bold text-sm">Legacy PYQs 📜</p>
                </div>
              </Pressable>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: Sub-page of Private Notes listing */}
        {view === 'uploads' && (
          <motion.div 
            key="uploads-view"
            initial={{ opacity: 0, x: 30 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -30 }}
            className="w-full"
          >
            {/* Header with back navigation */}
            <div className="flex items-center gap-3 mb-5">
              <button 
                onClick={() => setView('main')} 
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-extrabold text-white">My Private Uploads</h1>
            </div>

            {/* Horizontal Thin (+) Button as specified by user */}
            <button 
              id="thin-add-note-btn"
              onClick={() => {
                clearSelectedFiles();
                setIsPopup1Open(true);
              }}
              className="w-full h-11 border border-dashed border-slate-700 hover:border-blue-500/80 rounded-xl bg-slate-800/10 hover:bg-blue-500/5 flex items-center justify-center text-slate-400 hover:text-blue-400 transition-all mb-4 shadow-sm"
              title="Add photo or PDF note"
            >
              <Plus className="h-5 w-5 font-light" />
            </button>

            {/* Live Progress Bar Line */}
            {isUploading && (
              <div id="upload-progress-line" className="mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md animate-pulse">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                    Uploading: {uploadingName}
                  </span>
                  <span className="font-mono font-bold text-blue-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Live Error Banner */}
            {uploadError && (
              <div id="upload-error-banner" className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 shadow-md flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5 animate-bounce" />
                <div className="text-xs">
                  <p className="font-bold text-red-400">Upload Failed</p>
                  <p className="text-slate-300 mt-1 font-mono break-all">{uploadError}</p>
                </div>
              </div>
            )}

            {/* Private Gallery list */}
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> My Documents ({uploadedNotes.length})
            </h2>

            {uploadedNotes.length === 0 ? (
              <div className="bg-[#1e293b]/30 rounded-2xl border border-slate-800 p-8 text-center text-slate-500 mt-2">
                <FileText className="h-10 w-10 mx-auto text-slate-600 mb-2.5" />
                <p className="text-xs font-semibold">No uploads found.</p>
                <p className="text-[10px] text-slate-600 mt-1">Tap the plus (+) button above to safely upload your first note.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {uploadedNotes.map((note) => {
                  const hasFiles = note.files && note.files.length > 0;
                  const firstFile = hasFiles ? note.files![0] : null;
                  const isImage = firstFile ? firstFile.type === 'image' : (note.type !== 'pdf');

                  return (
                    <div 
                      key={note.id}
                      onClick={() => {
                        setSelectedNote(note);
                        setView('view_note');
                      }}
                      className="bg-[#111827]/90 border border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700/80 transition-all flex flex-col group relative shadow-md"
                    >
                      {/* Delete button (Trash icon) */}
                      <button 
                        onClick={(e) => handleDeleteNote(note.id, e)}
                        className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-red-950 p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Card Thumbnail */}
                      <div className="h-28 w-full bg-slate-900 flex items-center justify-center overflow-hidden border-b border-slate-850 relative">
                        {isImage && (firstFile?.url || note.url) ? (
                          <img 
                            src={firstFile?.url || note.url} 
                            alt={note.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-rose-400/90">
                            <FileText className="h-8 w-8 text-rose-500" />
                            <span className="text-[9px] uppercase font-extrabold tracking-wider bg-rose-500/10 px-1.5 py-0.5 rounded-md">PDF Note</span>
                          </div>
                        )}
                        
                        {/* Multiple files indicator badge */}
                        {hasFiles && note.files!.length > 1 && (
                          <span className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-sm text-[8px] font-extrabold px-1.5 py-0.5 rounded text-slate-300">
                            +{note.files!.length - 1} items
                          </span>
                        )}
                      </div>

                      {/* Card Name Info (Upar photo/pdf niche name) */}
                      <div className="p-2 flex-grow flex flex-col justify-between">
                        <h3 className="font-bold text-xs text-slate-200 line-clamp-1 group-hover:text-white transition-colors">
                          {note.name}
                        </h3>
                        <p className="text-[8px] text-slate-500 mt-1 font-mono">
                          {note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 3: Detailed note sub-page (Only creator can view) */}
        {view === 'view_note' && selectedNote && (
          <motion.div 
            key="view-note"
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.98 }}
            className="w-full"
          >
            <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-3">
              <button 
                onClick={() => {
                  setSelectedNote(null);
                  setView('uploads');
                }} 
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="truncate">
                <h1 className="text-lg font-extrabold text-white truncate">{selectedNote.name}</h1>
                <p className="text-[9px] text-slate-500 font-mono">
                  {selectedNote.createdAt?.seconds ? new Date(selectedNote.createdAt.seconds * 1000).toLocaleString() : 'Recently saved'}
                </p>
              </div>
            </div>

            {/* Document media renderer list */}
            <div className="space-y-4">
              {selectedNote.files && selectedNote.files.length > 0 ? (
                selectedNote.files.map((file, idx) => {
                  if (file.type === 'pdf') {
                    return (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-850">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-5 w-5 text-rose-500 flex-shrink-0" />
                            <span className="text-xs font-bold text-slate-200 truncate">{file.name}</span>
                          </div>
                          <button 
                            onClick={() => handleDownloadFile(file.url, file.name)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            <Download className="h-3 w-3" /> Get
                          </button>
                        </div>
                        <div className="w-full h-[380px] bg-slate-950 relative">
                          {file.url.startsWith('data:') ? (
                            <iframe 
                              src={file.url}
                              className="w-full h-full rounded-b-2xl border-none"
                              title={file.name}
                            />
                          ) : (
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`}
                              className="w-full h-full rounded-b-2xl border-none"
                              title={file.name}
                            />
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-2.5">
                        <div className="text-slate-400 text-[10px] font-semibold mb-1 truncate">{file.name}</div>
                        <div 
                          className="h-64 rounded-xl overflow-hidden bg-slate-950 cursor-zoom-in relative group"
                          onClick={() => setExpandedUploadedUrl(file.url)}
                        >
                          <img 
                            src={file.url} 
                            alt={file.name} 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="bg-black/60 text-xs text-white px-2.5 py-1 rounded-full font-bold">Zoom Photo</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })
              ) : (
                /* Legacy backwards compatibility */
                selectedNote.url && (
                  selectedNote.type === 'pdf' ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-850">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-5 w-5 text-rose-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-200 truncate">{selectedNote.name}</span>
                        </div>
                        <button 
                          onClick={() => handleDownloadFile(selectedNote.url!, selectedNote.name)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Download className="h-3 w-3" /> Get
                        </button>
                      </div>
                      <div className="w-full h-[380px] bg-slate-950 relative">
                        {selectedNote.url.startsWith('data:') ? (
                          <iframe 
                            src={selectedNote.url}
                            className="w-full h-full rounded-b-2xl border-none"
                            title={selectedNote.name}
                          />
                        ) : (
                          <iframe 
                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedNote.url)}&embedded=true`}
                            className="w-full h-full rounded-b-2xl border-none"
                            title={selectedNote.name}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-2.5">
                      <div 
                        className="h-64 rounded-xl overflow-hidden bg-slate-950 cursor-zoom-in relative group"
                        onClick={() => setExpandedUploadedUrl(selectedNote.url!)}
                      >
                        <img 
                          src={selectedNote.url} 
                          alt={selectedNote.name} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="bg-black/60 text-xs text-white px-2.5 py-1 rounded-full font-bold">Zoom Photo</span>
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* POPUP 1: Choose File Type (Photo vs PDF) */}
      <AnimatePresence>
        {isPopup1Open && (
          <motion.div 
            id="popup1-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPopup1Open(false)} // Backdrop click closes popup
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div 
              id="popup1-card"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()} // Prevent close on card click
              className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/80 w-full max-w-sm text-slate-100 shadow-2xl relative cursor-default"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-extrabold text-white">Select File Type</h3>
                <button 
                  onClick={() => setIsPopup1Open(false)} 
                  className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid selectors */}
              <div className="grid grid-cols-2 gap-3.5 mb-4">
                <label 
                  htmlFor="p1-photo-input" 
                  className="flex flex-col items-center justify-center p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all gap-2 text-center group"
                >
                  <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:bg-blue-500/20 transition-all">
                    <Camera className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Pick Photos</span>
                  <span className="text-[8px] text-slate-500">Supports multiple</span>
                </label>
                <input 
                  id="p1-photo-input" 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => handlePopup1FileSelect(e, 'image')} 
                />

                <label 
                  htmlFor="p1-pdf-input" 
                  className="flex flex-col items-center justify-center p-4 bg-slate-800/40 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/50 rounded-xl cursor-pointer transition-all gap-2 text-center group"
                >
                  <div className="bg-rose-500/10 p-2.5 rounded-xl group-hover:bg-rose-500/20 transition-all">
                    <FileText className="h-6 w-6 text-rose-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Pick PDF</span>
                  <span className="text-[8px] text-slate-500">Official document</span>
                </label>
                <input 
                  id="p1-pdf-input" 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={(e) => handlePopup1FileSelect(e, 'pdf')} 
                />
              </div>

              {/* Temp selected list */}
              {selectedFiles.length > 0 && (
                <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800 text-xs mb-4">
                  <p className="font-bold text-slate-400 text-[10px] mb-1.5 flex items-center justify-between">
                    <span>Selected Files ({selectedFiles.length}):</span>
                    <button 
                      onClick={() => clearSelectedFiles()} 
                      className="text-red-400 hover:underline text-[9px] font-bold"
                    >
                      Clear All
                    </button>
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {selectedFiles.map((sf) => (
                      <div key={sf.id} className="flex justify-between items-center bg-slate-800/40 p-1 rounded border border-slate-800/50">
                        <span className="truncate text-slate-300 max-w-[200px] text-[10px] font-semibold">{sf.file.name}</span>
                        <button 
                          onClick={() => removeSelectedFile(sf.id)} 
                          className="p-0.5 bg-slate-900/50 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Button - Disabled if nothing selected */}
              <button
                id="popup1-next-btn"
                onClick={() => {
                  if (selectedFiles.length > 0) {
                    setIsPopup1Open(false);
                    setIsPopup2Open(true);
                  }
                }}
                disabled={selectedFiles.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-xs disabled:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-600/10"
              >
                Next
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP 2: Details input, plus button with Live Photo and File, Upload validation */}
      <AnimatePresence>
        {isPopup2Open && (
          <motion.div 
            id="popup2-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              id="popup2-card"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/80 w-full max-w-sm text-slate-100 shadow-2xl relative"
            >
              {/* Upper right corner (X) close button */}
              <button 
                id="popup2-close-x"
                onClick={() => {
                  setIsPopup2Open(false);
                  clearSelectedFiles();
                }} 
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-sm font-extrabold text-white mb-4 pr-10">Add Note Details</h3>

              {/* Name input (user khud likhega) */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Note Name
                </label>
                <input 
                  id="note-name-input"
                  type="text" 
                  placeholder="E.g., Chemistry Periodic Table Notes"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setWarningMessage('');
                  }}
                  className="w-full bg-slate-900 border border-slate-750 focus:border-blue-500 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 outline-none transition-all font-semibold"
                />
              </div>

              {/* Files preview + custom (+) button */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Selected Attachments ({selectedFiles.length})
                </label>

                <div className="flex flex-wrap gap-2 items-center">
                  {/* File previews list */}
                  {selectedFiles.map((sf) => (
                    <div 
                      key={sf.id}
                      className="w-14 h-14 bg-slate-900 border border-slate-850 rounded-lg relative group overflow-hidden cursor-pointer"
                      onClick={() => {
                        if (sf.type === 'image') {
                          setExpandedPreviewUrl(sf.previewUrl);
                        }
                      }}
                      title={sf.type === 'image' ? 'Zoom image' : sf.file.name}
                    >
                      {sf.type === 'image' ? (
                        <img 
                          src={sf.previewUrl} 
                          alt="preview" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-rose-950/10 text-rose-400 p-1">
                          <FileText className="h-5 w-5" />
                          <span className="text-[7px] truncate max-w-full text-center mt-0.5">{sf.file.name}</span>
                        </div>
                      )}

                      {/* Small X on upper right corner to remove item */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSelectedFile(sf.id);
                        }}
                        className="absolute top-0.5 right-0.5 bg-black/80 hover:bg-red-600 text-slate-300 hover:text-white rounded-full p-0.5 shadow transition-colors"
                        title="Remove"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}

                  {/* Plus (+) Button inside Popup 2 to add extra files */}
                  <div className="relative">
                    <button 
                      id="popup2-add-more-btn"
                      type="button"
                      onClick={() => setShowAddOptions(prev => !prev)}
                      className="w-14 h-14 bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-blue-500 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-400 transition-colors"
                      title="Add more photos or files"
                    >
                      <Plus className="h-4 w-4" />
                    </button>

                    {/* dropdown dropdown options */}
                    {showAddOptions && (
                      <div className="absolute top-16 left-0 bg-slate-900 border border-slate-800 p-1.5 rounded-lg shadow-xl z-25 flex flex-col gap-1 w-28 text-[10px] font-bold">
                        {/* Live Photo selector */}
                        <label 
                          htmlFor="add-camera"
                          className="flex items-center gap-1.5 p-1.5 hover:bg-slate-800 rounded cursor-pointer text-slate-300"
                        >
                          <Camera className="h-3.5 w-3.5 text-blue-400" />
                          <span>Live Photo</span>
                        </label>
                        <input 
                          id="add-camera" 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          className="hidden" 
                          onChange={(e) => handlePopupAddSelect(e, 'image')} 
                        />

                        {/* Standard file selector */}
                        <label 
                          htmlFor="add-file"
                          className="flex items-center gap-1.5 p-1.5 hover:bg-slate-800 rounded cursor-pointer text-slate-300"
                        >
                          <FileUp className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Any File</span>
                        </label>
                        <input 
                          id="add-file" 
                          type="file" 
                          accept="image/*,application/pdf" 
                          className="hidden" 
                          onChange={(e) => {
                            const isPdf = e.target.files?.[0]?.type === 'application/pdf';
                            handlePopupAddSelect(e, isPdf ? 'pdf' : 'image');
                          }} 
                        />
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Inline missing name warning banner */}
              {warningMessage && (
                <div id="missing-name-warning" className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-xs text-red-400 mb-4 animate-shake">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 animate-bounce" />
                  <span>{warningMessage}</span>
                </div>
              )}

              {/* Upload Button */}
              <button 
                id="popup2-upload-btn"
                onClick={handleMultiUpload}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/15"
              >
                Upload Note
              </button>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN ZOOM MODAL: For Selection Previews in Popup 2 */}
      <AnimatePresence>
        {expandedPreviewUrl && (
          <motion.div 
            id="expanded-preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
          >
            {/* Top-right corner (X) close button */}
            <button 
              onClick={() => setExpandedPreviewUrl(null)} 
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors z-[110]"
              title="Close Zoom"
            >
              <X className="h-6 w-6" />
            </button>

            <img 
              src={expandedPreviewUrl} 
              alt="Expanded preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN ZOOM MODAL: For Uploaded Images in detail page view */}
      <AnimatePresence>
        {expandedUploadedUrl && (
          <motion.div 
            id="expanded-uploaded-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4"
          >
            {/* Top-right corner (X) close button */}
            <button 
              onClick={() => setExpandedUploadedUrl(null)} 
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors z-[110]"
              title="Close Zoom"
            >
              <X className="h-6 w-6" />
            </button>

            <img 
              src={expandedUploadedUrl} 
              alt="Zoomed document note" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}