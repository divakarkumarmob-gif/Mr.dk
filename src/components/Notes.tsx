
import React, { useState } from 'react';
import { Plus, Camera, FileUp, X, BookOpen, Download, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';                
import imageCompression from 'browser-image-compression';
import Pressable from './Pressable';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Notes({ onNavigate }: { onNavigate: (view: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    alert('File picked: ' + (file ? file.name : 'none'));
    console.log('File selected:', file);
    if (file) {
      setFile(file);
    }
  };

  const handleUpload = async () => {
    if (!file || !name || !auth.currentUser) {
      return;
    }
    setUploading(true);
    
    try {
      // 1. Compress
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      // 2. Upload to Storage
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/notes/${Date.now()}_${name}`);
      const uploadTask = await uploadBytes(storageRef, compressedFile);
      console.log('Upload complete');

      const url = await getDownloadURL(storageRef);

      // 3. Save metadata to Firestore
      const notesRef = collection(db, 'users', auth.currentUser.uid, 'notes');
      try {
        await addDoc(notesRef, { name, url, createdAt: new Date() });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/notes`);
      }

      setIsOpen(false);
      setName('');
      setFile(null);
    } catch (error) {
      console.error('Detailed upload error:', error);
      alert('Upload failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-100">Important Notes</h1>
      
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full bg-[#1e293b] border border-dashed border-slate-700 rounded-lg p-2 flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 transition-all hover:bg-[#253247] text-xs font-bold mb-3"
      >
        <Plus className="h-4 w-4" /> Add Note
      </button>

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

      <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 w-full max-w-sm text-slate-100 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Note</h2>
              <button onClick={() => setIsOpen(false)}><X className="h-6 w-6" /></button>
            </div>

            <div className="flex gap-2 mb-3">
              <label htmlFor="camera-input" className="flex-1 bg-slate-800 p-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer hover:bg-slate-700 text-xs">
                <Camera className="h-4 w-4" /> Photo
              </label>
              <input id="camera-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              
              <label htmlFor="file-input" className="flex-1 bg-slate-800 p-2 rounded-lg flex flex-col items-center gap-1 cursor-pointer hover:bg-slate-700 text-xs">
                <FileUp className="h-4 w-4" /> File
              </label>
              <input id="file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {file && (
              <input 
                type="text" 
                placeholder="Enter note name" 
                className="w-full p-2 rounded-md bg-slate-900 border border-slate-700 mb-3 text-slate-100 placeholder:text-slate-500 text-xs"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <button 
              onClick={handleUpload}
              disabled={uploading || !file || !name}
              className="w-full bg-blue-600 py-2 rounded-lg font-bold disabled:opacity-50 text-white hover:bg-blue-700 transition text-xs"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
