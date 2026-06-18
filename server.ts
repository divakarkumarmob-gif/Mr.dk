import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { performSearch } from "./src/services/searchService";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import * as cheerio from 'cheerio';
import { OpenRouter } from "@openrouter/sdk";
import nodemailer from 'nodemailer';

// Initialize Firebase Admin
const app = admin.initializeApp({
    projectId: firebaseConfig.projectId,
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});


const logs: string[] = [];

dotenv.config();

const openrouter = process.env.OPENROUTER_API_KEY ? new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY }) : null;

function formatOpenRouterPrompt(prompt: string | any[]): string | any[] {
        if (typeof prompt === 'string') return prompt;
        if (prompt && (prompt as any).parts) {
            const parts = (prompt as any).parts.map((p: any) => {
                if (p.text) return { type: "text", text: p.text };
                if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
                return { type: "text", text: typeof p === 'string' ? p : JSON.stringify(p) };
            });
            // If only one text part, return it as string
            if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
            return parts;
        }
        return typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
}

async function callAI(prompt: string | any[]): Promise<string> {
        if (!openrouter) throw new Error("OpenRouter API key not configured");
        
        const content = formatOpenRouterPrompt(prompt);
        console.log("DEBUG: Calling OpenRouter with content type:", typeof content, "content:", JSON.stringify(content));
        const completion = await openrouter.chat.send({
            model: "openai/gpt-4o",
            messages: [{ role: "user", content: content as any }]
        });
        return completion.choices[0]?.message.content || "";
}

async function callAIStream(prompt: string | any[], res: express.Response): Promise<void> {
        if (!openrouter) throw new Error("OpenRouter API key not configured");
        
        const content = formatOpenRouterPrompt(prompt);
        console.log("DEBUG: Streaming OpenRouter with content type:", typeof content, "content:", JSON.stringify(content));
        const stream = await openrouter.chat.send({
            model: "openai/gpt-4o",
            messages: [{ role: "user", content: content as any }],
            stream: true
        });
        for await (const chunk of stream) {
            res.write(chunk.choices[0]?.delta?.content || "");
        }
}

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
  
  app.post("/api/send-otp", async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
        return res.status(400).json({ error: "Missing identifier" });
    }
    
    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store in Firestore
    try {
        const db = getFirestore();
        await db.collection('otps').doc(identifier).set({
            otp,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Send actual email
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: identifier,
            subject: "Your OTP for NeetMaster",
            text: `Your OTP is ${otp}. It expires in 5 minutes.`,
        });
        
        console.log(`[REAL] Sending OTP ${otp} to ${identifier}`);
        
        res.json({ success: true });
    } catch (error) {
        console.error("OTP generation error:", error);
        res.status(500).json({ error: "Failed to generate OTP" });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
        return res.status(400).json({ error: "Missing identifier or OTP" });
    }
    
    try {
        const db = getFirestore();
        const doc = await db.collection('otps').doc(identifier).get();
        if (!doc.exists) {
            return res.status(400).json({ error: "OTP not found or expired" });
        }
        
        const data = doc.data();
        if (data?.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }
        
        // Check expiration (e.g., 5 mins)
        if (Date.now() - data.createdAt.toMillis() > 5 * 60 * 1000) {
            return res.status(400).json({ error: "OTP expired" });
        }
        
        // Clean up
        await db.collection('otps').doc(identifier).delete();
        
        res.json({ success: true });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: "Failed to verify OTP" });
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

          const text = await callAI({ parts });
          
          res.json({ text });
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
            const analysis = await callAI(prompt);
            res.json({ analysis });
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
            const reply = await callAI(`You are a NEET tutor. Answer according to NCERT. Explain simply, be concise. ${lastMessage}`);
            res.json({ reply });
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
        const reply = await callAI(`You are a friendly NEET tutor. Answer accurately according to NCERT. ${lastMessage}`);

      res.json({ reply });
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
                // Use callAI for consistency to have fallback
                finalPrompt = await callAI({
                    parts: [
                        { text: "What is in the image? Give a 5 word search query." },
                        { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
                    ]
                });
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

        // Return result using AI with fallback
        if (isDirectImageQuestion || searchResults.length > 0) {
            let contents: any;
            if (isDirectImageQuestion) {
                 contents = { parts: [{ text: finalPrompt }, { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }] };
            } else {
                 const context = searchResults.slice(0, 3).map(s => `Title: ${s.title}\nContent: ${s.content}`).join('\n\n');
                 contents = `Summarize the following search results to answer the query: "${finalPrompt}" concisely and clearly in plain text. Do not use LaTeX. Only provide the summary.\n\nContext:\n${context}`;
            }

            let streamed = false;
            if (openrouter) {
                try {
                    const content = formatOpenRouterPrompt(contents);
                    console.log("Sending to OpenRouter:", JSON.stringify(content, null, 2));
                    if (!content) throw new Error("Content is empty");
                    const stream = await openrouter.chat.send({
                        model: "openai/gpt-4o",
                        messages: [{ role: "user", content: content as any }],
                        stream: true
                    });
                    for await (const chunk of stream) {
                       const text = chunk.choices[0]?.delta?.content || "";
                        if (text) {
                            res.write(`data: ${JSON.stringify({ content: sanitizeText(text) })}\n\n`);
                            streamed = true;
                        }
                    }
                } catch (e) {
                     console.error("OpenRouter stream failed, falling back to Gemini", e);
                }
            } 
            
            if (!streamed) {
                 throw new Error("No AI response available");
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
