import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // YouTube API Setup
  console.log("YOUTUBE_API_KEY loaded:", !!process.env.YOUTUBE_API_KEY);
  const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY,
  });

  // API route for video search
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Missing search query" });
    }

    try {
      // 1. QUERY CONSTRUCTION
      const searchQuery = `${q} NEET -JEE concept lecture one shot`;

      // 2. FETCH CONDITIONS
      const searchResponse = await youtube.search.list({
        part: ["snippet"],
        q: searchQuery,
        type: ["video"],
        maxResults: 15, // Increase to ensure enough candidates
        videoDuration: "medium",
        order: "relevance",
      });

      const items = searchResponse.data.items || [];
      if (items.length === 0) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Need statistics for viewCount and contentDetails for duration
      const videoIds = items.map(item => item.id?.videoId).filter(Boolean) as string[];
      const statsResponse = await youtube.videos.list({
        part: ["statistics", "snippet", "contentDetails"],
        id: videoIds,
      });

      function parseDuration(duration: string): number {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const hours = parseInt(match[1] || "0");
        const minutes = parseInt(match[2] || "0");
        const seconds = parseInt(match[3] || "0");
        return hours * 3600 + minutes * 60 + seconds;
      }

      const videos = (statsResponse.data.items || []).map(video => ({
        title: video.snippet?.title || "",
        videoId: video.id || "",
        channel: video.snippet?.channelTitle || "",
        viewCount: parseInt(video.statistics?.viewCount || "0"),
        durationSeconds: parseDuration(video.contentDetails?.duration || ""),
      }));

      // 3. FILTERING
      const filteredVideos = videos.filter(v => {
        const titleLower = v.title.toLowerCase();
        const forbidden = ["motivation", "strategy", "shorts", "status", "jee"]; // Exclude JEE
        return !forbidden.some(word => titleLower.includes(word));
      });

      // 4. SCORING
      const scoredVideos = filteredVideos.map(v => {
        const titleLower = v.title.toLowerCase();
        let score = 0;
        if (titleLower.includes("neet")) score += 5;
        if (titleLower.includes("one shot")) score += 4;
        if (titleLower.includes("lecture") || titleLower.includes("concept")) score += 3;
        if (titleLower.includes("revision")) score += 2;
        
        const channelLower = v.channel.toLowerCase();
        if (channelLower.includes("physics wallah")) score += 100; // Heavy boost
        else if (["allen", "unacademy", "vedantu"].some(tc => channelLower.includes(tc))) score += 50;
        
        // Duration scoring
        if (v.durationSeconds >= 3600) score += 50; // > 1 hour
        if (v.durationSeconds < 1200) score -= 50;  // < 20 mins penalty
        
        score += (v.viewCount / 100000);
        
        return { ...v, score };
      });

      // 5. RANKING
      scoredVideos.sort((a, b) => b.score - a.score);
      const top3 = scoredVideos.slice(0, 3);
      
      // Handle the output structure requirements
      const categorized: any = {};

      // Helper to find by category
      function findAndRemove(keywords: string[]) {
        const index = top3.findIndex(v => keywords.some(k => v.title.toLowerCase().includes(k)));
        if (index !== -1) return top3.splice(index, 1)[0];
        return null; // or fallback
      }

      categorized.quick_revision = findAndRemove(["revision"]) || top3.pop() || top3[0] || {};
      categorized.full_lecture = findAndRemove(["one shot", "lecture"]) || top3.pop() || top3[0] || {};

      res.json(categorized);
    } catch (error) {
      console.error("YouTube API Error:", error);
      res.status(500).json({ error: "Failed to fetch video" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Assuming 'dist' is the build directory. We need to handle this.
    // However, in this environment, I don't need to worry too much about prod serving, 
    // just make it robust enough.
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
