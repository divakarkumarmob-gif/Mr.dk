import {useState, useEffect, useRef} from 'react';
import {collection, onSnapshot, query, orderBy, getDocs, where, doc, updateDoc} from 'firebase/firestore';                
import {db, auth} from '../lib/firebase';
import {ChevronDown, Leaf, Atom, Beaker, Play, Eye, EyeOff, AlertTriangle, Clock, Loader2, X, Shield, Trophy, Sparkles, Zap} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import HubSwitcher from './HubSwitcher';
import VideoPlayer from './VideoPlayer';
import BattleRoom from './BattleRoom';
import TestResultDetail from './TestResultDetail';
import Flashcards from './Flashcards';
import StudyDashboard from './StudyDashboard';
import PrivateVideos from './PrivateVideos';
import NCERTRevisionPlanner from './NCERTRevisionPlanner';

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

export default function StudyHub({ subjects, onNavigate, setResumingTest, setCurrentView, isFocusMode, setIsFocusMode, setShowSummary, distractionSensitivity, setDistractionSensitivity, focusedTime, distractedTime, videoRef, isLooking, startDetectionLoop, setShowFlashcards, setShowStudyDashboard, setShowPrivateVideos }: { subjects: any[], onNavigate: (view: any, params?: Record<string, string>) => void, setResumingTest: (data: any) => void, setCurrentView: (view: any, params?: Record<string, string>) => void, isFocusMode: boolean, setIsFocusMode: (val: boolean) => void, setShowSummary: (val: boolean) => void, distractionSensitivity: number, setDistractionSensitivity: (val: number) => void, focusedTime: number, distractedTime: number, videoRef: React.RefObject<HTMLVideoElement>, isLooking: boolean, startDetectionLoop: () => void, setShowFlashcards: (val: boolean) => void, setShowStudyDashboard: (val: boolean) => void, setShowPrivateVideos: (val: boolean) => void }) {
    const [savedTest, setSavedTest] = useState<any>(null);
    const [recentTests, setRecentTests] = useState<any[]>([]);
    const [selectedResult, setSelectedResult] = useState<any>(null);
    const [selectedSyllabusTest, setSelectedSyllabusTest] = useState<any>(null);
    const [pressTimer, setPressTimer] = useState<any>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const dropdownRefs = useRef(new Map());

    useEffect(() => {
        function handleClickOutside(event: any) {
            if (openDropdownId && dropdownRefs.current.has(openDropdownId) && !dropdownRefs.current.get(openDropdownId)?.contains(event.target)) {
                setOpenDropdownId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openDropdownId]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'users', auth.currentUser.uid, 'results'), orderBy('timestamp', 'desc'));
        // Real-time listener (see TestHub.tsx for the same fix + reasoning):
        // guarantees a removed test (hidden:true) can't reappear from a
        // stale one-time fetch on re-navigation.
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tests = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
                };
            }).filter((t: any) => !t.hidden);

            setRecentTests(tests.slice(0, 3));
        }, (e) => {
            console.error("Error fetching recent tests in StudyHub:", e);
        });
        return () => unsubscribe();
    }, []);

    // Focus Mode - removed local state in favor of global state in App.tsx

    const handleSeeResults = (test: any) => {
        setSelectedResult(test);
        window.history.pushState({ view: 'study', isResultOpen: true }, '', window.location.href);
        if (!localStorage.getItem('hide-' + test.id)) {
            localStorage.setItem('hide-' + test.id, (Date.now() + 30 * 1000).toString());
        }
    }

    useEffect(() => {
        const handlePop = () => {
            if (selectedResult && !window.history.state?.isResultOpen) {
                setSelectedResult(null);
            }
            if (selectedSyllabusTest) {
                setSelectedSyllabusTest(null);
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [selectedResult, selectedSyllabusTest]);

    const removeTest = async (testId: string) => {
        try {
            await updateDoc(doc(db, 'users', auth.currentUser!.uid, 'results', testId), { hidden: true });
            setRecentTests(prev => prev.filter(t => t.id !== testId));
        } catch (e) {
            console.error("Error hiding test:", e);
        }
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-dvh bg-[#070b19] text-slate-100 font-sans flex flex-col relative pb-24"
        >
          {/* Ambient Glow Orbs in Background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-40 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full flex flex-col h-full px-3 sm:px-6 max-w-5xl mx-auto relative z-10 pt-3">
            
            <div className="text-gray-400 text-sm mb-2 text-center">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="flex justify-between items-center mb-2">
                <HubSwitcher active="study" onNavigate={onNavigate} />
            </div>

            {/* Quick Feature Action Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCurrentView('focusSanctuary')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900/90 to-purple-950/80 border border-indigo-500/30 text-left hover:border-indigo-400/60 transition shadow-lg group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/25 transition" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition duration-300">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-xs text-white flex items-center gap-1">
                                Focus Sanctuary <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                            </div>
                            <div className="text-[10px] text-indigo-200/70 mt-0.5">Lofi Ambient Mode</div>
                        </div>
                    </div>
                </motion.button>

                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setCurrentView('rankPredictor')}
                    className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/80 via-slate-900/90 to-orange-950/80 border border-amber-500/30 text-left hover:border-amber-400/60 transition shadow-lg group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/25 transition" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition duration-300">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-xs text-white flex items-center gap-1">
                                AIR Rank Predictor <Zap className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div className="text-[10px] text-amber-200/70 mt-0.5">Matrix Rank Engine</div>
                        </div>
                    </div>
                </motion.button>
            </div>

            {/* DAILY NCERT REVISION TARGETS WIDGET */}
            <div className="mb-4">
                <NCERTRevisionPlanner />
            </div>

            {/* Focus Mode Control Bar */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-3 mb-4 flex justify-between items-center backdrop-blur-md shadow-md">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                    <button onClick={() => setShowSummary(true)} className="font-extrabold text-xs tracking-wider text-cyan-300 hover:text-cyan-200 transition">
                        NEET FOCUS ENGINE
                    </button>
                </div>
                <button 
                  onClick={() => setIsFocusMode(!isFocusMode)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full font-bold text-xs transition-all shadow-md cursor-pointer ${
                    isFocusMode 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-rose-500/20' 
                        : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-500/20 hover:scale-105'
                  }`}
                >
                    {isFocusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {isFocusMode ? "DISENGAGE FOCUS" : "ENGAGE FOCUS"}
                </button>
            </div>
          
          {selectedResult && (
            <div className="fixed inset-0 bg-[#070b19] z-[100] p-2 flex flex-col text-white">
                <TestResultDetail result={selectedResult} onBack={() => setSelectedResult(null)} />
            </div>
          )}
          
          {recentTests.length > 0 && (
                <div className="mb-4">
                    <h2 className="font-extrabold mb-2.5 text-xs text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> Recently Completed Tests
                    </h2>
                    <div className="space-y-2">
                        {recentTests.map(test => {
                            const elapsed = now - test.timestamp.getTime();
                            const isReady = elapsed >= 120000;
                            const remaining = Math.max(0, 120000 - elapsed);
                            const mins = Math.floor(remaining / 60000);
                            const secs = Math.floor((remaining % 60000) / 1000);
                            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

                            return (
                            <div key={test.id} 
                                className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 hover:border-cyan-500/40 flex justify-between items-center transition shadow-md cursor-pointer group"
                                ref={el => { if (el) dropdownRefs.current.set(test.id, el); else dropdownRefs.current.delete(test.id); }}
                                onClick={() => setOpenDropdownId(openDropdownId === test.id ? null : test.id)}
                            >
                                 <div className="flex flex-col">
                                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition">{test.testName}</h3>
                                    {!isReady && (
                                        <span className="text-[10px] text-amber-400 animate-pulse font-mono flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3" /> Processing Detailed Analysis... ({timeStr})
                                        </span>
                                    )}
                                 </div>
                                {isReady ? (
                                        <div className="relative">
                                            <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md shadow-cyan-500/20">
                                                Results & Review
                                            </div>
                                            {openDropdownId === test.id && (
                                                <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-20 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => { handleSeeResults(test); setOpenDropdownId(null); }} className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-cyan-500/20 hover:text-cyan-300 transition font-medium">See Results</button>
                                                    <button onClick={() => { setSelectedSyllabusTest(test); setOpenDropdownId(null); }} className="block w-full text-left px-3 py-2 text-xs text-white hover:bg-cyan-500/20 hover:text-cyan-300 transition font-medium">Syllabus</button>
                                                    <button onClick={() => { removeTest(test.id); setOpenDropdownId(null); }} className="block w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/20 transition font-medium">Remove</button>
                                                </div>
                                            )}
                                        </div>
                                ) : (
                                    <div className="bg-slate-800 text-slate-400 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Analyzing
                                    </div>
                                )}
                            </div>
                        );})}
                    </div>
                </div>
            )}
          
          {savedTest && (
            <div className="bg-gradient-to-r from-blue-950/60 to-cyan-950/60 p-4 rounded-2xl border border-cyan-500/40 mb-4 flex justify-between items-center shadow-lg">
                <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                        <Zap className="h-4 w-4 text-cyan-400" /> Resume Saved Test
                    </h3>
                    <p className="text-xs text-cyan-200/80 mt-0.5">{savedTest.title}</p>
                </div>
                <button 
                  onClick={() => {
                        setResumingTest(savedTest);
                        setCurrentView('practiceTest');
                  }}
                  className="bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950 font-extrabold px-4 py-1.5 rounded-full text-xs shadow-md shadow-cyan-500/30 hover:scale-105 transition"
                >Resume Now</button>
            </div>
          )}
          
          {isFocusMode && (
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 mb-4 shadow-xl">
                  <div className="flex justify-between text-xs text-slate-300 mb-2 font-medium">
                    <span className="text-emerald-400">Focused: {Math.floor(focusedTime / 1000)}s</span>
                    <span className="text-rose-400">Distracted: {Math.floor(distractedTime / 1000)}s</span>
                  </div>
                  <label className="text-xs text-slate-400 mb-1 block">AI Sensitivity: {Math.round(distractionSensitivity / 10)}s threshold</label>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={distractionSensitivity} 
                    onChange={(e) => setDistractionSensitivity(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  {(focusedTime > 0 || distractedTime > 0) && (
                    <button
                        onClick={() => setShowSummary(true)}
                        className="mt-3 w-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 py-2 rounded-xl font-bold text-xs hover:bg-cyan-500/25 transition"
                    >
                        View Last Session Analytics
                    </button>
                  )}
                </div>
              )}

          {isFocusMode && (
              <motion.div 
                  drag
                  dragMomentum={false}
                  className="fixed top-20 right-4 z-[2000] w-48 bg-slate-950/90 rounded-2xl p-2 border border-slate-700 shadow-2xl cursor-move backdrop-blur-lg"
              >
                  <video ref={videoRef} className="w-full rounded-xl scale-x-[-1]" muted playsInline autoPlay onLoadedMetadata={startDetectionLoop} />
                  {!isLooking && (
                      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-rose-950/80 rounded-xl backdrop-blur-sm">
                          <AlertTriangle className="h-8 w-8 text-rose-400 mb-2 animate-bounce" />
                          <span className="text-white font-extrabold text-xs">Stay Focused!</span>
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
          
          {/* Main Categorized Learning Hub Accordions */}
          <div className="space-y-3 mt-2">
            {accordionItems.map(item => (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={item} 
                    className="bg-slate-900/80 rounded-2xl border border-slate-800/90 shadow-md overflow-hidden hover:border-slate-700 transition duration-200"
                >
                    <button 
                        className="w-full p-4 flex justify-between items-center font-extrabold text-xs tracking-wider text-slate-200 hover:text-cyan-300 transition cursor-pointer"
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
                        <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" />
                            {item}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${expandedItem === item ? 'rotate-180 text-cyan-400' : ''}`} />
                    </button>
                    {expandedItem === item && (
                        <div className="p-4 pt-1 text-slate-200 text-xs border-t border-slate-800/60 bg-slate-950/40">
                            {item === "LECTURE LIBRARY" ? (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Search topic or chapter name..."
                                        className="w-full p-2.5 bg-slate-900 rounded-xl mb-3 text-xs border border-slate-800 text-slate-100 focus:outline-none focus:border-cyan-400 transition"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <div className="flex gap-2 mb-3 border-b border-slate-800/80 pb-2">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                                    activeSubject === sub 
                                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20' 
                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                                }`}
                                                onClick={() => { setActiveSubject(sub); setSearchQuery(''); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
                                        {Object.entries(CHAPTER_DATA[activeSubject]).map(([cls, chapters]: [string, any]) => (
                                            <div key={cls}>
                                                <h4 className="font-extrabold text-xs text-cyan-400 mb-2 tracking-wide uppercase">{cls}</h4>
                                                {chapters
                                                    .filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .map((chapter: string) => (
                                                        <div 
                                                            key={chapter} 
                                                            className="p-3 bg-slate-900/90 rounded-xl mb-2 text-xs text-slate-200 cursor-pointer hover:bg-slate-800 hover:border-cyan-500/40 border border-slate-800/80 flex items-center justify-between group transition duration-200"
                                                            onClick={() => {
                                                                setCurrentView('chapter', { chapterName: chapter });
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
                                                            <span className="font-medium group-hover:text-cyan-300 transition">{chapter}</span>
                                                            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                                                                <Play className="h-3.5 w-3.5 fill-current" />
                                                            </div>
                                                        </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>) : item === "BATTLE & PRACTICE" ? (
                                <>
                                    <div className="flex gap-2 mb-3 border-b border-slate-800/80 pb-2">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                                    activeSubject === sub 
                                                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20' 
                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                                }`}
                                                onClick={() => { setActiveSubject(sub); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                        {Object.entries(CHAPTER_DATA[activeSubject])
                                            .flatMap(([cls, chapters]: [string, any]) => 
                                                chapters.map((c: string) => ({ chapter: c, active: activeUsers[c] || 0 }))
                                            )
                                            .sort((a, b) => b.active - a.active)
                                            .map(({ chapter, active }) => (
                                                <div key={chapter} className="p-3 bg-slate-900/90 rounded-xl text-xs flex items-center justify-between cursor-pointer hover:bg-slate-800 border border-slate-800/80 transition"
                                                     onClick={() => setActiveBattleChapter(chapter)}>
                                                    <span className="font-medium text-slate-200">{chapter}</span>
                                                    <span className="text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-800/50">
                                                        {active} Live Aspirants
                                                    </span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </>
                            ) : (
                                <div className="py-4 text-center text-slate-400 text-xs">
                                    Feature ready to launch for {item}.
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            ))}
          </div>

          {selectedSyllabusTest && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6" onClick={() => setSelectedSyllabusTest(null)}>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                      <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setSelectedSyllabusTest(null)}><X className="h-5 w-5"/></button>
                      <h2 className="text-lg font-extrabold text-white mb-2">Syllabus Details</h2>
                      <p className="text-xs text-cyan-300 font-semibold mb-4">{selectedSyllabusTest.testName}</p>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">{selectedSyllabusTest.type || "No specific syllabus details available."}</p>
                  </motion.div>
              </div>
          )}

          {pendingChapter && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm text-center shadow-2xl">
                      <h2 className="text-lg font-extrabold text-white mb-2">Pin Chapter to Home?</h2>
                      <p className="text-xs text-slate-300 mb-6">Set "{pendingChapter.chapter}" as your active target chapter?</p>
                      <div className="flex gap-3">
                          <button onClick={() => setPendingChapter(null)} className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-700 transition">Cancel</button>
                          <button onClick={() => {
                              (window as any).setAsHomeScreen?.(pendingChapter.subject, pendingChapter.chapter);
                              setPendingChapter(null);
                          }} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-cyan-500/20 hover:scale-105 transition">Confirm</button>
                      </div>
                  </div>
              </div>
          )}

          <div className="text-center mt-auto py-6">
             <span className="font-extrabold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                 NeetMaster AI • Powered by DK
             </span>
           </div>
          </div>
        </motion.div>
    )
}

