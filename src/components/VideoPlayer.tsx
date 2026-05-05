import React, { useState, useEffect } from 'react';
import { CHAPTER_PLAYLISTS, PHYSICS_VIDEOS, CHEMISTRY_VIDEOS } from '../constants';

export default function VideoPlayer({ topic, onClose }: { topic: string; onClose: () => void }) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [playTriggered, setPlayTriggered] = useState(false);

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

  // Reset selection if topic changes
  useEffect(() => {
    setSelectedVideoId(null);
    setPlayTriggered(false);
  }, [topic]);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
      <button className="text-white font-bold text-sm bg-gray-800 px-4 py-1 rounded-md hover:bg-gray-700 transition mb-4" onClick={onClose}>Close</button>
      <h2 className="text-2xl font-bold text-white mb-6 tracking-wide">{topic}</h2>
      
      {/* CASE 1: Specific Videos (Highest Priority) */}
      {videos && (
        <div className="w-full max-w-2xl">
          {!selectedVideoId && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {Object.entries(videos).map(([partName, videoId]: [string, string]) => (
                  <button
                  key={partName}
                  onClick={() => { setSelectedVideoId(videoId); setPlayTriggered(false); }}
                  className="px-4 py-2 rounded-full bg-gray-700 text-white hover:bg-orange-600 transition truncate text-sm"
                  >
                  {partName}
                  </button>
              ))}
              </div>
          )}
          {selectedVideoId && (
              <div className="relative aspect-video bg-black flex items-center justify-center">
                  <iframe
                  title={topic}
                  width="100%"
                  height="100%"
                  src={playTriggered ? `https://www.youtube.com/embed/${selectedVideoId}?autoplay=1` : undefined}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                  />
              
              {!playTriggered && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <button 
                      onClick={() => setPlayTriggered(true)}
                      className="bg-orange-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-orange-600 transition"
                  >
                      Play
                  </button>
                  </div>
              )}
              </div>
          )}
        </div>
      )}

      {/* CASE 2: Playlist Fallback */}
      {!videos && playlistId && (
        <div className="w-full max-w-2xl aspect-video bg-black flex items-center justify-center">
            <iframe
              title={`${topic} Playlist`}
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/videoseries?list=${playlistId}&modestbranding=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
        </div>
      )}
      
      {!videos && !playlistId && (
          <p className="text-gray-400">No video data available for this chapter.</p>
      )}
    </div>
  );
}
