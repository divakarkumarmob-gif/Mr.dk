import {useState, useEffect, useRef} from 'react';
import {collection, onSnapshot, query, orderBy, getDocs, where} from 'firebase/firestore';                
import {db, auth} from '../lib/firebase';
import {ChevronDown, Leaf, Atom, Beaker, Play, Eye, EyeOff, AlertTriangle, Clock, Loader2} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import HubSwitcher from './HubSwitcher';
import VideoPlayer from './VideoPlayer';
import BattleRoom from './BattleRoom';
import TestResultDetail from './TestResultDetail';
import Flashcards from './Flashcards';
import StudyDashboard from './StudyDashboard';
import PrivateVideos from './PrivateVideos';

const CHAPTER_DATA: any = {
    Physics: { 
        'Class 11': ['Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Circular Motion', 'Laws of Motion', 'Work, Energy & Power', 'System of Particles & Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'],
        'Class 12': ['Nomenclature', 'Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity', 'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics and Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics']
    },
    Chemistry: {
        'Class 11': ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity in Properties', 'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Organic Chemistry: Some Basic Principles and Techniques', 'Hydrocarbons'],
        'Class 12': ['Nomenclature', 'Chemical Kinetics', 'Solutions', 'Electrochemistry', 'General Principles and Processes of Isolation of Elements', 'p-Block Elements', 'd- and f-Block Elements', 'Coordination Compounds', 'Haloalkanes and Haloarenes', 'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines', 'Biomolecules']
    },
    Biology: {
        'Class 11': ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Plant Physiology', 'Human Physiology'],
        'Class 12': ['Nomenclature', 'Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health and Disease', 'Strategies for Enhancement in Food Production', 'Microbes in Human Welfare', 'Biotechnology: Principles and Processes', 'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues']
    }
};

export default function StudyHub({ subjects, onNavigate, setResumingTest, setCurrentView, isFocusMode, setIsFocusMode, setShowSummary, distractionSensitivity, setDistractionSensitivity, focusedTime, distractedTime, videoRef, isLooking, startDetectionLoop, setShowFlashcards, setShowStudyDashboard, setShowPrivateVideos }: { subjects: any[], onNavigate: (view: any) => void, setResumingTest: (data: any) => void, setCurrentView: (view: any) => void, isFocusMode: boolean, setIsFocusMode: (val: boolean) => void, setShowSummary: (val: boolean) => void, distractionSensitivity: number, setDistractionSensitivity: (val: number) => void, focusedTime: number, distractedTime: number, videoRef: React.RefObject<HTMLVideoElement>, isLooking: boolean, startDetectionLoop: () => void, setShowFlashcards: (val: boolean) => void, setShowStudyDashboard: (val: boolean) => void, setShowPrivateVideos: (val: boolean) => void }) {
    const [savedTest, setSavedTest] = useState<any>(null);
    const [recentTests, setRecentTests] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any>(null);
    const [pressTimer, setPressTimer] = useState<any>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

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
                
                const currentNow = Date.now();
                setRecentTests(tests.filter(t => {
                    const hideUntil = localStorage.getItem('hide-' + t.id);
                    if (hideUntil) {
                        if (currentNow > parseInt(hideUntil)) return false;
                    }
                    return true;
                }));
            } catch (e: any) {
                console.error("Error fetching recent tests in StudyHub:", e);
            }
        };
        fetchRecentTests();
    }, []);

    // Focus Mode - removed local state in favor of global state in App.tsx

    const handleSeeResults = (test: any) => {
        setSelectedResult(test);
        window.history.pushState({ view: 'study', isResultOpen: true }, '', window.location.href);
        if (!localStorage.getItem('hide-' + test.id)) {
            localStorage.setItem('hide-' + test.id, (Date.now() + 10 * 60 * 1000).toString());
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

    // Mock data for user progress
    const stats = { tests: 0, questions: 0, accuracy: '0%', time: '0m' };
    const subjectProgress = [
      { name: 'Biology', icon: Leaf, progress: 72, color: 'bg-green-500' },
      { name: 'Physics', icon: Atom, progress: 58, color: 'bg-blue-500' },
      { name: 'Chemistry', icon: Beaker, progress: 61, color: 'bg-orange-500' }
    ];

    const [activeUsers, setActiveUsers] = useState<Record<string, number>>({});
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const [pendingChapter, setPendingChapter] = useState<{subject: string, chapter: string} | null>(null);

    useEffect(() => {
        const q = collection(db, 'chapterActivity');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                data[doc.id] = doc.data().totalActive;
            });
            setActiveUsers(data);
        });
        return () => unsubscribe();
    }, []);                

    const accordionItems = ["LECTURE LIBRARY", "PRIVATE VIDEOS", "CUSTOM PRACTICE", "BATTLE & PRACTICE", "MEMORY VAULT", "FLASHCARDS", "STUDY PROGRESS"];
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [activeSubject, setActiveSubject] = useState<string>('Physics');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [activeBattleChapter, setActiveBattleChapter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-[#0a0f24] text-white font-sans flex flex-col"
        >
          <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl w-full flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
                <HubSwitcher active="study" onNavigate={onNavigate} />
            </div>
          
          <div className="bg-[#161e38] rounded-xl border border-white/5 p-3 mb-4 flex justify-between items-center">
              <button onClick={() => setShowSummary(true)} className="font-bold text-xs tracking-widest text-orange-400">FOCUS MODE</button>
              <button 
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${isFocusMode ? 'bg-red-900/50 text-red-500' : 'bg-white/10 text-white'}`}
              >
                  {isFocusMode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {isFocusMode ? "ON" : "OFF"}
              </button>
          </div>
          
          {selectedResult && (
            <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-2 flex flex-col text-white">
                <TestResultDetail result={selectedResult} onBack={() => window.history.back()} />
            </div>
          )
        }
          
          {recentTests.length > 0 && (
                <div className="mb-4">
                    <h2 className="font-bold mb-2 text-xs text-orange-400 uppercase">Recently Completed</h2>
                    {recentTests.map(test => {
                        const elapsed = now - test.timestamp.getTime();
                        const isReady = elapsed >= 120000;
                        const remaining = Math.max(0, 120000 - elapsed);
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

                        return (
                        <div key={test.id} 
                            className="bg-orange-900/30 p-3 rounded-lg border border-orange-500/50 flex justify-between items-center mb-1.5"
                            onTouchStart={() => handleTouchStart(test.id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => handleTouchStart(test.id)}
                            onMouseUp={handleTouchEnd}
                        >
                             <div className="flex flex-col">
                                <h3 className="font-bold text-sm">{test.testName}</h3>
                                {!isReady && (
                                    <span className="text-[10px] text-orange-300 animate-pulse font-mono flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Analyzing... {timeStr}
                                    </span>
                                )}
                             </div>
                            {isReady ? (
                                <button onClick={() => handleSeeResults(test)} className="bg-orange-600 px-3 py-1 rounded-lg text-xs font-bold">See Results</button>
                            ) : (
                                <div className="bg-white/10 text-white/40 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Processing
                                </div>
                            )}
                        </div>
                    );})}
                </div>
            )
        }
          
          {savedTest && (
            <div className="bg-orange-900/30 p-3 rounded-lg border border-orange-500/50 mb-4 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-sm">Resume Test</h3>
                    <p className="text-[10px] text-orange-200">{savedTest.title}</p>
                </div>
                <button 
                  onClick={() => {
                        setResumingTest(savedTest);
                        setCurrentView('practiceTest');
                  }}
                  className="bg-orange-600 px-3 py-1 rounded-lg text-xs font-bold"
                >Resume</button>
            </div>
          )
        }
          
          {isFocusMode && (
                <div className="bg-[#161e38] rounded-xl border border-white/5 p-3 mb-3">
                  <div className="flex justify-between text-[10px] text-white/60 mb-1">
                    <span>Focused: {Math.floor(focusedTime / 1000)}s</span>
                    <span>Distracted: {Math.floor(distractedTime / 1000)}s</span>
                  </div>
                  <label className="text-[10px] text-white/60 mb-0.5 block">Sensitivity: {Math.round(distractionSensitivity / 10)}s threshold</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={distractionSensitivity} 
                    onChange={(e) => setDistractionSensitivity(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  {(focusedTime > 0 || distractedTime > 0) && (
                    <button
                        onClick={() => setShowSummary(true)}
                        className="mt-2 w-full bg-blue-600/20 text-blue-400 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-600/30 transition"
                    >
                        View Last Session
                    </button>
                  )
                }
                </div>
              )
        }

          {isFocusMode && (
              <motion.div 
                  drag
                  dragMomentum={false}
                  className="fixed top-20 right-4 z-[2000] w-48 bg-black/80 rounded-2xl p-2 border border-white/10 shadow-2xl cursor-move"
              >
                  <video ref={videoRef} className="w-full rounded-xl scale-x-[-1]" muted playsInline autoPlay onLoadedMetadata={startDetectionLoop} />
                  {!isLooking && (
                      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-red-900/80 rounded-xl">
                          <AlertTriangle className="h-8 w-8 text-white mb-2" />
                          <span className="text-white font-bold">Look here!</span>
                      </div>
                  )}
              </motion.div>
          )}

          {activeBattleChapter && (
              <BattleRoom chapter={activeBattleChapter} onFinish={(winner) => {
                  alert(`Winner: ${winner}`);
                  setActiveBattleChapter(null);
              }} />
          )}
          
          <div className="text-gray-400 text-sm mt-4 text-center">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          {selectedChapter && (
            <VideoPlayer topic={selectedChapter} onClose={() => setSelectedChapter(null)} />
          )}
          
          <div className="space-y-3 mt-8 pb-20">
            {accordionItems.map(item => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={item} 
                    className="bg-[#161e38] rounded-2xl border border-white/5"
                >
                    <button 
                        className="w-full p-4 flex justify-between items-center font-bold text-xs tracking-wider"
                        onClick={() => {
                            if (item === "CUSTOM PRACTICE") {
                                onNavigate('customPractice');
                            } else if (item === 'FLASHCARDS') {
                                setShowFlashcards(true);
                            } else if (item === 'STUDY PROGRESS') {
                                setShowStudyDashboard(true);
                            } else if (item === 'PRIVATE VIDEOS') {
                                setShowPrivateVideos(true);
                            } else {
                                setExpandedItem(expandedItem === item ? null : item);
                            }
                        }}
                    >
                        {item}
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedItem === item ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedItem === item && (
                        <div className="p-3 pt-0 text-white text-xs">
                            {item === "LECTURE LIBRARY" ? (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full p-2 bg-white/5 rounded-md mb-2 text-[10px]"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <div className="flex gap-1 mb-2 border-b border-white/10 pb-1">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-2 font-bold text-xs ${activeSubject === sub ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
                                                onClick={() => { setActiveSubject(sub); setSearchQuery(''); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-4">
                                        {Object.entries(CHAPTER_DATA[activeSubject]).map(([cls, chapters]: [string, any]) => (
                                            <div key={cls}>
                                                <h4 className="font-bold text-xs text-orange-500 mb-2">{cls}</h4>
                                                {chapters
                                                    .filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .map((chapter: string) => (
                                                        <div 
                                                            key={chapter} 
                                                            className="p-3 bg-white/5 rounded-lg mb-2 text-xs text-white cursor-pointer hover:bg-orange-500/20 flex items-center justify-between group relative"
                                                            onClick={() => {
                                                                setSelectedChapter(chapter);
                                                            }}
                                                            onTouchStart={() => {
                                                                longPressTimer.current = setTimeout(() => {
                                                                    setPendingChapter({subject: activeSubject, chapter});
                                                                }, 800);
                                                            }}
                                                            onTouchEnd={() => {
                                                                if (longPressTimer.current) clearTimeout(longPressTimer.current);
                                                            }}
                                                            onContextMenu={(e) => e.preventDefault()}
                                                        >
                                                            {chapter}
                                                            <Play className="h-4 w-4 text-orange-500" />
                                                            <div className="absolute hidden group-hover:block bg-black p-2 rounded text-[10px] whitespace-nowrap">Hold to set as home</div>
                                                        </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>) : item === "BATTLE & PRACTICE" ? (
                                <>
                                    <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-2 font-bold text-xs ${activeSubject === sub ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
                                                onClick={() => { setActiveSubject(sub); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-4">
                                        {Object.entries(CHAPTER_DATA[activeSubject])
                                            .flatMap(([cls, chapters]: [string, any]) => 
                                                chapters.map((c: string) => ({ chapter: c, active: activeUsers[c] || 0 }))
                                            )
                                            .sort((a, b) => b.active - a.active)
                                            .map(({ chapter, active }) => (
                                                <div key={chapter} className="p-3 bg-white/5 rounded-lg mb-2 text-xs flex items-center justify-between cursor-pointer hover:bg-orange-500/20"
                                                     onClick={() => setActiveBattleChapter(chapter)}>
                                                    <span>{chapter}</span>
                                                    <span className="text-orange-500 font-bold">{active} Active</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </>
                            ) : (
                                `Content for ${item} goes here...`
                            )}
                        </div>
                    )}
                </motion.div>
            ))}
          </div>
            {pendingChapter && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
                    <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm text-center">
                        <h2 className="text-xl font-bold mb-4">Set as Home?</h2>
                        <p className="text-gray-300">Set "{pendingChapter.chapter}" as current subject?</p>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setPendingChapter(null)} className="flex-1 bg-gray-700 py-2 rounded-lg font-bold">No</button>
                            <button onClick={() => {
                                (window as any).setAsHomeScreen?.(pendingChapter.subject, pendingChapter.chapter);
                                setPendingChapter(null);
                            }} className="flex-1 bg-blue-600 py-2 rounded-lg font-bold">Yes</button>
                        </div>
                    </div>
                </div>
            )}
          <div className="text-center mt-auto py-4">
             <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500">
                 Powered by DK
             </span>
           </div>
          </div>
        </motion.div>
    )

 
}
