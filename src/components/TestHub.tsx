import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Filter, ChevronRight, PlayCircle, BarChart3, BookOpen, FileText, Clock, ListOrdered, Award, PlusCircle, FlaskConical, Atom, Dna, X, Info, AlertTriangle, Tag, Loader2 } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
// import { QUESTIONS } from '../data/questions';
import PYQTestRunner from './PYQTestRunner';
import TestResultDetail from './TestResultDetail';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { generateNEETPdf } from '../lib/pdfUtils';


export default function TestHub({ subjects, onNavigate, setIsPYQRunning }: { subjects: { name: string; topic: string; color: string }[], onNavigate: (view: any, params?: any) => void, setIsPYQRunning: (val: boolean) => void }) {
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
  const [currentPaperUrl, setCurrentPaperUrl] = useState<string | undefined>(undefined);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [resumeTestData, setResumeTestData] = useState<any | null>(null);
  const [initialTestData, setInitialTestData] = useState<any | null>(null);

  useEffect(() => {
    const data = localStorage.getItem('resumeTestData');
    if (data) {
      try {
        setResumeTestData(JSON.parse(data));
      } catch (e) {
        console.error("Failed to parse resumeTestData:", e);
      }
    }
  }, []);

  const handleResumeTest = () => {
    if (resumeTestData) {
      setPyqQuestions(resumeTestData.questions);
      setTestTitle(resumeTestData.title);
      setInitialTestData({
        answers: resumeTestData.answers || {},
        marked: resumeTestData.marked || {},
        currentIndex: resumeTestData.currentIndex || 0,
        timeLeft: resumeTestData.timeLeft || (resumeTestData.questions?.length * 60)
      });
      setIsPYQRunning(true);
    }
  };

  const [selectedScheduledTestForChapters, setSelectedScheduledTestForChapters] = useState<any>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activePdf, setActivePdf] = useState<{ url: string, title: string } | null>(null);
  const [timer, setTimer] = useState(35);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [pressTimer, setPressTimer] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
	const interval = setInterval(() => setNow(Date.now()), 1000);
	return () => clearInterval(interval);
  }, []);

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
        try {
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
            const filteredTests = tests.filter(t => {
                const hideUntil = localStorage.getItem('hide-' + t.id);
                if (hideUntil) {
                    if (now > parseInt(hideUntil)) return false;
                }
                return true;
            });
            setRecentTests(filteredTests.slice(0, 3));
        } catch (e: any) {
            console.error("Error fetching recent tests:", e);
             // Handle gracefully
        }
    };
    fetchRecentTests();
  }, []);

  const handleSeeResults = (test: any) => {
      setSelectedResult(test);
      window.history.pushState({ view: 'tests', isResultOpen: true }, '', window.location.href);
      if (!localStorage.getItem('hide-' + test.id)) {
          localStorage.setItem('hide-' + test.id, (Date.now() + 7 * 60 * 1000).toString());
      }
  }

  useEffect(() => {
    const handlePop = () => {
        if (selectedResult && !window.history.state?.isResultOpen) {
            setSelectedResult(null);
        }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [selectedResult]);

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
      subject: sub.name,
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
    <div className="h-screen bg-[#0a0f24] text-white font-sans pb-44 px-3 overflow-y-auto">
      {pyqQuestions ? (
            <PYQTestRunner 
                questions={pyqQuestions} 
                title={testTitle || `${selectedYear} (${selectedSubForPYQ})`} 
                paperUrl={currentPaperUrl}
                initialData={initialTestData}
                onBack={() => {
                    setPyqQuestions(null);
                    setCurrentPaperUrl(undefined);
                    setIsPYQRunning(false);
                    setTestTitle('');
                    setInitialTestData(null);
                    
                    // Refresh resume data
                    const data = localStorage.getItem('resumeTestData');
                    if (data) {
                      try {
                        setResumeTestData(JSON.parse(data));
                      } catch (e) {
                        setResumeTestData(null);
                      }
                    } else {
                      setResumeTestData(null);
                    }
                }} 
            />
      ) : (
        <>
            <h1 className="text-lg font-bold mb-2">Tests</h1>

            {resumeTestData && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-3 bg-gradient-to-r from-blue-950/80 to-indigo-950/80 p-2.5 rounded-md border border-blue-500/40 flex flex-row items-center justify-between gap-2 shadow-lg shadow-blue-500/5"
                >
                    <div className="flex items-center gap-2 w-full">
                        <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-full flex-shrink-0 animate-pulse">
                            <Clock className="h-3.5 w-3.5" />
                        </div>
                        <div className="w-full">
                            <h3 className="font-bold text-xs flex items-center gap-1.5 text-blue-300">
                                Active Test (Paused)
                            </h3>
                            <h2 className="font-extrabold text-sm text-white leading-tight">
                                {resumeTestData.title}
                            </h2>
                            <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-2">
                                <span>Questions: <strong className="text-gray-300">{Object.keys(resumeTestData.answers || {}).length} / {resumeTestData.questions?.length || 0}</strong></span>
                                <span>•</span>
                                <span>Time left: <strong className="text-red-400 font-mono">{Math.floor(resumeTestData.timeLeft / 60)}m</strong></span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button 
                            onClick={handleResumeTest}
                            className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[10px] px-2.5 py-1 rounded-md font-extrabold flex items-center gap-0.5 whitespace-nowrap shadow-md shadow-blue-600/20 transition-all"
                        >
                            <PlayCircle className="h-3 w-3" /> Resume
                        </button>
                        <button 
                            onClick={() => {
                                if (confirm("Are you sure you want to discard this paused test? All progress will be lost.")) {
                                    localStorage.removeItem('resumeTestData');
                                    setResumeTestData(null);
                                }
                            }}
                            className="text-gray-500 hover:text-red-400 p-1 rounded-md transition-colors"
                            title="Discard test"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </motion.div>
            )}
            
            {selectedResult && (
                <div className="fixed inset-0 bg-[#0a0f24] z-[100] flex flex-col text-white overflow-y-auto">
                    <div className="p-2 min-h-full">
                        <TestResultDetail result={selectedResult} onBack={() => window.history.back()} />
                    </div>
                </div>
            )}

            {recentTests.filter(test => {
                const hideUntil = localStorage.getItem('hide-' + test.id);
                if (hideUntil && now > parseInt(hideUntil)) return false;
                return true;
            }).length > 0 && (
                <div className="mb-3">
                    <h2 className="font-bold text-xs mb-1.5 text-orange-400">Recently Completed</h2>
                    {recentTests
                      .filter(test => {
                          const hideUntil = localStorage.getItem('hide-' + test.id);
                          if (hideUntil && now > parseInt(hideUntil)) return false;
                          return true;
                      })
                      .map(test => {
                        const elapsed = now - test.timestamp.getTime();
                        const isReady = elapsed >= 120000;
                        const remaining = Math.max(0, 120000 - elapsed);
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

                        return (
                        <div key={test.id} 
                            className="bg-gradient-to-r from-orange-900/40 to-red-900/40 p-2 rounded-md border border-orange-500/20 flex justify-between items-center mb-1"
                            onTouchStart={() => handleTouchStart(test.id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => handleTouchStart(test.id)}
                            onMouseUp={handleTouchEnd}
                        >
                            <div className="flex flex-col">
                                <span className="font-bold text-xs">{test.testName}</span>
                                {!isReady && (
                                    <span className="text-[8px] text-orange-300 animate-pulse font-mono flex items-center gap-1">
                                        <Clock className="w-2 h-2" /> Analyzing... {timeStr}
                                    </span>
                                )}
                            </div>
                            {isReady ? (
                                <button onClick={() => handleSeeResults(test)} className="bg-orange-600 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">See Results</button>
                            ) : (
                                <div className="bg-white/10 text-white/40 text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    <Loader2 className="w-2 h-2 animate-spin" /> Processing
                                </div>
                            )}
                        </div>
                    );})}
                </div>
            )}

            

            {/* Weakness Highlights */}
            {recentTests.filter(t => (t.score || 0) < 50).length > 0 && (
                <div className="mb-4 bg-red-900/20 p-3 rounded-xl border border-red-500/30">
                    <h2 className="font-bold text-xs mb-2 text-red-400 flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> Focus on these:</h2>
                    <div className="flex gap-2 flex-wrap">
                        {Array.from(new Set(recentTests.filter(t => (t.score || 0) < 50).map(t => t.testName))).slice(0, 3).map(chapter => (
                            <span key={chapter} className="bg-red-500/20 text-red-200 text-[10px] px-2 py-1 rounded-full font-bold">{chapter}</span>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="flex bg-card p-0.5 rounded-md mb-2">
                {(['Upcoming', 'Current', 'Missed'] as const).map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-0.5 rounded-md font-bold text-[10px] ${activeTab === tab ? 'bg-blue-600' : 'bg-transparent text-gray-400'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Daily Tests from Subjects */}
            <h2 className="font-bold text-xs mb-1.5 text-orange-400">Daily Study Plan</h2>
            <div className="space-y-1 mb-2">
                {dailyTests.map((test, idx) => (
                    <motion.div 
                        key={test.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-card p-2 rounded-md border border-border flex flex-row items-center justify-between gap-1"
                    >
                        <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`${test.bg} ${test.color} p-1 rounded-full flex-shrink-0`}>
                                <test.icon className="h-3 w-3" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-[10px] truncate">{test.name}</h3>
                                <p className="text-[8px] text-gray-400 mt-0 truncate">{test.type}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 ">
                            <button 
                                onClick={async () => {
                                    try {
                                        setLoading(true);
                                        let allQuestions: any[] = [];
                                        const encodedSubject = encodeURIComponent(test.subject.toLocaleLowerCase());
                                        const chapterName = test.type;
                                        const encodedChapterDir = encodeURIComponent(chapterName.toLocaleLowerCase());
                                        
                                        let chunkNumber = 1;
                                        while (chunkNumber <= 10) {
                                            let successfulFetch = false;
                                            
                                            const nameVariations = [
                                                chapterName,
                                                chapterName.replace(/ & /g, ' and '),
                                                chapterName.replace(/ and /g, ' & '),
                                                chapterName.toLocaleLowerCase()
                                            ];

                                            const urlsToTry: string[] = [];
                                            for (const variant of nameVariations) {
                                                urlsToTry.push(
                                                    `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodeURIComponent(variant)}/${encodeURIComponent(variant)}%20(${chunkNumber}).json`,
                                                    `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodeURIComponent(variant)}/${variant.toLocaleLowerCase().replace(/ /g, '_').replace(/:/g, '').replace(/_+/g, '_')}_chunk${chunkNumber}.json`
                                                );
                                            }

                                            let formattedName = chapterName.toLocaleLowerCase().replace(/ /g, '_').replace(/:/g, '').replace(/_+/g, '_');
                                            if (formattedName === "cell_the_unit_of_life") {
                                                formattedName = "cell_unit_of_life";
                                            }
                                            urlsToTry.push(
                                                `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodedChapterDir}/${formattedName}_chunk${chunkNumber}.json`
                                            );

                                            for (const url of urlsToTry) {
                                                try {
                                                    const response = await fetch(url);
                                                    if (response.ok) {
                                                        const data = await response.json();
                                                        if (data) {
                                                            const questionsArray = Array.isArray(data) ? data : data.questions;
                                                            if (questionsArray && Array.isArray(questionsArray)) {
                                                                allQuestions = [...allQuestions, ...questionsArray];
                                                                successfulFetch = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                } catch (e) {
                                                    // Silently ignore
                                                }
                                            }

                                            if (!successfulFetch) break;
                                            chunkNumber++;
                                        }

                                        let normalizedQuestions = allQuestions.map((q: any, i: number) => {
                                            let transformedOptions = q.options;
                                            if (Array.isArray(q.options)) {
                                                transformedOptions = {
                                                    A: q.options[0] || "",
                                                    B: q.options[1] || "",
                                                    C: q.options[2] || "",
                                                    D: q.options[3] || ""
                                                };
                                            }

                                            let transformedCorrect = q.correct_option;
                                            if (typeof q.correct_option === 'number') {
                                                transformedCorrect = ['A', 'B', 'C', 'D'][q.correct_option] || 'A';
                                            }

                                            return {
                                                id: `${chapterName}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                                                question: q.question,
                                                options: transformedOptions,
                                                correct_option: transformedCorrect,
                                                explanation: q.explanation || "No explanation provided."
                                            };
                                        });

                                        const finalQuestions = normalizedQuestions
                                            .sort(() => 0.5 - Math.random())
                                            .slice(0, 30);

                                        setLoading(false);

                                        if (finalQuestions.length === 0) {
                                            alert("No questions found for this chapter. Please try again or check your connection.");
                                        } else {
                                            setTestTitle(test.name);
                                            setPyqQuestions(finalQuestions);
                                            setIsPYQRunning(true);
                                        }
                                    } catch (e) {
                                        setLoading(false);
                                        console.error("Error starting daily test:", e);
                                        alert("Failed to start daily test. Please check your internet connection.");
                                    }
                                }}
                                className="bg-blue-600 text-white text-[9px] px-1.5 py-0 rounded-md font-bold w-auto"
                            >
                                Start
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

      {/* Filter dialog removed as per new tab design */}

      <div className="space-y-1">
        {filteredTests.map((test, idx) => {
          const testDate = test.targetDate.toDate ? test.targetDate.toDate() : new Date(test.targetDate);                
          testDate.setHours(0,0,0,0);
          return (
            <motion.div 
            key={test.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-card p-2 rounded-md border border-border flex flex-row items-center justify-between gap-1"
          >
            <div className="flex items-center gap-2 min-w-0">
                <div className={`${test.bg || 'bg-blue-500/20'} ${test.color || 'text-blue-400'} p-1.5 rounded-full flex-shrink-0`}>
                    {test.icon ? <test.icon className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                   <h3 className="font-bold text-[10px] sm:text-xs flex items-center gap-1 truncate">
                     {typeof test.name === 'string' ? test.name : (console.log('Invalid test name:', test.name), String(test.name))}
                     {test.chapters && (
                       <Info className="h-2.5 w-2.5 text-blue-400 cursor-pointer shrink-0" onClick={() => setSelectedScheduledTestForChapters(test)} />
                     )}
                   </h3>
                   <p className="text-[8px] text-gray-400 mt-0 truncate">
                     {test.type && <span className="bg-white/10 text-white px-1 py-0 rounded-full font-bold">{test.type}</span>}
                     {test.chapters && (
                       <button 
                         onClick={() => setSelectedScheduledTestForChapters(test)}
                         className="text-blue-400 text-[8px] font-bold underline ml-1"
                       >
                         See Syllabus
                       </button>
                     )}
                   </p>
                   <div className="flex gap-1 text-[8px] text-gray-500 mt-0">
                      <span className="flex items-center gap-0"><Clock className="h-2 w-2"/>{test.time}</span>
                      <span className="flex items-center gap-0"><ListOrdered className="h-2 w-2"/>{test.questions}</span>
                   </div>
                </div>
            </div>
            
            <div className="text-right w-auto">
                <button 
                  className={`${testDate.getTime() <= Date.now() ? 'bg-blue-600' : 'bg-gray-600'} text-white text-[9px] px-1.5 py-0 rounded-md flex items-center justify-center gap-0 font-bold whitespace-nowrap`}
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
                                        setTestTitle(test.name);
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
                    {testDate.getTime() <= Date.now() ? <><PlayCircle className="h-2.5 w-2.5 mr-0.5" /> Start</> : 'Upcoming'}
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
                  <p className="text-xs text-gray-400">Interactive Previous Year Questions</p>
                  </div>
          </div>
          <button className="text-orange-400 font-bold text-sm">Start PYQ &gt;</button>
      </motion.div>

      {selectedScheduledTestForChapters && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setSelectedScheduledTestForChapters(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-card rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-muted-foreground" onClick={() => setSelectedScheduledTestForChapters(null)}><X className="h-5 w-5"/></button>
                <h2 className="text-xl font-bold mb-4">Chapters in {selectedScheduledTestForChapters.name}</h2>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedScheduledTestForChapters.chapters?.map((c: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-card text-sm">
                            <span className="text-blue-400 font-bold">{c.subject}</span>: {c.name}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
      )}
      
      {showCustomOptions && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => { setShowCustomOptions(false); setSelectedSubject(null); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-card rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-muted-foreground" onClick={() => { setShowCustomOptions(false); setSelectedSubject(null); }}><X className="h-5 w-5"/></button>
                
                {!selectedSubject ? (
                    <>
                        <h2 className="text-xl font-bold mb-6">Select Subject</h2>
                        <div className="space-y-3">
                            {['Physics', 'Chemistry', 'Biology'].map(cat => (
                                <div key={cat} className="flex justify-between items-center p-4 rounded-xl bg-card border border-border cursor-pointer hover:border-blue-500/50 transition" onClick={() => setSelectedSubject(cat)}>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-card rounded-2xl p-6 relative" onClick={e => e.stopPropagation()}>
                <button className="absolute top-4 right-4 text-muted-foreground" onClick={() => setShowPYQOptions(false)}><X className="h-5 w-5"/></button>
                <h2 className="text-xl font-bold mb-6">Select PYQ</h2>
                <div className="space-y-4">
                    <select className="w-full p-4 rounded-xl bg-muted text-foreground" onChange={(e) => setSelectedYear(e.target.value)}>
                        <option value="">Select Year</option>
                        {['2021', '2022', '2023', '2024', '2025'].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="w-full p-4 rounded-xl bg-muted text-foreground" onChange={(e) => setSelectedSubForPYQ(e.target.value)}>
                        <option value="">Select Subject</option>
                        {['Biology', 'Chemistry', 'Physics'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex gap-3">
                        <button className="flex-1 bg-orange-600 py-3 rounded-xl font-bold hover:bg-orange-700 transition" onClick={async () => {
                            if (!selectedYear || !selectedSubForPYQ) return alert("Please select Year and Subject");
                            
                            try {
                                const url = `https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/${selectedYear}/NEET_${selectedYear}_${selectedSubForPYQ}.json`;
                                const response = await fetch(url);
                                if (!response.ok) throw new Error("Could not fetch test");
                                const data = await response.json();
                                
                                // Map to GitHub hosted PDF for faster access
                                const paperMapping: Record<string, string> = {
                                    '2024': 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2024/NEET_2024.pdf',
                                    '2023': 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2023/NEET_2023.pdf',
                                    '2022': 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2022/NEET_2022.pdf',
                                    '2021': 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2021/NEET_2021.pdf',
                                    '2020': 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2020/NEET_2020.pdf'
                                };
                                
                                setCurrentPaperUrl(paperMapping[selectedYear]);
                                setTestTitle(`${selectedYear} (${selectedSubForPYQ})`);
                                setPyqQuestions(data.questions || []);
                                setShowPYQOptions(false);
                                setIsPYQRunning(true);
                            } catch (err) {
                                alert("Error fetching test questions. Try View PDF for the full paper.");
                            }
                        }}>Fetch Test</button>
                        
                        <button 
                            className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50" 
                            disabled={isGeneratingPdf}
                            onClick={async () => {
                                if (!selectedYear || !selectedSubForPYQ) return alert("Please select Year and Subject to generate PDF");
                                
                                setIsGeneratingPdf(true);
                                console.log(`[PDF] Requesting PDF for ${selectedYear} - ${selectedSubForPYQ}`);
                                try {
                                    const url = `https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/${selectedYear}/NEET_${selectedYear}_${selectedSubForPYQ}.json`;
                                    console.log(`[PDF] Fetching JSON from: ${url}`);
                                    const response = await fetch(url);
                                    
                                    if (!response.ok) {
                                        console.error(`[PDF] Fetch failed with status: ${response.status}`);
                                        throw new Error(`Could not fetch test data (${response.status})`);
                                    }
                                    
                                    const data = await response.json();
                                    console.log(`[PDF] Successfully fetched JSON. Questions: ${data.questions?.length}`);
                                    
                                    if (!data.questions || data.questions.length === 0) {
                                        throw new Error("No questions found in this paper JSON.");
                                    }

                                    const pdfUrl = generateNEETPdf({
                                        exam: 'NEET',
                                        year: selectedYear,
                                        subject: selectedSubForPYQ,
                                        questions: data.questions
                                    }, true); 
                                    
                                    console.log(`[PDF] Generated Blob URL: ${pdfUrl}`);
                                    
                                    setActivePdf({
                                        url: pdfUrl,
                                        title: `NEET ${selectedYear} - ${selectedSubForPYQ}`
                                    });
                                } catch (err) {
                                    console.error("[PDF] Error:", err);
                                    alert("Error generating PDF: " + (err as Error).message);
                                } finally {
                                    setIsGeneratingPdf(false);
                                }
                            }}
                        >
                            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : 'View PDF 📄'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
      )}
      {loading && (
          <div className="fixed inset-0 bg-background z-[200] flex flex-col items-center justify-center text-foreground">
              <div className="w-16 h-16 border-4 border-t-blue-600 border-muted rounded-full animate-spin mb-4"></div>
              <h2 className="text-xl font-bold">Starting Test...</h2>
              <p className="text-lg text-muted-foreground mt-2">{timer}s</p>
          </div>
      )}
      </>
      )}
      
      {activePdf && (
           <AdvancedPDFViewer 
               pdfUrl={activePdf.url} 
               title={activePdf.title} 
               onClose={() => setActivePdf(null)} 
           />
      )}
    </div>
  );
}
