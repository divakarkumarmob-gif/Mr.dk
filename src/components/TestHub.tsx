import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Filter, ChevronRight, PlayCircle, BarChart3, BookOpen, Clock, ListOrdered, Award, PlusCircle, FlaskConical, Atom, Dna, X, Info } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
// import { QUESTIONS } from '../data/questions';
import PYQTestRunner from './PYQTestRunner';
import TestResultDetail from './TestResultDetail';


export default function TestHub({ subjects, onNavigate, setIsPYQRunning }: { subjects: { name: string; topic: string; color: string }[], onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests') => void, setIsPYQRunning: (val: boolean) => void }) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Current' | 'Missed'>('Current');
  const [tests, setTests] = useState<any[]>([]);
  //...
  useEffect(() => {
    const q = query(collection(db, 'tests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSubForPYQ, setSelectedSubForPYQ] = useState('');
  const [showPYQOptions, setShowPYQOptions] = useState(false);
  const [pyqQuestions, setPyqQuestions] = useState<any[] | null>(null);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [selectedScheduledTestForChapters, setSelectedScheduledTestForChapters] = useState<any>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(35);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);

  useEffect(() => {
      let interval: any;
      if (loading) {
          setTimer(35);
          interval = setInterval(() => {
              setTimer((prev) => {
                  if (prev <= 1) {
                      clearInterval(interval);
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchRecentTests = async () => {
        const q = query(collection(db, 'users', auth.currentUser!.uid, 'results'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const tests = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
            };
        });
        
        const now = Date.now();
        setRecentTests(tests.filter(t => {
            const hideUntil = localStorage.getItem('hide-' + t.id);
            if (hideUntil) {
                if (now > parseInt(hideUntil)) return false;
            }
            return true;
        }));
    };
    fetchRecentTests();
  }, []);

  const handleSeeResults = (test: any) => {
      setSelectedResult(test);
      if (!localStorage.getItem('hide-' + test.id)) {
          localStorage.setItem('hide-' + test.id, (Date.now() + 10 * 60 * 1000).toString());
      }
  }

  const removeTest = (testId: string) => {
      localStorage.setItem('hide-' + testId, '0');
      setRecentTests(prev => prev.filter(t => t.id !== testId));
  }

  const handleTouchStart = (testId: string) => {
      setPressTimer(setTimeout(() => removeTest(testId), 500));
  };
  const handleTouchEnd = () => clearTimeout(pressTimer);

  const mockTestType = subjects.map(s => s.topic).join(' + ');
  const staticTests = [
      { id: 1, name: 'Full Length Mock Test', type: mockTestType, time: '3h', questions: 180, marks: 720, status: 'not-attempted', icon: ClipboardList, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyTests = subjects.map((sub, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() + (idx % 3 - 1)); 
    
    return {
      id: 100 + idx,
      name: `${sub.name} Daily Test`,
      type: sub.topic,
      time: '60m', 
      questions: 30, 
      marks: 120, 
      status: 'not-attempted', 
      scheduledDate: date,
      icon: sub.name === 'PHYSICS' ? Atom : sub.name === 'CHEMISTRY' ? FlaskConical : Dna,
      color: sub.name === 'PHYSICS' ? 'text-blue-400' : sub.name === 'CHEMISTRY' ? 'text-green-400' : 'text-orange-400',
      bg: sub.name === 'PHYSICS' ? 'bg-blue-500/20' : sub.name === 'CHEMISTRY' ? 'bg-green-500/20' : 'bg-orange-500/20'
    };
  });

  const activeTopicNames = subjects.map(s => s.topic.split(':')[0].trim());

  const allTests = [...staticTests, ...dailyTests].filter(test => {
    if (test.name.toLowerCase().includes('mock')) return true; 
    return activeTopicNames.includes(test.type);
  });

  const filteredTests = tests.filter(test => {
    const testDate = test.targetDate.toDate ? test.targetDate.toDate() : new Date(test.targetDate); 
    testDate.setHours(0,0,0,0);
    if (activeTab === 'Upcoming') return testDate > today;
    if (activeTab === 'Current') return testDate.getTime() === today.getTime();
    if (activeTab === 'Missed') return (testDate < today && test.status === 'not-attempted');
    return true;
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
            <h1 className="text-xl font-bold mb-3">Tests</h1>
            
            {selectedResult && (
                <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-4 flex flex-col text-white">
                    <TestResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />
                </div>
            )}

            {recentTests.length > 0 && (
                <div className="mb-4">
                    <h2 className="font-bold text-sm mb-2 text-orange-400">Recently Completed</h2>
                    {recentTests.map(test => (
                        <div key={test.id} 
                            className="bg-gradient-to-r from-orange-900/40 to-red-900/40 p-3 rounded-lg border border-orange-500/20 flex justify-between items-center mb-1.5"
                            onTouchStart={() => handleTouchStart(test.id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => handleTouchStart(test.id)}
                            onMouseUp={handleTouchEnd}
                        >
                            <span className="font-bold text-sm">{test.testName}</span>
                            <button onClick={() => handleSeeResults(test)} className="bg-orange-600 text-white text-[10px] px-2 py-1 rounded-lg font-bold">See Results</button>
                        </div>
                    ))}
                </div>
            )}

            

            <div className="flex bg-[#161e38] p-0.5 rounded-lg mb-3">
                {(['Upcoming', 'Current', 'Missed'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1 rounded-lg font-bold text-xs ${activeTab === tab ? 'bg-blue-600' : 'bg-transparent text-gray-400'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Daily Tests from Subjects */}
            <h2 className="font-bold text-sm mb-2 text-orange-400">Daily Study Plan</h2>
            <div className="space-y-1.5 mb-3">
                {dailyTests.map((test, idx) => (
                    <motion.div 
                        key={test.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-[#161e38] p-2.5 rounded-lg border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-1.5"
                    >
                        <div className="flex items-center gap-2 w-full">
                            <div className={`${test.bg} ${test.color} p-1.5 rounded-full flex-shrink-0`}>
                                <test.icon className="h-4 w-4" />
                            </div>
                            <div className="w-full">
                                <h3 className="font-bold text-xs sm:text-xs">{test.name}</h3>
                                <p className="text-[9px] text-gray-400 mt-0.5">{test.type}</p>
                            </div>
                        </div>
                        <button className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-lg font-bold w-full sm:w-auto">Start</button>
                    </motion.div>
                ))}
            </div>

      {/* Filter dialog removed as per new tab design */}

      <div className="space-y-2">
        {filteredTests.map((test, idx) => {
          const testDate = test.targetDate.toDate ? test.targetDate.toDate() : new Date(test.targetDate);                
          testDate.setHours(0,0,0,0);
          return (
            <motion.div 
            key={test.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#161e38] p-3 rounded-lg border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2"
          >
            <div className="flex items-center gap-3 w-full">
                <div className={`${test.bg || 'bg-blue-500/20'} ${test.color || 'text-blue-400'} p-2 rounded-full flex-shrink-0`}>
                    {test.icon ? <test.icon className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                </div>
                <div className="w-full">
                   <h3 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                     {typeof test.name === 'string' ? test.name : (console.log('Invalid test name:', test.name), String(test.name))}
                     {test.chapters && (
                       <Info className="h-3 w-3 text-blue-400 cursor-pointer" onClick={() => setSelectedScheduledTestForChapters(test)} />
                     )}
                   </h3>
                   <p className="text-[9px] text-gray-400 mt-0.5">
                     {test.type && <span className="bg-white/10 text-white px-1.5 py-0.5 rounded-full font-bold">{test.type}</span>}
                     {test.chapters && (
                       <button 
                         onClick={() => setSelectedScheduledTestForChapters(test)}
                         className="text-blue-400 text-[9px] font-bold underline ml-1.5"
                       >
                         See Syllabus
                       </button>
                     )}
                   </p>
                   <div className="flex gap-2 text-[9px] text-gray-500 mt-0.5">
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5"/>{test.time}</span>
                      <span className="flex items-center gap-0.5"><ListOrdered className="h-2.5 w-2.5"/>{test.questions} Questions</span>
                   </div>
                </div>
            </div>
            
            <div className="text-right w-full sm:w-auto">
                <button 
                  className={`${testDate.getTime() <= Date.now() ? 'bg-blue-600' : 'bg-gray-600'} text-white text-[10px] px-2 py-1 rounded-lg flex items-center justify-center gap-0.5 font-bold w-full sm:w-auto`}
                        onClick={async () => {
                            if (testDate.getTime() <= Date.now()) {
                                try {
                                    setLoading(true);
                                    let allQuestions: any[] = [];
                                    
                                    for(const chapter of (test.chapters || [])) {
                                        const encodedSubject = encodeURIComponent(chapter.subject.toLocaleLowerCase());
                                        const encodedChapterDir = encodeURIComponent(chapter.name.toLocaleLowerCase());
                                        let chunkNumber = 1;

                                        while (true) {
                                            let formattedName = chapter.name.toLocaleLowerCase().replace(/ /g, '_').replace(/:/g, '').replace(/_+/g, '_');
                                            if (formattedName === "cell_the_unit_of_life") {
                                                formattedName = "cell_unit_of_life";
                                            }
                                            
                                            // Trying the class-11 repo structure used in PracticeTest
                                            const url = `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodedChapterDir}/${formattedName}_chunk${chunkNumber}.json`;
                                            
                                            const res = await fetch(url);
                                            if (!res.ok) break;
                                            const data = await res.json();
                                            
                                            if (data.questions && Array.isArray(data.questions)) {
                                                const qWithSub = data.questions.map((q: any) => ({...q, subject: chapter.subject}));
                                                allQuestions = [...allQuestions, ...qWithSub];
                                            } else {
                                                break;
                                            }
                                            chunkNumber++;
                                        }
                                    }
                                    
                                    // Limit questions per subject based on admin configuration
                                    const subjectLimits = test.subjectConfig || {};
                                    let finalQuestions: any[] = [];
                                    for (const [subject, config] of Object.entries(subjectLimits)) {
                                        const subQuestions = allQuestions.filter(q => q.subject === subject);
                                        // Shuffle
                                        const shuffled = subQuestions.sort(() => 0.5 - Math.random());
                                        finalQuestions = [...finalQuestions, ...shuffled.slice(0, (config as any).questions)];
                                    }
                                    
                                    // await new Promise(r => setTimeout(r, 15000)); // 15-second delay
                                    // Timer is now managed by useEffect
                                    await new Promise(r => setTimeout(r, 35000));
                                    setLoading(false);
                                    if (finalQuestions.length === 0) {
                                        alert("No data found");
                                    } else {
                                        setPyqQuestions(finalQuestions);
                                        setIsPYQRunning(true);
                                    }
                                } catch(e) {
                                    setLoading(false);
                                    console.error("Error fetching test questions:", e);
                                    alert("No data found");
                                }
                            } else {
                                alert('Test is upcoming!');
                            }
                        }}

                >
                    {testDate.getTime() <= Date.now() ? <><PlayCircle className="h-3 w-3" /> Start Test</> : 'Upcoming'}
                </button>
            </div>
          </motion.div>
        )})}
      </div>

{/* Create Custom Test functionality removed as it relied on legacy data */}
      {/* 
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
      */}
      
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

      /* Chapter Popup */
      {selectedScheduledTestForChapters && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setSelectedScheduledTestForChapters(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-[#161e38] rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-gray-400" onClick={() => setSelectedScheduledTestForChapters(null)}><X className="h-5 w-5"/></button>
                <h2 className="text-xl font-bold mb-4">Chapters in {selectedScheduledTestForChapters.name}</h2>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedScheduledTestForChapters.chapters?.map((c: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-[#0a0f24] text-sm">
                            <span className="text-blue-400 font-bold">{c.subject}</span>: {c.name}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
      )}
      
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
                                {/* 
                                const subjectQuestions = (QUESTIONS as any)[selectedSubject as string] || [];
                                const testQuestions = subjectQuestions.slice(0, questionCount);
                                alert(`Starting test with ${testQuestions.length} questions for ${selectedSubject}!`);
                                setShowCustomOptions(false);
                                setSelectedSubject(null);
                                */}
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
      {loading && (
          <div className="fixed inset-0 bg-[#0a0f24] z-[200] flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-t-blue-600 border-white/20 rounded-full animate-spin mb-4"></div>
              <h2 className="text-xl font-bold">Starting Test...</h2>
              <p className="text-lg text-gray-400 mt-2">{timer}s</p>
          </div>
      )}
      </>
      )}
      
    </div>
  );
}
