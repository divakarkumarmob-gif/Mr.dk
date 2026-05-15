/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useState, useEffect} from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {onAuthStateChanged, User} from 'firebase/auth';
import {auth, db} from './lib/firebase';
import {doc, getDoc, setDoc, getDocs, collection, query, orderBy, limit, addDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp} from 'firebase/firestore'; 
import {updateUserPresence} from './services/chatService';
import AnalysisHistory from './components/AnalysisHistory';
import FloatingAIAgent from './components/FloatingAIAgent';
import Login from './components/Login';
import StudyHub from './components/StudyHub';
import CustomPractice from './components/CustomPractice';
import PracticeTest from './components/PracticeTest';
import PYQTestRunner from './components/PYQTestRunner';
import HubSwitcher from './components/HubSwitcher';
import VideoPlayer from './components/VideoPlayer';
import Profile from './components/Profile';
import EditProfile from './components/EditProfile';
import AdminPanel from './components/AdminPanel';
import AdminChatPage from './components/AdminChatPage';
import TestHub from './components/TestHub';
import Notes from './components/Notes';
import BottomNav from './components/BottomNav';
import UserChat from './components/UserChat';
import NeuralSolver from './components/NeuralSolver';
import LiveAIInterface from './components/LiveAIInterface';
import SupportModal from './components/SupportModal';
import TimeSpentChart from './components/TimeSpentChart';
import { Bell, Home, BarChart2, FileText, User as UserIcon, Play, Book, CheckCircle2, Target, Clock, Shuffle, MessageCircle, X } from 'lucide-react';
import { PHYSICS_CHAPTERS, CHEMISTRY_CHAPTERS, BIOLOGY_CHAPTERS } from './constants';
import { motion } from 'motion/react';
import { useReportProblemGesture } from './lib/useReportProblemGesture';

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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getISTDateString = () => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0];
};

// Function to calculate day index using resetDay marker stored in Firestore
const getDayIndex = (resetDayMarker?: number) => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istTime = new Date(now.getTime() + istOffset);
    // 1 AM IST = 01:00.
    // If it's before 1AM, we are on the previous day.
    const day = Math.floor((istTime.getTime() - (1 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
    
    if (resetDayMarker !== undefined) {
        return Math.max(0, day - resetDayMarker);
    }
    
    return day;
};

const getNewUserChapters = () => {
    return [
        { name: 'PHYSICS', topic: PHYSICS_CHAPTERS[0], color: 'border-blue-500' },
        { name: 'CHEMISTRY', topic: CHEMISTRY_CHAPTERS[0], color: 'border-orange-500' },
        { name: 'BIOLOGY', topic: BIOLOGY_CHAPTERS[0], color: 'border-green-500' },
    ];
};

const getDailyChapters = () => {
    const dayIdx = getDayIndex();
    return [
        { name: 'PHYSICS', topic: PHYSICS_CHAPTERS[dayIdx % PHYSICS_CHAPTERS.length], color: 'border-blue-500' },
        { name: 'CHEMISTRY', topic: CHEMISTRY_CHAPTERS[dayIdx % CHEMISTRY_CHAPTERS.length], color: 'border-orange-500' },
        { name: 'BIOLOGY', topic: BIOLOGY_CHAPTERS[dayIdx % BIOLOGY_CHAPTERS.length], color: 'border-green-500' },
    ];
};

const getRandomChapters = () => {
    return [
        { name: 'PHYSICS', topic: PHYSICS_CHAPTERS[Math.floor(Math.random() * PHYSICS_CHAPTERS.length)], color: 'border-blue-500' },
        { name: 'CHEMISTRY', topic: CHEMISTRY_CHAPTERS[Math.floor(Math.random() * CHEMISTRY_CHAPTERS.length)], color: 'border-orange-500' },
        { name: 'BIOLOGY', topic: BIOLOGY_CHAPTERS[Math.floor(Math.random() * BIOLOGY_CHAPTERS.length)], color: 'border-green-500' },
    ];
};

export default function App() {
  useReportProblemGesture(() => setShowSupportModal(true));
  const [user, setUser] = useState<User | null>(null);
  const [currentView, _setCurrentView] = useState<'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'adminChat' | 'technicalSupport' | 'analytics' | 'customPractice' | 'practiceTest' | 'liveAI'>('home');
  const [practiceChapters, setPracticeChapters] = useState<{name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[]>([]);

  const [previousView, setPreviousView] = useState<typeof currentView | null>(null);
  const setCurrentView = (view: typeof currentView) => {
    if (view === 'liveAI' && currentView !== 'liveAI') {
        setPreviousView(currentView);
    }
    window.history.pushState({ view }, '', '/' + view);
    _setCurrentView(view);
  };

  useEffect(() => {
    if (mainContainerRef.current) {
        mainContainerRef.current.scrollTop = 0;
    }
  }, [currentView]);

  const notificationRef = React.useRef<HTMLDivElement>(null);
  const mainContainerRef = React.useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; message: string; readBy: string[]; timestamp: any }[]>([]);

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
          setShowNotifications(false);
        }
      }
      
      if (showNotifications) {
          document.addEventListener("mousedown", handleClickOutside);
      } else {
          document.removeEventListener("mousedown", handleClickOutside);
      }
      
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, [showNotifications]);

  const markAsRead = async (id: string) => {
    if (!user) return;
    try {
        await updateDoc(doc(db, 'notifications', id), {
            readBy: arrayUnion(user.uid)
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'notifications/' + id);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const notifRef = collection(db, 'notifications');
    const q = query(notifRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as any));
        setNotifications(data);
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'notifications');
    });
    
    return () => unsubscribe();
  }, [user]);

  const [isPYQRunning, setIsPYQRunning] = useState(false);
  const [resumingTest, setResumingTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [subjects, setSubjects] = useState(getDailyChapters());
  const [previousSubjects, setPreviousSubjects] = useState<typeof subjects | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [chartData, setChartData] = useState<{ name: string, lectureMinutes: number, otherMinutes: number }[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [randomOverride, setRandomOverride] = useState<{ originalSubjects: typeof subjects, expiryTime: number, pendingSubjects: typeof subjects } | null>(null);
  const [showRandomPopup, setShowRandomPopup] = useState(false);
  const [randomChapter, setRandomChapter] = useState<{name: string, topic: string, color: string} | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [backPressCount, setBackPressCount] = useState(0);
  const [showExitToast, setShowExitToast] = useState(false);
  
  useEffect(() => {
    // Initial mount logic
    window.scrollTo(0, 0);
    _setCurrentView('home');
    localStorage.removeItem('resumeTestData');
    
    // Push initial state to trap the first back button press
    window.history.pushState({ view: 'home' }, '', '/home');

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            _setCurrentView('home');
            setActiveVideo(null);
            setShowNotifications(false);
            setShowAnalytics(false);
            setShowResetModal(false);
            setShowRandomPopup(false);
            window.scrollTo(0, 0);
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
        // If we have active overlays, close them
        if (activeVideo || showNotifications || showAnalytics || showResetModal || showRandomPopup) {
            setActiveVideo(null);
            setShowNotifications(false);
            setShowAnalytics(false);
            setShowResetModal(false);
            setShowRandomPopup(false);
            return;
        }

        // Home exit-trap logic only if we are currently at home
        if (currentView === 'home') {
            setBackPressCount(prev => prev + 1);
            setShowExitToast(true);
            setTimeout(() => {
                setShowExitToast(false);
                setBackPressCount(0);
            }, 2000);

            if (backPressCount >= 1) {
                // Really exit
                window.history.back();
            } else {
                // Re-trap
                window.history.pushState({ view: 'home' }, '', '/home');
            }
            return;
        }

        // Otherwise navigate back
        const poppedView = e.state?.view || 'home';
        _setCurrentView(poppedView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, activeVideo, showNotifications, showAnalytics, showResetModal, showRandomPopup, backPressCount]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  useEffect(() => {
      if (user) {
          const updateLastSeen = async () => {
              try {
                  await updateDoc(doc(db, 'users', user.uid), {
                      lastSeen: serverTimestamp()
                  });
              } catch (e) {
                  console.error("Error updating lastSeen", e);
              }
          };
          updateLastSeen();
          const interval = setInterval(updateLastSeen, 2 * 60 * 1000); // 2 mins
          return () => clearInterval(interval);
      }
  }, [user]);

  const [stats, setStats] = useState({
          testsAttempted: 0,
          questionsSolved: 0,
          accuracy: 0,
          timeSpentSeconds: 0,
          lectureTimeSeconds: 0,
          date: getISTDateString()
  });

  useEffect(() => {
      if (!user) return;
      
      const resultsRef = collection(db, 'users', user.uid, 'results');
      const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
          let totalTests = snapshot.size;
          let totalQuestions = 0;
          let totalAttempted = 0;
          let totalCorrect = 0;
          
          snapshot.docs.forEach(doc => {
              const data = doc.data();
              totalQuestions += (data.totalQuestions || 0);
              totalCorrect += (data.correct || 0);
              totalAttempted += (data.correct || 0) + (data.incorrect || 0);
          });
          
          const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
          
          setStats(prev => ({
              ...prev,
              testsAttempted: totalTests,
              questionsSolved: totalCorrect,
              accuracy: Math.round(accuracy)
          }));
      });
      
      return () => unsubscribe();
  }, [user]);

  const openAnalytics = async () => {
    if (!user) return;
    
    // Fetch analytics data
    const analyticsRef = collection(db, 'users', user.uid, 'analytics_v2');
    const q = query(analyticsRef, orderBy('__name__', 'desc'), limit(15));
    const snapshot = await getDocs(q);
    
    const dbDataMap: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
        dbDataMap[doc.id] = doc.data();
    });

    const last7Days = [];
    const now = new Date();
    // Use IST adjustment for consistent date calculation
    const istOffset = 5.5 * 60 * 60 * 1000;
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() + istOffset);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const d = dbDataMap[dateStr] || { timeSpentSeconds: 0, lectureTimeSeconds: 0 };
        const total = d.timeSpentSeconds || 0;
        const lecture = d.lectureTimeSeconds || 0;
        
        last7Days.push({
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            lectureMinutes: Math.floor(lecture / 60),
            otherMinutes: Math.floor(Math.max(0, total - lecture) / 60)
        });
    }
    
    setChartData(last7Days);
    setShowAnalytics(true);
  };

  useEffect(() => {
    if (user) {
        setCurrentView('home');
    } else {
        _setCurrentView('home');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setShowOnboarding(true);
    
    const text = "This is Ask AI, you can ask questions directly!";
    let i = 0;
    const typingInterval = setInterval(() => {
        setDisplayedText(text.substring(0, i));
        i++;
        if (i > text.length) clearInterval(typingInterval);
    }, 50);

    const timer = setTimeout(() => setShowOnboarding(false), 6000);
    return () => {
        clearTimeout(timer);
        clearInterval(typingInterval);
    };
  }, [user]);

  useEffect(() => {
      if (!statsLoaded) return;
      
      const interval = setInterval(async () => {
          const today = getISTDateString();
          
          setStats(prev => {
              if (prev.date !== today) {
                  // If date changed, reset for new day
                  return {
                      ...prev,
                      date: today,
                      timeSpentSeconds: 1,
                      lectureTimeSeconds: activeVideo ? 1 : 0
                  };
              }

              const newSeconds = prev.timeSpentSeconds + 1;
              const newLectureSeconds = activeVideo ? prev.lectureTimeSeconds + 1 : prev.lectureTimeSeconds;
              
              if (user && newSeconds % 10 === 0) { // Update Firebase every 10 seconds
                  setDoc(doc(db, 'users', user.uid, 'analytics_v2', today), { 
                      timeSpentSeconds: newSeconds,
                      lectureTimeSeconds: newLectureSeconds
                  }, { merge: true });
              }
              
              return {...prev, timeSpentSeconds: newSeconds, lectureTimeSeconds: newLectureSeconds};
          });
      }, 1000);
      return () => clearInterval(interval);
  }, [user, activeVideo, statsLoaded]);

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
        const today = getISTDateString();
        const docRef = doc(db, 'users', user.uid, 'analytics_v2', today);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStats(prev => ({...prev, date: today, timeSpentSeconds: data.timeSpentSeconds, lectureTimeSeconds: data.lectureTimeSeconds || 0}));
        } else {
            setStats(prev => ({...prev, date: today, timeSpentSeconds: 0, lectureTimeSeconds: 0}));
        }
        setStatsLoaded(true);
    };
    fetchStats();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    // Set online on load
    updateUserPresence(user.uid, true);
    
    // Heartbeat to keep status 'online'
    const interval = setInterval(() => {
        updateUserPresence(user.uid, true);
    }, 30000); // 30 seconds

    return () => {
        clearInterval(interval);
        updateUserPresence(user.uid, false);
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
          updateUserPresence(currentUser.uid, true);
          
          const docRef = doc(db, 'users', currentUser.uid, 'settings', 'subjects');
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.day === getDayIndex()) {
                  setSubjects(data.subjects);
              } else {
                  const newDaily = getDailyChapters();
                  setSubjects(newDaily);
                  await setDoc(docRef, { subjects: newDaily, day: getDayIndex() });
              }
          } else {
              const newSubjects = getNewUserChapters();
              setSubjects(newSubjects);
              await setDoc(docRef, { subjects: newSubjects, day: getDayIndex() });
          }
      }
    });                
    
    // Check for day change
    const interval = setInterval(async () => {
        if (!auth.currentUser) return;

        const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'subjects');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.day !== getDayIndex()) {
                const newDaily = getDailyChapters();
                setSubjects(newDaily);
                await setDoc(docRef, { subjects: newDaily, day: getDayIndex() });
            }
        }
    }, 30 * 60000); // Check every 30 minutes instead of every minute
    return () => { unsubscribe(); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
        const notifRef = collection(db, 'notifications');
        const q = query(notifRef, limit(10));
        try {
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as any));
            setNotifications(data);
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'notifications');
        }
    };
    fetchNotifications();
  }, [user]);


  useEffect(() => {
    if (randomOverride) {
        const interval = setInterval(() => {
            if (Date.now() > randomOverride.expiryTime) {
                setSubjects(randomOverride.originalSubjects);
                setRandomOverride(null);
                clearInterval(interval);
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }
  }, [randomOverride]);

  const handleRandomRestore = () => {
      if (randomOverride) {
          setSubjects(randomOverride.originalSubjects);
          setRandomOverride(null);
      }
      setShowRandomPopup(false);
  };

  const applyRandomChapter = () => {
      if (!randomOverride) return;
      setSubjects(randomOverride.pendingSubjects);
      setShowRandomPopup(false);
  };
    
  const handleRandomize = () => {
      if (!user) return;
      
      // If already randomized, don't overwrite the true original subjects
      if (randomOverride) return;
      
      const originalSubjects = [...subjects];
      const newSubjects = getRandomChapters();
      
      setRandomChapter(newSubjects[0]); 
      
      setRandomOverride({
          originalSubjects: originalSubjects,
          expiryTime: Date.now() + 2 * 60 * 60 * 1000,
          pendingSubjects: newSubjects 
      });
      
      setShowRandomPopup(true);
  };

  const handleReset = async () => {
      if (!user) return;
      setPreviousSubjects(subjects);
      
      const newDaily = getNewUserChapters(); 
      setSubjects(newDaily);
      
      const docRef = doc(db, 'users', user.uid, 'settings', 'subjects');
      const istOffset = 5.5 * 60 * 60 * 1000;
      const now = new Date();
      const istTime = new Date(now.getTime() + istOffset);
      const nowDay = Math.floor((istTime.getTime() - (1 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));

      await setDoc(docRef, { subjects: newDaily, day: nowDay });
      setShowResetModal(false);
  };

  const handleRestore = () => {
      if (previousSubjects) {
          setSubjects(previousSubjects);
      }
      setShowResetModal(false);
  };

  useEffect(() => {
    (window as any).setAsHomeScreen = (subject: string, chapter: string) => {
        const colorMap: Record<string, string> = {
            'Physics': 'border-blue-500',
            'Chemistry': 'border-orange-500',
            'Biology': 'border-green-500'
        };
        setSubjects((prev: any[]) => prev.map(s => s.name === subject.toUpperCase() ? { ...s, topic: chapter, color: colorMap[subject] || 'border-gray-500' } : s));
    };
    return () => { delete (window as any).setAsHomeScreen; };
  }, []);

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showNeuralSolver, setShowNeuralSolver] = useState(false);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0a0f24] text-white">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (currentView === 'liveAI') {
      return <LiveAIInterface onClose={() => setCurrentView(previousView || 'home')} />;
  }

  if (currentView === 'study') {
      return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <StudyHub subjects={subjects} setResumingTest={setResumingTest} setCurrentView={setCurrentView} onNavigate={(view) => {
              if (view === 'customPractice') {
                  setCurrentView('customPractice');
              } else {
                  setCurrentView(view);
              }
            }} />
        </motion.div>
      );
  }

  if (currentView === 'customPractice') {
      return <CustomPractice onBack={() => setCurrentView('study')} onStart={(chapters) => {
          setPracticeChapters(chapters);
          setCurrentView('practiceTest');
      }} />;
  }

  if (currentView === 'practiceTest') {
      if (resumingTest) {
          return <PYQTestRunner 
              questions={resumingTest.questions}
              title={resumingTest.title}
              initialData={{
                  answers: resumingTest.answers,
                  marked: resumingTest.marked,
                  currentIndex: resumingTest.currentIndex,
                  timeLeft: resumingTest.timeLeft
              }}
              onBack={() => {
                  setResumingTest(null);
                  setCurrentView('study');
              }}
          />;
      }
      return <PracticeTest chapters={practiceChapters} onBack={() => setCurrentView('customPractice')} />;
  }

  if (currentView === 'profile') {
      return (
        <div className="flex flex-col min-h-screen pb-20">
            <div className="flex-grow"><Profile user={user} onNavigate={setCurrentView} onSolverClick={() => setShowNeuralSolver(true)} /></div>
            <BottomNav currentView="profile" onNavigate={setCurrentView} />
            <SupportModal 
                isOpen={showSupportModal} 
                onClose={() => setShowSupportModal(false)}
                onConfirm={() => {
                    setShowSupportModal(false);
                    setCurrentView('technicalSupport');
                }}
            />
            {showNeuralSolver && <NeuralSolver onClose={() => setShowNeuralSolver(false)} />}
        </div>
      );
  }

  if (currentView === 'editProfile') {
      return <EditProfile user={user} onNavigate={setCurrentView} />;
  }

  if (currentView === 'admin') {
      return (
          <><div className="min-h-screen bg-[#0a0f24] p-6 text-white">
              <button className="mb-4 text-sm text-gray-400" onClick={() => setCurrentView('profile')}>Back to Profile</button>
              <AdminPanel onNavigate={setCurrentView} />
          </div>
          <SupportModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        onConfirm={() => {
            setShowSupportModal(false);
            setCurrentView('technicalSupport');
        }}
      /></>
      );
  }

  if (currentView === 'adminChat') {
      return <AdminChatPage onBack={() => setCurrentView('admin')} />;
  }


  if (currentView === 'tests') {
      return (
        <div className="flex flex-col min-h-screen pb-20">
            <div className="flex-grow"><TestHub subjects={subjects} onNavigate={setCurrentView} setIsPYQRunning={setIsPYQRunning} /></div>
            {!isPYQRunning && <BottomNav currentView="tests" onNavigate={setCurrentView} />}
            <SupportModal 
                isOpen={showSupportModal} 
                onClose={() => setShowSupportModal(false)}
                onConfirm={() => {
                    setShowSupportModal(false);
                    setCurrentView('technicalSupport');
                }}
            />
        </div>
      );
  }

  if (currentView === 'notes') {
      return (
        <div className="flex flex-col min-h-screen pb-20 bg-[#0f172a]">
            <div className="flex-grow"><Notes /></div>
            <BottomNav currentView="notes" onNavigate={setCurrentView} />
            <SupportModal 
                isOpen={showSupportModal} 
                onClose={() => setShowSupportModal(false)}
                onConfirm={() => {
                    setShowSupportModal(false);
                    setCurrentView('technicalSupport');
                }}
            />
        </div>
      );
  }

   if (currentView === 'analytics') {
       return (
         <div className="flex flex-col min-h-screen">
             <div className="flex-grow"><AnalysisHistory onNavigate={setCurrentView} /></div>
             <SupportModal 
                isOpen={showSupportModal} 
                onClose={() => setShowSupportModal(false)}
                onConfirm={() => {
                    setShowSupportModal(false);
                    setCurrentView('technicalSupport');
                }}
            />
         </div>
       );
   }

   if (currentView === 'technicalSupport') {
       return (
         <><div className="min-h-screen bg-[#0f172a] text-white">
             <button className="absolute top-4 left-4 z-10 text-sm text-gray-400" onClick={() => setCurrentView('profile')}>⬅️ Back</button>
             <UserChat fullScreen={true} />
         </div>
         <SupportModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        onConfirm={() => {
            setShowSupportModal(false);
            setCurrentView('technicalSupport');
        }}
      /></>
       );
   }

  return (
    <>
      {showNeuralSolver && <NeuralSolver onClose={() => setShowNeuralSolver(false)} />}
      <SupportModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        onConfirm={() => {
            setShowSupportModal(false);
            setCurrentView('technicalSupport');
        }}
      />
      {showOnboarding && (

          <div 
            onClick={() => setShowOnboarding(false)}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <motion.div 
                className="flex items-center gap-4"
            >
                    <div
                        className="w-14 h-14 rounded-full relative z-50 flex-shrink-0"
                    >
                        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,orange,blue,green)] animate-spin"></div>
                        <div className="absolute inset-[2px] rounded-full bg-[#0a0f24] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white">
                                <path d="M7 10v4M10 8v8M13 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M17 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" />
                            </svg>
                        </div>
                    </div>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="bg-[#161e38]/90 p-4 rounded-2xl border border-blue-500 shadow-2xl backdrop-blur-md"
                >
                    <p className="font-bold text-base sm:text-lg text-white drop-shadow-md">{displayedText}</p>
                </motion.div>
            </motion.div>
            <p className="text-white mt-12 text-sm text-center font-medium animate-pulse">Tap anywhere to start</p>
          </div>
      )}

    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} ref={mainContainerRef} className={`min-h-screen bg-[#0a0f24] text-white p-3 sm:p-6 font-sans pb-24 ${showOnboarding ? 'blur-sm' : ''}`}>
      <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl px-1 sm:px-0">
      
      {showExitToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-semibold z-[1000] shadow-2xl animate-bounce">
              Press back again to exit
          </div>
      )}

      {activeVideo && <VideoPlayer topic={activeVideo} onClose={() => setActiveVideo(null)} />}

      {/* Header */}
      <div className="flex justify-between items-center mb-6 select-none">
        <div className="flex-1 min-w-0">
           <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-1 sm:gap-2 truncate">Hello, {user?.displayName || 'Aspirant'}! 👋</h1>
           <p className="text-gray-400 text-[10px] sm:text-sm">Let's make today productive</p>
        </div>
        <div className="relative" ref={notificationRef}>
            <Bell className="h-6 w-6 cursor-pointer" onClick={() => setShowNotifications(!showNotifications)} />
             {notifications.some(n => !n.readBy?.includes(user?.uid)) ? (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                     {notifications.filter(n => !n.readBy?.includes(user?.uid)).length}
                 </span>
             ) : null}
            {showNotifications ? (
              <div className="absolute top-8 right-0 bg-[#020510] p-4 rounded-2xl shadow-xl w-64 z-[100] border border-blue-900/30">
                  <h3 className="font-bold mb-2">Notifications</h3>
                  {notifications.length === 0 ? (
                      <p className="text-gray-400 text-sm">No notifications</p>
                  ) : (
                      <div className="space-y-4">
                        {['Today', 'Yesterday'].map(group => {
                            const groupNotifications = notifications.filter(n => {
                                const date = n.timestamp?.toDate();
                                const today = new Date();
                                const yesterday = new Date(today);
                                yesterday.setDate(yesterday.getDate() - 1);
                                if (group === 'Today') return date?.toDateString() === today.toDateString();
                                if (group === 'Yesterday') return date?.toDateString() === yesterday.toDateString();
                                return false;
                            });

                            if (groupNotifications.length === 0) return null;

                            return (
                                <div key={group}>
                                    <h4 className="text-xs text-gray-500 font-bold mb-1 uppercase">{group}</h4>
                                    <div className="space-y-2">
                                        {groupNotifications.map(n => (
                                            <div key={n.id} className="text-sm p-2 bg-[#0a1025] border border-blue-900/50 rounded-lg">
                                                <p>{n.message}</p>
                                                <div className="flex justify-between items-center mt-1">
                                                    <p className="text-gray-500 text-[10px]">
                                                    {n.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                                {!n.readBy?.includes(user?.uid) && (
                                                    <button onClick={() => markAsRead(n.id)} className="text-[10px] bg-blue-600/50 text-blue-200 px-2 py-0.5 rounded">Mark as Read</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                  </div>
              )}
          </div>
        ) : null}
      </div>
    </div>

      <HubSwitcher active="home" onNavigate={setCurrentView} />

      <div className="bg-[#161e38] rounded-2xl p-3 sm:p-5 border border-white/10 mb-4 mt-2 select-none">
        <div className="flex justify-between items-center mb-2.5">
            <h2 className="font-bold text-sm sm:text-lg">Your Performance</h2>
            <div className="text-orange-500 text-[10px] sm:text-xs font-semibold">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div onClick={() => setCurrentView('analytics')} className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Tests Attempted</p>
                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{stats.testsAttempted} <BarChart2 className="text-blue-500 h-4 w-4 sm:h-5 sm:w-5"/></h3>
            </div>
             <div className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5">
                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Questions Solved</p>
                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{stats.questionsSolved} <CheckCircle2 className="text-green-500 h-4 w-4 sm:h-5 sm:w-5"/></h3>
            </div>
             <div className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5">
                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Accuracy</p>
                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{stats.accuracy}% <Target className="text-orange-500 h-4 w-4 sm:h-5 sm:w-5"/></h3>
            </div>
             <div onClick={openAnalytics} className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Time Spent</p>
                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{Math.floor(stats.timeSpentSeconds / 60)}m <Clock className="text-purple-400 h-4 w-4 sm:h-5 sm:w-5"/></h3>
            </div>
        </div>
      </div>
      
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#161e38] p-5 sm:p-7 rounded-3xl border border-white/10 w-full max-w-lg shadow-2xl relative">
               <button onClick={() => setShowAnalytics(false)} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full hover:bg-white/10 transition-colors">
                   <X className="h-4 w-4" />
               </button>
               <div className="mb-6">
                   <h2 className="text-xl font-bold flex items-center gap-2">
                       <Clock className="text-purple-400 h-5 w-5" />
                       Activity Analytics
                   </h2>
                   <p className="text-xs text-gray-400 mt-1">Visualization of your preparation time across the week</p>
               </div>
               <TimeSpentChart data={chartData} />
            </motion.div>
        </div>
      )}


      {/* Continue Learning */}
      <div className="flex justify-between items-center mb-4 mt-6">
          <h2 className="font-bold text-lg sm:text-xl">Continue Learning</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowResetModal(true)} className="text-xs bg-red-900/50 text-red-300 px-3 py-1 rounded-full">Reset</button>
            <button onClick={handleRandomize} className="text-xs bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full flex items-center gap-1">
                <Shuffle className="h-3 w-3" /> Random
            </button>
          </div>
      </div>
      
      {showRandomPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm text-center">
                <h2 className="text-xl font-bold mb-4">Random Chapter Picked!</h2>
                <p className="text-gray-300">"{randomChapter?.topic}" will be for 2 hours.</p>
                <div className="flex flex-col gap-2 mt-6">
                  <button onClick={applyRandomChapter} className="w-full bg-blue-600 py-2 rounded-lg font-bold">Got it</button>
                  <button onClick={handleRandomRestore} className="w-full bg-gray-700 py-2 rounded-lg font-bold">Restore Original</button>
                </div>
            </div>
        </div>
      )}
      
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Are you sure you want to restart?</h2>
                <div className="flex gap-3 mt-6">
                    <button onClick={handleReset} className="flex-1 bg-red-600 py-2 rounded-lg font-bold">Yes</button>
                    <button onClick={() => setShowResetModal(false)} className="flex-1 bg-white/10 py-2 rounded-lg font-bold">No</button>
                    <button onClick={handleRestore} className="flex-1 bg-blue-600 py-2 rounded-lg font-bold">Restore</button>
                </div>
            </div>
        </div>
      )}
      <div className="space-y-4 mb-20 scroll-mt-20">
        {subjects.map((sub, idx) => (
            <div key={idx} className={`bg-[#161e38] border-l-4 ${sub.color} rounded-xl p-2.5 sm:p-4 flex justify-between items-center group shadow-md`}>
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate mb-0.5">{sub.name}</p>
                  <p className="font-bold text-xs sm:text-base truncate">{sub.topic}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button className="bg-white/10 p-1.5 rounded-full sm:hidden" onClick={() => setActiveVideo(sub.topic)}><Play className="h-4 w-4 text-white" /></button>
                    <button className="bg-white text-[#0a0f24] font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm hidden sm:block" onClick={() => setActiveVideo(sub.topic)}>START</button>
                    <button className="bg-white text-[#0a0f24] font-bold px-3 py-1.5 rounded-lg text-xs sm:hidden" onClick={() => setActiveVideo(sub.topic)}>START</button>
                </div>
            </div>
        ))}
      </div>

      <BottomNav currentView={currentView as any} onNavigate={setCurrentView} />
      
      <FloatingAIAgent onNavigate={setCurrentView} />
      
      <SupportModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        onConfirm={() => {
            setShowSupportModal(false);
            setCurrentView('technicalSupport');
        }}
      />
      </div>
    </motion.div>
    </>
  );
}

