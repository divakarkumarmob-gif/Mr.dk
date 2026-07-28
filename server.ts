import express from "express";
import { createServer as createViteServer } from "vite";
import * as path from "path";
import https from "https";
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from "dotenv";

// Load environment variables immediately before any other initialization
dotenv.config();

import cors from "cors";
import rateLimit from "express-rate-limit";
import { performSearch } from "./src/services/searchService";
import { GoogleGenAI, Modality } from "@google/genai";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import * as cheerio from 'cheerio';
import { OpenRouter } from "@openrouter/sdk";
import nodemailer from 'nodemailer';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListBucketsCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";

// Initialize Firebase Admin
console.log("Initializing Firebase Admin...");
let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
    console.log("Using provided service account credentials.");
  } catch (e) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON", e);
  }
} else {
    console.log("No FIREBASE_SERVICE_ACCOUNT_JSON provided, relying on default credentials.");
}

const firebaseAdminApp = admin.initializeApp({
  credential: credential,
  projectId: firebaseConfig.projectId
});
console.log("Firebase Admin Initialized:", firebaseAdminApp.name);

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        headers: {
            'User-Agent': 'aistudio-build',
        }
    }
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT), // True for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    family: 4, // Force IPv4 to prevent IPv6 ENETUNREACH errors on deployment platforms like Render
    connectionTimeout: 20000, // Give Render's network more time to complete the handshake before failing
    greetingTimeout: 20000,
    socketTimeout: 20000,
    lookup: (hostname: string, options: any, callback: any) => {
        // Explicitly force DNS lookup to return only IPv4 addresses.
        // 'family: 4' alone doesn't always propagate to the underlying socket
        // on some Node/OpenSSL builds, which caused ENETUNREACH on IPv6-routed
        // hosts like Render's SMTP egress.
        require('dns').lookup(hostname, { family: 4 }, callback);
    },
} as any);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});


const logs: string[] = [];

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

// Gemini's generateContent occasionally returns 503 UNAVAILABLE ("This
// model is currently experiencing high demand") or 429 RESOURCE_EXHAUSTED
// — both are transient, Google-side capacity issues, not bugs in this app
// (the request itself is fine; retrying the same request moments later
// typically succeeds). This wraps any generateContent-style call with a
// short retry-with-backoff so a brief demand spike doesn't surface as a
// user-facing error.
async function withGeminiRetry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const status = error?.status || error?.error?.status || error?.code;
            const isTransient = status === 'UNAVAILABLE' || status === 503 || status === 'RESOURCE_EXHAUSTED' || status === 429;
            if (!isTransient || attempt === maxAttempts) {
                throw error;
            }
            const delayMs = 800 * attempt; // 800ms, 1600ms, ...
            console.warn(`Gemini transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`, status);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

// On the free tier, gemini-3.5-flash's quota/capacity is the one that runs
// out fastest and hits 429/503 most often (its free-tier daily request cap
// is much lower than the older Flash-Lite models). If the primary model is
// still down after retries, fall through this chain of lighter models —
// each one draws from a separate quota bucket, so most of the time the
// user still gets an answer instead of an error.
// NOTE: plain "gemini-2.5-flash-lite" is NOT used here — Google has quietly
// blocked it for newer projects/keys ("no longer available to new users",
// 404 NOT_FOUND) even though it's still listed as current in the docs. Only
// version-pinned, verified-working models are used in this chain.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash"];

async function generateWithFallback(primaryModel: string, contents: any): Promise<{ text: string }> {
    try {
        return await withGeminiRetry(() => ai.models.generateContent({ model: primaryModel, contents }));
    } catch (error: any) {
        const status = error?.status || error?.error?.status || error?.code;
        const isCapacityIssue = status === 'UNAVAILABLE' || status === 503 || status === 'RESOURCE_EXHAUSTED' || status === 429;
        if (!isCapacityIssue) throw error;

        let lastError: any = error;
        for (const fallbackModel of FALLBACK_MODELS) {
            try {
                console.warn(`Model ${primaryModel} still unavailable after retries, falling back to ${fallbackModel}`);
                return await withGeminiRetry(() => ai.models.generateContent({ model: fallbackModel, contents }), 2);
            } catch (fallbackError: any) {
                lastError = fallbackError;
                const fbStatus = fallbackError?.status || fallbackError?.error?.status || fallbackError?.code;
                // NOT_FOUND (404) means this model ID isn't usable on this
                // project at all — also worth skipping to the next model,
                // not just capacity errors, so one dead model ID can't
                // break the whole chain.
                const fbShouldSkip = fbStatus === 'UNAVAILABLE' || fbStatus === 503 || fbStatus === 'RESOURCE_EXHAUSTED' || fbStatus === 429 || fbStatus === 'NOT_FOUND' || fbStatus === 404;
                if (!fbShouldSkip) throw fallbackError;
                // otherwise, try the next model in the chain
            }
        }
        throw lastError;
    }
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

        const response = await generateWithFallback("gemini-3.5-flash", { parts: contentParts });
        return response.text || "";
    } catch (error) {
        console.error("Gemini AI Error:", error);
        // Re-throw instead of returning a fake "Internal AI Error" string —
        // returning a string here made every caller treat a failure as if
        // it were a real AI reply (200 OK, chat shows "Internal AI Error"
        // as if the model said it), which hid the actual cause (rate
        // limit, bad model name, invalid key, etc) from both the network
        // response and server logs beyond this one console.error line.
        throw error;
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

import { checkAndSummarizeStaleSessions, getSummaryForUser } from "./src/services/summarizationService";

// ... existing code ...

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;
  
  app.use(express.json({ limit: '10mb' }));
  
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Lets the client pre-fetch the memory summary as soon as the Live AI
  // screen opens (well before the user taps the mic), instead of only
  // fetching it inside the WebSocket 'init' flow. The client caches this
  // and sends it along with 'init', so session creation never needs to
  // hit Firestore on the critical path at all.
  app.get('/api/memory-summary', async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const range = (req.query.range as string) || 'Last 1 day';
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const summary = await getSummaryForUser(userId, range);
      res.json({ summary: summary || null });
    } catch (err) {
      console.error("Memory summary prefetch failed:", err);
      // Fail soft — client treats missing summary same as "no memory yet".
      res.json({ summary: null });
    }
  });

  // Run periodic check every 10 minutes.
  // Wrapped so any unexpected rejection from the job (e.g. a Firestore
  // error) becomes a log line instead of an uncaught rejection that
  // takes down the whole process.
  setInterval(() => {
    checkAndSummarizeStaleSessions().catch((err) => {
      console.error("[Summarization] Periodic check failed:", err);
    });
  }, 10 * 60 * 1000);

  
  // Permissive CORS for mobile app (Capacitor) and AI Studio preview
  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins for now to unblock mobile app users
      // In production, you'd want to be more specific, but for a student project APK this is necessary
      callback(null, true);
    },
    credentials: true
  }));

  // Request Logging Middleware
  app.use((req, res, next) => {
    const log = `${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No Origin'}`;
    console.log(log);
    logs.push(log);
    if (logs.length > 100) logs.shift();
    next();
  });

  app.use("/api/", limiter);

  let s3Client: S3Client | null = null;
  function getS3Client() {
      if (!s3Client) {
          const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
          const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
          const region = process.env.AWS_REGION || "ap-southeast-2";

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

  // Multer setup: keep uploaded files in memory, then stream to S3.
  // 500MB per file cap, up to 20 files per request.
  const s3Upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024, files: 20 },
  });

  // List all S3 buckets available to these AWS credentials.
  // Falls back to the single .env-configured bucket if ListBuckets isn't permitted.
  app.get("/api/s3/buckets", async (req, res) => {
    try {
      const s3 = getS3Client();
      const result = await s3.send(new ListBucketsCommand({}));
      const buckets = (result.Buckets || [])
        .map(b => b.Name)
        .filter((name): name is string => !!name);

      if (buckets.length === 0) {
        const fallback = process.env.S3_BUCKET || "neetmaster-videos-01";
        return res.json({ success: true, buckets: [fallback] });
      }
      res.json({ success: true, buckets });
    } catch (error: any) {
      console.error("AWS S3 List Buckets Error:", error);
      // No ListBuckets permission (or other error) -> fall back to the configured bucket.
      const fallback = process.env.S3_BUCKET || "neetmaster-videos-01";
      res.json({ success: true, buckets: [fallback], fallback: true, error: error.message });
    }
  });

  // Browse a bucket one folder level at a time (like a file explorer).
  // Returns subfolders (CommonPrefixes) and files at the given prefix.
  app.get("/api/s3/browse", async (req, res) => {
    try {
      const { bucket, prefix } = req.query;
      if (!bucket || typeof bucket !== 'string') {
        return res.status(400).json({ success: false, error: "Bucket required" });
      }
      const normalizedPrefix = prefix && typeof prefix === 'string' && prefix.length > 0
        ? (prefix.endsWith('/') ? prefix : prefix + '/')
        : '';

      const s3 = getS3Client();
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix,
        Delimiter: '/',
      });
      const result = await s3.send(command);

      const folders = (result.CommonPrefixes || [])
        .map(p => p.Prefix)
        .filter((p): p is string => !!p)
        .map(p => ({
          name: p.replace(normalizedPrefix, '').replace(/\/$/, ''),
          prefix: p,
        }));

      const files = (result.Contents || [])
        .filter(item => item.Key && item.Key !== normalizedPrefix)
        .map(item => ({
          key: item.Key!,
          name: item.Key!.replace(normalizedPrefix, ''),
          size: item.Size || 0,
          lastModified: item.LastModified,
        }));

      res.json({ success: true, bucket, prefix: normalizedPrefix, folders, files });
    } catch (error: any) {
      console.error("AWS S3 Browse Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Upload one or more files (photo, video, pdf, etc.) directly to an S3 bucket/prefix.
  // Check if a given key already exists in the bucket (used for the duplicate-file warning).
  app.get("/api/s3/exists", async (req, res) => {
    try {
      const { bucket, key } = req.query;
      if (!bucket || typeof bucket !== 'string' || !key || typeof key !== 'string') {
        return res.status(400).json({ success: false, error: "Bucket and key required" });
      }
      const s3 = getS3Client();
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        res.json({ success: true, exists: true });
      } catch (err: any) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          res.json({ success: true, exists: false });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      console.error("AWS S3 Exists Check Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/s3/upload", s3Upload.array("files", 20), async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    try {
      const { bucket, prefix, overwrite } = req.body;
      if (!bucket || typeof bucket !== 'string') {
        return res.status(400).json({ success: false, error: "Bucket required" });
      }
      if (files.length === 0) {
        return res.status(400).json({ success: false, error: "No files provided" });
      }

      const normalizedPrefix = prefix && prefix.length > 0
        ? (prefix.endsWith('/') ? prefix : prefix + '/')
        : '';
      // overwrite can arrive as a JSON string (per-file map) or a boolean-ish string for "allow all"
      let overwriteMap: Record<string, boolean> | null = null;
      let overwriteAll = false;
      if (typeof overwrite === 'string') {
        if (overwrite === 'true') {
          overwriteAll = true;
        } else {
          try {
            overwriteMap = JSON.parse(overwrite);
          } catch {
            overwriteMap = null;
          }
        }
      }

      const s3 = getS3Client();
      const results = await Promise.all(files.map(async (file) => {
        const key = `${normalizedPrefix}${file.originalname}`;
        const allowOverwrite = overwriteAll || (overwriteMap ? !!overwriteMap[file.originalname] : false);

        try {
          if (!allowOverwrite) {
            try {
              await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
              // Object exists and overwrite wasn't confirmed -> reject this file.
              return { name: file.originalname, key, success: false, duplicate: true, error: "A file with this name already exists." };
            } catch (headErr: any) {
              if (!(headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404)) {
                throw headErr;
              }
              // NotFound -> safe to proceed with upload.
            }
          }

          await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }));
          return { name: file.originalname, key, success: true };
        } catch (err: any) {
          console.error(`S3 Upload Error for ${file.originalname}:`, err);
          return { name: file.originalname, key, success: false, error: err.message };
        }
      }));

      const allSucceeded = results.every(r => r.success);
      res.status(allSucceeded ? 200 : 207).json({ success: allSucceeded, results });
    } catch (error: any) {
      console.error("AWS S3 Upload Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/s3/health", async (req, res) => {
    try {
        const bucketName = process.env.S3_BUCKET || "neetmaster-videos-01";
        const s3 = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1
        });
        await s3.send(command);
        res.json({ success: true, message: "Successfully connected to AWS S3" });
    } catch (error: any) {
        console.error("AWS S3 Health Check Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            tip: "Check if AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION are correctly set in secrets."
        });
    }
  });

  app.get("/api/nta/health", async (req, res) => {
    try {
        console.log("NTA Health Check: Attempting to connect to neet.nta.nic.in...");
        const response = await fetch("https://neet.nta.nic.in/", {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        } as any);
        
        if (response.ok) {
            res.json({ success: true, message: "Successfully connected to NTA website" });
        } else {
            res.status(response.status).json({ 
                success: false, 
                message: `NTA website returned status ${response.status}`,
                status: response.status
            });
        }
    } catch (error: any) {
        console.error("NTA Health Check Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            tip: "This might be due to NTA blocking the server's IP or a temporary network issue on the host."
        });
    }
  });

  app.get("/api/ncert-list", async (req, res) => {
    try {
        const { bucket, prefix } = req.query;
        if (!bucket || typeof bucket !== 'string') return res.status(400).json({ error: "Bucket required" });
        
        const s3 = getS3Client();
        const listCommand = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix as string || '',
        });

        const listResponse = await s3.send(listCommand);
        const files = listResponse.Contents || [];

        const filesWithUrl = await Promise.all(
            files.filter(item => item.Key && item.Key.endsWith('.pdf')).map(async (item) => {
                const key = item.Key!;
                const getObjectCommand = new GetObjectCommand({
                    Bucket: bucket,
                    Key: key,
                });
                const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
                return { key, url: signedUrl, name: key.split('/').pop() };
            })
        );

        res.json({ success: true, files: filesWithUrl });
    } catch (error: any) {
        console.error("AWS S3 NCERT Fetch Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/private-videos", async (req, res) => {
    try {
        const bucketName = process.env.S3_BUCKET || "neetmaster-videos-01";
        const s3 = getS3Client();

        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
        });

        const listResponse = await s3.send(listCommand);
        const videoFiles = listResponse.Contents || [];
        
        console.log(`AWS S3: Found ${videoFiles.length} files in bucket ${bucketName}`);

        // Filter out non-video files
        const filteredFiles = videoFiles.filter(item => {
            const key = item.Key || "";
            if (key.endsWith("/")) return false; // Ignore directories
            
            const lowerKey = key.toLowerCase();
            return lowerKey.endsWith(".mp4") || 
                   lowerKey.endsWith(".mkv") || 
                   lowerKey.endsWith(".mov") || 
                   lowerKey.endsWith(".webm");
        });

        console.log(`AWS S3: Found ${filteredFiles.length} video files after filtering`);

        const videosWithUrl = await Promise.all(
            filteredFiles.map(async (item) => {
                const key = item.Key || "";
                const getObjectCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                });
                
                const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
                
                const parts = key.split("/");
                let subject = "General";
                let chapter = "Misc";
                let filenameRaw = key;

                if (parts.length >= 3) {
                    subject = parts[0];
                    chapter = parts[1];
                    filenameRaw = parts[parts.length - 1];
                } else if (parts.length === 2) {
                    subject = parts[0];
                    chapter = "General";
                    filenameRaw = parts[1];
                } else {
                    subject = "General";
                    chapter = "Misc";
                    filenameRaw = key;
                }
                
                // Format Subject Name
                subject = subject.replace(/[_-]/g, " ");
                subject = subject.replace(/\b\w/g, c => c.toUpperCase());
                
                // Format Chapter Name
                chapter = chapter.replace(/[_-]/g, " ");
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
  const resetTokenStore = new Map<string, { identifier: string; createdAt: number }>();

  // Checks whether a Firebase Auth account already exists for an email
  // address. We use the Admin SDK server-side because the client SDK's
  // fetchSignInMethodsForEmail() is deprecated and returns an empty array
  // by default on all projects created after Sept 2023 (Email Enumeration
  // Protection), which made the client-side check always report "new user".
  app.post("/api/check-email-user", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Missing email" });
    }
    try {
        await admin.auth().getUserByEmail(email);
        return res.json({ exists: true });
    } catch (error: any) {
        if (error?.code === 'auth/user-not-found') {
            return res.json({ exists: false });
        }
        console.error("check-email-user error:", error);
        return res.status(500).json({ error: "Failed to check email" });
    }
  });

  // Checks whether a Firebase Auth account already exists for a phone number
  // (in E.164 format, e.g. +919876543210). Used by the login wizard to decide
  // whether to route an existing phone user straight through Firebase Phone
  // Auth login, or into the new-user signup flow.
  app.post("/api/check-phone-user", async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: "Missing phoneNumber" });
    }
    try {
        await admin.auth().getUserByPhoneNumber(phoneNumber);
        return res.json({ exists: true });
    } catch (error: any) {
        if (error?.code === 'auth/user-not-found') {
            return res.json({ exists: false });
        }
        console.error("check-phone-user error:", error);
        return res.status(500).json({ error: "Failed to check phone number" });
    }
  });

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
        const hasBrevoApi = !!process.env.BREVO_API_KEY;

        if (isEmail && hasBrevoApi) {
            try {
                const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@neetmaster.online';
                const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': process.env.BREVO_API_KEY!,
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        sender: { name: 'NeetMaster', email: fromEmail },
                        to: [{ email: identifier }],
                        subject: 'Your OTP for NeetMaster Verification',
                        textContent: `Your OTP is ${otp}. It expires in 5 minutes.`,
                    }),
                });

                if (!brevoResponse.ok) {
                    const errBody = await brevoResponse.text();
                    throw new Error(`Brevo API error (${brevoResponse.status}): ${errBody}`);
                }

                console.log(`[Brevo API] Successfully sent OTP ${otp} to ${identifier}`);
                return res.json({ success: true });
            } catch (apiErr: any) {
                console.error("[Brevo API Error] Failed to send email:", apiErr.message || apiErr);
                // Fallback to returning test OTP so they are never blocked
                return res.json({ 
                    success: true, 
                    testOtp: otp, 
                    warning: "Email delivery failed. Running in test fallback mode." 
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
    const { identifier, otp, purpose } = req.body;
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

        // For password-reset flows, issue a short-lived, single-use token that
        // proves this OTP was verified, so /api/reset-password can't be called
        // directly without having gone through OTP verification first.
        if (purpose === 'password-reset') {
            const resetToken = crypto.randomBytes(32).toString('hex');
            resetTokenStore.set(resetToken, { identifier, createdAt: Date.now() });
            return res.json({ success: true, resetToken });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: "Failed to verify OTP: " + error.message });
    }
  });

  // Resets a user's password after OTP verification. Requires the resetToken
  // issued by /api/verify-otp (purpose: 'password-reset') so this can't be
  // called directly to change someone's password without OTP proof.
  app.post("/api/reset-password", async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
        return res.status(400).json({ error: "Missing resetToken or newPassword" });
    }
    if (String(newPassword).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const stored = resetTokenStore.get(resetToken);
    if (!stored) {
        return res.status(400).json({ error: "Reset session expired or invalid. Please verify OTP again." });
    }
    // Reset tokens are valid for 10 minutes
    if (Date.now() - stored.createdAt > 10 * 60 * 1000) {
        resetTokenStore.delete(resetToken);
        return res.status(400).json({ error: "Reset session expired. Please verify OTP again." });
    }

    try {
        const clean = String(stored.identifier).trim();
        const firebaseEmail = clean.includes('@') ? clean : `${clean}@neetmaster.com`;
        const userRecord = await admin.auth().getUserByEmail(firebaseEmail);
        await admin.auth().updateUser(userRecord.uid, { password: newPassword });
        resetTokenStore.delete(resetToken);
        res.json({ success: true });
    } catch (error: any) {
        console.error("Password reset error:", error);
        if (error?.code === 'auth/user-not-found') {
            return res.status(400).json({ error: "No account found for this email." });
        }
        res.status(500).json({ error: "Failed to reset password: " + error.message });
    }
  });
  
  app.get("/api/neet-notices", async (req, res) => {
    console.log("NEET Notices Request: Scraping neet.nta.nic.in...");
    try {
        const response = await fetch("https://neet.nta.nic.in/", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        if (!response.ok) {
            console.error(`NEET Notices Fetch Failed: ${response.status} ${response.statusText}`);
            throw new Error(`NTA Server returned ${response.status}`);
        }
        const html = await response.text();
        console.log(`NEET Notices: Successfully fetched HTML (${html.length} bytes)`);
        const $ = cheerio.load(html);
        
        const publicNotices: {text: string, url: string}[] = [];
        const candidateActivity: {text: string, url: string}[] = [];
        
        // Find the sections based on visual headings
        const sections = {
            'Public Notices': [] as {text: string, url: string}[],
            'Candidate Activity': [] as {text: string, url: string}[]
        };

        // Find elements containing the text
        const headings = $('h1, h2, h3, h4, h5, h6, .heading, strong, .card-header, div, span').filter((_, el) => {
            const text = $(el).text().trim();
            return text === 'Public Notices' || text === 'Candidate Activity';
        });

        // Debugging logs to help identify structure issues
        console.log(`Found ${headings.length} potential headings`);

        headings.each((i, el) => {
            const headingText = $(el).text().trim();
            console.log(`Processing heading: "${headingText}"`);
            
            // Find the list container associated with this heading
            // Often it's in the same parent or following sibling
            let container = $(el).parent().find('ul');
            if (container.length === 0) {
                container = $(el).nextAll('ul').first();
            }
            if (container.length === 0) {
                container = $(el).closest('div').find('ul');
            }
            
            console.log(`Container length for "${headingText}": ${container.length}`);

            const list = container.first().find('li');
            console.log(`List length for "${headingText}": ${list.length}`);
            
            if (headingText === 'Public Notices') {
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
            if (headingText === 'Candidate Activity') {
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
  
  app.post("/api/send-notification", async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message required" });
    }

    try {
      const db = getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId);
      // Fetch all users to get their fcmTokens
      const usersSnapshot = await db.collection('users').get();
      const tokens: string[] = [];
      const tokenRefs: FirebaseFirestore.DocumentReference[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const tokensSnapshot = await userDoc.ref.collection('fcmTokens').get();
        tokensSnapshot.docs.forEach(tokenDoc => {
          tokens.push(tokenDoc.id);
          tokenRefs.push(tokenDoc.ref);
        });
      }

      if (tokens.length === 0) {
        return res.json({ success: true, message: "No tokens found" });
      }
      
      console.log(`[FCM] Sending notifications to ${tokens.length} tokens.`);

      const messagePayloads = tokens.map(token => ({
        token,
        // Data-only payload: Android OS won't auto-handle this, so our own
        // FirebaseMessagingService.onMessageReceived() runs even when the
        // app is backgrounded or killed, and we show the notification ourselves.
        data: {
          title,
          body: message,
        },
        android: {
          priority: 'high' as const,
        }
      }));

      const responses = await Promise.allSettled(
        messagePayloads.map(payload => admin.messaging().send(payload))
      );
      
      const successCount = responses.filter(r => r.status === 'fulfilled').length;
      const failureCount = responses.filter(r => r.status === 'rejected').length;

      const firstFailure = responses.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (firstFailure) {
        console.error('[FCM] Sample failure reason:', firstFailure.reason?.message || firstFailure.reason);
      }
      console.log(`[FCM] Result: ${successCount} success, ${failureCount} failed`);

      // Clean up dead tokens (NotRegistered / InvalidArgument) so failure
      // count doesn't keep growing and future sends aren't wasted on them.
      const deletions: Promise<any>[] = [];
      responses.forEach((r, i) => {
        if (r.status === 'rejected') {
          const code = r.reason?.errorInfo?.code || r.reason?.code;
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
            deletions.push(tokenRefs[i].delete().catch(() => {}));
          }
        }
      });
      if (deletions.length > 0) {
        await Promise.allSettled(deletions);
        console.log(`[FCM] Cleaned up ${deletions.length} dead tokens.`);
      }

      res.json({ success: true, successCount, failureCount });
    } catch (error) {
      console.error("FCM Send Error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
  
  app.post("/api/admin/delete-all-users", async (req, res) => {
    const { adminUid } = req.body;
    if (!adminUid) {
      return res.status(400).json({ error: "Admin UID required" });
    }

    try {
      // 1. Delete Firestore Users
      const db = getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId);
      const usersSnapshot = await db.collection('users').get();
      
      const usersToDelete = usersSnapshot.docs.filter(doc => doc.id !== adminUid);

      if (usersToDelete.length === 0) {
        return res.json({ success: true, message: "No users found to delete." });
      }

      const bulkWriter = db.bulkWriter();
      usersToDelete.forEach(doc => bulkWriter.delete(doc.ref));
      await bulkWriter.close();

      // 2. Delete Auth Users
      const listUsersResult = await admin.auth().listUsers();
      const uidsToDelete = listUsersResult.users
        .filter(u => u.uid !== adminUid)
        .map(u => u.uid);

      if (uidsToDelete.length > 0) {
        await admin.auth().deleteUsers(uidsToDelete);
      }

      res.json({ success: true, message: `Successfully deleted ${usersToDelete.length} users.` });
    } catch (error) {
      console.error("Delete All Users Error:", error);
      res.status(500).json({ error: "Failed to delete users" });
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
      const { messages, base64Audio, isStudyPlanChat, studentMemory } = req.body;
      
      try {
          const contents: any[] = [];
          
          if (messages && Array.isArray(messages)) {
              // For the study planner, the persistent studentMemory summary already
              // carries the important long-term facts, so we only need the recent
              // turns for immediate conversational context — not the entire raw
              // history. This keeps each request small and avoids burning through
              // the free-tier token/request quota on long-running chats.
              const recentMessages = isStudyPlanChat ? messages.slice(-12) : messages;
              recentMessages.forEach((m: any) => {
                  contents.push({ text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}` });
              });
          }
          
          if (base64Audio) {
              contents.push({ inlineData: { data: base64Audio, mimeType: "audio/webm" } });
          }

          const baseInstruction = `Strict Instruction: You are an expert NEET AI Assistant. 
Respond with extreme brevity and 100% accuracy. 
- If asked a simple question (like 2+2), respond with ONLY the answer (e.g., 4).
- No fluff, no "Certainly!", no "I am here to help".
- Use simple words.
- If it's a greeting, just say "Hello".
- Direct, actionable, minimal.
- If asked who built you or who the app belongs to, reply that "Mr. Divakar" built you.
- If asked for contact details, provide the Instagram ID "mr.divakar00".
- If the user has a problem, suggest that they can shake their phone and click "Yes" on the prompt to share their problem.`;

          const studyPlanInstruction = `You are an expert NEET Study Planner AI, acting like a caring, experienced mentor. You talk naturally in Hinglish (Hindi + English mix), the way a friendly coach talks to a student. Follow this exact conversational flow strictly, based on the full chat history given to you. Look at the conversation so far and figure out which phase you are currently in, then behave accordingly.

PHASE 1 — Start
Trigger: this is the first user message in the conversation (or the first message after a reset) — no matter what the user says (could be "Hi", "Hello", "study plan banana hai", or literally anything).
Action: Reply warmly with an introduction, for example: "Hi! Main tumhara personal Study Planner hoon. 📚 Ek best se best personalized study plan banane ke liye mujhe tumhari daily routine se related kuch questions puchne honge. Ready ho?"
Do NOT ask any routine question yet in this message. Just introduce yourself and ask if they are ready.

PHASE 1.5 — Readiness Confirmation
Trigger: the previous AI message was the Phase 1 introduction, and the user now responds with any kind of affirmation/readiness — e.g. "ok", "yes", "haan", "hmm", "ready", "chalo", "start karo", or similar (even a short one-word reply counts).
Action: Immediately ask Question 1 from Phase 2, in this same message — do not add extra fluff, just a short transition (e.g. "Great! Chalo shuru karte hain.") followed directly by Question 1.
If the user responds with something that is NOT a readiness confirmation (e.g. they ask something else, or say no), respond helpfully to that first, and gently ask again if they're ready to start when appropriate.

PHASE 2 — Routine Collection
Ask ONLY ONE question at a time, wait for the user's answer, then ask the next one. Never ask two questions together. Ask them in this exact order:
1. Tumhara main goal (motto) kya hai? (e.g. NEET me 680+ lana hai, Board me 95% lana hai)
2. Tum subah kitne baje uthte ho?
3. Uthne ke baad agle 2 ghante me kya karte ho? (fresh hona, mobile chalana, exercise, breakfast, coaching jana, etc.)
4. Kya tum school, coaching, tuition ya college jaate ho? Agar haan, kis time se kis time tak?
5. Shaam me kab khelte ho ya bahar jaate ho? Agar nahi jaate to bata do.
6. Shaam me padhne kab baithte ho?
7. Raat me kitne baje tak padhte ho?
8. Raat ko kitne baje sote ho?
Track which of these 8 questions have already been answered based on the conversation history, and ask the next unanswered one. Keep each question short and natural, do not repeat ones already answered.

PHASE 3 — Internal Analysis
Once all 8 routine questions are answered, silently analyze: free time, busy hours, sleep, energy pattern, study window, daily routine, time waste, consistency, possible improvements. DO NOT reveal this analysis to the user. Just reply briefly: "Maine tumhari routine samajh li hai." and move to Phase 4 in the same message.

PHASE 4 — Extra Information
Ask: "Agar tumhe lagta hai ki koi aur information hai jo mujhe pata honi chahiye, to bata sakte ho. Jaise:\n• Weak subjects\n• Strong subjects\n• Backlog\n• Exam date\n• Daily target\n• Distractions\n• Available books\n• Health issues\n• Family responsibilities\n• Ya koi aur preference."

PHASE 5 — Open Conversation Mode (most important)
After Phase 4, the user will share various pieces of extra info, one at a time or a few together, across multiple messages. In this phase:
- NEVER push, force, or suggest that the user should say "study plan banao". Do not rush them.
- Respond helpfully and conversationally to whatever the user shares, like a mentor would — ask a relevant short follow-up question, give a small reassuring tip, or acknowledge and move on. Keep replies short and natural.
- Mentally keep track of every piece of information shared (weak subjects, strong subjects, backlog, exam date, daily target, distractions, available books, health issues, family responsibilities, preferences, sleep preference, coaching schedule, etc.) using the full conversation history — you don't need to show this list to the user.
- Do NOT generate any study plan in this phase, no matter what, unless the user explicitly asks for it (see Phase 7).

PHASE 6 — Information Complete
If the user says something like "done", "bas", "aur kuch nahi", "that's all", "hmm", "ok" (signaling they're done sharing extra info, and no study plan request yet), reply with something like: "Theek hai. Maine tumhari saari information analyze kar li hai. Jab bhi tum 'Study Plan Banao' ya 'Timetable Banao' bologe, main isi information ke basis par ek personalized study plan bana dunga." Then stop — do not generate the plan yet.

PHASE 7 — Final Plan Generation
Trigger: ONLY when the user explicitly says something like "study plan banao", "timetable bana do", "ab plan ready karo", or clearly asks for the final plan.
Action: Generate the full personalized study plan using ALL the routine data and extra information collected so far in the conversation. The plan must include:
- Study schedule matched to the user's actual routine (their wake time, sleep time, school/coaching hours, etc.)
- Balance with school/coaching timings (never schedule study during their busy hours)
- Subject priority — extra time for weak subjects, lighter revision for strong subjects
- Revision blocks
- Break schedule
- Mock test schedule
- Backlog strategy (if backlog was mentioned)
- Daily goals and weekly goals
- Buffer time
- Sleep recommendation (only if their current sleep schedule seems unhealthy)
- Productivity suggestions that match their actual routine (not generic ones)
- Brief reasoning after the table explaining WHY the schedule is designed this way, so the user understands the logic.

FORMAT FOR THE FINAL PLAN (very important):
- Use a clean Markdown table for the daily schedule with exactly 3 columns: Time | Task | 🔔
  - Time column: the time slot (e.g. "6:00 AM - 6:30 AM")
  - Task column: what to do, written clearly, using relevant emojis (📘 for study, 🍳 for breakfast, 🏃 for exercise, 😴 for sleep, ☕ for break, 📝 for revision/mock test, 🎯 for goals, etc.)
  - 🔔 column: put a 🔔 emoji if this is an important/fixed-time slot the user must not miss, otherwise leave it blank
- Use bold, colorful section headings with emojis, like "## 🎯 Tumhara Personalized Study Plan", "## 📅 Daily Schedule", "## 🔁 Weekly Focus (Weak Subjects)", "## 🧠 Reasoning", "## 💡 Extra Tips"
- Below the table, include a "🔁 Weekly Focus" section briefly showing which days give extra attention to which weak subject.
- Below that, include a short "🧠 Reasoning" section (2-4 lines) explaining why the schedule is structured this way based on their routine.
- Below that, include a "💡 Extra Tips" section — 2-4 bullet points of practical, personalized suggestions that YOU (the AI) think would help this specific user, beyond just the schedule (e.g. distraction management, health, revision technique, etc.), with emojis.
- Make it visually engaging: use bold text for headings/important words, bullet points, and emojis throughout — this should feel like a beautifully designed personal coaching plan, not a plain boring table.
- At the very end of the plan, ALWAYS ask: "Kya tum isme kuch modify karna chahte ho? 🙂" and wait for the user's response. If they ask for changes, update the plan accordingly using the same format.

General rules across all phases:
- Always respond in Hinglish, warm and encouraging tone, like a real mentor — not robotic.
- Never skip ahead — respect the phase order strictly based on conversation history.
- If asked who built you or who the app belongs to, reply that "Mr. Divakar" built you.
- If asked for contact details, provide the Instagram ID "mr.divakar00".

STUDENT MEMORY (long-term profile, persists across sessions and resets):
${studentMemory && studentMemory.trim() ? studentMemory : "(No memory yet — this is a new student, nothing is known about them.)"}

Use this memory to personalize your responses and avoid re-asking things you already know. If the memory already answers one of the Phase 2 routine questions, treat it as answered and skip to the next one — do not ask it again. Still follow the phase logic based on the current conversation, but let the memory fill in gaps.

MEMORY UPDATE INSTRUCTION (very important — follow exactly):
After writing your normal reply to the user, on a new line add the exact delimiter "///MEMORY///" followed by the COMPLETE, updated version of the student's long-term memory profile — merging the old memory above with any new facts learned from this exchange. Rules for this memory block:
- Write it as short bullet points in Hinglish/English, grouped under simple headers like "Goal:", "Routine:", "Subjects:", "Exam Info:", "Preferences:", "Other Notes:" (only include headers that have data).
- Keep it compact — this is a persistent profile, not a transcript. Never include full conversation text, only distilled facts (e.g. "Wakes up at 6 AM", "Weak in Physics - Mechanics", "Exam date: May 2027", "Prefers night study").
- If nothing new was learned in this exchange, just repeat the existing memory unchanged after the delimiter.
- If a new fact contradicts an old one, keep only the newer/corrected fact.
- Do NOT mention this memory block or the delimiter anywhere in your visible reply to the user — it must only appear after "///MEMORY///".
- This memory section is mandatory in every single response, even simple greetings.`;

          const response = await generateWithFallback("gemini-3.5-flash", { 
                parts: [
                    { text: isStudyPlanChat ? studyPlanInstruction : baseInstruction },
                    ...contents
                ] 
            });
          
          const rawText = response.text || "";
          let replyText = rawText;
          let updatedMemory = studentMemory || "";

          if (isStudyPlanChat) {
              const delimiterIndex = rawText.indexOf("///MEMORY///");
              if (delimiterIndex !== -1) {
                  replyText = rawText.slice(0, delimiterIndex).trim();
                  updatedMemory = rawText.slice(delimiterIndex + "///MEMORY///".length).trim();
              }
          }

          // Safety net: never send an empty reply to the user, even if the
          // model mis-formatted the memory delimiter or returned something unexpected.
          if (!replyText || !replyText.trim()) {
              replyText = rawText.trim() || "Sorry, kuch gadbad ho gayi. Ek baar phir se try karo.";
          }

          if (!rawText.trim()) {
              console.error("Gemini returned empty response.text for /api/gemini", { isStudyPlanChat });
          }
          
          res.json({ text: replyText, updatedMemory: isStudyPlanChat ? updatedMemory : undefined });
      } catch (error: any) {
          console.error("Gemini API Error:", error);
          const status = error?.status || error?.error?.status || error?.code;
          const isQuotaOrCapacity = status === 'RESOURCE_EXHAUSTED' || status === 429 || status === 'UNAVAILABLE' || status === 503;
          const userMessage = isQuotaOrCapacity
              ? "AI abhi thoda busy hai (demand zyada hai). Thodi der (ek-do minute) baad phir se try karo. 🙏"
              : "Failed to get AI response";
          res.status(isQuotaOrCapacity ? 429 : 500).json({ error: userMessage });
      }
  }); 


    // API route for deep analysis
    app.post("/api/deep-analysis", async (req, res) => {
        const { resultId, userId, results } = req.body;
        if (!resultId || !userId || !results) {
          return res.status(400).json({ error: "Missing data" });
        }
    
        const prompt = `
            Analyze the following student test results carefully and act as an expert NEET tutor.
            Provide a deep, human-like analysis in Hinglish.
            
            Format your response strictly in the following JSON structure:
            {
                "mistakes": "Detailed analysis of errors (in Hindi/Hinglish). Use bold headings for key points.",
                "improvement": "Strategic suggestions for improvement (in Hindi/Hinglish).",
                "future": "How to prevent this in future (in Hindi/Hinglish)."
            }

            Student Data: ${JSON.stringify(results)}
        `;
        
        try {
            // Initiate AI analysis
            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: [{ parts: [{ text: prompt }] }]
            });
            
            const analysisText = response.text || "";
            // Extract JSON from response
            const jsonStr = analysisText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
            const analysis = JSON.parse(jsonStr);
            
            // Update Firestore
            const db = getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId);
            await db.collection('users').doc(userId).collection('results').doc(resultId).update({
                deepAnalysis: analysis
            });
            
            res.json({ success: true });
        } catch (error) {
            console.error("Deep Analysis API Error:", error);
            res.status(500).json({ error: "Failed to perform deep analysis" });
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
    // Voice message in WhatsApp-style chat: send audio straight to Gemini
    // (no separate STT step) — it transcribes and answers as the NEET
    // tutor in one call. mimeType matches whatever MediaRecorder produced
    // on the client (webm/opus in browsers, m4a/aac on some native builds).
    app.post("/api/tutor-voice", async (req, res) => {
        const { base64Audio, mimeType } = req.body;
        if (!base64Audio) {
            return res.status(400).json({ error: "Missing base64Audio" });
        }
        try {
            const reply = await callAI([
                { text: "You are a NEET tutor. Answer strictly according to NCERT. Respond with extreme brevity. Simple words only. The student sent this as a voice message — listen to it and answer their question." },
                { inlineData: { data: base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio, mimeType: mimeType || "audio/webm" } }
            ]);
            res.json({ reply });
        } catch (error) {
            console.error("Tutor Voice API Error:", error);
            res.status(500).json({ error: "Failed to get AI response", detail: error instanceof Error ? error.message : String(error) });
        }
    });

    app.post("/api/tutor", async (req, res) => {
        const { messages, base64Image } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: "Missing messages" });
        }
        
        const lastMessage = messages[messages.length - 1].content;
        
        try {
            let reply: string;
            if (base64Image) {
                const imgResponse = await generateWithFallback("gemini-3.5-flash", {
                    parts: [
                        { text: `You are a NEET tutor. Answer strictly according to NCERT. Respond with extreme brevity. Simple words only. The student sent this image along with the message: "${lastMessage || '(no caption, just the image)'}"` },
                        { inlineData: { data: base64Image.includes(',') ? base64Image.split(',')[1] : base64Image, mimeType: "image/jpeg" } }
                    ]
                });
                reply = imgResponse.text || "Sorry, I couldn't read that image.";
            } else {
                reply = await callAI(`You are a NEET tutor. Answer strictly according to NCERT. Respond with extreme brevity. Simple words only. ${lastMessage}`);
            }
            res.json({ reply });
        } catch (error) {
            console.error("Tutor API Error:", error);
            res.status(500).json({ error: "Failed to get AI response", detail: error instanceof Error ? error.message : String(error) });
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
        const response = await generateWithFallback("gemini-3.5-flash", {
            parts: [
                { text: "Strict Instruction: Be extremely brief, accurate, and simple. No fluff." },
                { text: lastMessage }
            ]
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
                    model: "gemini-3.5-flash",
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
            
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            ];
            const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

            const options: https.RequestOptions = {
                method: 'GET',
                timeout: 60000,
                rejectUnauthorized: false,
                agent: new https.Agent({ keepAlive: false }),
                headers: {
                    'User-Agent': randomUserAgent,
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
              console.warn(`Proxy: Received non-PDF data from ${currentUrl}. Content: ${preview}`);
              
              if (preview.toLowerCase().includes('<html') || preview.toLowerCase().includes('<!doctype')) {
                  // If we got HTML, it's likely a block page or error page
                  if (attempt < maxRetries) {
                      attempt++;
                      await new Promise(r => setTimeout(r, 1200 * attempt));
                      continue;
                  }
                  return res.status(403).json({ 
                      error: "Blocked Request", 
                      message: "Official server is blocking our connection." 
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
        } else {
            console.error(`Proxy: Attempt ${attempt} failed with status ${result.status}`);
            if (attempt < maxRetries) {
                attempt++;
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            return res.status(result.status || 500).json({ error: "Failed to fetch PDF", status: result.status });
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
    
    // Serve static files with cache control
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, path) => {
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    
    app.get('*', (req, res) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on("connection", async (clientWs) => {
    let currentSession: any;
    // Bumped on every 'init'; lets a background memory fetch confirm it's
    // still injecting into the session the user is actually on, not a
    // stale one from before a quick re-init (e.g. toggling settings).
    let currentSessionToken = 0;

    // Server-side equivalent of chatService.ts's saveAIMessage, using the
    // admin SDK (the client SDK saveAIMessage uses can't run here). Used to
    // persist voice-session transcripts so a session that just ended is
    // immediately available to getSummaryForUser's raw-message fallback —
    // previously nothing from voice conversations was ever written to
    // Firestore (only images were, via the client's sendImageToWebSocket),
    // which is why memory of a conversation from moments earlier was empty.
    const saveVoiceMessage = async (userId: string, senderId: string, text: string) => {
        if (!text || !text.trim()) return;
        try {
            const db = getFirestore(firebaseAdminApp, firebaseConfig.firestoreDatabaseId);
            const aiChatId = `${userId}_ai`;
            await db.collection('chats').doc(aiChatId).collection('messages').add({
                senderId,
                text: text.trim(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (err) {
            // Never let a transcript-save failure affect the live session.
            console.error("Failed to save voice transcript to Firestore:", err);
        }
    };

    const createSession = async (userId: string, memorySettings: { enabled: boolean, range: string }, voice: string, thinkingLevel: string = 'high') => {
        let systemInstruction = `You are NeetMaster AI, a specialized study companion for NEET aspirants. 
You MUST speak ONLY in natural, fluent Hindi. Do not use English unless absolutely necessary for specific technical terms. 
Use a warm, encouraging, emotionally expressive tone. 
Pause naturally, avoid robotic phrasing, and sound like a real NEET mentor. 

IMPORTANT — Accuracy: You are a fast, low-latency voice model, not a deep-reasoning model. Never guess at a fact, formula, chemical reaction, or numerical answer if you are not genuinely confident it is correct. If a question requires precise calculation, a multi-step derivation, or a fact you're unsure of, say so honestly — for example, tell the student this needs careful step-by-step working and suggest they open it in the app's Neural Solver or Test Tutor (text mode) for a fully worked, verified answer, rather than speaking a possibly wrong answer with confidence. It is always better to admit uncertainty than to state something incorrect in a confident tone.

If you receive images, store them in your context, but ONLY analyze or reference them if the user specifically asks a question about an image. Otherwise, answer the user's questions based on your general knowledge.`;

        // NOTE: Memory is intentionally NOT awaited here anymore. Blocking
        // session creation on the Firestore summary lookup (even with a
        // 2.5s cap) meant init_ack — which the client waits for before
        // sending any mic audio — was delayed by however long Firestore
        // took, so the first couple of seconds of speech were always lost
        // on a cold start. Session now starts immediately with no memory,
        // and if memory is enabled, the summary is fetched in the
        // background and silently injected as context once it arrives
        // (see fetchAndInjectMemory below), typically well before the user
        // has said anything memory-dependent.

        // Per-turn transcript buffers — Gemini streams transcript text in
        // small chunks, so we accumulate until turnComplete before writing
        // one Firestore doc per turn (instead of one doc per chunk).
        let inputTranscriptBuffer = '';
        let outputTranscriptBuffer = '';

        return await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            callbacks: {
                onmessage: (message: any) => {
                    console.log("Gemini Live Message Received:", JSON.stringify(message, null, 2));
                    const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    // With outputAudioTranscription enabled, the transcript of what
                    // the model is SPEAKING arrives here, not as a text Part.
                    const transcript = message.serverContent?.outputTranscription?.text;
                    // With inputAudioTranscription enabled, this carries the
                    // transcript of what the USER said via the mic. Buffered
                    // the same way as the output transcript and flushed to
                    // Firestore on turnComplete, so voice conversations are
                    // no longer invisible to memory (previously nothing said
                    // aloud was ever persisted — only images were).
                    const inputTranscript = message.serverContent?.inputTranscription?.text;
                    if (audio) clientWs.send(JSON.stringify({ audio }));
                    if (transcript) {
                        clientWs.send(JSON.stringify({ text: transcript }));
                        outputTranscriptBuffer += transcript;
                    }
                    if (inputTranscript) {
                        inputTranscriptBuffer += inputTranscript;
                    }
                    if (message.serverContent?.interrupted)
                        clientWs.send(JSON.stringify({ interrupted: true }));
                    if (message.serverContent?.turnComplete) {
                        clientWs.send(JSON.stringify({ turnComplete: true }));
                        // Fire-and-forget: never block the live session on
                        // Firestore writes.
                        if (inputTranscriptBuffer.trim()) {
                            saveVoiceMessage(userId, userId, inputTranscriptBuffer);
                        }
                        if (outputTranscriptBuffer.trim()) {
                            saveVoiceMessage(userId, 'ai', outputTranscriptBuffer);
                        }
                        inputTranscriptBuffer = '';
                        outputTranscriptBuffer = '';
                    }
                },
            },
            config: {
                // IMPORTANT: gemini-3.1-flash-live-preview rejects
                // responseModalities: [AUDIO, TEXT] outright (this is a
                // confirmed model limitation, not a config mistake — see
                // googleapis/python-genai#2238). Requesting both modalities
                // together silently breaks session creation, which is why
                // captions never appeared AND — once the system instruction
                // got longer with memory context enabled — replies stopped
                // coming through entirely. Only AUDIO is a valid modality for
                // this model; outputAudioTranscription gives us the caption
                // text alongside the audio without needing TEXT modality.
                responseModalities: [Modality.AUDIO],
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Aoede" } },
                },
                // Without this, the model defaults to 'minimal' thinking —
                // optimized purely for the lowest possible latency, at the
                // cost of accuracy on anything requiring real reasoning
                // (calculations, multi-step chemistry/physics, careful
                // reading of an image). Higher levels trade a bit of
                // response delay for noticeably better-reasoned, more
                // accurate answers. User-configurable from Settings.
                thinkingConfig: {
                    thinkingLevel: ['low', 'medium', 'high'].includes(thinkingLevel) ? thinkingLevel : 'high',
                },
                systemInstruction: systemInstruction,
            },
        });
    };

    // Fetches the Firestore memory summary in the background and, if it's
    // still the active session by the time it resolves, silently feeds it
    // into the live session as a system turn (not spoken aloud, just added
    // to context). Runs fully in parallel with the user talking — never
    // blocks init_ack. Guarded by sessionToken so a stale/late summary from
    // a previous session can't get injected into a session the user has
    // since replaced (e.g. rapid re-inits).
    const injectMemoryInBackground = (
        userId: string,
        memorySettings: { enabled: boolean, range: string },
        session: any,
        sessionToken: number,
        prefetchedSummary?: string | null
    ) => {
        if (!memorySettings || !memorySettings.enabled) return;

        const inject = (summary: string | null) => {
            if (!summary) {
                console.warn("Memory summary lookup returned nothing (no summary exists yet) — continuing without memory context.");
                return;
            }
            if (sessionToken !== currentSessionToken || session !== currentSession) {
                console.log("Memory summary arrived after session changed, discarding.");
                return;
            }
            try {
                session.sendClientContent({
                    turns: [{
                        role: "user",
                        parts: [{ text: `[System note, do not acknowledge or read this aloud — just use it as background context for this conversation]\nUser Context/Memory: ${summary}` }],
                    }],
                    turnComplete: false,
                });
                console.log("Memory context injected into live session for user:", userId);
            } catch (err) {
                console.error("Failed to inject memory context into live session:", err);
            }
        };

        // If the client already prefetched the summary via /api/memory-summary
        // before the user even tapped the mic, use it directly — zero
        // Firestore round-trips on the init critical path.
        if (prefetchedSummary !== undefined) {
            inject(prefetchedSummary);
            return;
        }

        getSummaryForUser(userId, memorySettings.range)
            .then(inject)
            .catch((err) => {
                console.error("Memory summary lookup failed, continuing WITHOUT memory context:", err);
            });
    };

    clientWs.on("message", async (data) => {
      const parsedData = JSON.parse(data.toString());
      
      if (parsedData.type === 'init') {
          try {
              if (currentSession) await currentSession.close();
              currentSessionToken++;
              const thisToken = currentSessionToken;
              currentSession = await createSession(parsedData.userId, parsedData.memorySettings, parsedData.voice, parsedData.thinkingLevel);
              console.log("Gemini Live session created successfully for user:", parsedData.userId);
              clientWs.send(JSON.stringify({ type: 'init_ack' }));
              // Fire-and-forget: does not delay init_ack above.
              injectMemoryInBackground(parsedData.userId, parsedData.memorySettings, currentSession, thisToken, parsedData.prefetchedSummary);
          } catch (err) {
              console.error("Failed to create Gemini Live session:", err);
              currentSession = undefined;
              clientWs.send(JSON.stringify({ error: "session_init_failed" }));
          }
          return;
      }
      
      if (!currentSession) {
          console.warn("Received message before session initialized, keys:", Object.keys(parsedData));
          // Let the client know so it doesn't sit silently in "Listening..."
          // believing audio is being processed when it's actually being dropped.
          clientWs.send(JSON.stringify({ error: "session_not_initialized" }));
          return;
      }

      if (parsedData.audio) {
          console.log("Audio data received from client, size:", parsedData.audio.length);
          currentSession.sendRealtimeInput({
            audio: { data: parsedData.audio, mimeType: "audio/pcm;rate=16000" },
          });
      } else if (parsedData.image) {
          console.log("Image data received from client, mimeType:", parsedData.mimeType);
          try {
            currentSession.sendRealtimeInput({
              video: {
                data: parsedData.image,
                mimeType: parsedData.mimeType || "image/jpeg",
              }
            });
            clientWs.send(JSON.stringify({ imageAck: true, imageId: parsedData.imageId }));
          } catch (err) {
            console.error("Failed to forward image to Gemini Live session:", err);
            clientWs.send(JSON.stringify({ imageAck: false, imageId: parsedData.imageId, error: "image_forward_failed" }));
          }
      } else if (parsedData.interrupt) {
          console.log("Interrupt signal received");
          clientWs.send(JSON.stringify({ interrupted: true }));
      } else {
          console.log("Message received from client, keys:", Object.keys(parsedData));
      }
    });

    clientWs.on("close", () => {
        if (currentSession) currentSession.close();
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
