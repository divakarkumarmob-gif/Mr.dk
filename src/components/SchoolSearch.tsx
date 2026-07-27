import React, { useState } from 'react';
import { Search, MapPin, X, ChevronLeft } from 'lucide-react';

// Sample dataset
const SCHOOLS = [
  { code: '10320100001', name: 'High School Sikandra', address: 'Main Road, Sikandra, Jamui, Bihar, 811315', mapLink: 'https://maps.google.com' },
  { code: '10320100002', name: 'Model High School Patna', address: 'Patna, Bihar', mapLink: 'https://maps.google.com' },
];

export default function SchoolSearch({ onNavigate }: { onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'technicalSupport' | 'notesLibrary' | 'mindHack' | 'aiStudyPlan' | 'ncertHub' | 'schoolSearch') => void }) {
  const [searchCode, setSearchCode] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleSearch = () => {
    const found = SCHOOLS.find(s => s.code === searchCode);
    setResult(found || null);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans p-4" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}>
        <div className="flex items-center gap-2 mb-6">
            <button onClick={() => onNavigate('profile')} className="p-2 bg-muted rounded-full">
                <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Search School / College</h1>
        </div>
        
        <div className="flex gap-2 mb-6">
            <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Enter School Code (e.g., 10320100001)"
                className="flex-grow p-2 rounded-lg border bg-background"
            />
            <button onClick={handleSearch} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold flex items-center gap-1">
                <Search className="h-4 w-4" /> Search
            </button>
        </div>

        {result ? (
            <div className="border border-border rounded-lg p-4 bg-card">
                <h2 className="font-bold border-b pb-2 mb-2">📋 Search Result</h2>
                <div className="space-y-2 text-sm">
                    <p>• <span className="font-bold">School Code</span>: {result.code}</p>
                    <p>• <span className="font-bold">Name</span>: {result.name}</p>
                    <p>• <span className="font-bold">Address</span>: {result.address}</p>
                    <p>• <span className="font-bold">Map Link</span>: <a href={result.mapLink} target="_blank" rel="noreferrer" className="text-blue-500 underline flex items-center gap-1"><MapPin className="h-4 w-4"/> View on Google Maps</a></p>
                </div>
            </div>
        ) : searchCode && (
            <p className="text-muted-foreground text-center">No school found with this code.</p>
        )}
    </div>
  );
}
