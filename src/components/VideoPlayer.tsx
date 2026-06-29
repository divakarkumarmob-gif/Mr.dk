import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { CHAPTER_PLAYLISTS, PHYSICS_VIDEOS, CHEMISTRY_VIDEOS } from '../constants';
import { X, Play, Maximize2, Volume2, Settings } from 'lucide-react';

const Player = ReactPlayer as any;

export default function VideoPlayer({ topic, onClose, directUrl }: { topic: string; onClose: () => void; directUrl?: string }) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(directUrl || null);
  const [playTriggered, setPlayTriggered] = useState(!!directUrl);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(err => console.warn('StatusBar hide error:', err));
    }
  }, []);

  // Sync selectedVideoId with history state
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
        if (selectedVideoId) {
            setSelectedVideoId(null);
            setPlayTriggered(false);
        } else {
            onClose();
        }
    };
    window.addEventListener('popstate', handlePopState);
    
    // Push an initial state if opening
    if (window.history.state?.view !== 'video-player') {
        window.history.pushState({ view: 'video-player' }, '', '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedVideoId, onClose]);

  const selectVideo = (videoId: string) => {
    setSelectedVideoId(videoId);
    setPlayTriggered(true);
    // Push a state when a sub-video is selected so back button works
    window.history.pushState({ view: 'video-playing', videoId }, '', '');
  };

  const playlistId = CHAPTER_PLAYLISTS[topic.toLowerCase()];                
  const physicsVideos = Object.entries(PHYSICS_VIDEOS).find(([key, _]) => {
    const normalizedKey = key.toLowerCase().trim();
    const normalizedTopic = topic.toLowerCase().trim();
    return normalizedTopic.includes(normalizedKey) || normalizedKey.includes(normalizedTopic);
  })?.[1];

  const chemistryVideos = Object.entries(CHEMISTRY_VIDEOS).find(([key, _]) => {
    const normalizedKey = key.toLowerCase().trim();
    const normalizedTopic = topic.toLowerCase().trim();
    return normalizedTopic.includes(normalizedKey) || normalizedKey.includes(normalizedTopic);
  })?.[1];
  
  const videos = physicsVideos || chemistryVideos;

  // Reset selection if topic changes (but not if it was already selected)
  useEffect(() => {
    if (!directUrl && !selectedVideoId) {
        setSelectedVideoId(null);
        setPlayTriggered(false);
    }
  }, [topic]);

  const isUrl = (str: string) => str.startsWith('http');

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center backdrop-blur-sm overflow-hidden">
      <div className={`w-full max-w-4xl flex flex-col h-full ${selectedVideoId ? 'landscape:max-w-none landscape:h-screen' : 'max-h-[90vh] p-4'}`}>
        <div className={`flex justify-between items-center mb-3 px-4 ${selectedVideoId ? 'landscape:hidden' : ''}`}>
            <div className="landscape:hidden">
                <h2 className="text-lg font-bold text-white tracking-tight">{topic}</h2>
                <p className="text-gray-500 text-[8px] uppercase tracking-widest mt-0.5">Lecture Series • NEET Mastery</p>
            </div>
            <button 
                className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-full transition-all active:scale-95 landscape:hidden" 
                onClick={onClose}
            >
                <X className="h-4 w-4" />
            </button>
        </div>
        
        <div className={`flex-1 flex flex-col items-center justify-center min-h-0 ${selectedVideoId ? 'landscape:fixed landscape:inset-0 landscape:z-[300] landscape:bg-black' : ''}`}>
            {/* VIDEO STAGE */}
            <div className={`w-full relative bg-[#0d1117] overflow-hidden border-white/5 shadow-2xl group ${selectedVideoId ? 'landscape:aspect-auto landscape:w-full landscape:h-full landscape:border-0 landscape:rounded-none rounded-2xl aspect-video' : 'aspect-video rounded-2xl border'}`}>
                {selectedVideoId ? (
                    <div className="w-full h-full">
                        {isUrl(selectedVideoId) ? (
                            <Player
                                url={selectedVideoId}
                                width="100%"
                                height="100%"
                                controls
                                playing={playTriggered}
                                onStart={() => setPlayTriggered(true)}
                                config={{
                                    file: {
                                        attributes: {
                                            controlsList: 'nodownload'
                                        }
                                    }
                                }}
                            />
                        ) : (
                            <iframe
                                title={topic}
                                width="100%"
                                height="100%"
                                src={playTriggered ? `https://www.youtube.com/embed/${selectedVideoId}?autoplay=1&modestbranding=1&rel=0` : undefined}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        )}
                        
                        {!playTriggered && !isUrl(selectedVideoId) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all">
                                <button 
                                    onClick={() => setPlayTriggered(true)}
                                    className="bg-orange-500 text-white w-20 h-20 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform active:scale-95"
                                >
                                    <Play className="h-8 w-8 fill-current ml-1" />
                                </button>
                            </div>
                        )}
                    </div>
                ) : playlistId ? (
                    <iframe
                      title={`${topic} Playlist`}
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/videoseries?list=${playlistId}&modestbranding=1&rel=0`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                         <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                             <Play className="h-8 w-8 text-white/20" />
                         </div>
                         <p className="text-gray-400 font-medium">Select a lecture part to start learning</p>
                    </div>
                )}
            </div>

            {/* CONTROLS / SELECTION */}
            {videos && (
                <div className={`w-full mt-8 overflow-x-auto pb-4 custom-scrollbar ${selectedVideoId ? 'landscape:hidden' : ''}`}>
                    <div className="flex gap-3 min-w-max px-2">
                        {Object.entries(videos).map(([partName, videoId]: [string, string]) => (
                            <button
                                key={partName}
                                onClick={() => selectVideo(videoId)}
                                className={`px-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center gap-3 ${
                                    selectedVideoId === videoId 
                                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedVideoId === videoId ? 'bg-white/20' : 'bg-white/5'}`}>
                                    <Play className={`h-3 w-3 ${selectedVideoId === videoId ? 'fill-current' : ''}`} />
                                </div>
                                {partName.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {!videos && !playlistId && (
                <div className="mt-8 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
                    <X className="text-red-500 h-5 w-5" />
                    <p className="text-red-400 text-sm font-medium">No video data available for this chapter.</p>
                </div>
            )}
        </div>
        
        <div className={`mt-auto py-6 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500 font-mono tracking-widest uppercase px-4 ${selectedVideoId ? 'landscape:hidden' : ''}`}>
            <span>Server: NEET-CDN-NODE-01</span>
            <span className="text-orange-500/50">Secure Stream Active</span>
            <span>Quality: 1080p Auto</span>
        </div>
      </div>
    </div>
  );
}
