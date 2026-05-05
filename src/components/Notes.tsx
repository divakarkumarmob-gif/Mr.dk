
import React, { useState } from 'react';
import { Plus, Camera, FileUp, X } from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';                
import imageCompression from 'browser-image-compression';

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

export default function Notes() {
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-100">Important Notes</h1>
      
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full bg-[#1e293b] border-2 border-dashed border-slate-700 rounded-2xl p-6 flex items-center justify-center gap-3 text-slate-400 hover:text-slate-200"
      >
        <Plus className="h-6 w-6" /> Add Important Note
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 w-full max-w-sm text-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">New Note</h2>
              <button onClick={() => setIsOpen(false)}><X className="h-6 w-6" /></button>
            </div>

            <div className="flex gap-4 mb-4">
              <label htmlFor="camera-input" className="flex-1 bg-slate-800 p-4 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-700">
                <Camera className="h-6 w-6" /> Take Photo
              </label>
              <input id="camera-input" type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
              
              <label htmlFor="file-input" className="flex-1 bg-slate-800 p-4 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-slate-700">
                <FileUp className="h-6 w-6" /> Select File
              </label>
              <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} />
            </div>

            {file && (
              <input 
                type="text" 
                placeholder="Enter note name" 
                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 mb-4 text-slate-100 placeholder:text-slate-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <button 
              onClick={handleUpload}
              disabled={uploading || !file || !name}
              className="w-full bg-blue-600 py-3 rounded-xl font-bold disabled:opacity-50 text-white"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
