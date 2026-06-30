import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, Sun, RotateCcw, RotateCw, Loader2, Check 
} from 'lucide-react';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

interface CustomVideoPlayerProps {
  src: string;
  title: string;
}

export default function CustomVideoPlayer({ src, title }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [brightness, setBrightness] = useState(1.0); // 0.15 to 1.0 range
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [isLoading, setIsLoading] = useState(true);

  // UI / Overlay States
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'main' | 'speed' | 'quality'>('main');

  // Skip & Slide Gesture Visual Feedback States
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'backward' | 'forward' | null>(null);
  const [gestureFeedback, setGestureFeedback] = useState<{
    type: 'volume' | 'brightness';
    value: number;
  } | null>(null);

  // Gesture Tracking Refs
  const dragStartRef = useRef<{ y: number; val: number; side: 'left' | 'right' } | null>(null);
  const [isDragMode, setIsDragMode] = useState(false);
  const dragHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playPauseFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [playPauseFeedback, setPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Manage body class and status bar for padding removal
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('video-fullscreen');
      if (Capacitor.isNativePlatform()) {
        StatusBar.hide().catch(() => {});
      }
    } else {
      document.body.classList.remove('video-fullscreen');
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch(() => {});
      }
    }
    return () => {
      document.body.classList.remove('video-fullscreen');
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch(() => {});
      }
    };
  }, [isFullscreen]);

  // Autohide controls logic
  const triggerControlsActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    triggerControlsActivity();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, showSettingsMenu]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (playPauseFeedbackTimeoutRef.current) {
      clearTimeout(playPauseFeedbackTimeoutRef.current);
    }

    if (isPlaying) {
      videoRef.current.pause();
      setPlayPauseFeedback('pause');
    } else {
      videoRef.current.play().catch(err => console.log('Autoplay blocked:', err));
      setPlayPauseFeedback('play');
    }

    playPauseFeedbackTimeoutRef.current = setTimeout(() => {
      setPlayPauseFeedback(null);
    }, 500);

    triggerControlsActivity();
  };

  // Synchronize React state with actual HTML5 video element events
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);
  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };
  const onWaiting = () => setIsLoading(true);
  const onPlaying = () => setIsLoading(false);

  // Seek on timeline
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekVal = parseFloat(e.target.value);
    videoRef.current.currentTime = seekVal;
    setCurrentTime(seekVal);
    triggerControlsActivity();
  };

  // Change Volume
  const handleVolumeChange = (newVal: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVal));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
      videoRef.current.muted = false;
    } else {
      setIsMuted(true);
      videoRef.current.muted = true;
    }
  };

  // Mute toggle
  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      videoRef.current.volume = 0;
    } else {
      videoRef.current.volume = volume;
    }
    triggerControlsActivity();
  };

  // Change Speed
  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettingsMenu(false);
    triggerControlsActivity();
  };

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Force landscape orientation via Capacitor
        if (Capacitor.isNativePlatform()) {
          ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
        } else {
          // Fallback for web
          if (window.screen.orientation && (window.screen.orientation as any).lock) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        }
      }).catch(err => console.error(err));
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        // Unlock orientation
        if (Capacitor.isNativePlatform()) {
          ScreenOrientation.lock({ orientation: 'portrait' }).then(() => {
            ScreenOrientation.unlock().catch(() => {});
          }).catch(() => {
            ScreenOrientation.unlock().catch(() => {});
          });
        } else {
          if (window.screen.orientation && window.screen.orientation.unlock) {
            window.screen.orientation.unlock();
          }
        }
      });
    }
    triggerControlsActivity();
  };

  // Add cleanup for orientation when component unmounts
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        ScreenOrientation.lock({ orientation: 'portrait' }).then(() => {
          ScreenOrientation.unlock().catch(() => {});
        }).catch(() => {
          ScreenOrientation.unlock().catch(() => {});
        });
      }
    };
  }, []);

  // Detect exit fullscreen via escape key / browser controls
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Jump Backward/Forward 10 seconds
  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    let nextTime = videoRef.current.currentTime + seconds;
    if (nextTime < 0) nextTime = 0;
    if (nextTime > duration) nextTime = duration;
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);

    // Visual animation feedback
    if (seconds < 0) {
      setDoubleTapFeedback('backward');
    } else {
      setDoubleTapFeedback('forward');
    }
    setTimeout(() => setDoubleTapFeedback(null), 800);
  };

  // --- MOUSE & TOUCH GESTURES (Double click & Drag adjustments) ---
  const handlePointerDown = (clientX: number, clientY: number, target: HTMLElement) => {
    if (target.closest('.no-gesture')) return; // Ignore on sliders/buttons

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = clientX - rect.left;
    const isLeft = clickX < rect.width / 2;

    const now = Date.now();
    const doubleTapDelay = 300;

    if (lastTapRef.current && (now - lastTapRef.current.time) < doubleTapDelay) {
      // It's a double tap! Cancel the scheduled single tap action
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      // Double Tap Action
      if (isLeft) {
        skip(-10);
      } else {
        skip(10);
      }
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { time: now, x: clientX };

    // Register drag coordinates for Slider gestures
    dragStartRef.current = {
      y: clientY,
      val: isLeft ? brightness : volume,
      side: isLeft ? 'left' : 'right'
    };

    // Start a hold timer for drag mode (Brightness/Volume)
    if (dragHoldTimerRef.current) clearTimeout(dragHoldTimerRef.current);
    dragHoldTimerRef.current = setTimeout(() => {
      if (dragStartRef.current) {
        setIsDragMode(true);
      }
    }, 400); // 400ms hold to activate drag mode

    // Schedule the single tap action with a slight delay
    // This allows us to cancel it if a second tap comes for a double tap
    singleTapTimeoutRef.current = setTimeout(() => {
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      // Center is defined as middle 40% horizontally (30% to 70%) and middle 60% vertically (20% to 80%)
      const isCenter = clickX > rect.width * 0.3 && clickX * 1.0 < rect.width * 0.7 && 
                       clickY > rect.height * 0.2 && clickY * 1.0 < rect.height * 0.8;

      if (isCenter) {
        // Toggle Play/Pause on center tap
        togglePlay();
        // Force controls shown and stay for 3 seconds
        setShowControls(true);
        triggerControlsActivity();
      } else {
        // Edge/Side tap: Toggle controls overlay visibility
        if (showControls) {
          setShowControls(false);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        } else {
          setShowControls(true);
          triggerControlsActivity();
        }
      }

      singleTapTimeoutRef.current = null;
    }, 250);
  };

  const handlePointerMove = (clientY: number) => {
    if (!dragStartRef.current) return;

    // If we have moved, it might be a single tap intent that's now a drag.
    // If they haven't held long enough, don't allow drag mode.
    if (!isDragMode) {
      // If they move too much before hold, cancel everything
      const deltaY = Math.abs(dragStartRef.current.y - clientY);
      if (deltaY > 10) {
        if (dragHoldTimerRef.current) {
          clearTimeout(dragHoldTimerRef.current);
          dragHoldTimerRef.current = null;
        }
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Slide delta normalized by player height
    const change = (dragStartRef.current.y - clientY) / (rect.height * 0.7); // scale rate
    const newVal = Math.max(0, Math.min(1, dragStartRef.current.val + change));

    if (dragStartRef.current.side === 'left') {
      // Adjust Brightness
      const clampedBrightness = Math.max(0.15, newVal); // prevent total black screen
      setBrightness(clampedBrightness);
      setGestureFeedback({ type: 'brightness', value: clampedBrightness });
    } else {
      // Adjust Volume
      handleVolumeChange(newVal);
      setGestureFeedback({ type: 'volume', value: newVal });
    }
  };
  const handlePointerUp = () => {
    if (dragHoldTimerRef.current) {
      clearTimeout(dragHoldTimerRef.current);
      dragHoldTimerRef.current = null;
    }
    dragStartRef.current = null;
    setIsDragMode(false);
    // Hide feedback after short delay
    setTimeout(() => {
      setGestureFeedback(null);
    }, 800);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black select-none group transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.8)] touch-none flex items-center justify-center overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[2000]' : 'aspect-video rounded-xl border border-white/15 hover:border-white/25 shadow-2xl'} landscape:fixed landscape:inset-0 landscape:z-[2000] landscape:rounded-none landscape:border-0`}
      onPointerDown={(e) => {
        // Only handle left clicks for mouse
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        handlePointerDown(e.clientX, e.clientY, e.target as HTMLElement);
      }}
      onPointerMove={(e) => {
        triggerControlsActivity();
        if (dragStartRef.current) {
          handlePointerMove(e.clientY);
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Pulse Loading Skeleton for Blank state */}
      {!src || isLoading ? (
        <div className="absolute inset-0 bg-[#0a0f1e] flex flex-col items-center justify-center overflow-hidden">
           {/* Pulsing Core */}
           <div className="relative w-24 h-24 flex items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-white/10 rounded-full blur-2xl"
              />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <Loader2 className="h-8 w-8 text-white/50 animate-spin" />
              </motion.div>
           </div>
           
           {/* Floating particle skeletons */}
           {[1, 2, 3, 4, 5].map((i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 }}
               animate={{ 
                 opacity: [0, 0.1, 0],
                 y: [Math.random() * 100, Math.random() * -100]
               }}
               transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: i * 0.5 }}
               className="absolute w-1 h-1 bg-white/20 rounded-full"
             />
           ))}
        </div>
      ) : null}

      {/* Actual HTML5 Video Tag with inline brightness CSS modifier */}
      <video
        ref={videoRef}
        src={src}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        className={`w-full h-full object-contain pointer-events-none transition-all duration-75 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        style={{ filter: `brightness(${brightness})` }}
        autoPlay
        preload="auto"
        playsInline
      />

      {/* --- GESTURE FEEDBACK ANIMATION WINDOWS --- */}
      <AnimatePresence>
        {/* Double Tap Skip Left/Right Indicators */}
        {doubleTapFeedback === 'backward' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-12 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-5 flex flex-col items-center justify-center pointer-events-none border border-white/10"
          >
            <RotateCcw className="h-7 w-7 text-white animate-pulse" />
            <span className="text-[11px] font-bold text-gray-200 mt-1.5">-10 SEC</span>
          </motion.div>
        )}
        {doubleTapFeedback === 'forward' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-12 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-5 flex flex-col items-center justify-center pointer-events-none border border-white/10"
          >
            <RotateCw className="h-7 w-7 text-white animate-pulse" />
            <span className="text-[11px] font-bold text-gray-200 mt-1.5">+10 SEC</span>
          </motion.div>
        )}

        {/* Dynamic Drag Gestures (Brightness / Volume HUD Overlay) */}
        {gestureFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2.5 pointer-events-none"
          >
            {gestureFeedback.type === 'brightness' ? (
              <Sun className="h-4.5 w-4.5 text-white" />
            ) : (
              <Volume2 className="h-4.5 w-4.5 text-blue-400" />
            )}
            <div className="w-20 bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full ${gestureFeedback.type === 'brightness' ? 'bg-white' : 'bg-blue-500'}`} 
                style={{ width: `${gestureFeedback.value * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white font-bold w-6 text-right">
              {Math.round(gestureFeedback.value * 100)}%
            </span>
          </motion.div>
        )}

        {/* Center Play/Pause Indicator Feedback */}
        {playPauseFeedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className="bg-black/60 rounded-full p-3 backdrop-blur-sm border border-white/10 shadow-lg flex items-center justify-center">
              {playPauseFeedback === 'play' ? (
                <Play className="h-5 w-5 text-white fill-white animate-pulse" />
              ) : (
                <Pause className="h-5 w-5 text-white fill-white animate-pulse" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HUD CONTROLS OVERLAY CONTAINER --- */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 flex flex-col justify-between p-3.5 landscape:p-6 landscape:px-[env(safe-area-inset-left,24px)] landscape:pr-[env(safe-area-inset-right,24px)]"
          >
            {/* Top Bar: Title & Configuration Setting Gear */}
            <div className="flex justify-between items-start pt-[env(safe-area-inset-top,0px)]">
              <div className="flex flex-col max-w-[70%]">
                <span className="text-white font-bold text-sm tracking-wide truncate">{title}</span>
                <span className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">LECTURE PLAYER</span>
              </div>
              
              <div className="relative no-gesture">
                <button 
                  onClick={() => {
                    setShowSettingsMenu(!showSettingsMenu);
                    setActiveMenu('main');
                  }}
                  className="p-2 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full border border-white/5 text-gray-200 hover:text-white transition"
                >
                  <Settings className={`h-4.5 w-4.5 ${showSettingsMenu ? 'rotate-45' : ''} transition-transform duration-300`} />
                </button>

                {/* Settings Gear Overlay Dropdown Menu */}
                {showSettingsMenu && (
                  <div className="absolute right-0 top-10 bg-black/95 border border-white/10 rounded-xl p-2 w-48 shadow-2xl backdrop-blur-md z-50 text-xs">
                    {activeMenu === 'main' && (
                      <div className="space-y-1">
                        <button 
                          onClick={() => setActiveMenu('speed')}
                          className="w-full flex justify-between items-center py-1.5 px-2.5 hover:bg-white/10 rounded-lg text-left text-gray-200"
                        >
                          <span>Playback Speed</span>
                          <span className="text-[10px] text-white font-semibold">{playbackSpeed}x</span>
                        </button>
                        <button 
                          onClick={() => setActiveMenu('quality')}
                          className="w-full flex justify-between items-center py-1.5 px-2.5 hover:bg-white/10 rounded-lg text-left text-gray-200"
                        >
                          <span>Video Quality</span>
                          <span className="text-[10px] text-blue-400 font-semibold truncate max-w-[60px]">{selectedQuality}</span>
                        </button>
                      </div>
                    )}

                    {activeMenu === 'speed' && (
                      <div>
                        <div className="border-b border-white/5 pb-1 mb-1 px-1.5 flex items-center justify-between">
                          <span className="font-bold text-[10px] text-gray-400">SELECT SPEED</span>
                          <button onClick={() => setActiveMenu('main')} className="text-[10px] text-white hover:underline">Back</button>
                        </div>
                        {[0.5, 1.0, 1.25, 1.5, 2.0].map((s) => (
                          <button 
                            key={s}
                            onClick={() => handleSpeedChange(s)}
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-white/10 rounded-lg text-left text-gray-200"
                          >
                            <span>{s === 1.0 ? 'Normal' : `${s}x`}</span>
                            {playbackSpeed === s && <Check className="h-3 w-3 text-white" />}
                          </button>
                        ))}
                      </div>
                    )}

                    {activeMenu === 'quality' && (
                      <div>
                        <div className="border-b border-white/5 pb-1 mb-1 px-1.5 flex items-center justify-between">
                          <span className="font-bold text-[10px] text-gray-400">SELECT QUALITY</span>
                          <button onClick={() => setActiveMenu('main')} className="text-[10px] text-white hover:underline">Back</button>
                        </div>
                        {['Auto', '1080p HD', '720p', '480p'].map((q) => (
                          <button 
                            key={q}
                            onClick={() => {
                              setSelectedQuality(q);
                              setShowSettingsMenu(false);
                            }}
                            className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-white/10 rounded-lg text-left text-gray-200"
                          >
                            <span>{q}</span>
                            {selectedQuality === q && <Check className="h-3 w-3 text-white" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Progress Timeline Bar + Player Control Button Actions */}
            <div className="space-y-2 no-gesture mt-auto">
              {/* Timeline Slider Progress Scrubber */}
              <div className="flex items-center gap-3 w-full">
                <span className="text-[10px] font-mono font-medium text-gray-300">
                  {formatTime(currentTime)}
                </span>
                
                <input 
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-white h-1.5 bg-white/25 rounded-lg cursor-pointer transition-all duration-150"
                />

                <span className="text-[10px] font-mono font-medium text-gray-300">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Action Toolbar Row */}
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center">
                  {/* Play & Pause toggle button */}
                  <button 
                    onClick={togglePlay}
                    className="p-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-xl text-white transition active:scale-95 flex items-center justify-center h-11 w-11 border border-white/10"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="h-5.5 w-5.5 fill-white" />
                    ) : (
                      <Play className="h-5.5 w-5.5 fill-white" />
                    )}
                  </button>
                </div>

                {/* Fullscreen controls */}
                <div className="flex items-center">
                  <button 
                    onClick={toggleFullscreen}
                    className="p-2.5 h-11 w-11 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl border border-white/10 flex items-center justify-center active:scale-95 transition-all shadow-md shadow-black/20"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? (
                      <Minimize className="h-5.5 w-5.5 text-white" />
                    ) : (
                      <Maximize className="h-5.5 w-5.5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
