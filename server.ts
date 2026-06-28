import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import https from "https";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { performSearch } from "./src/services/searchService";
import { GoogleGenAI } from "@google/genai";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import * as cheerio from 'cheerio';
import { OpenRouter } from "@openrouter/sdk";
import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize Firebase Admin
const app = admin.initializeApp({
    projectId: firebaseConfig.projectId,
});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        headers: {
            'User-Agent': 'aistudio-build',
        }
    }
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
const razorpay = new Razorpay({
        key_id: 'rzp_test_T3UJc0yCensXWD',
        key_secret: 'W5a7EKvfdCGGV9tsIvC5Iqzp',
    });

function formatOpenRouterPrompt(prompt: string | any[]): string | any[] {
        if (typeof prompt === 'string') return prompt;
        if (prompt && (prompt as any).parts) {
            const parts = (prompt as any).parts.map((p: any) => {
                if (p.text) return { type: "text", text: p.text };
                if (p.inlineData) {
                    if (p.inlineData.mimeType.startsWith('image/')) {
                        return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
                    }
                    if (p.inlineData.mimeType.startsWith('audio/')) {
                        return { type: "text", text: `[Audio attached, mimeType: ${p.inlineData.mimeType}]` };
                    }
                }
                return { type: "text", text: typeof p === 'string' ? p : JSON.stringify(p) };
            });
            // If only one text part, return it as string
            if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
            return parts;
        }
        return typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
}

async function callAI(prompt: string | any[]): Promise<string> {
    try {
        const systemInstruction = `Strict Instruction: Respond with extreme brevity. Be 100% accurate. If the answer is a single word or number, give only that. No filler, no explanations unless requested, no pleasantries. For math, just the result. Current Time: ${new Date().toISOString()}`;
        
        let contentParts: any[] = [];
        if (typeof prompt === 'string') {
            contentParts = [{ text: systemInstruction }, { text: prompt }];
        } else if (Array.isArray(prompt)) {
            contentParts = [{ text: systemInstruction }, ...prompt];
        } else {
            contentParts = [{ text: systemInstruction }, prompt];
        }

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash", 
            contents: { parts: contentParts }
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini AI Error:", error);
        return "Internal AI Error";
    }
}

async function callAIStream(prompt: string | any[], res: express.Response): Promise<void> {
    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-3.5-flash",
            contents: Array.isArray(prompt) ? { parts: prompt } : prompt
        });
        for await (const chunk of stream) {
            res.write(chunk.text || "");
        }
    } catch (error) {
        console.error("Gemini AI Streaming Error:", error);
        res.write("Internal AI Error during streaming");
    }
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));
  app.use(cors({ origin: "https://neetmaster.vercel.app" }));
  app.use("/api/", limiter);

  let s3Client: S3Client | null = null;
  function getS3Client() {
      if (!s3Client) {
          const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
          const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
          const region = process.env.AWS_REGION || "ap-south-1";

          if (!accessKeyId || !secretAccessKey) {
              throw new Error("AWS credentials are not configured in system environment variables.");
          }

          s3Client = new S3Client({
              region,
              credentials: {
                  accessKeyId,
                  secretAccessKey
              }
          });
      }
      return s3Client;
  }

  app.post("/api/private-videos", async (req, res) => {
    try {
        const bucketName = process.env.S3_BUCKET || "neetmaster-videos-01";
        const s3 = getS3Client();

        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
        });

        const listResponse = await s3.send(listCommand);
        const videoFiles = listResponse.Contents || [];
        
        // Filter out root files and non-video files
        const filteredFiles = videoFiles.filter(item => {
            const key = item.Key || "";
            if (!key.includes("/")) return false; // Ignore files in root
            
            const lowerKey = key.toLowerCase();
            return lowerKey.endsWith(".mp4") || 
                   lowerKey.endsWith(".mkv") || 
                   lowerKey.endsWith(".mov") || 
                   lowerKey.endsWith(".webm");
        });

        const videosWithUrl = await Promise.all(
            filteredFiles.map(async (item) => {
                const key = item.Key || "";
                const getObjectCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                });
                
                const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
                
                const parts = key.split("/");
                const subjectRaw = parts[0];
                const chapterRaw = parts.length > 2 ? parts[1] : "General";
                const filenameRaw = parts[parts.length - 1];
                
                // Format Subject Name
                let subject = subjectRaw.replace(/[_-]/g, " ");
                subject = subject.replace(/\b\w/g, c => c.toUpperCase());
                
                // Format Chapter Name
                let chapter = chapterRaw.replace(/[_-]/g, " ");
                chapter = chapter.replace(/\b\w/g, c => c.toUpperCase());
                
                // Format Lecture Title
                let title = filenameRaw.replace(/\.[^/.]+$/, ""); // Remove extension
                title = title.replace(/[_-]/g, " ");
                title = title.replace(/([a-zA-Z]+)(\d+)/g, "$1 $2");
                title = title.replace(/(\d+)([a-zA-Z]+)/g, "$1 $2");
                title = title.replace(/\b\w/g, c => c.toUpperCase());
                
                return {
                    key,
                    url: signedUrl,
                    size: item.Size,
                    lastModified: item.LastModified?.toISOString(),
                    title,
                    subject,
                    chapter
                };
            })
        );

        // Group by Subject and Chapter
        interface VideoItem {
            key: string;
            url: string;
            size?: number;
            lastModified?: string;
            title: string;
        }
        
        interface ChapterGroup {
            name: string;
            videos: VideoItem[];
        }
        
        interface SubjectGroup {
            name: string;
            chapters: ChapterGroup[];
        }

        const subjectMap = new Map<string, Map<string, VideoItem[]>>();

        for (const vid of videosWithUrl) {
            if (!subjectMap.has(vid.subject)) {
                subjectMap.set(vid.subject, new Map<string, VideoItem[]>());
            }
            const chapterMap = subjectMap.get(vid.subject)!;
            if (!chapterMap.has(vid.chapter)) {
                chapterMap.set(vid.chapter, []);
            }
            chapterMap.get(vid.chapter)!.push({
                key: vid.key,
                url: vid.url,
                size: vid.size,
                lastModified: vid.lastModified,
                title: vid.title
            });
        }

        const subjects: SubjectGroup[] = [];
        for (const [subjName, chapMap] of subjectMap.entries()) {
            const chapters: ChapterGroup[] = [];
            for (const [chapName, vids] of chapMap.entries()) {
                vids.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
                chapters.push({
                    name: chapName,
                    videos: vids
                });
            }
            chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            subjects.push({
                name: subjName,
                chapters
            });
        }
        subjects.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        res.json({ success: true, subjects });
    } catch (error: any) {
        console.error("AWS S3 Fetch Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Failed to load private videos from AWS S3." 
        });
    }
  });

  app.get("/api/logs", (req, res) => {
      res.json({ logs });
  });

  const otpStore = new Map<string, { otp: string; createdAt: number }>();

  app.post("/api/send-otp", async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
        return res.status(400).json({ error: "Missing identifier" });
    }
    
    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
        // Store in local in-memory store to avoid Firestore PERMISSION_DENIED errors on server
        otpStore.set(identifier, {
            otp,
            createdAt: Date.now()
        });

        // Determine if it is email and we can send it
        const isEmail = identifier.includes('@');
        const hasSmtp = process.env.SMTP_USER && process.env.SMTP_PASS;

        if (isEmail && hasSmtp) {
            try {
                await transporter.sendMail({
                    from: `"NeetMaster" <${process.env.SMTP_USER}>`,
                    to: identifier,
                    subject: "Your OTP for NeetMaster Verification",
                    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
                });
                console.log(`[SMTP] Successfully sent OTP ${otp} to ${identifier}`);
                return res.json({ success: true });
            } catch (smtpErr) {
                console.error("[SMTP Error] Failed to send email:", smtpErr);
                // Fallback to returning test OTP so they are never blocked
                return res.json({ 
                    success: true, 
                    testOtp: otp, 
                    warning: "SMTP delivery failed. Running in test fallback mode." 
                });
            }
        } else {
            console.log(`[TEST MODE] OTP generated for ${identifier}: ${otp}`);
            return res.json({ 
                success: true, 
                testOtp: otp, 
                mode: "test" 
            });
        }
    } catch (error: any) {
        console.error("OTP creation error:", error);
        res.status(500).json({ error: "Failed to generate OTP: " + error.message });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
        return res.status(400).json({ error: "Missing identifier or OTP" });
    }
    
    try {
        const stored = otpStore.get(identifier);
        if (!stored) {
            return res.status(400).json({ error: "OTP not found or expired. Please request a new OTP." });
        }
        
        if (stored.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP. Please try again." });
        }
        
        // Expiration check (5 minutes)
        if (Date.now() - stored.createdAt > 5 * 60 * 1000) {
            otpStore.delete(identifier);
            return res.status(400).json({ error: "OTP expired. Please request a new one." });
        }
        
        // Clean up
        otpStore.delete(identifier);
        res.json({ success: true });
    } catch (error: any) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: "Failed to verify OTP: " + error.message });
    }
  });
  
  app.get("/api/neet-notices", async (req, res) => {
    try {
        const response = await fetch("https://neet.nta.nic.in/", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.error(`NEET Notices Fetch Failed: ${response.status} ${response.statusText}`);
            throw new Error(`Failed to fetch: ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const publicNotices: {text: string, url: string}[] = [];
        const candidateActivity: {text: string, url: string}[] = [];
        
        // Find the sections based on visual headings
        const sections = {
            'Public Notices': [] as {text: string, url: string}[],
            'Candidate Activity': [] as {text: string, url: string}[]
        };

        // Try to find elements that look like headings
        const heading = $('h2, h3, .heading, strong').filter((_, el) => {
            const text = $(el).text().trim();
            return text.includes('Public Notices') || text.includes('Candidate Activity');
        });

        // Debugging logs to help identify structure issues
        console.log(`Found ${heading.length} potential headings`);

        heading.each((i, el) => {
            const headingText = $(el).text().trim();
            
            // Find the list container associated with this heading
            // Often it's a sibling, or a following element
            let container = $(el).parent().find('ul');
            if (container.length === 0) {
                container = $(el).nextAll('ul');
            }
            if (container.length === 0) {
                container = $(el).nextAll().find('ul');
            }

            const list = container.first().find('li');
            
            if (headingText.includes('Public Notices')) {
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
        
        console.log(`Extracted: ${sections['Public Notices'].length} Public Notices, ${sections['Candidate Activity'].length} Candidate Activity`);
        
        res.json({ 
            publicNotices: sections['Public Notices'].slice(0, 5), 
            candidateActivity: sections['Candidate Activity'].slice(0, 5) 
        });
    } catch (error) {
        console.error("NEET Notices Error:", error);
        res.status(500).json({ error: "Failed to fetch notices" });
    }
  });

  // API route for note analysis
  app.post("/api/ask-note", async (req, res) => {
      const { noteContent, question } = req.body;
      if (!noteContent || !question) {
          return res.status(400).json({ error: "Missing data" });
      }

      try {
          const prompt = `Use the following note content to answer the question. Be concise.\n\nNote:\n${noteContent}\n\nQuestion: ${question}`;
          const reply = await callAI(prompt);
          res.json({ reply });
      } catch (error) {
          console.error("Note AI Error:", error);
          res.status(500).json({ error: "Failed to get AI response" });
      }
  });

  app.post("/api/create-order", async (req, res) => {
    if (!razorpay) return res.status(500).json({ error: "Razorpay not configured" });
    const { amount } = req.body;
    try {
        const order = await razorpay.orders.create({
            amount: amount * 100, // amount in paise
            currency: "INR",
            receipt: "receipt_order_" + Date.now(),
        });
        res.json(order);
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
  });                

  app.post("/api/verify-payment", async (req, res) => {
    if (!razorpay) return res.status(500).json({ error: "Razorpay not configured" });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Verify
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');
    
    if (generated_signature === razorpay_signature) {
        // Success - You could mark payment as successful in db here
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Invalid signature" });
    }
  });                
  
  // API route for extracting questions from text
  app.post("/api/extract-questions", async (req, res) => {
      const { text, subject } = req.body;
      if (!text) {
          return res.status(400).json({ error: "Missing text" });
      }

      try {
          const prompt = `
            Extract multiple-choice questions from the following text and return them as a JSON array.
            Each object should have:
            - question: The question text
            - options: Array of 4 strings
            - correct_option: The index (0-3) of the correct answer
            - explanation: A brief explanation (NCERT based)
            - subject: "${subject || 'Biology'}"
            
            Return ONLY the raw JSON array. DO NOT include any markdown formatting, backticks, or other text.
            
            Text:
            ${text.slice(0, 5000)} // Limiting size for Gemini flash
          `;
          
          const reply = await callAI(prompt);
          // Try to clean the reply in case AI adds markdown
          const cleanedReply = reply.trim().replace(/^```json/, '').replace(/```$/, '').trim();
          const questions = JSON.parse(cleanedReply);
          res.json({ questions });
      } catch (error) {
          console.error("Extraction API Error:", error);
          res.status(500).json({ error: "Failed to extract questions" });
      }
  });

  // API route for gemini
  app.post("/api/gemini", async (req, res) => {
      const { messages, base64Audio } = req.body;
      
      try {
          const contents: any[] = [];
          
          if (messages && Array.isArray(messages)) {
              // Convert chat history to Gemini expected format
              messages.forEach((m: any) => {
                  contents.push({ text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}` });
              });
          }
          
          if (base64Audio) {
              contents.push({ inlineData: { data: base64Audio, mimeType: "audio/webm" } });
          }

          const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: { 
                parts: [
                    { text: `Strict Instruction: You are an expert NEET AI Assistant. 
Respond with extreme brevity and 100% accuracy. 
- If asked a simple question (like 2+2), respond with ONLY the answer (e.g., 4).
- No fluff, no "Certainly!", no "I am here to help".
- Use simple words.
- If it's a greeting, just say "Hello".
- Direct, actionable, minimal.` },
                    ...contents
                ] 
            },
          });
          
          res.json({ text: response.text });
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
            const reply = await callAI(`You are a NEET tutor. Answer strictly according to NCERT. Respond with extreme brevity. Simple words only. ${lastMessage}`);
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
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: { 
                parts: [
                    { text: "Strict Instruction: Be extremely brief, accurate, and simple. No fluff." },
                    { text: lastMessage }
                ]
            }
        });

        res.json({ reply: response.text });
    } catch (error) {
      console.error("Gemini API Error (Neural):", error);
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
                // Use Gemini for image analysis
                const response = await ai.models.generateContent({
                    model: "gemini-3.5-flash",
                    contents: {
                        parts: [
                            { text: "What is in the image? Give a 5 word search query." },
                            { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
                        ]
                    }
                });
                finalPrompt = response.text || "Search for this image";
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

        // Return result using AI
        if (isDirectImageQuestion || searchResults.length > 0) {
            let contents: any;
            if (isDirectImageQuestion) {
                 contents = { 
                    parts: [
                        { text: "Strict Instruction: Identify what is in the image and answer the user's question with extreme brevity and accuracy. No fluff." },
                        { text: finalPrompt || "Describe this" }, 
                        { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
                    ] 
                 };
            } else {
                 const context = searchResults.slice(0, 3).map(s => `Title: ${s.title}\nContent: ${s.content}`).join('\n\n');
                 contents = {
                    parts: [{ text: `Strict Instruction: Summarize the following search results to answer the query: "${finalPrompt}" with extreme brevity and 100% accuracy. Use plain simple text. No LaTeX. No pleasantries.\n\nContext:\n${context}` }]
                 };
            }

            let streamed = false;
            try {
                // Stream with Gemini
                const stream = await ai.models.generateContentStream({
                    model: "gemini-1.5-flash",
                    contents: contents
                });
                
                for await (const chunk of stream) {
                    if (chunk.text) {
                        res.write(`data: ${JSON.stringify({ content: sanitizeText(chunk.text) })}\n\n`);
                        streamed = true;
                    }
                }
            } catch (e) {
                console.error("Gemini stream failed", e);
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

  app.get("/api/proxy-pdf", async (req, res) => {
    const { url } = req.query;
    if (typeof url !== 'string') return res.status(400).json({ error: "URL required" });

    const maxRetries = 2;
    let attempt = 0;

    const fetchWithRedirects = (targetUrl: string, depth = 0): Promise<{buffer: Buffer, status: number, contentType: string}> => {
        if (depth > 5) return Promise.reject(new Error("Too many redirects"));

        return new Promise((resolve, reject) => {
            let urlObj: URL;
            try {
                urlObj = new URL(targetUrl);
            } catch (e) {
                return reject(new Error("Invalid URL: " + targetUrl));
            }

            const isNta = targetUrl.includes('nta.ac.in') || targetUrl.includes('nta.nic.in');
            const isNcert = targetUrl.includes('ncert.nic.in');
            const isGithub = targetUrl.includes('raw.githubusercontent.com');
            
            const options: https.RequestOptions = {
                method: 'GET',
                timeout: 35000,
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                }
            };

            if (isNta) {
                options.headers!['Referer'] = 'https://www.nta.ac.in/Downloads';
                options.headers!['Origin'] = 'https://www.nta.ac.in';
            } else if (isNcert) {
                options.headers!['Referer'] = 'https://ncert.nic.in/textbook.php';
                options.headers!['Origin'] = 'https://ncert.nic.in';
            } else if (isGithub) {
                options.headers!['Accept'] = '*/*';
            }

            const request = https.get(targetUrl, options, (response) => {
                if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
                    const location = response.headers.location;
                    if (location) {
                        const nextUrl = location.startsWith('http') ? location : `${urlObj.protocol}//${urlObj.hostname}${location.startsWith('/') ? '' : '/'}${location}`;
                        console.log(`NTA Proxy: Redirecting to ${nextUrl}`);
                        return resolve(fetchWithRedirects(nextUrl, depth + 1));
                    }
                }

                if (response.statusCode !== 200) {
                    console.error(`NTA Proxy: Server returned status ${response.statusCode} for ${targetUrl}`);
                    return resolve({ buffer: Buffer.alloc(0), status: response.statusCode || 500, contentType: response.headers['content-type'] || '' });
                }

                const chunks: Buffer[] = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    resolve({ 
                        buffer: Buffer.concat(chunks), 
                        status: 200, 
                        contentType: response.headers['content-type'] || 'application/pdf' 
                    });
                });
            });

            request.on('error', (err) => {
                console.error(`NTA Proxy Request Error (${targetUrl}):`, err.message);
                reject(err);
            });
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    };

    while (attempt <= maxRetries) {
      try {
        let currentUrl = url;
        
        // Strategy: If first attempt fails (404), maybe try alternative NTA domain pattern
        if (attempt === 1 && url.includes('www.nta.ac.in/Download/QuestionPaper')) {
            currentUrl = url.replace('www.nta.ac.in/Download/QuestionPaper', 'accad.nta.nic.in/QuestionPaper');
        }

        const result = await fetchWithRedirects(currentUrl);

        if (result.status === 200) {
          // Verify PDF Magic Number
          const isPdf = result.buffer.length > 4 && result.buffer.slice(0, 4).toString() === '%PDF';
          
          if (!isPdf) {
              const preview = result.buffer.slice(0, 100).toString();
              console.warn(`NTA Proxy: Received non-PDF data from ${currentUrl}. Content: ${preview}`);
              
              if (preview.toLowerCase().includes('<html') || preview.toLowerCase().includes('<!doctype')) {
                  // If we got HTML, it's likely a block page or error page
                  if (attempt < maxRetries) {
                      attempt++;
                      await new Promise(r => setTimeout(r, 1200 * attempt));
                      continue;
                  }
                  return res.status(403).json({ 
                      error: "NTA Blocked Request", 
                      message: "Official server is blocking our connection. Please use the Direct Link for now." 
                  });
              }
          }

          res.set({
            'Content-Type': 'application/pdf',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
            'Content-Disposition': 'inline',
            'Content-Length': result.buffer.length.toString()
          });
          return res.send(result.buffer);
        }
        
        if (result.status === 404 || result.status === 403) {
            if (attempt < maxRetries) {
                attempt++;
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }
        }
      } catch (error: any) {
        console.error(`NTA Proxy Attempt ${attempt} failed for ${url}:`, error.message);
        if (attempt === maxRetries) {
          const isTimeout = error.message === 'Timeout';
          return res.status(isTimeout ? 504 : 502).json({ 
            error: "Connectivity Issue", 
            details: isTimeout ? "The NTA official server took too long." : "Could not reach official NTA server."
          });
        }
      }
      
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.status(503).json({ 
      error: "Official Server Busy", 
      message: "The official NTA server is currently unreachable. Please try again in 5 minutes." 
    });
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      console.log("TTS Request received for text length:", text.length);
      
      const client = new textToSpeech.TextToSpeechClient();
      const request = {
        input: { text: text },
        voice: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-A', ssmlGender: 'FEMALE' as const },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      const [response] = await client.synthesizeSpeech(request);
      res.set('Content-Type', 'audio/mpeg');
      res.send(response.audioContent);
    } catch (error) {
      console.error("TTS Error (Full):", error);
      res.status(500).json({ error: "TTS failed" });
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
