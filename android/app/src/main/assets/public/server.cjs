var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// src/services/searchService.ts
async function performSearch(query) {
  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) {
    console.error("SEARCH_API_KEY not set.");
    return [];
  }
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        // Get more depth
        max_results: 5
        // Get more results
      })
    });
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Search API Error:", error);
    return [];
  }
}

// server.ts
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_firestore = require("firebase-admin/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0147825816",
  appId: "1:900766773228:web:5271459b996a6dc0115ac9",
  apiKey: "AIzaSyC-gsqDjEtOvuru8B9awQJUdstZ9gNBUuw",
  authDomain: "gen-lang-client-0147825816.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-eb74a956-bfd2-4f5b-9cfc-8a7e9c6f6409",
  storageBucket: "gen-lang-client-0147825816.firebasestorage.app",
  messagingSenderId: "900766773228",
  measurementId: ""
};

// server.ts
var cheerio = __toESM(require("cheerio"), 1);
var import_sdk = require("@openrouter/sdk");
var import_nodemailer = __toESM(require("nodemailer"), 1);
var app = import_firebase_admin.default.initializeApp({
  projectId: firebase_applet_config_default.projectId
});
var transporter = import_nodemailer.default.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
var limiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
var logs = [];
import_dotenv.default.config();
var openrouter = process.env.OPENROUTER_API_KEY ? new import_sdk.OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY }) : null;
function formatOpenRouterPrompt(prompt) {
  if (typeof prompt === "string") return prompt;
  if (prompt && prompt.parts) {
    const parts = prompt.parts.map((p) => {
      if (p.text) return { type: "text", text: p.text };
      if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
      return { type: "text", text: typeof p === "string" ? p : JSON.stringify(p) };
    });
    if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
    return parts;
  }
  return typeof prompt === "string" ? prompt : JSON.stringify(prompt);
}
async function callAI(prompt) {
  if (!openrouter) throw new Error("OpenRouter API key not configured");
  const content = formatOpenRouterPrompt(prompt);
  console.log("DEBUG: Calling OpenRouter with content type:", typeof content, "content:", JSON.stringify(content));
  const completion = await openrouter.chat.send({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content }]
  });
  return completion.choices[0]?.message.content || "";
}
async function startServer() {
  const app2 = (0, import_express.default)();
  app2.set("trust proxy", 1);
  const PORT = 3e3;
  app2.use(import_express.default.json({ limit: "10mb" }));
  app2.use((0, import_cors.default)({ origin: "https://neetmaster.vercel.app" }));
  app2.use("/api/", limiter);
  app2.get("/api/logs", (req, res) => {
    res.json({ logs });
  });
  app2.post("/api/send-otp", async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: "Missing identifier" });
    }
    const otp = Math.floor(1e3 + Math.random() * 9e3).toString();
    try {
      const db = (0, import_firestore.getFirestore)();
      await db.collection("otps").doc(identifier).set({
        otp,
        createdAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: identifier,
        subject: "Your OTP for NeetMaster",
        text: `Your OTP is ${otp}. It expires in 5 minutes.`
      });
      console.log(`[REAL] Sending OTP ${otp} to ${identifier}`);
      res.json({ success: true });
    } catch (error) {
      console.error("OTP generation error:", error);
      res.status(500).json({ error: "Failed to generate OTP" });
    }
  });
  app2.post("/api/verify-otp", async (req, res) => {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ error: "Missing identifier or OTP" });
    }
    try {
      const db = (0, import_firestore.getFirestore)();
      const doc = await db.collection("otps").doc(identifier).get();
      if (!doc.exists) {
        return res.status(400).json({ error: "OTP not found or expired" });
      }
      const data = doc.data();
      if (data?.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }
      if (Date.now() - data.createdAt.toMillis() > 5 * 60 * 1e3) {
        return res.status(400).json({ error: "OTP expired" });
      }
      await db.collection("otps").doc(identifier).delete();
      res.json({ success: true });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });
  app2.get("/api/neet-notices", async (req, res) => {
    try {
      const response = await fetch("https://neet.nta.nic.in/");
      const html = await response.text();
      const $ = cheerio.load(html);
      const publicNotices = [];
      const candidateActivity = [];
      const sections = {
        "Public Notices": [],
        "Candidate Activity": []
      };
      $("h1, h2, h3, h4, .heading").each((i, el) => {
        const headingText = $(el).text().trim();
        if (headingText.includes("Public Notices")) {
          const list = $(el).nextAll("ul").first().find("li");
          list.each((j, li) => {
            const link = $(li).find("a");
            const text = link.text().trim() || $(li).text().trim();
            let url = link.attr("href");
            if (url && !url.startsWith("http")) {
              url = "https://neet.nta.nic.in" + url;
            }
            if (text) sections["Public Notices"].push({ text, url: url || "#" });
          });
        }
        if (headingText.includes("Candidate Activity")) {
          const list = $(el).nextAll("ul").first().find("li");
          list.each((j, li) => {
            const link = $(li).find("a");
            const text = link.text().trim() || $(li).text().trim();
            let url = link.attr("href");
            if (url && !url.startsWith("http")) {
              url = "https://neet.nta.nic.in" + url;
            }
            if (text) sections["Candidate Activity"].push({ text, url: url || "#" });
          });
        }
      });
      res.json({
        publicNotices: sections["Public Notices"].slice(0, 5),
        candidateActivity: sections["Candidate Activity"].slice(0, 5)
      });
    } catch (error) {
      console.error("NEET Notices Error:", error);
      res.status(500).json({ error: "Failed to fetch notices" });
    }
  });
  app2.post("/api/gemini", async (req, res) => {
    const { base64Audio, base64Image, prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    try {
      const parts = [];
      if (base64Audio) {
        parts.push({ inlineData: { data: base64Audio, mimeType: "audio/webm" } });
      }
      if (base64Image) {
        const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
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
  app2.post("/api/analysis", async (req, res) => {
    const { questions, answers } = req.body;
    if (!questions || !answers) {
      return res.status(400).json({ error: "Missing data" });
    }
    const prompt = `
            Analyze the following student test results carefully:
            - Total Questions: ${questions.length}
            - Correct: ${Object.values(answers).filter((a, idx) => a === questions[idx].correct_option).length}
            - Incorrect: ${Object.values(answers).filter((a, idx) => a && a !== questions[idx].correct_option).length}
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
  app2.post("/api/tutor", async (req, res) => {
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
  app2.post("/api/neural-chat", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages" });
    }
    const lastMessage = messages[messages.length - 1].content;
    try {
      const reply = await callAI(`You are a friendly NEET tutor. Answer accurately according to NCERT. ${lastMessage}`);
      res.json({ reply });
    } catch (error) {
      console.error("OpenAI API Error:", error);
      res.status(500).json({ error: "Failed to get AI response: " + (error instanceof Error ? error.message : String(error)) });
    }
  });
  app2.post("/api/search-stream", async (req, res) => {
    const { prompt, base64Image } = req.body;
    if (!prompt && !base64Image) {
      return res.status(400).json({ error: "Missing prompt or image" });
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    try {
      let finalPrompt = prompt;
      if (base64Image && (!prompt || prompt.length < 5)) {
        try {
          finalPrompt = await callAI({
            parts: [
              { text: "What is in the image? Give a 5 word search query." },
              { inlineData: { data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image, mimeType: "image/jpeg" } }
            ]
          });
        } catch (imgErr) {
          console.error("Image analysis failed:", imgErr);
          finalPrompt = "Search for this image";
        }
        res.write(`data: ${JSON.stringify({ query: finalPrompt })}

`);
      }
      let searchResults = [];
      const isDirectImageQuestion = base64Image && prompt && prompt.length >= 5;
      if (!isDirectImageQuestion && finalPrompt) {
        searchResults = await performSearch(finalPrompt);
        res.write(`data: ${JSON.stringify({ sources: searchResults })}

`);
      }
      const sanitizeText = (text) => {
        return text.replace(/\\\[|\\\]|\\\(|\\\)/g, "").replace(/\$/g, "").replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, "($1 / $2)").replace(/\\times/g, " \xD7 ").replace(/\\dot\s*\{([^}]+)\}/g, " \xB7 ").replace(/\\cdot/g, " \xB7 ").replace(/\\text\s*\{([^}]+)\}/g, "$1").replace(/_([a-zA-Z0-9])/g, "$1").replace(/\^2/g, "\xB2").replace(/\\theta/g, "\u03B8").replace(/\\alpha/g, "\u03B1").replace(/\\beta/g, "\u03B2").replace(/\\gamma/g, "\u03B3").replace(/\\pi/g, "\u03C0").replace(/\\Delta/g, "\u0394").replace(/\\[a-zA-Z]+/g, "").replace(/[\{\}]/g, "");
      };
      if (isDirectImageQuestion || searchResults.length > 0) {
        let contents;
        if (isDirectImageQuestion) {
          contents = { parts: [{ text: finalPrompt }, { inlineData: { data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image, mimeType: "image/jpeg" } }] };
        } else {
          const context = searchResults.slice(0, 3).map((s) => `Title: ${s.title}
Content: ${s.content}`).join("\n\n");
          contents = `Summarize the following search results to answer the query: "${finalPrompt}" concisely and clearly in plain text. Do not use LaTeX. Only provide the summary.

Context:
${context}`;
        }
        let streamed = false;
        if (openrouter) {
          try {
            const content = formatOpenRouterPrompt(contents);
            console.log("Sending to OpenRouter:", JSON.stringify(content, null, 2));
            if (!content) throw new Error("Content is empty");
            const stream = await openrouter.chat.send({
              model: "openai/gpt-4o",
              messages: [{ role: "user", content }],
              stream: true
            });
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) {
                res.write(`data: ${JSON.stringify({ content: sanitizeText(text) })}

`);
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
        res.write(`data: ${JSON.stringify({ content: "No results found." })}

`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("Streaming Search Error:", error);
      res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}

`);
      res.end();
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
