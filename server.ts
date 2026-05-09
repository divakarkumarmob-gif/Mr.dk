import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import { google } from "googleapis";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: true,
  legacyHeaders: false,
});

dotenv.config();

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;
  
  app.use(express.json());
  app.use(cors());
  app.use("/api/", limiter);

  // API route for web search
  app.post("/api/web-search", async (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    if (!process.env.TAVILY_API_KEY) {
      return res.status(500).json({ error: "TAVILY_API_KEY not configured" });
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: query,
          search_depth: "basic",
        }),
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Tavily API Error:", error);
      res.status(500).json({ error: "Failed to fetch search results" });
    }
  });

  // API route for video search
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Missing search query" });
    }

    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YOUTUBE_API_KEY not configured" });
    }

    const youtube = google.youtube({
      version: "v3",
      auth: process.env.YOUTUBE_API_KEY,
    });

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

  async function fetchAIResponse(userMessages: { role: string; content: string }[], systemPromptContent: string) {
      const systemPrompt = {
        role: "system",
        content: systemPromptContent
      };
      const messagesWithSystem = [systemPrompt, ...userMessages];
      
      const models = ["openai/gpt-3.5-turbo", "inclusionai/ring-2.6-1t", "baidu/cobuddy-free"];
      let lastError = null;
      let reply = null;

      for (const model of models) {
        try {
          console.log(`Trying model: ${model}`);
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
              "X-Title": "My AI App"
            },
            body: JSON.stringify({
              model: model,
              messages: messagesWithSystem,
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Model ${model} failed (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          console.log(`OpenRouter response from ${model}:`, data);
          
          reply = data.choices[0]?.message?.content || "No response";
          break; // Success, exit loop
        } catch (error) {
          console.error(`Error with model ${model}:`, error);
          lastError = error;
        }
      }
      
      if (reply === null) {
        throw lastError;
      }
      return reply;
    }

    // API route for gemini
    app.post("/api/gemini", async (req, res) => {
        const { base64Audio, prompt } = req.body;
        if (!base64Audio || !prompt) {
            return res.status(400).json({ error: "Missing data" });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        try {
            const model = ai.models.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [
                        { inlineData: { data: base64Audio, mimeType: "audio/webm" } },
                        { text: prompt }
                    ]
                }]
            });
            
            res.json({ text: result.text });
        } catch (error) {
            console.error("Gemini API Error:", error);
            res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
        }
    });

    // API route for analysis
    app.post("/api/analysis", async (req, res) => {
        const { questions, answers } = req.body;
        if (!questions || !answers) {
          return res.status(400).json({ error: "Missing data" });
        }
    
        const prompt = `
            Analyze the following student test results carefully:
            - Total Questions: ${questions.length}
            - Correct: ${Object.values(answers).filter((a: any, idx: number) => a === questions[idx].correct_option).length}
            - Incorrect: ${Object.values(answers).filter((a: any, idx: number) => a && a !== questions[idx].correct_option).length}
            - Unattempted: ${questions.length - Object.keys(answers).length}
            
            Based on this, provide:
            1. A comprehensive performance summary (in Hinglish).
            2. Breakdown of strong and weak areas.
            3. Strategic, personalized advice on how to improve scores.
            
            Student Answers and Questions for reference: ${JSON.stringify(questions)}, ${JSON.stringify(answers)}
        `;
        
        try {
            const reply = await fetchAIResponse([{ role: "user", content: prompt }], "You are an expert tutor providing detailed test performance analysis in Hinglish (mix of Hindi and English) for a student.");
            res.json({ analysis: reply });
        } catch (error) {
            console.error("Analysis API Error:", error);
            res.status(500).json({ error: "Failed to get analysis: " + (error instanceof Error ? error.message : String(error)) });
        }
    });

    // API route for tutor
    app.post("/api/tutor", async (req, res) => {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: "Missing messages" });
        }
        
    try {
        const reply = await fetchAIResponse(messages, "You are a helpful and encouraging tutor. Talk in Hinglish. ONLY answer study-related questions. If the user asks something non-study related, politely refuse and ask them to stick to study-related topics. KEEP YOUR REPLIES SHORT, CONCISE, AND EFFECTIVE. When asked academic or educational questions, ensure your answers are accurate and adhere to the NCERT curriculum.");
        res.json({ reply });
    } catch (error) {
        console.error("Tutor API Error:", error);
        res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // API route for neural chat
  app.post("/api/neural-chat", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
    }
    
    try {
      console.log("Sending request to OpenRouter...");
      
      const reply = await fetchAIResponse(messages, "You are a friendly, approachable, and natural-sounding AI assistant. You talk like a close human friend, keeping conversations casual, engaging, and easy to relate to. Avoid stiff, overly formal, or robotic language. When asked academic or educational questions, ensure your answers are accurate and adhere to the NCERT curriculum.");
      
      res.json({ reply });
    } catch (error) {
      console.error("OpenRouter API Error:", error);
      res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
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
    // Backend in production acts as a pure API server
    app.get("/", (req, res) => {
      res.json({ status: "ok", message: "API server is running" });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
