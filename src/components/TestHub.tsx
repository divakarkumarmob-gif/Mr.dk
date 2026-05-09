import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Filter, ChevronRight, PlayCircle, BarChart3, BookOpen, Clock, ListOrdered, Award, PlusCircle, FlaskConical, Atom, Dna, X } from 'lucide-react';
import { collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { QUESTIONS } from '../data/questions';
import PYQTestRunner from './PYQTestRunner';


export default function TestHub({ subjects, onNavigate, setIsPYQRunning }: { subjects: { name: string; topic: string; color: string }[], onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests') => void, setIsPYQRunning: (val: boolean) => void }) {
  const [activeTab, setActiveTab] = useState('All Tests');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Physics' | 'Chemistry' | 'Biology'>('All');
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSubForPYQ, setSelectedSubForPYQ] = useState('');
  const [showPYQOptions, setShowPYQOptions] = useState(false);
  const [pyqQuestions, setPyqQuestions] = useState<any[] | null>(null);
  const [questionCount, setQuestionCount] = useState(5);

  const mockTestType = subjects.map(s => s.topic).join(' + ');
  const staticTests = [
      { id: 1, name: 'Full Length Mock Test', type: mockTestType, time: '3h', questions: 180, marks: 720, status: 'not-attempted', icon: ClipboardList, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  ];

  const dailyTests = subjects.map((sub, idx) => ({
    id: 100 + idx,
    name: `${sub.name} Daily Test`,
    type: sub.topic,
    time: '60m', 
    questions: 30, 
    marks: 120, 
    status: 'not-attempted', 
    icon: sub.name === 'PHYSICS' ? Atom : sub.name === 'CHEMISTRY' ? FlaskConical : Dna,
    color: sub.name === 'PHYSICS' ? 'text-blue-400' : sub.name === 'CHEMISTRY' ? 'text-green-400' : 'text-orange-400',
    bg: sub.name === 'PHYSICS' ? 'bg-blue-500/20' : sub.name === 'CHEMISTRY' ? 'bg-green-500/20' : 'bg-orange-500/20'
  }));

  const activeTopicNames = subjects.map(s => s.topic.split(':')[0].trim());

  const allTests = [...staticTests, ...dailyTests].filter(test => {
    if (test.name.toLowerCase().includes('mock')) return true; 

    // Only show tests for subjects shown on home screen
    return activeTopicNames.includes(test.type);
  });

  const filteredTests = allTests.filter(test => {
    let matchesTab = true;
    if (activeTab === 'Mock Tests') matchesTab = test.name.includes('Mock');
    else if (activeTab === 'Chapter Tests') matchesTab = !test.name.includes('Mock');

    let matchesCategory = true;
    if (categoryFilter !== 'All') matchesCategory = test.name.includes(categoryFilter);

    return matchesTab && matchesCategory;
  }).sort((a, b) => {
    const isTopicMatch = (t: typeof a) => subjects.some(sub => t.type.includes(sub.topic.split(':')[0].trim()));
    if (isTopicMatch(a) && !isTopicMatch(b)) return -1;
    if (!isTopicMatch(a) && isTopicMatch(b)) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-[#0a0f24] text-white p-6 font-sans pb-24">
      {pyqQuestions ? (
            <PYQTestRunner questions={pyqQuestions} title={`${selectedYear} (${selectedSubForPYQ})`} onBack={() => {
                setPyqQuestions(null);
                setIsPYQRunning(false);
            }} />
      ) : (
        <>
            <h1 className="text-2xl font-bold mb-6">Tests</h1>
            

            <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Popular Tests</h2>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 text-xs text-blue-400 border border-blue-400/30 px-3 py-1 rounded-lg">
          <Filter className="h-3 w-3" /> {categoryFilter}
        </button>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setIsFilterOpen(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} className="w-full bg-[#161e38] rounded-t-3xl p-6 pb-12" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-6">Filter Tests</h2>
                <div className="space-y-3">
                    {['All', 'Physics', 'Chemistry', 'Biology'].map(cat => (
                        <button key={cat} onClick={() => { setCategoryFilter(cat as any); setIsFilterOpen(false); }} className={`w-full p-4 rounded-xl text-left font-bold ${categoryFilter === cat ? 'bg-blue-600' : 'bg-[#0a0f24]'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
      )}

      <div className="space-y-4">
        {filteredTests.map((test, idx) => (
          <motion.div 
            key={test.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#161e38] p-4 rounded-xl border border-white/5 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
                <div className={`${test.bg} ${test.color} p-3 rounded-full`}>
                    <test.icon className="h-6 w-6" />
                </div>
                <div>
                   <h3 className="font-bold">{test.name}</h3>
                   <p className="text-xs text-gray-400 mt-0.5">
                     <span className="bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">{test.type}</span>
                   </p>
                   <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{test.time}</span>
                      <span className="flex items-center gap-1"><ListOrdered className="h-3 w-3"/>{test.questions} Questions</span>
                   </div>
                </div>
            </div>
            
            <div className="text-right">
                <button className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-1 font-bold">
                    <PlayCircle className="h-4 w-4" /> Start Test
                </button>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-8 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 p-4 rounded-xl border border-blue-500/20 flex justify-between items-center cursor-pointer"
        onClick={() => setShowCustomOptions(true)}
      >
        <div className="flex items-center gap-3">
             <PlusCircle className="h-8 w-8 text-blue-400" />
             <div>
                <p className="font-bold">Create Custom Test</p>
                <p className="text-xs text-gray-400">Select chapters and create your own test</p>
             </div>
        </div>
        <button className="text-blue-400 font-bold text-sm">Create Now &gt;</button>
      </motion.div>
      
      {/* PYQ Test Card */}
      <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 bg-gradient-to-r from-orange-900/40 to-red-900/40 p-4 rounded-xl border border-orange-500/20 flex justify-between items-center cursor-pointer"
          onClick={() => setShowPYQOptions(true)}
      >
          <div className="flex items-center gap-3">
                  <BookOpen className="h-8 w-8 text-orange-400" />
                  <div>
                  <p className="font-bold">NEET PYQ Tests</p>
                  <p className="text-xs text-gray-400">Previous Year Questions</p>
                  </div>
          </div>
          <button className="text-orange-400 font-bold text-sm">Start PYQ &gt;</button>
      </motion.div>

      {showCustomOptions && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => { setShowCustomOptions(false); setSelectedSubject(null); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-[#161e38] rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-400" onClick={() => { setShowCustomOptions(false); setSelectedSubject(null); }}><X className="h-5 w-5"/></button>
                
                {!selectedSubject ? (
                    <>
                        <h2 className="text-xl font-bold mb-6">Select Subject</h2>
                        <div className="space-y-3">
                            {['Physics', 'Chemistry', 'Biology'].map(cat => (
                                <div key={cat} className="flex justify-between items-center p-4 rounded-xl bg-[#0a0f24] border border-white/5 cursor-pointer hover:border-blue-500/50 transition" onClick={() => setSelectedSubject(cat)}>
                                    <span className="font-bold">{cat}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="text-xl font-bold mb-6">Configure {selectedSubject} Test</h2>
                        <div className="mb-6">
                            <label className="block text-sm font-bold mb-2">Number of Questions: {questionCount}</label>
                            <input 
                                type="range" 
                                min="1" 
                                max="50" 
                                value={questionCount}
                                onChange={(e) => setQuestionCount(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-2">
                                <span>1</span>
                                <span>50</span>
                            </div>
                        </div>
                        <button 
                            className="w-full bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                            onClick={() => {
                                const subjectQuestions = (QUESTIONS as any)[selectedSubject as string] || [];
                                const testQuestions = subjectQuestions.slice(0, questionCount);
                                alert(`Starting test with ${testQuestions.length} questions for ${selectedSubject}!`);
                                setShowCustomOptions(false);
                                setSelectedSubject(null);
                            }}
                        >
                            Start Test
                        </button>
                    </>
                )}
            </motion.div>
        </div>
      )}

      {showPYQOptions && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setShowPYQOptions(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-[#161e38] rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-400" onClick={() => setShowPYQOptions(false)}><X className="h-5 w-5"/></button>
                <h2 className="text-xl font-bold mb-6">Select PYQ</h2>
                <div className="space-y-4">
                    <select className="w-full p-4 rounded-xl bg-[#0a0f24] text-white" onChange={(e) => setSelectedYear(e.target.value)}>
                        <option value="">Select Year</option>
                        {['2021', '2022', '2023', '2024', '2025'].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="w-full p-4 rounded-xl bg-[#0a0f24] text-white" onChange={(e) => setSelectedSubForPYQ(e.target.value)}>
                        <option value="">Select Subject</option>
                        {['Biology', 'Chemistry', 'Physics'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="w-full bg-orange-600 py-3 rounded-xl font-bold hover:bg-orange-700 transition" onClick={async () => {
                        if (!selectedYear || !selectedSubForPYQ) return alert("Please select Year and Subject");
                        
                        try {
                            const url = `https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/${selectedYear}/NEET_${selectedYear}_${selectedSubForPYQ}.json`;
                            const response = await fetch(url);
                            if (!response.ok) throw new Error("Could not fetch test");
                            const data = await response.json();
                            setPyqQuestions(data.questions || []);
                            setShowPYQOptions(false);
                            setIsPYQRunning(true);
                            // alert(`Fetched ${data.questions.length} questions!`);
                        } catch (err) {
                            alert("Error fetching test. Please check the URL.");
                        }
                    }}>Fetch PYQ</button>
                </div>
            </motion.div>
        </div>
      )}
      </>
      )}
      
    </div>
  );
}
