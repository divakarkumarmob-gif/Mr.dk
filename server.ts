import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ai } from "./src/lib/gemini";
import { performSearch } from "./src/services/searchService";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import * as cheerio from 'cheerio';

// Initialize Firebase Admin
admin.initializeApp({
    projectId: firebaseConfig.projectId,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});


const logs: string[] = [];

dotenv.config();

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));
  app.use(cors({ origin: "https://neetmaster.vercel.app" }));
  app.use("/api/", limiter);

  app.get("/api/logs", (req, res) => {
      res.json({ logs });
  });
  
  app.post("/api/ask", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    try {
            const completion = await ai.models.generateContent({
                model: "gemini-1.5-flash",
                contents: prompt
            });
            res.json({ text: completion.text });
    } catch (error) {
        console.error("Ask API Error:", error, JSON.stringify(error, Object.getOwnPropertyNames(error)));
        res.status(500).json({ error: "Failed to get AI response", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/neet-notices", async (req, res) => {
    try {
        const response = await fetch("https://neet.nta.nic.in/");
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const publicNotices: string[] = [];
        const candidateActivity: string[] = [];
        
        // Find the sections based on visual headings
        const sections = {
            'Public Notices': [] as {text: string, url: string}[],
            'Candidate Activity': [] as {text: string, url: string}[]
        };

        // Try to find elements that look like headings
        $('h1, h2, h3, h4, .heading').each((i, el) => {
            const headingText = $(el).text().trim();
            if (headingText.includes('Public Notices')) {
                // Assuming the list follows the heading
                const list = $(el).nextAll('ul').first().find('li');
                list.each((j, li) => {
                    const link = $(li).find('a');
                    const text = link.text().trim() || $(li).text().trim();
                    let url = link.attr('href');
                    if (url && !url.startsWith('http')) {
                        url = 'https://neet.nta.nic.in' + url;
                    }
                    if (text) sections['Public Notices'].push({ text, url: url || '#' });
                });
            }
            if (headingText.includes('Candidate Activity')) {
                const list = $(el).nextAll('ul').first().find('li');
                list.each((j, li) => {
                    const link = $(li).find('a');
                    const text = link.text().trim() || $(li).text().trim();
                    let url = link.attr('href');
                    if (url && !url.startsWith('http')) {
                        url = 'https://neet.nta.nic.in' + url;
                    }
                    if (text) sections['Candidate Activity'].push({ text, url: url || '#' });
                });
            }
        });
        
        res.json({ 
            publicNotices: sections['Public Notices'].slice(0, 5), 
            candidateActivity: sections['Candidate Activity'].slice(0, 5) 
        });
    } catch (error) {
        console.error("NEET Notices Error:", error);
        res.status(500).json({ error: "Failed to fetch notices" });
    }
  });

  // API route for gemini
  app.post("/api/gemini", async (req, res) => {
      const { base64Audio, base64Image, prompt } = req.body;                
      if (!prompt) {
          return res.status(400).json({ error: "Missing prompt" });
      }

      try {
          const parts: any[] = [];
          if (base64Audio) {
              parts.push({ inlineData: { data: base64Audio, mimeType: "audio/webm" } });
          }
          if (base64Image) {
              const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
              parts.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
          }
          parts.push({ text: prompt });

          const completion = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: { parts }
          });
          
          res.json({ text: completion.text });
      } catch (error) {
          console.error("Gemini API Error:", error);
          res.status(500).json({ error: "Failed to get AI response" });
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
            const completion = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: prompt
            });
            res.json({ analysis: completion.text });
        } catch (error) {
            console.error("Analysis API Error:", error);
            res.status(500).json({ error: "Failed to get analysis" });
        }
    });

    // API route for tutor
    app.post("/api/tutor", async (req, res) => {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: "Missing messages" });
        }
        
        const lastMessage = messages[messages.length - 1].content;
        
        try {
            const completion = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: `You are a NEET tutor. Answer according to NCERT. Explain simply, be concise. ${lastMessage}`
            });
            res.json({ reply: completion.text });
        } catch (error) {
            console.error("Tutor API Error:", error);
            res.status(500).json({ error: "Failed to get AI response" });
        }
    });

  // API route for neural chat
  app.post("/api/neural-chat", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages" });
    }
    
    const lastMessage = messages[messages.length - 1].content;
    
    try {
        // 2. Answer based on the chapter
        const completion = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `You are a friendly NEET tutor. Answer accurately according to NCERT. ${lastMessage}`
        });

      res.json({ reply: completion.text });
    } catch (error) {
      console.error("OpenAI API Error:", error);
      res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
    }
  });


  // API route for streaming search (Phase 2)
  app.post("/api/search-stream", async (req, res) => {
    const { prompt, base64Image } = req.body;
    if (!prompt && !base64Image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // 1. If image, find query
        let finalPrompt = prompt;
        if (base64Image && (!prompt || prompt.length < 5)) {
            try {
                const completion = await ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: {
                        parts: [
                            { text: "What is in the image? Give a 5 word search query." },
                            { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
                        ]
                    }
                });
                finalPrompt = completion.text || "Search for this image";
            } catch (imgErr) {
                console.error("Image analysis failed:", imgErr);
                finalPrompt = "Search for this image";
            }
            res.write(`data: ${JSON.stringify({ query: finalPrompt })}\n\n`);
        }

        let searchResults: any[] = [];
        const isDirectImageQuestion = base64Image && prompt && prompt.length >= 5;
        
        if (!isDirectImageQuestion && finalPrompt) {
            searchResults = await performSearch(finalPrompt);
            res.write(`data: ${JSON.stringify({ sources: searchResults })}\n\n`);
        }
        
        const sanitizeText = (text: string): string => {
            return text
                .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
                .replace(/\$/g, '')
                .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '($1 / $2)')
                .replace(/\\times/g, ' × ')
                .replace(/\\dot\s*\{([^}]+)\}/g, ' · ')
                .replace(/\\cdot/g, ' · ')
                .replace(/\\text\s*\{([^}]+)\}/g, '$1')
                .replace(/_([a-zA-Z0-9])/g, '$1')
                .replace(/\^2/g, '²')
                .replace(/\\theta/g, 'θ')
                .replace(/\\alpha/g, 'α')
                .replace(/\\beta/g, 'β')
                .replace(/\\gamma/g, 'γ')
                .replace(/\\pi/g, 'π')
                .replace(/\\Delta/g, 'Δ')
                .replace(/\\[a-zA-Z]+/g, '')
                .replace(/[\{\}]/g, '');
        };

        // Return result using Gemini
        if (isDirectImageQuestion || searchResults.length > 0) {
            let contents: any;
            if (isDirectImageQuestion) {
                 contents = { parts: [{ text: finalPrompt }, { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }] };
            } else {
                 const context = searchResults.slice(0, 3).map(s => `Title: ${s.title}\nContent: ${s.content}`).join('\n\n');
                 contents = `Summarize the following search results to answer the query: "${finalPrompt}" concisely and clearly in plain text. Do not use LaTeX. Only provide the summary.\n\nContext:\n${context}`;
            }

            const stream = await ai.models.generateContentStream({
                model: "gemini-1.5-flash",
                contents: contents
            });

            for await (const chunk of stream) {
                const text = chunk.text || "";
                if (text) {
                    res.write(`data: ${JSON.stringify({ content: sanitizeText(text) })}\n\n`);
                }
            }
        } else {
            res.write(`data: ${JSON.stringify({ content: "No results found." })}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error("Streaming Search Error:", error);
        res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
        res.end();
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
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
