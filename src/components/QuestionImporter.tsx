import React, { useState } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { Upload } from 'lucide-react';

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Processing ${file.name}...`);

      try {
        const questions = await new Promise<any[]>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const json = JSON.parse(e.target?.result as string);
              resolve(Array.isArray(json) ? json : (json.biolog || []));
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });

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
      <h3 className="font-bold mb-2">Import Questions</h3>
      <select 
        value={subject} 
        onChange={(e) => setSubject(e.target.value as any)}
        className="bg-[#0a0f24] text-white p-2 rounded-lg mb-2 w-full border border-white/10"
      >
        <option value="Biology">Biology</option>
        <option value="Chemistry">Chemistry</option>
        <option value="Physics">Physics</option>
      </select>
      <div className="flex gap-2">
        <label className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700">
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Select JSON File'}
          <input type="file" accept=".json" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
        <button 
          onClick={handleImportPublicData}
          disabled={uploading}
          className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Load Biology Data'}
        </button>
      </div>
      {status && <p className="text-sm mt-2 text-gray-400">{status}</p>}
    </div>
  );
}
