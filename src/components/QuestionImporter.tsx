import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { Upload, FileType, Brain } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { getApiUrl } from '@/utils/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function QuestionImporter() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState<'Biology' | 'Chemistry' | 'Physics'>('Biology');

  const uploadQuestions = async (questions: any[]) => {
    if (!auth.currentUser) {
      setStatus('Please log in first.');
      return;
    }

    setUploading(true);
    setStatus(`Uploading ${questions.length} questions...`);

    const questionsRef = collection(db, 'questions');
    const BATCH_SIZE = 100;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = questions.slice(i, i + BATCH_SIZE);
      
      chunk.forEach((q: any) => {
        const newDocRef = doc(questionsRef);
        batch.set(newDocRef, {
          ...q,
          subject: subject, 
          uid: auth.currentUser!.uid,
          createdAt: new Date()
        });
      });
      
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'questions');
      }
    }
    setStatus('Successfully uploaded!');
    setUploading(false);
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Extract first 10 pages maximum to avoid token limits
    const maxPages = Math.min(pdf.numPages, 10);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Processing ${file.name}...`);

      try {
        let questions: any[] = [];
        
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            const json = JSON.parse(text);
            questions = Array.isArray(json) ? json : (json.biolog || []);
        } else if (file.name.endsWith('.pdf')) {
            setStatus(`Extracting text from PDF...`);
            const text = await extractTextFromPDF(file);
            
            setStatus(`AI is generating questions...`);
            const response = await fetch(getApiUrl('/api/extract-questions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, subject })
            });

            if (!response.ok) throw new Error('AI extraction failed');
            const data = await response.json();
            questions = data.questions;
        }

        if (questions.length === 0) {
          console.warn(`No questions found in ${file.name}`);
          continue;
        }

        await uploadQuestions(questions);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setStatus(`Error in ${file.name}: ${(error instanceof Error ? error.message : 'Unknown')}`);
      }
    }

    setStatus('All files processed.');
    setUploading(false);
  };

  const handleImportPublicData = async () => {
    try {
      setUploading(true);
      const response = await fetch('/biology_data.json');
      const questions = await response.json();
      await uploadQuestions(questions);
    } catch (error) {
      console.error(error);
      setStatus('Error importing public data: ' + (error instanceof Error ? error.message : 'Unknown'));
      setUploading(false);
    }
  };

  return (
    <div className="bg-[#161e38] p-4 rounded-xl border border-white/5 mt-4">
      <h3 className="font-bold mb-2 flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-400" />
        Import & Generate Questions
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Upload NCERT PDF files to automatically extract and generate MCQs using AI.
      </p>
      
      <select 
        value={subject} 
        onChange={(e) => setSubject(e.target.value as any)}
        className="bg-[#0a0f24] text-white p-2 rounded-lg mb-4 w-full border border-white/10 text-sm"
      >
        <option value="Biology">Biology</option>
        <option value="Chemistry">Chemistry</option>
        <option value="Physics">Physics</option>
      </select>

      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-4 py-3 rounded-xl cursor-pointer transition-all">
          <Upload className="h-4 w-4" />
          {uploading ? 'Processing...' : 'Upload PDF or JSON'}
          <input 
            type="file" 
            accept=".json,.pdf" 
            multiple 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={uploading} 
          />
        </label>
        
        <button 
          onClick={handleImportPublicData}
          disabled={uploading}
          className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 px-4 py-3 rounded-xl hover:bg-white/10 text-sm font-medium transition-all disabled:opacity-50"
        >
          <FileType className="w-4 h-4 text-green-400" />
          {uploading ? 'Processing...' : 'Load Standard Biology Data'}
        </button>
      </div>

      {status && (
        <div className="mt-4 p-3 bg-[#0a0f24] rounded-lg border border-white/5 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${uploading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
            <p className="text-xs text-gray-300">{status}</p>
        </div>
      )}
    </div>
  );
}
