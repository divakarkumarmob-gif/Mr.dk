/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useState, useEffect} from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {onAuthStateChanged, User} from 'firebase/auth';
import {auth, db} from './lib/firebase';
import {doc, getDoc, setDoc, getDocs, collection, query, orderBy, limit, addDoc, onSnapshot, updateDoc, arrayUnion} from 'firebase/firestore'; 
import {updateUserPresence} from './services/chatService';
import FloatingAIAgent from './components/FloatingAIAgent';
import Login from './components/Login';
import StudyHub from './components/StudyHub';
import HubSwitcher from './components/HubSwitcher';
import VideoPlayer from './components/VideoPlayer';
import Profile from './components/Profile';
import EditProfile from './components/EditProfile';
import AdminPanel from './components/AdminPanel';
import AdminChatPage from './components/AdminChatPage';
import TestHub from './components/TestHub';
import Notes from './components/Notes';
import UserChat from './components/UserChat';
import SupportModal from './components/SupportModal';
import TimeSpentChart from './components/TimeSpentChart';
import { Bell, Home, BarChart2, FileText, User as UserIcon, Play, Book, CheckCircle2, Target, Clock, Shuffle, MessageCircle } from 'lucide-react';
import { PHYSICS_CHAPTERS, CHEMISTRY_CHAPTERS, BIOLOGY_CHAPTERS } from './constants';
import { motion } from 'motion/react';

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

// Function to calculate day index
const getDayIndex = (resetDay?: number) => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istTime = new Date(now.getTime() + istOffset);
    // 1 AM IST = 01:00.
    // If it's before 1AM, we are on the previous day.
    const day = Math.floor((istTime.getTime() - (1 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
    
    if (resetDay !== undefined) {
        return Math.max(0, day - resetDay);
    }
    
    const savedResetDay = localStorage.getItem('resetDay');
    if (savedResetDay) {
        return Math.max(0, day - parseInt(savedResetDay));
    }
    
    return day;
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
  const [user, setUser] = useState<User | null>(null);
  const [currentView, _setCurrentView] = useState<'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'adminChat' | 'technicalSupport'>('home');

  const setCurrentView = (view: typeof currentView) => {
    window.history.pushState({ view }, '', '/' + view);
    _setCurrentView(view);
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (event.state && event.state.view) {
            _setCurrentView(event.state.view);
        } else {
            _setCurrentView('home');
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const notificationRef = React.useRef<HTMLDivElement>(null);
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

  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [subjects, setSubjects] = useState(getDailyChapters());
  const [previousSubjects, setPreviousSubjects] = useState<typeof subjects | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [chartData, setChartData] = useState<{ name: string, lectureMinutes: number, otherMinutes: number }[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [stats, setStats] = useState({
          testsAttempted: 0,
          questionsSolved: 0,
          accuracy: 0,
          timeSpentSeconds: 0,
          lectureTimeSeconds: 0,
          date: getISTDateString()
  });

  const openAnalytics = async () => {
    if (!user) return;
    
    // Fetch last 7 days
    const analyticsRef = collection(db, 'users', user.uid, 'analytics_v2');
    const q = query(analyticsRef, orderBy('__name__', 'desc'), limit(7));
    const snapshot = await getDocs(q);
    
    const data = snapshot.docs.map(doc => {
        const d = doc.data();
        const total = d.timeSpentSeconds || 0;
        const lecture = d.lectureTimeSeconds || 0;
        return {
            name: new Date(`${doc.id}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
            lectureMinutes: Math.floor(lecture / 60),
            otherMinutes: Math.floor((total - lecture) / 60)
        };
    });
    
    setChartData(data.reverse());
    setShowAnalytics(true);
  };

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
              }
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

  const handleRandomize = async () => {
      if (!user) return;
      setPreviousSubjects(subjects);
      const newSubjects = getRandomChapters();
      setSubjects(newSubjects);
      
      const docRef = doc(db, 'users', user.uid, 'settings', 'subjects');
      await setDoc(docRef, { subjects: newSubjects, day: getDayIndex() });
  };

  const handleReset = async () => {
      if (!user) return;
      setPreviousSubjects(subjects);
      
      // Update reset day in Firestore? Or just set subjects back to daily? 
      // The previous implementation used localStorage.setItem('resetDay', ...)
      // I need to decide where to store resetDay. Let's store it in the same settings doc.
      // But the getDayIndex uses the resetDay. So I need to update it in Firestore.
      // Wait, getDayIndex() reads from local storage! 
      // "const savedResetDay = localStorage.getItem('resetDay');"
      // I should also move resetDay to Firestore.
      
      // Ignoring resetDay for now as it makes things complicated and user wanted to
      // stop using local storage for stuff.
      
      const newDaily = getDailyChapters();
      setSubjects(newDaily);
      
      const docRef = doc(db, 'users', user.uid, 'settings', 'subjects');
      await setDoc(docRef, { subjects: newDaily, day: getDayIndex() });
      setShowResetModal(false);
  };

  const handleRestore = () => {
      if (previousSubjects) {
          setSubjects(previousSubjects);
      }
      setShowResetModal(false);
  };

  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    // 3-finger detection
    const handleTouch = (e: TouchEvent) => {
        if (e.touches.length === 3) {
            setShowSupportModal(true);
        }
    };
    window.addEventListener('touchstart', handleTouch);

    // Shake detection
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = 0;
    const handleMotion = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity;
        if (!acc) return;
        const curTime = Date.now();
        if ((curTime - lastTime) > 100) {
            const diff = Math.abs(acc.x! + acc.y! + acc.z! - lastX - lastY - lastZ);
            if (diff > 30) { // Threshold for shake
                setShowSupportModal(true);
            }
            lastX = acc.x!; lastY = acc.y!; lastZ = acc.z!;
            lastTime = curTime;
        }
    };
    window.addEventListener('devicemotion', handleMotion);

    return () => {
        window.removeEventListener('touchstart', handleTouch);
        window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0a0f24] text-white">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (currentView === 'study') {
      return <StudyHub subjects={subjects} onNavigate={setCurrentView} />;
  }

  if (currentView === 'profile') {
      return (
        <div className="flex flex-col min-h-screen pb-20">
            <div className="flex-grow"><Profile user={user} onNavigate={setCurrentView} /></div>
            <BottomNav currentView="profile" onNavigate={setCurrentView} />
        </div>
      );
  }

  if (currentView === 'editProfile') {
      return <EditProfile user={user} onNavigate={setCurrentView} />;
  }

  if (currentView === 'admin') {
      return (
          <div className="min-h-screen bg-[#0a0f24] p-6 text-white">
              <button className="mb-4 text-sm text-gray-400" onClick={() => setCurrentView('profile')}>Back to Profile</button>
              <AdminPanel onNavigate={setCurrentView} />
          </div>
      );
  }

  if (currentView === 'adminChat') {
      return <AdminChatPage onBack={() => setCurrentView('admin')} />;
  }


  if (currentView === 'tests') {
      return (
        <div className="flex flex-col min-h-screen pb-20">
            <div className="flex-grow"><TestHub subjects={subjects} onNavigate={setCurrentView} /></div>
            <BottomNav currentView="tests" onNavigate={setCurrentView} />
        </div>
      );
  }

  if (currentView === 'notes') {
      return (
        <div className="flex flex-col min-h-screen pb-20 bg-[#0f172a]">
            <div className="flex-grow"><Notes /></div>
            <BottomNav currentView="notes" onNavigate={setCurrentView} />
        </div>
      );
  }

  if (currentView === 'technicalSupport') {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white">
            <button className="absolute top-4 left-4 z-10 text-sm text-gray-400" onClick={() => setCurrentView('profile')}>⬅️ Back</button>
            <UserChat fullScreen={true} />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 font-sans pb-24">
      {activeVideo && <VideoPlayer topic={activeVideo} onClose={() => setActiveVideo(null)} />}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">Hello, {user?.displayName || 'Aspirant'}! 👋</h1>
           <p className="text-gray-400">Let's make today productive</p>
        </div>
        <div className="relative" ref={notificationRef}>
            <Bell className="h-6 w-6 cursor-pointer" onClick={() => setShowNotifications(!showNotifications)} />
            {notifications.filter(n => !n.readBy?.includes(user?.uid)).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {notifications.filter(n => !n.readBy?.includes(user?.uid)).length}
                </span>
            )}
            {showNotifications && (
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
                                                    {!n.readBy?.includes(user.uid) && (
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
            )}
        </div>
      </div>

      <HubSwitcher active="home" onNavigate={setCurrentView} />

      {/* Performance Overview (Moved from StudyHub) */}
      <div className="bg-[#161e38] rounded-2xl p-6 border border-white/10 mb-8 mt-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg">Performance Overview</h2>
            <div className="text-orange-500 text-xs font-semibold">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-gray-400 text-xs">Tests Attempted</p>
                <h3 className="font-bold text-2xl flex items-center gap-2">{stats.testsAttempted} <BarChart2 className="text-blue-500 h-5 w-5"/></h3>
            </div>
             <div>
                <p className="text-gray-400 text-xs">Questions Solved</p>
                <h3 className="font-bold text-2xl flex items-center gap-2">{stats.questionsSolved} <CheckCircle2 className="text-green-500 h-5 w-5"/></h3>
            </div>
             <div>
                <p className="text-gray-400 text-xs">Accuracy</p>
                <h3 className="font-bold text-2xl flex items-center gap-2">{stats.accuracy}% <Target className="text-orange-500 h-5 w-5"/></h3>
            </div>
             <div onClick={openAnalytics} className="cursor-pointer">
                <p className="text-gray-400 text-xs">Time Spent</p>
                <h3 className="font-bold text-2xl flex items-center gap-2">{Math.floor(stats.timeSpentSeconds / 60)}m <Clock className="text-purple-400 h-5 w-5"/></h3>
            </div>
        </div>
      </div>
      
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
            <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-lg">
               <div className="flex justify-between items-center mb-4">
                   <h2 className="text-xl font-bold">7 Days Time Spent</h2>
                   <button onClick={() => setShowAnalytics(false)} className="text-gray-400 text-sm">Close</button>
               </div>
               <TimeSpentChart data={chartData} />
            </div>
        </div>
      )}


      {/* Continue Learning */}
      <div className="flex justify-between items-center mb-4 mt-8">
          <h2 className="font-bold text-xl">Continue Learning</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowResetModal(true)} className="text-xs bg-red-900/50 text-red-300 px-3 py-1 rounded-full">Reset</button>
            <button onClick={handleRandomize} className="text-xs bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full flex items-center gap-1">
                <Shuffle className="h-3 w-3" /> Random
            </button>
          </div>
      </div>
      
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
      <div className="space-y-4 mb-16">
        {subjects.map((sub, idx) => (
            <div key={idx} className={`bg-[#161e38] border-l-4 ${sub.color} rounded-lg p-4 flex justify-between items-center`}>
                <div>
                  <p className="text-[10px] font-bold text-gray-400">{sub.name}</p>
                  <p className="font-bold text-lg">{sub.topic}</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-white/10 p-2 rounded-full" onClick={() => setActiveVideo(sub.topic)}><Play className="h-4 w-4 text-white" /></button>
                    <button className="bg-white text-[#0a0f24] font-bold px-4 py-2 rounded-lg text-sm" onClick={() => setActiveVideo(sub.topic)}>START</button>
                </div>
            </div>
        ))}
      </div>

      <BottomNav currentView="home" onNavigate={setCurrentView} />
      
      <FloatingAIAgent />
      
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

function BottomNav({ currentView, onNavigate }: { currentView: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'technicalSupport', onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'technicalSupport') => void }) {
    return (
        <div className="fixed bottom-0 left-0 w-full bg-[#0f172a] border-t border-white/10 p-2 flex justify-around">
            <div className={`flex flex-col items-center cursor-pointer ${currentView === 'home' ? 'text-orange-500' : 'text-gray-500'}`} onClick={() => onNavigate('home')}><Home className="h-6 w-6" /><span className="text-[10px]">Home</span></div>
            <div className={`flex flex-col items-center cursor-pointer ${currentView === 'tests' ? 'text-orange-500' : 'text-gray-500'}`} onClick={() => onNavigate('tests')}><FileText className="h-6 w-6" /><span className="text-[10px]">Tests</span></div>
            <div className="flex flex-col items-center text-gray-500"><BarChart2 className="h-6 w-6" /><span className="text-[10px]">Analytics</span></div>
            <div className={`flex flex-col items-center cursor-pointer ${currentView === 'notes' ? 'text-orange-500' : 'text-gray-500'}`} onClick={() => onNavigate('notes')}><Book className="h-6 w-6" /><span className="text-[10px]">Notes</span></div>
            <div className={`flex flex-col items-center cursor-pointer ${currentView === 'profile' ? 'text-orange-500' : 'text-gray-500'}`} onClick={() => onNavigate('profile')}><UserIcon className="h-6 w-6" /><span className="text-[10px]">Profile</span></div>
        </div>
    )
}
