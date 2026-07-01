/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useState, useEffect} from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {onAuthStateChanged, User} from 'firebase/auth';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import {auth, db} from './lib/firebase';
import {doc, getDoc, setDoc, getDocs, collection, query, orderBy, limit, addDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp} from 'firebase/firestore'; 
import {updateUserPresence} from './services/chatService';
import AiSearch from './components/AiSearch';

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
import NotesLibrary from './components/NotesLibrary';
import EditProfile from './components/EditProfile';
import AdminPanel from './components/AdminPanel';
import AdminChatPage from './components/AdminChatPage';
import TestHub from './components/TestHub';
import Notes from './components/Notes';
import AIStudyPlanPage from './components/AIStudyPlanPage';
import NCERTHub from './components/NCERTHub';
import NTAQuestionsHub from './components/NTAQuestionsHub';
import OldPYQHistory from './components/OldPYQHistory';
import Flashcards from './components/Flashcards';
import StudyDashboard from './components/StudyDashboard';
import PrivateVideos from './components/PrivateVideos';
import BottomNav from './components/BottomNav';
import UserChat from './components/UserChat';
import NotificationPage from './components/NotificationPage';
import MindHackPage from './components/MindHackPage';

import NeuralSolver from './components/NeuralSolver';
import LiveAIInterface from './components/LiveAIInterface';
import SupportModal from './components/SupportModal';
import TimeSpentChart from './components/TimeSpentChart';
import { Bell, Home, BarChart2, FileText, User as UserIcon, Play, Book, CheckCircle2, Target, Clock, Shuffle, MessageCircle, X } from 'lucide-react';
import { PHYSICS_CHAPTERS, CHEMISTRY_CHAPTERS, BIOLOGY_CHAPTERS } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import FocusSessionSummary from './components/FocusSessionSummary';
import DistractionOverlay from './components/DistractionOverlay';
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

const getInitialView = () => {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const validViews: any[] = ['home', 'study', 'profile', 'editProfile', 'tests', 'notes', 'notesLibrary', 'NCERT11thHub', 'ncertHub', 'ntaQuestionsHub', 'oldPyqHistory', 'admin', 'adminChat', 'technicalSupport', 'analytics', 'customPractice', 'practiceTest', 'liveAI', 'mindHack', 'aiStudyPlan'];
  if (viewParam && validViews.includes(viewParam)) {
      return viewParam;
  }
  const path = window.location.pathname.replace('/', '');
  if (path && validViews.includes(path)) return path;
  return 'home';
};

export default function App() {
  useReportProblemGesture(() => setShowSupportModal(true));
  const [user, setUser] = useState<User | null>(null);
  const [currentView, _setCurrentView] = useState<any>(getInitialView());
  const currentViewRef = React.useRef(currentView);
  const [urlParams, setUrlParams] = useState<URLSearchParams>(new URLSearchParams(window.location.search));
  const urlParamsRef = React.useRef(urlParams);

  // Refs for tracking overlay states in the backButton listener
  const showNeuralSolverRef = React.useRef(false);
  const showSupportModalRef = React.useRef(false);
  const showPrivateVideosRef = React.useRef(false);
  const activeVideoRef = React.useRef<string | null>(null);
  const isNotificationViewRef = React.useRef(false);
  const showFlashcardsRef = React.useRef(false);
  const showStudyDashboardRef = React.useRef(false);
  const showResetModalRef = React.useRef(false);
  const showAnalyticsRef = React.useRef(false);
  const showRandomPopupRef = React.useRef(false);
  const showOnboardingRef = React.useRef(false);
  const showSummaryRef = React.useRef(false);
  const showNotificationsRef = React.useRef(false);
  const showChatRef = React.useRef(false);
  const lastBackPressedRef = React.useRef(0);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState(getDailyChapters());
  const [previousSubjects, setPreviousSubjects] = useState<typeof subjects | null>(null);
  const [chartData, setChartData] = useState<{ name: string, lectureMinutes: number, otherMinutes: number }[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [randomOverride, setRandomOverride] = useState<{ originalSubjects: typeof subjects, expiryTime: number, pendingSubjects: typeof subjects } | null>(null);
  const [randomChapter, setRandomChapter] = useState<{name: string, topic: string, color: string} | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [backPressCount, setBackPressCount] = useState(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isPYQRunning, setIsPYQRunning] = useState(false);

  const [showOnboarding, _setShowOnboarding] = useState(false);
  const setShowOnboarding = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showOnboarding: true }, '');
    _setShowOnboarding(v);
    showOnboardingRef.current = v;
  };

  const [showSupportModal, _setShowSupportModal] = useState(false);
  const setShowSupportModal = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showSupportModal: true }, '');
    _setShowSupportModal(v);
    showSupportModalRef.current = v;
  };

  const [showAnalytics, _setShowAnalytics] = useState(false);
  const setShowAnalytics = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showAnalytics: true }, '');
    _setShowAnalytics(v);
    showAnalyticsRef.current = v;
  };

  const [showNeuralSolver, _setShowNeuralSolver] = useState(false);
  const setShowNeuralSolver = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showNeuralSolver: true }, '');
    _setShowNeuralSolver(v);
    showNeuralSolverRef.current = v;
  };

  const [showResetModal, _setShowResetModal] = useState(false);
  const setShowResetModal = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showResetModal: true }, '');
    _setShowResetModal(v);
    showResetModalRef.current = v;
  };

  const [showRandomPopup, _setShowRandomPopup] = useState(false);
  const setShowRandomPopup = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showRandomPopup: true }, '');
    _setShowRandomPopup(v);
    showRandomPopupRef.current = v;
  };

  const [showPrivateVideos, _setShowPrivateVideos] = useState(false);
  const setShowPrivateVideos = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showPrivateVideos: true }, '');
    _setShowPrivateVideos(v);
    showPrivateVideosRef.current = v;
  };

  const [showFlashcards, _setShowFlashcards] = useState(false);
  const setShowFlashcards = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showFlashcards: true }, '');
    _setShowFlashcards(v);
    showFlashcardsRef.current = v;
  };

  const [showStudyDashboard, _setShowStudyDashboard] = useState(false);
  const setShowStudyDashboard = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showStudyDashboard: true }, '');
    _setShowStudyDashboard(v);
    showStudyDashboardRef.current = v;
  };

  const [showSummary, _setShowSummary] = useState(false);
  const setShowSummary = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showSummary: true }, '');
    _setShowSummary(v);
    showSummaryRef.current = v;
  };

  const [activeVideo, _setActiveVideo] = useState<string | null>(null);
  const setActiveVideo = (v: string | null) => {
    if (v) window.history.pushState({ ...window.history.state, activeVideo: v }, '');
    _setActiveVideo(v);
    activeVideoRef.current = v;
  };

  const [isNotificationView, _setIsNotificationView] = useState(false);
  const setIsNotificationView = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, isNotificationView: true }, '');
    _setIsNotificationView(v);
    isNotificationViewRef.current = v;
  };

  const [showNotifications, _setShowNotifications] = useState(false);
  const setShowNotifications = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showNotifications: true }, '');
    _setShowNotifications(v);
    showNotificationsRef.current = v;
  };

  const [showChat, _setShowChat] = useState(false);
  const setShowChat = (v: boolean) => {
    if (v) window.history.pushState({ ...window.history.state, showChat: true }, '');
    _setShowChat(v);
    showChatRef.current = v;
  };

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    urlParamsRef.current = urlParams;
  }, [urlParams]);

  // Handle status bar style based on current view
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const lightViews = ['mindHack', 'aiStudyPlan'];
      const isLight = lightViews.includes(currentView);
      
      // Style.Dark gives white text (for dark background)
      // Style.Light gives black text (for light background)
      StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark }).catch(() => {});
      
      // Use solid color instead of transparent if contrast is an issue
      StatusBar.setBackgroundColor({ color: isLight ? '#f4e4bc' : '#0a0f24' }).catch(() => {});
      
      // Ensure it overlays the webview
      StatusBar.show().catch(() => {});
    }
  }, [currentView]);

  useEffect(() => {
    // Initial state replacement to ensure first view is in history
    if (!window.history.state) {
        const view = currentView;
        const params: Record<string, string> = {};
        urlParams.forEach((v, k) => params[k] = v);
        window.history.replaceState({ view, params }, '', window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
        const state = event.state;
        if (state && state.privateVideoView) {
            return;
        }
        
        // Close overlays if they are not in the current state
        if (state) {
            _setIsNotificationView(!!state.isNotificationView);
            isNotificationViewRef.current = !!state.isNotificationView;
            
            _setShowAnalytics(!!state.showAnalytics);
            showAnalyticsRef.current = !!state.showAnalytics;
            
            _setShowNeuralSolver(!!state.showNeuralSolver);
            showNeuralSolverRef.current = !!state.showNeuralSolver;
            
            _setActiveVideo(state.activeVideo || null);
            activeVideoRef.current = state.activeVideo || null;
            
            _setShowResetModal(!!state.showResetModal);
            showResetModalRef.current = !!state.showResetModal;
            
            _setShowRandomPopup(!!state.showRandomPopup);
            showRandomPopupRef.current = !!state.showRandomPopup;
            
            _setShowPrivateVideos(!!state.showPrivateVideos);
            showPrivateVideosRef.current = !!state.showPrivateVideos;
            
            _setShowFlashcards(!!state.showFlashcards);
            showFlashcardsRef.current = !!state.showFlashcards;
            
            _setShowStudyDashboard(!!state.showStudyDashboard);
            showStudyDashboardRef.current = !!state.showStudyDashboard;
            
            _setShowSummary(!!state.showSummary);
            showSummaryRef.current = !!state.showSummary;
            
            _setShowNotifications(!!state.showNotifications);
            showNotificationsRef.current = !!state.showNotifications;
            
            _setShowChat(!!state.showChat);
            showChatRef.current = !!state.showChat;
            
            if (state.view) {
                _setCurrentView(state.view);
                if (state.params) {
                    setUrlParams(new URLSearchParams(state.params));
                }
            }
        } else {
            const searchParams = new URLSearchParams(window.location.search);
            const view = searchParams.get('view') || 'home';
            _setCurrentView(view);
            setUrlParams(searchParams);
            
            // Close all overlays on default state
            _setIsNotificationView(false);
            isNotificationViewRef.current = false;
            
            _setShowAnalytics(false);
            showAnalyticsRef.current = false;
            
            _setShowNeuralSolver(false);
            showNeuralSolverRef.current = false;
            
            _setActiveVideo(null);
            activeVideoRef.current = null;
            
            _setShowResetModal(false);
            showResetModalRef.current = false;
            
            _setShowRandomPopup(false);
            showRandomPopupRef.current = false;
            
            _setShowPrivateVideos(false);
            showPrivateVideosRef.current = false;
            
            _setShowFlashcards(false);
            showFlashcardsRef.current = false;
            
            _setShowStudyDashboard(false);
            showStudyDashboardRef.current = false;
            
            _setShowSummary(false);
            showSummaryRef.current = false;
            
            _setShowNotifications(false);
            showNotificationsRef.current = false;
            
            _setShowChat(false);
            showChatRef.current = false;
        }
    };
    window.addEventListener('popstate', handlePopState);

    // Capacitor Back Button Handling
    const backButtonListener = CapacitorApp.addListener('backButton', async () => {
        const state = window.history.state;
        
        // If an overlay is active (tracked in history state), just go back
        if (
            state?.showNotifications || 
            state?.showChat || 
            state?.showAnalytics || 
            state?.showNeuralSolver || 
            state?.showResetModal || 
            state?.showRandomPopup || 
            state?.showPrivateVideos || 
            state?.showFlashcards || 
            state?.showStudyDashboard || 
            state?.showSummary ||
            state?.activeVideo ||
            state?.isNotificationView
        ) {
            window.history.back();
            return;
        }

        const currentView = currentViewRef.current;
        
        // If we are on a sub-view, go back in history
        if (currentView !== 'home') {
            window.history.back();
        } else {
            // Double press to exit on Home
            const now = Date.now();
            if (now - lastBackPressedRef.current < 2000) {
                CapacitorApp.exitApp();
            } else {
                lastBackPressedRef.current = now;
                setShowExitToast(true);
                setTimeout(() => setShowExitToast(false), 2000);
            }
        }
    });

    return () => {
        window.removeEventListener('popstate', handlePopState);
        backButtonListener.then(l => l.remove());
    };
  }, []);

  const [practiceChapters, setPracticeChapters] = useState<{name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[]>([]);

  const [previousView, setPreviousView] = useState<typeof currentView | null>(null);
  const setCurrentView = (view: typeof currentView, params?: Record<string, string>) => {
    if (view === 'liveAI' && currentViewRef.current !== 'liveAI') {
        setPreviousView(currentViewRef.current);
    }
    
    const searchParams = new URLSearchParams();
    if (view !== 'home') {
        searchParams.set('view', view);
    }
    if (params) {
        Object.entries(params).forEach(([k, v]) => searchParams.set(k, v));
    }
    
    const queryString = searchParams.toString();
    const newUrl = queryString ? `/?${queryString}` : '/';
    
    // If we are navigating to the same view, we might want to replace instead of push
    // but the requirement says "Preserve navigation history correctly"
    // Usually, clicking a bottom nav tab should NOT push if it's the same tab.
    if (currentViewRef.current === view && !params) {
        return;
    }

    window.history.pushState({ view, params }, '', newUrl);
    setUrlParams(searchParams);
    _setCurrentView(view);
  };

  const setCurrentViewRef = React.useRef(setCurrentView);
  useEffect(() => {
    setCurrentViewRef.current = setCurrentView;
  }, [setCurrentView]);

  useEffect(() => {
    if (mainContainerRef.current) {
        mainContainerRef.current.scrollTop = 0;
    }
  }, [currentView]);

  const notificationRef = React.useRef<HTMLDivElement>(null);
  const mainContainerRef = React.useRef<HTMLDivElement>(null);
  const openAnalytics = async () => {
    if (!user) return;
    
    let dbDataMap: Record<string, any> = {};

    if (user.uid.startsWith('local_guest_')) {
        const today = getISTDateString();
        dbDataMap[today] = stats;
    } else {
        // Fetch analytics data from Firestore
        const analyticsRef = collection(db, 'users', user.uid, 'analytics_v2');
        const q = query(analyticsRef, orderBy('__name__', 'desc'), limit(15));
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach(doc => {
            dbDataMap[doc.id] = doc.data();
        });
    }

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

  const handleOpenResetModal = () => {
    setShowResetModal(true);
  };

  const handleOpenRandomPopup = () => {
    setShowRandomPopup(true);
  };

  const togglePrivateVideos = (v: boolean) => {
    setShowPrivateVideos(v);
  };
  const [notifications, setNotifications] = useState<{ id: string; message: string; readBy: string[]; timestamp: any }[]>([]);
  const [neetNotifications, setNeetNotifications] = useState<{ updates: string[]; timestamp: any }[]>([]);

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
    
    if (user.uid.startsWith('local_guest_')) {
      setNotifications([
        {
          id: 'welcome_guest',
          message: `👋 Welcome ${user.displayName || 'Guest'} to NeetMaster! You are currently using the Guest Account. Your progress is saved locally.`,
          readBy: [],
          timestamp: { toDate: () => new Date() } as any
        }
      ]);
      setNeetNotifications([
        {
          updates: [
            "NEET UG Exam Practice Mode",
            "You can view daily goals, watch lectures, and practice physics, chemistry, and biology chapters immediately."
          ],
          timestamp: { toDate: () => new Date() } as any
        }
      ]);
      return;
    }
    
    // Personal Notifications
    const notifRef = collection(db, 'notifications');
    const q = query(notifRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as any));
        setNotifications(data);
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'notifications');
    });                

    // NEET website notifications
    const neetRef = collection(db, 'neet_notifications');
    const qNeet = query(neetRef, orderBy('timestamp', 'desc'), limit(5));
    
    const unsubscribeNeet = onSnapshot(qNeet, (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as any);
        setNeetNotifications(data);
    }, (error) => {
        console.error("Error fetching NEET notifications:", error);
    });
    
    return () => { unsubscribe(); unsubscribeNeet(); };
  }, [user]);

  // Update render logic in notifications popup
  // Find where showNotifications popup is defined (around line 1104)

  const [resumingTest, setResumingTest] = useState<any>(null);
  
  // Focus Mode Global State
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLooking, setIsLooking] = useState(true);
  const [distractionSensitivity, setDistractionSensitivity] = useState(30); // Default 30 (~3 seconds)
  const [focusedTime, setFocusedTime] = useState(0);
  const [distractedTime, setDistractedTime] = useState(0);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const faceLandmarkerRef = React.useRef<any>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = React.useRef<any>(null);
  const sensitivityRef = React.useRef(distractionSensitivity);
  const lastFrameTimeRef = React.useRef(Date.now());
  const prevFocusModeRef = React.useRef(false);

  useEffect(() => {
    if (isLooking && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  }, [isLooking]);

  useEffect(() => {
    sensitivityRef.current = distractionSensitivity;
  }, [distractionSensitivity]);

  useEffect(() => {
      async function setupFaceLandmarker() {
          try {
              const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
              const vision = await FilesetResolver.forVisionTasks(
                  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
              );
              faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
                  baseOptions: {
                      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
                  },
                  runningMode: "VIDEO",
                  numFaces: 1,
                  outputFaceBlendshapes: true
              });
          } catch (e) {
              console.error("FaceLandmarker setup failed", e);
          }
      }
      setupFaceLandmarker();
  }, []);

  useEffect(() => {
      async function setupCamera() {
          if (isFocusMode) {
              try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                  streamRef.current = stream;
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                      await videoRef.current.play();
                  }
              } catch (err) {
                  console.error("Camera error:", err);
                  alert("Could not access camera for Focus Mode.");
                  setIsFocusMode(false);
              }
          } else {
              // Stop camera
              if (streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
                  streamRef.current = null;
              }
          }
      }
      setupCamera();
      
      // Cleanup on unmount
      return () => {
         if (streamRef.current) {
             streamRef.current.getTracks().forEach(track => track.stop());
         }
      }
  }, [isFocusMode]);

  const distractionCounter = React.useRef(0);

  const frameCounter = React.useRef(0);
  const startDetectionLoop = async () => {
      if (!isFocusMode || !videoRef.current) return;
      
      // Reduce detection frequency to save battery (process every 5th frame)
      frameCounter.current = (frameCounter.current + 1) % 5;
      if (frameCounter.current !== 0) {
          requestAnimationFrame(startDetectionLoop);
          return;
      }
      
      if (!faceLandmarkerRef.current) {
          requestAnimationFrame(startDetectionLoop);
          return;
      }
      
      const startTimeMs = performance.now();
      const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          const noseX = landmarks[1].x;
          const noseY = landmarks[1].y;
          
          let eyesClosed = false;
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              const blendshapes = results.faceBlendshapes[0].categories;
              const leftBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
              const rightBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;
              if (leftBlink > 0.6 && rightBlink > 0.6) {
                  eyesClosed = true;
              }
          }
          
          const isLookingHorizontal = noseX > 0.15 && noseX < 0.85; 
          const isLookingVertical = noseY > 0.1 && noseY < 0.9;   
          
          const isNowLooking = isLookingHorizontal && isLookingVertical && !eyesClosed;
          
          if (isNowLooking) {
              distractionCounter.current = 0;
              setIsLooking(true);
          } else {
              distractionCounter.current++;
              if (distractionCounter.current >= sensitivityRef.current) {
                  setIsLooking(false);
                  const now = Date.now();
                  if (!videoRef.current.dataset.lastAlert || now - parseInt(videoRef.current.dataset.lastAlert) > 5000) {
                      videoRef.current.dataset.lastAlert = now.toString();
                      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
                      audio.play().catch(e => console.log('Audio playback failed', e));
                  }
              }
          }
      } else {
          distractionCounter.current++;
          if (distractionCounter.current >= sensitivityRef.current) {
             setIsLooking(false);
                     const now = Date.now();
                     if (!videoRef.current || !videoRef.current.dataset.lastAlert || now - parseInt(videoRef.current.dataset.lastAlert) > 5000) {
                         if (videoRef.current) videoRef.current.dataset.lastAlert = now.toString();
                         if (!audioRef.current) {
                             audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
                         }
                         audioRef.current.play().catch(e => console.log('Audio playback failed', e));
                     }
          }
      }
      
      requestAnimationFrame(startDetectionLoop);
  };

  useEffect(() => {
    // Initial mount logic
    window.scrollTo(0, 0);

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
        if (e.state && e.state.privateVideoView) {
            return;
        }

        // If we have active overlays, close them
        // But for activeVideo, only close if we are not returning to a state that still has activeVideo
        if (showNotifications || showAnalytics || showResetModal || showRandomPopup) {
            setShowNotifications(false);
            setShowAnalytics(false);
            setShowResetModal(false);
            setShowRandomPopup(false);
            return;
        }

        if (activeVideo && !e.state?.activeVideo) {
            setActiveVideo(null);
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
      if (user.uid.startsWith('local_guest_')) {
          const localStats = localStorage.getItem(`stats_${user.uid}`);
          if (localStats) {
              try {
                  setStats(JSON.parse(localStats));
              } catch (e) {
                  console.error("Failed to parse local stats", e);
              }
          }
          return;
      }
      
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
    
    let dbDataMap: Record<string, any> = {};

    if (user.uid.startsWith('local_guest_')) {
        const today = getISTDateString();
        dbDataMap[today] = stats;
    } else {
        // Fetch analytics data from Firestore
        const analyticsRef = collection(db, 'users', user.uid, 'analytics_v2');
        const q = query(analyticsRef, orderBy('__name__', 'desc'), limit(15));
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach(doc => {
            dbDataMap[doc.id] = doc.data();
        });
    }

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


  const handleOpenNotifications = () => {
      setShowNotifications(false);
      setIsNotificationView(true);
  };

  const handleOpenNeuralSolver = () => {
      setShowNeuralSolver(true);
  };

  // Remove handleOpenVideo as setActiveVideo handles it
  
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
              
              if (user && newSeconds % 60 === 0) { // Update Firebase or localStorage every 60 seconds
                  if (user.uid.startsWith('local_guest_')) {
                      localStorage.setItem(`stats_${user.uid}`, JSON.stringify({
                          ...prev,
                          timeSpentSeconds: newSeconds,
                          lectureTimeSeconds: newLectureSeconds
                      }));
                  } else {
                      console.log("Attempting to save analytics to Firestore for user:", user.uid);
                      setDoc(doc(db, 'users', user.uid, 'analytics_v2', today), { 
                          timeSpentSeconds: newSeconds,
                          lectureTimeSeconds: newLectureSeconds
                      }, { merge: true }).then(() => {
                          console.log("Analytics saved successfully");
                      }).catch((err) => {
                          console.error("Failed to save analytics:", err);
                      });
                  }
              }
              
              return {...prev, timeSpentSeconds: newSeconds, lectureTimeSeconds: newLectureSeconds};
          });
      }, 1000);
      return () => clearInterval(interval);
  }, [user, activeVideo, statsLoaded]);

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async (retries = 3) => {
        if (user.uid.startsWith('local_guest_')) {
            const localStats = localStorage.getItem(`stats_${user.uid}`);
            if (localStats) {
                try {
                    setStats(JSON.parse(localStats));
                } catch (e) {
                    console.error("Failed to parse local stats", e);
                }
            } else {
                const today = getISTDateString();
                setStats(prev => ({...prev, date: today, timeSpentSeconds: 0, lectureTimeSeconds: 0}));
            }
            setStatsLoaded(true);
            return;
        }

        console.log("Checking stats for user", user?.uid);
        const today = getISTDateString();
        const docRef = doc(db, 'users', user!.uid, 'analytics_v2', today);
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log("Stats document found", data);
                setStats(prev => ({...prev, date: today, timeSpentSeconds: data.timeSpentSeconds, lectureTimeSeconds: data.lectureTimeSeconds || 0}));
            } else {
                console.log("No stats document found for today");
                setStats(prev => ({...prev, date: today, timeSpentSeconds: 0, lectureTimeSeconds: 0}));
            }
        } catch (e: any) {
            console.error("Error fetching stats:", e);
            if (e.message?.includes('offline') && retries > 0) {
                 console.log(`Retrying fetchStats after offline error, retries left: ${retries}`);
                 setTimeout(() => fetchStats(retries - 1), 5000);
                 return;
            }
        }
        setStatsLoaded(true);
    };
    fetchStats();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (user.uid.startsWith('local_guest_')) return;
    
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
    // Check for local guest user fallback first
    const cachedGuest = localStorage.getItem('guest_user');
    if (cachedGuest) {
      try {
        const parsedGuest = JSON.parse(cachedGuest);
        setUser(parsedGuest);
        setLoading(false);
        
        // Initialize guest subjects
        const localSubjs = localStorage.getItem(`subjects_${parsedGuest.uid}`);
        if (localSubjs) {
          setSubjects(JSON.parse(localSubjs));
        } else {
          const newSubjects = getNewUserChapters();
          setSubjects(newSubjects);
          localStorage.setItem(`subjects_${parsedGuest.uid}`, JSON.stringify(newSubjects));
        }
        return; // Skip normal onAuthStateChanged
      } catch (e) {
        console.error("Error loading cached guest:", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If there's a local guest, don't let Firebase auth override it with null
      if (localStorage.getItem('guest_user')) {
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
          updateUserPresence(currentUser.uid, true);
          
          try { 
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
          } catch (e) {
              console.warn('Firestore fetch failed (possibly offline):', e);
          }
      }
    });                
    
    // Check for day change
    const interval = setInterval(async () => {
        if (localStorage.getItem('guest_user')) {
            const cachedGuest = JSON.parse(localStorage.getItem('guest_user') || '{}');
            const localSubjs = localStorage.getItem(`subjects_${cachedGuest.uid}`);
            if (localSubjs) {
                // Keep local subjects synchronized or loaded
                const parsed = JSON.parse(localSubjs);
                setSubjects(parsed);
            }
            return;
        }

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

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f24] text-white overflow-hidden">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1]
                }}
                className="relative"
            >
                <div className="w-24 h-24 rounded-full border-4 border-blue-500/10 border-t-blue-500 animate-[spin_1.5s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                        animate={{ 
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-blue-500">
                            <path d="M7 10v4M10 8v8M13 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M17 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" />
                        </svg>
                    </motion.div>
                </div>
                <div className="absolute -inset-4 rounded-full bg-blue-500/5 animate-pulse" />
            </motion.div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-center"
            >
                <h1 className="mt-8 text-2xl font-bold tracking-[0.1em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                    NeetMaster
                </h1>
                <p className="mt-2 text-blue-500/40 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">
                    Initializing Workspace
                </p>
            </motion.div>

            <div className="absolute bottom-12 w-32 h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-1/2 h-full bg-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />
            </div>
        </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Helper to determine if we should show the main bottom nav and layout
  const isMainTab = ['home', 'study', 'tests', 'notes', 'profile'].includes(currentView);
  const isSubPage = ['analytics', 'customPractice', 'practiceTest', 'editProfile', 'notesLibrary', 'ncertHub', 'ntaQuestionsHub', 'oldPyqHistory', 'admin', 'adminChat', 'technicalSupport', 'aiStudyPlan', 'mindHack'].includes(currentView);

  return (
    <>
      {/* Global Overlays */}
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
            <motion.div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full relative z-50 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,white,blue,gray)] animate-spin"></div>
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
                    className="bg-card/90 p-4 rounded-2xl border border-blue-500 shadow-2xl backdrop-blur-md"
                >
                    <p className="font-bold text-base sm:text-lg text-white drop-shadow-md">{displayedText}</p>
                </motion.div>
            </motion.div>
            <p className="text-white mt-12 text-sm text-center font-medium animate-pulse">Tap anywhere to start</p>
          </div>
      )}

      {activeVideo && <VideoPlayer topic={activeVideo} onClose={() => setActiveVideo(null)} />}
      
      {showSummary && (
          <FocusSessionSummary 
              focusedTime={focusedTime}
              distractedTime={distractedTime}
              onClose={() => setShowSummary(false)}
          />
      )}

      {/* Main App Container */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className={`h-screen bg-background text-foreground font-sans overflow-hidden flex flex-col ${showOnboarding ? 'blur-sm' : ''}`}
      >
        <div 
            ref={mainContainerRef}
            className="flex-grow overflow-y-auto pt-[max(env(safe-area-inset-top,0px),12px)] px-3 pb-24"
        >
            <div className="relative z-10 max-w-full mx-auto w-full">
                {/* Home View (Main Layout items included) */}
                <div style={{ display: currentView === 'home' ? 'block' : 'none' }}>
                    <div className="flex justify-between items-center mb-3 select-none">
                        <div className="flex-1 min-w-0">
                           <h1 className="text-lg sm:text-xl font-bold flex items-center gap-1 sm:gap-2 truncate">Hello, {user?.displayName || 'Aspirant'}! 👋</h1>
                           <p className="text-gray-400 text-[9px] sm:text-[11px]">Let's make today productive</p>
                        </div>
                        <div className="relative" ref={notificationRef}>
                            <Bell className="h-6 w-6 cursor-pointer" onClick={() => setShowNotifications(true)} />
                             {notifications.some(n => !n.readBy?.includes(user?.uid)) ? (
                                 <span className="absolute top-0 right-0 bg-red-500 rounded-full w-2.5 h-2.5 border-2 border-[#0a0f24]"></span>
                             ) : null}
                            {showNotifications && (
                                <div className="absolute top-8 right-0 bg-card p-4 rounded-2xl shadow-xl w-64 z-[100] border border-border max-h-96 overflow-y-auto">
                                    <h3 className="font-bold mb-2">Notifications</h3>
                                    {/* ... notifications content ... */}
                                    {notifications.length === 0 && neetNotifications.length === 0 ? (
                                        <p className="text-gray-400 text-sm">No notifications</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Render notifications here (reusing existing logic) */}
                                            {notifications.map(n => (
                                                <div key={n.id} className="text-sm p-2 bg-[#0a1025] border border-blue-900/50 rounded-lg">
                                                    <p>{n.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <HubSwitcher active="home" onNavigate={setCurrentView} />

                    <div className="bg-card rounded-2xl p-3 sm:p-5 border border-border mb-4 mt-0 select-none">
                        <div className="flex justify-between items-center mb-2.5">
                            <h2 className="font-bold text-sm sm:text-lg">Your Performance</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <div onClick={() => setCurrentView('analytics')} className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 cursor-pointer">
                                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Tests Attempted</p>
                                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{stats.testsAttempted} <BarChart2 className="text-blue-500 h-4 w-4 sm:h-5 sm:w-5"/></h3>
                            </div>
                            <div onClick={openAnalytics} className="bg-white/5 p-2 sm:p-3 rounded-xl border border-white/5 cursor-pointer">
                                <p className="text-gray-400 text-[9px] sm:text-xs mb-0.5">Time Spent</p>
                                <h3 className="font-bold text-base sm:text-2xl flex items-center gap-2">{Math.floor(stats.timeSpentSeconds / 60)}m <Clock className="text-purple-400 h-4 w-4 sm:h-5 sm:w-5"/></h3>
                            </div>
                            {/* ... more performance items ... */}
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4 mt-6">
                        <h2 className="font-bold text-lg sm:text-xl">Continue Learning</h2>
                        <div className="flex items-center gap-2">
                            <button onClick={handleOpenResetModal} className="text-xs bg-red-900/50 text-red-300 px-3 py-1 rounded-full">Reset</button>
                            <button onClick={handleOpenRandomPopup} className="text-xs bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full flex items-center gap-1">
                                <Shuffle className="h-3 w-3" /> Random
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 mb-5 scroll-mt-20">
                        {subjects.map((sub, idx) => (
                            <div key={idx} className={`bg-card/80 backdrop-blur-sm border-l-4 ${sub.color} rounded-xl p-4 sm:p-6 flex justify-between items-center group shadow-md`}>
                                <div className="flex-1 min-w-0 mr-3">
                                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider truncate mb-1">{sub.name}</p>
                                  <p className="font-bold text-sm sm:text-lg truncate">{sub.topic}</p>
                                </div>
                                <button className="bg-white text-[#0a0f24] font-bold px-4 py-2 rounded-lg text-xs" onClick={() => setActiveVideo(sub.topic)}>START</button>
                            </div>
                        ))}
                    </div>

                    <div className="mb-4">
                        <AiSearch onFocus={() => setIsTyping(true)} />
                    </div>
                </div>

                {/* Tab: Study */}
                <div style={{ display: currentView === 'study' ? 'block' : 'none' }}>
                    <AnimatePresence mode="wait">
                       {showFlashcards && <Flashcards onClose={() => setShowFlashcards(false)} />}
                       {showStudyDashboard && <StudyDashboard onClose={() => setShowStudyDashboard(false)} />}
                       {showPrivateVideos && <PrivateVideos onClose={() => setShowPrivateVideos(false)} />}
                    </AnimatePresence>
                    <StudyHub 
                        subjects={subjects} 
                        setResumingTest={setResumingTest} 
                        setCurrentView={setCurrentView} 
                        isFocusMode={isFocusMode}
                        setIsFocusMode={setIsFocusMode}
                        setShowSummary={setShowSummary}
                        distractionSensitivity={distractionSensitivity}
                        setDistractionSensitivity={setDistractionSensitivity}
                        focusedTime={focusedTime}
                        distractedTime={distractedTime}
                        videoRef={videoRef}
                        isLooking={isLooking}
                        startDetectionLoop={startDetectionLoop}
                        setShowFlashcards={setShowFlashcards}
                        setShowStudyDashboard={setShowStudyDashboard}
                        setShowPrivateVideos={togglePrivateVideos}
                        onNavigate={setCurrentView} 
                    />
                </div>

                {/* Tab: Tests */}
                <div style={{ display: currentView === 'tests' ? 'block' : 'none' }}>
                    <TestHub subjects={subjects} onNavigate={setCurrentView} setIsPYQRunning={setIsPYQRunning} />
                </div>

                {/* Tab: Notes */}
                <div style={{ display: currentView === 'notes' ? 'block' : 'none' }}>
                    <Notes onNavigate={setCurrentView} />
                </div>

                {/* Tab: Profile */}
                <div style={{ display: currentView === 'profile' ? 'block' : 'none' }}>
                    <Profile user={user} onNavigate={setCurrentView} onSolverClick={() => setShowNeuralSolver(true)} />
                </div>

                {/* Other Views (rendered only when active to avoid excessive mounting) */}
                {currentView === 'analytics' && <AnalysisHistory onNavigate={setCurrentView} user={user} />}
                {currentView === 'customPractice' && <CustomPractice onBack={() => window.history.back()} onStart={(chapters) => { setPracticeChapters(chapters); setCurrentView('practiceTest'); }} />}
                {currentView === 'practiceTest' && (
                    resumingTest ? (
                        <PYQTestRunner 
                            questions={resumingTest.questions} 
                            title={resumingTest.title}
                            initialData={{ answers: resumingTest.answers, marked: resumingTest.marked, currentIndex: resumingTest.currentIndex, timeLeft: resumingTest.timeLeft }}
                            onBack={() => { setResumingTest(null); window.history.back(); }}
                        />
                    ) : (
                        <PracticeTest chapters={practiceChapters} onBack={() => window.history.back()} />
                    )
                )}
                {currentView === 'editProfile' && <EditProfile user={user} onNavigate={setCurrentView} />}
                {currentView === 'notesLibrary' && <NotesLibrary onBack={() => window.history.back()} />}
                {currentView === 'ncertHub' && <NCERTHub onBack={() => window.history.back()} />}
                {currentView === 'ntaQuestionsHub' && <NTAQuestionsHub onBack={() => window.history.back()} autoOpenPaperId={urlParams.get('paper') || undefined} />}
                {currentView === 'oldPyqHistory' && <OldPYQHistory onBack={() => window.history.back()} />}
                {currentView === 'admin' && <AdminPanel onNavigate={setCurrentView} />}
                {currentView === 'adminChat' && <AdminChatPage onBack={() => window.history.back()} />}
                {currentView === 'technicalSupport' && <UserChat fullScreen={true} user={user} onBack={() => window.history.back()} />}
                {currentView === 'aiStudyPlan' && <AIStudyPlanPage onBack={() => window.history.back()} onNavigate={setCurrentView} />}
                {currentView === 'mindHack' && <MindHackPage onBack={() => window.history.back()} />}
                {currentView === 'liveAI' && <LiveAIInterface onClose={() => window.history.back()} />}
                {isNotificationView && <NotificationPage onBack={() => window.history.back()} />}
            </div>
        </div>

        {/* Global UI Elements */}
        {showExitToast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-semibold z-[1000] shadow-2xl">
                Press back again to exit
            </div>
        )}

        {(isMainTab || isSubPage) && !isPYQRunning && (
            <BottomNav currentView={currentView as any} onNavigate={setCurrentView} />
        )}
        
        <FloatingAIAgent onNavigate={setCurrentView} isTyping={isTyping} />
        {isFocusMode && <DistractionOverlay isLooking={isLooking} />}
      </motion.div>

      {/* Overlay Modals that are not part of the main layout flow */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card p-5 sm:p-7 rounded-3xl border border-border w-full max-w-lg shadow-2xl relative">
               <button onClick={() => window.history.back()} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full">
                   <X className="h-4 w-4" />
               </button>
               <TimeSpentChart data={chartData} />
            </motion.div>
        </div>
      )}
      
      {showRandomPopup && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-6">
            <div className="bg-card p-6 rounded-2xl border border-border w-full max-w-sm text-center">
                <h2 className="text-xl font-bold mb-4">Random Chapter Picked!</h2>
                <p className="text-gray-300">"{randomChapter?.topic}" will be for 2 hours.</p>
                <div className="flex flex-col gap-2 mt-6">
                  <button onClick={applyRandomChapter} className="w-full bg-blue-600 py-2 rounded-lg font-bold">Got it</button>
                  <button onClick={() => window.history.back()} className="w-full bg-gray-700 py-2 rounded-lg font-bold">Restore Original</button>
                </div>
            </div>
        </div>
      )}
      
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-6">
            <div className="bg-card p-6 rounded-2xl border border-border w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Are you sure you want to restart?</h2>
                <div className="flex gap-3 mt-6">
                    <button onClick={handleReset} className="flex-1 bg-red-600 py-2 rounded-lg font-bold">Yes</button>
                    <button onClick={() => window.history.back()} className="flex-1 bg-white/10 py-2 rounded-lg font-bold">No</button>
                    <button onClick={handleRestore} className="flex-1 bg-blue-600 py-2 rounded-lg font-bold">Restore</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}

